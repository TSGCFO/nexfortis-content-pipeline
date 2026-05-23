import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@ncp/logger': path.resolve(here, 'lib/logger/src/index.ts'),
      '@ncp/shared-types': path.resolve(here, 'lib/shared-types/src/index.ts'),
      '@ncp/db': path.resolve(here, 'lib/db/src/index.ts'),
      '@ncp/embeddings': path.resolve(here, 'lib/embeddings/src/index.ts'),
      '@ncp/redaction': path.resolve(here, 'lib/redaction/src/index.ts'),
      '@ncp/cowork-export': path.resolve(here, 'tools/nfx-cowork-export/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});
