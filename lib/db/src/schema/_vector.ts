// Custom Drizzle column type for the Postgres `vector` type (pgvector extension).
//
// Drizzle ORM v0.36 has limited / evolving native pgvector support, so we declare
// our own column type to keep the surface stable for this prompt. The `data` side
// is plain `number[]` for ergonomic use in app code; the `driverData` side is the
// `vector` literal string Postgres expects on the wire (e.g. "[0.1,0.2,0.3]").
//
// Reference: https://orm.drizzle.team/docs/custom-types

import { customType } from 'drizzle-orm/pg-core';

export const vector = (name: string, dim: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dim})`;
    },
    toDriver(value: number[]): string {
      return `[${value.join(',')}]`;
    },
    fromDriver(value: string): number[] {
      // Postgres returns the value as the literal string "[n,n,n]". Strip the
      // surrounding brackets, split on commas, and parse each component.
      const inner = value.replace(/^\[/, '').replace(/\]$/, '');
      if (inner.length === 0) {
        return [];
      }
      return inner.split(',').map((part) => Number(part));
    },
  })(name);
