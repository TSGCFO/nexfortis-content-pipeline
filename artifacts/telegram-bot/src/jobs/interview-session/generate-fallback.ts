/**
 * Pure-text builder for the all-skipped fallback question (PRD §7.2 /
 * AC-F2-07).
 *
 * The phrasing is locked by the acceptance criteria — no LLM call
 * involved. We only HTML-escape the candidate `proposedTitle` so the
 * message renders safely under Telegram's `parse_mode: 'HTML'` (a
 * malicious title with `<script>` would otherwise be re-rendered raw on
 * the client).
 */

import { escapeHtml } from './escape-html.js';

/**
 * Returns the exact fallback question Telegram receives when every
 * confirmation question was skipped. Format mirrors AC-F2-07:
 *
 *   Anything on [topic] from your recent work we should know about
 *   before drafting?
 *
 * The topic is wrapped in `<b>...</b>` so it visually stands out in
 * Telegram's chat UI without depending on Markdown rendering (we use
 * `parse_mode: 'HTML'` everywhere in this artifact — see
 * `send-telegram-message.ts`).
 */
export function buildFallbackQuestion(proposedTitle: string): string {
  const title = escapeHtml(proposedTitle);
  return `Anything on <b>${title}</b> from your recent work we should know about before drafting?`;
}
