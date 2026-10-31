import type { Context } from "hono";
import { Hono } from "hono";
import type { Event } from "../../../contexts/events/domain/event";
import { formatDateTime } from "../../../shared/time";
import type { AppEnv } from "../app-env";
import { AUTH_JS, CHECKIN_JS, ORDER_STATUS_JS, SHARE_JS } from "../assets/scripts";
import { APP_CSS } from "../assets/styles";
import { ErrorAlert, GoogleSignInButton, Layout } from "../views/layout";
import { messageFor } from "../views/messages";

const HOME_EVENTS_LIMIT = 20;

const BANNER_KEY_PATTERN = /^[a-f0-9-]{36}\.(jpg|png|webp)$/;

/** Asset URLs carry a content fingerprint (?v=), so they can be cached for a year. */
const ASSET_CACHE_SECONDS = 31_536_000;

const BANNER_CACHE_SECONDS = 86_400;

const SCRIPTS: Readonly<Record<string, string>> = {
  "auth.js": AUTH_JS,
  "order-status.js": ORDER_STATUS_JS,
  "share.js": SHARE_JS,
  "checkin.js": CHECKIN_JS,
};

export const publicRoutes = new Hono<AppEnv>();

publicRoutes.get("/health", (c) => c.json({ status: "ok" }));

publicRoutes.get("/assets/app.css", (c) => c.body(APP_CSS, 200, assetHeaders("text/css")));

publicRoutes.get("/assets/:file", serveScript);

publicRoutes.get("/banners/:key", serveBanner);

publicRoutes.get("/", renderHome);

publicRoutes.get("/login", renderLogin);

publicRoutes.get("/e/:slug", renderEventPage);

function assetHeaders(contentType: string): Record<string, string> {
  return { "Content-Type": `${contentType}; charset=utf-8`, "Cache-Control": `public, max-age=${ASSET_CACHE_SECONDS}` };
}

function serveScript(c: Context<AppEnv>) {

  const script: string | undefined = SCRIPTS[c.req.param("file") ?? ""];

  return script ? c.body(script, 200, assetHeaders("text/javascript")) : c.notFound();
}

async function serveBanner(c: Context<AppEnv>) {

  const key: string = c.req.param("key") ?? "";

  if (!BANNER_KEY_PATTERN.test(key)) {
    return c.notFound();
  }

  const object: R2ObjectBody | null = await c.get("container").banners.get(key);

  if (!object) {
    return c.notFound();
  }

  const contentType: string = object.httpMetadata?.contentType ?? "application/octet-stream";

  return c.body(object.body, 200, { "Content-Type": contentType, "Cache-Control": `public, max-age=${BANNER_CACHE_SECONDS}, immutable` });
}

async function renderHome(c: Context<AppEnv>) {

  const { events, clock, config } = c.get("container");

  const onSale: ReadonlyArray<Event> = await events.listPublishedOnSale(clock.now(), HOME_EVENTS_LIMIT);

  return c.html(
    <Layout title="Próximos eventos" viewer={c.get("viewer")} testMode={config.payment.testMode}>
      <div class="hero">
        <img src="/logo.jpg" alt="Arena CB" width="120" height="120" />
      </div>
      <h1 class="gradient-text">Próximos eventos</h1>
      {onSale.length === 0 && <p class="muted">Nenhum evento à venda no momento. Fique de olho no nosso Instagram!</p>}
      {onSale.map((event) => (
        <EventCard event={event} />
      ))}
    </Layout>,
  );
}

function EventCard(props: { readonly event: Event }) {

  const { event } = props;

  return (
    <a class="card" href={`/e/${event.slug}`} style="display:block;text-decoration:none;color:inherit">
      {event.bannerKey && <img class="banner" src={`/banners/${event.bannerKey}`} alt="" loading="lazy" />}
      <strong>{event.title}</strong>
      <div class="muted">{formatDateTime(event.startsAt)}</div>
      <div class="row">
        <span class="price">{event.price.format()}</span>
        <span class="muted" style="text-align:right">{event.remaining > 0 ? `${event.remaining} disponíveis` : "Esgotado"}</span>
      </div>
    </a>
  );
}

function renderLogin(c: Context<AppEnv>) {

  const { config } = c.get("container");

  return c.html(
    <Layout title="Entrar" viewer={c.get("viewer")} testMode={config.payment.testMode} googleClientId={config.googleClientId}>
      <h1>Entrar</h1>
      <div class="card">
        <p>Use sua conta Google para comprar e ver seus ingressos. Não pedimos senha.</p>
        <GoogleSignInButton />
      </div>
    </Layout>,
  );
}

async function renderEventPage(c: Context<AppEnv>) {

  const { events, clock, config } = c.get("container");

  const event: Event | null = await events.findBySlug(c.req.param("slug") ?? "");

  const viewer = c.get("viewer");

  const visible: boolean = event !== null && (event.status !== "draft" || viewer?.role === "admin");

  if (!event || !visible) {
    return c.notFound();
  }

  const eventUrl = `${config.appUrl}/e/${event.slug}`;

  const meta = { description: `${formatDateTime(event.startsAt)} · ${event.price.format()}`, url: eventUrl, image: event.bannerKey ? `${config.appUrl}/banners/${event.bannerKey}` : `${config.appUrl}/logo.jpg` };

  const maxQuantity: number = Math.min(config.maxTicketsPerOrder, event.remaining);

  const onSale: boolean = event.isOnSale(clock.now()) && maxQuantity > 0;

  return c.html(
    <Layout
      title={event.title}
      viewer={viewer}
      testMode={config.payment.testMode}
      meta={meta}
      scripts={["/assets/share.js"]}
      googleClientId={viewer ? undefined : config.googleClientId}
    >
      <ErrorAlert message={messageFor(c.req.query("error"))} />
      <article class="card">
        {event.bannerKey && <img class="banner" src={`/banners/${event.bannerKey}`} alt="" />}
        <h1>{event.title}</h1>
        <p class="muted">{formatDateTime(event.startsAt)}</p>
        {event.description && <p style="white-space:pre-line">{event.description}</p>}
        <div class="row">
          <span class="price">{event.price.format()}</span>
          <span class="muted" style="text-align:right">{event.remaining > 0 ? `${event.remaining} disponíveis` : "Esgotado"}</span>
        </div>
      </article>
      {onSale ? <BuyBox slug={event.slug} maxQuantity={maxQuantity} signedIn={viewer !== null} /> : <div class="alert err">Vendas encerradas.</div>}
      <button id="share-event" class="btn secondary" type="button" data-title={event.title} data-url={eventUrl}>
        Compartilhar evento
      </button>
    </Layout>,
  );
}

interface BuyBoxProps {
  readonly slug: string;
  readonly maxQuantity: number;
  readonly signedIn: boolean;
}

function BuyBox(props: BuyBoxProps) {

  if (!props.signedIn) {
    return (
      <div class="card">
        <p>Entre com sua conta Google para comprar.</p>
        <GoogleSignInButton />
      </div>
    );
  }

  const options: ReadonlyArray<number> = Array.from({ length: props.maxQuantity }, (_, index) => index + 1);

  return (
    <form class="card" method="post" action={`/e/${props.slug}/orders`}>
      <label for="quantity">Quantidade</label>
      <select id="quantity" name="quantity">
        {options.map((value) => (
          <option value={String(value)}>{value}</option>
        ))}
      </select>
      <p></p>
      <button class="btn" type="submit">Pagar com Pix</button>
    </form>
  );
}
