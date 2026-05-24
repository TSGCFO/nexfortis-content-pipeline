import { describe, expect, it, vi } from 'vitest';

import {
  clusterSignals,
  COSINE_THRESHOLD,
  NAIVE_HARD_LIMIT,
  NAIVE_WARN_THRESHOLD,
} from '../../../artifacts/synthesis-worker/src/jobs/synthesize-weekly/cluster.js';
import {
  CorpusTooLargeForNaiveClusteringError,
  EmbeddingDimensionMismatchError,
} from '../../../artifacts/synthesis-worker/src/jobs/synthesize-weekly/errors.js';
import type { SignalRow } from '../../../artifacts/synthesis-worker/src/jobs/synthesize-weekly/types.js';

function makeSignal(
  id: string,
  embedding: number[],
  capturedAt = new Date('2026-05-20T12:00:00Z'),
): SignalRow {
  return {
    id,
    capturedAt,
    redactedText: `text-${id}`,
    embedding: Float32Array.from(embedding),
  };
}

/**
 * Build a unit vector at angle θ in the (x, y) plane, embedded in a
 * 4-dim space. Cosine similarity between two such vectors is cos(θ_a - θ_b).
 */
function unitVecAtAngle(theta: number): number[] {
  return [Math.cos(theta), Math.sin(theta), 0, 0];
}

describe('clusterSignals', () => {
  it('transitively merges signals via union-find into one cluster of 4', () => {
    // Place 4 vectors at small angle steps so every consecutive pair has
    // cosine > 0.72 (the union-find performs transitive merging across
    // non-pairwise-similar combinations). Signal 4 is at a far angle.
    const dtheta = 0.4; // cos(0.4) ≈ 0.921 > 0.72
    const signals: SignalRow[] = [
      makeSignal('s0', unitVecAtAngle(0)),
      makeSignal('s1', unitVecAtAngle(dtheta)),
      makeSignal('s2', unitVecAtAngle(2 * dtheta)),
      makeSignal('s3', unitVecAtAngle(3 * dtheta)),
      makeSignal('s4', unitVecAtAngle(2.5)), // cos(2.5) ≈ -0.80; isolated
    ];

    const clusters = clusterSignals(signals);
    expect(clusters).toHaveLength(1);
    const cluster = clusters[0]!;
    expect(cluster.signalIds).toEqual(['s0', 's1', 's2', 's3']);
    expect(cluster.members).toHaveLength(4);
  });

  it('enforces strict greater-than: similarity equal to or just below threshold does NOT merge', () => {
    // Construct vectors whose float-64 cosine similarity sits at or
    // immediately below the threshold by a margin larger than the
    // accumulated float error. cos(θ) where cos(θ) = THRESH - tiny.
    // Margin must exceed the f32 storage epsilon at 0.72 (~6e-8); 1e-5 is
    // comfortably above that while still demonstrating "just below the
    // threshold" semantics.
    const eps = 1e-5;
    const theta = Math.acos(COSINE_THRESHOLD - eps);
    const signals: SignalRow[] = [
      makeSignal('a', unitVecAtAngle(0)),
      makeSignal('b', unitVecAtAngle(theta)),
      makeSignal('c', unitVecAtAngle(2 * theta)),
    ];
    const clusters = clusterSignals(signals);
    expect(clusters).toEqual([]);
  });

  it('clusters 3 consecutively-similar signals via transitive union (sim ≈ 0.73 between adjacent)', () => {
    // cos(0.75) ≈ 0.7317 > 0.72. (a,b) and (b,c) both merge; (a,c) does
    // not but transitive union puts all three in the same cluster.
    const theta = 0.75;
    const signals: SignalRow[] = [
      makeSignal('a', unitVecAtAngle(0)),
      makeSignal('b', unitVecAtAngle(theta)),
      makeSignal('c', unitVecAtAngle(2 * theta)),
    ];
    const clusters = clusterSignals(signals);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.signalIds).toEqual(['a', 'b', 'c']);
  });

  it('clusters 3 signals all pairwise above threshold', () => {
    // All at very close angles → all pairwise sim > 0.72.
    const signals: SignalRow[] = [
      makeSignal('a', unitVecAtAngle(0)),
      makeSignal('b', unitVecAtAngle(0.1)),
      makeSignal('c', unitVecAtAngle(0.2)),
    ];
    const clusters = clusterSignals(signals);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.signalIds).toEqual(['a', 'b', 'c']);
  });

  it('drops 2-signal pairs (below MIN_CLUSTER_SIZE)', () => {
    // Only (a,b) similar; c at far angle. Pair {a,b} dropped silently.
    const signals: SignalRow[] = [
      makeSignal('a', unitVecAtAngle(0)),
      makeSignal('b', unitVecAtAngle(0.1)),
      makeSignal('c', unitVecAtAngle(2.5)),
    ];
    const clusters = clusterSignals(signals);
    expect(clusters).toEqual([]);
  });

  it('throws EmbeddingDimensionMismatchError on mismatched embedding length', () => {
    const signals: SignalRow[] = [
      makeSignal('a', [1, 0, 0, 0]),
      makeSignal('b', [1, 0, 0]), // wrong length
      makeSignal('c', [1, 0, 0, 0]),
    ];
    expect(() => clusterSignals(signals)).toThrow(
      EmbeddingDimensionMismatchError,
    );
    try {
      clusterSignals(signals);
    } catch (err) {
      expect(err).toBeInstanceOf(EmbeddingDimensionMismatchError);
      const e = err as EmbeddingDimensionMismatchError;
      expect(e.expected).toBe(4);
      expect(e.actual).toBe(3);
    }
  });

  it('returns empty array for empty input', () => {
    expect(clusterSignals([])).toEqual([]);
  });

  it('logs a warning when signal count exceeds the naive-warning threshold but does not throw', () => {
    // Build NAIVE_WARN_THRESHOLD + 1 signals with NO pairwise similarity
    // (orthogonal vectors via index-positional one-hot in length-2 dims is
    // not enough; use random-ish orthogonal-leaning angles). To keep the
    // test fast we use vectors that yield no clustering, so the inner
    // O(n^2) loop is the only work — fine at ~1k signals.
    const signals: SignalRow[] = [];
    for (let i = 0; i <= NAIVE_WARN_THRESHOLD; i++) {
      // Each signal gets a unique angle on a wide arc → consecutive
      // pairwise sim varies; vast majority below threshold.
      signals.push(makeSignal(`s${i}`, unitVecAtAngle(i * 0.7)));
    }
    const warn = vi.fn();
    const result = clusterSignals(signals, { logger: { warn } });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatchObject({
      action: 'naive_clustering_at_scale',
      signalCount: NAIVE_WARN_THRESHOLD + 1,
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it('throws CorpusTooLargeForNaiveClusteringError above the hard limit', () => {
    // Construct a minimal array of NAIVE_HARD_LIMIT+1 signals — embeddings
    // are not inspected before the hard-limit check, so build them lazily.
    const big: SignalRow[] = new Array(NAIVE_HARD_LIMIT + 1)
      .fill(null)
      .map((_v, i) => makeSignal(`s${i}`, [0, 0, 0, 0]));
    expect(() => clusterSignals(big)).toThrow(
      CorpusTooLargeForNaiveClusteringError,
    );
    try {
      clusterSignals(big);
    } catch (err) {
      expect(err).toBeInstanceOf(CorpusTooLargeForNaiveClusteringError);
      const e = err as CorpusTooLargeForNaiveClusteringError;
      expect(e.signalCount).toBe(NAIVE_HARD_LIMIT + 1);
    }
  });
});
