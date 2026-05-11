import { defineConfig } from 'drizzle-kit';

// Drizzle Kit config. Used only for `drizzle-kit generate` to regenerate the
// migration SQL from the TypeScript schema. Actual migration execution is a
// manual deployment step (see src/migrations/0000_initial.sql); we therefore
// do not configure `dbCredentials` here.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './src/migrations',
});
