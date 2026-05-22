/**
 * Slice-2 orchestrator: discover all sessions under an input root, apply
 * session-level filters, return audit rows + summary. Does not parse
 * transcripts or write any output JSON — that comes in slices 3-5.
 */

import { discoverSessions } from './discovery.js';
import { filterSession } from './filter-session.js';
import { buildAuditRows, summarize } from './audit.js';
import type { AuditRow, ExporterConfig } from './types.js';
import type { AuditSummary } from './audit.js';

export interface RunDiscoveryOptions {
  inputRoot: string;
  config: ExporterConfig;
}

export interface RunDiscoveryResult {
  rows: AuditRow[];
  summary: AuditSummary;
}

export async function runDiscovery(
  options: RunDiscoveryOptions
): Promise<RunDiscoveryResult> {
  const discoveries = await discoverSessions(options.inputRoot);

  const raw = discoveries.map((d) => {
    const decision = filterSession(d, options.config);
    const slug = pickSlug(d);
    return {
      sessionId: d.sessionId,
      slug,
      account: d.meta?.emailAddress ?? null,
      decision,
    };
  });

  return {
    rows: buildAuditRows(raw),
    summary: summarize(raw),
  };
}

function pickSlug(d: { transcripts: { slug: string; isSubagent: boolean; isAcompact: boolean }[] }): string | null {
  for (const t of d.transcripts) {
    if (!t.isSubagent && !t.isAcompact && t.slug) return t.slug;
  }
  return null;
}
