import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

/**
 * Thrown by {@link createDbClient} when the Postgres connection string is
 * either missing or malformed. Carries a stable machine-readable `code` so
 * callers can branch on configuration errors without string-matching.
 */
export class DbConnectionConfigError extends Error {
  public readonly code = 'DB_CONNECTION_CONFIG' as const;
  constructor(message: string) {
    super(message);
    this.name = 'DbConnectionConfigError';
  }
}

export interface CreateDbClientOptions {
  /**
   * Postgres connection URL (e.g. `postgres://user:pass@host:5432/db`). When
   * omitted, the factory reads `process.env.DATABASE_URL`. If neither is set,
   * a {@link DbConnectionConfigError} is thrown.
   */
  connectionString?: string;
}

export type Database = PostgresJsDatabase<typeof schema>;

// Permissive but precise enough to reject obvious garbage. Full URL parsing
// is left to `postgres-js` itself (which surfaces detailed errors on the
// first query rather than at construction time).
const POSTGRES_URL_PATTERN = /^postgres(?:ql)?:\/\//;

/**
 * Build a Drizzle client bound to the shared schema. The factory performs no
 * network I/O — actual connection failures surface on the first query.
 *
 * Per-process pooling / singleton management is the consuming service's
 * responsibility. This factory simply returns a fresh Drizzle instance.
 */
export function createDbClient(opts: CreateDbClientOptions = {}): Database {
  const connectionString =
    opts.connectionString ?? process.env['DATABASE_URL'];

  if (typeof connectionString !== 'string' || connectionString.length === 0) {
    throw new DbConnectionConfigError(
      'DATABASE_URL is not set and no `connectionString` option was provided to createDbClient().',
    );
  }

  if (!POSTGRES_URL_PATTERN.test(connectionString)) {
    throw new DbConnectionConfigError(
      'Invalid Postgres connection string: expected a URL beginning with "postgres://" or "postgresql://".',
    );
  }

  const sql = postgres(connectionString);
  return drizzle(sql, { schema });
}
