import type { Context } from "hono";
import { Hono } from "hono";
import { handlePaymentNotification } from "../../../contexts/sales/application/handle-payment-notification";
import type { AppEnv } from "../app-env";

const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;

export const webhookRoutes = new Hono<AppEnv>();

webhookRoutes.post("/webhooks/mercadopago", handleMercadoPagoWebhook);

/**
 * 401 for bad signatures; 200 otherwise (including "not paid yet") so Mercado Pago does not retry forever.
 * Missed notifications are recovered by the reconciliation cron.
 */
async function handleMercadoPagoWebhook(c: Context<AppEnv>) {

  const body: string = await c.req.text();

  if (body.length > MAX_WEBHOOK_BODY_BYTES) {
    c.get("logger").warn("webhook body too large", { bytes: body.length });
    return c.text("payload too large", 413);
  }

  const request = { headers: c.req.raw.headers, query: new URL(c.req.url).searchParams, body };

  const result = await handlePaymentNotification(request, c.get("container").confirmPayment);

  if (!result.ok && result.error === "INVALID_SIGNATURE") {
    return c.text("invalid signature", 401);
  }

  c.get("logger").info("webhook handled", { outcome: result.ok ? "paid" : result.error });

  return c.text("ok", 200);
}
