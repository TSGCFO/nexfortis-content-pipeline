/**
 * Draft generator — F3 Step 1 (Brief Assembly), the `draft.requested` consumer.
 *
 * On `draft.requested` it loads the interview answers and confirmed corpus
 * chunks, assembles the SEOwind brief (see `../../integrations`), and creates a
 * `drafts` row with `status='generating'` and the brief stored in
 * `seowind_brief` (PRD §4 Step 1, §6, §7; AC-F3-01).
 *
 * SEOwind has no API and Playwright automation is deferred (roadmap Track 1
 * Week 5 = manual drafting), so this job stops after assembling the brief: the
 * `drafts` row sits at `generating` until the draft text is supplied and the
 * gate-runner (a later slice) scores it. No downstream event is dispatched yet.
 *
 * Inner logic is dependency-injected (`runDraftGenerator`) so it can be unit
 * tested with a fake `db`; the Inngest wrapper (`createDraftGeneratorJob`)
 * provides durability. Pattern matches
 * `artifacts/synthesis-worker/src/jobs/synthesize-weekly/index.ts`.
 */

import { and, eq, inArray } from 'drizzle-orm';
import type { Inngest, InngestFunction } from 'inngest';

import {
  articleCandidates,
  captureSignals,
  createDbClient,
  drafts,
  interviewSessions,
  type Database,
  type DraftInsert,
  type InterviewAnswer,
} from '@ncp/db';
import { createLogger, type Logger } from '@ncp/logger';
import type { Pillar } from '@ncp/shared-types';

import { assembleBrief } from '../../integrations/brief-assembler.js';
import {
  assembleInsightsText,
  type EvidenceChunk,
} from '../../integrations/insights-assembler.js';
import {
  EnvNotConfiguredError,
  InvalidDraftRequestedEventError,
} from './errors.js';

const SOURCE = 'gate_worker' as const;

const PILLARS: readonly Pillar[] = ['quickbooks', 'managed-it', 'cybersecurity'];

/** Payload of the `draft.requested` event (PRD §10.1). */
export interface DraftRequestedData {
  candidateId: string;
  sessionId: string;
  confirmedChunkIds: string[];
  pillar: Pillar;
  primaryKeyword: string;
}

interface DraftGeneratorEnv {
  databaseUrl: string;
  seowindProjectId: string;
}

export function readEnv(): DraftGeneratorEnv {
  const databaseUrl = process.env['DATABASE_URL'];
  const seowindProjectId = process.env['SEOWIND_PROJECT_ID'];

  const missing: string[] = [];
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    missing.push('DATABASE_URL');
  }
  if (typeof seowindProjectId !== 'string' || seowindProjectId.length === 0) {
    missing.push('SEOWIND_PROJECT_ID');
  }
  if (missing.length > 0) {
    throw new EnvNotConfiguredError(missing);
  }
  return {
    databaseUrl: databaseUrl as string,
    seowindProjectId: seowindProjectId as string,
  };
}

/**
 * Validate and narrow a raw `draft.requested` event payload. Throws
 * `InvalidDraftRequestedEventError` on any missing/malformed field.
 */
export function parseDraftRequested(data: unknown): DraftRequestedData {
  if (typeof data !== 'object' || data === null) {
    throw new InvalidDraftRequestedEventError('event data is not an object');
  }
  const d = data as Record<string, unknown>;
  const candidateId = d['candidateId'];
  const sessionId = d['sessionId'];
  const primaryKeyword = d['primaryKeyword'];
  const pillar = d['pillar'];
  const confirmedChunkIds = d['confirmedChunkIds'];

  if (typeof candidateId !== 'string' || candidateId.length === 0) {
    throw new InvalidDraftRequestedEventError('missing string `candidateId`');
  }
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new InvalidDraftRequestedEventError('missing string `sessionId`');
  }
  if (typeof primaryKeyword !== 'string' || primaryKeyword.length === 0) {
    throw new InvalidDraftRequestedEventError('missing string `primaryKeyword`');
  }
  if (typeof pillar !== 'string' || !PILLARS.includes(pillar as Pillar)) {
    throw new InvalidDraftRequestedEventError(
      `invalid \`pillar\`: expected one of ${PILLARS.join(', ')}`,
    );
  }
  if (
    !Array.isArray(confirmedChunkIds) ||
    !confirmedChunkIds.every((x) => typeof x === 'string')
  ) {
    throw new InvalidDraftRequestedEventError(
      '`confirmedChunkIds` must be an array of strings',
    );
  }

  return {
    candidateId,
    sessionId,
    primaryKeyword,
    pillar: pillar as Pillar,
    confirmedChunkIds: confirmedChunkIds as string[],
  };
}

/**
 * Extract Hassan's prose from interview answers — the transcript of a voice
 * answer or the typed text. Button-only answers (confirm/skip) carry no prose
 * and are dropped.
 */
export function extractAnswerProse(answers: InterviewAnswer[]): string[] {
  return answers
    .map((a) => (a.transcript ?? a.text ?? '').trim())
    .filter((s) => s.length > 0);
}

export type DraftGeneratorOutcome =
  | { kind: 'created'; draftId: string }
  | { kind: 'skipped_existing'; draftId: string };

export interface RunDraftGeneratorDeps {
  db: Database;
  logger: Logger;
  /** SEOwind project id from `SEOWIND_PROJECT_ID`. */
  projectId: string;
  event: DraftRequestedData;
}

/**
 * Dependency-injected core. Idempotent on (candidate, attempt 1): a second
 * delivery of the same `draft.requested` returns the existing draft instead of
 * creating a duplicate.
 */
export async function runDraftGenerator(
  deps: RunDraftGeneratorDeps,
): Promise<DraftGeneratorOutcome> {
  const { db, logger, projectId, event } = deps;

  // Idempotency: skip if a first-attempt draft already exists for this
  // candidate (Inngest delivers at-least-once).
  const existing = await db
    .select({ id: drafts.id })
    .from(drafts)
    .where(and(eq(drafts.candidateId, event.candidateId), eq(drafts.attemptNumber, 1)));
  const existingId = existing[0]?.id;
  if (typeof existingId === 'string') {
    logger.info(
      {
        source: SOURCE,
        action: 'draft_generator_skipped_existing',
        candidateId: event.candidateId,
        draftId: existingId,
      },
      'draft already exists for candidate; skipping',
    );
    return { kind: 'skipped_existing', draftId: existingId };
  }

  // Load Hassan's interview answers.
  const sessionRows = await db
    .select({ answers: interviewSessions.answers })
    .from(interviewSessions)
    .where(eq(interviewSessions.id, event.sessionId));
  const answers = sessionRows[0]?.answers ?? [];
  const confirmedAnswers = extractAnswerProse(answers);

  // Load the confirmed corpus evidence chunks.
  let evidenceChunks: EvidenceChunk[] = [];
  if (event.confirmedChunkIds.length > 0) {
    const chunkRows = await db
      .select({
        redactedText: captureSignals.redactedText,
        capturedAt: captureSignals.capturedAt,
      })
      .from(captureSignals)
      .where(inArray(captureSignals.id, event.confirmedChunkIds));
    evidenceChunks = chunkRows.map((r) => ({
      text: r.redactedText,
      capturedAt: r.capturedAt,
    }));
  }

  const insights = assembleInsightsText({
    confirmedAnswers,
    followUpAnswers: [],
    evidenceChunks,
  });
  const brief = assembleBrief({
    primaryKeyword: event.primaryKeyword,
    projectId,
    insightsText: insights.text,
  });

  const insertedRows = await db
    .insert(drafts)
    .values({
      candidateId: event.candidateId,
      sessionId: event.sessionId,
      attemptNumber: 1,
      seowindBrief: brief,
      status: 'generating',
    } satisfies DraftInsert)
    .returning({ id: drafts.id });

  const draftId = insertedRows[0]?.id;
  if (typeof draftId !== 'string') {
    throw new Error('draft-generator: failed to capture inserted draft id');
  }

  // Mark the candidate as having entered the drafting stage.
  await db
    .update(articleCandidates)
    .set({ status: 'draft_requested' })
    .where(eq(articleCandidates.id, event.candidateId));

  logger.info(
    {
      source: SOURCE,
      action: 'draft_generator_created',
      candidateId: event.candidateId,
      draftId,
      confirmedAnswers: confirmedAnswers.length,
      evidenceChunks: evidenceChunks.length,
      insightsTruncated: insights.truncated,
      omittedChunks: insights.omittedChunks,
    },
    'draft brief assembled; awaiting SEOwind draft text',
  );
  return { kind: 'created', draftId };
}

/**
 * Inngest factory. Mirrors `createSynthesizeWeeklyCron` — a factory rather
 * than a top-level `inngest.createFunction(...)` call so `src/index.ts` (which
 * owns the `Inngest` instance) constructs the function without a circular
 * import.
 */
export function createDraftGeneratorJob(
  inngest: Inngest.Any,
): InngestFunction.Any {
  return inngest.createFunction(
    { id: 'draft-generator', name: 'F3 Draft Generator (brief assembly)' },
    { event: 'draft.requested' },
    async ({ event, step }) => {
      const logger = createLogger({ source: SOURCE });
      const env = readEnv();
      const db = createDbClient({ connectionString: env.databaseUrl });
      const data = parseDraftRequested(event.data);

      return step.run('run-draft-generator', async () =>
        runDraftGenerator({
          db,
          logger,
          projectId: env.seowindProjectId,
          event: data,
        }),
      );
    },
  );
}
