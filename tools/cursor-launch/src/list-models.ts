#!/usr/bin/env node
/**
 * Tiny utility script: calls Cursor.models.list() and writes the result to
 * a JSON file. We use this to capture the authoritative model + params
 * snapshot once you provide the API key, so we know exactly which params
 * Opus 4.7 / 4.8 / etc. accept without guessing.
 *
 * Usage:
 *   CURSOR_API_KEY=... node dist/list-models.js [output-path]
 *
 * Default output path: ./cursor-models.json
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { REQUIRED_ENV } from './config.js';

async function main(): Promise<void> {
  const apiKey = process.env[REQUIRED_ENV.cursorApiKey];
  if (!apiKey) {
    console.error(`Missing required env var: ${REQUIRED_ENV.cursorApiKey}`);
    process.exit(1);
  }

  const outputPath = process.argv[2] ?? './cursor-models.json';
  const absPath = path.resolve(process.cwd(), outputPath);

  console.warn(`Calling Cursor.models.list()...`);
  const { Cursor } = await import('@cursor/sdk');
  const models = await Cursor.models.list({ apiKey });

  await writeFile(absPath, JSON.stringify(models, null, 2) + '\n', 'utf8');
  console.warn(`Wrote ${models.length} models to ${absPath}`);

  // Also write a compact human summary to stderr
  for (const m of models) {
    const params = m.parameters?.map((p) => p.id).join(', ') ?? '';
    console.warn(`  ${m.id}${params ? `  [params: ${params}]` : ''}`);
  }
}

main().catch((err) => {
  console.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
});
