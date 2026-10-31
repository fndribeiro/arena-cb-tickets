import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../app-env";

const SAFE_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defense in depth (on top of SameSite=Lax): state-changing requests must come from our own origin.
 * Some privacy modes send `Origin: null` on same-origin form posts; then the browser-controlled
 * Sec-Fetch-Site header (not settable by scripts) must say "same-origin".
 */
export const requireSameOrigin = createMiddleware<AppEnv>(async (c, next) => {

  if (SAFE_METHODS.has(c.req.method)) {
    return next();
  }

  const origin: string | undefined = c.req.header("origin");

  const fetchSite: string | undefined = c.req.header("sec-fetch-site");

  const allowed: boolean = isSameOrigin({ origin, fetchSite, expected: c.get("container").config.appOrigin });

  if (!allowed) {
    c.get("logger").warn("cross-origin request blocked", { origin: origin ?? null, fetchSite: fetchSite ?? null });
    return c.text("Origem não permitida", 403);
  }

  return next();
});

interface OriginCheck {
  readonly origin: string | undefined;
  readonly fetchSite: string | undefined;
  readonly expected: string;
}

function isSameOrigin(check: OriginCheck): boolean {

  if (check.origin === check.expected) {
    return true;
  }

  const opaqueOrigin: boolean = check.origin === undefined || check.origin === "null";

  return opaqueOrigin && check.fetchSite === "same-origin";
}

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {

  if (!c.get("viewer")) {
    return c.redirect(`/login?next=${encodeURIComponent(c.req.path)}`);
  }

  return next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {

  const viewer = c.get("viewer");

  if (!viewer) {
    return c.redirect(`/login?next=${encodeURIComponent(c.req.path)}`);
  }

  if (viewer.role !== "admin") {
    c.get("logger").warn("admin route denied", { userId: viewer.userId });
    return c.text("Acesso restrito", 403);
  }

  return next();
});
