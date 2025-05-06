-- Setup script for trading_db database

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    market_id BIGINT NOT NULL,
    market_option_id BIGINT NOT NULL,
    type VARCHAR(10) NOT NULL,
    side VARCHAR(10) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    filled_quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    market_id BIGINT NOT NULL,
    market_option_id BIGINT NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    average_entry_price DECIMAL(10, 2) NOT NULL,
    realized_pnl DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(user_id, market_id, market_option_id)
);

-- Order matches table
CREATE TABLE IF NOT EXISTS order_matches (
    id UUID PRIMARY KEY,
    taker_order_id UUID NOT NULL,
    maker_order_id UUID NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Markets table
CREATE TABLE IF NOT EXISTS markets (
    id BIGINT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL,
    type VARCHAR(50) NOT NULL,
    trading_volume DECIMAL(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Market options table
CREATE TABLE IF NOT EXISTS market_options (
    id BIGINT PRIMARY KEY,
    market_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    initial_price DECIMAL(10, 2) NOT NULL,
    current_price DECIMAL(10, 2) NOT NULL,
    last_price DECIMAL(10, 2),
    min_price DECIMAL(10, 2),
    max_price DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Market price history
CREATE TABLE IF NOT EXISTS market_price_history (
    id SERIAL PRIMARY KEY,
    market_option_id BIGINT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Users table (minimal implementation)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Analytics tables
CREATE TABLE IF NOT EXISTS order_book_views (
    id SERIAL PRIMARY KEY,
    market_id BIGINT NOT NULL,
    market_option_id BIGINT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS position_views (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Add some sample data
INSERT INTO users (id, username, created_at)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'test_user1', NOW()),
    ('00000000-0000-0000-0000-000000000002', 'test_user2', NOW());

INSERT INTO markets (id, name, description, status, type, created_at, updated_at)
VALUES 
    (1, 'IND vs AUS - Winner', 'India vs Australia Cricket Match Winner', 'open', 'winner', NOW(), NOW());

INSERT INTO market_options (id, market_id, name, initial_price, current_price, created_at, updated_at)
VALUES 
    (1, 1, 'India', 0.50, 0.50, NOW(), NOW()),
    (2, 1, 'Australia', 0.50, 0.50, NOW(), NOW()); 