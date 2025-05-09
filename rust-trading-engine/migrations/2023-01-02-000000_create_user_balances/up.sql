-- Create user_balances table
CREATE TABLE user_balances (
    user_id UUID PRIMARY KEY,
    available_balance NUMERIC(18, 8) NOT NULL DEFAULT 0,
    reserved_balance NUMERIC(18, 8) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL
);

-- Create balance_transactions table (ledger)
CREATE TABLE balance_transactions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_balances(user_id),
    amount NUMERIC(18, 8) NOT NULL,
    transaction_type INTEGER NOT NULL,
    reference_id TEXT,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

-- Add indexes for efficient querying
CREATE INDEX idx_balance_transactions_user_id ON balance_transactions(user_id);
CREATE INDEX idx_balance_transactions_created_at ON balance_transactions(created_at); 