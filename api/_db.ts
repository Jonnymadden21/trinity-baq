import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/schema.js";

// Connection string from Supabase project settings → Database → Connection string (URI)
const connectionString = process.env.DATABASE_URL!;

// Use connection pooling for serverless — important for Vercel
const client = postgres(connectionString, {
  prepare: false, // Supabase Transaction mode doesn't support prepared statements
  max: 1, // Serverless: one connection per invocation
});

export const db = drizzle(client, { schema });
