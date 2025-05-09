-- Create markets table
CREATE TABLE IF NOT EXISTS markets (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    description TEXT NOT NULL,
    status INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    close_time TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolution INTEGER
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    market_id TEXT NOT NULL REFERENCES markets(id),
    side INTEGER NOT NULL,
    outcome INTEGER NOT NULL,
    price DECIMAL NOT NULL,
    quantity INTEGER NOT NULL,
    remaining_quantity INTEGER NOT NULL,
    status INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- Create trades table
CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    market_id TEXT NOT NULL REFERENCES markets(id),
    buy_order_id TEXT NOT NULL REFERENCES orders(id),
    buyer_id TEXT NOT NULL,
    sell_order_id TEXT NOT NULL REFERENCES orders(id),
    seller_id TEXT NOT NULL,
    outcome INTEGER NOT NULL,
    price DECIMAL NOT NULL,
    quantity INTEGER NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL
);

-- Create user_balances table
CREATE TABLE IF NOT EXISTS user_balances (
    user_id TEXT PRIMARY KEY,
    available_balance DECIMAL NOT NULL,
    reserved_balance DECIMAL NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- Create balance_transactions table
CREATE TABLE IF NOT EXISTS balance_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount DECIMAL NOT NULL,
    transaction_type INTEGER NOT NULL,
    reference_id TEXT,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_market_id ON orders(market_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_market_id ON trades(market_id);
CREATE INDEX IF NOT EXISTS idx_trades_buyer_id ON trades(buyer_id);
CREATE INDEX IF NOT EXISTS idx_trades_seller_id ON trades(seller_id);
CREATE INDEX IF NOT EXISTS idx_balance_transactions_user_id ON balance_transactions(user_id); 