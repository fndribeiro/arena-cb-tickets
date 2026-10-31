-- Local demo data: `npx wrangler d1 execute DB --local --file scripts/seed-local.sql`
INSERT OR IGNORE INTO events (id, slug, title, description, starts_at, price_cents, capacity, sold, status, banner_key, created_at)
VALUES ('00000000-0000-4000-8000-000000000001', 'sertanejo-sexta-demo', 'Sertanejo Sexta', 'Música ao vivo, drinks e porções. Abertura às 20h.', strftime('%Y-%m-%dT23:00:00.000Z', 'now', '+5 days'), 2000, 300, 0, 'published', NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
