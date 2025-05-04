import { pgTable, serial, text, timestamp, integer, boolean, decimal, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const roleEnum = pgEnum('role', ['user', 'admin']);
export const sportTypeEnum = pgEnum('sport_type', ['football', 'basketball', 'baseball', 'hockey', 'soccer', 'other']);
export const marketStatusEnum = pgEnum('market_status', ['open', 'closed', 'settled', 'cancelled']);
export const orderTypeEnum = pgEnum('order_type', ['market', 'limit']);
export const orderStatusEnum = pgEnum('order_status', ['open', 'filled', 'partially_filled', 'cancelled']);
export const orderSideEnum = pgEnum('order_side', ['buy', 'sell']);

// Users table
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  role: roleEnum('role').default('user').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Wallets table
export const wallets = pgTable('wallets', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  balance: decimal('balance', { precision: 12, scale: 2 }).default('1000').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Sports table
export const sports = pgTable('sports', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: sportTypeEnum('type').default('other').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Events table
export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  sportId: integer('sport_id').notNull().references(() => sports.id),
  name: text('name').notNull(),
  description: text('description'),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Markets table
export const markets = pgTable('markets', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').notNull().references(() => events.id),
  name: text('name').notNull(),
  description: text('description'),
  status: marketStatusEnum('status').default('open').notNull(),
  settledOption: text('settled_option'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Market Options table
export const marketOptions = pgTable('market_options', {
  id: serial('id').primaryKey(),
  marketId: integer('market_id').notNull().references(() => markets.id),
  name: text('name').notNull(),
  currentPrice: decimal('current_price', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Orders table
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  marketId: integer('market_id').notNull().references(() => markets.id),
  marketOptionId: integer('market_option_id').notNull().references(() => marketOptions.id),
  type: orderTypeEnum('type').default('limit').notNull(),
  side: orderSideEnum('side').notNull(),
  price: decimal('price', { precision: 12, scale: 2 }).notNull(),
  quantity: decimal('quantity', { precision: 12, scale: 2 }).notNull(),
  filledQuantity: decimal('filled_quantity', { precision: 12, scale: 2 }).default('0').notNull(),
  status: orderStatusEnum('status').default('open').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  wallet: one(wallets, {
    fields: [users.id],
    references: [wallets.userId],
  }),
  orders: many(orders),
}));

export const walletsRelations = relations(wallets, ({ one }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
}));

export const sportsRelations = relations(sports, ({ many }) => ({
  events: many(events),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  sport: one(sports, {
    fields: [events.sportId],
    references: [sports.id],
  }),
  markets: many(markets),
}));

export const marketsRelations = relations(markets, ({ one, many }) => ({
  event: one(events, {
    fields: [markets.eventId],
    references: [events.id],
  }),
  options: many(marketOptions),
  orders: many(orders),
}));

export const marketOptionsRelations = relations(marketOptions, ({ one, many }) => ({
  market: one(markets, {
    fields: [marketOptions.marketId],
    references: [markets.id],
  }),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  market: one(markets, {
    fields: [orders.marketId],
    references: [markets.id],
  }),
  marketOption: one(marketOptions, {
    fields: [orders.marketOptionId],
    references: [marketOptions.id],
  }),
})); 