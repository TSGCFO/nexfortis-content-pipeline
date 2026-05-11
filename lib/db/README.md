## `@ncp/db`

Drizzle ORM schema, typed client factory, and migration SQL for the
**NexFortis Automated Content Pipeline v2** Postgres database (shared
Supabase project).

This package is **schema-only**. It deliberately ships no query helpers,
repository classes, or business logic — each service that consumes it
defines its own queries.

### What lives here

| Path | Purpose |
|---|---|
| `src/schema/` | One Drizzle table file per Postgres table + the shared `pgEnum` declarations |
| `src/schema/_vector.ts` | Custom Drizzle column type for the pgvector `vector(n)` Postgres type |
| `src/schema/index.ts` | Barrel re-exporting every table, enum, and inferred type |
| `src/client.ts` | `createDbClient` factory + `DbConnectionConfigError` |
| `src/migrations/0000_initial.sql` | Initial migration containing every table from §5 + the HNSW pgvector index + the `drafts.updated_at` trigger + the `article_candidates.pillar` CHECK constraint |
| `drizzle.config.ts` | Drizzle Kit config (used only to regenerate migrations) |

The Postgres schemas mirror
[`docs/ways-of-work/plan/content-pipeline-v2/architecture-and-data-model.md`](../../docs/ways-of-work/plan/content-pipeline-v2/architecture-and-data-model.md)
§5–§6 exactly. The spec is the source of truth.

### Usage

```ts
import { createDbClient, captureSignals } from '@ncp/db';

const db = createDbClient(); // reads DATABASE_URL from env

const rows = await db.select().from(captureSignals).limit(10);
```

You can also pass an explicit connection string:

```ts
const db = createDbClient({ connectionString: 'postgres://user:pass@host/db' });
```

Both call sites throw a typed `DbConnectionConfigError` (with
`code: 'DB_CONNECTION_CONFIG'`) if the connection string is missing or does
not start with `postgres://` / `postgresql://`. No network I/O happens at
construction time — actual connection failures surface on the first query.

### Migrations

Migration execution is **out of scope for this package**. The migration SQL
under `src/migrations/` is committed source code; Hassan applies it manually
against the shared Supabase project as a separate deployment step. The
Supabase project also requires the `pgvector` extension to be enabled
(Supabase Dashboard → Database → Extensions → `vector`) before this
migration is run.

To regenerate the migration after a schema change (review the diff carefully
before committing):

```bash
pnpm --filter @ncp/db db:generate
```

### Seed data

The `source_filters` seed rows live in `src/schema/source-filters.ts` as the
`sourceFiltersSeed` constant. They are exported for documentation and one-time
seeding only — this package never inserts them automatically. The legal
counsel email values in the seed are placeholders; the real SHA-256 hashes
are inserted by Hassan during deployment and are never committed to git.
