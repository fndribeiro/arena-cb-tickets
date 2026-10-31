import type { Ticket } from "./ticket";

export interface TicketRepository {
  insertMany(tickets: ReadonlyArray<Ticket>): Promise<void>;
  countByOrder(orderId: string): Promise<number>;
  findByEventAndCode(eventId: string, code: string): Promise<Ticket | null>;
  /** Compare-and-set: only succeeds if the ticket was not checked in yet (two doors, one ticket). */
  markCheckedIn(ticket: Ticket): Promise<boolean>;
}
