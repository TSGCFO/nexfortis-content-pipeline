import { describe, expect, it, vi, beforeEach } from 'vitest';

const { debugMock, infoMock, warnMock, errorMock } = vi.hoisted(() => ({
  debugMock: vi.fn(),
  infoMock: vi.fn(),
  warnMock: vi.fn(),
  errorMock: vi.fn(),
}));

vi.mock('@ncp/logger', () => ({
  createLogger: () => ({
    trace: vi.fn(),
    debug: debugMock,
    info: infoMock,
    warn: warnMock,
    error: errorMock,
    fatal: vi.fn(),
  }),
}));

import { embed } from '../../lib/embeddings/src/embed.js';
import {
  EmbeddingConfigError,
  EmbeddingRetryExhaustedError,
} from '../../lib/embeddings/src/errors.js';
import type { EmbedInput, RetryPolicy } from '../../lib/embeddings/src/types.js';

const FAST_POLICY: RetryPolicy = {
  on429: { baseMs: 1, maxMs: 4, maxRetries: 5 },
  on500: { delayMs: 1, maxRetries: 1 },
};

function makeFakeEmbedding(seed: number): number[] {
  const v = new Array<number>(3072);
  for (let i = 0; i < 3072; i += 1) {
    v[i] = (seed + i) % 7;
  }
  return v;
}

interface CreateArgs {
  model: string;
  input: string[];
}

interface CreateResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

interface FakeClient {
  embeddings: { create: ReturnType<typeof vi.fn> };
  calls: CreateArgs[];
}

function makeFakeClient(
  handler: (args: CreateArgs, callIndex: number) => Promise<CreateResponse>,
): FakeClient {
  const calls: CreateArgs[] = [];
  const create = vi.fn(async (args: CreateArgs) => {
    const callIndex = calls.length;
    calls.push(args);
    return handler(args, callIndex);
  });
  return { embeddings: { create }, calls };
}

function defaultHandler(args: CreateArgs): Promise<CreateResponse> {
  return Promise.resolve({
    data: args.input.map((_t, idx) => ({
      embedding: makeFakeEmbedding(idx),
      index: idx,
    })),
    usage: { prompt_tokens: args.input.length * 5, total_tokens: args.input.length * 5 },
  });
}

interface StatusError extends Error {
  status: number;
}

function statusError(status: number): StatusError {
  const e = new Error(`HTTP ${status}`) as StatusError;
  e.status = status;
  return e;
}

describe('embed()', () => {
  beforeEach(() => {
    debugMock.mockClear();
    infoMock.mockClear();
    warnMock.mockClear();
    errorMock.mockClear();
  });

  it('throws EmbeddingConfigError synchronously when openaiApiKey is missing', () => {
    const input = {
      texts: ['hello'],
      openaiApiKey: '',
    } as EmbedInput;
    expect(() => embed(input)).toThrow(EmbeddingConfigError);
  });

  it('short-circuits an empty texts array without calling the API', async () => {
    const client = makeFakeClient(defaultHandler);
    const result = await embed(
      {
        texts: [],
        openaiApiKey: 'sk-test',
      },
      { buildClient: () => client },
    );
    expect(client.calls).toHaveLength(0);
    expect(result).toEqual({
      embeddings: [],
      tokenCounts: [],
      model: 'text-embedding-3-large',
      usage: { totalTokens: 0, promptTokens: 0 },
    });
  });

  it('embeds a single text in one API call and returns a 3072-dim vector', async () => {
    const client = makeFakeClient(defaultHandler);
    const result = await embed(
      {
        texts: ['hello world'],
        openaiApiKey: 'sk-test',
      },
      { buildClient: () => client },
    );
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]?.model).toBe('text-embedding-3-large');
    expect(client.calls[0]?.input).toEqual(['hello world']);
    expect(result.embeddings).toHaveLength(1);
    expect(result.embeddings[0]).toHaveLength(3072);
    expect(result.tokenCounts).toHaveLength(1);
    expect(result.tokenCounts[0]).toBeGreaterThan(0);
  });

  it('batches 150 texts into two API calls (100 + 50) and concatenates in order', async () => {
    const client = makeFakeClient((args, callIndex) =>
      Promise.resolve({
        data: args.input.map((_t, idx) => ({
          // Encode batch + position in the embedding so we can verify order.
          embedding: makeFakeEmbedding(callIndex * 1000 + idx),
          index: idx,
        })),
        usage: { prompt_tokens: args.input.length, total_tokens: args.input.length },
      }),
    );

    const texts = Array.from({ length: 150 }, (_, i) => `text-${i}`);
    const result = await embed(
      {
        texts,
        openaiApiKey: 'sk-test',
      },
      { buildClient: () => client },
    );

    expect(client.calls).toHaveLength(2);
    expect(client.calls[0]?.input).toHaveLength(100);
    expect(client.calls[1]?.input).toHaveLength(50);
    expect(client.calls[0]?.input[0]).toBe('text-0');
    expect(client.calls[0]?.input[99]).toBe('text-99');
    expect(client.calls[1]?.input[0]).toBe('text-100');
    expect(client.calls[1]?.input[49]).toBe('text-149');

    expect(result.embeddings).toHaveLength(150);
    // First batch results: seed = 0*1000 + idx (idx 0..99).
    expect(result.embeddings[0]?.[0]).toBe(makeFakeEmbedding(0)[0]);
    expect(result.embeddings[99]?.[0]).toBe(makeFakeEmbedding(99)[0]);
    // Second batch results: seed = 1*1000 + (idx within batch).
    expect(result.embeddings[100]?.[0]).toBe(makeFakeEmbedding(1000)[0]);
    expect(result.embeddings[149]?.[0]).toBe(makeFakeEmbedding(1049)[0]);

    expect(result.usage.totalTokens).toBe(150);
    expect(result.usage.promptTokens).toBe(150);
  });

  it('does NOT pass the dimensions parameter to OpenAI (per §6 v2 spec)', async () => {
    const client = makeFakeClient(defaultHandler);
    await embed(
      { texts: ['x'], openaiApiKey: 'sk-test' },
      { buildClient: () => client },
    );
    expect(client.calls[0]).toBeDefined();
    expect(Object.keys(client.calls[0]!)).not.toContain('dimensions');
    // Defensive: also ensure the value is not present even if the key exists
    // with `undefined`.
    expect((client.calls[0] as Record<string, unknown>)['dimensions']).toBeUndefined();
  });

  it('retries 429 once then succeeds, observing the retry', async () => {
    let call = 0;
    const client = makeFakeClient((args) => {
      call += 1;
      if (call === 1) return Promise.reject(statusError(429));
      return defaultHandler(args);
    });

    const result = await embed(
      {
        texts: ['hello'],
        openaiApiKey: 'sk-test',
        options: { retryPolicy: FAST_POLICY },
      },
      { buildClient: () => client },
    );

    expect(client.calls).toHaveLength(2);
    expect(result.embeddings).toHaveLength(1);
    expect(result.embeddings[0]).toHaveLength(3072);
    // The retry should have logged a warning.
    const retryWarn = warnMock.mock.calls.find(
      (c) =>
        typeof c[0] === 'object' &&
        c[0] !== null &&
        (c[0] as { action?: unknown }).action === 'embed.batch.retry',
    );
    expect(retryWarn).toBeDefined();
  });

  it('throws EmbeddingRetryExhaustedError when 429 budget is exhausted', async () => {
    const client = makeFakeClient(() => Promise.reject(statusError(429)));

    await expect(
      embed(
        {
          texts: ['hello'],
          openaiApiKey: 'sk-test',
          options: { retryPolicy: FAST_POLICY },
        },
        { buildClient: () => client },
      ),
    ).rejects.toBeInstanceOf(EmbeddingRetryExhaustedError);
    // 1 initial + 5 retries = 6 calls.
    expect(client.calls).toHaveLength(6);
  });

  it('throws EmbeddingConfigError synchronously when a single text exceeds 8191 tokens', async () => {
    // " word" encodes to one token in o200k_base, so 8200 repetitions yield
    // ~8200 tokens — over the 8191 limit.
    const oversized = ' word'.repeat(8200).trimStart();
    const client = makeFakeClient(defaultHandler);

    await expect(
      embed(
        {
          texts: [oversized],
          openaiApiKey: 'sk-test',
        },
        { buildClient: () => client },
      ),
    ).rejects.toBeInstanceOf(EmbeddingConfigError);
    // Pre-flight rejection: no API call should have been made.
    expect(client.calls).toHaveLength(0);
  });

  it('does not log raw input texts or embeddings in any log call', async () => {
    const secretText = 'SUPER-SECRET-INPUT-TOKEN-XYZZY';
    const client = makeFakeClient(defaultHandler);

    await embed(
      {
        texts: [secretText],
        openaiApiKey: 'sk-test',
      },
      { buildClient: () => client },
    );

    const allLogCalls = [
      ...debugMock.mock.calls,
      ...infoMock.mock.calls,
      ...warnMock.mock.calls,
      ...errorMock.mock.calls,
    ];
    expect(allLogCalls.length).toBeGreaterThan(0);

    for (const call of allLogCalls) {
      const serialized = JSON.stringify(call);
      expect(serialized).not.toContain(secretText);
      // No 3072-length number arrays should appear in any log payload.
      for (const arg of call) {
        if (Array.isArray(arg) && arg.length === 3072) {
          throw new Error('Embedding vector found in log call');
        }
        if (typeof arg === 'object' && arg !== null) {
          for (const v of Object.values(arg as Record<string, unknown>)) {
            if (Array.isArray(v) && v.length === 3072) {
              throw new Error('Embedding vector found in log call payload');
            }
          }
        }
      }
    }
  });

  it('logs an error and rethrows on terminal failure', async () => {
    const client = makeFakeClient(() => Promise.reject(statusError(429)));

    await expect(
      embed(
        {
          texts: ['x'],
          openaiApiKey: 'sk-test',
          options: { retryPolicy: FAST_POLICY },
        },
        { buildClient: () => client },
      ),
    ).rejects.toBeInstanceOf(EmbeddingRetryExhaustedError);

    const errored = errorMock.mock.calls.find(
      (c) =>
        typeof c[0] === 'object' &&
        c[0] !== null &&
        (c[0] as { action?: unknown }).action === 'embed.batch.failed',
    );
    expect(errored).toBeDefined();
  });
});
