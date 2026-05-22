/**
 * Internal types used across the exporter's discovery / filter / audit
 * modules. These are NOT part of the emitted JSON schema (that's `schema.ts`).
 */

/**
 * Result of walking a single `local_<uuid>/` session folder on disk.
 *
 * The walker reports what it FOUND, not what should be kept. Filters run
 * downstream against `SessionDiscovery` records to produce `FilterDecision`s.
 */
export interface SessionDiscovery {
  /** The Cowork session id (UUID). Same as the directory suffix `local_<id>`. */
  sessionId: string;

  /** Absolute path to the `local_<uuid>` directory. */
  sessionFolder: string;

  /**
   * Absolute path to the sibling `local_<uuid>.json` meta file, if present.
   * The walker may report a session whose meta is missing — that's a
   * filterable condition, not a hard error.
   */
  metaFile: string | null;

  /**
   * Parsed meta JSON contents if the file exists and parsed. `null` when the
   * file is missing or unparseable.
   */
  meta: SessionMeta | null;

  /**
   * Primary transcript .jsonl file(s) for this session, if found. Most sessions
   * have exactly one. Auto-continuation chains may have multiple (each gets
   * its own filter decision later).
   */
  transcripts: TranscriptFile[];
}

/**
 * Fields we read from the Cowork session meta JSON sidecar. Cowork's actual
 * sidecar has many more fields (system prompt, MCP server config, etc.); we
 * only pull what session-level filtering needs.
 *
 * All fields are optional because the meta sidecar can legitimately be
 * incomplete (e.g. an interrupted session).
 */
export interface SessionMeta {
  sessionId?: string;
  /** Session title — Cowork's auto-generated label. */
  title?: string;
  /** Account email associated with the session (account-allowlist target). */
  emailAddress?: string;
  /** Display name on the account. */
  accountName?: string;
  /** Initial working directory at session start (cwd allowlist pre-check target). */
  cwd?: string;
  /** ISO timestamp when the session was created. */
  createdAt?: string;
  /** ISO timestamp of last activity. */
  lastActivityAt?: string;
  /** Cowork-injected initial message — `<scheduled-task>` / `<command-message>` / etc. */
  initialMessage?: string;
  /** Model identifier. */
  model?: string;
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
 *
 * Discriminated on `keep`. When `keep === true` the session proceeds to
 * per-event filtering in slice 3+. When `keep === false` it's dropped with
 * a categorical reason for the audit log.
 */
export type FilterDecision =
  | { keep: true; reason: 'passed_session_level_filters' }
  | { keep: false; reason: SessionDropReason; detail?: string };

export type SessionDropReason =
  | 'family_law_slug'                    // slug matched the family-law blocklist
  | 'scheduled_task'                      // initialMessage starts with `<scheduled-task`
  | 'command_message'                     // initialMessage starts with `<command-message`
  | 'system_path_cwd'                     // initialMessage starts with `<system-path-cwd`
  | 'account_not_allowlisted'             // emailAddress not in account allowlist
  | 'cwd_always_denied'                   // initial cwd starts with an `alwaysDeny` prefix
  | 'cwd_not_allowed'                     // initial cwd doesn't match any allow prefix and isn't sandbox
  | 'meta_missing'                        // no meta JSON sidecar — cannot filter safely
  | 'no_transcripts'                      // walker found no parent transcripts
  | 'tiny_session'                        // post-filter: <3 events or <500 chars text
  | 'cwd_majority_outside_allowlist';     // post-filter: <80% of text chars in allowed cwds

/**
 * Resolved configuration for a single exporter run. Loaded from the three
 * config files (cwd-allowlist, family-law-slugs, account-allowlist) and
 * passed by reference into every filter call.
 */
export interface ExporterConfig {
  cwdAllowlist: {
    alwaysAllow: readonly string[];
    allowPrefixes: readonly string[];
    alwaysDeny: readonly string[];
  };
  familyLawSlugs: readonly string[];
  accountAllowlist: readonly string[];
}

/**
 * A single row in the dry-run / audit decision table. One per session.
 */
export interface AuditRow {
  sessionId: string;
  slug: string | null;
  account: string | null;
  decision: FilterDecision;
}
