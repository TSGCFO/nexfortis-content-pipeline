/**
 * Pure formatter for the `/status` command's reply message (PRD §4.8).
 *
 * Takes a read-only `StatusSnapshot` produced by the command handler's
 * DB-fetch helper and returns the formatted Telegram message body
 * (`parse_mode: 'HTML'`).
 *
 * Every user-derived value is HTML-escaped — same defensive policy as
 * PR 1's `build-*-message.ts` formatters. The literal labels themselves
 * are static (no interpolation possible).
 *
 * Pure. No I/O. Deterministic — same input → same output (regression
 * test pinned in `tests/telegram-bot/bot/handlers/status-builder.test.ts`).
 */

import { escapeHtml } from '../../jobs/interview-session/escape-html.js';
import type { StatusSnapshot } from '../../jobs/interview-session/types.js';

const SECTION_BREAK = '\n\n';

function fmtTimestamp(d: Date | null): string {
  if (d === null) return 'never';
  // ISO 8601 — concise, unambiguous, parses identically on every
  // platform. Hassan will be reading this on his phone so we want it
  // compact rather than localised.
  return escapeHtml(d.toISOString());
}

export function buildStatusMessage(snapshot: StatusSnapshot): string {
  const lines: string[] = [];
  lines.push('📊 <b>Pipeline status</b>');
  lines.push('');
  lines.push(`Signals captured (last 7 days): ${snapshot.signalsLast7Days}`);
  lines.push(`Last synthesis run: ${fmtTimestamp(snapshot.lastSynthesisAt)}`);
  lines.push(SECTION_BREAK.trimEnd());

  if (snapshot.activeCandidate === null) {
    lines.push('No active candidate.');
  } else {
    lines.push(
      `Current candidate: <b>${escapeHtml(snapshot.activeCandidate.proposedTitle)}</b>`,
    );
    lines.push(
      `Candidate status: ${escapeHtml(snapshot.activeCandidate.status)}`,
    );
  }

  lines.push(SECTION_BREAK.trimEnd());

  if (snapshot.activeSessionStatus === null) {
    lines.push('No session in progress.');
  } else {
    lines.push(
      `Session status: ${escapeHtml(snapshot.activeSessionStatus)}`,
    );
    lines.push(
      `Questions sent this session: ${snapshot.questionsSentThisSession}`,
    );
  }

  return lines.join('\n');
}
