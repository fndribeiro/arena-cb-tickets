import { describe, expect, it } from "vitest";
import { Ticket } from "../../../src/contexts/ticketing/domain/ticket";

const NOW = new Date("2026-11-01T12:00:00Z");

function sequentialFactory(prefix: string): () => string {

  let counter = 0;

  return () => {

    counter += 1;

    return `${prefix}-${counter}`;
  };
}

describe("Ticket", () => {
  it("issues one ticket per purchased seat with unique codes", () => {

    const tickets = Ticket.issueForOrder({
      order: { orderId: "ord-1", eventId: "evt-1", userId: "usr-1", quantity: 3 },
      now: NOW,
      newId: sequentialFactory("tkt"),
      newCode: sequentialFactory("code"),
    });

    expect(tickets.map((ticket) => ticket.code)).toEqual(["code-1", "code-2", "code-3"]);

    expect(tickets.every((ticket) => ticket.checkedInAt === null)).toBe(true);
  });

  it("checks in once and refuses a second check-in", () => {

    const [ticket] = Ticket.issueForOrder({
      order: { orderId: "ord-1", eventId: "evt-1", userId: "usr-1", quantity: 1 },
      now: NOW,
      newId: sequentialFactory("tkt"),
      newCode: sequentialFactory("code"),
    });

    const checkedIn = ticket?.checkIn(NOW);

    expect(checkedIn?.ok && checkedIn.value.checkedInAt).toEqual(NOW);

    expect(checkedIn?.ok && checkedIn.value.checkIn(NOW)).toEqual({ ok: false, error: "ALREADY_CHECKED_IN" });

    expect(ticket?.checkedInAt).toBeNull();
  });
});
