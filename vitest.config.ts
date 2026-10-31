import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const TEST_BINDINGS = {
  APP_URL: "http://localhost:8787",
  GOOGLE_CLIENT_ID: "test-client-id.apps.googleusercontent.com",
  SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
  ADMIN_EMAILS: "admin@arena.test",
  PAYMENT_GATEWAY: "fake",
  PAYMENT_TEST_MODE: "true",
  ORDER_TTL_MINUTES: "30",
  MAX_TICKETS_PER_ORDER: "10",
};

async function workersPoolOptions() {

  const migrations = await readD1Migrations("./migrations");

  return {
    wrangler: { configPath: "./wrangler.jsonc" },
    miniflare: { bindings: { ...TEST_BINDINGS, TEST_MIGRATIONS: migrations } },
  };
}

export default defineConfig({
  plugins: [cloudflareTest(workersPoolOptions)],
  test: {
    setupFiles: ["./test/setup.ts"],
  },
});
