import { describe, expect, it } from "vitest";
import { Money } from "../../../src/contexts/events/domain/money";
import { PaymentGatewayError } from "../../../src/contexts/payments/domain/payment-gateway";
import { MercadoPagoGateway } from "../../../src/contexts/payments/infrastructure/mercado-pago-gateway";
import { RecordingLogger } from "../../support/in-memory";

const SECRET = "webhook-secret";

interface RecordedCall {
  readonly url: string;
  readonly init: RequestInit;
}

function gatewayReturning(status: number, body: unknown, testMode = true) {

  const calls: RecordedCall[] = [];

  const fetchFn = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {

    calls.push({ url: String(input), init: init ?? {} });

    return new Response(JSON.stringify(body), { status });
  };

  const logger = new RecordingLogger();

  const gateway = new MercadoPagoGateway({ accessToken: "TEST-token", webhookSecret: SECRET, testMode, logger, fetchFn: fetchFn as typeof fetch });

  return { gateway, calls, logger };
}

const PIX_ORDER = {
  id: "ORD01ABC",
  status: "action_required",
  transactions: { payments: [{ payment_method: { qr_code: "00020126pix", qr_code_base64: "iVBOR", ticket_url: "https://mp/ticket" } }] },
};

const CHARGE_INPUT = {
  orderId: "ord-1",
  amount: Money.restore(4000),
  description: "2x Sertanejo Sexta",
  payerEmail: "buyer@gmail.com",
  expiresAt: new Date(Date.now() + 30 * 60_000),
};

async function sign(manifest: string): Promise<string> {

  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey("raw", encoder.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(manifest));

  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("MercadoPagoGateway.createPixCharge", () => {
  it("creates a Pix order with idempotency key and returns the QR code", async () => {

    const { gateway, calls } = gatewayReturning(201, PIX_ORDER);

    const charge = await gateway.createPixCharge(CHARGE_INPUT);

    const sentBody = JSON.parse(String(calls[0]?.init.body));

    const sentHeaders = calls[0]?.init.headers as Record<string, string>;

    expect(charge).toEqual({ chargeId: "ORD01ABC", qrCode: "00020126pix", qrCodeBase64: "iVBOR", ticketUrl: "https://mp/ticket" });

    expect(calls[0]?.url).toBe("https://api.mercadopago.com/v1/orders");

    expect(sentHeaders["X-Idempotency-Key"]).toBe("ord-1");

    expect(sentBody.total_amount).toBe("40.00");

    expect(sentBody.transactions.payments[0].payment_method).toEqual({ id: "pix", type: "bank_transfer" });
  });

  it("uses the auto-approve test payer only in test mode", async () => {

    const test = gatewayReturning(201, PIX_ORDER, true);

    const prod = gatewayReturning(201, PIX_ORDER, false);

    await test.gateway.createPixCharge(CHARGE_INPUT);

    await prod.gateway.createPixCharge(CHARGE_INPUT);

    expect(JSON.parse(String(test.calls[0]?.init.body)).payer.first_name).toBe("APRO");

    expect(JSON.parse(String(prod.calls[0]?.init.body)).payer.first_name).toBeUndefined();
  });

  it("throws a logged PaymentGatewayError on HTTP failures and on missing QR codes", async () => {

    const failing = gatewayReturning(500, { message: "boom" });

    await expect(failing.gateway.createPixCharge(CHARGE_INPUT)).rejects.toBeInstanceOf(PaymentGatewayError);

    expect(failing.logger.has("error", "mercado pago request failed")).toBe(true);

    const noQr = gatewayReturning(201, { id: "X", status: "action_required" });

    await expect(noQr.gateway.createPixCharge(CHARGE_INPUT)).rejects.toThrow(/no Pix QR code/);
  });
});

describe("MercadoPagoGateway.getChargeStatus", () => {
  it.each([
    ["processed", "paid"],
    ["action_required", "pending"],
    ["processing", "pending"],
    ["expired", "expired"],
    ["canceled", "failed"],
    ["refunded", "failed"],
  ])("maps %s to %s", async (mpStatus, expected) => {

    const { gateway } = gatewayReturning(200, { ...PIX_ORDER, status: mpStatus });

    expect(await gateway.getChargeStatus("ORD01ABC")).toBe(expected);
  });

  it("url-encodes the charge id to prevent path injection", async () => {

    const { gateway, calls } = gatewayReturning(200, PIX_ORDER);

    await gateway.getChargeStatus("../v1/payments?x=1");

    expect(calls[0]?.url).toBe("https://api.mercadopago.com/v1/orders/..%2Fv1%2Fpayments%3Fx%3D1");
  });
});

describe("MercadoPagoGateway.parseWebhook", () => {
  async function signedRequest(dataId: string, type = "order") {

    const ts = "1730000000";

    const v1 = await sign(`id:${dataId.toLowerCase()};request-id:req-1;ts:${ts};`);

    const headers = new Headers({ "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": "req-1" });

    return { headers, query: new URLSearchParams({ "data.id": dataId, type }), body: JSON.stringify({ type, data: { id: dataId } }) };
  }

  it("accepts a correctly signed order notification", async () => {

    const { gateway } = gatewayReturning(200, {});

    expect(await gateway.parseWebhook(await signedRequest("ORD01ABC"))).toEqual({ ok: true, value: { chargeId: "ORD01ABC" } });
  });

  it("rejects tampered or missing signatures", async () => {

    const { gateway } = gatewayReturning(200, {});

    const request = await signedRequest("ORD01ABC");

    const tampered = { ...request, query: new URLSearchParams({ "data.id": "OTHER", type: "order" }) };

    const unsigned = { ...request, headers: new Headers() };

    expect(await gateway.parseWebhook(tampered)).toEqual({ ok: false, error: "INVALID_SIGNATURE" });

    expect(await gateway.parseWebhook(unsigned)).toEqual({ ok: false, error: "INVALID_SIGNATURE" });
  });

  it("ignores signed notifications that are not about orders", async () => {

    const { gateway } = gatewayReturning(200, {});

    expect(await gateway.parseWebhook(await signedRequest("123", "payment"))).toEqual({ ok: false, error: "IGNORED_EVENT" });
  });
});
