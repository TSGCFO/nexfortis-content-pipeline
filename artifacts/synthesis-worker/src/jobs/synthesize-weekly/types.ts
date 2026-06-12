/**
 * Shared types for the synthesize-weekly Inngest cron.
 *
 * `AnthropicLike` is the minimal structural slice of the
 * `@anthropic-ai/sdk` client we depend on. Defining it locally lets tests
 * inject a small mock without standing up the heavyweight SDK class.
 */

import type { Pillar } from '@ncp/shared-types';

/**
 * One row from `capture_signals` after we have converted the driver-returned
 * `number[]` embedding to a `Float32Array` for clustering math.
 */
export interface SignalRow {
  id: string;
  capturedAt: Date;
  redactedText: string;
  embedding: Float32Array;
}

/** A cluster as produced by `clusterSignals`. */
export interface Cluster {
  signalIds: string[];
  members: SignalRow[];
}

/** A cluster that has been successfully labeled by Claude Sonnet. */
export interface LabeledCluster extends Cluster {
  label: string;
  topicKeywords: string[];
}

/** A labeled cluster with a valid in-pillar classification. */
export interface ClassifiedCluster extends LabeledCluster {
  pillar: Pillar;
}

/** A classified cluster after scoring. */
export interface ScoredCluster extends ClassifiedCluster {
  score: number;
}

/** Reason a cluster was dropped before becoming an `article_candidate`. */
export type DiscardReason =
  | 'label_incoherent'
  | 'off_pillar'
  | 'pillar_classification_failed';

/**
 * A cluster that was discarded mid-pipeline but is still persisted to
 * `synthesis_clusters` with `status = 'discarded'` for audit. The
 * discard reason is stored in `serp_gap` (a permissive JSONB).
 */
export interface DiscardedClusterRecord {
  signalIds: string[];
  label: string;
  topicKeywords: string[];
  reason: DiscardReason;
  haikuClassification: string | undefined;
}

/** Discriminated outcome returned by the orchestrator. */
export type RunOutcome =
  | {
      kind: 'success';
      candidateId: string;
      clusterCount: number;
      telegramSent: boolean;
    }
  | { kind: 'no_signals' }
  | { kind: 'no_qualifying_clusters' };

/** Per-run counters for structured logging. */
export interface RunSummary {
  source: 'synthesis_worker';
  signalsConsidered: number;
  clustersFormed: number;
  clustersLabeled: number;
  clustersDiscardedLabelIncoherent: number;
  clustersDiscardedOffPillar: number;
  clustersDiscardedPillarFailed: number;
  clustersActive: number;
  outcome: RunOutcome['kind'];
  telegramSent: boolean;
  warnings: string[];
}

/** Result of an attempted Telegram `sendMessage` call. */
export interface TelegramSendResult {
  ok: boolean;
  error: string | undefined;
}

/**
 * Structural type of the `@anthropic-ai/sdk` client we actually use. Tests
 * inject mocks matching this shape; the orchestrator passes the real
 * `new Anthropic({ apiKey })` instance.
 */
export interface AnthropicLike {
  messages: {
    create(args: {
      model: string;
      max_tokens: number;
      system?: string;
      /**
       * Structured-outputs / effort surface. `@anthropic-ai/sdk@^0.28.0`
       * does not type `output_config`, but the wire-level API accepts it
       * (the SDK forwards unknown keys) — same pattern as
       * `artifacts/telegram-bot/.../anthropic-shapes.ts`.
       */
      output_config?: {
        effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
        format?: { type: 'json_schema'; schema: unknown };
      };
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    }): Promise<{
      /** Optional so existing test mocks without it remain assignable. */
      stop_reason?: string | null;
      content: Array<{ type: string; text?: string }>;
    }>;
  };
}
