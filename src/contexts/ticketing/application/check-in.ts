import type { Clock } from "../../../shared/clock";
import type { Logger } from "../../../shared/logger";
import { err, ok, type Result } from "../../../shared/result";
import type { Ticket } from "../domain/ticket";
import type { TicketRepository } from "../domain/ticket-repository";

export interface CheckInCommand {
  readonly eventId: string;
  readonly code: string;
}

export interface CheckInDeps {
  readonly tickets: TicketRepository;
  readonly clock: Clock;
  readonly logger: Logger;
}

export type CheckInFailure = { readonly reason: "TICKET_NOT_FOUND" } | { readonly reason: "ALREADY_CHECKED_IN"; readonly checkedInAt: Date | null };

const MAX_CODE_LENGTH = 64;

export async function checkIn(command: CheckInCommand, deps: CheckInDeps): Promise<Result<Ticket, CheckInFailure>> {

  const code: string = command.code.trim();

  if (code.length === 0 || code.length > MAX_CODE_LENGTH) {
    return err({ reason: "TICKET_NOT_FOUND" });
  }

  const ticket: Ticket | null = await deps.tickets.findByEventAndCode(command.eventId, code);

  if (!ticket) {
    deps.logger.warn("check-in with unknown ticket", { eventId: command.eventId });
    return err({ reason: "TICKET_NOT_FOUND" });
  }

  const checkedIn = ticket.checkIn(deps.clock.now());

  const stored: boolean = checkedIn.ok && (await deps.tickets.markCheckedIn(checkedIn.value));

  if (!checkedIn.ok || !stored) {
    deps.logger.warn("duplicate check-in attempt", { eventId: command.eventId, ticketId: ticket.id });
    return err({ reason: "ALREADY_CHECKED_IN", checkedInAt: ticket.checkedInAt });
  }

  deps.logger.info("ticket checked in", { eventId: command.eventId, ticketId: ticket.id });

  return ok(checkedIn.value);
}
