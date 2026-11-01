/**
 * Mercado Pago sandbox spike: does a test Pix order get approved automatically?
 *
 * Usage (Node 26 LTS, see .nvmrc; test credentials only):
 *   MP_ACCESS_TOKEN=<test seller access token> MP_TEST_PAYER_EMAIL=<test buyer email> node scripts/mp-sandbox-spike.ts
 *
 * Record the outcome in docs/adr/0002-mercadopago-pix-testing.md.
 */

const API_URL = "https://api.mercadopago.com/v1/orders";

const POLL_ATTEMPTS = 10;

const POLL_INTERVAL_MS = 3000;

interface OrderResponse {
  readonly id: string;
  readonly status: string;
  readonly status_detail?: string;
  readonly transactions?: { readonly payments?: ReadonlyArray<{ readonly payment_method?: { readonly qr_code?: string } }> };
}

function requireEnv(name: string): string {

  const value: string | undefined = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }

  return value;
}

async function callApi(url: string, init: RequestInit): Promise<OrderResponse> {

  const response: Response = await fetch(url, init);

  const body: string = await response.text();

  if (!response.ok) {
    throw new Error(`Mercado Pago ${init.method ?? "GET"} ${url} -> ${response.status}: ${body}`);
  }

  return JSON.parse(body) as OrderResponse;
}

async function createTestPixOrder(token: string, payerEmail: string): Promise<OrderResponse> {

  const body = {
    type: "online",
    processing_mode: "automatic",
    external_reference: `spike-${Date.now()}`,
    total_amount: "1.00",
    description: "Arena CB sandbox spike",
    payer: { email: payerEmail, first_name: "APRO" },
    transactions: { payments: [{ amount: "1.00", payment_method: { id: "pix", type: "bank_transfer" }, expiration_time: "PT30M" }] },
  };

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Idempotency-Key": crypto.randomUUID() };

  return callApi(API_URL, { method: "POST", headers, body: JSON.stringify(body) });
}

async function waitForFinalStatus(token: string, orderId: string): Promise<OrderResponse> {

  let latest: OrderResponse = await callApi(`${API_URL}/${orderId}`, { headers: { Authorization: `Bearer ${token}` } });

  for (let attempt = 1; attempt < POLL_ATTEMPTS && latest.status !== "processed"; attempt += 1) {

    console.log(`attempt ${attempt}: status=${latest.status} detail=${latest.status_detail ?? "-"}`);

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    latest = await callApi(`${API_URL}/${orderId}`, { headers: { Authorization: `Bearer ${token}` } });
  }

  return latest;
}

async function main(): Promise<void> {

  const token: string = requireEnv("MP_ACCESS_TOKEN");

  const payerEmail: string = requireEnv("MP_TEST_PAYER_EMAIL");

  const created: OrderResponse = await createTestPixOrder(token, payerEmail);

  const hasQrCode: boolean = Boolean(created.transactions?.payments?.[0]?.payment_method?.qr_code);

  console.log(`created order ${created.id}: status=${created.status} qrCode=${hasQrCode ? "yes" : "no"}`);

  const final: OrderResponse = await waitForFinalStatus(token, created.id);

  const verdict: string = final.status === "processed" ? "AUTO-APPROVED in sandbox ✅" : "NOT auto-approved ❌ (use the test-mode 'simulate payment' fallback)";

  console.log(`final status=${final.status} detail=${final.status_detail ?? "-"} -> ${verdict}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
