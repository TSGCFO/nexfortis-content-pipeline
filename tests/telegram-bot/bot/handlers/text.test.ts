import { describe, expect, it, vi } from 'vitest';

import { createTextHandler } from '../../../../artifacts/telegram-bot/src/bot/handlers/text.js';
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

function withActiveSession(): SessionMap {
  const sm = new SessionMap();
  sm.recordOpened('123', {
    sessionId: 'sess-X',
    candidateId: 'cand-X',
    openedAt: new Date('2026-05-25T12:00:00Z'),
  });
  return sm;
}

describe('createTextHandler', () => {
  it('dispatches telegram.message.received with sessionId from the map', async () => {
    const logger = makeLogger();
    const send = vi.fn(async () => undefined);
    const handler = createTextHandler({
      sessionMap: withActiveSession(),
      sendInngestEvent: send,
      logger,
    });
    await handler({ chat: { id: 123 }, message: { text: 'hello' } });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toEqual({
      name: 'telegram.message.received',
      data: {
        chatId: '123',
        sessionId: 'sess-X',
        text: 'hello',
        messageType: 'text',
      },
    });
  });

  it('no active session: logs a warn and does NOT dispatch', async () => {
    const logger = makeLogger();
    const send = vi.fn(async () => undefined);
    const handler = createTextHandler({
      sessionMap: new SessionMap(),
      sendInngestEvent: send,
      logger,
    });
    await handler({ chat: { id: 999 }, message: { text: 'hello' } });
    expect(send).not.toHaveBeenCalled();
    const warn = (logger.warn as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) =>
        (c[0] as Record<string, unknown>)['action'] ===
        'text_no_active_session',
    );
    expect(warn).toBeDefined();
  });

  it('preserves an HTML-injection payload in the event text (escape is the receiver\'s job)', async () => {
    const logger = makeLogger();
    const send = vi.fn(async () => undefined);
    const handler = createTextHandler({
      sessionMap: withActiveSession(),
      sendInngestEvent: send,
      logger,
    });
    await handler({
      chat: { id: 123 },
      message: { text: '<script>alert(1)</script>' },
    });
    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0]![0];
    expect(payload.data.text).toBe('<script>alert(1)</script>');
  });

  it('does not throw when sendInngestEvent rejects (caught + logged)', async () => {
    const logger = makeLogger();
    const send = vi.fn(async () => {
      throw new Error('Inngest down');
    });
    const handler = createTextHandler({
      sessionMap: withActiveSession(),
      sendInngestEvent: send,
      logger,
    });
    await expect(
      handler({ chat: { id: 123 }, message: { text: 'hi' } }),
    ).resolves.toBeUndefined();
    const err = (logger.error as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) =>
        (c[0] as Record<string, unknown>)['action'] === 'text_handler_threw',
    );
    expect(err).toBeDefined();
  });

  it('silently ignores updates with no chat or no text body (service messages)', async () => {
    const logger = makeLogger();
    const send = vi.fn(async () => undefined);
    const handler = createTextHandler({
      sessionMap: withActiveSession(),
      sendInngestEvent: send,
      logger,
    });
    await handler({ chat: undefined, message: { text: 'x' } });
    await handler({ chat: { id: 123 }, message: undefined });
    await handler({ chat: { id: 123 }, message: { text: undefined } });
    expect(send).not.toHaveBeenCalled();
  });
});
