# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## Project

**Arena CB Tickets** — a lightweight, mobile-first event ticketing system for Arena CB, a micro-business (beach/society courts + bar & restaurant) in Capão Bonito/SP, Brazil. It replaces the manual flow (Instagram post + Excel list + Pix QR + checking receipts) with:

- **Admin** (emails listed in `ADMIN_EMAILS`): creates/publishes events, follows sales, exports attendee lists, checks tickets in at the door.
- **User** (any other Google account): opens the event link, signs in with Google, pays via **Pix**, gets a QR-code ticket.

Goal: run for a fraction of Sympla's fee (10%, min R$2.50/ticket) — infra cost must stay near R$0/month.

## Stack

- Node.js 26 LTS for tooling (pinned in `.nvmrc`, used by CI) · TypeScript (strict) · [Hono](https://hono.dev) with server-side JSX (no SPA)
- Cloudflare Workers (free plan) · D1 (SQLite) via Drizzle ORM · R2 for event banners · Cron Triggers
- Auth: Google Identity Services ID token verified with `jose`; session in a signed HttpOnly cookie. **No custom password/user-credential system.**
- Payments: Mercado Pago Orders API (Pix), behind the `PaymentGateway` port; `FakeGateway` for local/tests
- Tests: Vitest + `@cloudflare/vitest-plugin` (runs inside workerd with real D1/miniflare) · Lint/format: Biome
- CI/CD: GitHub Actions → `wrangler deploy` on push to `main`. Single environment: production.

## Commands

```bash
npm run dev                # local server (wrangler dev, uses .dev.vars)
npm test                   # all tests (unit + integration)
npm run test:watch         # TDD loop
npm run typecheck          # tsc --noEmit
npm run lint               # biome check (lint + import order)
npm run format             # biome check --write (safe lint fixes; Biome formatter is disabled, see below)
npm run db:generate        # generate SQL migration from src/db/schema.ts
npm run db:migrate:local   # apply migrations to local D1
npm run db:migrate:remote  # apply migrations to production D1
npm run deploy             # deploy to Cloudflare (CI does this on main)
```

## Architecture (Domain-Driven Design)

```
src/
  index.ts                 # composition root (Hono app + scheduled handler)
  config.ts                # env validation (zod)
  shared/                  # Result, Clock, ids, logger — no business rules
  contexts/<context>/
    domain/                # entities, value objects, domain events, repository interfaces
    application/           # use cases (orchestrate domain + ports)
    infrastructure/        # Drizzle repositories, HTTP clients (Google, Mercado Pago)
  interface/http/          # Hono routes, JSX views, middleware (input adapters)
  db/schema.ts             # Drizzle schema
```

Bounded contexts: `identity`, `events`, `sales`, `payments`, `ticketing`.

Dependency rules:
- `domain/` depends on nothing but `shared/`. No Hono, Drizzle, `fetch`, or env access in domain code.
- `application/` depends on `domain/` and ports (interfaces) only.
- `infrastructure/` and `interface/` implement/consume ports; wiring happens only in the composition root.
- Contexts talk through application use cases or domain events (e.g. `OrderPaid` → `IssueTickets`), never by reaching into another context's tables from domain code.

## Development workflow

- **TDD is mandatory**: write a failing test first, make it pass, then refactor.
  - Domain → plain unit tests. Use cases → in-memory test doubles (`test/support`). Repositories/routes → integration tests against D1 in miniflare.
- Keep changes small; `npm run lint && npm run typecheck && npm test` must pass before committing.
- Conventional Commits (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`).

## Conventions

- **Code, identifiers, tests, commits and docs for developers: English.**
- **User-facing UI text: Brazilian Portuguese (pt-BR).**
- Money is always integer cents (`Money` value object); never floats.
- Dates stored as UTC ISO strings; displayed in `America/Sao_Paulo`.
- Mobile first: every page must work on a ~360px-wide phone screen without installing an app.

## Security

- Dependency install scripts are blocked by npm unless allowed in `package.json` → `allowScripts`. Review any new entry (`npm install-scripts ls`) before approving it with `npm install-scripts approve <pkg>`.
- Never commit secrets. Local secrets live in `.dev.vars` (git-ignored); production uses `wrangler secret put`.
- Payment confirmation is never trusted from a webhook payload alone: always re-read the charge status from the gateway API before marking an order as paid.
- Verify Mercado Pago webhook signatures (`x-signature`) with `MP_WEBHOOK_SECRET`.
- Non-GET requests (except webhooks) must pass the `Origin` check; session cookie is `HttpOnly; Secure; SameSite=Lax`.
- Test-only features (fake gateway, "simulate payment") must be impossible to use when `PAYMENT_TEST_MODE=false`.
- Collect the minimum personal data needed (LGPD).

## 12-Factor (lean)

Config only via environment (`config.ts` validates on boot) · backing services (D1, R2, Mercado Pago) are attached resources · stateless workers · structured JSON logs to stdout · migrations/admin tasks as npm scripts · one codebase, one production deploy.

## Project rules (owner)

<!-- Owner rules. Claude must follow them; they take precedence over the defaults above. -->

### Engineering principles

- Apply TDD. Tests must cover edge cases, logic errors, performance issues and security flaws — not just the happy path.
- Query only the data you need: select explicit columns, filter and paginate in SQL, never load a table to filter in memory.
- Avoid implicit and silent exceptions: no empty `catch`, no swallowed promise rejections, no `catch` that only returns `null`. Expected failures are modeled as `Result`/domain errors; unexpected ones are logged with context and rethrown.
- Consider performance and security in every change.
- Always add descriptive logs that make debugging easy (structured JSON with correlation ids such as `requestId`, `orderId`, `eventId`). Never log secrets, tokens or full personal data.
- Prefer immutable objects: `readonly` properties, `ReadonlyArray`, `as const`; aggregate methods return a new instance instead of mutating.
- Follow DDD, SOLID, Clean Architecture and KISS.
- Apply GoF patterns only when necessary. Avoid overengineering; keep it simple.
- After every change, check whether `README.md` needs to be updated (setup/deploy steps, commands, env vars, routes, architecture diagram, docs links) and update it in the same change.

### Indentation and readability (TypeScript / Hono / JSX)

These rules apply to all TypeScript code, including tests.

- Indentation: 2 spaces, never tabs. The Biome *formatter* is disabled on purpose: it would delete the blank lines required by the "code as a recipe" rule below, so indentation/line width are kept by hand and by review (Biome still lints).
- Line limit: 150 characters. A statement that fits in the limit stays on one line — no artificial breaks. Break long expressions into intermediate variables with descriptive names instead of chaining everything on one line.
- Extract complex or chained expressions (array pipelines like `.filter().map().reduce()`, nested calls, compound conditions, fluent query builders, promise chains) into named variables or functions before using them.
- Avoid inline anonymous functions with logic inside functions: extract them into named private functions/methods. Trivial one-expression callbacks (e.g. `(row) => row.id`) are fine. Hono route handlers delegate to named functions/use cases instead of holding business logic inline.
- Avoid deep nesting (more than 2–3 levels): prefer guard clauses / early return over nested `if`/`else`.
- One statement per line. Do not chain multiple operations on the same line just to save space.
- Code as a recipe: each statement (each step of the algorithm) on its own line, with a blank line between statements. Applies to declarations (`const`/`let`), assignments, calls, logs, `if`, `try`, `for`, `await` and `return`.
  - A function, method or block (`if`, `try`, `for`, `catch`, named callback) with more than one statement: blank line right after the `{` and between each statement. A block with a single statement stays compact.
  - A statement broken across lines (log with fields, query builder, object literal, JSX expression) is still one statement: no blank lines inside it.
  - A comment sticks to the statement it explains; the blank line goes before the comment.
  - Does not apply to JSX markup, CSS, class field/property declarations, type/interface members, enum/const-object members or imports.
  - Example:
    ```typescript
    export async function placeOrder(command: PlaceOrderCommand, deps: PlaceOrderDeps): Promise<Result<Order, PlaceOrderError>> {

      const event: Event | null = await deps.events.findById(command.eventId);

      if (!event?.isOnSale()) {
        return err("EVENT_NOT_ON_SALE");
      }

      const reserved: boolean = await deps.events.reserveSeats(event.id, command.quantity);

      deps.logger.info("seats reserved", { eventId: event.id, quantity: command.quantity, reserved });

      return reserved ? createPendingOrder(event, command, deps) : err("SOLD_OUT");
    }
    ```
- When breaking a long call, break before the `.` and keep the arguments together on the same line; if it still does not fit, extract variables or group parameters (see below).
- Parameters that do not fit on one line: one parameter per line with a single indent (do not align with the opening parenthesis).
- Maximum of 3 parameters per function, method or constructor (including dependency injection). Beyond that, use whichever fits:
  - Parameter Object: values that always travel together become an immutable object — an `interface`/`type` with `readonly`, explicitly typed properties (never `any`).
  - Options object: factories with many fields, especially optional ones, take a typed `...Options` interface instead of a builder.
  - Method Object: execution state passed between private functions (current attempt, start, deadline) becomes a small object.
  - Return the result instead of receiving a list/accumulator to fill.
  - Many injected dependencies signal too many responsibilities: extract collaborators (SRP). Use cases receive a single typed `deps` object.
  - JSX components receive a single typed `props` object; many related values become one typed prop.
- Functions do one thing. Beyond ~30–40 lines or when mixing abstraction levels, extract well-named sub-functions.
- Always use braces for blocks (`if`, `for`, `while`), even single-line ones (enforced by Biome `useBlockStatements`).
- Prefer explicit types on exported functions, use-case results and non-obvious variables. Never use `any`; use `unknown` and narrow.

### Red flags before any edit

Stop and fix (or flag to the owner) if a change introduces or touches:

- O(n²) where O(n) is possible
- A security vulnerability
- No logs
- No tests
- Hardcoded values (use config/env or named constants)
- No exception/error handling
- DRY violations
- Files/classes over 1000 lines (god class)
