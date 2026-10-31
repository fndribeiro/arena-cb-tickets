# ADR 0002 — Testing Pix with Mercado Pago

- Status: **pending spike** (run `scripts/mp-sandbox-spike.ts` with test credentials and record the result here)
- Date: 2026-10-31

## Context

Mercado Pago's documentation disagrees with itself about Pix in the test environment:

- The Checkout API v2 docs say a Pix order created with predefined test data is approved automatically.
- An older help page says Pix cannot be paid in the test environment.

Webhooks in test mode are also reported as unreliable.

## Decision

1. Payment confirmation uses two paths. Both always re-read `GET /v1/orders/{id}` before marking an order as paid:
   - the signed webhook (`x-signature`);
   - polling from the Pix page plus a Cron reconciliation every 5 minutes.
2. In test mode (`PAYMENT_TEST_MODE=true`) the payer is sent as `first_name: "APRO"`, which is expected to trigger auto-approval.
3. A "Simular pagamento (teste)" button exists **only** when `PAYMENT_TEST_MODE=true`. Config validation guarantees it cannot exist with production credentials.

## Spike result

> _To fill in:_ date, order id, final status, auto-approved yes/no.
