import { and, desc, eq, gt, sql } from "drizzle-orm";
import { type Database, fromIso, toIso } from "../../../db/client";
import { events } from "../../../db/schema";
import { EVENT_RULES, Event } from "../domain/event";
import type { EventRepository } from "../domain/event-repository";
import { Money } from "../domain/money";

const EVENT_COLUMNS = {
  id: events.id,
  slug: events.slug,
  title: events.title,
  description: events.description,
  startsAt: events.startsAt,
  priceCents: events.priceCents,
  capacity: events.capacity,
  sold: events.sold,
  status: events.status,
  bannerKey: events.bannerKey,
  createdAt: events.createdAt,
};

type EventRow = typeof events.$inferSelect;

export class D1EventRepository implements EventRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Event | null> {

    const rows: EventRow[] = await this.db.select(EVENT_COLUMNS).from(events).where(eq(events.id, id)).limit(1);

    return rows[0] ? toEvent(rows[0]) : null;
  }

  async findBySlug(slug: string): Promise<Event | null> {

    const rows: EventRow[] = await this.db.select(EVENT_COLUMNS).from(events).where(eq(events.slug, slug)).limit(1);

    return rows[0] ? toEvent(rows[0]) : null;
  }

  async listPublishedOnSale(now: Date, limit: number): Promise<ReadonlyArray<Event>> {

    const earliestStart: string = toIso(new Date(now.getTime() - EVENT_RULES.salesAfterStartMinutes * 60_000));

    const onSale = and(eq(events.status, "published"), gt(events.startsAt, earliestStart));

    const rows: EventRow[] = await this.db.select(EVENT_COLUMNS).from(events).where(onSale).orderBy(events.startsAt).limit(limit);

    return rows.map(toEvent);
  }

  async listRecent(limit: number): Promise<ReadonlyArray<Event>> {

    const rows: EventRow[] = await this.db.select(EVENT_COLUMNS).from(events).orderBy(desc(events.startsAt)).limit(limit);

    return rows.map(toEvent);
  }

  async insert(event: Event): Promise<void> {

    const snapshot = event.toSnapshot();

    await this.db.insert(events).values({
      id: snapshot.id,
      slug: snapshot.slug,
      title: snapshot.title,
      description: snapshot.description,
      startsAt: toIso(snapshot.startsAt),
      priceCents: snapshot.price.cents,
      capacity: snapshot.capacity,
      sold: snapshot.sold,
      status: snapshot.status,
      bannerKey: snapshot.bannerKey,
      createdAt: toIso(snapshot.createdAt),
    });
  }

  async updateStatus(event: Event): Promise<void> {
    await this.db.update(events).set({ status: event.status }).where(eq(events.id, event.id));
  }

  async reserveSeats(eventId: string, quantity: number): Promise<boolean> {

    const hasRoom = sql`${events.sold} + ${quantity} <= ${events.capacity}`;

    const result = await this.db
      .update(events)
      .set({ sold: sql`${events.sold} + ${quantity}` })
      .where(and(eq(events.id, eventId), eq(events.status, "published"), hasRoom))
      .run();

    return result.meta.changes === 1;
  }

  async releaseSeats(eventId: string, quantity: number): Promise<void> {
    await this.db
      .update(events)
      .set({ sold: sql`MAX(0, ${events.sold} - ${quantity})` })
      .where(eq(events.id, eventId));
  }
}

function toEvent(row: EventRow): Event {
  return Event.restore({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    startsAt: fromIso(row.startsAt),
    price: Money.restore(row.priceCents),
    capacity: row.capacity,
    sold: row.sold,
    status: row.status,
    bannerKey: row.bannerKey,
    createdAt: fromIso(row.createdAt),
  });
}
