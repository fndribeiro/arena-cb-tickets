import { asc, desc, eq } from "drizzle-orm";
import { type Database, fromIso, fromNullableIso } from "../../../db/client";
import { events, orders, tickets, users } from "../../../db/schema";
import type { AttendeeView, TicketQueries, UserTicketView } from "../application/ticket-queries";

export class D1TicketQueries implements TicketQueries {
  constructor(private readonly db: Database) {}

  async listByUser(userId: string, limit: number): Promise<ReadonlyArray<UserTicketView>> {

    const rows = await this.db
      .select({
        code: tickets.code,
        checkedInAt: tickets.checkedInAt,
        eventTitle: events.title,
        eventSlug: events.slug,
        eventStartsAt: events.startsAt,
      })
      .from(tickets)
      .innerJoin(events, eq(events.id, tickets.eventId))
      .where(eq(tickets.userId, userId))
      .orderBy(desc(events.startsAt))
      .limit(limit);

    return rows.map((row) => ({ ...row, eventStartsAt: fromIso(row.eventStartsAt), checkedInAt: fromNullableIso(row.checkedInAt) }));
  }

  async listAttendees(eventId: string, limit: number): Promise<ReadonlyArray<AttendeeView>> {

    const rows = await this.db
      .select({
        ticketCode: tickets.code,
        checkedInAt: tickets.checkedInAt,
        orderId: orders.id,
        paidAt: orders.paidAt,
        buyerName: users.name,
        buyerEmail: users.email,
      })
      .from(tickets)
      .innerJoin(orders, eq(orders.id, tickets.orderId))
      .innerJoin(users, eq(users.id, tickets.userId))
      .where(eq(tickets.eventId, eventId))
      .orderBy(asc(users.name))
      .limit(limit);

    return rows.map((row) => ({ ...row, paidAt: fromNullableIso(row.paidAt), checkedInAt: fromNullableIso(row.checkedInAt) }));
  }
}
