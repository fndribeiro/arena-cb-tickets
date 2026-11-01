import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { User } from "../../src/contexts/identity/domain/user";
import { signSession } from "../../src/contexts/identity/infrastructure/session";
import { createApp } from "../../src/interface/http/app";
import { insertPublishedEvent, insertUser, testDatabase } from "../support/d1-fixtures";

const app = createApp();

const ORIGIN = "http://localhost:8787";

const db = testDatabase();

async function cookieFor(user: User): Promise<string> {

  const token = await signSession({ userId: user.id, email: user.email, name: user.name }, env.SESSION_SECRET);

  return `session=${token}`;
}

interface RequestOptions {
  readonly method?: string;
  readonly fetchSite?: string;
  readonly cookie?: string;
  readonly body?: BodyInit;
  readonly json?: unknown;
  readonly origin?: string | null;
}

function call(path: string, options: RequestOptions = {}): Promise<Response> {

  const headers = new Headers();

  if (options.cookie) {
    headers.set("cookie", options.cookie);
  }

  if (options.origin !== null) {
    headers.set("origin", options.origin ?? ORIGIN);
  }

  if (options.json !== undefined) {
    headers.set("content-type", "application/json");
  }

  if (options.fetchSite) {
    headers.set("sec-fetch-site", options.fetchSite);
  }

  const body: BodyInit | undefined = options.json !== undefined ? JSON.stringify(options.json) : options.body;

  return Promise.resolve(app.request(`${ORIGIN}${path}`, { method: options.method ?? "GET", headers, body }, env));
}

function form(fields: Record<string, string>): FormData {

  const data = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    data.append(key, value);
  }

  return data;
}

function futureLocalDateTime(daysAhead: number): string {

  const saoPauloNow = new Date(Date.now() - 3 * 3_600_000 + daysAhead * 86_400_000);

  return saoPauloNow.toISOString().slice(0, 16);
}

describe("public pages and security", () => {
  it("serves health with security headers", async () => {

    const response = await call("/health");

    expect(response.status).toBe(200);

    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");

    expect(response.headers.get("x-content-type-options")).toBe("nosniff");

    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  });

  it("lists published events on the home page and shows OG tags on the event page", async () => {

    const event = await insertPublishedEvent(db, { title: "Forró na Areia" });

    const home = await (await call("/")).text();

    const page = await (await call(`/e/${event.slug}`)).text();

    expect(home).toContain("Forró na Areia");

    expect(page).toContain('property="og:title"');

    expect(page).toContain("Entre com sua conta Google");
  });

  it("escapes user content (XSS)", async () => {

    const event = await insertPublishedEvent(db, { title: "<script>alert(1)</script>" });

    const page = await (await call(`/e/${event.slug}`)).text();

    expect(page).not.toContain("<script>alert(1)</script>");
  });

  it("blocks state-changing requests from other origins", async () => {

    const response = await call("/auth/logout", { method: "POST", origin: "https://evil.example.com" });

    expect(response.status).toBe(403);
  });

  it("accepts opaque-origin form posts only when the browser marks them same-origin", async () => {

    const sameSite = await call("/auth/logout", { method: "POST", origin: "null", fetchSite: "same-origin" });

    const crossSite = await call("/auth/logout", { method: "POST", origin: "null", fetchSite: "cross-site" });

    const noHeaders = await call("/auth/logout", { method: "POST", origin: null });

    expect(sameSite.status).toBe(302);

    expect(crossSite.status).toBe(403);

    expect(noHeaders.status).toBe(403);
  });

  it("rejects invalid Google credentials", async () => {

    const missing = await call("/auth/google", { method: "POST", json: {} });

    const invalid = await call("/auth/google", { method: "POST", json: { credential: "not-a-jwt" } });

    expect(missing.status).toBe(400);

    expect(invalid.status).toBe(401);
  });

  it("ignores forged session cookies", async () => {

    const response = await call("/my-tickets", { cookie: "session=forged.token.value" });

    expect(response.status).toBe(302);

    expect(response.headers.get("location")).toBe("/login?next=%2Fmy-tickets");
  });
});

describe("admin access control", () => {
  it("redirects anonymous users and forbids regular users", async () => {

    const buyer = await insertUser(db);

    const anonymous = await call("/admin");

    const regular = await call("/admin", { cookie: await cookieFor(buyer) });

    expect(anonymous.status).toBe(302);

    expect(regular.status).toBe(403);
  });
});

describe("end-to-end purchase flow (fake gateway, test mode)", () => {
  it("admin creates and publishes an event, buyer pays via Pix, admin checks the ticket in", async () => {

    const admin = await insertUser(db, "admin@arena.test");

    const buyer = await insertUser(db);

    const intruder = await insertUser(db);

    const adminCookie = await cookieFor(admin);

    const buyerCookie = await cookieFor(buyer);

    const eventForm = form({ title: "Sertanejo Sexta", description: "Ao vivo", startsAt: futureLocalDateTime(5), price: "20,00", capacity: "5" });

    const created = await call("/admin/events", { method: "POST", cookie: adminCookie, body: eventForm });

    const eventPath = created.headers.get("location") ?? "";

    const eventId = eventPath.split("/").pop() ?? "";

    expect(created.status).toBe(302);

    await call(`/admin/events/${eventId}/publish`, { method: "POST", cookie: adminCookie, body: form({}) });

    const adminPage = await (await call(eventPath, { cookie: adminCookie })).text();

    const slug = /\/e\/([a-z0-9-]+)/.exec(adminPage)?.[1] ?? "";

    const tooMany = await call(`/e/${slug}/orders`, { method: "POST", cookie: buyerCookie, body: form({ quantity: "6" }) });

    expect(tooMany.headers.get("location")).toContain("error=SOLD_OUT");

    const placed = await call(`/e/${slug}/orders`, { method: "POST", cookie: buyerCookie, body: form({ quantity: "2" }) });

    const orderPath = placed.headers.get("location") ?? "";

    expect(orderPath).toMatch(/^\/orders\//);

    const orderPage = await (await call(orderPath, { cookie: buyerCookie })).text();

    expect(orderPage).toContain("Pix copia e cola");

    expect(orderPage).toContain("Simular pagamento");

    expect((await call(orderPath, { cookie: await cookieFor(intruder) })).status).toBe(404);

    const status = await (await call(`${orderPath}/status`, { cookie: buyerCookie })).json();

    expect(status).toEqual({ status: "pending" });

    await call(`${orderPath}/simulate-payment`, { method: "POST", cookie: buyerCookie, body: form({}) });

    const paidStatus = await (await call(`${orderPath}/status`, { cookie: buyerCookie })).json();

    expect(paidStatus).toEqual({ status: "paid" });

    const myTickets = await (await call("/my-tickets", { cookie: buyerCookie })).text();

    const codes = [...myTickets.matchAll(/word-break:break-all">([A-Za-z0-9_-]{22})</g)].map((match) => match[1]);

    expect(codes).toHaveLength(2);

    const csv = await (await call(`/admin/events/${eventId}/attendees.csv`, { cookie: adminCookie })).text();

    expect(csv).toContain(buyer.email);

    const firstCheckIn = await call(`/admin/events/${eventId}/checkin`, { method: "POST", cookie: adminCookie, json: { code: codes[0] } });

    const secondCheckIn = await call(`/admin/events/${eventId}/checkin`, { method: "POST", cookie: adminCookie, json: { code: codes[0] } });

    const buyerCheckIn = await call(`/admin/events/${eventId}/checkin`, { method: "POST", cookie: buyerCookie, json: { code: codes[1] } });

    expect(firstCheckIn.status).toBe(200);

    expect(secondCheckIn.status).toBe(409);

    expect(buyerCheckIn.status).toBe(403);
  });

  it("rejects invalid event input with a friendly error", async () => {

    const admin = await insertUser(db, "admin@arena.test");

    const invalid = form({ title: "Show", description: "", startsAt: futureLocalDateTime(5), price: "abc", capacity: "5" });

    const response = await call("/admin/events", { method: "POST", cookie: await cookieFor(admin), body: invalid });

    expect(response.headers.get("location")).toBe("/admin/events/new?error=INVALID_PRICE");
  });
});

describe("webhooks", () => {
  it("accepts notifications without session or Origin and never crashes on garbage", async () => {

    const response = await call("/webhooks/mercadopago", { method: "POST", origin: null, body: "not json" });

    expect(response.status).toBe(200);
  });
});

describe("admin onboarding guide", () => {
  it("guides the admin on first access until it is completed", async () => {

    const admin = await insertUser(db, "admin@arena.test");

    const adminCookie = await cookieFor(admin);

    const firstAccess = await call("/admin", { cookie: adminCookie });

    expect(firstAccess.status).toBe(302);

    expect(firstAccess.headers.get("location")).toBe("/admin/guide");

    const stepOne = await (await call("/admin/guide", { cookie: adminCookie })).text();

    const stepTwo = await (await call("/admin/guide?step=2", { cookie: adminCookie })).text();

    const stepThree = await (await call("/admin/guide?step=3", { cookie: adminCookie })).text();

    expect(stepOne).toContain("Criar um evento");

    expect(stepOne).toContain("+ Novo evento");

    expect(stepTwo).toContain("Compartilhar no Instagram/WhatsApp");

    expect(stepThree).toContain("QR Code Pix");

    expect(stepThree).toContain("/admin/guide/complete");

    const completed = await call("/admin/guide/complete", { method: "POST", cookie: adminCookie, body: form({}) });

    expect(completed.headers.get("location")).toBe("/admin/events/new");

    const secondAccess = await call("/admin", { cookie: adminCookie });

    const dashboard = await secondAccess.text();

    expect(secondAccess.status).toBe(200);

    expect(dashboard).toContain('href="/admin/guide"');
  });

  it.each(["0", "4", "abc", "-1", "1.5"])("falls back to the first step for an invalid step %s", async (step) => {

    const admin = await insertUser(db, "admin@arena.test");

    const page = await (await call(`/admin/guide?step=${step}`, { cookie: await cookieFor(admin) })).text();

    expect(page).toContain("Criar um evento");
  });

  it("is restricted to admins", async () => {

    const buyer = await insertUser(db);

    const guide = await call("/admin/guide", { cookie: await cookieFor(buyer) });

    const complete = await call("/admin/guide/complete", { method: "POST", cookie: await cookieFor(buyer), body: form({}) });

    expect(guide.status).toBe(403);

    expect(complete.status).toBe(403);
  });
});
