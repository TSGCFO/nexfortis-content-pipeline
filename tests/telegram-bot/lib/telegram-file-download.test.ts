import { describe, expect, it, vi } from 'vitest';

import { downloadTelegramFile } from '../../../artifacts/telegram-bot/src/lib/telegram-file-download.js';

const TOKEN = 'SECRET-BOT-TOKEN-12345';
const FILE_PATH = 'voice/file_42.oga';

function makeBodyStream(payload: string): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(enc.encode(payload));
      controller.close();
    },
  });
}

describe('downloadTelegramFile', () => {
  it('returns { ok: true, stream } on a 200 response', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(makeBodyStream('audio-bytes'), {
          status: 200,
        }),
    );
    const r = await downloadTelegramFile({
      token: TOKEN,
      filePath: FILE_PATH,
      fetchFn,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.stream).toBeDefined();
    }
  });

  it('returns { ok: false, error } on a 404 response', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 404 }));
    const r = await downloadTelegramFile({
      token: TOKEN,
      filePath: FILE_PATH,
      fetchFn,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/404/);
    }
  });

  it('returns { ok: false, error } when fetch throws (does NOT throw itself)', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('network unreachable');
    });
    const r = await downloadTelegramFile({
      token: TOKEN,
      filePath: FILE_PATH,
      fetchFn,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/network unreachable/);
    }
  });

  it('constructs the URL with the token in the path (verified via fetch call args)', async () => {
    const fetchFn = vi.fn(
      async () => new Response(makeBodyStream(''), { status: 200 }),
    );
    await downloadTelegramFile({
      token: TOKEN,
      filePath: FILE_PATH,
      fetchFn,
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const url = fetchFn.mock.calls[0]![0] as string;
    expect(url).toBe(
      `https://api.telegram.org/file/bot${TOKEN}/${FILE_PATH}`,
    );
  });

  it('returned error string does NOT contain the bot token (regression guard)', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error(`upstream error involving ${TOKEN} somewhere`);
    });
    const r = await downloadTelegramFile({
      token: TOKEN,
      filePath: FILE_PATH,
      fetchFn,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).not.toContain(TOKEN);
      expect(r.error).toContain('***');
    }
  });

  it('returns { ok: false } when response.body is null (defensive)', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }));
    const r = await downloadTelegramFile({
      token: TOKEN,
      filePath: FILE_PATH,
      fetchFn,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/empty body/);
    }
  });
});
