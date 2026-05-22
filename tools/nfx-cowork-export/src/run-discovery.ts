/**
 * Orchestrator: discover all sessions under an input root, apply session-level
 * filters, parse each kept session's parent transcripts, apply post-filter
 * checks, return audit rows + summary + per-session event counts.
 *
 * Does NOT write any JSON to disk — that's slice 5. The orchestrator builds
 * the in-memory representation that slice 5 will serialize.
 */

import { discoverSessions } from './discovery.js';
import { filterSession } from './filter-session.js';
import { parseTranscript } from './parser.js';
import { postCheckSession } from './post-check.js';
import { buildAuditRows, summarize } from './audit.js';
import type {
  AuditRow,
  ExporterConfig,
  FilterDecision,
  SessionDiscovery,
} from './types.js';
import type { AuditSummary } from './audit.js';
import type { Event } from './schema.js';
import type { PostCheckDecision } from './post-check.js';

export interface RunDiscoveryOptions {
  inputRoot: string;
  config: ExporterConfig;
}

export interface RunDiscoveryResult {
  rows: AuditRow[];
  summary: AuditSummary;
  parsedSessions: ParsedSession[];
}

/**
 * Per-session output bundle, ready to be serialized by slice 5.
 * Sessions dropped by session-level filtering are absent from this list.
 */
export interface ParsedSession {
  discovery: SessionDiscovery;
  sessionDecision: FilterDecision; // always keep: true when present in parsedSessions
  events: Event[];
  postCheck: PostCheckDecision;
  parseStats: {
    transcriptCount: number;
    totalLinesRead: number;
    totalLinesFailed: number;
    abandonedTranscripts: number;
  };
}

export async function runDiscovery(
  options: RunDiscoveryOptions
): Promise<RunDiscoveryResult> {
  const discoveries = await discoverSessions(options.inputRoot);
  const auditInputs: { sessionId: string; slug: string | null; account: string | null; decision: FilterDecision }[] = [];
  const parsedSessions: ParsedSession[] = [];

  for (const d of discoveries) {
    const sessionDecision = filterSession(d, options.config);
    const slug = primarySlug(d);

    if (!sessionDecision.keep) {
      auditInputs.push({
        sessionId: d.sessionId,
        slug,
        account: d.meta?.emailAddress ?? null,
        decision: sessionDecision,
      });
      continue;
    }

    // Session passed session-level filter — parse parent transcripts.
    const parents = d.transcripts.filter((t) => !t.isSubagent && !t.isAcompact);
    const events: Event[] = [];
    let totalLinesRead = 0;
    let totalLinesFailed = 0;
    let abandonedTranscripts = 0;

    for (const t of parents) {
      const result = await parseTranscript(t.path);
      events.push(...result.events);
      totalLinesRead += result.linesRead;
      totalLinesFailed += result.linesFailedToParse;
      if (result.abandoned) abandonedTranscripts++;
    }

    const postCheck = postCheckSession(events, options.config);
    parsedSessions.push({
      discovery: d,
      sessionDecision,
      events,
      postCheck,
      parseStats: {
        transcriptCount: parents.length,
        totalLinesRead,
        totalLinesFailed,
        abandonedTranscripts,
      },
    });

    // Folded into the audit table — if post-check dropped, the audit row
    // reflects the post-check reason; otherwise the session shows as kept.
    auditInputs.push({
      sessionId: d.sessionId,
      slug,
      account: d.meta?.emailAddress ?? null,
      decision: postCheck.keep
        ? sessionDecision
        : { keep: false, reason: postCheck.reason as 'tiny_session' | 'cwd_majority_outside_allowlist' },
    });
  }

  return {
    rows: buildAuditRows(auditInputs),
    summary: summarize(auditInputs),
    parsedSessions,
  };
}

function primarySlug(d: SessionDiscovery): string | null {
  for (const t of d.transcripts) {
    if (!t.isSubagent && !t.isAcompact && t.slug) return t.slug;
  }
  return null;
}
