import { pgTable, serial, text, timestamp, integer, boolean, decimal, pgEnum, jsonb, uuid, numeric } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const roleEnum = pgEnum('role', ['user', 'admin']);
export const sportTypeEnum = pgEnum('sport_type', ['football', 'basketball', 'baseball', 'hockey', 'soccer', 'other']);
export const marketStatusEnum = pgEnum('market_status', ['open', 'suspended', 'closed', 'settled', 'cancelled']);
export const marketTypeEnum = pgEnum('market_type', [
  'winner', 
  'over_under', 
  'spread', 
  'prop', 
  'handicap', 
  'custom',
  'match_winner',
  'total_runs',
  'player_performance',
  'innings_score',
  'wickets',
  'next_dismissal'
]);
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
  homeTeam: text('home_team'),
  awayTeam: text('away_team'),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  isActive: boolean('is_active').default(true).notNull(),
  result: jsonb('result'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Markets table
export const markets = pgTable('markets', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').notNull().references(() => events.id),
  name: text('name').notNull(),
  description: text('description'),
  type: marketTypeEnum('type').default('winner').notNull(),
  status: marketStatusEnum('status').default('open').notNull(),
  metadata: jsonb('metadata'), // For additional type-specific parameters
  settledOption: text('settled_option'),
  settledAt: timestamp('settled_at'),
  suspendedReason: text('suspended_reason'),
  tradingVolume: decimal('trading_volume', { precision: 12, scale: 2 }).default('0').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Market Options table
export const marketOptions = pgTable('market_options', {
  id: serial('id').primaryKey(),
  marketId: integer('market_id').notNull().references(() => markets.id),
  name: text('name').notNull(),
  initialPrice: decimal('initial_price', { precision: 12, scale: 2 }).notNull(),
  currentPrice: decimal('current_price', { precision: 12, scale: 2 }).notNull(),
  lastPrice: decimal('last_price', { precision: 12, scale: 2 }),
  minPrice: decimal('min_price', { precision: 12, scale: 2 }),
  maxPrice: decimal('max_price', { precision: 12, scale: 2 }),
  metadata: jsonb('metadata'), // For additional option details like spread value, over/under line, etc.
  weight: decimal('weight', { precision: 12, scale: 4 }).default('1').notNull(), // For implied probability calculations
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Market Price History table
export const marketPriceHistory = pgTable('market_price_history', {
  id: serial('id').primaryKey(),
  marketOptionId: integer('market_option_id').notNull().references(() => marketOptions.id),
  price: decimal('price', { precision: 12, scale: 2 }).notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
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
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Positions table (aggregated user positions)
export const positions = pgTable('positions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  marketId: integer('market_id').notNull(),
  marketOptionId: integer('market_option_id').notNull(),
  quantity: numeric('quantity').notNull(),
  averageEntryPrice: numeric('average_entry_price').notNull(),
  realizedPnl: numeric('realized_pnl').notNull().default('0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Transactions table (for wallet history)
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  walletId: integer('wallet_id').notNull().references(() => wallets.id),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  type: text('type').notNull(), // deposit, withdraw, trade, settlement
  reference: text('reference'), // order id, position id
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  wallet: one(wallets, {
    fields: [users.id],
    references: [wallets.userId],
  }),
  orders: many(orders),
  positions: many(positions),
}));

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
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
  positions: many(positions),
}));

export const marketOptionsRelations = relations(marketOptions, ({ one, many }) => ({
  market: one(markets, {
    fields: [marketOptions.marketId],
    references: [markets.id],
  }),
  orders: many(orders),
  positions: many(positions),
  priceHistory: many(marketPriceHistory),
}));

export const marketPriceHistoryRelations = relations(marketPriceHistory, ({ one }) => ({
  marketOption: one(marketOptions, {
    fields: [marketPriceHistory.marketOptionId],
    references: [marketOptions.id],
  }),
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

export const positionsRelations = relations(positions, ({ one }) => ({
  user: one(users, {
    fields: [positions.userId],
    references: [users.id],
  }),
  market: one(markets, {
    fields: [positions.marketId],
    references: [markets.id],
  }),
  marketOption: one(marketOptions, {
    fields: [positions.marketOptionId],
    references: [marketOptions.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  wallet: one(wallets, {
    fields: [transactions.walletId],
    references: [wallets.id],
  }),
})); 