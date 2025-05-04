import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from './schema';
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

// For migrations
async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not defined');
  }

  console.log('Running migrations...');
  
  // Initialize Postgres client for migrations (with higher timeout)
  const migrationClient = postgres(connectionString, { max: 1 });
  const db = drizzle(migrationClient, { schema });

  try {
    // Create schema manually since we don't have migration files yet
    console.log('Creating schema...');
    
    // Create enums
    await migrationClient`
      DO $$ BEGIN
        CREATE TYPE "role" AS ENUM ('user', 'admin');
        EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `;
    await migrationClient`
      DO $$ BEGIN
        CREATE TYPE "sport_type" AS ENUM ('football', 'basketball', 'baseball', 'hockey', 'soccer', 'other');
        EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `;
    await migrationClient`
      DO $$ BEGIN
        CREATE TYPE "market_status" AS ENUM ('open', 'closed', 'settled', 'cancelled');
        EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `;
    await migrationClient`
      DO $$ BEGIN
        CREATE TYPE "order_type" AS ENUM ('market', 'limit');
        EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `;
    await migrationClient`
      DO $$ BEGIN
        CREATE TYPE "order_status" AS ENUM ('open', 'filled', 'partially_filled', 'cancelled');
        EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `;
    await migrationClient`
      DO $$ BEGIN
        CREATE TYPE "order_side" AS ENUM ('buy', 'sell');
        EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `;

    // Create users table
    await migrationClient`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" TEXT PRIMARY KEY,
        "email" TEXT NOT NULL UNIQUE,
        "name" TEXT,
        "role" role NOT NULL DEFAULT 'user',
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    // Create wallets table
    await migrationClient`
      CREATE TABLE IF NOT EXISTS "wallets" (
        "id" SERIAL PRIMARY KEY,
        "user_id" TEXT NOT NULL REFERENCES "users"("id"),
        "balance" DECIMAL(12, 2) NOT NULL DEFAULT '1000',
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    // Create sports table
    await migrationClient`
      CREATE TABLE IF NOT EXISTS "sports" (
        "id" SERIAL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "type" sport_type NOT NULL DEFAULT 'other',
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    // Create events table
    await migrationClient`
      CREATE TABLE IF NOT EXISTS "events" (
        "id" SERIAL PRIMARY KEY,
        "sport_id" INTEGER NOT NULL REFERENCES "sports"("id"),
        "name" TEXT NOT NULL,
        "description" TEXT,
        "start_time" TIMESTAMP NOT NULL,
        "end_time" TIMESTAMP,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    // Create markets table
    await migrationClient`
      CREATE TABLE IF NOT EXISTS "markets" (
        "id" SERIAL PRIMARY KEY,
        "event_id" INTEGER NOT NULL REFERENCES "events"("id"),
        "name" TEXT NOT NULL,
        "description" TEXT,
        "status" market_status NOT NULL DEFAULT 'open',
        "settled_option" TEXT,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    // Create market options table
    await migrationClient`
      CREATE TABLE IF NOT EXISTS "market_options" (
        "id" SERIAL PRIMARY KEY,
        "market_id" INTEGER NOT NULL REFERENCES "markets"("id"),
        "name" TEXT NOT NULL,
        "current_price" DECIMAL(12, 2) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    // Create orders table
    await migrationClient`
      CREATE TABLE IF NOT EXISTS "orders" (
        "id" SERIAL PRIMARY KEY,
        "user_id" TEXT NOT NULL REFERENCES "users"("id"),
        "market_id" INTEGER NOT NULL REFERENCES "markets"("id"),
        "market_option_id" INTEGER NOT NULL REFERENCES "market_options"("id"),
        "type" order_type NOT NULL DEFAULT 'limit',
        "side" order_side NOT NULL,
        "price" DECIMAL(12, 2) NOT NULL,
        "quantity" DECIMAL(12, 2) NOT NULL,
        "filled_quantity" DECIMAL(12, 2) NOT NULL DEFAULT '0',
        "status" order_status NOT NULL DEFAULT 'open',
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;

    console.log('Schema created successfully!');

    // Seed initial data for sports
    console.log('Seeding initial data...');
    await migrationClient`
      INSERT INTO sports (name, type) 
      VALUES 
        ('Football', 'football'),
        ('Basketball', 'basketball'),
        ('Baseball', 'baseball'),
        ('Hockey', 'hockey'),
        ('Soccer', 'soccer')
      ON CONFLICT DO NOTHING;
    `;

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    // Close the database connection
    await migrationClient.end();
  }
}

// Run the migration
main().catch((err) => {
  console.error('Migration script error:', err);
  process.exit(1);
}); 