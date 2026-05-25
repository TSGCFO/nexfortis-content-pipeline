/**
 * Pure formatter for the Monday-morning topic preview message (PRD §4.2).
 *
 * Sent via Telegram with `parse_mode: 'HTML'`. All interpolated values are
 * HTML-escaped here; the sender does NOT re-escape (avoiding double-encoding).
 *
 * The apostrophe in "week's" / "You'll" is rendered as the HTML entity
 * `&#39;` per the prompt — Telegram's HTML parse mode renders it as a
 * normal apostrophe while keeping the source defensible against future
 * parser changes.
 */

import { escapeHtml } from './escape-html.js';
import type { PreviewMessageInput } from './types.js';

export function buildPreviewMessage(input: PreviewMessageInput): string {
  const title = escapeHtml(input.proposedTitle);
  const pillar = escapeHtml(input.pillar);
  const keyword = escapeHtml(input.primaryKeyword);
  const noun = input.signalCount === 1 ? 'thing' : 'things';
  return [
    `📋 <b>This week&#39;s article:</b> ${title}`,
    `Pillar: ${pillar}`,
    `Target keyword: ${keyword}`,
    '',
    `I found ${input.signalCount} ${noun} in your work this week that could make this article concrete.`,
    'Quick confirm? Takes about 5 minutes.',
    '',
    'Reply anything to start, or /skip to skip this week.',
  ].join('\n');
}
