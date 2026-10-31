import type { Event } from "./event";

export interface EventRepository {
  findById(id: string): Promise<Event | null>;
  findBySlug(slug: string): Promise<Event | null>;
  listPublishedOnSale(now: Date, limit: number): Promise<ReadonlyArray<Event>>;
  listRecent(limit: number): Promise<ReadonlyArray<Event>>;
  insert(event: Event): Promise<void>;
  /** Persists status changes (publish/close). Seat counters are only changed through reserve/release. */
  updateStatus(event: Event): Promise<void>;
  /** Atomically reserves seats; returns false when sold out or not published (no overselling). */
  reserveSeats(eventId: string, quantity: number): Promise<boolean>;
  releaseSeats(eventId: string, quantity: number): Promise<void>;
}
