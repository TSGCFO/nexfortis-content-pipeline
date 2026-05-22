/**
 * Auto-continuation handling.
 *
 * Cowork (Claude Code) automatically continues a conversation when it runs out
 * of context — it spawns a new transcript file whose first user message reads
 * "This session is being continued from a previous conversation that ran out
 * of context." followed by a summary block.
 *
 * For ingestion purposes:
 *
 * 1. The scaffold message is bookkeeping, not Hassan's typing. We drop the
 *    first user_text event when it begins with the canonical prefix.
 *
 * 2. Sessions whose `-sessions-<slug>/` directory contains more than one
 *    parent transcript are continuation chains. Each transcript gets its own
 *    `continuationGroupId` — a stable hash over the slug + first user message
 *    AFTER scaffold strip — and the ingester groups them by `sessionSlug` +
 *    `createdAt` ordering.
 *
 * 3. Standalone sessions (one parent transcript in the slug folder) do NOT
 *    get a `continuationGroupId`. The presence of the field is itself the
 *    signal that this transcript was a continuation.
 */

import { createHash } from 'node:crypto';

import type { Event } from './schema.js';

export const SCAFFOLD_PREFIX =
  'This session is being continued from a previous conversation that ran out of context.';

export interface ScaffoldStripResult {
  /** Events with the scaffold user_text removed if present. */
  events: Event[];
  /** True if the first event was the scaffold and got removed. */
  stripped: boolean;
}

/**
 * If `events[0]` is a `user_text` event whose text begins with the canonical
 * continuation-scaffold prefix, return a copy of the array with that event
 * removed. Otherwise return the input unchanged.
 *
 * Matches by prefix (not exact text) because the scaffold is followed by a
 * variable-length summary block. Case-sensitive match against the canonical
 * prefix — the prefix wording is fixed.
 */
export function stripContinuationScaffold(events: readonly Event[]): ScaffoldStripResult {
  if (events.length === 0) {
    return { events: [], stripped: false };
  }
  const first = events[0]!;
  if (first.kind === 'user_text' && first.text.startsWith(SCAFFOLD_PREFIX)) {
    return { events: events.slice(1), stripped: true };
  }
  return { events: [...events], stripped: false };
}

/**
 * Compute the stable continuation-group hash for a transcript.
 *
 * Formula (locked in v1 — see CHANGELOG):
 *   sha256("v1|" + slug + "|" + firstUserMessageAfterScaffoldStrip.trim().slice(0, 200))
 *
 * The "v1|" prefix is intentional so a future formula change doesn't collide
 * with v1 hashes. The 200-char slice keeps the hash stable even when the
 * first user message is long.
 *
 * Caller is responsible for deciding whether to emit the field — typically
 * "compute and emit only when the transcript is part of a chain of size >= 2."
 */
export function computeContinuationGroupId(
  slug: string,
  firstUserMessageAfterScaffoldStrip: string
): string {
  const head = firstUserMessageAfterScaffoldStrip.trim().slice(0, 200);
  const input = `v1|${slug}|${head}`;
  return 'sha256:' + createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Convenience: pick the first `user_text` event's text from a filtered event
 * stream. Returns the empty string if no user_text event exists (the caller
 * should treat that as "no continuation group computable").
 */
export function firstUserText(events: readonly Event[]): string {
  for (const e of events) {
    if (e.kind === 'user_text') return e.text;
  }
  return '';
}
