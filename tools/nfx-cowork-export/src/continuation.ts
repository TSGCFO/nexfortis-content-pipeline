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
 *    parent transcript are continuation chains. EVERY transcript in the
 *    chain — original included — gets the SAME `continuationGroupId`: a
 *    stable hash over the slug + first user message of the ORIGINAL
 *    transcript (the one without a scaffold). The ingester groups chains
 *    by this single field.
 *
 * 3. Standalone sessions (one parent transcript in the slug folder) do NOT
 *    get a `continuationGroupId`. Absence of the field unambiguously means
 *    "this is a standalone session, not part of any chain".
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
 * Compute the stable continuation-group hash for a chain.
 *
 * Formula (locked in v1 — see CHANGELOG):
 *   sha256("v1|" + slug + "|" + originalFirstUserMessage.trim().slice(0, 200))
 *
 * `originalFirstUserMessage` is the first user_text of the ORIGINAL transcript
 * in the chain (the one whose `scaffoldStripped === false`). The same value
 * is then assigned to EVERY transcript in the chain, original included —
 * see `assignContinuationGroupIds` for the assignment logic.
 *
 * The "v1|" prefix is intentional so a future formula change doesn't collide
 * with v1 hashes. The 200-char slice keeps the hash stable even when the
 * first user message is long.
 *
 * This function is pure — it just hashes inputs. The orchestrator
 * (run-discovery.ts) is responsible for identifying the original, picking
 * its first user message, and propagating the result to every transcript.
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


/**
 * Apply the chain-groupId rule to a list of transcripts (mutates in place).
 *
 * Per the locked spec in brief.md: every transcript in an auto-continuation
 * chain gets a `continuationGroupId` — INCLUDING the original. The shared
 * value is a stable hash of (slug + first-real-user-message-of-the-original).
 *
 * Rule:
 *   - If transcripts.length < 2, do nothing (standalone session, no chain).
 *   - Otherwise find the ORIGINAL (the unique transcript whose
 *     scaffoldStripped === false) and compute a shared hash from its first
 *     user message.
 *   - Assign that shared hash to EVERY transcript in the array, including
 *     the original.
 *   - If no original is found (degenerate case — all transcripts had a
 *     scaffold), nothing is assigned at all. Better to lose the metadata
 *     than to hash a continuation's scaffold-stripped first message as if
 *     it were the original's.
 *
 * Why every transcript (including the original) shares the field: the
 * ingester groups chains by `continuationGroupId` in a single operation.
 * If the original carried no groupId, the ingester would have to do
 * two-pass logic (find continuations by groupId, then find the original by
 * slug match with absent groupId) — fragile and ambiguous (absent groupId
 * could mean "original" OR "standalone"). With every chain member sharing
 * the field, absence is unambiguous: "this is a standalone session".
 *
 * Extracted from `run-discovery.ts` so it can be unit-tested without
 * setting up disk fixtures. The orchestrator just calls this once per
 * session.
 */
export function assignContinuationGroupIds(
  transcripts: ReadonlyArray<{
    events: readonly Event[];
    scaffoldStripped: boolean;
    continuationGroupId?: string;
  }>,
  slug: string,
): void {
  if (transcripts.length < 2 || slug.length === 0) return;
  const original = transcripts.find((t) => !t.scaffoldStripped);
  if (!original) return;
  const head = firstUserText(original.events);
  if (head.length === 0) return;
  const sharedGroupId = computeContinuationGroupId(slug, head);
  // Assign to every transcript in the chain, original included.
  for (const t of transcripts) {
    (t as { continuationGroupId?: string }).continuationGroupId = sharedGroupId;
  }
}

