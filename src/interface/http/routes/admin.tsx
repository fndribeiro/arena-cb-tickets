import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import { closeEvent, createEvent, publishEvent } from "../../../contexts/events/application/manage-events";
import type { Event } from "../../../contexts/events/domain/event";
import { Money } from "../../../contexts/events/domain/money";
import { shouldShowAdminGuide } from "../../../contexts/identity/application/admin-guide";
import { checkIn } from "../../../contexts/ticketing/application/check-in";
import type { AttendeeView } from "../../../contexts/ticketing/application/ticket-queries";
import { newId } from "../../../shared/ids";
import { formatDateTime, parseLocalDateTime } from "../../../shared/time";
import type { AppEnv } from "../app-env";
import { csvRow } from "../csv";
import { requireAdmin } from "../middleware/guards";
import { ErrorAlert, Layout } from "../views/layout";
import { messageFor } from "../views/messages";
import { handleCompleteAdminGuide, renderAdminGuide } from "./admin-guide";

const ADMIN_EVENTS_LIMIT = 50;

const ATTENDEES_LIMIT = 5000;

const MAX_BANNER_BYTES = 2 * 1024 * 1024;

const BANNER_EXTENSIONS: Readonly<Record<string, string>> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const checkInSchema = z.object({ code: z.string().min(1).max(64) });

export const adminRoutes = new Hono<AppEnv>();

adminRoutes.use("/admin", requireAdmin);

adminRoutes.use("/admin/*", requireAdmin);

adminRoutes.get("/admin", renderDashboard);

adminRoutes.get("/admin/guide", renderAdminGuide);

adminRoutes.post("/admin/guide/complete", handleCompleteAdminGuide);

adminRoutes.get("/admin/events/new", renderNewEventForm);

adminRoutes.post("/admin/events", handleCreateEvent);

adminRoutes.get("/admin/events/:id", renderEventDetail);

adminRoutes.post("/admin/events/:id/publish", handlePublish);

adminRoutes.post("/admin/events/:id/close", handleClose);

adminRoutes.get("/admin/events/:id/attendees.csv", handleAttendeesCsv);

adminRoutes.get("/admin/events/:id/checkin", renderCheckIn);

adminRoutes.post("/admin/events/:id/checkin", handleCheckIn);

const STATUS_LABELS: Readonly<Record<Event["status"], string>> = { draft: "Rascunho", published: "À venda", closed: "Encerrado" };

async function renderDashboard(c: Context<AppEnv>) {

  const { events, config, adminGuide } = c.get("container");

  const viewer = c.get("viewer");

  const firstAccess: boolean = viewer !== null && (await shouldShowAdminGuide(viewer, adminGuide));

  if (firstAccess) {
    return c.redirect("/admin/guide");
  }

  const recent: ReadonlyArray<Event> = await events.listRecent(ADMIN_EVENTS_LIMIT);

  return c.html(
    <Layout title="Admin" viewer={c.get("viewer")} testMode={config.payment.testMode}>
      <h1>Eventos</h1>
      <a class="btn" href="/admin/events/new">+ Novo evento</a>
      <p class="muted" style="text-align:center">
        <a href="/admin/guide">Ver guia de uso</a>
      </p>
      <h2>Recentes</h2>
      {recent.length === 0 && <p class="muted">Nenhum evento criado ainda.</p>}
      {recent.map((event) => (
        <a class="card" href={`/admin/events/${event.id}`} style="display:block;text-decoration:none;color:inherit">
          <strong>{event.title}</strong> <span class="badge">{STATUS_LABELS[event.status]}</span>
          <div class="muted">
            {formatDateTime(event.startsAt)} · {event.sold}/{event.capacity} vendidos
          </div>
        </a>
      ))}
    </Layout>,
  );
}

function renderNewEventForm(c: Context<AppEnv>) {

  const { config } = c.get("container");

  return c.html(
    <Layout title="Novo evento" viewer={c.get("viewer")} testMode={config.payment.testMode}>
      <h1>Novo evento</h1>
      <ErrorAlert message={messageFor(c.req.query("error"))} />
      <form class="card" method="post" action="/admin/events" enctype="multipart/form-data">
        <label for="title">Título</label>
        <input id="title" name="title" required minlength={3} maxlength={120} placeholder="Sertanejo Sexta" />
        <label for="description">Descrição</label>
        <textarea id="description" name="description" maxlength={2000} placeholder="Atrações, horário, regras..."></textarea>
        <label for="startsAt">Data e hora (horário de Brasília)</label>
        <input id="startsAt" name="startsAt" type="datetime-local" required />
        <div class="row">
          <div>
            <label for="price">Preço (R$)</label>
            <input id="price" name="price" inputmode="decimal" required placeholder="20,00" />
          </div>
          <div>
            <label for="capacity">Capacidade</label>
            <input id="capacity" name="capacity" type="number" min={1} required placeholder="300" />
          </div>
        </div>
        <label for="banner">Banner (JPG/PNG/WebP até 2 MB, opcional)</label>
        <input id="banner" name="banner" type="file" accept="image/jpeg,image/png,image/webp" />
        <p></p>
        <button class="btn" type="submit">Criar rascunho</button>
      </form>
    </Layout>,
  );
}

type BannerUpload = { readonly key: string | null } | { readonly error: "INVALID_BANNER" };

async function uploadBanner(c: Context<AppEnv>, file: unknown): Promise<BannerUpload> {

  if (!(file instanceof File) || file.size === 0) {
    return { key: null };
  }

  const extension: string | undefined = BANNER_EXTENSIONS[file.type];

  if (!extension || file.size > MAX_BANNER_BYTES) {
    c.get("logger").warn("banner rejected", { type: file.type, bytes: file.size });
    return { error: "INVALID_BANNER" };
  }

  const key = `${newId()}.${extension}`;

  await c.get("container").banners.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });

  return { key };
}

async function handleCreateEvent(c: Context<AppEnv>) {

  const form = await c.req.parseBody();

  const price = Money.parseBrl(String(form.price ?? ""));

  const startsAt: Date | null = parseLocalDateTime(String(form.startsAt ?? ""));

  if (!price.ok) {
    return c.redirect("/admin/events/new?error=INVALID_PRICE");
  }

  if (!startsAt) {
    return c.redirect("/admin/events/new?error=STARTS_IN_THE_PAST");
  }

  const banner: BannerUpload = await uploadBanner(c, form.banner);

  if ("error" in banner) {
    return c.redirect(`/admin/events/new?error=${banner.error}`);
  }

  const input = { title: String(form.title ?? ""), description: String(form.description ?? ""), startsAt, price: price.value, capacity: Number(form.capacity), bannerKey: banner.key };

  const created = await createEvent(input, c.get("container").manageEvents);

  if (!created.ok) {
    return c.redirect(`/admin/events/new?error=${created.error}`);
  }

  return c.redirect(`/admin/events/${created.value.id}`);
}

async function findEvent(c: Context<AppEnv>): Promise<Event | null> {
  return c.get("container").events.findById(c.req.param("id") ?? "");
}

async function renderEventDetail(c: Context<AppEnv>) {

  const { ticketQueries, config } = c.get("container");

  const event: Event | null = await findEvent(c);

  if (!event) {
    return c.notFound();
  }

  const attendees: ReadonlyArray<AttendeeView> = await ticketQueries.listAttendees(event.id, ATTENDEES_LIMIT);

  const checkedIn: number = attendees.filter((attendee) => attendee.checkedInAt !== null).length;

  const publicUrl = `${config.appUrl}/e/${event.slug}`;

  return c.html(
    <Layout title={event.title} viewer={c.get("viewer")} testMode={config.payment.testMode} scripts={["/assets/share.js"]}>
      <ErrorAlert message={messageFor(c.req.query("error"))} />
      <h1>{event.title}</h1>
      <p class="muted">
        {formatDateTime(event.startsAt)} · {event.price.format()} · <span class="badge">{STATUS_LABELS[event.status]}</span>
      </p>
      <div class="stats">
        <div class="card"><strong>{event.sold}</strong><span class="muted">reservados</span></div>
        <div class="card"><strong>{attendees.length}</strong><span class="muted">pagos</span></div>
        <div class="card"><strong>{checkedIn}</strong><span class="muted">entraram</span></div>
      </div>
      <EventActions event={event} publicUrl={publicUrl} />
      <h2>Lista de ingressos pagos</h2>
      <a class="btn secondary" href={`/admin/events/${event.id}/attendees.csv`}>Baixar CSV (Excel)</a>
      <AttendeesTable attendees={attendees} />
    </Layout>,
  );
}

function EventActions(props: { readonly event: Event; readonly publicUrl: string }) {

  const { event } = props;

  return (
    <div class="card">
      <p class="muted" style="word-break:break-all">Link público: <a href={props.publicUrl}>{props.publicUrl}</a></p>
      {event.status === "draft" && (
        <form method="post" action={`/admin/events/${event.id}/publish`}>
          <button class="btn" type="submit">Publicar (abrir vendas)</button>
        </form>
      )}
      {event.status !== "draft" && (
        <button id="share-event" class="btn secondary" type="button" data-title={event.title} data-url={props.publicUrl}>
          Compartilhar no Instagram/WhatsApp
        </button>
      )}
      <p></p>
      <a class="btn secondary" href={`/admin/events/${event.id}/checkin`}>Check-in na portaria</a>
      <p></p>
      {event.status === "published" && (
        <form method="post" action={`/admin/events/${event.id}/close`}>
          <button class="btn secondary" type="submit">Encerrar vendas</button>
        </form>
      )}
    </div>
  );
}

function AttendeesTable(props: { readonly attendees: ReadonlyArray<AttendeeView> }) {

  if (props.attendees.length === 0) {
    return <p class="muted">Nenhum ingresso pago ainda.</p>;
  }

  return (
    <table>
      <thead>
        <tr><th>Nome</th><th>Entrada</th></tr>
      </thead>
      <tbody>
        {props.attendees.map((attendee) => (
          <tr>
            <td>{attendee.buyerName}<div class="muted">{attendee.buyerEmail}</div></td>
            <td>{attendee.checkedInAt ? formatDateTime(attendee.checkedInAt) : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function handlePublish(c: Context<AppEnv>) {

  const result = await publishEvent(c.req.param("id") ?? "", c.get("container").manageEvents);

  const suffix: string = result.ok ? "" : `?error=${result.error}`;

  return c.redirect(`/admin/events/${c.req.param("id")}${suffix}`);
}

async function handleClose(c: Context<AppEnv>) {

  const result = await closeEvent(c.req.param("id") ?? "", c.get("container").manageEvents);

  const suffix: string = result.ok ? "" : `?error=${result.error}`;

  return c.redirect(`/admin/events/${c.req.param("id")}${suffix}`);
}

async function handleAttendeesCsv(c: Context<AppEnv>) {

  const event: Event | null = await findEvent(c);

  if (!event) {
    return c.notFound();
  }

  const attendees: ReadonlyArray<AttendeeView> = await c.get("container").ticketQueries.listAttendees(event.id, ATTENDEES_LIMIT);

  const header: string = csvRow(["nome", "email", "pedido", "pago_em", "ingresso", "entrou_em"]);

  const lines: ReadonlyArray<string> = attendees.map(toCsvLine);

  c.get("logger").info("attendees exported", { eventId: event.id, rows: attendees.length });

  // BOM so Excel opens accented names correctly.
  const csv = `﻿${[header, ...lines].join("\r\n")}`;

  return c.body(csv, 200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${event.slug}.csv"` });
}

function toCsvLine(attendee: AttendeeView): string {
  return csvRow([
    attendee.buyerName,
    attendee.buyerEmail,
    attendee.orderId,
    attendee.paidAt?.toISOString() ?? "",
    attendee.ticketCode,
    attendee.checkedInAt?.toISOString() ?? "",
  ]);
}

async function renderCheckIn(c: Context<AppEnv>) {

  const event: Event | null = await findEvent(c);

  if (!event) {
    return c.notFound();
  }

  return c.html(
    <Layout title="Check-in" viewer={c.get("viewer")} testMode={c.get("container").config.payment.testMode} scripts={["/assets/checkin.js"]}>
      <h1>Check-in · {event.title}</h1>
      <div id="checkin-result" class="alert test">Escaneie o QR Code do ingresso.</div>
      <video id="scanner" playsinline muted hidden></video>
      <button id="start-scanner" class="btn" type="button">Abrir câmera</button>
      <form id="checkin-form" class="card" method="post" action={`/admin/events/${event.id}/checkin`}>
        <label for="code">Ou digite o código</label>
        <input id="code" name="code" autocomplete="off" />
        <p></p>
        <button class="btn secondary" type="submit">Validar</button>
      </form>
    </Layout>,
  );
}

async function handleCheckIn(c: Context<AppEnv>) {

  const body = checkInSchema.safeParse(await c.req.json().catch(() => null));

  if (!body.success) {
    return c.json({ ok: false, message: messageFor("TICKET_NOT_FOUND") }, 400);
  }

  const result = await checkIn({ eventId: c.req.param("id") ?? "", code: body.data.code }, c.get("container").checkIn);

  if (result.ok) {
    return c.json({ ok: true, message: "Entrada liberada ✅" });
  }

  const usedAt: string = result.error.reason === "ALREADY_CHECKED_IN" && result.error.checkedInAt ? ` em ${formatDateTime(result.error.checkedInAt)}` : "";

  return c.json({ ok: false, message: `${messageFor(result.error.reason)}${usedAt}` }, 409);
}
