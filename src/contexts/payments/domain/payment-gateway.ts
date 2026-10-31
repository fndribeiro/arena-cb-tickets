import type { Result } from "../../../shared/result";
import type { Money } from "../../events/domain/money";

export type ChargeStatus = "pending" | "paid" | "failed" | "expired";

export interface CreatePixChargeInput {
  readonly orderId: string;
  readonly amount: Money;
  readonly description: string;
  readonly payerEmail: string;
  readonly expiresAt: Date;
}

export interface PixCharge {
  readonly chargeId: string;
  readonly qrCode: string;
  readonly qrCodeBase64: string | null;
  readonly ticketUrl: string | null;
}

export interface WebhookRequest {
  readonly headers: Headers;
  readonly query: URLSearchParams;
  readonly body: string;
}

export type WebhookError = "INVALID_SIGNATURE" | "IGNORED_EVENT";

/** Port for Pix payment providers (Mercado Pago in production, fake in local/tests). */
export interface PaymentGateway {
  readonly name: string;
  readonly testMode: boolean;
  createPixCharge(input: CreatePixChargeInput): Promise<PixCharge>;
  getChargeStatus(chargeId: string): Promise<ChargeStatus>;
  /** Authenticates the notification and extracts the charge id. Status must still be read with getChargeStatus. */
  parseWebhook(request: WebhookRequest): Promise<Result<{ readonly chargeId: string }, WebhookError>>;
}

export class PaymentGatewayError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "PaymentGatewayError";
  }
}
