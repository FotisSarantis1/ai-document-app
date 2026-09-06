import fs from "fs";
import path from "path";
import { Pool, PoolClient, QueryResult } from "pg";

/**
 * The app runs on Postgres everywhere (dev, tests, and production) so there
 * is exactly one query dialect and one code path to maintain. Tests swap in
 * an in-memory Postgres-compatible engine (pg-mem) instead of a real
 * network database - see src/__tests__/setupEnv.ts - so `npm test` still
 * needs zero external services.
 */
function createPool(): Pool {
  if (process.env.PGMEM_TEST === "1") {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { newDb } = require("pg-mem");
    const memDb = newDb({ autoCreateForeignKeyIndices: true });
    memDb.public.registerFunction({
      name: "now",
      implementation: () => new Date(),
    });
    const adapter = memDb.adapters.createPg();
    return new adapter.Pool();
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Set it to a Postgres connection string (see server/.env.example)."
    );
  }

  return new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX || 5),
    // Managed providers (Neon, Vercel Postgres, Supabase) negotiate SSL via
    // `?sslmode=require` in the connection string itself. Only override
    // certificate verification if a provider's chain genuinely needs it.
    ssl: process.env.PGSSL_NO_VERIFY === "true" ? { rejectUnauthorized: false } : undefined,
  });
}

const pool = createPool();

let schemaReady: Promise<void> | null = null;

/**
 * Runs schema.sql (idempotent - every statement is CREATE ... IF NOT EXISTS).
 * Cached as a single promise per process so it only actually runs once per
 * cold start / test file, however many callers await it.
 */
export function initDb(): Promise<void> {
  if (!schemaReady) {
    const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
    schemaReady = pool.query(schema).then(() => undefined);
  }
  return schemaReady;
}

export function query<T extends Record<string, any> = any>(
  text: string,
  params: any[] = []
): Promise<QueryResult<T>> {
  return pool.query(text, params);
}

export function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export default pool;
