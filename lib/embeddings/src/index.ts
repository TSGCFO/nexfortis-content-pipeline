/**
 * `@ncp/embeddings` — token-aware chunking + OpenAI `text-embedding-3-large`
 * wrapper for the NexFortis Content Pipeline v2.
 *
 * See `./README.md` for usage and the spec references in
 * `architecture-and-data-model.md` §6 and §7.3.
 */

export { chunk, type ChunkOptions } from './chunk.js';
export { embed } from './embed.js';
export {
  EmbeddingApiError,
  EmbeddingConfigError,
  EmbeddingRetryExhaustedError,
} from './errors.js';
export { DEFAULT_RETRY_POLICY, withRetry } from './retry.js';
export type {
  Chunk,
  EmbedInput,
  EmbedOptions,
  EmbedResult,
  RetryPolicy,
} from './types.js';
