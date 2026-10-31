import { describe, expect, it } from "vitest";
import { Money } from "../../src/contexts/events/domain/money";
import { D1EventRepository } from "../../src/contexts/events/infrastructure/d1-event-repository";
import { D1UserRepository } from "../../src/contexts/identity/infrastructure/d1-user-repository";
import { Order } from "../../src/contexts/sales/domain/order";
import { D1OrderRepository } from "../../src/contexts/sales/infrastructure/d1-order-repository";
import { Ticket } from "../../src/contexts/ticketing/domain/ticket";
import { D1TicketQueries } from "../../src/contexts/ticketing/infrastructure/d1-ticket-queries";
import { D1TicketRepository } from "../../src/contexts/ticketing/infrastructure/d1-ticket-repository";
import { newId, randomToken } from "../../src/shared/ids";
import { insertPublishedEvent, insertUser, testDatabase } from "../support/d1-fixtures";

const db = testDatabase();

const eventRepository = new D1EventRepository(db);

const orderRepository = new D1OrderRepository(db);

const ticketRepository = new D1TicketRepository(db);

function placeOrder(eventId: string, userId: string, quantity = 2): Order {
  return Order.place({ id: newId(), eventId, userId, quantity, unitPrice: Money.restore(2000), now: new Date(), ttlMinutes: 30 });
}

describe("D1EventRepository", () => {
  it("round-trips an event and finds it by slug", async () => {

    const event = await insertPublishedEvent(db);

    const found = await eventRepository.findBySlug(event.slug);

    expect(found?.toSnapshot()).toEqual(event.toSnapshot());
  });

  it("never oversells under concurrent reservations", async () => {

    const event = await insertPublishedEvent(db, { capacity: 5 });

    const attempts = Array.from({ length: 12 }, () => eventRepository.reserveSeats(event.id, 1));

    const results: boolean[] = await Promise.all(attempts);

    const reloaded = await eventRepository.findById(event.id);

    expect(results.filter(Boolean)).toHaveLength(5);

    expect(reloaded?.sold).toBe(5);
  });

  it("does not reserve seats of a closed event and never releases below zero", async () => {

    const event = await insertPublishedEvent(db);

    const closed = event.close();

    if (closed.ok) {
      await eventRepository.updateStatus(closed.value);
    }

    expect(await eventRepository.reserveSeats(event.id, 1)).toBe(false);

    await eventRepository.releaseSeats(event.id, 3);

    expect((await eventRepository.findById(event.id))?.sold).toBe(0);
  });

  it("lists only published events still on sale", async () => {

    const soon = await insertPublishedEvent(db, { title: "Evento Amanha", startsAt: new Date(Date.now() + 86_400_000) });

    const later = await insertPublishedEvent(db, { title: "Evento Mes Que Vem", startsAt: new Date(Date.now() + 30 * 86_400_000) });

    const threeDaysFromNow = new Date(Date.now() + 3 * 86_400_000);

    const listed = await eventRepository.listPublishedOnSale(threeDaysFromNow, 50);

    const ids = listed.map((event) => event.id);

    expect(ids).not.toContain(soon.id);

    expect(ids).toContain(later.id);
  });
});

describe("D1OrderRepository", () => {
  it("persists payment details and finds orders by charge id", async () => {

    const event = await insertPublishedEvent(db);

    const user = await insertUser(db);

    const order = placeOrder(event.id, user.id);

    await orderRepository.insert(order);

    const chargeId = `charge-${newId()}`;

    const attached = order.attachPayment({ gateway: "fake", chargeId, qrCode: "000201", qrCodeBase64: "aGk=", ticketUrl: null });

    if (attached.ok) {
      await orderRepository.updatePayment(attached.value);
    }

    const found = await orderRepository.findByChargeId(chargeId);

    expect(found?.payment).toEqual({ gateway: "fake", chargeId, qrCode: "000201", qrCodeBase64: "aGk=", ticketUrl: null });

    expect(found?.amount.cents).toBe(4000);
  });

  it("applies status transitions with compare-and-set semantics", async () => {

    const event = await insertPublishedEvent(db);

    const user = await insertUser(db);

    const order = placeOrder(event.id, user.id);

    await orderRepository.insert(order);

    const paid = order.markPaid(new Date());

    const paidOrder = paid.ok ? paid.value.order : order;

    expect(await orderRepository.transition(paidOrder, "pending")).toBe(true);

    expect(await orderRepository.transition(paidOrder, "pending")).toBe(false);

    expect((await orderRepository.findById(order.id))?.paidAt).toEqual(paidOrder.paidAt);
  });
});

describe("D1TicketRepository and queries", () => {
  it("counts, finds and checks tickets in exactly once", async () => {

    const event = await insertPublishedEvent(db);

    const user = await insertUser(db);

    const order = placeOrder(event.id, user.id);

    await orderRepository.insert(order);

    const issued = Ticket.issueForOrder({
      order: { orderId: order.id, eventId: event.id, userId: user.id, quantity: 2 },
      now: new Date(),
      newId,
      newCode: randomToken,
    });

    await ticketRepository.insertMany(issued);

    const first = issued[0];

    const found = first ? await ticketRepository.findByEventAndCode(event.id, first.code) : null;

    const checkedIn = found?.checkIn(new Date());

    const firstAttempt = checkedIn?.ok ? await ticketRepository.markCheckedIn(checkedIn.value) : false;

    const secondAttempt = checkedIn?.ok ? await ticketRepository.markCheckedIn(checkedIn.value) : true;

    expect(await ticketRepository.countByOrder(order.id)).toBe(2);

    expect(firstAttempt).toBe(true);

    expect(secondAttempt).toBe(false);
  });

  it("lists attendees and user tickets through read models", async () => {

    const event = await insertPublishedEvent(db, { title: "Pagode de Domingo" });

    const user = await insertUser(db);

    const order = placeOrder(event.id, user.id, 1);

    await orderRepository.insert(order);

    const issued = Ticket.issueForOrder({ order: { orderId: order.id, eventId: event.id, userId: user.id, quantity: 1 }, now: new Date(), newId, newCode: randomToken });

    await ticketRepository.insertMany(issued);

    const queries = new D1TicketQueries(db);

    const attendees = await queries.listAttendees(event.id, 100);

    const userTickets = await queries.listByUser(user.id, 100);

    expect(attendees).toHaveLength(1);

    expect(attendees[0]?.buyerEmail).toBe(user.email);

    expect(userTickets[0]?.eventTitle).toBe("Pagode de Domingo");
  });
});

describe("D1UserRepository", () => {
  it("upserts by email keeping the same id", async () => {

    const repository = new D1UserRepository(db);

    const email = `${newId()}@gmail.com`;

    const first = await repository.upsertByEmail({ email, name: "Nome Antigo", picture: null });

    const second = await repository.upsertByEmail({ email, name: "Nome Novo", picture: "https://example.com/p.png" });

    expect(second.id).toBe(first.id);

    expect(second.name).toBe("Nome Novo");
  });
});
