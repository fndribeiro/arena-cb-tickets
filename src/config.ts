import { z } from "zod";
import type { Bindings } from "./bindings";

const DEFAULT_ORDER_TTL_MINUTES = 30;

const DEFAULT_MAX_TICKETS_PER_ORDER = 10;

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");

const configSchema = z
  .object({
    APP_URL: z.url(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    SESSION_SECRET: z.string().min(32, "SESSION_SECRET must have at least 32 characters"),
    ADMIN_EMAILS: z.string().min(3),
    PAYMENT_GATEWAY: z.enum(["fake", "mercadopago"]),
    PAYMENT_TEST_MODE: booleanString,
    ORDER_TTL_MINUTES: z.coerce.number().int().min(5).max(120).default(DEFAULT_ORDER_TTL_MINUTES),
    MAX_TICKETS_PER_ORDER: z.coerce.number().int().min(1).max(50).default(DEFAULT_MAX_TICKETS_PER_ORDER),
    MP_ACCESS_TOKEN: z.string().optional(),
    MP_WEBHOOK_SECRET: z.string().optional(),
  })
  .superRefine(validatePaymentSettings);

export interface AppConfig {
  readonly appUrl: string;
  readonly appOrigin: string;
  readonly googleClientId: string;
  readonly sessionSecret: string;
  readonly adminEmails: string;
  readonly payment: PaymentConfig;
  readonly orderTtlMinutes: number;
  readonly maxTicketsPerOrder: number;
}

export interface PaymentConfig {
  readonly gateway: "fake" | "mercadopago";
  readonly testMode: boolean;
  readonly mercadoPagoAccessToken: string | null;
  readonly mercadoPagoWebhookSecret: string | null;
}

export class ConfigError extends Error {
  constructor(readonly issues: ReadonlyArray<string>) {
    super(`Invalid configuration: ${issues.join("; ")}`);
    this.name = "ConfigError";
  }
}

/** Validates the environment on boot (12-factor III). Fails fast with every problem listed. */
export function loadConfig(env: Partial<Bindings>): AppConfig {

  const parsed = configSchema.safeParse(env);

  if (!parsed.success) {
    throw new ConfigError(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`));
  }

  const values = parsed.data;

  return {
    appUrl: values.APP_URL.replace(/\/$/, ""),
    appOrigin: new URL(values.APP_URL).origin,
    googleClientId: values.GOOGLE_CLIENT_ID,
    sessionSecret: values.SESSION_SECRET,
    adminEmails: values.ADMIN_EMAILS,
    payment: {
      gateway: values.PAYMENT_GATEWAY,
      testMode: values.PAYMENT_TEST_MODE,
      mercadoPagoAccessToken: values.MP_ACCESS_TOKEN ?? null,
      mercadoPagoWebhookSecret: values.MP_WEBHOOK_SECRET ?? null,
    },
    orderTtlMinutes: values.ORDER_TTL_MINUTES,
    maxTicketsPerOrder: values.MAX_TICKETS_PER_ORDER,
  };
}

interface PaymentFields {
  readonly PAYMENT_GATEWAY: "fake" | "mercadopago";
  readonly PAYMENT_TEST_MODE: boolean;
  readonly MP_ACCESS_TOKEN?: string | undefined;
  readonly MP_WEBHOOK_SECRET?: string | undefined;
}

function validatePaymentSettings(values: PaymentFields, context: z.RefinementCtx): void {

  if (values.PAYMENT_GATEWAY === "fake" && !values.PAYMENT_TEST_MODE) {
    context.addIssue({ code: "custom", path: ["PAYMENT_GATEWAY"], message: "fake gateway is only allowed with PAYMENT_TEST_MODE=true" });
  }

  if (values.PAYMENT_GATEWAY !== "mercadopago") {
    return;
  }

  if (!values.MP_ACCESS_TOKEN) {
    context.addIssue({ code: "custom", path: ["MP_ACCESS_TOKEN"], message: "required when PAYMENT_GATEWAY=mercadopago" });
  }

  if (!values.MP_WEBHOOK_SECRET) {
    context.addIssue({ code: "custom", path: ["MP_WEBHOOK_SECRET"], message: "required when PAYMENT_GATEWAY=mercadopago" });
  }
}
