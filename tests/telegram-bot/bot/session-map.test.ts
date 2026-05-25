/**
 * Tests for the in-memory `SessionMap`.
 */

import { describe, expect, it, vi } from 'vitest';

import { createSessionMap } from '../../../artifacts/telegram-bot/src/bot/session-map.js';
import type { Database } from '@ncp/db';

const SESSION_A = {
  sessionId: 'sess-a',
  candidateId: 'cand-a',
  openedAt: new Date('2026-05-25T12:00:00Z'),
};

const SESSION_B = {
  sessionId: 'sess-b',
  candidateId: 'cand-b',
  openedAt: new Date('2026-05-25T12:00:01Z'),
};

describe('SessionMap', () => {
  it('recordOpened + getActiveSessionForChat round-trips', () => {
    const m = createSessionMap();
    m.recordOpened('chat-1', SESSION_A);
    expect(m.getActiveSessionForChat('chat-1')).toEqual(SESSION_A);
  });

  it('recordClosed removes the entry', () => {
    const m = createSessionMap();
    m.recordOpened('chat-1', SESSION_A);
    m.recordClosed('chat-1');
    expect(m.getActiveSessionForChat('chat-1')).toBeUndefined();
  });

  it('getActiveSessionForChat returns undefined for an unknown chat', () => {
    const m = createSessionMap();
    expect(m.getActiveSessionForChat('ghost')).toBeUndefined();
  });

  it('recordOpened on an already-open chat updates the entry (last-write-wins)', () => {
    const m = createSessionMap();
    m.recordOpened('chat-1', SESSION_A);
    m.recordOpened('chat-1', SESSION_B);
    expect(m.getActiveSessionForChat('chat-1')).toEqual(SESSION_B);
  });

  it('loadFromDb populates the map from a DB mock returning 2 rows', async () => {
    const m = createSessionMap();
    const rows = [
      {
        id: 's1',
        candidateId: 'c1',
        telegramChatId: 'chat-1',
        startedAt: new Date('2026-05-25T12:00:00Z'),
        status: 'preview_sent',
      },
      {
        id: 's2',
        candidateId: 'c2',
        telegramChatId: 'chat-2',
        startedAt: new Date('2026-05-25T13:00:00Z'),
        status: 'confirming',
      },
    ];
    const db = {
      select: vi.fn(() => ({
        from: () => ({
          where: () => Promise.resolve(rows),
        }),
      })),
    } as unknown as Database;
    await m.loadFromDb({ db });
    expect(m.getActiveSessionForChat('chat-1')?.sessionId).toBe('s1');
    expect(m.getActiveSessionForChat('chat-2')?.sessionId).toBe('s2');
  });

  it('loadFromDb on an empty DB leaves the map empty', async () => {
    const m = createSessionMap();
    const db = {
      select: () => ({
        from: () => ({ where: () => Promise.resolve([]) }),
      }),
    } as unknown as Database;
    await m.loadFromDb({ db });
    expect(m.snapshot()).toEqual([]);
  });

  it('loadFromDb skips rows whose status is not in the open set', async () => {
    const m = createSessionMap();
    const rows = [
      {
        id: 's1',
        candidateId: 'c1',
        telegramChatId: 'chat-1',
        startedAt: new Date(),
        status: 'completed',
      },
      {
        id: 's2',
        candidateId: 'c2',
        telegramChatId: 'chat-2',
        startedAt: new Date(),
        status: 'follow_up',
      },
    ];
    const db = {
      select: () => ({
        from: () => ({ where: () => Promise.resolve(rows) }),
      }),
    } as unknown as Database;
    await m.loadFromDb({ db });
    expect(m.getActiveSessionForChat('chat-1')).toBeUndefined();
    expect(m.getActiveSessionForChat('chat-2')).toBeDefined();
  });
});
