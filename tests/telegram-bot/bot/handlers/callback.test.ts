/**
 * Tests for `handleCallback` — the pure logic backing the grammY
 * callback_query handler.
 */

import { describe, expect, it, vi } from 'vitest';

import { handleCallback } from '../../../../artifacts/telegram-bot/src/bot/handlers/callback.js';
import { createSessionMap } from '../../../../artifacts/telegram-bot/src/bot/session-map.js';
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

function makeOpenSessionMap(): ReturnType<typeof createSessionMap> {
  const m = createSessionMap();
  m.recordOpened('chat-1', {
    sessionId: 'sess-1',
    candidateId: 'cand-1',
    openedAt: new Date(),
  });
  return m;
}

describe('handleCallback', () => {
  it('dispatches messageType="callback" with the parsed choice as text', async () => {
    const sessionMap = makeOpenSessionMap();
    const sendInngestEvent = vi.fn(async () => undefined);
    await handleCallback({
      chatId: 'chat-1',
      callbackData: 'cnfm:2:y',
      sessionMap,
      sendInngestEvent,
      logger: makeLogger(),
    });
    expect(sendInngestEvent).toHaveBeenCalledTimes(1);
    expect(sendInngestEvent.mock.calls[0]![0]).toEqual({
      name: 'telegram.message.received',
      data: {
        chatId: 'chat-1',
        sessionId: 'sess-1',
        messageType: 'callback',
        text: 'yes',
        callbackData: 'cnfm:2:y',
      },
    });
  });

  it('does NOT dispatch when callback_data is malformed (warn only)', async () => {
    const sessionMap = makeOpenSessionMap();
    const sendInngestEvent = vi.fn(async () => undefined);
    const logger = makeLogger();
    await handleCallback({
      chatId: 'chat-1',
      callbackData: 'foo:bar',
      sessionMap,
      sendInngestEvent,
      logger,
    });
    expect(sendInngestEvent).not.toHaveBeenCalled();
    expect((logger.warn as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it('does NOT dispatch when no active session (warn only)', async () => {
    const sessionMap = createSessionMap();
    const sendInngestEvent = vi.fn(async () => undefined);
    const logger = makeLogger();
    await handleCallback({
      chatId: 'unknown',
      callbackData: 'cnfm:1:y',
      sessionMap,
      sendInngestEvent,
      logger,
    });
    expect(sendInngestEvent).not.toHaveBeenCalled();
    expect((logger.warn as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it('parses the anon suffix correctly', async () => {
    const sessionMap = makeOpenSessionMap();
    const sendInngestEvent = vi.fn(async () => undefined);
    await handleCallback({
      chatId: 'chat-1',
      callbackData: 'cnfm:1:a',
      sessionMap,
      sendInngestEvent,
      logger: makeLogger(),
    });
    const payload = sendInngestEvent.mock.calls[0]![0] as {
      data: { text: string };
    };
    expect(payload.data.text).toBe('anon');
  });

  it('parses the skip suffix correctly', async () => {
    const sessionMap = makeOpenSessionMap();
    const sendInngestEvent = vi.fn(async () => undefined);
    await handleCallback({
      chatId: 'chat-1',
      callbackData: 'cnfm:1:s',
      sessionMap,
      sendInngestEvent,
      logger: makeLogger(),
    });
    const payload = sendInngestEvent.mock.calls[0]![0] as {
      data: { text: string };
    };
    expect(payload.data.text).toBe('skip');
  });
});
