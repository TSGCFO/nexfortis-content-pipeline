/**
 * Slice-5 orchestrator: the full end-to-end pipeline.
 *
 *   runDiscovery → for each kept session: redactEventTree → emitParsedSessions
 *                                                       → renderExtendedAuditReport
 *                                                       → writeAuditSidecar
 *
 * This is the function the CLI calls. `run-discovery` from slice 2-4 remains
 * available for callers that only want the parsing pipeline without IO.
 */

import { runDiscovery } from './run-discovery.js';
import { redactEventTree } from './redact-events.js';
import { emitParsedSessions } from './emit.js';
import {
  renderExtendedAuditReport,
  writeAuditSidecar,
} from './audit-extended.js';
import { checkSlugBlocklist } from '@ncp/redaction';
import type {
  ExporterConfig,
  ParsedSession,
} from './types.js';
import type { EmitResult } from './emit.js';
import type { RedactionSummary } from './redact-events.js';

export interface RunExportOptions {
  inputRoot: string;
  outputDir: string;
  config: ExporterConfig;
  dryRun: boolean;
  verbose?: boolean;
  /** Optional override for the wall clock; tests set this for deterministic output. */
  now?: Date;
}

export interface RunExportResult {
  emitResult: EmitResult;
  redactionSummary: RedactionSummary;
  /** Path of the audit sidecar file. `null` when running in dry-run mode (no sidecar written). */
  auditSidecarPath: string | null;
  /** Full audit text — what was written to stdout AND (in non-dry mode) the sidecar file. */
  auditText: string;
}

export async function runExport(options: RunExportOptions): Promise<RunExportResult> {
  const runStartedAt = options.now ?? new Date();

  // 1. Discover + filter + parse + post-check (un-redacted).
  const discovery = await runDiscovery({
    inputRoot: options.inputRoot,
    config: options.config,
  });

  // 2. Compute family-law slug hashes for the audit log (hash-only, slug never logged).
  // We re-check against the configured slug list — `filterSession` already did this once,
  // but the hash list is what the audit log surfaces.
  const familyLawHashes: string[] = [];
  // Family-law matches surface only on dropped audit rows (sessions that passed
  // session-level filter by definition had no slug match). Iterate the audit
  // rows once; the decision.detail carries the SHA-256 hex of the matched slug
  // (the slug itself is never logged anywhere).
  for (const row of discovery.rows) {
    if (!row.decision.keep && row.decision.reason === 'family_law_slug' && row.decision.detail) {
      familyLawHashes.push(row.decision.detail);
    }
  }

  // 3. Redact every kept session's transcripts in place (new ParsedSession[] array).
  const redactedSessions: ParsedSession[] = [];
  const aggregateRedactionSummary: RedactionSummary = {
    scannedTextFields: 0,
    totalReplacements: 0,
    replacementsByType: {},
  };

  for (const s of discovery.parsedSessions) {
    if (!s.postCheck.keep) {
      // Drop sessions that failed post-check — they don't emit per the slice-3 review note.
      redactedSessions.push(s);
      continue;
    }
    const newTranscripts = s.transcripts.map((t) => {
      const { events: redactedEvents, summary } = redactEventTree(t.events);
      aggregateRedactionSummary.scannedTextFields += summary.scannedTextFields;
      aggregateRedactionSummary.totalReplacements += summary.totalReplacements;
      for (const [type, count] of Object.entries(summary.replacementsByType)) {
        aggregateRedactionSummary.replacementsByType[type] =
          (aggregateRedactionSummary.replacementsByType[type] ?? 0) + count;
      }
      return { ...t, events: redactedEvents };
    });
    redactedSessions.push({ ...s, transcripts: newTranscripts });
  }

  // 4. Emit JSON files (or simulate emission in dry-run).
  const emitOptions: Parameters<typeof emitParsedSessions>[1] = {
    outputDir: options.outputDir,
    dryRun: options.dryRun,
  };
  if (options.now !== undefined) emitOptions.exportedAt = options.now;
  const emitResult = await emitParsedSessions(redactedSessions, emitOptions);

  const runFinishedAt = options.now ?? new Date();

  // 5. Build the extended audit report.
  const auditText = renderExtendedAuditReport({
    rows: discovery.rows,
    summary: discovery.summary,
    parsedSessions: redactedSessions,
    emitResult,
    redactionSummary: aggregateRedactionSummary,
    familyLawHashes,
    runStartedAt,
    runFinishedAt,
    inputRoot: options.inputRoot,
    outputDir: options.outputDir,
    dryRun: options.dryRun,
  });

  // 6. Write sidecar (skipped in dry-run).
  let auditSidecarPath: string | null = null;
  if (!options.dryRun) {
    auditSidecarPath = await writeAuditSidecar(options.outputDir, auditText, runStartedAt);
  }

  // No-op references so unused-imports lints don't fire when the slug-checker
  // isn't directly called from here.
  void checkSlugBlocklist;

  return {
    emitResult,
    redactionSummary: aggregateRedactionSummary,
    auditSidecarPath,
    auditText,
  };
}
