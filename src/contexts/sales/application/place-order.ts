import type { Clock } from "../../../shared/clock";
import { describeError, type Logger } from "../../../shared/logger";
import { err, ok, type Result } from "../../../shared/result";
import type { Event } from "../../events/domain/event";
import type { EventRepository } from "../../events/domain/event-repository";
import type { PaymentGateway, PixCharge } from "../../payments/domain/payment-gateway";
import { Order } from "../domain/order";
import type { OrderRepository } from "../domain/order-repository";
import { Quantity } from "../domain/quantity";

export interface PlaceOrderCommand {
  readonly eventId: string;
  readonly userId: string;
  readonly payerEmail: string;
  readonly quantity: number;
}

export interface PlaceOrderDeps {
  readonly events: EventRepository;
  readonly orders: OrderRepository;
  readonly gateway: PaymentGateway;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly newId: () => string;
  readonly ttlMinutes: number;
  readonly maxTicketsPerOrder: number;
}

export type PlaceOrderError = "INVALID_QUANTITY" | "EVENT_NOT_FOUND" | "EVENT_NOT_ON_SALE" | "SOLD_OUT" | "PAYMENT_UNAVAILABLE";

/** Reserves seats atomically, creates a pending order and its Pix charge. Compensates on any failure. */
export async function placeOrder(command: PlaceOrderCommand, deps: PlaceOrderDeps): Promise<Result<Order, PlaceOrderError>> {

  const quantity = Quantity.of(command.quantity, deps.maxTicketsPerOrder);

  if (!quantity.ok) {
    return err("INVALID_QUANTITY");
  }

  const event: Event | null = await deps.events.findById(command.eventId);

  const availability: PlaceOrderError | null = checkAvailability(event, command.quantity, deps.clock.now());

  if (availability || !event) {
    deps.logger.info("order refused", { eventId: command.eventId, userId: command.userId, reason: availability });
    return err(availability ?? "EVENT_NOT_FOUND");
  }

  const reserved: boolean = await deps.events.reserveSeats(event.id, command.quantity);

  if (!reserved) {
    deps.logger.info("order refused: seats taken concurrently", { eventId: event.id, quantity: command.quantity });
    return err("SOLD_OUT");
  }

  const order: Order = Order.place({
    id: deps.newId(),
    eventId: event.id,
    userId: command.userId,
    quantity: command.quantity,
    unitPrice: event.price,
    now: deps.clock.now(),
    ttlMinutes: deps.ttlMinutes,
  });

  return createOrderWithCharge({ order, event, command }, deps);
}

function checkAvailability(event: Event | null, quantity: number, now: Date): PlaceOrderError | null {

  if (!event) {
    return "EVENT_NOT_FOUND";
  }

  if (!event.isOnSale(now)) {
    return "EVENT_NOT_ON_SALE";
  }

  return event.hasSeatsFor(quantity) ? null : "SOLD_OUT";
}

interface OrderContext {
  readonly order: Order;
  readonly event: Event;
  readonly command: PlaceOrderCommand;
}

async function createOrderWithCharge(context: OrderContext, deps: PlaceOrderDeps): Promise<Result<Order, PlaceOrderError>> {

  const { order, event, command } = context;

  let inserted = false;

  try {
    await deps.orders.insert(order);

    inserted = true;

    const charge: PixCharge = await deps.gateway.createPixCharge({
      orderId: order.id,
      amount: order.amount,
      description: `${command.quantity}x ${event.title}`,
      payerEmail: command.payerEmail,
      expiresAt: order.expiresAt,
    });

    const withPayment: Order = attachCharge(order, charge, deps.gateway.name);

    await deps.orders.updatePayment(withPayment);

    deps.logger.info("order placed", { orderId: order.id, eventId: event.id, quantity: command.quantity, amountCents: order.amount.cents, chargeId: charge.chargeId });

    return ok(withPayment);
  } catch (error) {
    deps.logger.error("order placement failed, compensating", { orderId: order.id, eventId: event.id, inserted, ...describeError(error) });

    await compensate({ order, inserted }, deps);

    return err("PAYMENT_UNAVAILABLE");
  }
}

function attachCharge(order: Order, charge: PixCharge, gatewayName: string): Order {

  const attached = order.attachPayment({ gateway: gatewayName, ...charge });

  if (!attached.ok) {
    throw new Error(`Cannot attach payment to order ${order.id}: ${attached.error}`);
  }

  return attached.value;
}

interface CompensationInput {
  readonly order: Order;
  readonly inserted: boolean;
}

async function compensate(input: CompensationInput, deps: PlaceOrderDeps): Promise<void> {

  const { order, inserted } = input;

  await deps.events.releaseSeats(order.eventId, order.quantity);

  if (!inserted) {
    return;
  }

  const cancelled = order.cancel();

  if (cancelled.ok) {
    await deps.orders.transition(cancelled.value, "pending");
  }
}
