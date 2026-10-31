import { describe, expect, it } from "vitest";
import { Money } from "../../../src/contexts/events/domain/money";
import { Order, type PixPayment } from "../../../src/contexts/sales/domain/order";
import { Quantity } from "../../../src/contexts/sales/domain/quantity";

const NOW = new Date("2026-11-01T12:00:00Z");

const PAYMENT: PixPayment = { gateway: "fake", chargeId: "charge-1", qrCode: "000201...", qrCodeBase64: null, ticketUrl: null };

function pendingOrder(): Order {
  return Order.place({ id: "ord-1", eventId: "evt-1", userId: "usr-1", quantity: 2, unitPrice: Money.restore(2000), now: NOW, ttlMinutes: 30 });
}

describe("Quantity", () => {
  it.each([1, 10])("accepts %s within the limit", (value) => {

    expect(Quantity.of(value, 10).ok).toBe(true);
  });

  it.each([0, -1, 11, 1.5, Number.NaN])("rejects %s", (value) => {

    expect(Quantity.of(value, 10)).toEqual({ ok: false, error: "INVALID_QUANTITY" });
  });
});

describe("Order", () => {
  it("is placed as pending with total amount and expiration", () => {

    const order = pendingOrder();

    expect(order.status).toBe("pending");

    expect(order.amount.cents).toBe(4000);

    expect(order.expiresAt.toISOString()).toBe("2026-11-01T12:30:00.000Z");
  });

  it("attaches the Pix payment only while pending", () => {

    const attached = pendingOrder().attachPayment(PAYMENT);

    expect(attached.ok && attached.value.payment?.chargeId).toBe("charge-1");

    const expired = pendingOrder().expire(new Date("2026-11-01T13:00:00Z"));

    expect(expired.ok && expired.value.attachPayment(PAYMENT)).toEqual({ ok: false, error: "ORDER_NOT_PENDING" });
  });

  it("marks paid once and emits OrderPaid", () => {

    const paidAt = new Date("2026-11-01T12:10:00Z");

    const result = pendingOrder().markPaid(paidAt);

    expect(result.ok && result.value.order.status).toBe("paid");

    expect(result.ok && result.value.event).toEqual({
      type: "OrderPaid",
      orderId: "ord-1",
      eventId: "evt-1",
      userId: "usr-1",
      quantity: 2,
      occurredAt: paidAt,
    });
  });

  it("marking an already paid order is idempotent and emits nothing", () => {

    const first = pendingOrder().markPaid(NOW);

    const second = first.ok ? first.value.order.markPaid(NOW) : null;

    expect(second?.ok && second.value.event).toBeNull();
  });

  it("accepts a payment confirmed after expiresAt while the order is still pending (seats are still reserved)", () => {

    const result = pendingOrder().markPaid(new Date("2026-11-01T12:45:00Z"));

    expect(result.ok).toBe(true);
  });

  it.each(["expired", "cancelled"] as const)("refuses payment for a %s order", (status) => {

    const order = Order.restore({ ...pendingOrder().toSnapshot(), status });

    expect(order.markPaid(NOW)).toEqual({ ok: false, error: "ORDER_NOT_PAYABLE" });
  });

  it("expires only when pending and past expiresAt", () => {

    const order = pendingOrder();

    expect(order.expire(new Date("2026-11-01T12:29:59Z"))).toEqual({ ok: false, error: "ORDER_NOT_DUE" });

    expect(order.expire(new Date("2026-11-01T12:30:00Z")).ok).toBe(true);

    const paid = order.markPaid(NOW);

    expect(paid.ok && paid.value.order.expire(new Date("2026-11-02T00:00:00Z"))).toEqual({ ok: false, error: "ORDER_NOT_PENDING" });
  });

  it("cancels only pending orders", () => {

    const cancelled = pendingOrder().cancel();

    expect(cancelled.ok && cancelled.value.status).toBe("cancelled");

    expect(cancelled.ok && cancelled.value.cancel()).toEqual({ ok: false, error: "ORDER_NOT_PENDING" });
  });

  it("transitions never mutate the original instance", () => {

    const order = pendingOrder();

    order.markPaid(NOW);

    expect(order.status).toBe("pending");
  });
});
