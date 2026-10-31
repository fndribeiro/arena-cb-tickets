import type { Clock } from "../../../shared/clock";
import type { Logger } from "../../../shared/logger";
import type { OrderPaid } from "../../sales/domain/order-paid";
import { Ticket } from "../domain/ticket";
import type { TicketRepository } from "../domain/ticket-repository";

export interface IssueTicketsDeps {
  readonly tickets: TicketRepository;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly newId: () => string;
  readonly newCode: () => string;
}

/** Reacts to OrderPaid. Idempotent: only issues the tickets still missing for the order. */
export async function issueTickets(event: OrderPaid, deps: IssueTicketsDeps): Promise<ReadonlyArray<Ticket>> {

  const existing: number = await deps.tickets.countByOrder(event.orderId);

  const missing: number = event.quantity - existing;

  if (missing <= 0) {
    return [];
  }

  const order = { orderId: event.orderId, eventId: event.eventId, userId: event.userId, quantity: missing };

  const tickets: ReadonlyArray<Ticket> = Ticket.issueForOrder({ order, now: deps.clock.now(), newId: deps.newId, newCode: deps.newCode });

  await deps.tickets.insertMany(tickets);

  deps.logger.info("tickets issued", { orderId: event.orderId, eventId: event.eventId, issued: tickets.length, alreadyExisting: existing });

  return tickets;
}
