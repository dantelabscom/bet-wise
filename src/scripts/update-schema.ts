import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        process.env[key] = value;
      }
    }
  }
}

// Load environment variables
loadEnv();

// For schema updates
async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not defined');
  }

  console.log('Running schema updates...');
  
  // Initialize Postgres client for migrations
  const migrationClient = postgres(connectionString, { max: 1 });

  try {
    // Update existing enums
    console.log('Updating enums...');
    
    // Update market_status enum to include 'suspended'
    await migrationClient`
      ALTER TYPE market_status ADD VALUE IF NOT EXISTS 'suspended';
    `;
    
    // Create market_type enum if it doesn't exist
    await migrationClient`
      DO $$ BEGIN
        CREATE TYPE market_type AS ENUM ('winner', 'over_under', 'spread', 'prop', 'handicap', 'custom');
        EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `;
    
    // Add or modify columns in existing tables
    console.log('Updating tables...');
    
    // Update events table
    await migrationClient`
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS home_team TEXT,
      ADD COLUMN IF NOT EXISTS away_team TEXT,
      ADD COLUMN IF NOT EXISTS result JSONB;
    `;
    
    // Update markets table
    await migrationClient`
      ALTER TABLE markets
      ADD COLUMN IF NOT EXISTS type market_type NOT NULL DEFAULT 'winner',
      ADD COLUMN IF NOT EXISTS metadata JSONB,
      ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
      ADD COLUMN IF NOT EXISTS trading_volume DECIMAL(12, 2) NOT NULL DEFAULT '0';
    `;
    
    // Update market_options table
    await migrationClient`
      ALTER TABLE market_options
      ADD COLUMN IF NOT EXISTS initial_price DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS last_price DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS min_price DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS max_price DECIMAL(12, 2),
      ADD COLUMN IF NOT EXISTS metadata JSONB,
      ADD COLUMN IF NOT EXISTS weight DECIMAL(12, 4) NOT NULL DEFAULT '1';
    `;
    
    // Set initial_price for existing records
    await migrationClient`
      UPDATE market_options
      SET initial_price = current_price
      WHERE initial_price IS NULL;
    `;
    
    // Add not null constraint to initial_price
    await migrationClient`
      ALTER TABLE market_options
      ALTER COLUMN initial_price SET NOT NULL;
    `;
    
    // Update orders table
    await migrationClient`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
    `;
    
    // Create new tables if they don't exist
    console.log('Creating new tables...');
    
    // Create market_price_history table
    await migrationClient`
      CREATE TABLE IF NOT EXISTS market_price_history (
        id SERIAL PRIMARY KEY,
        market_option_id INTEGER NOT NULL REFERENCES market_options(id),
        price DECIMAL(12, 2) NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;
    
    // Create positions table
    await migrationClient`
      CREATE TABLE IF NOT EXISTS positions (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        market_id INTEGER NOT NULL REFERENCES markets(id),
        market_option_id INTEGER NOT NULL REFERENCES market_options(id),
        quantity DECIMAL(12, 2) NOT NULL,
        average_price DECIMAL(12, 2) NOT NULL,
        realized_pnl DECIMAL(12, 2) NOT NULL DEFAULT '0',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;
    
    // Create transactions table
    await migrationClient`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        wallet_id INTEGER NOT NULL REFERENCES wallets(id),
        amount DECIMAL(12, 2) NOT NULL,
        type TEXT NOT NULL,
        reference TEXT,
        description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;
    
    console.log('Schema update completed successfully');
  } catch (error) {
    console.error('Schema update failed:', error);
    throw error;
  } finally {
    // Close the database connection
    await migrationClient.end();
  }
}

// Run the update
main().catch((err) => {
  console.error('Schema update script error:', err);
  process.exit(1);
}); 