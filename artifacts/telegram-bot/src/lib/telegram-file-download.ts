/**
 * Download a Telegram-hosted file (voice note in this artifact) over HTTPS
 * and return a `ReadableStream` of the audio bytes ready to hand to
 * Whisper.
 *
 * `bot.api.getFile(file_id)` returns a relative `file_path` on Telegram's
 * CDN. The fully-qualified URL is then:
 *
 *   https://api.telegram.org/file/bot<token>/<file_path>
 *
 * Failure handling:
 *   - Never throws. Always returns a discriminated `Result`.
 *   - The returned error string MUST NOT contain the bot token; the
 *     `redactToken` helper scrubs it before returning.
 *   - Non-200 statuses, network errors, and missing response bodies all
 *     produce `{ ok: false, error }`.
 *
 * The caller (`bot/handlers/voice.ts`) is responsible for getting the
 * `file_path` via grammY's `bot.api.getFile`. This module accepts the
 * already-resolved `file_path` so it can be exercised end-to-end in tests
 * without standing up a fake grammY.
 */

export interface DownloadTelegramFileInput {
  token: string;
  filePath: string;
  /** Injectable for tests; defaults to the global `fetch`. */
  fetchFn?: typeof fetch;
}

export type DownloadTelegramFileResult =
  | { ok: true; stream: ReadableStream<Uint8Array> }
  | { ok: false; error: string };

function redactToken(message: string, token: string): string {
  if (token.length === 0) return message;
  // Replace literal `bot<token>` and bare token occurrences.
  const replaced = message.split(`bot${token}`).join('bot<redacted>');
  return replaced.split(token).join('<redacted>');
}

export async function downloadTelegramFile(
  input: DownloadTelegramFileInput,
): Promise<DownloadTelegramFileResult> {
  const fetchFn = input.fetchFn ?? fetch;
  const url = `https://api.telegram.org/file/bot${input.token}/${input.filePath}`;
  try {
    const response = await fetchFn(url);
    if (!response.ok) {
      return {
        ok: false,
        error: redactToken(
          `telegram file download failed: HTTP ${response.status}`,
          input.token,
        ),
      };
    }
    const stream = response.body;
    if (stream === null) {
      return {
        ok: false,
        error: 'telegram file download returned empty body',
      };
    }
    return { ok: true, stream };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: redactToken(`telegram file download error: ${message}`, input.token),
    };
  }
}
