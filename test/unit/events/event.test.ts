import { describe, expect, it } from "vitest";
import { type CreateEventInput, Event } from "../../../src/contexts/events/domain/event";
import { Money } from "../../../src/contexts/events/domain/money";

const NOW = new Date("2026-11-01T12:00:00Z");

const VALID_INPUT: CreateEventInput = {
  title: "Sertanejo Sexta",
  description: "Música ao vivo e drinks",
  startsAt: new Date("2026-11-06T23:00:00Z"),
  price: Money.restore(2000),
  capacity: 5,
  bannerKey: null,
};

function createDraft(overrides: Partial<CreateEventInput> = {}): Event {

  const result = Event.create({ ...VALID_INPUT, ...overrides }, { id: "evt-1", slugSuffix: "ab12", now: NOW });

  if (!result.ok) {
    throw new Error(`unexpected error ${result.error}`);
  }

  return result.value;
}

function publishedEvent(): Event {

  const published = createDraft().publish();

  if (!published.ok) {
    throw new Error("publish failed");
  }

  return published.value;
}

describe("Event", () => {
  it("creates a draft with zero seats sold and a slug derived from the title", () => {

    const event = createDraft();

    expect(event.status).toBe("draft");

    expect(event.sold).toBe(0);

    expect(event.slug).toBe("sertanejo-sexta-ab12");
  });

  it.each([
    [{ title: "ab" }, "INVALID_TITLE"],
    [{ title: "x".repeat(121) }, "INVALID_TITLE"],
    [{ description: "x".repeat(2001) }, "INVALID_DESCRIPTION"],
    [{ startsAt: new Date("2026-10-31T12:00:00Z") }, "STARTS_IN_THE_PAST"],
    [{ startsAt: new Date("invalid") }, "STARTS_IN_THE_PAST"],
    [{ capacity: 0 }, "INVALID_CAPACITY"],
    [{ capacity: 2.5 }, "INVALID_CAPACITY"],
    [{ capacity: 100_001 }, "INVALID_CAPACITY"],
    [{ price: Money.restore(0) }, "INVALID_PRICE"],
  ] as const)("rejects invalid input %o", (overrides, error) => {

    const result = Event.create({ ...VALID_INPUT, ...overrides }, { id: "evt-1", slugSuffix: "ab12", now: NOW });

    expect(result).toEqual({ ok: false, error });
  });

  it("publishing returns a new instance and keeps the original immutable", () => {

    const draft = createDraft();

    const published = draft.publish();

    expect(published.ok && published.value.status).toBe("published");

    expect(draft.status).toBe("draft");
  });

  it("cannot publish twice nor publish a closed event", () => {

    const event = publishedEvent();

    expect(event.publish()).toEqual({ ok: false, error: "EVENT_NOT_DRAFT" });

    const closed = event.close();

    expect(closed.ok && closed.value.publish()).toEqual({ ok: false, error: "EVENT_NOT_DRAFT" });
  });

  it("cannot close twice", () => {

    const closed = publishedEvent().close();

    expect(closed.ok && closed.value.close()).toEqual({ ok: false, error: "EVENT_ALREADY_CLOSED" });
  });

  it("is on sale only when published and before the sales cutoff", () => {

    const event = publishedEvent();

    expect(createDraft().isOnSale(NOW)).toBe(false);

    expect(event.isOnSale(NOW)).toBe(true);

    expect(event.isOnSale(new Date("2026-11-07T02:59:00Z"))).toBe(true);

    expect(event.isOnSale(new Date("2026-11-07T03:00:00Z"))).toBe(false);
  });

  it("computes remaining seats and never reports negatives", () => {

    const event = Event.restore({ ...publishedEvent().toSnapshot(), sold: 7 });

    expect(event.remaining).toBe(0);

    expect(event.hasSeatsFor(1)).toBe(false);
  });
});
