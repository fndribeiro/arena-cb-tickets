import { errors, jwtVerify, SignJWT } from "jose";

const SESSION_ALGORITHM = "HS256";

const SESSION_ISSUER = "arena-cb-tickets";

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface SessionClaims {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/** Stateless session: a short signed JWT in an HttpOnly cookie. No credentials are ever stored. */
export async function signSession(claims: SessionClaims, secret: string): Promise<string> {
  return new SignJWT({ email: claims.email, name: claims.name })
    .setProtectedHeader({ alg: SESSION_ALGORITHM })
    .setSubject(claims.userId)
    .setIssuer(SESSION_ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey(secret));
}

export type SessionResult = { readonly valid: true; readonly claims: SessionClaims } | { readonly valid: false; readonly reason: string };

export async function verifySession(token: string, secret: string): Promise<SessionResult> {

  try {
    const { payload } = await jwtVerify(token, secretKey(secret), { issuer: SESSION_ISSUER, algorithms: [SESSION_ALGORITHM] });

    const validClaims: boolean = typeof payload.sub === "string" && typeof payload.email === "string" && typeof payload.name === "string";

    if (!validClaims) {
      return { valid: false, reason: "MALFORMED_CLAIMS" };
    }

    return { valid: true, claims: { userId: String(payload.sub), email: String(payload.email), name: String(payload.name) } };
  } catch (error) {
    if (error instanceof errors.JOSEError) {
      return { valid: false, reason: error.code };
    }

    throw error;
  }
}
