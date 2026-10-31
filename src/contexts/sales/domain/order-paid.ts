export interface OrderPaid {
  readonly type: "OrderPaid";
  readonly orderId: string;
  readonly eventId: string;
  readonly userId: string;
  readonly quantity: number;
  readonly occurredAt: Date;
}
