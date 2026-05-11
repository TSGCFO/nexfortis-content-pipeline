/**
 * Public types for `@ncp/embeddings`.
 *
 * Reference: docs/ways-of-work/plan/content-pipeline-v2/architecture-and-data-model.md
 *  - §6 Pgvector Specifics (dimension 3072, cosine)
 *  - §7.3 OpenAI integration (text-embedding-3-large, batching, retry policy)
 */

/**
 * One token-aware chunk of text, suitable for embedding.
 *
 * `startTokenOffset` and `endTokenOffset` are token indices into the
 * `o200k_base` encoding of the original input text.
 */
export interface Chunk {
  text: string;
  tokenCount: number;
  startTokenOffset: number;
  endTokenOffset: number;
}

/**
 * Retry policy for the OpenAI embeddings call.
 *
 * Per §7.3:
 *  - 429 → exponential backoff
 *  - 500 → retry once after 10s
 */
export interface RetryPolicy {
  on429: { baseMs: number; maxMs: number; maxRetries: number };
  on500: { delayMs: number; maxRetries: 1 };
}

/**
 * Optional knobs for `embed()`. Callers normally do not need to pass these.
 */
export interface EmbedOptions {
  retryPolicy?: RetryPolicy;
  signal?: AbortSignal;
}

/**
 * Input to `embed()`.
 *
 * Pass already-chunked texts (each ≤ 8191 tokens for `text-embedding-3-large`).
 * Use `chunk()` from this module to produce them.
 */
export interface EmbedInput {
  texts: string[];
  openaiApiKey: string;
  model?: string;
  orgId?: string;
  options?: EmbedOptions;
}

/**
 * Result of `embed()`.
 *
 * Invariant: `embeddings.length === texts.length` and
 * `tokenCounts.length === texts.length`. Each embedding has length 3072
 * (the native dimension of `text-embedding-3-large`; the `dimensions`
 * parameter is intentionally not passed — see §6).
 */
export interface EmbedResult {
  embeddings: number[][];
  tokenCounts: number[];
  model: string;
  usage: { totalTokens: number; promptTokens: number };
}
