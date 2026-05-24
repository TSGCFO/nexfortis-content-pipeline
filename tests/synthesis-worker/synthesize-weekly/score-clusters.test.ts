import { describe, expect, it } from 'vitest';

import { scoreClusters } from '../../../artifacts/synthesis-worker/src/jobs/synthesize-weekly/score-clusters.js';
import type {
  ClassifiedCluster,
  SignalRow,
} from '../../../artifacts/synthesis-worker/src/jobs/synthesize-weekly/types.js';

function makeSignal(id: string, capturedAt: Date): SignalRow {
  return {
    id,
    capturedAt,
    redactedText: `text-${id}`,
    embedding: Float32Array.from([1, 0, 0, 0]),
  };
}

function makeCluster(
  ids: string[],
  capturedAt: Date,
  overrides: Partial<ClassifiedCluster> = {},
): ClassifiedCluster {
  const members = ids.map((id) => makeSignal(id, capturedAt));
  return {
    signalIds: ids,
    members,
    label: overrides.label ?? `label-${ids[0]}`,
    topicKeywords: overrides.topicKeywords ?? ['k'],
    pillar: overrides.pillar ?? 'quickbooks',
  };
}

describe('scoreClusters', () => {
  it('sorts clusters by descending size when recency is equal', () => {
    const now = new Date('2026-05-24T12:00:00Z');
    const ts = new Date('2026-05-23T12:00:00Z'); // 1 day ago
    const big = makeCluster(['a1', 'a2', 'a3', 'a4', 'a5'], ts);
    const mid = makeCluster(['b1', 'b2', 'b3', 'b4'], ts);
    const small = makeCluster(['c1', 'c2', 'c3'], ts);
    const result = scoreClusters([small, big, mid], now);
    expect(result.map((c) => c.signalIds[0])).toEqual(['a1', 'b1', 'c1']);
  });

  it('breaks ties on score by ascending minimum signal-UUID', () => {
    const now = new Date('2026-05-24T12:00:00Z');
    const ts = new Date('2026-05-23T12:00:00Z');
    const cBbb = makeCluster(['bbb-1', 'bbb-2', 'bbb-3'], ts);
    const cAaa = makeCluster(['aaa-1', 'aaa-2', 'aaa-3'], ts);
    const result = scoreClusters([cBbb, cAaa], now);
    expect(result[0]!.signalIds[0]).toBe('aaa-1');
    expect(result[1]!.signalIds[0]).toBe('bbb-1');
  });

  it('scores recent clusters higher than older clusters of the same size', () => {
    const now = new Date('2026-05-24T12:00:00Z');
    const yesterday = new Date('2026-05-23T12:00:00Z'); // 1 day ago
    const longAgo = new Date('2026-04-25T12:00:00Z'); // 29 days ago
    const fresh = makeCluster(['f1', 'f2', 'f3'], yesterday);
    const stale = makeCluster(['s1', 's2', 's3'], longAgo);
    const result = scoreClusters([stale, fresh], now);
    expect(result[0]!.signalIds[0]).toBe('f1');
    expect(result[0]!.score).toBeGreaterThan(result[1]!.score);
  });

  it('clamps recency weight at zero for signals older than 30 days', () => {
    const now = new Date('2026-05-24T12:00:00Z');
    const veryOld = new Date('2025-01-01T00:00:00Z');
    const c = makeCluster(['o1', 'o2', 'o3'], veryOld);
    const [scored] = scoreClusters([c], now);
    expect(scored!.score).toBe(3); // 3 signals + 0 recency
  });
});
