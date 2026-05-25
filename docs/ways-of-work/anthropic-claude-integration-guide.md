# Anthropic Claude Integration Guide

**Document Owner:** Hassan Sadiq, NexFortis
**Status:** Living document — update when Anthropic ships new models or behaviour changes
**Audience:** Cursor agents / Claude Code (primary implementer), Computer (orchestrator), future contributors
**Last verified against Anthropic docs:** May 2026

---

## Purpose

This guide is the **single source of truth** for how the NexFortis content pipeline calls the
Anthropic Claude API. It exists because:

1. The current generation of Claude models (Opus 4.7 in particular) has several backward-incompatible
   behaviours vs. older Claude 3.5 / Claude 4.5 / Sonnet 4.6 patterns. The synthesis-worker
   (`artifacts/synthesis-worker/`) already uses some of those older patterns; copying them blindly into
   any artifact that uses Opus 4.7 will produce 400-error responses at runtime.
2. We have multiple Claude integrations across the codebase (`lib/redaction`, `artifacts/synthesis-worker`,
   the future `artifacts/telegram-bot` / `artifacts/gate-worker` / `artifacts/sanity-bridge`). Each
   needs the same correctness invariants.
3. Cursor agents and Claude Code subagents do not automatically read Anthropic docs; they read this
   repository. Documenting the correct call patterns here means every future prompt can simply say
   "follow `docs/ways-of-work/anthropic-claude-integration-guide.md`" without re-citing five Anthropic
   pages.

**If anything in this guide contradicts the current Anthropic docs, the Anthropic docs win.** Open a PR
to update this guide and note the change in the PR description.

---

## 1. Model assignment by job

We use three Claude models. The choice is locked per job and should not be changed in a single PR
without a separate ADR-style note explaining why.

| Job | Model | Effort | Rationale |
|---|---|---|---|
| Confirmation-question generation (Telegram bot PR 2) | `claude-opus-4-7` | `xhigh` | A bad question gets ignored on Hassan's phone Monday morning. Quality directly determines weekly content output. Anthropic explicitly recommends `xhigh` for "coding and agentic use cases" (which this is — corpus-grounded generation with strict schema). |
| Open-ended follow-up question generation (Telegram bot PR 3) | `claude-opus-4-7` | `xhigh` | Same rationale — must reference a specific SERP gap and ground in evidence. |
| Pillar classification (Synthesis worker) | `claude-haiku-4-5-20251001` | default (`high`) | Three-way classification (`quickbooks` / `managed-it` / `cybersecurity` / off-pillar). Cost matters; Haiku is sufficient. |
| Cluster labelling (Synthesis worker) | `claude-sonnet-4-6` | default (`high`) | Currently uses Sonnet. Migration to Opus 4.7 is possible but not justified by signal quality alone — Sonnet labels are good enough. Re-evaluate if cluster quality drops. |
| Telegram closing summary (Telegram bot PR 3) | `claude-haiku-4-5-20251001` | default (`high`) | Simple paraphrase of session state — Haiku is appropriate. |
| PII redaction (lib/redaction) | `claude-haiku-4-5-20251001` | default (`high`) | High-volume, cost-sensitive, narrow task. |
| Quality gate (gate-worker, future) | `claude-opus-4-7` | `xhigh` | E-E-A-T evaluation is intelligence-sensitive. Use `xhigh` minimum. |

**Why not Mythos Preview?** Adaptive thinking is on by default and there is no `xhigh` level available on
that model. Stick with Opus 4.7 for the highest-quality jobs.

**Why not Opus 4.6?** Opus 4.7 is GA, has the same 1M-token context window at standard pricing, supports the
new `xhigh` effort level, and Anthropic's own migration guide tells us to migrate ([Migration
guide](https://platform.claude.com/docs/en/about-claude/models/migration-guide)).

---

## 2. Required SDK version

All artifacts use `@anthropic-ai/sdk` pinned at `^0.28.0`. This version is confirmed working with the
features below (verified against `lib/redaction/package.json` which already ships this pin).

Before bumping the SDK version: read the SDK changelog for breaking changes in the `messages.create`
signature, the `thinking` parameter shape, and `output_config`. Then update this section.

---

## 3. The minimum correct Opus 4.7 call shape

This is the canonical pattern for any new Opus 4.7 integration. **Copy this verbatim** as a starting point,
then adapt the schema, system prompt, and user content.

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: env.anthropicApiKey });

const response = await client.messages.create({
  model: 'claude-opus-4-7',
  max_tokens: 4096,

  // REQUIRED to turn thinking on. Adaptive thinking is OFF by default on Opus 4.7.
  thinking: { type: 'adaptive' },

  // Effort level. xhigh = extra-high reasoning, recommended for quality-sensitive work.
  // Available levels: 'low' | 'medium' | 'high' | 'xhigh' | 'max'.
  // 'xhigh' is Opus-4.7-only. Anthropic recommends starting here for agentic / coding work.
  output_config: {
    effort: 'xhigh',
    // OPTIONAL: structured output. See section 5.
    // format: { type: 'json_schema', schema: { ... } },
  },

  system: [
    {
      type: 'text',
      text: 'You are <role definition>. <Behaviour rules>.',
      // OPTIONAL: prompt caching. See section 6.
      // cache_control: { type: 'ephemeral' },
    },
  ],

  messages: [
    {
      role: 'user',
      content: '<user message>',
    },
  ],
});

// Always check stop_reason — see section 7.
if (response.stop_reason !== 'end_turn') {
  // Treat 'max_tokens' and 'model_context_window_exceeded' as failures.
}

// Extract text content. Opus 4.7 omits thinking content by default
// (see section 4) — first text block is the answer.
const textBlock = response.content.find((b) => b.type === 'text');
if (!textBlock || textBlock.type !== 'text') {
  throw new Error('Opus 4.7 returned no text block');
}
const answer = textBlock.text;
```

Source for each requirement:
- Model ID: [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview)
- Adaptive thinking is off by default on Opus 4.7: [Migration guide §1](https://platform.claude.com/docs/en/about-claude/models/migration-guide)
- Effort levels and `xhigh`: [Effort docs](https://platform.claude.com/docs/en/build-with-claude/effort), [Adaptive thinking](https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking)

---

## 4. The five footguns — DO / DO NOT

These are the patterns most likely to be copied from older Claude code and fail on Opus 4.7.

### Footgun 1: Manual extended thinking returns 400

**DO NOT** use `thinking: { type: 'enabled', budget_tokens: N }` on Opus 4.7. **The API returns a 400 error.**

```typescript
// ❌ WRONG — 400 error on Opus 4.7
await client.messages.create({
  model: 'claude-opus-4-7',
  thinking: { type: 'enabled', budget_tokens: 10000 },
  // ...
});

// ✅ RIGHT — use adaptive thinking with effort
await client.messages.create({
  model: 'claude-opus-4-7',
  thinking: { type: 'adaptive' },
  output_config: { effort: 'xhigh' },
  // ...
});
```

Source: [Migration guide §1](https://platform.claude.com/docs/en/about-claude/models/migration-guide),
[What's new in Opus 4.7](https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-7)

### Footgun 2: Assistant prefilling returns 400

**DO NOT** prefill the assistant's response on Opus 4.7. The "prefilled-`{` JSON trick" used by
`lib/redaction/haiku-scrub.ts` and `artifacts/synthesis-worker/src/jobs/synthesize-weekly/label-cluster.ts`
**will return a 400 error on Opus 4.7.**

```typescript
// ❌ WRONG — 400 error on Opus 4.7
await client.messages.create({
  model: 'claude-opus-4-7',
  messages: [
    { role: 'user', content: 'Return JSON: {"x": 1}' },
    { role: 'assistant', content: '{' }, // <-- prefill, not supported
  ],
});

// ✅ RIGHT — use structured outputs (section 5)
await client.messages.create({
  model: 'claude-opus-4-7',
  output_config: {
    format: {
      type: 'json_schema',
      schema: { type: 'object', properties: { x: { type: 'integer' } }, required: ['x'], additionalProperties: false },
    },
  },
  messages: [{ role: 'user', content: 'Return JSON with x=1' }],
});
```

Source: [Working with messages](https://platform.claude.com/docs/en/build-with-claude/working-with-messages)

### Footgun 3: `effort` belongs inside `output_config`, not at the top level

```typescript
// ❌ WRONG — TypeScript / runtime error
await client.messages.create({
  model: 'claude-opus-4-7',
  effort: 'xhigh', // <-- not a top-level param
});

// ✅ RIGHT
await client.messages.create({
  model: 'claude-opus-4-7',
  output_config: { effort: 'xhigh' },
});
```

Source: [Effort docs](https://platform.claude.com/docs/en/build-with-claude/effort), [Migration guide
§5](https://platform.claude.com/docs/en/about-claude/models/migration-guide)

### Footgun 4: Thinking content is omitted by default on Opus 4.7

By default Opus 4.7 omits thinking content from the response (`display: 'omitted'`) — you only get the
final text block. On older Claude 4 models, thinking is `'summarized'` by default. If you need to see
thinking summaries (e.g., for logging or debugging), set `display` explicitly:

```typescript
// Get summarized thinking back in response.content blocks
await client.messages.create({
  model: 'claude-opus-4-7',
  thinking: { type: 'adaptive', display: 'summarized' },
  output_config: { effort: 'xhigh' },
  // ...
});
```

For production workloads we generally do **not** need thinking content (the final text is what we
parse). Leave it omitted unless there is a specific reason. Source: [Extended thinking — model
differences](https://docs.claude.com/en/docs/build-with-claude/extended-thinking).

### Footgun 5: Don't add legacy beta headers

Several headers used in older Claude 4 code are either deprecated or now no-ops:

| Header | Status on Opus 4.7 | Action |
|---|---|---|
| `effort-2025-11-24` | Now GA, header is no-op | Remove |
| `interleaved-thinking-2025-05-14` | Auto-enabled by adaptive thinking | Remove |
| `fine-grained-tool-streaming-2025-05-14` | Now GA | Remove |
| `token-efficient-tools-2025-02-19` | Built-in on all Claude 4+ | Remove |
| `output-128k-2025-02-19` | Built-in | Remove |
| `structured-outputs-2025-11-13` | Now GA, no header needed | Remove |
| `context-1m-2025-08-07` | **Not needed for Opus 4.7** (1M is standard); still required for Sonnet 4.6 / Opus 4.6 | Remove for Opus 4.7 only |

Source: [Migration guide §6 / Recommended changes](https://platform.claude.com/docs/en/about-claude/models/migration-guide)

---

## 5. Structured outputs — replacing the prefilled-`{` trick

Structured outputs are GA on Opus 4.7, Opus 4.6, Sonnet 4.6, Sonnet 4.5, Opus 4.5, Haiku 4.5, and
Mythos Preview. They are grammar-constrained: the API guarantees the returned text is valid JSON
matching your schema. This **replaces** the prefilled-`{` trick and is more reliable.

### Pattern

```typescript
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// 1. Define the shape with Zod.
const ConfirmationQuestionSchema = z.object({
  question_text: z.string().min(1).max(400),
  signal_id: z.string().uuid(),
  evidence_quote: z.string().min(1).max(500),
});

// 2. Convert to JSON Schema (Anthropic accepts standard JSON Schema 2020-12 subset).
const jsonSchema = zodToJsonSchema(ConfirmationQuestionSchema, {
  $refStrategy: 'none', // Anthropic doesn't follow $ref
});

// 3. Pass via output_config.format.
const response = await client.messages.create({
  model: 'claude-opus-4-7',
  max_tokens: 1024,
  thinking: { type: 'adaptive' },
  output_config: {
    effort: 'xhigh',
    format: {
      type: 'json_schema',
      schema: jsonSchema,
    },
  },
  system: [{ type: 'text', text: '<role>' }],
  messages: [{ role: 'user', content: '<input>' }],
});

// 4. Parse — guaranteed to be valid JSON matching the schema.
const textBlock = response.content.find((b) => b.type === 'text');
if (!textBlock || textBlock.type !== 'text') {
  throw new Error('No text block returned');
}
const parsed = ConfirmationQuestionSchema.parse(JSON.parse(textBlock.text));
```

### Schema limitations to respect

Anthropic's structured outputs support a **subset** of JSON Schema. The following are **not** directly
supported and will either be ignored or produce schema-compilation errors:

- `minimum`, `maximum`, `minLength`, `maxLength`, `pattern` — these constraints are not enforced by the
  grammar. Encode constraints in the `description` field instead (e.g., `"description": "Must be at most
  80 words"`). Always validate the parsed output against the original Zod schema afterwards.
- `oneOf`, `anyOf`, `allOf` — limited support. Prefer `enum` and discriminated unions over arbitrary
  composition.
- `$ref` — Anthropic does not follow internal refs. Use `zodToJsonSchema(..., { $refStrategy: 'none' })`
  to inline.
- All objects must declare `additionalProperties: false`.
- All required fields must be in `required: []`.

Source: [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)

---

## 6. Prompt caching pattern

Use `cache_control: { type: 'ephemeral' }` on system prompts and large user-content blocks that repeat
across calls. The default cache TTL is 5 minutes; this is enough for any "loop over N items with the
same system prompt" pattern.

### When to cache

- **The system prompt.** Always cache it if the same prompt is used across multiple calls.
- **A repeated user-content block.** Example: the cluster context (all signals from one cluster) when
  generating 3-5 questions sequentially for that cluster. Cache it once on the first call; subsequent
  calls hit the cache.

### Pattern

```typescript
// Build a reusable cluster context block (large, expensive to retransmit each call).
const clusterContextBlock = {
  type: 'text',
  text: `<all signals from the cluster, formatted>`,
  cache_control: { type: 'ephemeral' as const },
};

// First call — pays full cost for the system prompt + cluster context.
const r1 = await client.messages.create({
  model: 'claude-opus-4-7',
  thinking: { type: 'adaptive' },
  output_config: { effort: 'xhigh' },
  system: [
    {
      type: 'text',
      text: '<system prompt>',
      cache_control: { type: 'ephemeral' },
    },
  ],
  messages: [
    {
      role: 'user',
      content: [
        clusterContextBlock,
        { type: 'text', text: 'Question 1: <specific instruction>' },
      ],
    },
  ],
  // ...
});

// Second call within 5 min — cache hit on system prompt + cluster context.
// Only the per-question instruction is billed as fresh input.
const r2 = await client.messages.create({
  // ... same system + clusterContextBlock ...
  messages: [
    {
      role: 'user',
      content: [
        clusterContextBlock,
        { type: 'text', text: 'Question 2: <different instruction>' },
      ],
    },
  ],
});
```

### Cost impact

Cache hits are billed at **10% of normal input token cost** for the cached portion. For our typical
"3-5 questions per cluster, same cluster context each time" pattern, this cuts the per-cluster cost by
roughly 60-80% (the first call pays full price; subsequent calls pay 10% on the cached portion). The
1-hour cache variant is available but unnecessary for our weekly cron pattern.

Source: [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)

---

## 7. Stop reason handling

Every Claude response carries a `stop_reason`. Treat as follows:

| `stop_reason` | Meaning | Treat as |
|---|---|---|
| `end_turn` | Natural completion. | Success. |
| `max_tokens` | Hit the `max_tokens` limit before finishing. | **Failure.** Retry with a larger budget, or return a structured failure to the caller. |
| `stop_sequence` | Hit a custom stop sequence. | Depends on context. We do not currently use `stop_sequences`; if this appears, treat as failure and investigate. |
| `tool_use` | Claude wants to call a tool. | Tool-use loop — only relevant when we explicitly enable tools (we currently do not in any artifact). |
| `pause_turn` | Long-running server-side tool paused. | Resume via the Inngest `pause` pattern, or treat as failure if not expected. |
| `refusal` | Claude refused to answer. | **Failure.** Log and surface to the caller; do not retry the same prompt. |
| `model_context_window_exceeded` | Generation exceeded the context window mid-stream (Claude 4.5+ only). | **Failure.** Reduce input context or split the work. |

### Pattern

```typescript
const r = await client.messages.create({ /* ... */ });

switch (r.stop_reason) {
  case 'end_turn':
    return extractText(r);
  case 'refusal':
    logger.error({ source, action: 'claude_refusal', refusal: r.refusal_message }, 'Claude refused');
    throw new ClaudeRefusalError(r.refusal_message ?? 'unknown');
  case 'max_tokens':
  case 'model_context_window_exceeded':
    logger.error({ source, action: 'claude_truncated', stop_reason: r.stop_reason }, 'Claude output truncated');
    throw new ClaudeTruncatedError(r.stop_reason);
  default:
    logger.error({ source, action: 'claude_unexpected_stop', stop_reason: r.stop_reason }, 'unexpected stop_reason');
    throw new Error(`Unexpected stop_reason: ${r.stop_reason}`);
}
```

Source: [Handling stop reasons](https://docs.claude.com/en/docs/build-with-claude/extended-thinking)

---

## 8. Feature deferral list

These features are explicitly **not** in scope for current Claude integrations. Listed here so future
Cursor prompts can reference this section and skip them with confidence.

### Permanently out of scope

| Feature | Why we don't use it |
|---|---|
| Vision (image input) | The bot interacts via Telegram with text + voice + buttons only. PRD §9 explicitly out-of-scopes images. |
| Web search / Web fetch (server-side tools) | Against the journalist-mode design — we want grounding from Hassan's own corpus, not the internet. Would dilute confirmation-first interview shape. |
| Bash / Computer use / Text editor (server-side tools) | Not applicable — we don't ask Claude to operate a computer for this pipeline. |
| Batch processing | We run interactive crons; batch's async ≤24h SLO is wrong for the workload. |
| Files API | We pass strings from the DB. Files API is for binary/large reusable assets we don't have. |
| Streaming messages (SSE) | Telegram messages are sent as complete units; no streaming consumer. |
| Multilingual support | Hassan operates in English. PRD §9 out-of-scopes multi-language. |
| Code execution | Quality-gate validation runs in our TypeScript, not in Claude's sandbox. |
| Advisor tool (executor + advisor pair) | Designed for long-horizon agentic loops. Our per-question generations are bounded. Re-evaluate if Telegram bot grows into a true multi-step agent. |

### Deferred to later PRs / epics

| Feature | When to introduce |
|---|---|
| Memory tool | **Telegram bot PR 3** — useful for the closing-summary Haiku and the `/skip` / `/delete_signal` commands where Hassan's preferences accumulate across weeks. The `/memories` directory backend would be a new Supabase table. **Not in PR 2** because we have no accumulated preferences on day one. |
| Citations | **F3 SEOwind drafting (future epic)** — drafts must cite corpus chunks. Not relevant to question generation. |
| Strict tool use | When/if any artifact uses tools. We currently do not. |
| MCP connector / Programmatic tool calling / Tool search / Fine-grained tool streaming | Same — no tool use in scope today. |
| Compaction / Context editing | Our sessions are short. Re-evaluate if any artifact starts holding multi-hour conversations. |
| Task budgets (`task-budgets-2026-03-13` beta) | When Telegram bot becomes a true agentic loop in v2.x. Useful for "Hassan has 10 minutes; finish gracefully." |

---

## 9. Where to add new Claude calls

When introducing a new Claude integration in a future PR:

1. **Read sections 3–7 of this guide first.**
2. Define which job it is (section 1's table). If it doesn't fit any existing row, add a row.
3. Copy the canonical call shape from section 3.
4. Decide if you need structured outputs (section 5) — yes if the response shape is bounded; no if it's
   prose for human consumption.
5. Decide if you need prompt caching (section 6) — yes if the same system or context block is reused
   across multiple calls in the same minute.
6. Add stop-reason handling (section 7) for every call site.
7. Add the call to the integration test suite using the **DI-injected `AnthropicLike`** pattern
   established in `artifacts/synthesis-worker/src/jobs/synthesize-weekly/` — never call the real API
   in tests.

---

## 10. Migration notes

### From Sonnet 4.6 to Opus 4.7 (per call site)

When migrating an existing Sonnet 4.6 call to Opus 4.7:

1. Change `model` to `claude-opus-4-7`.
2. Add `thinking: { type: 'adaptive' }` — without this, Opus 4.7 does not think.
3. Add `output_config: { effort: 'xhigh' }` — choose `xhigh` for quality-sensitive jobs, `high` for cost-sensitive.
4. **Remove** any `thinking: { type: 'enabled', budget_tokens: N }` — returns 400 on Opus 4.7.
5. **Remove** any assistant-message prefill — returns 400 on Opus 4.7. Replace with structured outputs (section 5).
6. **Remove** the `context-1m-2025-08-07` beta header — 1M is standard on Opus 4.7.
7. **Remove** the `interleaved-thinking-2025-05-14` header if present — auto-enabled by adaptive thinking.
8. Update the call's tests: the `AnthropicLike` mock used in DI tests doesn't need changes (the shape of
   the call surface stays the same), but assertions about `thinking` / `effort` may need updating.

Source: [Migration guide](https://platform.claude.com/docs/en/about-claude/models/migration-guide)

---

## 11. Useful Anthropic documentation links

| Topic | URL |
|---|---|
| Models overview | https://platform.claude.com/docs/en/about-claude/models/overview |
| Opus 4.7 announcement / what's new | https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-7 |
| Migration guide (to Opus 4.7) | https://platform.claude.com/docs/en/about-claude/models/migration-guide |
| Adaptive thinking | https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking |
| Effort parameter | https://platform.claude.com/docs/en/build-with-claude/effort |
| Extended thinking (incl. stop-reason handling) | https://docs.claude.com/en/docs/build-with-claude/extended-thinking |
| Structured outputs | https://platform.claude.com/docs/en/build-with-claude/structured-outputs |
| Prompt caching | https://platform.claude.com/docs/en/build-with-claude/prompt-caching |
| Working with messages (incl. prefill restrictions) | https://platform.claude.com/docs/en/build-with-claude/working-with-messages |
| Features overview (catalog) | https://platform.claude.com/docs/en/build-with-claude/overview |
| Memory tool | https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool |
| Messages API reference | https://platform.claude.com/docs/en/api/messages/create |

---

## 12. Change log

| Date | Change | Author |
|---|---|---|
| 2026-05-24 | Initial version — establishes Opus 4.7 patterns, footgun list, structured outputs migration. | Computer (PR for Hassan) |
