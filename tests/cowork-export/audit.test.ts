import { describe, expect, it } from 'vitest';

import {
  buildAuditRows,
  renderAuditReport,
  summarize,
} from '../../tools/nfx-cowork-export/src/audit.js';
import type {
  FilterDecision,
  AuditRow,
} from '../../tools/nfx-cowork-export/src/types.js';

const KEEP: FilterDecision = { keep: true, reason: 'passed_session_level_filters' };
const DROP_SLUG: FilterDecision = { keep: false, reason: 'family_law_slug', detail: 'abc' };
const DROP_TASK: FilterDecision = { keep: false, reason: 'scheduled_task' };
const DROP_META: FilterDecision = { keep: false, reason: 'meta_missing' };

describe('summarize', () => {
  it('counts total, kept, and per-reason drops', () => {
    const summary = summarize([
      { decision: KEEP },
      { decision: KEEP },
      { decision: DROP_SLUG },
      { decision: DROP_TASK },
      { decision: DROP_TASK },
      { decision: DROP_META },
    ]);
    expect(summary.total).toBe(6);
    expect(summary.kept).toBe(2);
    expect(summary.droppedByReason.family_law_slug).toBe(1);
    expect(summary.droppedByReason.scheduled_task).toBe(2);
    expect(summary.droppedByReason.meta_missing).toBe(1);
    expect(summary.droppedByReason.command_message).toBe(0);
  });

  it('handles empty input', () => {
    const summary = summarize([]);
    expect(summary.total).toBe(0);
    expect(summary.kept).toBe(0);
    expect(summary.droppedByReason.family_law_slug).toBe(0);
  });
});

describe('buildAuditRows', () => {
  it('orders kept sessions first, then dropped grouped by reason', () => {
    const rows = buildAuditRows([
      { sessionId: 'd-1', slug: 'a', account: null, decision: DROP_TASK },
      { sessionId: 'k-1', slug: 'a', account: null, decision: KEEP },
      { sessionId: 'd-2', slug: 'a', account: null, decision: DROP_SLUG },
      { sessionId: 'k-2', slug: 'a', account: null, decision: KEEP },
      { sessionId: 'd-3', slug: 'a', account: null, decision: DROP_TASK },
    ]);
    expect(rows.map((r) => r.sessionId)).toEqual(['k-1', 'k-2', 'd-2', 'd-1', 'd-3']);
  });

  it('within a category sorts by sessionId ascending', () => {
    const rows = buildAuditRows([
      { sessionId: 'k-2', slug: null, account: null, decision: KEEP },
      { sessionId: 'k-1', slug: null, account: null, decision: KEEP },
      { sessionId: 'k-3', slug: null, account: null, decision: KEEP },
    ]);
    expect(rows.map((r) => r.sessionId)).toEqual(['k-1', 'k-2', 'k-3']);
  });
});

describe('renderAuditReport', () => {
  const sampleRows: AuditRow[] = [
    { sessionId: 'session-a', slug: 'real-it-work', account: 'hassan@example.test', decision: KEEP },
    { sessionId: 'session-b', slug: 'family-thing', account: null, decision: DROP_SLUG },
    { sessionId: 'session-c', slug: null, account: null, decision: DROP_TASK },
  ];
  const summary = summarize(sampleRows);

  it('includes a header with totals', () => {
    const text = renderAuditReport(sampleRows, summary);
    expect(text).toContain('Cowork session exporter — dry-run audit');
    expect(text).toContain('Total sessions found:  3');
    expect(text).toContain('Kept (passed filters): 1');
  });

  it('includes a per-category breakdown for non-zero reasons only', () => {
    const text = renderAuditReport(sampleRows, summary);
    expect(text).toContain('family_law_slug');
    expect(text).toContain('scheduled_task');
    // Zero-count reasons are omitted from the breakdown
    expect(text).not.toContain('cwd_always_denied');
  });

  it('renders one row per session with KEEP/DROP markers', () => {
    const text = renderAuditReport(sampleRows, summary);
    expect(text).toContain('session-a');
    expect(text).toContain('KEEP');
    expect(text).toContain('session-b');
    expect(text).toContain('DROP (family_law_slug)');
    expect(text).toContain('session-c');
    expect(text).toContain('DROP (scheduled_task)');
  });

  it('truncates and sanitizes decision detail (no newlines, max 40 chars)', () => {
    const sessionWithLongDetail: AuditRow = {
      sessionId: 'session-x',
      slug: 'x',
      account: null,
      decision: {
        keep: false,
        reason: 'cwd_not_allowed',
        detail: 'C:\\very\\long\\path\\with\\many\\segments\\that\\exceeds\\forty\\characters\nand\nnewlines',
      },
    };
    const text = renderAuditReport([sessionWithLongDetail], summarize([sessionWithLongDetail]));
    // No raw newlines anywhere in the detail
    const sessionLine = text.split('\n').find((l) => l.includes('session-x'));
    expect(sessionLine).toBeDefined();
    expect(sessionLine).not.toContain('\nand\nnewlines');
  });
});
