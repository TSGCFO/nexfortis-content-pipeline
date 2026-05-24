/**
 * Inngest cron function: synthesize-weekly.
 *
 * Sunday at 07:00 UTC (= 02:00 Eastern). Article candidate is ready by the
 * time the Telegram interview bot delivers Monday morning at 08:00 Eastern.
 *
 * Pipeline (see capture-synthesis-layer/prd.md §4.4):
 *   1. Pull `capture_signals` from the past 30 days (is_deleted = false,
 *      embedding IS NOT NULL).
 *   2. Cluster by naive O(n^2) cosine similarity > 0.72; drop clusters
 *      smaller than 3 members.
 *   3. Label each surviving cluster via Claude Sonnet.
 *   4. Classify each label into a pillar via Claude Haiku.
 *   5. Score and rank in-pillar clusters; pick the top one.
 *   6. Generate the top cluster's proposed title via Claude Sonnet.
 *   7. Persist all clusters (active + discarded audit rows) and the candidate.
 *   8. Dispatch `interview.session.requested` with `{ candidateId }`.
 *   9. Send Hassan a Telegram preview.
 *
 * Step granularity: unlike `ingest-msgraph-email/index.ts` (which wraps each
 * discrete operation — token fetch, per-message processing, checkpoint
 * update — in its own `step.run` for fine-grained retries across an
 * unbounded message stream), this cron runs the entire pipeline inside one
 * `step.run('run-synthesize-weekly', …)` block. The job is weekly, the
 * working set is bounded (≤ 5,000 signals; hard cap enforced in cluster.ts),
 * and the per-LLM-call retry logic already lives inside the labeler /
 * classifier helpers. A failure during the run therefore re-executes the
 * whole pipeline on Inngest's next retry, which is acceptable for a
 * once-a-week cadence.
 *
 * Event dispatch: `step.sendEvent` cannot nest inside `step.run`, so the
 * `interview.session.requested` dispatch happens at the function top level
 * immediately after the run step returns on success. Both step.run and
 * step.sendEvent are independently durable under Inngest's standard
 * semantics.
 */

import Anthropic from '@anthropic-ai/sdk';
import { and, eq, gte, isNotNull } from 'drizzle-orm';
import type { Inngest, InngestFunction } from 'inngest';

import {
  articleCandidates,
  captureSignals,
  createDbClient,
  synthesisClusters,
  type Database,
  type SynthesisClusterInsert,
} from '@ncp/db';
import { createLogger, type Logger } from '@ncp/logger';
import { clusterSignals } from './cluster.js';
import { classifyPillar } from './classify-pillar.js';
import { EnvNotConfiguredError } from './errors.js';
import { generateTitle } from './generate-title.js';
import { INCOHERENT_SENTINEL, labelCluster } from './label-cluster.js';
import { scoreClusters } from './score-clusters.js';
import {
  buildNoQualifyingClustersMessage,
  buildNoSignalsMessage,
  buildPreviewMessage,
  sendTelegramPreview,
} from './send-telegram-preview.js';
import type {
  AnthropicLike,
  ClassifiedCluster,
  Cluster,
  DiscardedClusterRecord,
  LabeledCluster,
  RunOutcome,
  RunSummary,
  ScoredCluster,
  SignalRow,
  TelegramSendResult,
} from './types.js';

const SOURCE = 'synthesis_worker' as const;
const SIGNAL_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface SynthesisEnv {
  databaseUrl: string;
  anthropicApiKey: string;
  telegramBotToken: string;
  telegramChatId: string;
}

export function readEnv(): SynthesisEnv {
  const databaseUrl = process.env['DATABASE_URL'];
  const anthropicApiKey = process.env['ANTHROPIC_API_KEY'];
  const telegramBotToken = process.env['TELEGRAM_BOT_TOKEN'];
  const telegramChatId = process.env['TELEGRAM_CHAT_ID'];

  const missing: string[] = [];
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    missing.push('DATABASE_URL');
  }
  if (typeof anthropicApiKey !== 'string' || anthropicApiKey.length === 0) {
    missing.push('ANTHROPIC_API_KEY');
  }
  if (typeof telegramBotToken !== 'string' || telegramBotToken.length === 0) {
    missing.push('TELEGRAM_BOT_TOKEN');
  }
  if (typeof telegramChatId !== 'string' || telegramChatId.length === 0) {
    missing.push('TELEGRAM_CHAT_ID');
  }
  if (missing.length > 0) {
    throw new EnvNotConfiguredError(missing);
  }
  return {
    databaseUrl: databaseUrl as string,
    anthropicApiKey: anthropicApiKey as string,
    telegramBotToken: telegramBotToken as string,
    telegramChatId: telegramChatId as string,
  };
}

/**
 * Compute the Monday of the upcoming week in UTC, formatted as ISO date
 * (`YYYY-MM-DD`) for the `synthesis_clusters.surfaced_for_week` column.
 * If today (UTC) is already Monday, returns today; otherwise returns the
 * next Monday. The cron fires Sunday 07:00 UTC so the typical result is
 * "tomorrow".
 */
export function nextMondayISO(now: Date): string {
  const utc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const dow = utc.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const offset = dow === 1 ? 0 : (8 - dow) % 7 || 7;
  const monday = new Date(utc.getTime() + offset * MS_PER_DAY);
  return monday.toISOString().slice(0, 10);
}

/**
 * Read recent signals from the database.
 *
 * Filtering is performed DB-side (via Drizzle's `where` clause) rather than
 * in JS (as the `source_filters` lookup in capture-worker's
 * `ingest-msgraph-email/index.ts` does) because `capture_signals` is an
 * unbounded table — loading every row into memory just to filter on
 * `is_deleted`, `captured_at`, and `embedding` would not scale.
 */
async function pullSignals(db: Database): Promise<SignalRow[]> {
  const since = new Date(Date.now() - SIGNAL_WINDOW_DAYS * MS_PER_DAY);
  const rows = await db
    .select({
      id: captureSignals.id,
      capturedAt: captureSignals.capturedAt,
      redactedText: captureSignals.redactedText,
      embedding: captureSignals.embedding,
    })
    .from(captureSignals)
    .where(
      and(
        eq(captureSignals.isDeleted, false),
        gte(captureSignals.capturedAt, since),
        isNotNull(captureSignals.embedding),
      ),
    );

  const result: SignalRow[] = [];
  for (const r of rows) {
    if (!Array.isArray(r.embedding) || r.embedding.length === 0) continue;
    result.push({
      id: r.id,
      capturedAt: r.capturedAt,
      redactedText: r.redactedText,
      embedding: Float32Array.from(r.embedding),
    });
  }
  return result;
}

interface PersistResult {
  candidateId: string;
}

interface PersistInput {
  scored: ScoredCluster[];
  top: ScoredCluster;
  proposedTitle: string;
  discards: DiscardedClusterRecord[];
  surfacedForWeek: string;
}

function buildDiscardSerpGap(d: DiscardedClusterRecord): Record<string, unknown> {
  if (d.reason === 'off_pillar') {
    return {
      discarded_reason: d.reason,
      haiku_classification: d.haikuClassification ?? 'OFF_PILLAR',
    };
  }
  return { discarded_reason: d.reason };
}

async function persistAll(
  db: Database,
  input: PersistInput,
): Promise<PersistResult> {
  const {
    scored,
    top,
    proposedTitle,
    discards,
    surfacedForWeek,
  } = input;

  // Insert the TOP cluster first so we can capture its UUID without
  // ambiguity (a tied non-top cluster could share signalIds in pathological
  // cases). The returned row drives the article_candidate FK.
  const topInsertRows = await db
    .insert(synthesisClusters)
    .values({
      clusterLabel: top.label,
      signalIds: top.signalIds,
      topicKeywords: top.topicKeywords,
      surfacedForWeek,
      status: 'active',
      serpGap: {},
    } satisfies SynthesisClusterInsert)
    .returning({ id: synthesisClusters.id });

  const topClusterId = topInsertRows[0]?.id;
  if (typeof topClusterId !== 'string') {
    throw new Error('persist: failed to capture inserted top cluster id');
  }

  // Insert the remaining active clusters (if any) + all discards in one
  // batch. Order doesn't matter — none are referenced by FK.
  const otherInserts: SynthesisClusterInsert[] = [];
  for (const c of scored) {
    if (c === top) continue;
    otherInserts.push({
      clusterLabel: c.label,
      signalIds: c.signalIds,
      topicKeywords: c.topicKeywords,
      surfacedForWeek,
      status: 'active',
      serpGap: {},
    });
  }
  for (const d of discards) {
    otherInserts.push({
      clusterLabel: d.label,
      signalIds: d.signalIds,
      topicKeywords: d.topicKeywords,
      surfacedForWeek,
      status: 'discarded',
      serpGap: buildDiscardSerpGap(d),
    });
  }
  if (otherInserts.length > 0) {
    await db.insert(synthesisClusters).values(otherInserts);
  }

  const primaryKeyword = (top.topicKeywords[0] ?? top.label).toLowerCase();

  const candidateRows = await db
    .insert(articleCandidates)
    .values({
      clusterId: topClusterId,
      primaryKeyword,
      pillar: top.pillar,
      proposedTitle,
      evidenceChunkIds: top.signalIds,
      serpGaps: [],
    })
    .returning({ id: articleCandidates.id });

  const candidateId = candidateRows[0]?.id;
  if (typeof candidateId !== 'string') {
    throw new Error('persist: failed to capture inserted article_candidate id');
  }
  return { candidateId };
}

async function persistDiscardsOnly(
  db: Database,
  discards: DiscardedClusterRecord[],
  surfacedForWeek: string,
): Promise<void> {
  if (discards.length === 0) return;
  const inserts: SynthesisClusterInsert[] = discards.map((d) => ({
    clusterLabel: d.label,
    signalIds: d.signalIds,
    topicKeywords: d.topicKeywords,
    surfacedForWeek,
    status: 'discarded',
    serpGap: buildDiscardSerpGap(d),
  }));
  await db.insert(synthesisClusters).values(inserts);
}

type LabelOutcome =
  | { kind: 'labeled'; cluster: LabeledCluster }
  | { kind: 'discarded'; discard: DiscardedClusterRecord };

async function labelClusterWithRetry(
  cluster: Cluster,
  anthropic: AnthropicLike,
  logger: Logger,
): Promise<LabelOutcome> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await labelCluster(cluster, anthropic);
      if (result.label === INCOHERENT_SENTINEL) {
        return {
          kind: 'discarded',
          discard: {
            signalIds: cluster.signalIds,
            label: INCOHERENT_SENTINEL,
            topicKeywords: [],
            reason: 'label_incoherent',
            haikuClassification: undefined,
          },
        };
      }
      return {
        kind: 'labeled',
        cluster: {
          ...cluster,
          label: result.label,
          topicKeywords: result.topicKeywords,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(
        {
          source: SOURCE,
          action: 'label_cluster_failed',
          attempt,
          signalCount: cluster.signalIds.length,
          reason: message,
        },
        'label cluster attempt failed',
      );
      if (attempt === 1) {
        await sleep(5000);
      }
    }
  }
  return {
    kind: 'discarded',
    discard: {
      signalIds: cluster.signalIds,
      label: INCOHERENT_SENTINEL,
      topicKeywords: [],
      reason: 'label_incoherent',
      haikuClassification: undefined,
    },
  };
}

type ClassifyOutcome =
  | { kind: 'classified'; cluster: ClassifiedCluster }
  | { kind: 'discarded'; discard: DiscardedClusterRecord };

async function classifyClusterWrap(
  cluster: LabeledCluster,
  anthropic: AnthropicLike,
  logger: Logger,
): Promise<ClassifyOutcome> {
  try {
    const result = await classifyPillar(
      cluster.label,
      cluster.topicKeywords,
      anthropic,
    );
    if (result.pillar !== null) {
      return {
        kind: 'classified',
        cluster: { ...cluster, pillar: result.pillar },
      };
    }
    const reason =
      result.rawResponse === 'OFF_PILLAR'
        ? 'off_pillar'
        : 'pillar_classification_failed';
    return {
      kind: 'discarded',
      discard: {
        signalIds: cluster.signalIds,
        label: cluster.label,
        topicKeywords: cluster.topicKeywords,
        reason,
        haikuClassification:
          reason === 'off_pillar' ? result.rawResponse : undefined,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      {
        source: SOURCE,
        action: 'classify_pillar_unexpected_throw',
        reason: message,
      },
      'pillar classification raised after internal retry; discarding cluster',
    );
    return {
      kind: 'discarded',
      discard: {
        signalIds: cluster.signalIds,
        label: cluster.label,
        topicKeywords: cluster.topicKeywords,
        reason: 'pillar_classification_failed',
        haikuClassification: undefined,
      },
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Inner, dependency-injected business logic. Exposed for unit testing —
 * tests inject `db`, `anthropic`, `fetchFn`, `sendInngestEvent`, and `now`
 * without standing up an Inngest function.
 *
 * The Inngest wrapper in `createSynthesizeWeeklyCron` provides retry /
 * durability semantics via `step.run` and `step.sendEvent`, but the logic
 * itself lives here.
 */
export interface RunSynthesizeWeeklyDeps {
  db: Database;
  anthropic: AnthropicLike;
  logger: Logger;
  fetchFn: typeof fetch;
  sendInngestEvent: (payload: {
    name: 'interview.session.requested';
    data: { candidateId: string };
  }) => Promise<void>;
  env: {
    telegramBotToken: string;
    telegramChatId: string;
  };
  now?: Date;
}

export async function runSynthesizeWeekly(
  deps: RunSynthesizeWeeklyDeps,
): Promise<{ outcome: RunOutcome; summary: RunSummary }> {
  const { db, anthropic, logger, fetchFn, sendInngestEvent, env } = deps;
  const now = deps.now ?? new Date();

  const summary: RunSummary = {
    source: SOURCE,
    signalsConsidered: 0,
    clustersFormed: 0,
    clustersLabeled: 0,
    clustersDiscardedLabelIncoherent: 0,
    clustersDiscardedOffPillar: 0,
    clustersDiscardedPillarFailed: 0,
    clustersActive: 0,
    outcome: 'no_signals',
    telegramSent: false,
    warnings: [],
  };

  const signals = await pullSignals(db);
  summary.signalsConsidered = signals.length;

  if (signals.length === 0) {
    const tg = await sendTelegramPreview({
      token: env.telegramBotToken,
      chatId: env.telegramChatId,
      message: buildNoSignalsMessage(),
      fetchFn,
    });
    recordTelegram(summary, tg, logger);
    summary.outcome = 'no_signals';
    logger.info({ ...summary, action: 'synthesize_weekly_no_signals' }, 'synthesize-weekly: no signals');
    return { outcome: { kind: 'no_signals' }, summary };
  }

  const rawClusters = clusterSignals(signals, { logger });
  summary.clustersFormed = rawClusters.length;

  if (rawClusters.length === 0) {
    const tg = await sendTelegramPreview({
      token: env.telegramBotToken,
      chatId: env.telegramChatId,
      message: buildNoQualifyingClustersMessage(),
      fetchFn,
    });
    recordTelegram(summary, tg, logger);
    summary.outcome = 'no_qualifying_clusters';
    logger.info(
      { ...summary, action: 'synthesize_weekly_no_qualifying_clusters' },
      'synthesize-weekly: no qualifying clusters',
    );
    return { outcome: { kind: 'no_qualifying_clusters' }, summary };
  }

  // Label each cluster.
  const labeled: LabeledCluster[] = [];
  const discards: DiscardedClusterRecord[] = [];
  for (const c of rawClusters) {
    const r = await labelClusterWithRetry(c, anthropic, logger);
    if (r.kind === 'labeled') {
      labeled.push(r.cluster);
    } else {
      discards.push(r.discard);
      summary.clustersDiscardedLabelIncoherent += 1;
    }
  }
  summary.clustersLabeled = labeled.length;

  // Classify each labeled cluster.
  const classified: ClassifiedCluster[] = [];
  for (const lc of labeled) {
    const r = await classifyClusterWrap(lc, anthropic, logger);
    if (r.kind === 'classified') {
      classified.push(r.cluster);
    } else {
      discards.push(r.discard);
      if (r.discard.reason === 'off_pillar') {
        summary.clustersDiscardedOffPillar += 1;
      } else {
        summary.clustersDiscardedPillarFailed += 1;
      }
    }
  }

  const surfacedForWeek = nextMondayISO(now);

  if (classified.length === 0) {
    await persistDiscardsOnly(db, discards, surfacedForWeek);
    const tg = await sendTelegramPreview({
      token: env.telegramBotToken,
      chatId: env.telegramChatId,
      message: buildNoQualifyingClustersMessage(),
      fetchFn,
    });
    recordTelegram(summary, tg, logger);
    summary.outcome = 'no_qualifying_clusters';
    logger.info(
      { ...summary, action: 'synthesize_weekly_no_qualifying_clusters' },
      'synthesize-weekly: no in-pillar clusters; persisted discards only',
    );
    return { outcome: { kind: 'no_qualifying_clusters' }, summary };
  }

  const scored = scoreClusters(classified, now);
  const top = scored[0];
  if (!top) {
    // Defensive: classified.length > 0 implies scored.length > 0.
    throw new Error('synthesize-weekly: scored array empty after non-empty input');
  }
  summary.clustersActive = scored.length;

  const proposedTitle = await generateTitle(top, anthropic);

  const persisted = await persistAll(db, {
    scored,
    top,
    proposedTitle,
    discards,
    surfacedForWeek,
  });

  await sendInngestEvent({
    name: 'interview.session.requested',
    data: { candidateId: persisted.candidateId },
  });

  const tg = await sendTelegramPreview({
    token: env.telegramBotToken,
    chatId: env.telegramChatId,
    message: buildPreviewMessage({
      title: proposedTitle,
      pillar: top.pillar,
      signalCount: top.signalIds.length,
    }),
    fetchFn,
  });
  recordTelegram(summary, tg, logger);

  summary.outcome = 'success';
  logger.info(
    { ...summary, candidateId: persisted.candidateId, action: 'synthesize_weekly_completed' },
    'synthesize-weekly completed',
  );

  return {
    outcome: {
      kind: 'success',
      candidateId: persisted.candidateId,
      clusterCount: scored.length,
      telegramSent: tg.ok,
    },
    summary,
  };
}

function recordTelegram(
  summary: RunSummary,
  result: TelegramSendResult,
  logger: Logger,
): void {
  summary.telegramSent = result.ok;
  if (!result.ok) {
    const warning = `telegram_send_failed: ${result.error ?? 'unknown'}`;
    summary.warnings.push(warning);
    logger.warn(
      { source: SOURCE, action: 'telegram_send_failed', reason: result.error },
      'telegram preview send failed; run continues',
    );
  }
}

/**
 * Factory: produces the Inngest cron function bound to the given client.
 *
 * Exported as a factory rather than a top-level
 * `inngest.createFunction(...)` call so `src/index.ts` (which owns the
 * `Inngest` instance) imports this module and constructs the function,
 * avoiding a circular import. Matches the pattern in
 * `artifacts/capture-worker/src/jobs/ingest-msgraph-email/index.ts`.
 */
export function createSynthesizeWeeklyCron(
  inngest: Inngest.Any,
): InngestFunction.Any {
  return inngest.createFunction(
    {
      id: 'synthesize-weekly',
      name: 'Weekly Synthesis Job',
    },
    { cron: '0 7 * * 0' },
    async ({ step }) => {
      const logger = createLogger({ source: SOURCE });
      const env = readEnv();
      const db = createDbClient();
      const anthropic = new Anthropic({ apiKey: env.anthropicApiKey });

      const { outcome, summary } = await step.run(
        'run-synthesize-weekly',
        async () => {
          // step.sendEvent cannot nest inside step.run, so we capture the
          // outcome here and dispatch the event at the function top level
          // immediately afterwards.
          const result = await runSynthesizeWeekly({
            db,
            anthropic,
            logger,
            fetchFn: fetch,
            sendInngestEvent: async () => {
              // No-op inside step.run; real dispatch happens below.
              return Promise.resolve();
            },
            env: {
              telegramBotToken: env.telegramBotToken,
              telegramChatId: env.telegramChatId,
            },
            now: new Date(),
          });
          return result;
        },
      );

      if (outcome.kind === 'success') {
        await step.sendEvent('dispatch-interview', {
          name: 'interview.session.requested',
          data: { candidateId: outcome.candidateId },
        });
      }

      return { outcome, summary };
    },
  );
}
