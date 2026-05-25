/**
 * Pure formatter for the "/skip acknowledged" message sent when Hassan
 * replies `/skip` to the preview.
 */

import { escapeHtml } from './escape-html.js';
import type { TerminalMessageInput } from './types.js';

export function buildSkipAckMessage(input: TerminalMessageInput): string {
  const title = escapeHtml(input.proposedTitle);
  return `👍 Skipped. The ${title} candidate is archived for this week. You&#39;ll hear from me next Monday.`;
}
