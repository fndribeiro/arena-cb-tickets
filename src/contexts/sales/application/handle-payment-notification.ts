import type { Result } from "../../../shared/result";
import { err } from "../../../shared/result";
import type { WebhookError, WebhookRequest } from "../../payments/domain/payment-gateway";
import type { Order } from "../domain/order";
import { type ConfirmPaymentDeps, type ConfirmPaymentError, confirmPayment } from "./confirm-payment";

export type NotificationError = WebhookError | ConfirmPaymentError;

/** Webhook entry point: authenticate, locate the order and confirm through the gateway API. */
export async function handlePaymentNotification(request: WebhookRequest, deps: ConfirmPaymentDeps): Promise<Result<Order, NotificationError>> {

  const parsed = await deps.gateway.parseWebhook(request);

  if (!parsed.ok) {
    deps.logger.warn("payment notification rejected", { reason: parsed.error });
    return parsed;
  }

  const order: Order | null = await deps.orders.findByChargeId(parsed.value.chargeId);

  if (!order) {
    deps.logger.warn("payment notification for unknown charge", { chargeId: parsed.value.chargeId });
    return err("ORDER_NOT_FOUND");
  }

  return confirmPayment({ orderId: order.id, simulate: false }, deps);
}
