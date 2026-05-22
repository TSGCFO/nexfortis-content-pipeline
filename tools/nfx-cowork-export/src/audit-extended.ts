/**
 * Extended audit report for slice 5.
 *
 * Builds on the slice-2 stdout decision-table by adding the metrics the spec
 * specifically calls for in §Audit log:
 *
 *   - Compression ratio per kept session
 *   - Zero-event-kept sessions (sessionIds listed)
 *   - Per-source-branch counts (main vs secondary Cowork space)
 *   - Per-account counts
 *   - Family-law slug matches: SHA-256 hash only (never the slug itself)
 *   - Skipped lines / parse failures per file
 *   - Cwd summary per session
 *   - Redaction summary (PII counts by type)
 *   - JSON emission summary (files written + validation failures)
 *
 * Two outputs:
 *   - stdout (called by the CLI's main path)
 *   - a sidecar file at `<output-dir>/_audit-<timestamp>.txt`
 *
 * The sidecar is a verbatim copy of the stdout text — no separate format.
 * Keeps `tail -f _audit-*.txt` working for the operator.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { AuditRow } from './types.js';
import type { AuditSummary } from './audit.js';
import type { ParsedSession } from './types.js';
import type { EmitResult } from './emit.js';
import type { RedactionSummary } from './redact-events.js';

export interface ExtendedAuditInputs {
  rows: readonly AuditRow[];
  summary: AuditSummary;
  parsedSessions: readonly ParsedSession[];
  emitResult: EmitResult;
  redactionSummary: RedactionSummary;
  /** Hashes of family-law slugs that matched (never the slugs themselves). */
  familyLawHashes: readonly string[];
  runStartedAt: Date;
  runFinishedAt: Date;
  inputRoot: string;
  outputDir: string;
  dryRun: boolean;
}

export function renderExtendedAuditReport(inputs: ExtendedAuditInputs): string {
  const lines: string[] = [];

  lines.push('Cowork session exporter — audit report');
  lines.push('='.repeat(72));
  lines.push(`Run started:   ${inputs.runStartedAt.toISOString()}`);
  lines.push(`Run finished:  ${inputs.runFinishedAt.toISOString()}`);
  lines.push(`Duration:      ${((inputs.runFinishedAt.getTime() - inputs.runStartedAt.getTime()) / 1000).toFixed(2)}s`);
  lines.push(`Input root:    ${inputs.inputRoot}`);
  lines.push(`Output dir:    ${inputs.outputDir}`);
  lines.push(`Mode:          ${inputs.dryRun ? 'DRY-RUN (no files written)' : 'NORMAL (files written to disk)'}`);
  lines.push('');

  // Discovery + filter summary (same as slice 2)
  lines.push('Discovery + filter');
  lines.push('-'.repeat(72));
  lines.push(`Total sessions found:  ${inputs.summary.total}`);
  lines.push(`Kept (passed filters): ${inputs.summary.kept}`);
  lines.push('');
  const reasonsToShow = (Object.keys(inputs.summary.droppedByReason) as Array<keyof typeof inputs.summary.droppedByReason>).filter(
    (r) => (inputs.summary.droppedByReason[r] ?? 0) > 0
  );
  if (reasonsToShow.length > 0) {
    lines.push('Dropped by category:');
    for (const r of reasonsToShow) {
      lines.push(`  ${String(r).padEnd(35)} ${inputs.summary.droppedByReason[r]}`);
    }
    lines.push('');
  }

  // Per-source-branch counts (workspaceId)
  const branchCounts = new Map<string, number>();
  for (const s of inputs.parsedSessions) {
    const ws = workspaceIdFromPath(s.discovery.sessionFolder) ?? '<unknown>';
    branchCounts.set(ws, (branchCounts.get(ws) ?? 0) + 1);
  }
  if (branchCounts.size > 0) {
    lines.push('Kept sessions by Cowork workspace branch');
    lines.push('-'.repeat(72));
    for (const [ws, n] of [...branchCounts.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${ws}  ${n}`);
    }
    lines.push('');
  }

  // Per-account counts
  const accountCounts = new Map<string, number>();
  for (const s of inputs.parsedSessions) {
    const acct = s.discovery.meta?.emailAddress ?? '<no-account-in-meta>';
    accountCounts.set(acct, (accountCounts.get(acct) ?? 0) + 1);
  }
  if (accountCounts.size > 0) {
    lines.push('Kept sessions by account');
    lines.push('-'.repeat(72));
    for (const [acct, n] of [...accountCounts.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${acct}  ${n}`);
    }
    lines.push('');
  }

  // Per-session compression ratio (lines in vs events out, summed across transcripts)
  lines.push('Per-session compression (lines in → events out)');
  lines.push('-'.repeat(72));
  lines.push(`${'SESSION'.padEnd(38)}  LINES IN  EVENTS OUT  RATIO  PARSE-FAIL`);
  const zeroEventSessions: string[] = [];
  for (const s of inputs.parsedSessions) {
    if (!s.postCheck.keep) continue;
    const linesIn = s.transcripts.reduce((acc, t) => acc + t.parseStats.linesRead, 0);
    const eventsOut = s.transcripts.reduce((acc, t) => acc + t.events.length, 0);
    const failures = s.transcripts.reduce((acc, t) => acc + t.parseStats.linesFailed, 0);
    const ratio = linesIn > 0 ? ((eventsOut / linesIn) * 100).toFixed(1) + '%' : 'n/a';
    if (eventsOut === 0) zeroEventSessions.push(s.discovery.sessionId);
    lines.push(
      `${s.discovery.sessionId.padEnd(38)}  ${String(linesIn).padStart(8)}  ${String(eventsOut).padStart(10)}  ${ratio.padStart(5)}  ${String(failures).padStart(8)}`
    );
  }
  lines.push('');

  if (zeroEventSessions.length > 0) {
    lines.push('Zero-event-kept sessions (kept but no events emitted — likely a bug)');
    lines.push('-'.repeat(72));
    for (const id of zeroEventSessions) lines.push(`  ${id}`);
    lines.push('');
  }

  // Family-law slug matches (hashes only)
  lines.push('Family-law slug matches (hash-only, slug never logged)');
  lines.push('-'.repeat(72));
  if (inputs.familyLawHashes.length === 0) {
    lines.push('  (none)');
  } else {
    for (const h of inputs.familyLawHashes) lines.push(`  ${h}`);
  }
  lines.push('');

  // Redaction summary
  lines.push('PII redaction (regex pass)');
  lines.push('-'.repeat(72));
  lines.push(`  Text fields scanned:   ${inputs.redactionSummary.scannedTextFields}`);
  lines.push(`  Total replacements:    ${inputs.redactionSummary.totalReplacements}`);
  const replTypes = Object.entries(inputs.redactionSummary.replacementsByType).sort((a, b) => b[1] - a[1]);
  if (replTypes.length > 0) {
    lines.push('  By type:');
    for (const [t, n] of replTypes) {
      lines.push(`    ${t.padEnd(25)} ${n}`);
    }
  }
  lines.push('');

  // JSON emission summary
  lines.push('JSON emission');
  lines.push('-'.repeat(72));
  lines.push(`  Files written: ${inputs.emitResult.filesWritten}${inputs.dryRun ? ' (dry-run: 0)' : ''}`);
  lines.push(`  Validation failures: ${inputs.emitResult.validationFailures.length}`);
  if (inputs.emitResult.validationFailures.length > 0) {
    for (const f of inputs.emitResult.validationFailures) {
      lines.push(`    ${f.transcriptId}:`);
      for (const issue of f.issues.slice(0, 3)) {
        lines.push(`      - ${issue}`);
      }
      if (f.issues.length > 3) {
        lines.push(`      (and ${f.issues.length - 3} more issues)`);
      }
    }
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Write the audit text to `<output-dir>/_audit-<timestamp>.txt`. Returns the
 * path of the sidecar. Caller is responsible for `mkdir -p` on the output dir
 * (the emit module already does that).
 */
export async function writeAuditSidecar(
  outputDir: string,
  text: string,
  runStartedAt: Date
): Promise<string> {
  const stamp = runStartedAt
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace(/Z$/, 'Z');
  const filename = `_audit-${stamp}.txt`;
  const fullPath = path.join(outputDir, filename);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(fullPath, text, 'utf8');
  return fullPath;
}

function workspaceIdFromPath(sessionFolder: string): string | null {
  const norm = sessionFolder.replace(/\\/g, '/');
  const segments = norm.split('/').filter((s) => s.length > 0);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (let i = segments.length - 2; i >= 0; i--) {
    const seg = segments[i]!;
    if (uuidPattern.test(seg)) return seg;
  }
  return null;
}
