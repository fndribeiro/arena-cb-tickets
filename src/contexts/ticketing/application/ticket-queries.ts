export interface UserTicketView {
  readonly code: string;
  readonly eventTitle: string;
  readonly eventSlug: string;
  readonly eventStartsAt: Date;
  readonly checkedInAt: Date | null;
}

export interface AttendeeView {
  readonly ticketCode: string;
  readonly buyerName: string;
  readonly buyerEmail: string;
  readonly orderId: string;
  readonly paidAt: Date | null;
  readonly checkedInAt: Date | null;
}

/** Read models (CQRS-lite): joins across contexts are allowed on the query side only. */
export interface TicketQueries {
  listByUser(userId: string, limit: number): Promise<ReadonlyArray<UserTicketView>>;
  listAttendees(eventId: string, limit: number): Promise<ReadonlyArray<AttendeeView>>;
}
