import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { SESSION_TTL_SECONDS, verifySession } from "../../../contexts/identity/infrastructure/session";
import type { AppEnv, Viewer } from "../app-env";

export const SESSION_COOKIE = "session";

/** Resolves the signed-in viewer. The role is recomputed from ADMIN_EMAILS on every request, so revoking an admin is immediate. */
export const loadViewer = createMiddleware<AppEnv>(async (c, next) => {

  c.set("viewer", await resolveViewer(c));

  await next();
});

async function resolveViewer(c: Context<AppEnv>): Promise<Viewer | null> {

  const token: string | undefined = getCookie(c, SESSION_COOKIE);

  if (!token) {
    return null;
  }

  const { config, adminPolicy } = c.get("container");

  const session = await verifySession(token, config.sessionSecret);

  if (!session.valid) {
    c.get("logger").info("session cookie discarded", { reason: session.reason });
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return null;
  }

  return { ...session.claims, role: adminPolicy.roleFor(session.claims.email) };
}

export function writeSessionCookie(c: Context<AppEnv>, token: string): void {
  setCookie(c, SESSION_COOKIE, token, { path: "/", httpOnly: true, secure: true, sameSite: "Lax", maxAge: SESSION_TTL_SECONDS });
}

export function clearSessionCookie(c: Context<AppEnv>): void {
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: true });
}
