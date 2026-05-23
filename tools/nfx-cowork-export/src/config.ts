/**
 * Load + validate the three required config files.
 *
 * Fail-closed posture: if any of the three files is missing, this loader
 * throws `ConfigMissingError`. Hassan has active legal context; the worst
 * failure mode for the exporter is "ingest a session that shouldn't be
 * ingested." Refusing to start when a config file is missing is the only
 * defense that catches "I forgot to copy the example" mistakes.
 *
 * Files loaded:
 *   - cwd-allowlist.json     — three-bucket allow/deny path lists
 *   - family-law-slugs.json  — plaintext slugs to drop wholesale
 *
 * (Removed in slice 6+: account-allowlist.json. Every session on the user's
 * own laptop is theirs by definition. The `meta.emailAddress` field is still
 * read and surfaced as the emitted JSON's `account` field for ingester use.)
 */

import { promises as fs } from 'node:fs';
import { z } from 'zod';

import type { ExporterConfig } from './types.js';

// Zod schemas describing the on-disk shape of each config file.
// Fields prefixed with `_` are comments / documentation — accepted but ignored.

const cwdAllowlistSchema = z
  .object({
    alwaysAllow: z.array(z.string()),
    allowPrefixes: z.array(z.string()),
    alwaysDeny: z.array(z.string()),
  })
  .passthrough(); // tolerate `_comment` and other documentation keys

const familyLawSlugsSchema = z
  .object({
    slugs: z.array(z.string()),
  })
  .passthrough();

export class ConfigMissingError extends Error {
  readonly code = 'CONFIG_MISSING' as const;
  constructor(public readonly path: string, public readonly configKind: string) {
    super(
      `Missing required config file (${configKind}): ${path}\n` +
        `\nThis exporter is fail-closed by design. Hassan has active legal context\n` +
        `and the worst failure mode is ingesting a session that shouldn't be ingested.\n` +
        `Copy the corresponding .example.json from tools/nfx-cowork-export/ to the\n` +
        `path above and edit it to fit your environment, then re-run.`
    );
    this.name = 'ConfigMissingError';
  }
}

export class ConfigInvalidError extends Error {
  readonly code = 'CONFIG_INVALID' as const;
  constructor(public readonly path: string, public readonly issues: string[]) {
    super(`Invalid config at ${path}:\n` + issues.map((i) => '  - ' + i).join('\n'));
    this.name = 'ConfigInvalidError';
  }
}

export interface LoadExporterConfigOptions {
  cwdAllowlistPath: string;
  familyLawSlugsPath: string;
}

async function readJson(path: string, kind: string): Promise<unknown> {
  let raw: string;
  try {
    raw = await fs.readFile(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ConfigMissingError(path, kind);
    }
    throw err;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new ConfigInvalidError(path, [`Failed to parse JSON: ${(err as Error).message}`]);
  }
}

function parseOrThrow<T>(schema: z.ZodType<T>, raw: unknown, path: string): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `${i.path.join('.') || '<root>'}: ${i.message}`
    );
    throw new ConfigInvalidError(path, issues);
  }
  return result.data;
}

/**
 * Load all three config files. Throws on missing or invalid files. On
 * success returns a fully-validated `ExporterConfig` safe to pass to filter
 * code by reference.
 */
export async function loadExporterConfig(
  options: LoadExporterConfigOptions
): Promise<ExporterConfig> {
  const [cwdRaw, slugsRaw] = await Promise.all([
    readJson(options.cwdAllowlistPath, 'cwd-allowlist'),
    readJson(options.familyLawSlugsPath, 'family-law-slugs'),
  ]);

  const cwd = parseOrThrow(cwdAllowlistSchema, cwdRaw, options.cwdAllowlistPath);
  const slugs = parseOrThrow(familyLawSlugsSchema, slugsRaw, options.familyLawSlugsPath);

  return {
    cwdAllowlist: {
      alwaysAllow: cwd.alwaysAllow,
      allowPrefixes: cwd.allowPrefixes,
      alwaysDeny: cwd.alwaysDeny,
    },
    familyLawSlugs: slugs.slugs,
  };
}
