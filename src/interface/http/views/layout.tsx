import type { Child } from "hono/jsx";
import type { Viewer } from "../app-env";
import { assetUrl } from "../assets/version";
import { VENUE, VENUE_MAPS_URL } from "./venue";

export interface LayoutProps {
  readonly title: string;
  readonly viewer: Viewer | null;
  readonly children: Child;
  readonly testMode: boolean;
  readonly meta?: PageMeta;
  readonly scripts?: ReadonlyArray<string>;
  readonly googleClientId?: string;
}

export interface PageMeta {
  readonly description: string;
  readonly url: string;
  /** Event banner, or the company logo as fallback so shared links always show an image. */
  readonly image: string;
}

export function Layout(props: LayoutProps) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#000000" />
        <link rel="icon" href="/logo.jpg" />
        <link rel="apple-touch-icon" href="/logo.jpg" />
        <title>{`${props.title} · ${VENUE.name}`}</title>
        <link rel="stylesheet" href={assetUrl("/assets/app.css")} />
        {props.meta && <OpenGraph title={props.title} meta={props.meta} />}
      </head>
      <body>
        <Header viewer={props.viewer} />
        <main>
          {props.testMode && <div class="alert test">MODO TESTE — nenhum pagamento real é cobrado.</div>}
          {props.children}
        </main>
        <footer>
          <strong>{VENUE.name}</strong>
          <br />
          <a href={VENUE_MAPS_URL} target="_blank" rel="noopener noreferrer">
            {VENUE.address}
          </a>
        </footer>
        {props.googleClientId && <GoogleScripts clientId={props.googleClientId} />}
        {props.scripts?.map((src) => <script src={assetUrl(src)} defer></script>)}
      </body>
    </html>
  );
}

function Header(props: { readonly viewer: Viewer | null }) {
  return (
    <header class="top">
      <a class="brand" href="/">
        <img src="/logo.jpg" alt={VENUE.name} width="40" height="40" />
        <span class="brand-name">{VENUE.name.toUpperCase()}</span>
      </a>
      <nav>
        {props.viewer?.role === "admin" && <a href="/admin">Admin</a>}
        {props.viewer && <a href="/my-tickets">Meus ingressos</a>}
        {props.viewer ? (
          <form method="post" action="/auth/logout">
            <button class="btn small secondary" type="submit">Sair</button>
          </form>
        ) : (
          <a href="/login">Entrar</a>
        )}
      </nav>
    </header>
  );
}

function OpenGraph(props: { readonly title: string; readonly meta: PageMeta }) {
  return (
    <>
      <meta name="description" content={props.meta.description} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={props.title} />
      <meta property="og:description" content={props.meta.description} />
      <meta property="og:url" content={props.meta.url} />
      <meta property="og:image" content={props.meta.image} />
      <meta name="twitter:card" content="summary_large_image" />
    </>
  );
}

function GoogleScripts(props: { readonly clientId: string }) {
  return (
    <>
      <script src={assetUrl("/assets/auth.js")}></script>
      <script src="https://accounts.google.com/gsi/client" async></script>
      <div id="g_id_onload" data-client_id={props.clientId} data-callback="onGoogleCredential" data-auto_prompt="false"></div>
    </>
  );
}

export function GoogleSignInButton() {
  return <div class="g_id_signin" data-type="standard" data-size="large" data-text="continue_with" data-shape="pill" data-locale="pt-BR"></div>;
}

export function ErrorAlert(props: { readonly message: string | null }) {
  return props.message ? <div class="alert err">{props.message}</div> : null;
}
