/**
 * Tests for `downloadTelegramFile`. Mocks the global fetch.
 */

import { describe, expect, it, vi } from 'vitest';

import { downloadTelegramFile } from '../../../artifacts/telegram-bot/src/lib/telegram-file-download.js';

function makeFetchOk(): ReturnType<typeof vi.fn> {
  return vi.fn(async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    });
    return new Response(stream, { status: 200 });
  });
}

describe('downloadTelegramFile', () => {
  it('happy path: returns { ok: true, stream } for a 200 response', async () => {
    const fetchFn = makeFetchOk();
    const result = await downloadTelegramFile({
      token: 'TOKEN',
      filePath: 'voice/file_1.oga',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.stream).toBeInstanceOf(ReadableStream);
  });

  it('returns { ok: false, error } when the response is 404', async () => {
    const fetchFn = vi.fn(async () => new Response('not found', { status: 404 }));
    const result = await downloadTelegramFile({
      token: 'TOKEN',
      filePath: 'voice/missing.oga',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/404/);
  });

  it('returns { ok: false } when fetch throws (does NOT throw)', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('boom');
    });
    const result = await downloadTelegramFile({
      token: 'TOKEN',
      filePath: 'voice/file_1.oga',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/boom/);
  });

  it('constructs the URL with the bot token interpolated correctly', async () => {
    const fetchFn = makeFetchOk();
    await downloadTelegramFile({
      token: 'TOKEN_42',
      filePath: 'voice/file_1.oga',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const url = fetchFn.mock.calls[0]![0] as string;
    expect(url).toBe('https://api.telegram.org/file/botTOKEN_42/voice/file_1.oga');
  });

  it('returned error does NOT contain the bot token (regression guard)', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED https://api.telegram.org/file/botSECRET_TOK_99/path');
    });
    const result = await downloadTelegramFile({
      token: 'SECRET_TOK_99',
      filePath: 'voice/file_1.oga',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).not.toContain('SECRET_TOK_99');
      expect(result.error).toContain('<redacted>');
    }
  });
});
