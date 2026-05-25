/**
 * Tests for `selectSignalsForCluster`. Pure unit tests; the `queryFn`
 * dep is a `vi.fn()` returning hand-built `SignalForInterview` arrays.
 */

import { describe, expect, it, vi } from 'vitest';

import { selectSignalsForCluster } from '../../../artifacts/telegram-bot/src/lib/select-signals-for-cluster.js';
import type { SignalForInterview } from '../../../artifacts/telegram-bot/src/jobs/interview-session/types.js';

function makeSignal(
  partial: Partial<SignalForInterview> & { id: string },
): SignalForInterview {
  return {
    id: partial.id,
    source: partial.source ?? 'claude_cowork',
    capturedAt: partial.capturedAt ?? new Date('2026-05-10T00:00:00Z'),
    redactedText: partial.redactedText ?? `text for ${partial.id}`,
    tokenCount: partial.tokenCount ?? 500,
    isDeleted: partial.isDeleted ?? false,
  };
}

describe('selectSignalsForCluster', () => {
  it('returns at most 5 signals', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const queryFn = vi.fn(async () => ids.map((id) => makeSignal({ id })));
    const result = await selectSignalsForCluster({
      evidenceChunkIds: ids,
      queryFn,
    });
    expect(result.length).toBeLessThanOrEqual(5);
    expect(result.length).toBe(5);
  });

  it('returns 0 signals when evidenceChunkIds is null', async () => {
    const queryFn = vi.fn(async () => []);
    const result = await selectSignalsForCluster({
      evidenceChunkIds: null,
      queryFn,
    });
    expect(result).toEqual([]);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it('returns 0 signals when evidenceChunkIds is empty', async () => {
    const queryFn = vi.fn(async () => []);
    const result = await selectSignalsForCluster({
      evidenceChunkIds: [],
      queryFn,
    });
    expect(result).toEqual([]);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it('orders signals by captured_at DESC (newest first)', async () => {
    const queryFn = vi.fn(async () => [
      makeSignal({ id: 'old', capturedAt: new Date('2026-05-01T00:00:00Z') }),
      makeSignal({ id: 'new', capturedAt: new Date('2026-05-10T00:00:00Z') }),
      makeSignal({ id: 'mid', capturedAt: new Date('2026-05-05T00:00:00Z') }),
    ]);
    const result = await selectSignalsForCluster({
      evidenceChunkIds: ['old', 'new', 'mid'],
      queryFn,
    });
    expect(result.map((s) => s.id)).toEqual(['new', 'mid', 'old']);
  });

  it('filters out is_deleted=true signals', async () => {
    const queryFn = vi.fn(async () => [
      makeSignal({ id: 'live' }),
      makeSignal({ id: 'dead', isDeleted: true }),
    ]);
    const result = await selectSignalsForCluster({
      evidenceChunkIds: ['live', 'dead'],
      queryFn,
    });
    expect(result.map((s) => s.id)).toEqual(['live']);
  });

  it('forwards evidenceChunkIds to queryFn unchanged', async () => {
    const queryFn = vi.fn(async () => []);
    const ids = ['x', 'y', 'z'];
    await selectSignalsForCluster({ evidenceChunkIds: ids, queryFn });
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(queryFn.mock.calls[0]![0]).toEqual(ids);
  });

  it('returns 0 signals when queryFn returns empty (no rows match)', async () => {
    const queryFn = vi.fn(async () => []);
    const result = await selectSignalsForCluster({
      evidenceChunkIds: ['ghost'],
      queryFn,
    });
    expect(result).toEqual([]);
  });
});
