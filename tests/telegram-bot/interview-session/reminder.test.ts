/**
 * Tests for the 48-hour soft-reminder step.
 *
 * Cases:
 *   1. After 48h, session in PREVIEW_SENT, reminder_sent false → reminder sent + flag flipped
 *   2. After 48h, session in CONFIRMING → reminder sent
 *   3. After 48h, session COMPLETED → no reminder
 *   4. After 48h, session SKIPPED → no reminder
 *   5. After 48h, reminder_sent already true → no reminder (idempotency)
 *   6. Reminder text matches PRD §4.7 exactly with HTML escaping
 */

import { describe, expect, it, vi } from 'vitest';

import {
  buildReminderMessage,
  runReminderStep,
  type ReminderStepDeps,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/reminder.js';
import type { Database } from '@ncp/db';
import type { Logger } from '@ncp/logger';

function makeLogger(): Logger {
  return {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  };
}

function makeFetchOk(): ReturnType<typeof vi.fn> {
  return vi.fn(
    async () =>
      new Response(JSON.stringify({ ok: true, result: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
}

interface FakeDbState {
  sessionRow: { status: string; reminderSent: boolean | null } | undefined;
  updateCalls: Array<{ set: Record<string, unknown> }>;
}

function makeDb(state: FakeDbState): Database {
  return {
    select(_cols: unknown) {
      return {
        from(_table: unknown) {
          return {
            where(_w: unknown) {
              if (state.sessionRow === undefined) return Promise.resolve([]);
              return Promise.resolve([state.sessionRow]);
            },
          };
        },
      };
    },
    update(_table: unknown) {
      return {
        set(values: unknown) {
          state.updateCalls.push({ set: values as Record<string, unknown> });
          return { where(_w: unknown) { return Promise.resolve(undefined); } };
        },
      };
    },
  } as unknown as Database;
}

interface BuiltDeps {
  deps: ReminderStepDeps;
  state: FakeDbState;
  fetchFn: ReturnType<typeof vi.fn>;
  sleep: ReturnType<typeof vi.fn>;
}

function makeDeps(
  sessionRow: FakeDbState['sessionRow'],
  fetchFn = makeFetchOk(),
): BuiltDeps {
  const state: FakeDbState = { sessionRow, updateCalls: [] };
  const sleep = vi.fn(async (_ms: number) => undefined);
  const deps: ReminderStepDeps = {
    db: makeDb(state),
    logger: makeLogger(),
    fetchFn: fetchFn as unknown as typeof fetch,
    token: 'TOK',
    chatId: 'CHAT',
    sleep: sleep as unknown as ReminderStepDeps['sleep'],
  };
  return { deps, state, fetchFn, sleep };
}

describe('runReminderStep', () => {
  it('PREVIEW_SENT + not-yet-sent: sends reminder, flips flag, called sleep with 48h', async () => {
    const built = makeDeps({ status: 'preview_sent', reminderSent: false });
    await runReminderStep(built.deps, {
      sessionId: 'sess-1',
      proposedTitle: 'Conditional Access for iOS',
    });
    // sleep called once with 48h in ms
    expect(built.sleep).toHaveBeenCalledTimes(1);
    expect(built.sleep.mock.calls[0]![0]).toBe(48 * 60 * 60 * 1000);
    // Telegram fetch called once
    expect(built.fetchFn).toHaveBeenCalledTimes(1);
    // Flag write happened
    const flip = built.state.updateCalls.find(
      (u) => u.set['reminderSent'] === true,
    );
    expect(flip).toBeDefined();
  });

  it('CONFIRMING + not-yet-sent: still sends the reminder', async () => {
    const built = makeDeps({ status: 'confirming', reminderSent: false });
    await runReminderStep(built.deps, {
      sessionId: 'sess-1',
      proposedTitle: 'X',
    });
    expect(built.fetchFn).toHaveBeenCalledTimes(1);
  });

  it('COMPLETED: NO reminder sent (terminal status guard)', async () => {
    const built = makeDeps({ status: 'completed', reminderSent: false });
    await runReminderStep(built.deps, {
      sessionId: 'sess-1',
      proposedTitle: 'X',
    });
    expect(built.fetchFn).not.toHaveBeenCalled();
    expect(built.state.updateCalls).toHaveLength(0);
  });

  it('SKIPPED: NO reminder sent', async () => {
    const built = makeDeps({ status: 'skipped', reminderSent: false });
    await runReminderStep(built.deps, {
      sessionId: 'sess-1',
      proposedTitle: 'X',
    });
    expect(built.fetchFn).not.toHaveBeenCalled();
  });

  it('reminder_sent already true: NO second reminder (idempotency)', async () => {
    const built = makeDeps({ status: 'preview_sent', reminderSent: true });
    await runReminderStep(built.deps, {
      sessionId: 'sess-1',
      proposedTitle: 'X',
    });
    expect(built.fetchFn).not.toHaveBeenCalled();
    expect(built.state.updateCalls).toHaveLength(0);
  });

  it('reminder text matches PRD §4.7 exactly with HTML-escaped title', () => {
    const message = buildReminderMessage('My <special> Title');
    expect(message).toBe(
      'No rush — your article on <i>My &lt;special&gt; Title</i> is waiting whenever you have 5 min.',
    );
  });

  it('TIMED_OUT (any other terminal status): NO reminder', async () => {
    const built = makeDeps({ status: 'timed_out', reminderSent: false });
    await runReminderStep(built.deps, {
      sessionId: 'sess-1',
      proposedTitle: 'X',
    });
    expect(built.fetchFn).not.toHaveBeenCalled();
  });

  it('session not found in DB: NO reminder (defensive)', async () => {
    const built = makeDeps(undefined);
    await runReminderStep(built.deps, {
      sessionId: 'sess-missing',
      proposedTitle: 'X',
    });
    expect(built.fetchFn).not.toHaveBeenCalled();
  });
});
