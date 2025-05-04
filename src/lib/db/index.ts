import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Check if we're in a production environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not defined');
}

// For use in edge functions and server components
const client = postgres(connectionString);
export const db = drizzle(client, { schema });

// Export types for better type safety
export type DbClient = typeof db;
export type SchemaType = typeof schema; 