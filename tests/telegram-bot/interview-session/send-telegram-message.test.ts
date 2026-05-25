/**
 * Unit tests for `sendTelegramMessage`. Mocks `fetchFn` only.
 */

import { describe, expect, it, vi } from 'vitest';

import { sendTelegramMessage } from '../../../artifacts/telegram-bot/src/jobs/interview-session/send-telegram-message.js';

describe('sendTelegramMessage', () => {
  it('returns { ok: true } and POSTs the correct URL + body on 200 success', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, result: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const result = await sendTelegramMessage({
      token: 'BOTTOKEN',
      chatId: '12345',
      message: 'Hello',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: true, error: undefined });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(String(url)).toBe(
      'https://api.telegram.org/botBOTTOKEN/sendMessage',
    );
    const initObj = init as RequestInit;
    expect(initObj.method).toBe('POST');
    const body = JSON.parse(initObj.body as string) as Record<string, unknown>;
    expect(body).toEqual({
      chat_id: '12345',
      text: 'Hello',
      parse_mode: 'HTML',
    });
  });

  it('returns { ok: false } when Telegram body has ok=false (does not throw)', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ ok: false, description: 'chat not found' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );
    const result = await sendTelegramMessage({
      token: 't',
      chatId: 'c',
      message: 'm',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/chat not found/);
  });

  it('returns { ok: false } on HTTP 500 (does not throw)', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ ok: false, description: 'internal error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
    );
    const result = await sendTelegramMessage({
      token: 't',
      chatId: 'c',
      message: 'm',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/500|internal error/);
  });

  it('returns { ok: false } when fetchFn throws (network error, does not throw)', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    const result = await sendTelegramMessage({
      token: 't',
      chatId: 'c',
      message: 'm',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/ECONNRESET/);
  });

  it('does not include the bot token in the returned error string (regression guard)', async () => {
    const SECRET_TOKEN = 'super-secret-token-xyz-987';
    // Trigger the network-error branch with a thrown fetchFn.
    const fetchFnThrow = vi.fn(async () => {
      throw new Error('boom');
    });
    const r1 = await sendTelegramMessage({
      token: SECRET_TOKEN,
      chatId: 'c',
      message: 'm',
      fetchFn: fetchFnThrow as unknown as typeof fetch,
    });
    expect(r1.error).toBeDefined();
    expect(r1.error).not.toContain(SECRET_TOKEN);

    // Trigger the HTTP-failure branch.
    const fetchFn500 = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: false, description: 'd' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const r2 = await sendTelegramMessage({
      token: SECRET_TOKEN,
      chatId: 'c',
      message: 'm',
      fetchFn: fetchFn500 as unknown as typeof fetch,
    });
    expect(r2.error).toBeDefined();
    expect(r2.error).not.toContain(SECRET_TOKEN);

    // Trigger the ok=false branch.
    const fetchFnOkFalse = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: false, description: 'd' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const r3 = await sendTelegramMessage({
      token: SECRET_TOKEN,
      chatId: 'c',
      message: 'm',
      fetchFn: fetchFnOkFalse as unknown as typeof fetch,
    });
    expect(r3.error).toBeDefined();
    expect(r3.error).not.toContain(SECRET_TOKEN);
  });

  it('returns a descriptive error when response body is empty (does not throw)', async () => {
    // 200 with body that parses to `{}` (no `ok` field).
    const fetchFn = vi.fn(
      async () =>
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const result = await sendTelegramMessage({
      token: 't',
      chatId: 'c',
      message: 'm',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.length).toBeGreaterThan(0);
  });
});
