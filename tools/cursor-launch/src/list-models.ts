#!/usr/bin/env node
/**
 * Companion utility: dumps GET /v1/models to a JSON file.
 *
 * Usage:
 *   nfx-cursor-list-models [output-path]
 *
 * Authentication: same as the launcher — either CURSOR_API_KEY env var or
 * the credential proxy (api_credentials=['custom-cred:api.cursor.com']).
 *
 * Default output path: ./cursor-models.json
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { listModels } from './cursor-api.js';

async function main(): Promise<void> {
  const outputPath = process.argv[2] ?? './cursor-models.json';
  const absPath = path.resolve(process.cwd(), outputPath);

  console.warn(`Calling GET /v1/models...`);
  const { items: models } = await listModels();

  await writeFile(absPath, JSON.stringify({ items: models }, null, 2) + '\n', 'utf8');
  console.warn(`Wrote ${models.length} models to ${absPath}`);

  for (const m of models) {
    const params = m.parameters?.map((p) => p.id).join(', ') ?? '';
    console.warn(`  ${m.id}${params ? `  [params: ${params}]` : ''}`);
  }
}

main().catch((err) => {
  console.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
});
