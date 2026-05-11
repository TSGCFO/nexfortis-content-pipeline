/**
 * Retry helper implementing the exact policy from §7.3 of
 * `architecture-and-data-model.md`:
 *  - 429 → exponential backoff (base 1s, factor 2x, capped at 30s, max 5
 *    retries after initial attempt). On exhaustion: `EmbeddingRetryExhaustedError`.
 *  - 500-class → single retry after 10s. On second failure:
 *    `EmbeddingApiError`.
 *  - Any other error: rethrown immediately.
 */

import {
  EmbeddingApiError,
  EmbeddingRetryExhaustedError,
} from './errors.js';
import type { RetryPolicy } from './types.js';

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  on429: { baseMs: 1000, maxMs: 30_000, maxRetries: 5 },
  on500: { delayMs: 10_000, maxRetries: 1 },
};

export type RetryReason = '429' | '500';

export interface RetryHook {
  attempt: number;
  delayMs: number;
  reason: RetryReason;
  error: unknown;
}

export interface WithRetryHooks {
  onRetry?: (info: RetryHook) => void;
  /** Custom sleep, mainly for tests. Defaults to a real `setTimeout`. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function getStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const maybeStatus = (err as { status?: unknown }).status;
  return typeof maybeStatus === 'number' ? maybeStatus : undefined;
}

export function isRateLimitError(err: unknown): boolean {
  return getStatus(err) === 429;
}

export function isServerError(err: unknown): boolean {
  const status = getStatus(err);
  return typeof status === 'number' && status >= 500 && status < 600;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy,
  hooks?: WithRetryHooks,
): Promise<T> {
  const sleep = hooks?.sleep ?? defaultSleep;
  let retries429 = 0;
  let retries500 = 0;

  // Loop until we either return successfully or throw a terminal error.
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (isRateLimitError(err)) {
        if (retries429 >= policy.on429.maxRetries) {
          throw new EmbeddingRetryExhaustedError(
            `OpenAI returned 429 after ${retries429} retries`,
            { cause: err, attempts: retries429 + 1 },
          );
        }
        const delay = Math.min(
          policy.on429.baseMs * Math.pow(2, retries429),
          policy.on429.maxMs,
        );
        retries429 += 1;
        hooks?.onRetry?.({
          attempt: retries429,
          delayMs: delay,
          reason: '429',
          error: err,
        });
        await sleep(delay);
        continue;
      }

      if (isServerError(err)) {
        if (retries500 >= policy.on500.maxRetries) {
          const status = getStatus(err);
          throw new EmbeddingApiError(
            `OpenAI returned a 5xx after ${retries500} retries`,
            status !== undefined ? { cause: err, status } : { cause: err },
          );
        }
        retries500 += 1;
        hooks?.onRetry?.({
          attempt: retries500,
          delayMs: policy.on500.delayMs,
          reason: '500',
          error: err,
        });
        await sleep(policy.on500.delayMs);
        continue;
      }

      // Non-retriable: rethrow as-is so the caller can wrap it.
      throw err;
    }
  }
}
