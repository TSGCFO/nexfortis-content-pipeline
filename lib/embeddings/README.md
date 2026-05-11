# `@ncp/embeddings`

Token-aware chunking plus an OpenAI `text-embedding-3-large` wrapper for the
NexFortis Content Pipeline v2 capture/synthesis layer.

This is a stateless library. It does not read or write the database. It does
not enforce idempotency at the storage layer — that is the caller's job.

## Spec references

- `docs/ways-of-work/plan/content-pipeline-v2/architecture-and-data-model.md`
  §6 — Pgvector specifics (dimension 3072, cosine).
- `docs/ways-of-work/plan/content-pipeline-v2/architecture-and-data-model.md`
  §7.3 — OpenAI integration (model, batching, retry policy, idempotency).
- `docs/ways-of-work/plan/content-pipeline-v2/capture-synthesis-layer/prd.md`
  — chunk size 500–800 tokens with 100-token overlap.

## Usage

```ts
import { chunk, embed } from '@ncp/embeddings';

const chunks = chunk(longText); // 500–800 tokens each, 100-token overlap

const result = await embed({
  texts: chunks.map((c) => c.text),
  openaiApiKey: process.env.OPENAI_API_KEY!,
  orgId: process.env.OPENAI_ORG_ID,
});

console.log(result.embeddings.length); // === chunks.length
console.log(result.embeddings[0]?.length); // 3072
console.log(result.usage); // { totalTokens, promptTokens }
```

## Behavior

- **Model:** `text-embedding-3-large` (override via `model`).
- **Tokenizer:** `o200k_base` via the `tiktoken` package — the encoding used
  by `text-embedding-3-large` for token counting.
- **Dimension:** 3072. The `dimensions` parameter is intentionally not passed
  to OpenAI — per §6, v2 uses native dimensionality.
- **Batch size:** 100 texts per API call. The OpenAI endpoint accepts up to
  2048 per call but §7.3 caps us at 100 to stay under Tier 1 RPM.
- **Per-input limit:** 8191 tokens. A larger single text throws
  `EmbeddingConfigError` — chunk first.
- **Empty input:** `chunk('')` returns `[]`. `embed({ texts: [], ... })`
  returns an empty result without making an API call.

### Retry policy (matches §7.3 exactly)

- **429 Too Many Requests:** exponential backoff. Base 1s, factor 2x, capped
  at 30s, max 5 retries after the initial attempt. Exhaustion throws
  `EmbeddingRetryExhaustedError`.
- **5xx server errors:** single retry after 10s. A second 5xx throws
  `EmbeddingApiError`.
- **All other errors** (400, 401, 403, 404, network, etc.) propagate
  immediately as `EmbeddingApiError` with the OpenAI message preserved.

### Idempotency — the caller's job

This module **always re-runs the API call**. It does no caching and does not
look at the database. To satisfy the §7.3 idempotency requirement, callers
must check `embedding IS NULL` in the `capture_signals` table before invoking
`embed()`. This module's only idempotency contract is "given the same input,
the API call is deterministic modulo OpenAI's model" — we add no
non-determinism on our own.

### Logging

Uses `@ncp/logger` with `source: 'embeddings'`. Each batch start is logged at
`debug`, each retry at `warn`, terminal failures at `error`. Raw input texts
and embeddings are never logged.

## Error classes

| Class | `code` | Thrown when |
|---|---|---|
| `EmbeddingConfigError` | `'EMBEDDING_CONFIG'` | Missing API key, input text > 8191 tokens, invalid `chunk()` options |
| `EmbeddingApiError` | `'EMBEDDING_API'` | 4xx/5xx from OpenAI that is not retried, or 5xx after the single retry |
| `EmbeddingRetryExhaustedError` | `'EMBEDDING_RETRY_EXHAUSTED'` | 429 retry budget exhausted |

## Out of scope

This module does not implement:

- Whisper transcription (a separate ingester's job)
- Database access or similarity search (`@ncp/db`)
- Re-embedding migrations
- An embedding cache
