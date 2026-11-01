# ADR 0001 — Stack and hosting

- Status: accepted
- Date: 2026-10-31

## Context

Arena CB is a micro-business. It needs a ticketing system that costs close to nothing to keep online. It has to work well on phones without installing an app, and someone who is not a full-time engineer must be able to maintain it. The system must cost at least 50% less than Sympla (10% per ticket, minimum R$2.50).

## Decision

- **Node.js 26 LTS** for local tooling and CI (`.nvmrc`); the app itself runs on the Workers runtime.
- **TypeScript + Hono (server-side JSX)**: one language end to end, no SPA build, small HTML pages for slow 4G.
- **Cloudflare Workers (free plan)**: serverless with no servers to patch. It includes 100k requests/day, automatic HTTPS and a São Paulo edge location. There is a free `*.workers.dev` domain for the PoC.
- **Cloudflare D1 (SQLite) + Drizzle**: a relational database with versioned migrations on the free tier (5 GB, 5M reads/day).
- **R2** for event banners, **Workers Static Assets** for the logo, **Cron Triggers** for reconciliation.
- **Google Identity Services** for authentication. No passwords are stored, and admins are listed in `ADMIN_EMAILS`.
- **Mercado Pago Orders API** for Pix (~0.99% per transaction), behind a `PaymentGateway` port.

## Consequences

- Fixed infrastructure cost is R$0 (later ~R$3.40/month for a `.com.br` domain). The Workers Paid plan (US$5) is only needed beyond the free limits.
- Workers is not Node.js: only libraries that run on Web standards can be used (jose, zod, drizzle and hono all do).
- D1 is a single primary database, which is fine for this scale (thousands of tickets/month).
- Switching payment providers only means writing a new adapter.
