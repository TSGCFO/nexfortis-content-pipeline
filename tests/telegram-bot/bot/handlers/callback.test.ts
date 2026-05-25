import { describe, expect, it, vi } from 'vitest';

import { createCallbackHandler } from '../../../../artifacts/telegram-bot/src/bot/handlers/callback.js';
import { SessionMap } from '../../../../artifacts/telegram-bot/src/bot/session-map.js';
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

function withActive(): SessionMap {
  const sm = new SessionMap();
  sm.recordOpened('CHAT', {
    sessionId: 'sess-1',
    candidateId: 'cand-1',
    openedAt: new Date('2026-05-25T12:00:00Z'),
  });
  return sm;
}

describe('createCallbackHandler', () => {
  it('parses cnfm:2:y and dispatches with callbackData + canonical text="yes"', async () => {
    const send = vi.fn(async () => undefined);
    const ack = vi.fn(async () => undefined);
    const handler = createCallbackHandler({
      sessionMap: withActive(),
      sendInngestEvent: send,
      logger: makeLogger(),
    });
    await handler({
      chat: { id: 'CHAT' },
      callbackQuery: { data: 'cnfm:2:y' },
      answerCallbackQuery: ack,
    });
    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0]![0];
    expect(payload.data.messageType).toBe('callback');
    expect(payload.data.callbackData).toEqual({
      questionIndex: 2,
      choice: 'yes',
    });
    expect(payload.data.text).toBe('yes');
    // Spinner dismissed
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it('malformed callback_data: logs a warn, dismisses spinner, does NOT dispatch', async () => {
    const send = vi.fn(async () => undefined);
    const ack = vi.fn(async () => undefined);
    const logger = makeLogger();
    const handler = createCallbackHandler({
      sessionMap: withActive(),
      sendInngestEvent: send,
      logger,
    });
    await handler({
      chat: { id: 'CHAT' },
      callbackQuery: { data: 'garbage' },
      answerCallbackQuery: ack,
    });
    expect(send).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);
    const warn = (logger.warn as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) =>
        (c[0] as Record<string, unknown>)['action'] ===
        'callback_invalid_data',
    );
    expect(warn).toBeDefined();
  });

  it('no active session: logs a warn, dismisses spinner, does NOT dispatch', async () => {
    const send = vi.fn(async () => undefined);
    const ack = vi.fn(async () => undefined);
    const logger = makeLogger();
    const handler = createCallbackHandler({
      sessionMap: new SessionMap(),
      sendInngestEvent: send,
      logger,
    });
    await handler({
      chat: { id: 'CHAT' },
      callbackQuery: { data: 'cnfm:1:y' },
      answerCallbackQuery: ack,
    });
    expect(send).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);
    const warn = (logger.warn as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) =>
        (c[0] as Record<string, unknown>)['action'] ===
        'callback_no_active_session',
    );
    expect(warn).toBeDefined();
  });

  it('parses cnfm:3:a → choice="anon"', async () => {
    const send = vi.fn(async () => undefined);
    const ack = vi.fn(async () => undefined);
    const handler = createCallbackHandler({
      sessionMap: withActive(),
      sendInngestEvent: send,
      logger: makeLogger(),
    });
    await handler({
      chat: { id: 'CHAT' },
      callbackQuery: { data: 'cnfm:3:a' },
      answerCallbackQuery: ack,
    });
    expect(send.mock.calls[0]![0].data.callbackData.choice).toBe('anon');
  });

  it('parses cnfm:4:s → choice="skip"', async () => {
    const send = vi.fn(async () => undefined);
    const ack = vi.fn(async () => undefined);
    const handler = createCallbackHandler({
      sessionMap: withActive(),
      sendInngestEvent: send,
      logger: makeLogger(),
    });
    await handler({
      chat: { id: 'CHAT' },
      callbackQuery: { data: 'cnfm:4:s' },
      answerCallbackQuery: ack,
    });
    expect(send.mock.calls[0]![0].data.callbackData.choice).toBe('skip');
  });

  it('does NOT throw if sendInngestEvent rejects (caught + logged)', async () => {
    const send = vi.fn(async () => {
      throw new Error('Inngest unreachable');
    });
    const logger = makeLogger();
    const handler = createCallbackHandler({
      sessionMap: withActive(),
      sendInngestEvent: send,
      logger,
    });
    await expect(
      handler({
        chat: { id: 'CHAT' },
        callbackQuery: { data: 'cnfm:1:y' },
        answerCallbackQuery: vi.fn(async () => undefined),
      }),
    ).resolves.toBeUndefined();
    const err = (logger.error as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) =>
        (c[0] as Record<string, unknown>)['action'] ===
        'callback_handler_threw',
    );
    expect(err).toBeDefined();
  });
});
