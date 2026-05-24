import { describe, expect, it, vi } from 'vitest';

import {
  buildPreviewMessage,
  escapeTelegramHtml,
  sendTelegramPreview,
} from '../../../artifacts/synthesis-worker/src/jobs/synthesize-weekly/send-telegram-preview.js';

describe('sendTelegramPreview', () => {
  it('POSTs to the Telegram sendMessage URL and returns ok on success', async () => {
    const fetchFn = vi.fn(async (_url, _init) => {
      return new Response(JSON.stringify({ ok: true, result: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const result = await sendTelegramPreview({
      token: 'BOTTOKEN',
      chatId: '12345',
      message: 'Hello',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: true, error: undefined });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(String(url)).toBe('https://api.telegram.org/botBOTTOKEN/sendMessage');
    expect(init).toBeDefined();
    const initObj = init as RequestInit;
    expect(initObj.method).toBe('POST');
    const body = JSON.parse(initObj.body as string) as Record<string, unknown>;
    expect(body).toEqual({
      chat_id: '12345',
      text: 'Hello',
      parse_mode: 'HTML',
    });
  });

  it('returns { ok: false, error } when Telegram responds with HTTP 500', async () => {
    const fetchFn = vi.fn(async () => {
      return new Response(
        JSON.stringify({ ok: false, description: 'internal error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    });
    const result = await sendTelegramPreview({
      token: 't',
      chatId: 'c',
      message: 'm',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/internal error|500/);
  });

  it('catches network errors and returns { ok: false, error } without throwing', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    const result = await sendTelegramPreview({
      token: 't',
      chatId: 'c',
      message: 'm',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/ECONNRESET/);
  });

  it('returns { ok: false } when Telegram returns 200 with body ok=false', async () => {
    const fetchFn = vi.fn(async () => {
      return new Response(
        JSON.stringify({ ok: false, description: 'chat not found' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    const result = await sendTelegramPreview({
      token: 't',
      chatId: 'c',
      message: 'm',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/chat not found/);
  });
});

describe('buildPreviewMessage / escapeTelegramHtml', () => {
  it('HTML-escapes the title, pillar, and embeds the signal count', () => {
    const msg = buildPreviewMessage({
      title: 'Title <with> & brackets',
      pillar: 'managed-it',
      signalCount: 7,
    });
    expect(msg).toContain('Title &lt;with&gt; &amp; brackets');
    expect(msg).toContain('Pillar: managed-it');
    expect(msg).toContain('Signals clustered: 7');
    expect(msg).toContain('Interview starts Monday morning.');
  });

  it('escapeTelegramHtml escapes &, <, > in order', () => {
    expect(escapeTelegramHtml('a < b & c > d')).toBe(
      'a &lt; b &amp; c &gt; d',
    );
  });
});
