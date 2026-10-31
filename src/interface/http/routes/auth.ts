import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import { signInWithGoogle } from "../../../contexts/identity/application/sign-in-with-google";
import { signSession } from "../../../contexts/identity/infrastructure/session";
import type { AppEnv } from "../app-env";
import { clearSessionCookie, writeSessionCookie } from "../middleware/session";

const MAX_CREDENTIAL_LENGTH = 4096;

const credentialSchema = z.object({ credential: z.string().min(1).max(MAX_CREDENTIAL_LENGTH) });

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/auth/google", handleGoogleSignIn);

authRoutes.post("/auth/logout", handleLogout);

async function handleGoogleSignIn(c: Context<AppEnv>) {

  const body = credentialSchema.safeParse(await c.req.json().catch(() => null));

  if (!body.success) {
    c.get("logger").warn("google sign-in payload invalid");
    return c.json({ ok: false }, 400);
  }

  const { signIn, config } = c.get("container");

  const result = await signInWithGoogle(body.data.credential, signIn);

  if (!result.ok) {
    return c.json({ ok: false, error: result.error }, 401);
  }

  const { user } = result.value;

  const token: string = await signSession({ userId: user.id, email: user.email, name: user.name }, config.sessionSecret);

  writeSessionCookie(c, token);

  return c.json({ ok: true });
}

function handleLogout(c: Context<AppEnv>) {

  clearSessionCookie(c);

  return c.redirect("/");
}
