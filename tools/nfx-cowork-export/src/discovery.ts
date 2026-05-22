/**
 * Walk a Cowork data root and produce one `SessionDiscovery` per
 * `local_<uuid>` session folder found.
 *
 * The walker is INERT — it doesn't apply filters and doesn't open transcripts.
 * It builds a catalogue of "what's on disk." Filtering runs downstream
 * (`filter-session.ts`) against the catalogue.
 *
 * Expected on-disk shape (per the locked spec):
 *
 *   <input-root>/
 *     <workspace-uuid>/
 *       <space-uuid>/
 *         local_<session-uuid>/
 *           .claude/
 *             projects/
 *               -sessions-<slug>/
 *                 <transcript-uuid>.jsonl                 ← parent transcript
 *                 <transcript-uuid>/
 *                   subagents/
 *                     agent-<id>.jsonl                     ← real task subagent
 *                     agent-acompact-<id>.jsonl            ← auto-compaction snapshot
 *           audit.jsonl                                    ← runtime log, not chat
 *         local_<session-uuid>.json                        ← meta sidecar
 *
 * Some sessions ("ditto" / scheduled-task runs) have their transcripts in a
 * different layout — under `agent/local_ditto_<id>/.claude/projects/...`. The
 * walker handles both layouts; downstream filters categorize them.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { SessionDiscovery, SessionMeta, TranscriptFile } from './types.js';

/**
 * Top-level entry point: scan a Cowork data root and return one
 * `SessionDiscovery` per session folder.
 *
 * Recursive depth-bounded. Does not follow symlinks. Skips directories it
 * can't read with a warning to stderr (does not throw).
 */
export async function discoverSessions(inputRoot: string): Promise<SessionDiscovery[]> {
  const discoveries: SessionDiscovery[] = [];

  // The session folders sit two levels down (workspace-uuid/space-uuid/local_<id>/).
  // We walk depth-3 recursively to find every `local_<...>` directory.
  await walkForSessionFolders(inputRoot, 0, 4, async (sessionDir) => {
    const folderName = path.basename(sessionDir);
    if (!folderName.startsWith('local_')) return;

    const sessionId = folderName.replace(/^local_/, '');
    const metaFile = path.join(path.dirname(sessionDir), folderName + '.json');

    const [metaExists, transcripts] = await Promise.all([
      fileExists(metaFile),
      collectTranscripts(sessionDir),
    ]);

    let meta: SessionMeta | null = null;
    if (metaExists) {
      try {
        const raw = await fs.readFile(metaFile, 'utf8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        meta = extractSessionMeta(parsed);
      } catch {
        meta = null; // unparseable meta is a downstream-filterable condition
      }
    }

    discoveries.push({
      sessionId,
      sessionFolder: sessionDir,
      metaFile: metaExists ? metaFile : null,
      meta,
      transcripts,
    });
  });

  return discoveries;
}

/**
 * Recursively walk `root` to depth `maxDepth`, invoking `onDir` for every
 * directory encountered. Stops descending into any `local_*` directory
 * because their contents (.claude/, agent/, etc.) are handled by separate
 * collectors.
 */
async function walkForSessionFolders(
  root: string,
  depth: number,
  maxDepth: number,
  onDir: (dir: string) => Promise<void>
): Promise<void> {
  if (depth > maxDepth) return;

  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (err) {
    process.stderr.write(
      `[discovery] could not read ${root}: ${(err as Error).message}\n`
    );
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const full = path.join(root, entry.name);

    if (entry.name.startsWith('local_')) {
      await onDir(full);
      continue; // do not recurse into the session itself
    }

    await walkForSessionFolders(full, depth + 1, maxDepth, onDir);
  }
}

/**
 * For a given `local_<id>/` session folder, find all `.jsonl` transcript
 * files anywhere underneath, classify each as parent / subagent /
 * acompact, and pull the slug from the `-sessions-<slug>` parent directory.
 *
 * Audit-log files (`audit.jsonl`) at the session root are excluded — they're
 * runtime logs, not conversation transcripts.
 */
async function collectTranscripts(sessionDir: string): Promise<TranscriptFile[]> {
  const results: TranscriptFile[] = [];
  await walkAllJsonl(sessionDir, (filePath) => {
    if (path.basename(filePath) === 'audit.jsonl') return;
    if (!filePath.includes('/projects/')) return;

    const filename = path.basename(filePath);
    const isSubagent = filePath.includes('/subagents/');
    const isAcompact = filename.startsWith('agent-acompact-');

    // The slug is in the parent or grandparent directory:
    //   .../-sessions-<slug>/<uuid>.jsonl                  → parent
    //   .../-sessions-<slug>/<uuid>/subagents/agent-*.jsonl → grandparent
    let slug = '';
    const parts = filePath.split(path.sep);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (p !== undefined && p.startsWith('-sessions-')) {
        slug = p.replace(/^-sessions-/, '');
        break;
      }
    }

    results.push({
      path: filePath,
      slug,
      isSubagent,
      isAcompact,
    });
  });
  return results;
}

async function walkAllJsonl(
  root: string,
  onFile: (filePath: string) => void
): Promise<void> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      await walkAllJsonl(full, onFile);
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      onFile(full);
    }
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pull the few meta fields the filter needs from a parsed JSON object.
 * Tolerant of missing fields and unexpected shapes — anything we can't
 * narrow safely is omitted (not defaulted) and the filter handles the
 * absence categorically.
 */
function extractSessionMeta(raw: Record<string, unknown>): SessionMeta {
  const meta: SessionMeta = {};
  const assign = (key: keyof SessionMeta, v: unknown): void => {
    if (typeof v === 'string') {
      (meta as Record<string, string>)[key] = v;
    }
  };

  assign('sessionId', raw['sessionId']);
  assign('title', raw['title']);
  assign('emailAddress', raw['emailAddress']);
  assign('accountName', raw['accountName']);
  assign('cwd', raw['cwd']);
  assign('createdAt', raw['createdAt']);
  assign('lastActivityAt', raw['lastActivityAt']);
  assign('initialMessage', raw['initialMessage']);
  assign('model', raw['model']);

  return meta;
}
