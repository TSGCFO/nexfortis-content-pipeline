import { describe, expect, it, vi } from 'vitest';

import {
  getLastIngestedAt,
  setLastIngestedAt,
} from '../../../artifacts/capture-worker/src/jobs/ingest-msgraph-email/checkpoint.js';

interface MockDb {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
}

function makeSelectReturning(rows: unknown[]) {
  return vi.fn(() => ({
    from: vi.fn(() => Promise.resolve(rows)),
  }));
}

describe('getLastIngestedAt', () => {
  it('returns now() - 7 days (within 1s) when no row exists', async () => {
    const now = 1_700_000_000_000;
    const db: MockDb = {
      select: makeSelectReturning([]),
      insert: vi.fn(),
    };
    const result = await getLastIngestedAt(
      db as unknown as Parameters<typeof getLastIngestedAt>[0],
      () => now,
    );
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(result.getTime() - (now - sevenDaysMs))).toBeLessThan(1000);
  });

  it('returns last_ingested_at when a row exists for msgraph-email', async () => {
    const expected = new Date('2026-05-20T10:00:00.000Z');
    const db: MockDb = {
      select: makeSelectReturning([
        { source: 'msgraph-email', lastIngestedAt: expected },
      ]),
      insert: vi.fn(),
    };
    const result = await getLastIngestedAt(
      db as unknown as Parameters<typeof getLastIngestedAt>[0],
    );
    expect(result.toISOString()).toBe(expected.toISOString());
  });

  it('ignores rows for other sources and falls back to default', async () => {
    const now = 1_700_000_000_000;
    const otherRow = {
      source: 'claude_export',
      lastIngestedAt: new Date('2026-05-21T00:00:00.000Z'),
    };
    const db: MockDb = {
      select: makeSelectReturning([otherRow]),
      insert: vi.fn(),
    };
    const result = await getLastIngestedAt(
      db as unknown as Parameters<typeof getLastIngestedAt>[0],
      () => now,
    );
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(result.getTime() - (now - sevenDaysMs))).toBeLessThan(1000);
  });
});

describe('setLastIngestedAt', () => {
  it('upserts via onConflictDoUpdate with `source` as the conflict target', async () => {
    const onConflictDoUpdate = vi.fn(() => Promise.resolve());
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));
    const db: MockDb = {
      select: vi.fn(),
      insert,
    };
    const ts = new Date('2026-05-22T03:00:00.000Z');
    await setLastIngestedAt(
      db as unknown as Parameters<typeof setLastIngestedAt>[0],
      ts,
    );
    expect(insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledTimes(1);
    const valuesArg = values.mock.calls[0]?.[0] as {
      source: string;
      lastIngestedAt: Date;
    };
    expect(valuesArg.source).toBe('msgraph-email');
    expect(valuesArg.lastIngestedAt.toISOString()).toBe(ts.toISOString());

    expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
    const upsertArg = onConflictDoUpdate.mock.calls[0]?.[0] as {
      target: unknown;
      set: { lastIngestedAt: Date };
    };
    // The conflict target must reference the `source` PK column. We assert
    // the column object is provided and is the `source` column on the
    // ingest_checkpoints table.
    expect(upsertArg.target).toBeDefined();
    expect((upsertArg.target as { name: string }).name).toBe('source');
    expect(upsertArg.set.lastIngestedAt.toISOString()).toBe(ts.toISOString());
  });
});
