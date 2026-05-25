/**
 * Outbound-only Telegram sender for the interview-session function.
 *
 * Direct POST to `https://api.telegram.org/bot<token>/sendMessage`. This is
 * a thin direct-fetch wrapper modeled on
 * `artifacts/synthesis-worker/src/jobs/synthesize-weekly/send-telegram-preview.ts`.
 *
 * **grammY is deliberately NOT used in PR 1.** It arrives in PR 2 when we
 * need long-polling, inline keyboards, and callback queries. PR 1 only
 * needs to *send* outbound messages from the cron handler — direct `fetch`
 * is sufficient and avoids pulling in a dependency we don't yet need.
 *
 * **Escaping policy:** This function does NOT escape HTML characters in
 * `message`. Escaping is the caller's responsibility (handled by the
 * `build-*-message.ts` formatters). Re-escaping here would double-encode
 * already-escaped entities (e.g. `&amp;` would become `&amp;amp;`).
 *
 * Failure handling: returns `{ ok: false, error }` on any HTTP error,
 * non-`ok: true` Telegram body, empty body, or thrown fetch error.
 * **Never throws** — a preview send failure must not abort an Inngest run
 * whose session row has already been inserted.
 */

import type { TelegramSendResult } from './types.js';

export interface SendTelegramMessageOptions {
  token: string;
  chatId: string;
  message: string;
  /** Injectable for tests. Defaults to the global `fetch`. */
  fetchFn?: typeof fetch;
  /**
   * Optional inline-keyboard rows. Forwarded verbatim into Telegram's
   * `reply_markup.inline_keyboard`. PR 2 uses this for the three
   * confirmation buttons; PR 1 left it unset.
   */
  replyMarkup?: ReadonlyArray<
    ReadonlyArray<{ text: string; callback_data: string }>
  >;
}

interface TelegramApiBody {
  ok?: boolean;
  description?: string;
  error_code?: number;
}

export async function sendTelegramMessage(
  opts: SendTelegramMessageOptions,
): Promise<TelegramSendResult> {
  const fetchFn = opts.fetchFn ?? fetch;
  const url = `https://api.telegram.org/bot${opts.token}/sendMessage`;

  try {
    const requestBody: Record<string, unknown> = {
      chat_id: opts.chatId,
      text: opts.message,
      parse_mode: 'HTML',
    };
    if (opts.replyMarkup !== undefined) {
      requestBody['reply_markup'] = {
        inline_keyboard: opts.replyMarkup.map((row) => [...row]),
      };
    }
    const response = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    let responseBody: TelegramApiBody | null = null;
    try {
      responseBody = (await response.json()) as TelegramApiBody;
    } catch {
      responseBody = null;
    }

    if (!response.ok) {
      const desc = responseBody?.description ?? `HTTP ${response.status}`;
      return { ok: false, error: `Telegram sendMessage failed: ${desc}` };
    }
    if (!responseBody) {
      return {
        ok: false,
        error: 'Telegram sendMessage returned empty/unparseable body',
      };
    }
    if (responseBody.ok !== true) {
      const desc = responseBody.description ?? 'unknown';
      return { ok: false, error: `Telegram returned ok=false: ${desc}` };
    }
    return { ok: true, error: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Telegram fetch error: ${message}` };
  }
}
