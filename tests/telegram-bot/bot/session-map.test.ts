import { describe, expect, it } from 'vitest';

import {
  SessionMap,
  type ActiveSession,
} from '../../../artifacts/telegram-bot/src/bot/session-map.js';
import type { Database } from '@ncp/db';

function makeFakeDb(rows: Array<Record<string, unknown>>): Database {
  return {
    select(_cols: unknown) {
      return {
        from(_table: unknown) {
          return {
            where(_w: unknown) {
              return Promise.resolve(rows);
            },
          };
        },
      };
    },
  } as unknown as Database;
}

function sess(
  sessionId: string,
  openedAt: string,
  candidateId = 'cand-1',
): ActiveSession {
  return { sessionId, candidateId, openedAt: new Date(openedAt) };
}

describe('SessionMap', () => {
  it('recordOpened then getActiveSessionForChat returns the same session', () => {
    const sm = new SessionMap();
    const s = sess('sess-1', '2026-05-25T12:00:00Z');
    sm.recordOpened('CHAT', s);
    expect(sm.getActiveSessionForChat('CHAT')).toEqual(s);
  });

  it('recordClosed removes the entry from the map', () => {
    const sm = new SessionMap();
    sm.recordOpened('CHAT', sess('sess-1', '2026-05-25T12:00:00Z'));
    sm.recordClosed('CHAT');
    expect(sm.getActiveSessionForChat('CHAT')).toBeUndefined();
  });

  it('getActiveSessionForChat returns undefined for unknown chat', () => {
    const sm = new SessionMap();
    expect(sm.getActiveSessionForChat('NEVER')).toBeUndefined();
  });

  it('recordOpened on an existing chat updates the entry (last-write-wins)', () => {
    const sm = new SessionMap();
    sm.recordOpened('CHAT', sess('sess-1', '2026-05-25T12:00:00Z'));
    sm.recordOpened('CHAT', sess('sess-2', '2026-06-01T12:00:00Z'));
    const out = sm.getActiveSessionForChat('CHAT');
    expect(out?.sessionId).toBe('sess-2');
  });

  it('loadFromDb populates the map from non-terminal rows returned by the DB', async () => {
    const sm = new SessionMap();
    const db = makeFakeDb([
      {
        id: 'sess-A',
        candidateId: 'cand-A',
        chatId: 'CHAT-A',
        startedAt: new Date('2026-05-20T08:00:00Z'),
        status: 'preview_sent',
      },
      {
        id: 'sess-B',
        candidateId: 'cand-B',
        chatId: 'CHAT-B',
        startedAt: new Date('2026-05-21T08:00:00Z'),
        status: 'confirming',
      },
    ]);
    const loaded = await sm.loadFromDb({
      db,
      chatIds: ['CHAT-A', 'CHAT-B'],
    });
    expect(loaded).toBe(2);
    expect(sm.getActiveSessionForChat('CHAT-A')?.sessionId).toBe('sess-A');
    expect(sm.getActiveSessionForChat('CHAT-B')?.sessionId).toBe('sess-B');
  });

  it('loadFromDb on empty DB results in an empty map (size 0)', async () => {
    const sm = new SessionMap();
    sm.recordOpened('STALE', sess('stale-1', '2026-05-01T00:00:00Z'));
    const db = makeFakeDb([]);
    const loaded = await sm.loadFromDb({ db, chatIds: ['STALE'] });
    expect(loaded).toBe(0);
    // Previous entries are cleared, not preserved.
    expect(sm.getActiveSessionForChat('STALE')).toBeUndefined();
  });

  it('loadFromDb with empty chatIds short-circuits without a DB query', async () => {
    const sm = new SessionMap();
    let called = false;
    const db = {
      select() {
        called = true;
        throw new Error('should not be called');
      },
    } as unknown as Database;
    const loaded = await sm.loadFromDb({ db, chatIds: [] });
    expect(loaded).toBe(0);
    expect(called).toBe(false);
  });

  it('loadFromDb prefers the latest startedAt when the DB returns multiple rows for one chat', async () => {
    const sm = new SessionMap();
    const db = makeFakeDb([
      {
        id: 'sess-OLD',
        candidateId: 'cand-1',
        chatId: 'CHAT',
        startedAt: new Date('2026-05-01T08:00:00Z'),
        status: 'preview_sent',
      },
      {
        id: 'sess-NEW',
        candidateId: 'cand-2',
        chatId: 'CHAT',
        startedAt: new Date('2026-05-25T08:00:00Z'),
        status: 'confirming',
      },
    ]);
    await sm.loadFromDb({ db, chatIds: ['CHAT'] });
    expect(sm.getActiveSessionForChat('CHAT')?.sessionId).toBe('sess-NEW');
  });
});
