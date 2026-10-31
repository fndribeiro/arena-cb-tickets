import type { Context } from "hono";
import { Hono } from "hono";
import { raw } from "hono/html";
import type { Event } from "../../../contexts/events/domain/event";
import { confirmPayment } from "../../../contexts/sales/application/confirm-payment";
import { placeOrder } from "../../../contexts/sales/application/place-order";
import type { Order } from "../../../contexts/sales/domain/order";
import type { UserTicketView } from "../../../contexts/ticketing/application/ticket-queries";
import { formatDateTime } from "../../../shared/time";
import type { AppEnv, Viewer } from "../app-env";
import { requireUser } from "../middleware/guards";
import { qrSvg } from "../qr";
import { ErrorAlert, Layout } from "../views/layout";
import { messageFor } from "../views/messages";

const STATUS_POLL_INTERVAL_MS = 5000;

const MY_TICKETS_LIMIT = 100;

export const orderRoutes = new Hono<AppEnv>();

orderRoutes.use("/orders/*", requireUser);

orderRoutes.use("/my-tickets", requireUser);

orderRoutes.post("/e/:slug/orders", requireUser, handlePlaceOrder);

orderRoutes.get("/orders/:id", renderOrderPage);

orderRoutes.get("/orders/:id/status", handleOrderStatus);

orderRoutes.post("/orders/:id/simulate-payment", handleSimulatePayment);

orderRoutes.get("/my-tickets", renderMyTickets);

function currentViewer(c: Context<AppEnv>): Viewer {

  const viewer = c.get("viewer");

  if (!viewer) {
    throw new Error("requireUser middleware must run before this handler");
  }

  return viewer;
}

async function handlePlaceOrder(c: Context<AppEnv>) {

  const { events, placeOrder: deps } = c.get("container");

  const slug: string = c.req.param("slug") ?? "";

  const event: Event | null = await events.findBySlug(slug);

  if (!event) {
    return c.notFound();
  }

  const form = await c.req.parseBody();

  const viewer: Viewer = currentViewer(c);

  const quantity = Number(form.quantity);

  const result = await placeOrder({ eventId: event.id, userId: viewer.userId, payerEmail: viewer.email, quantity }, deps);

  if (!result.ok) {
    return c.redirect(`/e/${encodeURIComponent(slug)}?error=${result.error}`);
  }

  return c.redirect(`/orders/${result.value.id}`);
}

/** Orders are visible to their buyer and to admins only. */
async function findOwnOrder(c: Context<AppEnv>): Promise<Order | null> {

  const { orders } = c.get("container");

  const order: Order | null = await orders.findById(c.req.param("id") ?? "");

  const viewer: Viewer = currentViewer(c);

  const allowed: boolean = order !== null && (order.userId === viewer.userId || viewer.role === "admin");

  if (order && !allowed) {
    c.get("logger").warn("order access denied", { orderId: order.id, userId: viewer.userId });
  }

  return allowed ? order : null;
}

async function renderOrderPage(c: Context<AppEnv>) {

  const container = c.get("container");

  const found: Order | null = await findOwnOrder(c);

  if (!found) {
    return c.notFound();
  }

  const refreshed = await confirmPayment({ orderId: found.id, simulate: false }, container.confirmPayment);

  const order: Order = refreshed.ok ? refreshed.value : found;

  const event: Event | null = await container.events.findById(order.eventId);

  return c.html(
    <Layout title="Seu pedido" viewer={c.get("viewer")} testMode={container.config.payment.testMode} scripts={["/assets/order-status.js"]}>
      <ErrorAlert message={messageFor(c.req.query("error"))} />
      <h1>{event?.title ?? "Pedido"}</h1>
      <p class="muted">
        {order.quantity} ingresso(s) · {order.amount.format()}
      </p>
      <OrderBody order={order} testMode={container.gateway.testMode} />
    </Layout>,
  );
}

function OrderBody(props: { readonly order: Order; readonly testMode: boolean }) {

  const { order } = props;

  if (order.status === "paid") {
    return (
      <div class="card">
        <p class="alert ok">Pagamento confirmado!</p>
        <a class="btn" href="/my-tickets">Ver meus ingressos</a>
      </div>
    );
  }

  if (order.status !== "pending" || !order.payment) {
    return <div class="alert err">Este pedido expirou ou foi cancelado. Faça uma nova compra.</div>;
  }

  const qrImage = order.payment.qrCodeBase64 ? (
    <img src={`data:image/png;base64,${order.payment.qrCodeBase64}`} alt="QR Code Pix" />
  ) : (
    raw(qrSvg(order.payment.qrCode))
  );

  return (
    <div class="card" id="order-status" data-status-url={`/orders/${order.id}/status`} data-interval-ms={String(STATUS_POLL_INTERVAL_MS)}>
      <p>
        <span class="badge warn">Aguardando pagamento</span>
      </p>
      <p>Abra o app do seu banco, escolha Pix e escaneie o QR Code ou use o "copia e cola".</p>
      <div class="qr">{qrImage}</div>
      <label for="pix-code">Pix copia e cola</label>
      <div class="copy">
        <input id="pix-code" readonly value={order.payment.qrCode} />
        <button id="copy-pix" class="btn small" type="button">Copiar</button>
      </div>
      <p class="muted">Pague até {formatDateTime(order.expiresAt)}. Esta página atualiza sozinha quando o pagamento for confirmado.</p>
      {props.testMode && (
        <form method="post" action={`/orders/${order.id}/simulate-payment`}>
          <button class="btn secondary" type="submit">Simular pagamento (teste)</button>
        </form>
      )}
    </div>
  );
}

async function handleOrderStatus(c: Context<AppEnv>) {

  const order: Order | null = await findOwnOrder(c);

  if (!order) {
    return c.json({ error: "NOT_FOUND" }, 404);
  }

  if (!order.isPending()) {
    return c.json({ status: order.status });
  }

  const confirmation = await confirmPayment({ orderId: order.id, simulate: false }, c.get("container").confirmPayment);

  return c.json({ status: confirmation.ok ? confirmation.value.status : order.status });
}

async function handleSimulatePayment(c: Context<AppEnv>) {

  const order: Order | null = await findOwnOrder(c);

  if (!order) {
    return c.notFound();
  }

  const result = await confirmPayment({ orderId: order.id, simulate: true }, c.get("container").confirmPayment);

  const suffix: string = result.ok ? "" : `?error=${result.error}`;

  return c.redirect(`/orders/${order.id}${suffix}`);
}

async function renderMyTickets(c: Context<AppEnv>) {

  const { ticketQueries, config } = c.get("container");

  const tickets: ReadonlyArray<UserTicketView> = await ticketQueries.listByUser(currentViewer(c).userId, MY_TICKETS_LIMIT);

  return c.html(
    <Layout title="Meus ingressos" viewer={c.get("viewer")} testMode={config.payment.testMode}>
      <h1>Meus ingressos</h1>
      {tickets.length === 0 && <p class="muted">Você ainda não tem ingressos.</p>}
      {tickets.map((ticket) => (
        <TicketCard ticket={ticket} />
      ))}
    </Layout>,
  );
}

function TicketCard(props: { readonly ticket: UserTicketView }) {

  const { ticket } = props;

  return (
    <div class="card">
      <strong>{ticket.eventTitle}</strong>
      <div class="muted">{formatDateTime(ticket.eventStartsAt)}</div>
      <p>{ticket.checkedInAt ? <span class="badge">Utilizado</span> : <span class="badge ok">Válido</span>}</p>
      <div class="qr">{raw(qrSvg(ticket.code))}</div>
      <p class="muted" style="text-align:center;word-break:break-all">{ticket.code}</p>
    </div>
  );
}
