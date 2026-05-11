/**
 * Stateless wrapper around the OpenAI Embeddings API for
 * `text-embedding-3-large`.
 *
 * - Batches up to 100 texts per call (per §7.3 RPM-safety guidance).
 * - Uses the §7.3 retry policy: exponential backoff on 429, single retry on
 *   500 after 10s.
 * - Does NOT pass the `dimensions` parameter (per §6: the v2 corpus uses the
 *   native 3072-dim vectors).
 * - Idempotency is the caller's job: this module always re-runs the API
 *   call. Callers must check `embedding IS NULL` in the database before
 *   invoking us (see README).
 */

import OpenAI from 'openai';
import { get_encoding } from 'tiktoken';

import { createLogger } from '@ncp/logger';

import { EmbeddingApiError, EmbeddingConfigError } from './errors.js';
import { DEFAULT_RETRY_POLICY, isRateLimitError, isServerError, withRetry } from './retry.js';
import type { EmbedInput, EmbedResult } from './types.js';

const DEFAULT_MODEL = 'text-embedding-3-large';
const BATCH_SIZE = 100;
const PER_INPUT_TOKEN_LIMIT = 8191;

const logger = createLogger({ source: 'embeddings' });

interface OpenAILike {
  embeddings: {
    create(args: {
      model: string;
      input: string[];
    }): Promise<{
      data: Array<{ embedding: number[]; index: number }>;
      usage: { prompt_tokens: number; total_tokens: number };
    }>;
  };
}

/**
 * @internal — exposed for tests so they can inject a mock client without
 * mocking the entire `openai` module surface. Production code should not
 * import this.
 */
export interface EmbedInternalDeps {
  buildClient?: (input: EmbedInput) => OpenAILike;
}

/**
 * `embed` is intentionally a non-`async` function that returns a Promise.
 * This lets us throw `EmbeddingConfigError` synchronously for invalid input
 * (per the §7.3 contract) instead of returning a rejected promise.
 */
export function embed(
  input: EmbedInput,
  internal?: EmbedInternalDeps,
): Promise<EmbedResult> {
  if (typeof input.openaiApiKey !== 'string' || input.openaiApiKey.length === 0) {
    throw new EmbeddingConfigError('embed: openaiApiKey is required');
  }
  return embedInternal(input, internal);
}

async function embedInternal(
  input: EmbedInput,
  internal?: EmbedInternalDeps,
): Promise<EmbedResult> {
  const model = input.model ?? DEFAULT_MODEL;
  const policy = input.options?.retryPolicy ?? DEFAULT_RETRY_POLICY;

  if (input.texts.length === 0) {
    return {
      embeddings: [],
      tokenCounts: [],
      model,
      usage: { totalTokens: 0, promptTokens: 0 },
    };
  }

  // Pre-flight token counts: enforce the per-input cap and surface counts.
  const enc = get_encoding('o200k_base');
  let tokenCounts: number[];
  try {
    tokenCounts = input.texts.map((t) => enc.encode(t).length);
  } finally {
    enc.free();
  }
  for (let i = 0; i < tokenCounts.length; i += 1) {
    const count = tokenCounts[i] ?? 0;
    if (count > PER_INPUT_TOKEN_LIMIT) {
      throw new EmbeddingConfigError(
        `embed: text at index ${i} has ${count} tokens, exceeding the ${PER_INPUT_TOKEN_LIMIT}-token per-input limit for ${model}. Chunk inputs first via chunk().`,
      );
    }
  }

  const client: OpenAILike = internal?.buildClient
    ? internal.buildClient(input)
    : (new OpenAI({
        apiKey: input.openaiApiKey,
        ...(typeof input.orgId === 'string' && input.orgId.length > 0
          ? { organization: input.orgId }
          : {}),
      }) as unknown as OpenAILike);

  const allEmbeddings: number[][] = new Array<number[]>(input.texts.length);
  let totalTokens = 0;
  let promptTokens = 0;

  for (let i = 0; i < input.texts.length; i += BATCH_SIZE) {
    const batch = input.texts.slice(i, i + BATCH_SIZE);
    const batchIndex = Math.floor(i / BATCH_SIZE);
    logger.debug(
      {
        action: 'embed.batch.start',
        batchIndex,
        batchSize: batch.length,
        model,
      },
      'embeddings batch start',
    );

    let response: Awaited<ReturnType<OpenAILike['embeddings']['create']>>;
    try {
      response = await withRetry(
        () => client.embeddings.create({ model, input: batch }),
        policy,
        {
          onRetry: (info) => {
            logger.warn(
              {
                action: 'embed.batch.retry',
                batchIndex,
                attempt: info.attempt,
                delayMs: info.delayMs,
                reason: info.reason,
              },
              'embeddings retry',
            );
          },
        },
      );
    } catch (err) {
      logger.error(
        {
          action: 'embed.batch.failed',
          batchIndex,
          batchSize: batch.length,
          model,
          errorName: err instanceof Error ? err.name : 'unknown',
          errorMessage: err instanceof Error ? err.message : String(err),
        },
        'embeddings batch failed',
      );
      // Already-classified errors propagate as-is. Other API errors (e.g.
      // 400/401/403/404) are wrapped in EmbeddingApiError so callers see a
      // single error surface from this module.
      if (
        err instanceof EmbeddingApiError ||
        // EmbeddingRetryExhaustedError comes from withRetry — let it through.
        (err instanceof Error && err.name === 'EmbeddingRetryExhaustedError')
      ) {
        throw err;
      }
      if (isRateLimitError(err) || isServerError(err)) {
        // withRetry should have already turned these into one of our errors.
        // Defensive fallback in case a custom RetryPolicy disabled retries.
        throw new EmbeddingApiError(
          err instanceof Error ? err.message : 'OpenAI request failed',
          { cause: err, ...(getStatusFrom(err) !== undefined ? { status: getStatusFrom(err) as number } : {}) },
        );
      }
      throw new EmbeddingApiError(
        err instanceof Error ? err.message : 'OpenAI request failed',
        { cause: err, ...(getStatusFrom(err) !== undefined ? { status: getStatusFrom(err) as number } : {}) },
      );
    }

    // Place results back in original order using the index field; OpenAI
    // returns them in the same order as the input but we don't rely on it.
    for (let j = 0; j < response.data.length; j += 1) {
      const item = response.data[j];
      if (!item) continue;
      const targetIndex = i + (typeof item.index === 'number' ? item.index : j);
      allEmbeddings[targetIndex] = item.embedding;
    }
    totalTokens += response.usage.total_tokens;
    promptTokens += response.usage.prompt_tokens;
  }

  return {
    embeddings: allEmbeddings,
    tokenCounts,
    model,
    usage: { totalTokens, promptTokens },
  };
}

function getStatusFrom(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const maybe = (err as { status?: unknown }).status;
  return typeof maybe === 'number' ? maybe : undefined;
}
