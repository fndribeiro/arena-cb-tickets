import { z } from "zod";
import type { Logger } from "../../../shared/logger";
import { err, ok, type Result } from "../../../shared/result";
import {
  type ChargeStatus,
  type CreatePixChargeInput,
  type PaymentGateway,
  PaymentGatewayError,
  type PixCharge,
  type WebhookError,
  type WebhookRequest,
} from "../domain/payment-gateway";

const DEFAULT_BASE_URL = "https://api.mercadopago.com";

const REQUEST_TIMEOUT_MS = 10_000;

const MIN_PIX_EXPIRATION_MINUTES = 30;

/** Mercado Pago sandbox: a test payer named "APRO" gets the payment auto-approved (verify with scripts/mp-sandbox-spike.ts). */
const TEST_APPROVED_PAYER_NAME = "APRO";

const PAID_STATUSES: ReadonlySet<string> = new Set(["processed"]);

const EXPIRED_STATUSES: ReadonlySet<string> = new Set(["expired"]);

const FAILED_STATUSES: ReadonlySet<string> = new Set(["failed", "canceled", "cancelled", "refunded", "charged_back"]);

const orderResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  transactions: z
    .object({
      payments: z
        .array(
          z.object({
            payment_method: z
              .object({ qr_code: z.string().optional(), qr_code_base64: z.string().optional(), ticket_url: z.string().optional() })
              .optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

type OrderResponse = z.infer<typeof orderResponseSchema>;

const webhookBodySchema = z.object({ type: z.string().optional(), data: z.object({ id: z.union([z.string(), z.number()]) }).optional() });

export interface MercadoPagoOptions {
  readonly accessToken: string;
  readonly webhookSecret: string;
  readonly testMode: boolean;
  readonly logger: Logger;
  readonly fetchFn?: typeof fetch;
  readonly baseUrl?: string;
}

interface ApiRequest {
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly body?: unknown;
  readonly idempotencyKey?: string;
}

/** Pix through the Mercado Pago Orders API (https://www.mercadopago.com.br/developers/pt/reference/orders). */
export class MercadoPagoGateway implements PaymentGateway {
  readonly name = "mercadopago";

  private readonly fetchFn: typeof fetch;

  private readonly baseUrl: string;

  constructor(private readonly options: MercadoPagoOptions) {
    this.fetchFn = options.fetchFn ?? fetch.bind(globalThis);
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  }

  get testMode(): boolean {
    return this.options.testMode;
  }

  async createPixCharge(input: CreatePixChargeInput): Promise<PixCharge> {

    const amount: string = input.amount.toDecimalString();

    const body = {
      type: "online",
      processing_mode: "automatic",
      external_reference: input.orderId,
      total_amount: amount,
      description: input.description,
      payer: this.payerFor(input.payerEmail),
      transactions: { payments: [{ amount, payment_method: { id: "pix", type: "bank_transfer" }, expiration_time: pixExpiration(input.expiresAt) }] },
    };

    const response: OrderResponse = await this.request({ method: "POST", path: "/v1/orders", body, idempotencyKey: input.orderId });

    return toPixCharge(response);
  }

  async getChargeStatus(chargeId: string): Promise<ChargeStatus> {

    const response: OrderResponse = await this.request({ method: "GET", path: `/v1/orders/${encodeURIComponent(chargeId)}` });

    return mapStatus(response.status);
  }

  async parseWebhook(request: WebhookRequest): Promise<Result<{ readonly chargeId: string }, WebhookError>> {

    const parsedBody = webhookBodySchema.safeParse(safeJson(request.body));

    const body = parsedBody.success ? parsedBody.data : {};

    const dataId: string | null = request.query.get("data.id") ?? (body.data ? String(body.data.id) : null);

    const type: string | null = request.query.get("type") ?? body.type ?? null;

    const signatureValid: boolean = dataId !== null && (await this.isSignatureValid(request.headers, dataId));

    if (!signatureValid || !dataId) {
      this.options.logger.warn("mercado pago webhook signature invalid", { dataId, type });
      return err("INVALID_SIGNATURE");
    }

    if (type !== "order") {
      return err("IGNORED_EVENT");
    }

    return ok({ chargeId: dataId });
  }

  private payerFor(email: string): Record<string, string> {
    return this.options.testMode ? { email, first_name: TEST_APPROVED_PAYER_NAME } : { email };
  }

  /** Validates x-signature as documented: HMAC-SHA256(secret, "id:{data.id};request-id:{x-request-id};ts:{ts};"). */
  private async isSignatureValid(headers: Headers, dataId: string): Promise<boolean> {

    const signature = parseSignatureHeader(headers.get("x-signature"));

    const requestId: string | null = headers.get("x-request-id");

    if (!signature || !requestId) {
      return false;
    }

    const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${signature.ts};`;

    const expected: string = await hmacSha256Hex(this.options.webhookSecret, manifest);

    return constantTimeEqual(expected, signature.v1);
  }

  private async request(apiRequest: ApiRequest): Promise<OrderResponse> {

    const headers: Record<string, string> = { Authorization: `Bearer ${this.options.accessToken}`, "Content-Type": "application/json" };

    if (apiRequest.idempotencyKey) {
      headers["X-Idempotency-Key"] = apiRequest.idempotencyKey;
    }

    const init: RequestInit = { method: apiRequest.method, headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) };

    if (apiRequest.body !== undefined) {
      init.body = JSON.stringify(apiRequest.body);
    }

    const response: Response = await this.fetchFn(`${this.baseUrl}${apiRequest.path}`, init);

    return this.parseResponse(response, apiRequest);
  }

  private async parseResponse(response: Response, apiRequest: ApiRequest): Promise<OrderResponse> {

    const text: string = await response.text();

    if (!response.ok) {
      this.options.logger.error("mercado pago request failed", { method: apiRequest.method, path: apiRequest.path, status: response.status, body: text.slice(0, 500) });
      throw new PaymentGatewayError(`Mercado Pago ${apiRequest.method} ${apiRequest.path} failed with ${response.status}`, response.status);
    }

    const parsed = orderResponseSchema.safeParse(safeJson(text));

    if (!parsed.success) {
      this.options.logger.error("mercado pago response has unexpected shape", { path: apiRequest.path, issues: parsed.error.issues.length });
      throw new PaymentGatewayError("Unexpected Mercado Pago response", response.status);
    }

    return parsed.data;
  }
}

function toPixCharge(response: OrderResponse): PixCharge {

  const method = response.transactions?.payments?.[0]?.payment_method;

  if (!method?.qr_code) {
    throw new PaymentGatewayError(`Mercado Pago order ${response.id} has no Pix QR code`, null);
  }

  return { chargeId: response.id, qrCode: method.qr_code, qrCodeBase64: method.qr_code_base64 ?? null, ticketUrl: method.ticket_url ?? null };
}

function mapStatus(status: string): ChargeStatus {

  if (PAID_STATUSES.has(status)) {
    return "paid";
  }

  if (EXPIRED_STATUSES.has(status)) {
    return "expired";
  }

  return FAILED_STATUSES.has(status) ? "failed" : "pending";
}

function pixExpiration(expiresAt: Date): string {

  const minutesLeft: number = Math.ceil((expiresAt.getTime() - Date.now()) / 60_000);

  return `PT${Math.max(MIN_PIX_EXPIRATION_MINUTES, minutesLeft)}M`;
}

interface SignatureParts {
  readonly ts: string;
  readonly v1: string;
}

function parseSignatureHeader(header: string | null): SignatureParts | null {

  if (!header) {
    return null;
  }

  const entries = header.split(",").map((part) => part.trim().split("=", 2));

  const values = new Map(entries.map(([key = "", value = ""]) => [key, value]));

  const ts: string | undefined = values.get("ts");

  const v1: string | undefined = values.get("v1");

  return ts && v1 ? { ts, v1 } : null;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {

  const encoder = new TextEncoder();

  const key: CryptoKey = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

  const signature: ArrayBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(message));

  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(expected: string, actual: string): boolean {

  if (expected.length !== actual.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ actual.charCodeAt(index);
  }

  return difference === 0;
}

/** Malformed JSON is an expected input error: callers validate the result with zod and log the failure. */
function safeJson(text: string): unknown {

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
