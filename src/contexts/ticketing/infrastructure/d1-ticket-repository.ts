import { and, count, eq, isNull } from "drizzle-orm";
import { type Database, fromIso, fromNullableIso, toIso } from "../../../db/client";
import { tickets } from "../../../db/schema";
import { Ticket } from "../domain/ticket";
import type { TicketRepository } from "../domain/ticket-repository";

type TicketRow = typeof tickets.$inferSelect;

const TICKET_COLUMNS = {
  id: tickets.id,
  orderId: tickets.orderId,
  eventId: tickets.eventId,
  userId: tickets.userId,
  code: tickets.code,
  checkedInAt: tickets.checkedInAt,
  createdAt: tickets.createdAt,
};

export class D1TicketRepository implements TicketRepository {
  constructor(private readonly db: Database) {}

  async insertMany(items: ReadonlyArray<Ticket>): Promise<void> {

    if (items.length === 0) {
      return;
    }

    const rows = items.map(toRow);

    await this.db.insert(tickets).values(rows);
  }

  async countByOrder(orderId: string): Promise<number> {

    const rows = await this.db.select({ total: count() }).from(tickets).where(eq(tickets.orderId, orderId));

    return rows[0]?.total ?? 0;
  }

  async findByEventAndCode(eventId: string, code: string): Promise<Ticket | null> {

    const byEventAndCode = and(eq(tickets.eventId, eventId), eq(tickets.code, code));

    const rows: TicketRow[] = await this.db.select(TICKET_COLUMNS).from(tickets).where(byEventAndCode).limit(1);

    return rows[0] ? toTicket(rows[0]) : null;
  }

  async markCheckedIn(ticket: Ticket): Promise<boolean> {

    const checkedInAt: string | null = ticket.checkedInAt ? toIso(ticket.checkedInAt) : null;

    const result = await this.db
      .update(tickets)
      .set({ checkedInAt })
      .where(and(eq(tickets.id, ticket.id), isNull(tickets.checkedInAt)))
      .run();

    return result.meta.changes === 1;
  }
}

function toRow(ticket: Ticket): TicketRow {

  const snapshot = ticket.toSnapshot();

  return {
    id: snapshot.id,
    orderId: snapshot.orderId,
    eventId: snapshot.eventId,
    userId: snapshot.userId,
    code: snapshot.code,
    checkedInAt: snapshot.checkedInAt ? toIso(snapshot.checkedInAt) : null,
    createdAt: toIso(snapshot.createdAt),
  };
}

function toTicket(row: TicketRow): Ticket {
  return Ticket.restore({
    id: row.id,
    orderId: row.orderId,
    eventId: row.eventId,
    userId: row.userId,
    code: row.code,
    checkedInAt: fromNullableIso(row.checkedInAt),
    createdAt: fromIso(row.createdAt),
  });
}
