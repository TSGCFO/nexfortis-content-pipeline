/**
 * Heuristic per PRD §4.3: estimate conversation duration in minutes from a
 * Claude/Perplexity token count.
 *
 * Mapping: roughly 1,000 tokens ≈ 8 minutes. The result is floored at 1 so
 * that vanishingly small or unknown captures still render as `"about 1 min"`
 * in the confirmation message rather than `"0 min"`, which would be jarring.
 *
 * Pure, deterministic, no I/O.
 */

export function estimateDurationMinutes(tokenCount: number | null): number {
  if (tokenCount === null || tokenCount <= 0) {
    return 1;
  }
  return Math.max(1, Math.round((tokenCount / 1000) * 8));
}
