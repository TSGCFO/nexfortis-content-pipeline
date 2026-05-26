/**
 * Tests for `softDeleteSignal`.
 *
 * Covers:
 *   1. Valid UUID, signal exists, not deleted → soft-deletes, success
 *   2. Invalid UUID format → returns error WITHOUT DB call
 *   3. UUID not in DB → not_found
 *   4. UUID already deleted → already_deleted
 *   5. DB update throws → db_error (does NOT throw)
 *   6. The DB call is UPDATE (never DELETE)
 */

import { describe, expect, it, vi } from 'vitest';

import {
  softDeleteSignal,
  type DeleteSignalDeps,
} from '../../../../artifacts/telegram-bot/src/bot/handlers/delete-signal.js';
import type { Database } from '@ncp/db';
import type { Logger } from '@ncp/logger';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const INVALID_UUID = 'not-a-uuid';

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

interface FakeDbCalls {
  selectRows: Array<{ id: string; isDeleted: boolean }> | 'throw' | 'empty';
  updateThrow?: boolean;
  /** Records which methods got called. */
  spy: {
    select: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
}

function makeDb(state: FakeDbCalls): Database {
  return {
    select: state.spy.select.mockImplementation(() => ({
      from: () => ({
        where: () => {
          if (state.selectRows === 'throw') {
            throw new Error('select failed');
          }
          if (state.selectRows === 'empty') {
            return Promise.resolve([]);
          }
          return Promise.resolve(state.selectRows);
        },
      }),
    })),
    update: state.spy.update.mockImplementation(() => ({
      set: () => ({
        where: () => {
          if (state.updateThrow === true) {
            throw new Error('update failed');
          }
          return Promise.resolve(undefined);
        },
      }),
    })),
    delete: state.spy.delete,
  } as unknown as Database;
}

function makeDeps(state: FakeDbCalls): DeleteSignalDeps {
  return {
    db: makeDb(state),
    logger: makeLogger(),
    deletedByChatId: 'chat-1',
  };
}

describe('softDeleteSignal', () => {
  it('valid UUID, signal exists and not deleted → success', async () => {
    const spy = {
      select: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const deps = makeDeps({
      selectRows: [{ id: VALID_UUID, isDeleted: false }],
      spy,
    });
    const result = await softDeleteSignal(deps, VALID_UUID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.signalId).toBe(VALID_UUID);
      expect(result.message).toContain(VALID_UUID);
    }
    expect(spy.update).toHaveBeenCalledTimes(1);
  });

  it('invalid UUID format → invalid_uuid; no DB calls', async () => {
    const spy = {
      select: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const deps = makeDeps({
      selectRows: 'empty',
      spy,
    });
    const result = await softDeleteSignal(deps, INVALID_UUID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid_uuid');
    }
    expect(spy.select).not.toHaveBeenCalled();
    expect(spy.update).not.toHaveBeenCalled();
  });

  it('UUID not in DB → not_found', async () => {
    const spy = {
      select: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const deps = makeDeps({
      selectRows: 'empty',
      spy,
    });
    const result = await softDeleteSignal(deps, VALID_UUID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('not_found');
    }
    expect(spy.update).not.toHaveBeenCalled();
  });

  it('UUID already deleted → already_deleted', async () => {
    const spy = {
      select: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const deps = makeDeps({
      selectRows: [{ id: VALID_UUID, isDeleted: true }],
      spy,
    });
    const result = await softDeleteSignal(deps, VALID_UUID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('already_deleted');
    }
    expect(spy.update).not.toHaveBeenCalled();
  });

  it('DB update throws → db_error (does NOT throw to caller)', async () => {
    const spy = {
      select: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const deps = makeDeps({
      selectRows: [{ id: VALID_UUID, isDeleted: false }],
      updateThrow: true,
      spy,
    });
    const result = await softDeleteSignal(deps, VALID_UUID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('db_error');
    }
  });

  it('DB call is UPDATE — never DELETE', async () => {
    const spy = {
      select: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    const deps = makeDeps({
      selectRows: [{ id: VALID_UUID, isDeleted: false }],
      spy,
    });
    await softDeleteSignal(deps, VALID_UUID);
    expect(spy.update).toHaveBeenCalledTimes(1);
    expect(spy.delete).not.toHaveBeenCalled();
  });
});
