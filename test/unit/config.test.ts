import { describe, expect, it } from "vitest";
import type { Bindings } from "../../src/bindings";
import { ConfigError, loadConfig } from "../../src/config";

const VALID_ENV: Partial<Bindings> = {
  APP_URL: "https://arena.example.com/",
  GOOGLE_CLIENT_ID: "client-id",
  SESSION_SECRET: "x".repeat(32),
  ADMIN_EMAILS: "admin@arena.test",
  PAYMENT_GATEWAY: "mercadopago",
  PAYMENT_TEST_MODE: "false",
  MP_ACCESS_TOKEN: "APP_USR-123",
  MP_WEBHOOK_SECRET: "secret",
};

function configErrorFor(env: Partial<Bindings>): ConfigError {

  try {
    loadConfig(env);
  } catch (error) {
    if (error instanceof ConfigError) {
      return error;
    }

    throw error;
  }

  throw new Error("expected ConfigError");
}

describe("loadConfig", () => {
  it("parses a valid environment and applies defaults", () => {

    const config = loadConfig(VALID_ENV);

    expect(config.appUrl).toBe("https://arena.example.com");

    expect(config.appOrigin).toBe("https://arena.example.com");

    expect(config.payment.testMode).toBe(false);

    expect(config.orderTtlMinutes).toBe(30);

    expect(config.maxTicketsPerOrder).toBe(10);
  });

  it("lists every invalid variable at once", () => {

    const error = configErrorFor({ ...VALID_ENV, APP_URL: "not-a-url", SESSION_SECRET: "short" });

    expect(error.issues.some((issue) => issue.startsWith("APP_URL"))).toBe(true);

    expect(error.issues.some((issue) => issue.startsWith("SESSION_SECRET"))).toBe(true);
  });

  it("requires Mercado Pago credentials when that gateway is selected", () => {

    const error = configErrorFor({ ...VALID_ENV, MP_ACCESS_TOKEN: undefined, MP_WEBHOOK_SECRET: undefined });

    expect(error.issues).toEqual(expect.arrayContaining([expect.stringMatching(/^MP_ACCESS_TOKEN/), expect.stringMatching(/^MP_WEBHOOK_SECRET/)]));
  });

  it("never allows the fake gateway outside test mode", () => {

    const error = configErrorFor({ ...VALID_ENV, PAYMENT_GATEWAY: "fake", PAYMENT_TEST_MODE: "false" });

    expect(error.issues.join()).toMatch(/fake gateway/);
  });

  it.each(["yes", "1", ""])("rejects ambiguous PAYMENT_TEST_MODE=%s", (value) => {

    expect(() => loadConfig({ ...VALID_ENV, PAYMENT_TEST_MODE: value })).toThrow(ConfigError);
  });
});
