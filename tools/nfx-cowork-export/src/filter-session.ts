/**
 * Apply session-level filters to a `SessionDiscovery` record, producing a
 * `FilterDecision`.
 *
 * Filters are evaluated in this order, returning the first matching drop
 * reason. Order matters for the audit log — we want the most specific
 * reason (family-law) reported when multiple would otherwise apply.
 *
 *   1. Family-law slug blocklist  (most specific, highest priority)
 *   2. `<scheduled-task>` initialMessage
 *   3. `<command-message>` initialMessage
 *   4. `<system-path-cwd>` initialMessage
 *   5. Account allowlist          (per-account opt-in)
 *   6. cwd allowlist pre-check    (alwaysDeny, then alwaysAllow / allowPrefixes)
 *   7. No parent transcripts found (walker found nothing usable)
 *   8. Meta JSON missing          (cannot filter safely)
 *
 * The keep decision means "this session survives session-level filtering";
 * per-event filtering (slice 3) and the post-filter tiny-session / cwd-
 * majority checks happen separately.
 *
 * Each session has ONE primary parent transcript for filtering purposes.
 * If multiple parents exist (auto-continuations), the slug is the same
 * for all; we filter once based on the first non-acompact non-subagent file.
 */

import { checkSlugBlocklist } from '@ncp/redaction';

import type {
  ExporterConfig,
  FilterDecision,
  SessionDiscovery,
  TranscriptFile,
} from './types.js';

export function filterSession(
  discovery: SessionDiscovery,
  config: ExporterConfig
): FilterDecision {
  // The walker may have found a session folder but no usable transcripts.
  const parents = discovery.transcripts.filter((t) => !t.isSubagent && !t.isAcompact);
  if (parents.length === 0) {
    return { keep: false, reason: 'no_transcripts' };
  }

  // Slug from the first parent transcript. All parents in a session share a
  // slug (auto-continuations live under the same `-sessions-<slug>` directory).
  const slug = pickPrimarySlug(parents);

  // 1. Family-law slug check — runs first because it's the most sensitive.
  if (slug) {
    const slugResult = checkSlugBlocklist(slug, {
      blocklistedSlugs: config.familyLawSlugs,
    });
    if (slugResult.blocked) {
      // Detail carries the SHA-256 hash of the slug, NOT the slug itself,
      // so the audit log stays safe.
      return {
        keep: false,
        reason: 'family_law_slug',
        detail: slugResult.matchedHash ?? 'unknown-hash',
      };
    }
  }

  const meta = discovery.meta;

  // 2-4. initialMessage prefix filters — automated runs, not Hassan-typed content.
  const im = meta?.initialMessage ?? '';
  if (im.startsWith('<scheduled-task')) {
    return { keep: false, reason: 'scheduled_task' };
  }
  if (im.startsWith('<command-message')) {
    return { keep: false, reason: 'command_message' };
  }
  if (im.startsWith('<system-path-cwd')) {
    return { keep: false, reason: 'system_path_cwd' };
  }

  // We need meta to do the cwd pre-check. If meta is missing, drop —
  // we cannot reason about cwd without it, and proceeding without would
  // violate the fail-closed posture.
  if (!meta) {
    return { keep: false, reason: 'meta_missing' };
  }

  // (Removed: account-allowlist filter. Every Cowork session folder on
  // the user's laptop is theirs by definition — the user owns the disk.
  // Old behavior dropped sessions whose meta.emailAddress wasn't in an
  // allowlist, which caused legitimate sessions under a now-defunct
  // account to be excluded. meta.emailAddress is still preserved in the
  // emitted JSON's `account` field for the ingester to use as metadata.)

  // 5. cwd pre-check — based on the initial cwd from meta.
  //
  // Three-bucket model:
  //   - alwaysDeny:  if cwd starts with any of these, drop (overrides everything)
  //   - alwaysAllow: if cwd starts with any of these, keep
  //   - allowPrefixes: if cwd starts with any, keep
  //   - otherwise: drop (allowlist is exhaustive)
  //
  // Path normalization is Windows-aware: case-insensitive on Windows, and
  // slash/backslash treated as equivalent.
  const cwd = meta.cwd ?? '';
  if (cwd) {
    if (matchesAnyPrefix(cwd, config.cwdAllowlist.alwaysDeny)) {
      return { keep: false, reason: 'cwd_always_denied', detail: cwd };
    }
    const allowed =
      matchesAnyPrefix(cwd, config.cwdAllowlist.alwaysAllow) ||
      matchesAnyPrefix(cwd, config.cwdAllowlist.allowPrefixes);
    if (!allowed) {
      return { keep: false, reason: 'cwd_not_allowed', detail: cwd };
    }
  }

  return { keep: true, reason: 'passed_session_level_filters' };
}

function pickPrimarySlug(parents: TranscriptFile[]): string {
  for (const p of parents) {
    if (p.slug) return p.slug;
  }
  return '';
}

/**
 * Returns true if `value` starts with any of the given prefixes after path
 * normalization. Windows-aware: case-insensitive, slash/backslash agnostic,
 * trailing-slash agnostic.
 */
export function matchesAnyPrefix(value: string, prefixes: readonly string[]): boolean {
  const normValue = normalizePath(value);
  return prefixes.some((p) => {
    const normPrefix = normalizePath(p);
    return normPrefix.length > 0 && normValue.startsWith(normPrefix);
  });
}

function normalizePath(p: string): string {
  // Lowercase (Windows is case-insensitive; on POSIX it doesn't hurt for our
  // matching purposes since the values we compare are user-controlled config).
  // Replace backslashes with forward slashes, then collapse repeats and trim
  // any trailing slash.
  let out = p.toLowerCase().replace(/\\/g, '/');
  while (out.includes('//')) out = out.replace(/\/\//g, '/');
  if (out.length > 1 && out.endsWith('/')) out = out.slice(0, -1);
  return out;
}
