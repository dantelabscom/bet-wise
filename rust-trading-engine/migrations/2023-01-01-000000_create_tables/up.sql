-- Create markets table
CREATE TABLE markets (
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
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    market_id TEXT NOT NULL REFERENCES markets(id),
    side INTEGER NOT NULL,
    outcome INTEGER NOT NULL,
    price NUMERIC(10, 5) NOT NULL,
    quantity INTEGER NOT NULL,
    remaining_quantity INTEGER NOT NULL,
    status INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- Create trades table
CREATE TABLE trades (
    id UUID PRIMARY KEY,
    market_id TEXT NOT NULL REFERENCES markets(id),
    buy_order_id UUID NOT NULL REFERENCES orders(id),
    buyer_id UUID NOT NULL,
    sell_order_id UUID NOT NULL REFERENCES orders(id),
    seller_id UUID NOT NULL,
    outcome INTEGER NOT NULL,
    price NUMERIC(10, 5) NOT NULL,
    quantity INTEGER NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL
);

-- Add indexes for efficient querying
CREATE INDEX idx_orders_market_id ON orders(market_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_trades_market_id ON trades(market_id);
CREATE INDEX idx_trades_buyer_id ON trades(buyer_id);
CREATE INDEX idx_trades_seller_id ON trades(seller_id); 