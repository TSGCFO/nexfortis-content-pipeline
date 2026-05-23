/**
 * Directory walker for the Cowork session ingester.
 *
 * Reads `dir` and returns every `*.json` file whose mtime is `>=` the
 * checkpoint (inclusive boundary, per the prompt's edge cases). Auxiliary
 * files (`_audit-*.txt` sidecars, hidden files, exporter atomic-rename
 * temp files) are filtered out.
 *
 * The result is sorted ascending by mtime, then by path for ties, so the
 * orchestrator can update the checkpoint deterministically and rerun-safely.
 *
 * Edge cases:
 *  - Empty / missing directory → throws `InputDirNotConfiguredError` so
 *    the run aborts cleanly rather than silently doing nothing on
 *    misconfiguration. The exception message names `dir` so operators can
 *    spot the misconfigured env var.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { InputDirNotConfiguredError } from './errors.js';
import type { DiscoveredFile } from './types.js';

function isJsonFilename(name: string): boolean {
  // Case-insensitive `.json` so Windows-originated transfers (e.g.
  // `Mixed.JSON`) aren't accidentally dropped on Linux file systems.
  return name.toLowerCase().endsWith('.json');
}

function isExcludedFilename(name: string): boolean {
  if (name.startsWith('.')) return true;
  // The exporter writes audit sidecars as `_audit-<ISO-ts>.txt`. The .json
  // filter already excludes those, but be explicit in case a future
  // exporter writes `_audit-*.json` summaries — we still don't want to
  // ingest audit files.
  if (name.toLowerCase().startsWith('_audit-')) return true;
  // The exporter's atomic-rename temp pattern is `<name>.json.tmp-<pid>`;
  // the `.json` filter already excludes those. Defensive nonetheless.
  if (name.includes('.tmp-')) return true;
  return false;
}

export async function discoverFiles(
  dir: string,
  since: Date,
): Promise<DiscoveredFile[]> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code: unknown }).code)
        : 'UNKNOWN';
    throw new InputDirNotConfiguredError(
      `Cowork import directory ${dir} is not readable (${code}). Set COWORK_IMPORT_DIR to an existing, readable path.`,
      { cause: err },
    );
  }

  const sinceMs = since.getTime();
  const out: DiscoveredFile[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!isJsonFilename(entry.name)) continue;
    if (isExcludedFilename(entry.name)) continue;

    const full = path.join(dir, entry.name);
    let stat: import('node:fs').Stats;
    try {
      stat = await fs.stat(full);
    } catch {
      // Race with file removal/rename between readdir and stat. Skip and
      // continue — the next run will see the new state.
      continue;
    }
    if (stat.mtime.getTime() < sinceMs) continue;
    out.push({ path: full, mtime: stat.mtime });
  }

  out.sort((a, b) => {
    const dt = a.mtime.getTime() - b.mtime.getTime();
    if (dt !== 0) return dt;
    return a.path.localeCompare(b.path);
  });

  return out;
}
