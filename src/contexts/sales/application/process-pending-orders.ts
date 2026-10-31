import { describeError } from "../../../shared/logger";
import type { EventRepository } from "../../events/domain/event-repository";
import type { Order } from "../domain/order";
import { type ConfirmPaymentDeps, confirmPayment } from "./confirm-payment";

export interface ProcessPendingOrdersDeps extends ConfirmPaymentDeps {
  readonly events: EventRepository;
  readonly batchSize: number;
}

export interface ProcessPendingSummary {
  readonly checked: number;
  readonly confirmed: number;
  readonly expired: number;
  readonly failed: number;
}

type Outcome = "confirmed" | "expired" | "untouched" | "failed";

/** Cron job: reconciles pending orders with the gateway (webhooks may be lost) and releases seats of expired ones. */
export async function processPendingOrders(deps: ProcessPendingOrdersDeps): Promise<ProcessPendingSummary> {

  const pending: ReadonlyArray<Order> = await deps.orders.listPending(deps.batchSize);

  const outcomes: Outcome[] = [];

  for (const order of pending) {
    outcomes.push(await processOrder(order, deps));
  }

  const summary: ProcessPendingSummary = summarize(outcomes);

  deps.logger.info("pending orders processed", { ...summary });

  return summary;
}

async function processOrder(order: Order, deps: ProcessPendingOrdersDeps): Promise<Outcome> {

  try {
    const confirmation = await confirmPayment({ orderId: order.id, simulate: false }, deps);

    if (confirmation.ok) {
      return "confirmed";
    }

    return await expireIfDue(order, deps);
  } catch (error) {
    deps.logger.error("failed to process pending order", { orderId: order.id, ...describeError(error) });
    return "failed";
  }
}

async function expireIfDue(order: Order, deps: ProcessPendingOrdersDeps): Promise<Outcome> {

  const expired = order.expire(deps.clock.now());

  if (!expired.ok) {
    return "untouched";
  }

  const transitioned: boolean = await deps.orders.transition(expired.value, "pending");

  if (!transitioned) {
    return "untouched";
  }

  await deps.events.releaseSeats(order.eventId, order.quantity);

  deps.logger.info("order expired, seats released", { orderId: order.id, eventId: order.eventId, quantity: order.quantity });

  return "expired";
}

function summarize(outcomes: ReadonlyArray<Outcome>): ProcessPendingSummary {

  const count = (target: Outcome): number => outcomes.filter((outcome) => outcome === target).length;

  return { checked: outcomes.length, confirmed: count("confirmed"), expired: count("expired"), failed: count("failed") };
}
