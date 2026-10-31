import type { Order, OrderStatus } from "./order";

export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  findByChargeId(chargeId: string): Promise<Order | null>;
  listPending(limit: number): Promise<ReadonlyArray<Order>>;
  insert(order: Order): Promise<void>;
  updatePayment(order: Order): Promise<void>;
  /** Compare-and-set status transition; returns false if another process changed the order first. */
  transition(order: Order, expected: OrderStatus): Promise<boolean>;
}
