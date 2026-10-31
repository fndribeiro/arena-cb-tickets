import { err, ok, type Result } from "../../../shared/result";

export type CheckInError = "ALREADY_CHECKED_IN";

export interface PaidOrderRef {
  readonly orderId: string;
  readonly eventId: string;
  readonly userId: string;
  readonly quantity: number;
}

export interface IssueTicketsInput {
  readonly order: PaidOrderRef;
  readonly now: Date;
  readonly newId: () => string;
  readonly newCode: () => string;
}

export interface TicketSnapshot {
  readonly id: string;
  readonly orderId: string;
  readonly eventId: string;
  readonly userId: string;
  readonly code: string;
  readonly checkedInAt: Date | null;
  readonly createdAt: Date;
}

/** Ticket aggregate: one per seat, identified at the door by an unguessable code. */
export class Ticket {
  private constructor(private readonly props: TicketSnapshot) {}

  static issueForOrder(input: IssueTicketsInput): ReadonlyArray<Ticket> {

    const seats: ReadonlyArray<number> = Array.from({ length: input.order.quantity }, (_, index) => index);

    return seats.map(() => Ticket.issueOne(input));
  }

  static restore(snapshot: TicketSnapshot): Ticket {
    return new Ticket(snapshot);
  }

  private static issueOne(input: IssueTicketsInput): Ticket {
    return new Ticket({
      id: input.newId(),
      orderId: input.order.orderId,
      eventId: input.order.eventId,
      userId: input.order.userId,
      code: input.newCode(),
      checkedInAt: null,
      createdAt: input.now,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get code(): string {
    return this.props.code;
  }

  get eventId(): string {
    return this.props.eventId;
  }

  get checkedInAt(): Date | null {
    return this.props.checkedInAt;
  }

  checkIn(now: Date): Result<Ticket, CheckInError> {

    if (this.props.checkedInAt) {
      return err("ALREADY_CHECKED_IN");
    }

    return ok(new Ticket({ ...this.props, checkedInAt: now }));
  }

  toSnapshot(): TicketSnapshot {
    return this.props;
  }
}
