import { createRemoteJWKSet, errors, type JWTPayload, type JWTVerifyGetKey, jwtVerify } from "jose";
import type { Logger } from "../../../shared/logger";
import type { GoogleIdentity, GoogleTokenVerifier } from "../application/sign-in-with-google";

const GOOGLE_JWKS_URL = new URL("https://www.googleapis.com/oauth2/v3/certs");

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/** Reused across requests in the same isolate so Google keys are fetched and cached once. */
const googleKeySet: JWTVerifyGetKey = createRemoteJWKSet(GOOGLE_JWKS_URL);

export interface GoogleVerifierOptions {
  readonly clientId: string;
  readonly logger: Logger;
  readonly keySet?: JWTVerifyGetKey;
}

interface GoogleClaims extends JWTPayload {
  readonly email?: unknown;
  readonly email_verified?: unknown;
  readonly name?: unknown;
  readonly picture?: unknown;
}

/** Verifies Google Identity Services ID tokens (signature, issuer, audience and expiration). */
export class GoogleIdTokenVerifier implements GoogleTokenVerifier {
  private readonly keySet: JWTVerifyGetKey;

  constructor(private readonly options: GoogleVerifierOptions) {
    this.keySet = options.keySet ?? googleKeySet;
  }

  async verify(idToken: string): Promise<GoogleIdentity | null> {

    try {
      const { payload } = await jwtVerify<GoogleClaims>(idToken, this.keySet, { issuer: GOOGLE_ISSUERS, audience: this.options.clientId });

      return toIdentity(payload);
    } catch (error) {
      if (error instanceof errors.JOSEError) {
        this.options.logger.warn("google id token rejected", { code: error.code });
        return null;
      }

      throw error;
    }
  }
}

function toIdentity(payload: GoogleClaims): GoogleIdentity | null {

  if (typeof payload.email !== "string") {
    return null;
  }

  return {
    email: payload.email,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === "string" ? payload.name : "",
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}
