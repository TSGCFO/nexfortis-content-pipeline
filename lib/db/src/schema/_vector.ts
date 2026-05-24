// Custom Drizzle column types for the Postgres pgvector extension.
//
// Drizzle ORM v0.36 has limited / evolving native pgvector support, so we declare
// our own column types to keep the surface stable for this prompt. The `data`
// side is plain `number[]` for ergonomic use in app code; the `driverData` side
// is the literal string Postgres expects on the wire (e.g. "[0.1,0.2,0.3]") —
// the wire format is identical for both `vector` and `halfvec`, so the helpers
// share their `toDriver` / `fromDriver` implementations.
//
// Reference: https://orm.drizzle.team/docs/custom-types

import { customType } from 'drizzle-orm/pg-core';

interface PgVectorTypeShape {
  data: number[];
  driverData: string;
}

function toDriver(value: number[]): string {
  return `[${value.join(',')}]`;
}

function fromDriver(value: string): number[] {
  // Postgres returns the value as the literal string "[n,n,n]". Strip the
  // surrounding brackets, split on commas, and parse each component.
  const inner = value.replace(/^\[/, '').replace(/\]$/, '');
  if (inner.length === 0) {
    return [];
  }
  return inner.split(',').map((part) => Number(part));
}

/**
 * Full-precision (32-bit float per component) pgvector column.
 *
 * Indexing constraint: pgvector caps both HNSW and IVFFlat indexes on the
 * `vector` type at 2000 dimensions. For embeddings above 2000 dims (e.g.
 * OpenAI `text-embedding-3-large` at 3072 dims), use `halfvec` instead so
 * an HNSW index can be built (`halfvec` supports up to 4000 dims).
 */
export const vector = (name: string, dim: number) =>
  customType<PgVectorTypeShape>({
    dataType() {
      return `vector(${dim})`;
    },
    toDriver,
    fromDriver,
  })(name);

/**
 * Half-precision (16-bit float per component) pgvector column. Used for
 * embeddings above 2000 dims so an HNSW or IVFFlat index can still be built
 * (pgvector caps indexes on full `vector` at 2000 dims but supports up to
 * 4000 dims on `halfvec`).
 *
 * Precision impact for cosine-similarity workloads is documented at
 * <0.5% in retrieval-quality benchmarks; the wire format is identical to
 * `vector` (`[n,n,n]`) so application code does not need to change.
 */
export const halfvec = (name: string, dim: number) =>
  customType<PgVectorTypeShape>({
    dataType() {
      return `halfvec(${dim})`;
    },
    toDriver,
    fromDriver,
  })(name);
