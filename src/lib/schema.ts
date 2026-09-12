import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reference: text("reference").notNull().unique(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull(),
    paymentMethod: text("payment_method").notNull(),
    offerCode: text("offer_code").notNull(),
    // Resolved server-side from offerCode. Never taken from the client.
    amount: integer("amount").notNull(),
    // Storage key, never exposed to any client.
    proofKey: text("proof_key").notNull(),
    status: text("status").notNull().default("pending"),
    locale: text("locale").notNull(),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    referrer: text("referrer"),
    landingPage: text("landing_page"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("orders_created_at_idx").on(table.createdAt),
    index("orders_status_idx").on(table.status),
  ],
);

/**
 * Sliding-window counter. Vercel runs multiple isolated instances, so an
 * in-memory limiter would see a fraction of the traffic and silently fail to
 * limit anything.
 */
export const rateLimit = pgTable(
  "rate_limit",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bucket: text("bucket").notNull(),
    hitAt: timestamp("hit_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("rate_limit_bucket_idx").on(table.bucket, table.hitAt)],
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
