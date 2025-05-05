import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { marketTypeEnum } from './schema';

/**
 * This script migrates the database to include cricket-specific market types
 */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }
  
  // Create a Postgres client
  const client = postgres(connectionString);
  const db = drizzle(client);
  
  console.log('Updating market type enum to include cricket market types...');
  
  try {
    // Execute a raw SQL query to update the enum
    // This is needed because PostgreSQL requires special handling for modifying enums
    await db.execute(`
      ALTER TYPE "market_type" ADD VALUE IF NOT EXISTS 'match_winner';
      ALTER TYPE "market_type" ADD VALUE IF NOT EXISTS 'total_runs';
      ALTER TYPE "market_type" ADD VALUE IF NOT EXISTS 'player_performance';
      ALTER TYPE "market_type" ADD VALUE IF NOT EXISTS 'innings_score';
      ALTER TYPE "market_type" ADD VALUE IF NOT EXISTS 'wickets';
      ALTER TYPE "market_type" ADD VALUE IF NOT EXISTS 'next_dismissal';
    `);
    
    console.log('Successfully updated market type enum with cricket-specific types');
  } catch (error) {
    console.error('Failed to update market type enum:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
}); 