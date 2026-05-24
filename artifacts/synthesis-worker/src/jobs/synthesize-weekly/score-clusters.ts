/**
 * Pure scoring function for classified clusters.
 *
 *   score = signalCount * 1.0 + recencyWeight * 1.0
 *
 * where `recencyWeight = max(0, 30 - avgAgeDays) / 30` — a value in [0, 1]
 * where newer clusters score higher. Pillar coverage is already enforced
 * by the upstream classifier (off-pillar clusters never reach this step).
 *
 * Ties are broken deterministically by the smallest signal-UUID (ASCII sort)
 * so reruns produce the same ranking.
 */

import type { ClassifiedCluster, ScoredCluster } from './types.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RECENCY_WINDOW_DAYS = 30;

export function scoreClusters(
  clusters: ClassifiedCluster[],
  now: Date,
): ScoredCluster[] {
  const nowMs = now.getTime();
  const scored: ScoredCluster[] = clusters.map((c) => {
    const memberCount = c.members.length || 1;
    let totalAgeDays = 0;
    for (const m of c.members) {
      const ageDays = (nowMs - m.capturedAt.getTime()) / MS_PER_DAY;
      totalAgeDays += ageDays;
    }
    const avgAgeDays = totalAgeDays / memberCount;
    const recencyWeight = Math.max(
      0,
      RECENCY_WINDOW_DAYS - avgAgeDays,
    ) / RECENCY_WINDOW_DAYS;
    const score = c.signalIds.length * 1.0 + recencyWeight * 1.0;
    return { ...c, score };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-break: smallest signal-UUID ascending. Compute the min-id per
    // cluster on the fly; cluster sizes are tiny so this is negligible.
    const minA = minSignalId(a.signalIds);
    const minB = minSignalId(b.signalIds);
    if (minA < minB) return -1;
    if (minA > minB) return 1;
    return 0;
  });

  return scored;
}

function minSignalId(ids: readonly string[]): string {
  let min = ids[0] ?? '';
  for (let i = 1; i < ids.length; i++) {
    const v = ids[i];
    if (v !== undefined && v < min) min = v;
  }
  return min;
}
