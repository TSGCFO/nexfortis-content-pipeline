/**
 * Estimate the wall-clock duration of a captured conversation from its
 * token count.
 *
 * Heuristic per PRD §4.3: `Math.max(1, Math.round(tokenCount / 1000 * 8))`.
 * Equivalently, "1000 tokens ≈ 8 minutes", rounded to the nearest minute,
 * clamped to a 1-minute minimum so we never render "0 minutes" in a
 * confirmation message.
 *
 * The function is pure — it does not consult the clock or any DB. Callers
 * pass the `tokenCount` field straight from `capture_signals.tokenCount`
 * (nullable integer column).
 */

export function estimateDurationMinutes(tokenCount: number | null): number {
  if (tokenCount === null || tokenCount <= 0) {
    return 1;
  }
  const raw = (tokenCount / 1000) * 8;
  return Math.max(1, Math.round(raw));
}
