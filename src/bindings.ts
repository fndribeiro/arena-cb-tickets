/** Cloudflare bindings and raw environment variables (validated in config.ts). */
export interface Bindings {
  readonly DB: D1Database;
  readonly BANNERS: R2Bucket;
  readonly APP_URL: string;
  readonly GOOGLE_CLIENT_ID: string;
  readonly SESSION_SECRET: string;
  readonly ADMIN_EMAILS: string;
  readonly PAYMENT_GATEWAY: string;
  readonly PAYMENT_TEST_MODE: string;
  readonly ORDER_TTL_MINUTES?: string;
  readonly MAX_TICKETS_PER_ORDER?: string;
  readonly MP_ACCESS_TOKEN?: string;
  readonly MP_WEBHOOK_SECRET?: string;
}
