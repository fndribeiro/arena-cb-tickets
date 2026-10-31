import type { Clock } from "../../../shared/clock";
import type { Logger } from "../../../shared/logger";
import { err, ok, type Result } from "../../../shared/result";
import type { ChargeStatus, PaymentGateway } from "../../payments/domain/payment-gateway";
import type { Order } from "../domain/order";
import type { OrderPaid } from "../domain/order-paid";
import type { OrderRepository } from "../domain/order-repository";

export interface ConfirmPaymentCommand {
  readonly orderId: string;
  /** Test-mode only: marks the order as paid without asking the gateway (PoC "simulate payment"). */
  readonly simulate: boolean;
}

export interface ConfirmPaymentDeps {
  readonly orders: OrderRepository;
  readonly gateway: PaymentGateway;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly onOrderPaid: (event: OrderPaid) => Promise<void>;
}

export type ConfirmPaymentError = "ORDER_NOT_FOUND" | "PAYMENT_NOT_CONFIRMED" | "ORDER_NOT_PAYABLE" | "TEST_MODE_DISABLED";

/** Confirms a payment by reading the charge status from the gateway (never trusting webhook payloads). Idempotent. */
export async function confirmPayment(command: ConfirmPaymentCommand, deps: ConfirmPaymentDeps): Promise<Result<Order, ConfirmPaymentError>> {

  const order: Order | null = await deps.orders.findById(command.orderId);

  if (!order) {
    return err("ORDER_NOT_FOUND");
  }

  if (order.status === "paid") {
    await ensureTicketsIssued(order, deps);
    return ok(order);
  }

  const verification: ConfirmPaymentError | null = await verifyPayment(order, command, deps);

  if (verification) {
    return err(verification);
  }

  return markOrderPaid(order, deps);
}

async function verifyPayment(order: Order, command: ConfirmPaymentCommand, deps: ConfirmPaymentDeps): Promise<ConfirmPaymentError | null> {

  if (command.simulate) {
    return deps.gateway.testMode ? null : rejectSimulation(order, deps);
  }

  if (!order.payment) {
    return "PAYMENT_NOT_CONFIRMED";
  }

  const status: ChargeStatus = await deps.gateway.getChargeStatus(order.payment.chargeId);

  deps.logger.info("charge status checked", { orderId: order.id, chargeId: order.payment.chargeId, status });

  return status === "paid" ? null : "PAYMENT_NOT_CONFIRMED";
}

function rejectSimulation(order: Order, deps: ConfirmPaymentDeps): ConfirmPaymentError {

  deps.logger.warn("payment simulation refused outside test mode", { orderId: order.id });

  return "TEST_MODE_DISABLED";
}

async function markOrderPaid(order: Order, deps: ConfirmPaymentDeps): Promise<Result<Order, ConfirmPaymentError>> {

  const outcome = order.markPaid(deps.clock.now());

  if (!outcome.ok) {
    deps.logger.error("payment received for a non-payable order: manual refund required", { orderId: order.id, status: order.status });
    return err("ORDER_NOT_PAYABLE");
  }

  const transitioned: boolean = await deps.orders.transition(outcome.value.order, "pending");

  if (!transitioned) {
    return resolveConcurrentChange(order.id, deps);
  }

  deps.logger.info("order paid", { orderId: order.id, eventId: order.eventId, amountCents: order.amount.cents });

  if (outcome.value.event) {
    await deps.onOrderPaid(outcome.value.event);
  }

  return ok(outcome.value.order);
}

async function resolveConcurrentChange(orderId: string, deps: ConfirmPaymentDeps): Promise<Result<Order, ConfirmPaymentError>> {

  const current: Order | null = await deps.orders.findById(orderId);

  deps.logger.warn("order changed concurrently during confirmation", { orderId, status: current?.status });

  return current?.status === "paid" ? ok(current) : err("ORDER_NOT_PAYABLE");
}

/** Self-healing: re-dispatching OrderPaid is idempotent, so tickets missing after a crash are issued on the next confirmation. */
async function ensureTicketsIssued(order: Order, deps: ConfirmPaymentDeps): Promise<void> {

  const event: OrderPaid = {
    type: "OrderPaid",
    orderId: order.id,
    eventId: order.eventId,
    userId: order.userId,
    quantity: order.quantity,
    occurredAt: order.paidAt ?? deps.clock.now(),
  };

  await deps.onOrderPaid(event);
}
