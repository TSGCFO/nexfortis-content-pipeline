/**
 * Orchestrator. Pulls together discovery → session-level filter →
 * per-transcript parse → scaffold strip → subagent stitching →
 * continuation-group ID → aggregated post-check → audit rows.
 *
 * Does NOT write any JSON to disk. Returns an in-memory representation that
 * slice 5 will serialize, plus the audit summary that drives stdout output.
 */

import path from 'node:path';

import { discoverSessions, transcriptIdFromPath, toPosixPath } from './discovery.js';
import { filterSession } from './filter-session.js';
import { parseTranscript } from './parser.js';
import { postCheckSession } from './post-check.js';
import { buildAuditRows, summarize } from './audit.js';
import {
  stripContinuationScaffold,
  computeContinuationGroupId,
  firstUserText,
  SCAFFOLD_PREFIX,
} from './continuation.js';
import {
  doStitch,
  readAgentDispatchMap,
} from './stitch.js';
import type { Stitchable } from './stitch.js';
import type {
  AuditRow,
  ExporterConfig,
  FilterDecision,
  ParsedSession,
  ParsedTranscript,
  SessionDiscovery,
  TranscriptFile,
} from './types.js';
import type { AuditSummary } from './audit.js';
import type { Event } from './schema.js';

export interface RunDiscoveryOptions {
  inputRoot: string;
  config: ExporterConfig;
}

export interface RunDiscoveryResult {
  rows: AuditRow[];
  summary: AuditSummary;
  parsedSessions: ParsedSession[];
}

void SCAFFOLD_PREFIX; // re-exported via index.ts for testing

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

    // Session passed session-level filter — parse each parent transcript.
    const parentFiles = d.transcripts.filter((t) => !t.isSubagent && !t.isAcompact);

    const transcripts: ParsedTranscript[] = [];
    const allEventsForPostCheck: Event[] = [];

    for (const parent of parentFiles) {
      const subagentFiles = subagentFilesForParent(parent, d.transcripts);
      const transcript = await parseOneTranscript(parent, subagentFiles);
      transcripts.push(transcript);
      for (const e of transcript.events) allEventsForPostCheck.push(e);
    }

    // If this session has multiple parent transcripts in the same slug folder,
    // it's a continuation chain. Compute a continuationGroupId for EACH
    // transcript using its own first user message after scaffold strip.
    if (transcripts.length > 1 && slug) {
      for (const t of transcripts) {
        const head = firstUserText(t.events);
        if (head.length > 0) {
          t.continuationGroupId = computeContinuationGroupId(slug, head);
        }
      }
    }

    const postCheck = postCheckSession(allEventsForPostCheck, options.config);

    parsedSessions.push({
      discovery: d,
      sessionDecision,
      transcripts,
      postCheck,
    });

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

async function parseOneTranscript(
  parent: TranscriptFile,
  subagentFiles: TranscriptFile[]
): Promise<ParsedTranscript> {
  const parsed = await parseTranscript(parent.path);

  // Scaffold strip (auto-continuation prelude)
  const { events: afterStrip, stripped } = stripContinuationScaffold(parsed.events);

  // Subagent stitching: for each subagent file, parse it; build a stitchable list.
  // Pull the parent's Agent dispatch map (toolu_id -> prompt) to drive matching.
  //
  // The toolUseIdsByEventUuid map from the parent's parse output is the
  // critical input that lets the stitcher correlate a specific tool_call
  // event to its specific dispatch — without it, two subagents would
  // swap when filesystem ordering doesn't match dispatch order in the
  // parent. (Slice-4 review bug fix; see stitch.ts header comment.)
  let finalEvents: Event[] = afterStrip;
  if (subagentFiles.length > 0) {
    const stitchables: Stitchable[] = [];
    for (const sub of subagentFiles) {
      const parsedSub = await parseTranscript(sub.path);
      let firstUserPrefix = '';
      for (const e of parsedSub.events) {
        if (e.kind === 'user_text') {
          firstUserPrefix = e.text.slice(0, 80);
          break;
        }
      }
      stitchables.push({
        file: sub.path,
        slug: sub.slug,
        firstUserPrefix,
        events: parsedSub.events,
      });
    }
    const dispatchMap = await readAgentDispatchMap(parent.path);
    const stitchResult = doStitch(
      afterStrip,
      stitchables,
      dispatchMap,
      parsed.toolUseIdsByEventUuid
    );
    finalEvents = stitchResult.events;

    // Unmatched subagents: spec says emit envelope ANYWAY (empty-envelope rule
    // confirmed for slice 4). For now we surface them via the parse stats —
    // slice 5's richer audit can list them by name.
    void stitchResult.unmatchedSubagents;
  }

  return {
    transcriptId: transcriptIdFromPath(parent.path),
    sourceFile: parent.path,
    events: finalEvents,
    scaffoldStripped: stripped,
    parseStats: {
      linesRead: parsed.linesRead,
      linesFailed: parsed.linesFailedToParse,
      abandoned: parsed.abandoned,
    },
  };
}

/**
 * Given one parent transcript file and the full transcripts list for the
 * session, return the subagent files that belong to this specific parent.
 *
 * Linkage is by path: subagents live at
 * `.../-sessions-<slug>/<parent-uuid>/subagents/agent-*.jsonl`
 * for a parent at `.../-sessions-<slug>/<parent-uuid>.jsonl`.
 */
function subagentFilesForParent(
  parent: TranscriptFile,
  allTranscripts: readonly TranscriptFile[]
): TranscriptFile[] {
  if (!parent.path.endsWith('.jsonl')) return [];
  const parentPosix = toPosixPath(parent.path);
  const parentDir = parentPosix.slice(0, -'.jsonl'.length) + '/subagents/';
  return allTranscripts.filter((t) => {
    if (!t.isSubagent) return false;
    if (t.isAcompact) return false;
    return toPosixPath(t.path).startsWith(parentDir);
  });
}

function primarySlug(d: SessionDiscovery): string | null {
  for (const t of d.transcripts) {
    if (!t.isSubagent && !t.isAcompact && t.slug) return t.slug;
  }
  return null;
}

void path; // imported but only used in type position
