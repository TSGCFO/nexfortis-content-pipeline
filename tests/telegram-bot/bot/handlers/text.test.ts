/**
 * Tests for `handleTextMessage` — the pure logic backing the grammY text
 * handler. The grammY wrapper is not exercised here; the unit test calls
 * the logic directly with hand-built deps.
 */

import { describe, expect, it, vi } from 'vitest';

import { handleTextMessage } from '../../../../artifacts/telegram-bot/src/bot/handlers/text.js';
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

describe('handleTextMessage', () => {
  it('dispatches a telegram.message.received event when the chat has an active session', async () => {
    const sessionMap = createSessionMap();
    sessionMap.recordOpened('chat-1', {
      sessionId: 'sess-1',
      candidateId: 'cand-1',
      openedAt: new Date(),
    });
    const sendInngestEvent = vi.fn(async () => undefined);
    await handleTextMessage({
      chatId: 'chat-1',
      text: 'ok lets do it',
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
        messageType: 'text',
        text: 'ok lets do it',
      },
    });
  });

  it('does NOT dispatch when no active session for the chat (warn only)', async () => {
    const sessionMap = createSessionMap();
    const sendInngestEvent = vi.fn(async () => undefined);
    const logger = makeLogger();
    await handleTextMessage({
      chatId: 'unknown',
      text: 'hi',
      sessionMap,
      sendInngestEvent,
      logger,
    });
    expect(sendInngestEvent).not.toHaveBeenCalled();
    expect((logger.warn as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it('forwards HTML in text verbatim into the event payload (no double-escaping)', async () => {
    const sessionMap = createSessionMap();
    sessionMap.recordOpened('chat-1', {
      sessionId: 'sess-1',
      candidateId: 'cand-1',
      openedAt: new Date(),
    });
    const sendInngestEvent = vi.fn(async () => undefined);
    await handleTextMessage({
      chatId: 'chat-1',
      text: '<script>alert(1)</script>',
      sessionMap,
      sendInngestEvent,
      logger: makeLogger(),
    });
    const payload = sendInngestEvent.mock.calls[0]![0] as {
      data: { text: string };
    };
    expect(payload.data.text).toBe('<script>alert(1)</script>');
  });

  it('forwards "/skip" text into the event payload exactly', async () => {
    const sessionMap = createSessionMap();
    sessionMap.recordOpened('chat-1', {
      sessionId: 'sess-1',
      candidateId: 'cand-1',
      openedAt: new Date(),
    });
    const sendInngestEvent = vi.fn(async () => undefined);
    await handleTextMessage({
      chatId: 'chat-1',
      text: '/skip',
      sessionMap,
      sendInngestEvent,
      logger: makeLogger(),
    });
    const payload = sendInngestEvent.mock.calls[0]![0] as {
      data: { text: string };
    };
    expect(payload.data.text).toBe('/skip');
  });
});
