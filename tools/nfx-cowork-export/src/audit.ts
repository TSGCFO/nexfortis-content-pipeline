/**
 * Audit-log formatting for dry-run output and (in slice 5) the sidecar file.
 *
 * Slice 2 ships only the per-session decision table and the per-category
 * summary counts. Slice 5 will extend this with compression-ratio reporting,
 * zero-event-kept lists, parse-failure counts, etc.
 */

import type { AuditRow, FilterDecision, SessionDropReason } from './types.js';

/**
 * Build an `AuditRow[]` from `FilterDecision`s paired with their session
 * metadata. Stable ordering: kept sessions first (by sessionId asc), then
 * dropped sessions grouped by reason.
 */
export function buildAuditRows(
  rows: ReadonlyArray<{ sessionId: string; slug: string | null; account: string | null; decision: FilterDecision }>
): AuditRow[] {
  const kept = rows.filter((r) => r.decision.keep).map((r) => ({ ...r }));
  const dropped = rows.filter((r) => !r.decision.keep).map((r) => ({ ...r }));

  kept.sort((a, b) => a.sessionId.localeCompare(b.sessionId));
  dropped.sort((a, b) => {
    const ra = (a.decision as { reason: string }).reason;
    const rb = (b.decision as { reason: string }).reason;
    if (ra !== rb) return ra.localeCompare(rb);
    return a.sessionId.localeCompare(b.sessionId);
  });

  return [...kept, ...dropped];
}

/**
 * Per-category counts for the summary block at the top of the audit output.
 */
export interface AuditSummary {
  total: number;
  kept: number;
  droppedByReason: Record<SessionDropReason, number>;
}

const ALL_DROP_REASONS: readonly SessionDropReason[] = [
  'family_law_slug',
  'scheduled_task',
  'command_message',
  'system_path_cwd',
  'cwd_always_denied',
  'cwd_not_allowed',
  'meta_missing',
  'no_transcripts',
  'tiny_session',
  'cwd_majority_outside_allowlist',
] as const;

export function summarize(rows: ReadonlyArray<{ decision: FilterDecision }>): AuditSummary {
  const droppedByReason = {} as Record<SessionDropReason, number>;
  for (const r of ALL_DROP_REASONS) droppedByReason[r] = 0;

  let kept = 0;
  for (const r of rows) {
    if (r.decision.keep) {
      kept++;
    } else {
      droppedByReason[r.decision.reason] = (droppedByReason[r.decision.reason] ?? 0) + 1;
    }
  }

  return {
    total: rows.length,
    kept,
    droppedByReason,
  };
}

/**
 * Render the audit summary as multi-line text. Includes a header block of
 * per-reason counts, then a column-aligned per-session decision table.
 *
 * Intended for `--dry-run` stdout. The same output is also written to
 * `_audit-<ts>.txt` in slice 5 (CLI work) when not in dry-run mode.
 */
export function renderAuditReport(rows: readonly AuditRow[], summary: AuditSummary): string {
  const lines: string[] = [];

  lines.push('Cowork session exporter — dry-run audit');
  lines.push('='.repeat(70));
  lines.push(`Total sessions found:  ${summary.total}`);
  lines.push(`Kept (passed filters): ${summary.kept}`);
  lines.push('');
  lines.push('Dropped by category:');
  for (const reason of ALL_DROP_REASONS) {
    const n = summary.droppedByReason[reason] ?? 0;
    if (n > 0) {
      lines.push(`  ${reason.padEnd(30)}  ${n}`);
    }
  }
  lines.push('');
  lines.push('Per-session decisions:');
  lines.push('-'.repeat(70));
  lines.push(`${'SESSION ID'.padEnd(38)}  ${'SLUG'.padEnd(28)}  DECISION`);
  lines.push('-'.repeat(70));

  for (const row of rows) {
    const id = row.sessionId.padEnd(38);
    const slug = (row.slug ?? '<no-slug>').slice(0, 26).padEnd(28);
    const decision = formatDecision(row.decision);
    lines.push(`${id}  ${slug}  ${decision}`);
  }

  lines.push('');
  return lines.join('\n');
}

function formatDecision(d: FilterDecision): string {
  if (d.keep) return 'KEEP';
  const base = `DROP (${d.reason})`;
  if (d.detail) {
    // Truncate detail and avoid newlines.
    const safe = d.detail.replace(/\s+/g, ' ').slice(0, 40);
    return `${base}  ${safe}`;
  }
  return base;
}
