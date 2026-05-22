/**
 * Post-filter checks applied AFTER per-event filtering.
 *
 * Two rules, both from the locked spec:
 *
 *   1. **Tiny-session check.** Drop sessions where the final events array
 *      has fewer than 3 events OR fewer than 500 chars of `user_text` +
 *      `assistant_text` text combined. Catches the "hey" / "init" / "ok"
 *      shells without privileging Hassan's typing volume over what the
 *      session actually produced.
 *
 *   2. **Cwd majority check.** Of events that carry a `cwd` field, what
 *      fraction (by text character count, not raw event count) live in an
 *      allowlisted cwd? If ≥80%, keep. Below 80%, drop — too much of the
 *      session happened outside Hassan's pillar-work folders.
 *
 *      Tool-call events do NOT contribute to either numerator or
 *      denominator — they have a `cwd` but no `text`. The spec explicitly
 *      excludes them ("not raw event count — tool_call events would skew
 *      it").
 *
 *      Events without a `cwd` field are ignored in both numerator and
 *      denominator. The session-level cwd pre-check already happened in
 *      slice 2 against the meta JSON's initial cwd.
 *
 *      Edge case: if NO text events carry a cwd, we cannot compute a
 *      ratio. We trust the session-level pre-check and keep.
 */

import { matchesAnyPrefix } from './filter-session.js';
import type { Event } from './schema.js';
import type { ExporterConfig } from './types.js';

export type PostCheckDecision =
  | { keep: true; reason: 'passed_post_checks'; stats: PostCheckStats }
  | { keep: false; reason: 'tiny_session'; stats: PostCheckStats }
  | { keep: false; reason: 'cwd_majority_outside_allowlist'; stats: PostCheckStats };

export interface PostCheckStats {
  /** Number of events in the final array (after per-event filtering, before post-check). */
  eventCount: number;
  /** Sum of `text` chars across all user_text + assistant_text events. */
  totalTextChars: number;
  /** Sum of `text` chars among text events whose cwd is in the allowlist. */
  allowedTextChars: number;
  /** Sum of `text` chars among text events whose cwd is OUTSIDE the allowlist. */
  deniedTextChars: number;
  /** Sum of `text` chars among text events with no cwd field. Not counted in numerator or denominator. */
  noCwdTextChars: number;
  /**
   * `allowedTextChars / (allowedTextChars + deniedTextChars)`. NaN when both
   * are zero (no cwd evidence available).
   */
  cwdAllowedRatio: number;
}

/** Minimum kept events to clear the tiny-session check. */
export const MIN_EVENTS = 3;
/** Minimum total text chars to clear the tiny-session check. */
export const MIN_TEXT_CHARS = 500;
/** Minimum fraction of text-event chars that must be in allowlisted cwds. */
export const MIN_CWD_ALLOWED_RATIO = 0.8;

/**
 * Apply the two post-filter checks against the events emitted for one session.
 * Returns a `PostCheckDecision` carrying the keep/drop decision plus the
 * stats that drove it (useful for the audit log).
 */
export function postCheckSession(
  events: readonly Event[],
  config: ExporterConfig
): PostCheckDecision {
  const stats = computeStats(events, config);

  if (
    stats.eventCount < MIN_EVENTS ||
    stats.totalTextChars < MIN_TEXT_CHARS
  ) {
    return { keep: false, reason: 'tiny_session', stats };
  }

  // If no text event has a cwd we can verify, trust the session-level
  // pre-check and keep.
  if (stats.allowedTextChars + stats.deniedTextChars === 0) {
    return { keep: true, reason: 'passed_post_checks', stats };
  }

  if (stats.cwdAllowedRatio < MIN_CWD_ALLOWED_RATIO) {
    return { keep: false, reason: 'cwd_majority_outside_allowlist', stats };
  }

  return { keep: true, reason: 'passed_post_checks', stats };
}

function computeStats(events: readonly Event[], config: ExporterConfig): PostCheckStats {
  const allowPrefixes = [
    ...config.cwdAllowlist.alwaysAllow,
    ...config.cwdAllowlist.allowPrefixes,
  ];
  const denyPrefixes = config.cwdAllowlist.alwaysDeny;

  let totalTextChars = 0;
  let allowedTextChars = 0;
  let deniedTextChars = 0;
  let noCwdTextChars = 0;

  for (const e of events) {
    // Tool-call and subagent events don't contribute to the text-char count.
    if (e.kind !== 'user_text' && e.kind !== 'assistant_text') continue;

    const len = e.text.length;
    totalTextChars += len;

    if (e.cwd === undefined) {
      noCwdTextChars += len;
      continue;
    }

    if (matchesAnyPrefix(e.cwd, denyPrefixes)) {
      deniedTextChars += len;
      continue;
    }

    if (matchesAnyPrefix(e.cwd, allowPrefixes)) {
      allowedTextChars += len;
    } else {
      deniedTextChars += len;
    }
  }

  const cwdAllowedRatio =
    allowedTextChars + deniedTextChars === 0
      ? Number.NaN
      : allowedTextChars / (allowedTextChars + deniedTextChars);

  return {
    eventCount: events.length,
    totalTextChars,
    allowedTextChars,
    deniedTextChars,
    noCwdTextChars,
    cwdAllowedRatio,
  };
}
