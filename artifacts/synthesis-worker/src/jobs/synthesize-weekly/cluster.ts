/**
 * Pure clustering function: naive O(n^2) cosine similarity with single-link
 * agglomeration via union-find.
 *
 * Threshold and minimum-cluster-size are locked spec values
 * (capture-synthesis-layer/prd.md §6.6):
 *   - cosine similarity > 0.72 (strict greater-than)
 *   - minimum cluster size: 3 (smaller groups are dropped silently)
 *
 * Performance bands:
 *   - corpus <= 1000: silent fast path
 *   - 1001..5000: emits a logger.warn flagging future HDBSCAN migration
 *   - > 5000: throws CorpusTooLargeForNaiveClusteringError
 */

import type { Logger } from '@ncp/logger';

import {
  CorpusTooLargeForNaiveClusteringError,
  EmbeddingDimensionMismatchError,
} from './errors.js';
import type { Cluster, SignalRow } from './types.js';

export const COSINE_THRESHOLD = 0.72;
export const MIN_CLUSTER_SIZE = 3;
export const NAIVE_WARN_THRESHOLD = 1000;
export const NAIVE_HARD_LIMIT = 5000;

export interface ClusterSignalsOptions {
  logger?: Pick<Logger, 'warn'>;
}

/**
 * Compute cosine similarity between two equal-length Float32Array vectors.
 *
 * Returns 0 (rather than NaN) if either vector is the zero vector — this
 * keeps the union-find pass deterministic without special-casing degenerate
 * inputs at the call site.
 *
 * Exported for unit testing; tested transitively via clusterSignals tests.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * Cluster a list of signals by cosine similarity above the threshold using
 * union-find with path compression and union-by-rank.
 *
 * @returns clusters of size >= MIN_CLUSTER_SIZE only, with members emitted
 *   in input order so that the result is deterministic across runs.
 */
export function clusterSignals(
  signals: SignalRow[],
  opts: ClusterSignalsOptions = {},
): Cluster[] {
  const n = signals.length;
  if (n === 0) return [];

  if (n > NAIVE_HARD_LIMIT) {
    throw new CorpusTooLargeForNaiveClusteringError(n);
  }
  if (n > NAIVE_WARN_THRESHOLD) {
    opts.logger?.warn(
      {
        source: 'synthesis_worker',
        action: 'naive_clustering_at_scale',
        signalCount: n,
        warnThreshold: NAIVE_WARN_THRESHOLD,
      },
      'naive O(n^2) clustering above warn threshold; consider HDBSCAN',
    );
  }

  // Validate uniform embedding dimension against the first signal. The
  // schema declares vector(3072) so a mismatch surfaces an upstream bug.
  const expectedDim = signals[0]?.embedding.length ?? 0;
  for (let i = 1; i < n; i++) {
    const actual = signals[i]?.embedding.length ?? 0;
    if (actual !== expectedDim) {
      throw new EmbeddingDimensionMismatchError(expectedDim, actual);
    }
  }

  // Union-find with path compression and union-by-rank.
  const parent = new Int32Array(n);
  const rank = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;

  const find = (x: number): number => {
    let root = x;
    while ((parent[root] ?? root) !== root) {
      root = parent[root] ?? root;
    }
    // Path compression.
    let cur = x;
    while ((parent[cur] ?? cur) !== root) {
      const next = parent[cur] ?? cur;
      parent[cur] = root;
      cur = next;
    }
    return root;
  };

  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    const raRank = rank[ra] ?? 0;
    const rbRank = rank[rb] ?? 0;
    if (raRank < rbRank) {
      parent[ra] = rb;
    } else if (raRank > rbRank) {
      parent[rb] = ra;
    } else {
      parent[rb] = ra;
      rank[ra] = raRank + 1;
    }
  };

  for (let i = 0; i < n; i++) {
    const si = signals[i];
    if (!si) continue;
    for (let j = i + 1; j < n; j++) {
      const sj = signals[j];
      if (!sj) continue;
      const sim = cosineSimilarity(si.embedding, sj.embedding);
      if (sim > COSINE_THRESHOLD) {
        union(i, j);
      }
    }
  }

  // Group indices by root, preserving input order.
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const arr = groups.get(root);
    if (arr === undefined) {
      groups.set(root, [i]);
    } else {
      arr.push(i);
    }
  }

  const clusters: Cluster[] = [];
  for (const indices of groups.values()) {
    if (indices.length < MIN_CLUSTER_SIZE) continue;
    const members: SignalRow[] = [];
    const signalIds: string[] = [];
    for (const idx of indices) {
      const s = signals[idx];
      if (!s) continue;
      members.push(s);
      signalIds.push(s.id);
    }
    clusters.push({ signalIds, members });
  }
  return clusters;
}
