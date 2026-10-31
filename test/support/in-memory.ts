import type { Event } from "../../src/contexts/events/domain/event";
import { Event as EventAggregate } from "../../src/contexts/events/domain/event";
import type { EventRepository } from "../../src/contexts/events/domain/event-repository";
import type { ChargeStatus, CreatePixChargeInput, PaymentGateway, PixCharge, WebhookRequest } from "../../src/contexts/payments/domain/payment-gateway";
import { PaymentGatewayError } from "../../src/contexts/payments/domain/payment-gateway";
import type { Order, OrderStatus } from "../../src/contexts/sales/domain/order";
import type { OrderRepository } from "../../src/contexts/sales/domain/order-repository";
import type { Ticket } from "../../src/contexts/ticketing/domain/ticket";
import { Ticket as TicketAggregate } from "../../src/contexts/ticketing/domain/ticket";
import type { TicketRepository } from "../../src/contexts/ticketing/domain/ticket-repository";
import type { Clock } from "../../src/shared/clock";
import type { LogFields, Logger } from "../../src/shared/logger";
import { err, ok, type Result } from "../../src/shared/result";

export class InMemoryEventRepository implements EventRepository {
  readonly items = new Map<string, Event>();

  async findById(id: string): Promise<Event | null> {
    return this.items.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<Event | null> {
    return [...this.items.values()].find((event) => event.slug === slug) ?? null;
  }

  async listPublishedOnSale(now: Date, limit: number): Promise<ReadonlyArray<Event>> {
    return [...this.items.values()].filter((event) => event.isOnSale(now)).slice(0, limit);
  }

  async listRecent(limit: number): Promise<ReadonlyArray<Event>> {
    return [...this.items.values()].slice(0, limit);
  }

  async insert(event: Event): Promise<void> {
    this.items.set(event.id, event);
  }

  async updateStatus(event: Event): Promise<void> {
    this.items.set(event.id, event);
  }

  async reserveSeats(eventId: string, quantity: number): Promise<boolean> {

    const event = this.items.get(eventId);

    if (event?.status !== "published" || !event.hasSeatsFor(quantity)) {
      return false;
    }

    this.items.set(eventId, EventAggregate.restore({ ...event.toSnapshot(), sold: event.sold + quantity }));

    return true;
  }

  async releaseSeats(eventId: string, quantity: number): Promise<void> {

    const event = this.items.get(eventId);

    if (event) {
      this.items.set(eventId, EventAggregate.restore({ ...event.toSnapshot(), sold: Math.max(0, event.sold - quantity) }));
    }
  }
}

export class InMemoryOrderRepository implements OrderRepository {
  readonly items = new Map<string, Order>();

  async findById(id: string): Promise<Order | null> {
    return this.items.get(id) ?? null;
  }

  async findByChargeId(chargeId: string): Promise<Order | null> {
    return [...this.items.values()].find((order) => order.payment?.chargeId === chargeId) ?? null;
  }

  async listPending(limit: number): Promise<ReadonlyArray<Order>> {
    return [...this.items.values()].filter((order) => order.isPending()).slice(0, limit);
  }

  async insert(order: Order): Promise<void> {
    this.items.set(order.id, order);
  }

  async updatePayment(order: Order): Promise<void> {
    this.items.set(order.id, order);
  }

  async transition(order: Order, expected: OrderStatus): Promise<boolean> {

    if (this.items.get(order.id)?.status !== expected) {
      return false;
    }

    this.items.set(order.id, order);

    return true;
  }
}

export class InMemoryTicketRepository implements TicketRepository {
  readonly items = new Map<string, Ticket>();

  async insertMany(tickets: ReadonlyArray<Ticket>): Promise<void> {
    for (const ticket of tickets) {
      this.items.set(ticket.id, ticket);
    }
  }

  async countByOrder(orderId: string): Promise<number> {
    return [...this.items.values()].filter((ticket) => ticket.toSnapshot().orderId === orderId).length;
  }

  async findByEventAndCode(eventId: string, code: string): Promise<Ticket | null> {
    return [...this.items.values()].find((ticket) => ticket.eventId === eventId && ticket.code === code) ?? null;
  }

  async markCheckedIn(ticket: Ticket): Promise<boolean> {

    const current = this.items.get(ticket.id);

    if (!current || current.checkedInAt) {
      return false;
    }

    this.items.set(ticket.id, TicketAggregate.restore(ticket.toSnapshot()));

    return true;
  }
}

/** Controllable gateway double for application tests. */
export class StubPaymentGateway implements PaymentGateway {
  readonly name = "stub";

  readonly created: CreatePixChargeInput[] = [];

  readonly statuses = new Map<string, ChargeStatus>();

  failOnCreate = false;

  webhookResult: Result<{ readonly chargeId: string }, "INVALID_SIGNATURE" | "IGNORED_EVENT"> = err("INVALID_SIGNATURE");

  constructor(readonly testMode: boolean = true) {}

  async createPixCharge(input: CreatePixChargeInput): Promise<PixCharge> {

    if (this.failOnCreate) {
      throw new PaymentGatewayError("gateway down", 503);
    }

    this.created.push(input);

    const chargeId = `charge-${input.orderId}`;

    this.statuses.set(chargeId, "pending");

    return { chargeId, qrCode: "00020126pix", qrCodeBase64: null, ticketUrl: null };
  }

  async getChargeStatus(chargeId: string): Promise<ChargeStatus> {
    return this.statuses.get(chargeId) ?? "pending";
  }

  async parseWebhook(_request: WebhookRequest): Promise<Result<{ readonly chargeId: string }, "INVALID_SIGNATURE" | "IGNORED_EVENT">> {
    return this.webhookResult;
  }

  pay(chargeId: string): void {
    this.statuses.set(chargeId, "paid");
  }

  acceptWebhookFor(chargeId: string): void {
    this.webhookResult = ok({ chargeId });
  }
}

export class FixedClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }

  set(date: Date): void {
    this.current = date;
  }
}

export interface LogEntry {
  readonly level: string;
  readonly message: string;
  readonly fields: LogFields;
}

export class RecordingLogger implements Logger {
  constructor(readonly entries: LogEntry[] = []) {}

  info(message: string, fields: LogFields = {}): void {
    this.entries.push({ level: "info", message, fields });
  }

  warn(message: string, fields: LogFields = {}): void {
    this.entries.push({ level: "warn", message, fields });
  }

  error(message: string, fields: LogFields = {}): void {
    this.entries.push({ level: "error", message, fields });
  }

  child(_fields: LogFields): Logger {
    return this;
  }

  has(level: string, messagePart: string): boolean {
    return this.entries.some((entry) => entry.level === level && entry.message.includes(messagePart));
  }
}

export function sequence(prefix: string): () => string {

  let counter = 0;

  return () => {

    counter += 1;

    return `${prefix}-${counter}`;
  };
}
