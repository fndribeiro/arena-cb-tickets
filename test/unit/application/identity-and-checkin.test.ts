import { describe, expect, it } from "vitest";
import { type GoogleIdentity, type SignInDeps, signInWithGoogle } from "../../../src/contexts/identity/application/sign-in-with-google";
import { AdminPolicy } from "../../../src/contexts/identity/domain/admin-policy";
import { checkIn } from "../../../src/contexts/ticketing/application/check-in";
import { Ticket } from "../../../src/contexts/ticketing/domain/ticket";
import { FixedClock, InMemoryTicketRepository, InMemoryUserRepository, RecordingLogger, sequence } from "../../support/in-memory";

function signInDeps(identity: GoogleIdentity | null): SignInDeps & { users: InMemoryUserRepository } {
  return {
    verifier: { verify: async () => identity },
    users: new InMemoryUserRepository(),
    adminPolicy: AdminPolicy.fromList("admin@arena.test"),
    logger: new RecordingLogger(),
  };
}

describe("signInWithGoogle", () => {
  it("creates the user on first sign-in and resolves the admin role", async () => {

    const deps = signInDeps({ email: "Admin@Arena.test", emailVerified: true, name: "Admin", picture: null });

    const result = await signInWithGoogle("token", deps);

    expect(result.ok && result.value.role).toBe("admin");

    expect(deps.users.items.get("admin@arena.test")?.name).toBe("Admin");
  });

  it("signs in other accounts as regular users and keeps the same id on return", async () => {

    const deps = signInDeps({ email: "buyer@gmail.com", emailVerified: true, name: "Buyer", picture: null });

    const first = await signInWithGoogle("token", deps);

    const second = await signInWithGoogle("token", deps);

    expect(first.ok && first.value.role).toBe("user");

    expect(first.ok && second.ok && first.value.user.id === second.value.user.id).toBe(true);
  });

  it("rejects invalid tokens and unverified emails", async () => {

    expect(await signInWithGoogle("bad", signInDeps(null))).toEqual({ ok: false, error: "INVALID_TOKEN" });

    const unverified = signInDeps({ email: "x@gmail.com", emailVerified: false, name: "X", picture: null });

    expect(await signInWithGoogle("token", unverified)).toEqual({ ok: false, error: "EMAIL_NOT_VERIFIED" });
  });
});

describe("checkIn", () => {
  const NOW = new Date("2026-11-06T23:30:00Z");

  async function setup() {

    const tickets = new InMemoryTicketRepository();

    const issued = Ticket.issueForOrder({
      order: { orderId: "ord-1", eventId: "evt-1", userId: "usr-1", quantity: 1 },
      now: NOW,
      newId: sequence("tkt"),
      newCode: () => "CODE123",
    });

    await tickets.insertMany(issued);

    return { tickets, clock: new FixedClock(NOW), logger: new RecordingLogger() };
  }

  it("checks a valid ticket in once", async () => {

    const deps = await setup();

    const first = await checkIn({ eventId: "evt-1", code: " CODE123 " }, deps);

    const second = await checkIn({ eventId: "evt-1", code: "CODE123" }, deps);

    expect(first.ok).toBe(true);

    expect(second.ok ? null : second.error.reason).toBe("ALREADY_CHECKED_IN");
  });

  it("does not accept a ticket from another event or garbage input", async () => {

    const deps = await setup();

    expect(await checkIn({ eventId: "evt-2", code: "CODE123" }, deps)).toEqual({ ok: false, error: { reason: "TICKET_NOT_FOUND" } });

    expect(await checkIn({ eventId: "evt-1", code: "x".repeat(65) }, deps)).toEqual({ ok: false, error: { reason: "TICKET_NOT_FOUND" } });
  });
});
