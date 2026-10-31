import { beforeEach, describe, expect, it } from "vitest";
import { createEvent, type ManageEventsDeps, publishEvent } from "../../../src/contexts/events/application/manage-events";
import { Money } from "../../../src/contexts/events/domain/money";
import { type ConfirmPaymentDeps, confirmPayment } from "../../../src/contexts/sales/application/confirm-payment";
import { handlePaymentNotification } from "../../../src/contexts/sales/application/handle-payment-notification";
import { type PlaceOrderDeps, placeOrder } from "../../../src/contexts/sales/application/place-order";
import { processPendingOrders } from "../../../src/contexts/sales/application/process-pending-orders";
import { issueTickets } from "../../../src/contexts/ticketing/application/issue-tickets";
import {
  FixedClock,
  InMemoryEventRepository,
  InMemoryOrderRepository,
  InMemoryTicketRepository,
  RecordingLogger,
  StubPaymentGateway,
  sequence,
} from "../../support/in-memory";

const NOW = new Date("2026-11-01T12:00:00Z");

const WEBHOOK = { headers: new Headers(), query: new URLSearchParams(), body: "{}" };

interface World {
  readonly events: InMemoryEventRepository;
  readonly orders: InMemoryOrderRepository;
  readonly tickets: InMemoryTicketRepository;
  readonly gateway: StubPaymentGateway;
  readonly clock: FixedClock;
  readonly logger: RecordingLogger;
  readonly eventId: string;
  readonly placeDeps: PlaceOrderDeps;
  readonly confirmDeps: ConfirmPaymentDeps;
}

async function buildWorld(capacity: number, testMode = true): Promise<World> {

  const events = new InMemoryEventRepository();

  const orders = new InMemoryOrderRepository();

  const tickets = new InMemoryTicketRepository();

  const gateway = new StubPaymentGateway(testMode);

  const clock = new FixedClock(NOW);

  const logger = new RecordingLogger();

  const manageDeps: ManageEventsDeps = { events, clock, logger, newId: sequence("evt"), newSlugSuffix: () => "ab12" };

  const input = { title: "Sertanejo Sexta", description: "", startsAt: new Date("2026-11-06T23:00:00Z"), price: Money.restore(2000), capacity, bannerKey: null };

  const created = await createEvent(input, manageDeps);

  const eventId = created.ok ? created.value.id : "missing";

  await publishEvent(eventId, manageDeps);

  const issueDeps = { tickets, clock, logger, newId: sequence("tkt"), newCode: sequence("code") };

  const placeDeps: PlaceOrderDeps = { events, orders, gateway, clock, logger, newId: sequence("ord"), ttlMinutes: 30, maxTicketsPerOrder: 10 };

  const confirmDeps: ConfirmPaymentDeps = { orders, gateway, clock, logger, onOrderPaid: (event) => issueTickets(event, issueDeps).then(() => undefined) };

  return { events, orders, tickets, gateway, clock, logger, eventId, placeDeps, confirmDeps };
}

function buy(world: World, quantity: number) {
  return placeOrder({ eventId: world.eventId, userId: "usr-1", payerEmail: "buyer@gmail.com", quantity }, world.placeDeps);
}

async function soldSeats(world: World): Promise<number | undefined> {

  const event = await world.events.findById(world.eventId);

  return event?.sold;
}

describe("placeOrder", () => {
  let world: World;

  beforeEach(async () => {
    world = await buildWorld(5);
  });

  it("reserves seats and creates a Pix charge for the total amount", async () => {

    const result = await buy(world, 2);

    expect(result.ok && result.value.payment?.chargeId).toBe("charge-ord-1");

    expect(world.gateway.created[0]?.amount.cents).toBe(4000);

    expect(await soldSeats(world)).toBe(2);
  });

  it("refuses more tickets than remaining seats", async () => {

    await buy(world, 2);

    expect(await buy(world, 4)).toEqual({ ok: false, error: "SOLD_OUT" });

    expect(await soldSeats(world)).toBe(2);
  });

  it.each([0, 11, 2.5])("refuses invalid quantity %s before touching storage", async (quantity) => {

    expect(await buy(world, quantity)).toEqual({ ok: false, error: "INVALID_QUANTITY" });

    expect(await soldSeats(world)).toBe(0);
  });

  it("refuses unknown and not-on-sale events", async () => {

    const unknown = await placeOrder({ eventId: "nope", userId: "u", payerEmail: "a@b.com", quantity: 1 }, world.placeDeps);

    expect(unknown).toEqual({ ok: false, error: "EVENT_NOT_FOUND" });

    world.clock.set(new Date("2026-11-08T00:00:00Z"));

    expect(await buy(world, 1)).toEqual({ ok: false, error: "EVENT_NOT_ON_SALE" });
  });

  it("releases seats and cancels the order when the gateway fails", async () => {

    world.gateway.failOnCreate = true;

    const result = await buy(world, 3);

    expect(result).toEqual({ ok: false, error: "PAYMENT_UNAVAILABLE" });

    expect(await soldSeats(world)).toBe(0);

    expect([...world.orders.items.values()][0]?.status).toBe("cancelled");

    expect(world.logger.has("error", "order placement failed")).toBe(true);
  });
});

describe("confirmPayment", () => {
  it("does not confirm while the gateway still reports pending", async () => {

    const world = await buildWorld(5);

    const order = await buy(world, 1);

    const orderId = order.ok ? order.value.id : "";

    expect(await confirmPayment({ orderId, simulate: false }, world.confirmDeps)).toEqual({ ok: false, error: "PAYMENT_NOT_CONFIRMED" });
  });

  it("confirms a paid charge, issues one ticket per seat and is idempotent", async () => {

    const world = await buildWorld(5);

    const order = await buy(world, 2);

    const orderId = order.ok ? order.value.id : "";

    world.gateway.pay(`charge-${orderId}`);

    const first = await confirmPayment({ orderId, simulate: false }, world.confirmDeps);

    const second = await confirmPayment({ orderId, simulate: false }, world.confirmDeps);

    expect(first.ok && first.value.status).toBe("paid");

    expect(second.ok && second.value.status).toBe("paid");

    expect(world.tickets.items.size).toBe(2);
  });

  it("simulates payment only in test mode", async () => {

    const testWorld = await buildWorld(5, true);

    const prodWorld = await buildWorld(5, false);

    const testOrder = await buy(testWorld, 1);

    const prodOrder = await buy(prodWorld, 1);

    const simulatedTest = await confirmPayment({ orderId: testOrder.ok ? testOrder.value.id : "", simulate: true }, testWorld.confirmDeps);

    const simulatedProd = await confirmPayment({ orderId: prodOrder.ok ? prodOrder.value.id : "", simulate: true }, prodWorld.confirmDeps);

    expect(simulatedTest.ok).toBe(true);

    expect(simulatedProd).toEqual({ ok: false, error: "TEST_MODE_DISABLED" });

    expect(prodWorld.tickets.items.size).toBe(0);
  });

  it("flags payments received for expired orders for manual refund", async () => {

    const world = await buildWorld(5);

    const order = await buy(world, 1);

    const orderId = order.ok ? order.value.id : "";

    world.clock.set(new Date("2026-11-01T13:00:00Z"));

    await processPendingOrders({ ...world.confirmDeps, events: world.events, batchSize: 50 });

    world.gateway.pay(`charge-${orderId}`);

    expect(await confirmPayment({ orderId, simulate: false }, world.confirmDeps)).toEqual({ ok: false, error: "ORDER_NOT_PAYABLE" });

    expect(world.logger.has("error", "manual refund required")).toBe(true);
  });
});

describe("handlePaymentNotification", () => {
  it("rejects notifications with an invalid signature", async () => {

    const world = await buildWorld(5);

    expect(await handlePaymentNotification(WEBHOOK, world.confirmDeps)).toEqual({ ok: false, error: "INVALID_SIGNATURE" });
  });

  it("ignores notifications for unknown charges", async () => {

    const world = await buildWorld(5);

    world.gateway.acceptWebhookFor("unknown-charge");

    expect(await handlePaymentNotification(WEBHOOK, world.confirmDeps)).toEqual({ ok: false, error: "ORDER_NOT_FOUND" });
  });

  it("confirms the order only after re-reading the status from the gateway", async () => {

    const world = await buildWorld(5);

    const order = await buy(world, 1);

    const chargeId = `charge-${order.ok ? order.value.id : ""}`;

    world.gateway.acceptWebhookFor(chargeId);

    const beforePayment = await handlePaymentNotification(WEBHOOK, world.confirmDeps);

    world.gateway.pay(chargeId);

    const afterPayment = await handlePaymentNotification(WEBHOOK, world.confirmDeps);

    expect(beforePayment).toEqual({ ok: false, error: "PAYMENT_NOT_CONFIRMED" });

    expect(afterPayment.ok && afterPayment.value.status).toBe("paid");
  });
});

describe("processPendingOrders", () => {
  it("confirms paid orders, expires overdue ones and releases their seats", async () => {

    const world = await buildWorld(5);

    const paid = await buy(world, 1);

    await buy(world, 2);

    world.gateway.pay(`charge-${paid.ok ? paid.value.id : ""}`);

    world.clock.set(new Date("2026-11-01T12:31:00Z"));

    const summary = await processPendingOrders({ ...world.confirmDeps, events: world.events, batchSize: 50 });

    expect(summary).toEqual({ checked: 2, confirmed: 1, expired: 1, failed: 0 });

    expect(await soldSeats(world)).toBe(1);
  });

  it("keeps processing other orders when one fails and logs the failure", async () => {

    const world = await buildWorld(5);

    await buy(world, 1);

    await buy(world, 1);

    let calls = 0;

    world.gateway.getChargeStatus = async () => {

      calls += 1;

      if (calls === 1) {
        throw new Error("timeout");
      }

      return "pending";
    };

    const summary = await processPendingOrders({ ...world.confirmDeps, events: world.events, batchSize: 50 });

    expect(summary.failed).toBe(1);

    expect(summary.checked).toBe(2);

    expect(world.logger.has("error", "failed to process pending order")).toBe(true);
  });
});

describe("confirmPayment self-healing", () => {
  it("issues missing tickets when an already paid order is confirmed again", async () => {

    const world = await buildWorld(5);

    const order = await buy(world, 2);

    const orderId = order.ok ? order.value.id : "";

    await confirmPayment({ orderId, simulate: true }, world.confirmDeps);

    world.tickets.items.clear();

    await confirmPayment({ orderId, simulate: false }, world.confirmDeps);

    expect(world.tickets.items.size).toBe(2);
  });
});
