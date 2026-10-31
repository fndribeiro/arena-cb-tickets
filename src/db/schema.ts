import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  picture: text("picture"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    startsAt: text("starts_at").notNull(),
    priceCents: integer("price_cents").notNull(),
    capacity: integer("capacity").notNull(),
    sold: integer("sold").notNull().default(0),
    status: text("status", { enum: ["draft", "published", "closed"] }).notNull(),
    bannerKey: text("banner_key"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("events_status_starts_at_idx").on(table.status, table.startsAt),
    check("events_sold_within_capacity", sql`${table.sold} >= 0 AND ${table.sold} <= ${table.capacity}`),
  ],
);

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    quantity: integer("quantity").notNull(),
    amountCents: integer("amount_cents").notNull(),
    status: text("status", { enum: ["pending", "paid", "expired", "cancelled"] }).notNull(),
    gateway: text("gateway"),
    chargeId: text("charge_id"),
    pixQrCode: text("pix_qr_code"),
    pixQrCodeBase64: text("pix_qr_code_base64"),
    pixTicketUrl: text("pix_ticket_url"),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
    paidAt: text("paid_at"),
  },
  (table) => [
    uniqueIndex("orders_charge_id_idx").on(table.chargeId),
    index("orders_status_idx").on(table.status, table.expiresAt),
    index("orders_event_idx").on(table.eventId, table.status),
    index("orders_user_idx").on(table.userId),
  ],
);

export const tickets = sqliteTable(
  "tickets",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    code: text("code").notNull(),
    checkedInAt: text("checked_in_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("tickets_event_code_idx").on(table.eventId, table.code),
    index("tickets_order_idx").on(table.orderId),
    index("tickets_user_idx").on(table.userId),
  ],
);
