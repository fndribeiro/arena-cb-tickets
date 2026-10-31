import { addMinutes } from "../../../shared/clock";
import { err, ok, type Result } from "../../../shared/result";
import type { Money } from "../../events/domain/money";
import type { OrderPaid } from "./order-paid";

export type OrderStatus = "pending" | "paid" | "expired" | "cancelled";

export type OrderTransitionError = "ORDER_NOT_PENDING" | "ORDER_NOT_DUE";

export type MarkPaidError = "ORDER_NOT_PAYABLE";

export interface PixPayment {
  readonly gateway: string;
  readonly chargeId: string;
  readonly qrCode: string;
  readonly qrCodeBase64: string | null;
  readonly ticketUrl: string | null;
}

export interface PlaceOrderInput {
  readonly id: string;
  readonly eventId: string;
  readonly userId: string;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly now: Date;
  readonly ttlMinutes: number;
}

export interface OrderSnapshot {
  readonly id: string;
  readonly eventId: string;
  readonly userId: string;
  readonly quantity: number;
  readonly amount: Money;
  readonly status: OrderStatus;
  readonly payment: PixPayment | null;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly paidAt: Date | null;
}

export interface MarkPaidOutcome {
  readonly order: Order;
  /** Null when the order was already paid (idempotent confirmation). */
  readonly event: OrderPaid | null;
}

/** Order aggregate (sales). Seats are reserved while pending; immutable transitions. */
export class Order {
  private constructor(private readonly props: OrderSnapshot) {}

  static place(input: PlaceOrderInput): Order {
    return new Order({
      id: input.id,
      eventId: input.eventId,
      userId: input.userId,
      quantity: input.quantity,
      amount: input.unitPrice.multiply(input.quantity),
      status: "pending",
      payment: null,
      expiresAt: addMinutes(input.now, input.ttlMinutes),
      createdAt: input.now,
      paidAt: null,
    });
  }

  static restore(snapshot: OrderSnapshot): Order {
    return new Order(snapshot);
  }

  get id(): string {
    return this.props.id;
  }

  get eventId(): string {
    return this.props.eventId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get amount(): Money {
    return this.props.amount;
  }

  get status(): OrderStatus {
    return this.props.status;
  }

  get payment(): PixPayment | null {
    return this.props.payment;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get paidAt(): Date | null {
    return this.props.paidAt;
  }

  isPending(): boolean {
    return this.props.status === "pending";
  }

  isDue(now: Date): boolean {
    return this.isPending() && now.getTime() >= this.props.expiresAt.getTime();
  }

  attachPayment(payment: PixPayment): Result<Order, OrderTransitionError> {

    if (!this.isPending()) {
      return err("ORDER_NOT_PENDING");
    }

    return ok(new Order({ ...this.props, payment }));
  }

  /** Pending orders still hold their seats, so a late payment is accepted until the order is expired. */
  markPaid(now: Date): Result<MarkPaidOutcome, MarkPaidError> {

    if (this.props.status === "paid") {
      return ok({ order: this, event: null });
    }

    if (!this.isPending()) {
      return err("ORDER_NOT_PAYABLE");
    }

    const paid = new Order({ ...this.props, status: "paid", paidAt: now });

    return ok({ order: paid, event: paid.toOrderPaid(now) });
  }

  expire(now: Date): Result<Order, OrderTransitionError> {

    if (!this.isPending()) {
      return err("ORDER_NOT_PENDING");
    }

    if (!this.isDue(now)) {
      return err("ORDER_NOT_DUE");
    }

    return ok(new Order({ ...this.props, status: "expired" }));
  }

  cancel(): Result<Order, OrderTransitionError> {

    if (!this.isPending()) {
      return err("ORDER_NOT_PENDING");
    }

    return ok(new Order({ ...this.props, status: "cancelled" }));
  }

  toSnapshot(): OrderSnapshot {
    return this.props;
  }

  private toOrderPaid(occurredAt: Date): OrderPaid {
    return {
      type: "OrderPaid",
      orderId: this.props.id,
      eventId: this.props.eventId,
      userId: this.props.userId,
      quantity: this.props.quantity,
      occurredAt,
    };
  }
}
