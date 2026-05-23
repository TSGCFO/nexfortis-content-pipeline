/**
 * Internal types used across the exporter's discovery / filter / parse /
 * stitch / audit modules. These are NOT part of the emitted JSON schema
 * (that's `schema.ts`).
 */

import type { Event } from './schema.js';
import type { PostCheckDecision } from './post-check.js';

/**
 * Result of walking a single `local_<uuid>/` session folder on disk.
 */
export interface SessionDiscovery {
  /** The Cowork session-folder id (the part after `local_`). */
  sessionId: string;
  /** Absolute path to the `local_<uuid>` directory. */
  sessionFolder: string;
  /** Absolute path to the sibling `local_<uuid>.json` meta file, if present. */
  metaFile: string | null;
  /** Parsed meta JSON contents if the file exists and parsed. */
  meta: SessionMeta | null;
  /** Transcript files found anywhere under this session folder. */
  transcripts: TranscriptFile[];
}

/**
 * Fields we read from the Cowork session meta JSON sidecar. The real sidecar
 * has many more fields; we only pull what session-level filtering needs.
 */
export interface SessionMeta {
  sessionId?: string;
  title?: string;
  emailAddress?: string;
  accountName?: string;
  cwd?: string;
  /**
   * ISO 8601 UTC ms timestamp. Cowork's raw meta JSON stores createdAt as a
   * **number** (epoch ms). The discovery layer converts it to ISO so callers
   * downstream don't need to think about format. Absent if not in source meta.
   */
  createdAt?: string;
  /**
   * ISO 8601 UTC ms timestamp of the last activity on the session. Same
   * format-normalization as createdAt — Cowork stores it as epoch ms, we
   * convert. Absent if not in source meta.
   */
  lastActivityAt?: string;
  initialMessage?: string;
  model?: string;
  /**
   * Names of the remote MCP servers that were configured for this session.
   * Cowork's raw meta JSON has these under `remoteMcpServersConfig` as an
   * array of { uuid, name, tools: [...] } objects; the discovery layer
   * extracts just the `name` field from each. Absent if the source meta
   * has no `remoteMcpServersConfig` entry or it was empty.
   */
  mcpServers?: readonly string[];
}

export interface TranscriptFile {
  /** Absolute path to the .jsonl. */
  path: string;
  /** Slug extracted from `-sessions-<slug>` parent folder name. */
  slug: string;
  /** True if this file is a subagent transcript (lives in a `subagents/` subfolder). */
  isSubagent: boolean;
  /** True if filename begins with `agent-acompact-*` — auto-compaction snapshot, always dropped. */
  isAcompact: boolean;
}

/**
 * The decision produced by session-level filtering for one `SessionDiscovery`.
 */
export type FilterDecision =
  | { keep: true; reason: 'passed_session_level_filters' }
  | { keep: false; reason: SessionDropReason; detail?: string };

export type SessionDropReason =
  | 'family_law_slug'                    // slug matched the family-law blocklist
  | 'scheduled_task'                      // initialMessage starts with `<scheduled-task`
  | 'command_message'                     // initialMessage starts with `<command-message`
  | 'system_path_cwd'                     // initialMessage starts with `<system-path-cwd`
  | 'cwd_always_denied'                   // initial cwd starts with an `alwaysDeny` prefix
  | 'cwd_not_allowed'                     // initial cwd doesn't match any allow prefix and isn't sandbox
  | 'meta_missing'                        // no meta JSON sidecar — cannot filter safely
  | 'no_transcripts'                      // walker found no parent transcripts
  | 'tiny_session'                        // post-filter: <3 events or <500 chars text
  | 'cwd_majority_outside_allowlist';     // post-filter: <80% of text chars in allowed cwds

export interface ExporterConfig {
  cwdAllowlist: {
    alwaysAllow: readonly string[];
    allowPrefixes: readonly string[];
    alwaysDeny: readonly string[];
  };
  familyLawSlugs: readonly string[];
}

export interface AuditRow {
  sessionId: string;
  slug: string | null;
  account: string | null;
  decision: FilterDecision;
}

/**
 * One parsed parent transcript, ready to be serialized as a single JSON output
 * file by slice 5. A `ParsedSession` carries one or more of these — exactly
 * one for non-continuation sessions, multiple for sessions whose conversation
 * spans auto-continuation chains.
 *
 * `transcriptId` (not the session-folder id) becomes the emitted JSON's
 * `sessionId`. The schema's `workspaceId` carries the top-level Cowork
 * workspace UUID separately.
 */
export interface ParsedTranscript {
  /** UUID from the .jsonl filename. Becomes the emitted document's `sessionId`. */
  transcriptId: string;
  /** Absolute path to the source .jsonl on disk. */
  sourceFile: string;
  /** Events after per-event filtering, subagent stitching, and scaffold strip. */
  events: Event[];
  /**
   * Stable per-chain hash, set only on transcripts that are CONTINUATIONS of
   * an earlier transcript in the same chain.
   *
   * Computed as
   *   sha256("v1|" + sessionSlug + "|" + originalFirstUserMessage.trim().slice(0, 200))
   * where `originalFirstUserMessage` is the first user_text of the ORIGINAL
   * transcript in the chain (the one whose `scaffoldStripped === false`).
   *
   * All continuations in a chain share the SAME `continuationGroupId`. The
   * original transcript does NOT carry this field — the presence of the field
   * is the "I am a continuation of something" signal, and the original is by
   * definition not a continuation of anything.
   *
   * Standalone transcripts (sessions with only one parent .jsonl in the slug
   * folder) also do not carry this field. Absence has two meanings, both
   * benign: "this is the original of a chain" OR "this is a standalone".
   *
   * Semantics changed after Hassan's production runs 1-3 surfaced 3-of-4
   * hash collisions within a single chain. See CHANGELOG entry "data-contract
   * fixes" for the rationale.
   */
  continuationGroupId?: string;
  /** True if a scaffold message ("This session is being continued from...") was found and stripped from the start of the transcript. */
  scaffoldStripped: boolean;
  parseStats: {
    linesRead: number;
    linesFailed: number;
    abandoned: boolean;
  };
}

/**
 * One parsed Cowork session, ready (after post-check) to be serialized as
 * one-or-more JSON output files by slice 5.
 *
 * **Slice 5 emit-loop must filter on `postCheck.keep`** — sessions in this
 * list that failed post-check are present here for audit-reporting purposes
 * but MUST NOT have their transcripts written to disk. The audit row already
 * surfaces the drop reason; emitting their JSON would defeat the post-filter.
 */
export interface ParsedSession {
  discovery: SessionDiscovery;
  /** Always `keep: true` for sessions present in the parsed-session list. */
  sessionDecision: FilterDecision;
  /** One per parent transcript. Standalone sessions: 1. Continuations: 2+. */
  transcripts: ParsedTranscript[];
  /** Aggregated post-check across ALL transcripts' events combined. */
  postCheck: PostCheckDecision;
}
