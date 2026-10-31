import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { GoogleIdTokenVerifier } from "../../../src/contexts/identity/infrastructure/google-token-verifier";
import { signSession, verifySession } from "../../../src/contexts/identity/infrastructure/session";
import { RecordingLogger } from "../../support/in-memory";

const CLIENT_ID = "client-id.apps.googleusercontent.com";

const SECRET = "s".repeat(32);

async function googleFixture() {

  const { privateKey, publicKey } = await generateKeyPair("RS256");

  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };

  const keySet = createLocalJWKSet({ keys: [jwk] });

  const issue = (claims: Record<string, unknown>, options: { audience?: string; issuer?: string; expiresIn?: string } = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(options.issuer ?? "https://accounts.google.com")
      .setAudience(options.audience ?? CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? "1h")
      .sign(privateKey);

  const logger = new RecordingLogger();

  const verifier = new GoogleIdTokenVerifier({ clientId: CLIENT_ID, logger, keySet });

  return { issue, verifier, logger };
}

describe("GoogleIdTokenVerifier", () => {
  it("accepts a valid Google ID token", async () => {

    const { issue, verifier } = await googleFixture();

    const token = await issue({ email: "buyer@gmail.com", email_verified: true, name: "Buyer", picture: "https://p" });

    expect(await verifier.verify(token)).toEqual({ email: "buyer@gmail.com", emailVerified: true, name: "Buyer", picture: "https://p" });
  });

  it.each([
    ["wrong audience", { audience: "other-app" }],
    ["wrong issuer", { issuer: "https://evil.example.com" }],
    ["expired token", { expiresIn: "-1m" }],
  ])("rejects %s and logs the reason", async (_label, options) => {

    const { issue, verifier, logger } = await googleFixture();

    const token = await issue({ email: "buyer@gmail.com", email_verified: true }, options);

    expect(await verifier.verify(token)).toBeNull();

    expect(logger.has("warn", "google id token rejected")).toBe(true);
  });

  it("rejects garbage and tokens signed by another key", async () => {

    const { verifier } = await googleFixture();

    const attacker = await googleFixture();

    const forged = await attacker.issue({ email: "admin@arena.test", email_verified: true });

    expect(await verifier.verify("not-a-jwt")).toBeNull();

    expect(await verifier.verify(forged)).toBeNull();
  });
});

describe("session", () => {
  it("round-trips the session claims", async () => {

    const token = await signSession({ userId: "usr-1", email: "a@b.com", name: "A" }, SECRET);

    expect(await verifySession(token, SECRET)).toEqual({ valid: true, claims: { userId: "usr-1", email: "a@b.com", name: "A" } });
  });

  it("rejects tokens signed with another secret or tampered", async () => {

    const token = await signSession({ userId: "usr-1", email: "a@b.com", name: "A" }, SECRET);

    const tampered = `${token.slice(0, -2)}xx`;

    expect((await verifySession(token, "o".repeat(32))).valid).toBe(false);

    expect((await verifySession(tampered, SECRET)).valid).toBe(false);
  });
});
