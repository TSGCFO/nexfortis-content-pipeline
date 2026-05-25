/**
 * Download an audio file from Telegram's CDN given a bot token + relative
 * `file_path` (as returned by Telegram's `getFile` method).
 *
 * Returns a `ReadableStream` of the bytes wrapped in a discriminated
 * result; never throws. Failure messages NEVER include the bot token —
 * a regression test enforces this.
 *
 * The returned stream is the raw `Response.body`. Callers that need a
 * `Buffer` (OpenAI's `audio.transcriptions.create` wants `File`-like input)
 * should buffer the stream themselves; this helper deliberately stays
 * dumb so it can be tested without an OpenAI SDK dependency.
 */

export type DownloadTelegramFileResult =
  | { ok: true; stream: ReadableStream<Uint8Array> }
  | { ok: false; error: string };

export interface DownloadTelegramFileInput {
  token: string;
  /**
   * Relative file path returned by Telegram's `getFile` method (e.g.
   * `'voice/file_42.oga'`). MUST NOT start with a leading slash — the
   * canonical form per the Telegram Bot API docs is the bare path.
   */
  filePath: string;
  fetchFn?: typeof fetch;
}

export async function downloadTelegramFile(
  input: DownloadTelegramFileInput,
): Promise<DownloadTelegramFileResult> {
  const fetchFn = input.fetchFn ?? fetch;
  const url = `https://api.telegram.org/file/bot${input.token}/${input.filePath}`;
  try {
    const response = await fetchFn(url, { method: 'GET' });
    if (!response.ok) {
      return {
        ok: false,
        error: `Telegram file download failed: HTTP ${response.status}`,
      };
    }
    if (response.body === null) {
      return {
        ok: false,
        error: 'Telegram file download returned empty body',
      };
    }
    return { ok: true, stream: response.body };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Redact any accidental token leakage from the underlying error
    // before returning it to the caller / logs.
    const redacted = message.split(input.token).join('***');
    return { ok: false, error: `Telegram file download error: ${redacted}` };
  }
}
