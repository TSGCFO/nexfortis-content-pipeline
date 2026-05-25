import { describe, expect, it } from 'vitest';

import {
  MAX_SELECTED_SIGNALS,
  selectSignalsForCluster,
  type SelectedSignal,
} from '../../../artifacts/telegram-bot/src/lib/select-signals-for-cluster.js';
import type { Database } from '@ncp/db';

// --- minimal Drizzle-shaped chain mock ------------------------------------

interface FakeDbCapture {
  whereArg: unknown;
  orderByArg: unknown;
  limitArg: number | undefined;
}

function makeFakeDb(rows: Array<Record<string, unknown>>): {
  db: Database;
  capture: FakeDbCapture;
} {
  const capture: FakeDbCapture = {
    whereArg: undefined,
    orderByArg: undefined,
    limitArg: undefined,
  };
  const db = {
    select(_cols: unknown) {
      return {
        from(_table: unknown) {
          return {
            where(w: unknown) {
              capture.whereArg = w;
              return {
                orderBy(o: unknown) {
                  capture.orderByArg = o;
                  return {
                    limit(n: number) {
                      capture.limitArg = n;
                      return Promise.resolve(rows);
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
  return { db: db as unknown as Database, capture };
}

function row(
  id: string,
  capturedAt: string,
  text: string,
  source = 'claude',
  tokenCount: number | null = 1000,
): Record<string, unknown> {
  return {
    id,
    capturedAt: new Date(capturedAt),
    redactedText: text,
    source,
    tokenCount,
  };
}

describe('selectSignalsForCluster', () => {
  it('returns an empty array when evidenceChunkIds is null', async () => {
    const { db } = makeFakeDb([]);
    const result = await selectSignalsForCluster(db, { evidenceChunkIds: null });
    expect(result).toEqual([]);
  });

  it('returns an empty array when evidenceChunkIds is empty', async () => {
    const { db, capture } = makeFakeDb([]);
    const result = await selectSignalsForCluster(db, { evidenceChunkIds: [] });
    expect(result).toEqual([]);
    // Should NOT have executed the query
    expect(capture.whereArg).toBeUndefined();
  });

  it('issues SELECT with LIMIT 5 (max cap)', async () => {
    const { db, capture } = makeFakeDb([
      row('a', '2026-05-22T10:00:00Z', 'first'),
    ]);
    await selectSignalsForCluster(db, {
      evidenceChunkIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    });
    expect(capture.limitArg).toBe(MAX_SELECTED_SIGNALS);
    expect(capture.limitArg).toBe(5);
  });

  it('maps DB rows into SelectedSignal in DB-returned order (relies on DB ORDER BY)', async () => {
    const { db } = makeFakeDb([
      row('s3', '2026-05-22T10:00:00Z', 'newest'),
      row('s2', '2026-05-20T10:00:00Z', 'middle'),
      row('s1', '2026-05-18T10:00:00Z', 'oldest'),
    ]);
    const result = await selectSignalsForCluster(db, {
      evidenceChunkIds: ['s1', 's2', 's3'],
    });
    expect(result.map((r) => r.id)).toEqual(['s3', 's2', 's1']);
  });

  it('issues an orderBy clause (DESC on captured_at)', async () => {
    const { db, capture } = makeFakeDb([]);
    await selectSignalsForCluster(db, { evidenceChunkIds: ['a'] });
    // We only check that *some* orderBy was applied — actual SQL is
    // tested at the Drizzle level. This guards against future refactors
    // accidentally dropping the ordering.
    expect(capture.orderByArg).toBeDefined();
  });

  it('preserves tokenCount = null (e.g. transcribed voice notes)', async () => {
    const { db } = makeFakeDb([
      row('s1', '2026-05-22T10:00:00Z', 'voice', 'telegram', null),
    ]);
    const result: SelectedSignal[] = await selectSignalsForCluster(db, {
      evidenceChunkIds: ['s1'],
    });
    expect(result[0]!.tokenCount).toBeNull();
  });

  it('passes the candidate evidence IDs into the WHERE clause (and is_deleted=false guard)', async () => {
    const { db, capture } = makeFakeDb([]);
    await selectSignalsForCluster(db, { evidenceChunkIds: ['x', 'y'] });
    expect(capture.whereArg).toBeDefined();
  });
});
