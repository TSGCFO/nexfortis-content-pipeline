/**
 * Pure formatter for the timeout message sent when the 7-day
 * `step.waitForEvent` returns null.
 */

import { escapeHtml } from './escape-html.js';
import type { TerminalMessageInput } from './types.js';

export function buildTimeoutMessage(input: TerminalMessageInput): string {
  const title = escapeHtml(input.proposedTitle);
  return `⏱ This week&#39;s interview for ${title} timed out. The topic will be re-queued in the next synthesis cycle.`;
}
