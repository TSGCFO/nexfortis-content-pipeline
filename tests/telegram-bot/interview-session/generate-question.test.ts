/**
 * Tests for `generateQuestion` — the Claude Opus 4.7 caller.
 *
 * Mocks the Anthropic client entirely; verifies the call shape exactly
 * matches the integration guide (`docs/ways-of-work/anthropic-claude-integration-guide.md`):
 *
 *   - model: 'claude-opus-4-7'
 *   - thinking: { type: 'adaptive' }
 *   - output_config.effort: 'xhigh'
 *   - output_config.format.type: 'json_schema'
 *   - system block + cluster context block carry cache_control: { type: 'ephemeral' }
 *   - stop_reason inspected (every non-end_turn → api_error)
 *
 * Also asserts that forbidden patterns from older Sonnet code are NOT
 * present (footgun regression guard).
 */

import { describe, expect, it, vi } from 'vitest';

import {
  generateQuestion,
  type AnthropicCreateParams,
  type AnthropicResponse,
  type OpusAnthropicLike,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/generate-question.js';
import type {
  CandidateForInterview,
  SignalForInterview,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/types.js';
import type { Logger } from '@ncp/logger';

function makeLogger(): Logger {
  return {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  };
}

function makeAnthropic(
  responses: AnthropicResponse[] | ((p: AnthropicCreateParams) => AnthropicResponse),
): { client: OpusAnthropicLike; create: ReturnType<typeof vi.fn> } {
  let i = 0;
  const create = vi.fn(async (params: AnthropicCreateParams) => {
    if (typeof responses === 'function') return responses(params);
    const r = responses[Math.min(i, responses.length - 1)]!;
    i += 1;
    return r;
  });
  return { client: { messages: { create } }, create };
}

function makeSignal(): SignalForInterview {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    source: 'claude_cowork',
    capturedAt: new Date('2026-05-12T18:48:00Z'),
    redactedText: 'Hassan worked through AADSTS50158 with Claude for 40 minutes.',
    tokenCount: 5000,
    isDeleted: false,
  };
}

function makeCandidate(): CandidateForInterview {
  return {
    id: '00000000-0000-0000-0000-0000000000aa',
    pillar: 'managed-it',
    proposedTitle: 'iOS Authenticator and Conditional Access',
    primaryKeyword: 'intune',
    evidenceChunkIds: ['00000000-0000-0000-0000-000000000001'],
  };
}

function makeValidResponse(): AnthropicResponse {
  return {
    stop_reason: 'end_turn',
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          question_text: 'Did AADSTS50158 actually block iOS auth?',
          signal_id: '00000000-0000-0000-0000-000000000001',
          evidence_phrase: 'AADSTS50158',
          detected_specifics: ['AADSTS50158'],
          no_specifics: false,
        }),
      },
    ],
  };
}

describe('generateQuestion', () => {
  it('happy path: returns { ok: true, question } with parsed fields', async () => {
    const { client } = makeAnthropic([makeValidResponse()]);
    const result = await generateQuestion({
      signal: makeSignal(),
      candidate: makeCandidate(),
      anthropic: client,
      logger: makeLogger(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.question.questionText).toBe(
        'Did AADSTS50158 actually block iOS auth?',
      );
      expect(result.question.detectedSpecifics).toEqual(['AADSTS50158']);
    }
  });

  it('returns { ok: false, reason: "no_specifics" } when Claude declines', async () => {
    const { client } = makeAnthropic([
      {
        stop_reason: 'end_turn',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              question_text: 'no specifics available',
              signal_id: '00000000-0000-0000-0000-000000000001',
              evidence_phrase: 'n/a',
              detected_specifics: [],
              no_specifics: true,
            }),
          },
        ],
      },
    ]);
    const result = await generateQuestion({
      signal: makeSignal(),
      candidate: makeCandidate(),
      anthropic: client,
      logger: makeLogger(),
    });
    expect(result).toEqual({ ok: false, reason: 'no_specifics' });
  });

  it('stop_reason "end_turn" succeeds', async () => {
    const { client } = makeAnthropic([makeValidResponse()]);
    const result = await generateQuestion({
      signal: makeSignal(),
      candidate: makeCandidate(),
      anthropic: client,
      logger: makeLogger(),
    });
    expect(result.ok).toBe(true);
  });

  it('stop_reason "max_tokens" → api_error with detail="truncated"', async () => {
    const { client } = makeAnthropic([
      { stop_reason: 'max_tokens', content: [{ type: 'text', text: '{}' }] },
    ]);
    const result = await generateQuestion({
      signal: makeSignal(),
      candidate: makeCandidate(),
      anthropic: client,
      logger: makeLogger(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === 'api_error') {
      expect(result.detail).toBe('truncated');
    } else {
      throw new Error('expected api_error');
    }
  });

  it('stop_reason "refusal" → api_error with detail containing the refusal message', async () => {
    const { client } = makeAnthropic([
      {
        stop_reason: 'refusal',
        refusal_message: 'I cannot help with that',
        content: [],
      },
    ]);
    const result = await generateQuestion({
      signal: makeSignal(),
      candidate: makeCandidate(),
      anthropic: client,
      logger: makeLogger(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === 'api_error') {
      expect(result.detail).toMatch(/refusal: I cannot help with that/);
    } else {
      throw new Error('expected api_error');
    }
  });

  it('stop_reason "model_context_window_exceeded" → api_error', async () => {
    const { client } = makeAnthropic([
      {
        stop_reason: 'model_context_window_exceeded',
        content: [{ type: 'text', text: '{}' }],
      },
    ]);
    const result = await generateQuestion({
      signal: makeSignal(),
      candidate: makeCandidate(),
      anthropic: client,
      logger: makeLogger(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('api_error');
  });

  it('network throw → api_error (does NOT throw)', async () => {
    const create = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    const client: OpusAnthropicLike = { messages: { create } };
    const result = await generateQuestion({
      signal: makeSignal(),
      candidate: makeCandidate(),
      anthropic: client,
      logger: makeLogger(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('api_error');
      if (result.reason === 'api_error') expect(result.detail).toMatch(/ECONNRESET/);
    }
  });

  it('schema-invalid response → api_error (Zod parse failure)', async () => {
    const { client } = makeAnthropic([
      {
        stop_reason: 'end_turn',
        content: [
          {
            type: 'text',
            text: JSON.stringify({ wrong: 'shape' }),
          },
        ],
      },
    ]);
    const result = await generateQuestion({
      signal: makeSignal(),
      candidate: makeCandidate(),
      anthropic: client,
      logger: makeLogger(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === 'api_error') {
      expect(result.detail).toMatch(/schema_invalid/);
    } else {
      throw new Error('expected api_error/schema_invalid');
    }
  });

  it('call structure: model + thinking + output_config + cache_control are all correct', async () => {
    const { client, create } = makeAnthropic([makeValidResponse()]);
    await generateQuestion({
      signal: makeSignal(),
      candidate: makeCandidate(),
      anthropic: client,
      logger: makeLogger(),
    });
    expect(create).toHaveBeenCalledTimes(1);
    const params = create.mock.calls[0]![0] as AnthropicCreateParams;
    expect(params.model).toBe('claude-opus-4-7');
    expect(params.thinking).toEqual({ type: 'adaptive' });
    expect(params.output_config.effort).toBe('xhigh');
    expect(params.output_config.format?.type).toBe('json_schema');
    expect(params.output_config.format?.schema).toBeDefined();
    expect(params.system[0]?.cache_control).toEqual({ type: 'ephemeral' });
    // The cluster context block is the first content block of the user message.
    const userContent = params.messages[0]?.content;
    expect(Array.isArray(userContent)).toBe(true);
    if (Array.isArray(userContent)) {
      const firstBlock = userContent[0] as { cache_control?: unknown };
      expect(firstBlock?.cache_control).toEqual({ type: 'ephemeral' });
    }
  });

  it('call does NOT include forbidden patterns (regression guard for Sonnet copy-paste)', async () => {
    const { client, create } = makeAnthropic([makeValidResponse()]);
    await generateQuestion({
      signal: makeSignal(),
      candidate: makeCandidate(),
      anthropic: client,
      logger: makeLogger(),
    });
    const params = create.mock.calls[0]![0] as AnthropicCreateParams;
    // Footgun 1: NO budget_tokens / NO 'enabled' thinking type
    expect(params.thinking.type).not.toBe('enabled');
    expect(params.thinking.budget_tokens).toBeUndefined();
    // Footgun 2: NO assistant prefilling in messages
    const assistantMessages = params.messages.filter((m) => m.role === 'assistant');
    expect(assistantMessages).toHaveLength(0);
    // Footgun 3: effort is NOT at the top level
    expect((params as unknown as { effort?: unknown }).effort).toBeUndefined();
  });

  it('regenerate: when retryReason is set, includes the failure hint in the user prompt', async () => {
    const { client, create } = makeAnthropic([makeValidResponse()]);
    await generateQuestion({
      signal: makeSignal(),
      candidate: makeCandidate(),
      anthropic: client,
      logger: makeLogger(),
      retryReason: ['word_count', 'generic_phrase'],
    });
    const params = create.mock.calls[0]![0] as AnthropicCreateParams;
    const userContent = params.messages[0]?.content;
    if (Array.isArray(userContent)) {
      const last = userContent[userContent.length - 1] as { text?: string };
      expect(last.text).toMatch(/Previous attempt failed quality gate/);
      expect(last.text).toMatch(/word_count/);
    } else {
      throw new Error('expected array user content');
    }
  });
});
