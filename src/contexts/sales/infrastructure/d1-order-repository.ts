import { and, asc, eq } from "drizzle-orm";
import { type Database, fromIso, fromNullableIso, toIso } from "../../../db/client";
import { orders } from "../../../db/schema";
import { Money } from "../../events/domain/money";
import { Order, type OrderStatus, type PixPayment } from "../domain/order";
import type { OrderRepository } from "../domain/order-repository";

type OrderRow = typeof orders.$inferSelect;

const ORDER_COLUMNS = {
  id: orders.id,
  eventId: orders.eventId,
  userId: orders.userId,
  quantity: orders.quantity,
  amountCents: orders.amountCents,
  status: orders.status,
  gateway: orders.gateway,
  chargeId: orders.chargeId,
  pixQrCode: orders.pixQrCode,
  pixQrCodeBase64: orders.pixQrCodeBase64,
  pixTicketUrl: orders.pixTicketUrl,
  expiresAt: orders.expiresAt,
  createdAt: orders.createdAt,
  paidAt: orders.paidAt,
};

export class D1OrderRepository implements OrderRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Order | null> {

    const rows: OrderRow[] = await this.db.select(ORDER_COLUMNS).from(orders).where(eq(orders.id, id)).limit(1);

    return rows[0] ? toOrder(rows[0]) : null;
  }

  async findByChargeId(chargeId: string): Promise<Order | null> {

    const rows: OrderRow[] = await this.db.select(ORDER_COLUMNS).from(orders).where(eq(orders.chargeId, chargeId)).limit(1);

    return rows[0] ? toOrder(rows[0]) : null;
  }

  async listPending(limit: number): Promise<ReadonlyArray<Order>> {

    const rows: OrderRow[] = await this.db.select(ORDER_COLUMNS).from(orders).where(eq(orders.status, "pending")).orderBy(asc(orders.expiresAt)).limit(limit);

    return rows.map(toOrder);
  }

  async insert(order: Order): Promise<void> {

    const snapshot = order.toSnapshot();

    await this.db.insert(orders).values({
      id: snapshot.id,
      eventId: snapshot.eventId,
      userId: snapshot.userId,
      quantity: snapshot.quantity,
      amountCents: snapshot.amount.cents,
      status: snapshot.status,
      expiresAt: toIso(snapshot.expiresAt),
      createdAt: toIso(snapshot.createdAt),
      ...paymentColumns(snapshot.payment),
    });
  }

  async updatePayment(order: Order): Promise<void> {
    await this.db.update(orders).set(paymentColumns(order.payment)).where(eq(orders.id, order.id));
  }

  async transition(order: Order, expected: OrderStatus): Promise<boolean> {

    const paidAt: string | null = order.paidAt ? toIso(order.paidAt) : null;

    const result = await this.db
      .update(orders)
      .set({ status: order.status, paidAt })
      .where(and(eq(orders.id, order.id), eq(orders.status, expected)))
      .run();

    return result.meta.changes === 1;
  }
}

function paymentColumns(payment: PixPayment | null) {
  return {
    gateway: payment?.gateway ?? null,
    chargeId: payment?.chargeId ?? null,
    pixQrCode: payment?.qrCode ?? null,
    pixQrCodeBase64: payment?.qrCodeBase64 ?? null,
    pixTicketUrl: payment?.ticketUrl ?? null,
  };
}

function toPayment(row: OrderRow): PixPayment | null {

  if (!row.chargeId || !row.gateway || !row.pixQrCode) {
    return null;
  }

  return { gateway: row.gateway, chargeId: row.chargeId, qrCode: row.pixQrCode, qrCodeBase64: row.pixQrCodeBase64, ticketUrl: row.pixTicketUrl };
}

function toOrder(row: OrderRow): Order {
  return Order.restore({
    id: row.id,
    eventId: row.eventId,
    userId: row.userId,
    quantity: row.quantity,
    amount: Money.restore(row.amountCents),
    status: row.status,
    payment: toPayment(row),
    expiresAt: fromIso(row.expiresAt),
    createdAt: fromIso(row.createdAt),
    paidAt: fromNullableIso(row.paidAt),
  });
}
