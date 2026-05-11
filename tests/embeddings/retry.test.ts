import { describe, expect, it, vi } from 'vitest';

import {
  EmbeddingApiError,
  EmbeddingRetryExhaustedError,
} from '../../lib/embeddings/src/errors.js';
import {
  DEFAULT_RETRY_POLICY,
  isRateLimitError,
  isServerError,
  withRetry,
} from '../../lib/embeddings/src/retry.js';
import type { RetryPolicy } from '../../lib/embeddings/src/types.js';

interface StatusError extends Error {
  status: number;
}

function makeStatusError(status: number, message = `HTTP ${status}`): StatusError {
  const err = new Error(message) as StatusError;
  err.status = status;
  return err;
}

const POLICY: RetryPolicy = DEFAULT_RETRY_POLICY;

describe('isRateLimitError / isServerError', () => {
  it('classifies 429 as rate-limit', () => {
    expect(isRateLimitError(makeStatusError(429))).toBe(true);
    expect(isRateLimitError(makeStatusError(500))).toBe(false);
    expect(isRateLimitError(new Error('boom'))).toBe(false);
  });

  it('classifies 5xx as server error', () => {
    expect(isServerError(makeStatusError(500))).toBe(true);
    expect(isServerError(makeStatusError(503))).toBe(true);
    expect(isServerError(makeStatusError(429))).toBe(false);
    expect(isServerError(makeStatusError(400))).toBe(false);
  });
});

describe('withRetry()', () => {
  it('returns immediately on first-try success without sleeping', async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    const fn = vi.fn(async () => 'ok');
    const result = await withRetry(fn, POLICY, { sleep });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries 429 with exponential backoff capped at maxMs', async () => {
    // Build a sequence: 429, 429, 429, 429, 429, 'ok' (6th call succeeds).
    // 5 retries means 5 sleeps between 6 attempts.
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls <= 5) throw makeStatusError(429);
      return 'ok';
    });
    const sleeps: number[] = [];
    const sleep = vi.fn(async (ms: number) => {
      sleeps.push(ms);
    });

    const result = await withRetry(fn, POLICY, { sleep });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(6);
    // Expected delays: 1000 * 2^0..2^4 = 1000, 2000, 4000, 8000, 16000.
    expect(sleeps).toEqual([1000, 2000, 4000, 8000, 16000]);
  });

  it('caps backoff at maxMs when 2^attempt * baseMs would exceed it', async () => {
    // Configure a tighter cap: base 1s, cap 5s, 5 retries.
    const policy: RetryPolicy = {
      on429: { baseMs: 1000, maxMs: 5000, maxRetries: 5 },
      on500: { delayMs: 10_000, maxRetries: 1 },
    };
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls <= 5) throw makeStatusError(429);
      return 'ok';
    });
    const sleeps: number[] = [];
    const sleep = vi.fn(async (ms: number) => {
      sleeps.push(ms);
    });

    await withRetry(fn, policy, { sleep });
    // 1000, 2000, 4000, 5000(cap), 5000(cap)
    expect(sleeps).toEqual([1000, 2000, 4000, 5000, 5000]);
  });

  it('throws EmbeddingRetryExhaustedError after the 429 retry budget', async () => {
    const fn = vi.fn(async () => {
      throw makeStatusError(429);
    });
    const sleep = vi.fn(async (_ms: number) => {});

    await expect(withRetry(fn, POLICY, { sleep })).rejects.toBeInstanceOf(
      EmbeddingRetryExhaustedError,
    );
    // 1 initial attempt + 5 retries = 6 calls total.
    expect(fn).toHaveBeenCalledTimes(6);
    expect(sleep).toHaveBeenCalledTimes(5);
  });

  it('retries a single 500 after 10s, then throws EmbeddingApiError on a second 500', async () => {
    const fn = vi.fn(async () => {
      throw makeStatusError(500);
    });
    const sleep = vi.fn(async (_ms: number) => {});

    await expect(withRetry(fn, POLICY, { sleep })).rejects.toBeInstanceOf(
      EmbeddingApiError,
    );
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(10_000);
  });

  it('500 then success: returns successfully after one 10s retry', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw makeStatusError(500);
      return 'ok';
    });
    const sleep = vi.fn(async (_ms: number) => {});

    const result = await withRetry(fn, POLICY, { sleep });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(10_000);
  });

  it('rethrows non-retryable errors immediately without retrying', async () => {
    const err400 = makeStatusError(400, 'bad request');
    const fn = vi.fn(async () => {
      throw err400;
    });
    const sleep = vi.fn(async (_ms: number) => {});

    await expect(withRetry(fn, POLICY, { sleep })).rejects.toBe(err400);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('invokes the onRetry hook for each retry with reason and delay', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw makeStatusError(429);
      if (calls === 2) throw makeStatusError(500);
      return 'ok';
    });
    const sleep = vi.fn(async (_ms: number) => {});
    const onRetry = vi.fn();

    await withRetry(fn, POLICY, { sleep, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry.mock.calls[0]?.[0]).toMatchObject({
      reason: '429',
      delayMs: 1000,
      attempt: 1,
    });
    expect(onRetry.mock.calls[1]?.[0]).toMatchObject({
      reason: '500',
      delayMs: 10_000,
      attempt: 1,
    });
  });
});
