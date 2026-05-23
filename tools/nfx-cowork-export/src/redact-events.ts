/**
 * PII regex pass applied across an `Event[]` tree.
 *
 * Per the locked spec ("PII regex runs in the exporter, not just the
 * ingester"), this slice applies the shared `regexPass` from `@ncp/redaction`
 * to every text-bearing field on every emitted event before the JSON file
 * is written to disk. The Haiku LLM scrub (Pass 2 from the redaction module)
 * is the INGESTER's job — running it in the exporter would require an
 * Anthropic API key on every laptop and would slow the local run by orders of
 * magnitude. Defense in depth: regex now, LLM scrub later.
 *
 * Fields redacted (per event kind):
 *   - user_text:      .text
 *   - assistant_text: .text
 *   - tool_call:      .summary (when present; tool_call .tool name is left alone)
 *   - subagent:       recurses into .events
 *
 * The function is pure — it returns a NEW event tree with no shared
 * references back to the input. Original event objects are not mutated.
 *
 * Returns a summary of the redaction work for the audit log.
 */

import { regexPass } from '@ncp/redaction';
import type { RegexPassResult } from '@ncp/redaction';

import type { Event } from './schema.js';

export interface RedactionSummary {
  /** Number of events whose text was scanned (sum across all kinds + recursion). */
  scannedTextFields: number;
  /** Number of replacements made across all events. */
  totalReplacements: number;
  /** Breakdown by PII type (email, phone, sin, card, ip, ...). */
  replacementsByType: Record<string, number>;
}

export interface RedactEventsResult {
  events: Event[];
  summary: RedactionSummary;
}

/**
 * Apply the regex pass to every text-bearing field on every event in the
 * input tree, recursing through subagent envelopes.
 */
export function redactEventTree(events: readonly Event[]): RedactEventsResult {
  const summary: RedactionSummary = {
    scannedTextFields: 0,
    totalReplacements: 0,
    replacementsByType: {},
  };

  function redactString(s: string): string {
    summary.scannedTextFields += 1;
    if (s.length === 0) return s;
    const result: RegexPassResult = regexPass(s);
    if (result.log.length > 0) {
      summary.totalReplacements += result.log.length;
      for (const entry of result.log) {
        const t = entry.type;
        summary.replacementsByType[t] = (summary.replacementsByType[t] ?? 0) + 1;
      }
    }
    return result.redacted;
  }

  function walk(input: readonly Event[]): Event[] {
    return input.map((e) => redactOne(e));
  }

  function redactOne(e: Event): Event {
    switch (e.kind) {
      case 'user_text':
        return { ...e, text: redactString(e.text) };
      case 'assistant_text':
        return { ...e, text: redactString(e.text) };
      case 'tool_call': {
        if (e.summary !== undefined && e.summary.length > 0) {
          let redactedSummary = redactString(e.summary);
          // Redaction can make a string LONGER ([REDACTED_EMAIL] is 16 chars
          // and may replace a shorter email). The schema caps summary at 80
          // chars — re-clamp here to stay within that invariant.
          if (redactedSummary.length > 80) {
            redactedSummary = redactedSummary.slice(0, 80);
          }
          return { ...e, summary: redactedSummary };
        }
        return { ...e };
      }
      case 'subagent':
        return { ...e, events: walk(e.events) };
    }
  }

  return { events: walk(events), summary };
}
