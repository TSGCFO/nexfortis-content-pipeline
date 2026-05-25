/**
 * Tests for the Claude Opus 4.7 confirmation-question generator.
 *
 * Verifies — beyond happy-path correctness:
 *   - Every required Opus pattern from the integration guide is present
 *     in the actual `messages.create` call (test #9).
 *   - None of the FIVE forbidden patterns (budget_tokens, enabled
 *     thinking, prefilled `{`, top-level effort, legacy beta headers)
 *     appear in any call we make (test #10).
 *   - Stop-reason handling for `end_turn`, `max_tokens`, `refusal`,
 *     `model_context_window_exceeded`.
 *   - Network throws and schema-invalid responses return
 *     `{ ok: false, reason: 'api_error' }` rather than throwing.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  OPUS_MODEL,
  SYSTEM_PROMPT,
  buildPerSignalInstruction,
  generateQuestion,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/generate-question.js';
import type {
  OpusAnthropicLike,
  OpusMessagesCreateArgs,
  OpusMessagesResponse,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/anthropic-shapes.js';
import type { SelectedSignal } from '../../../artifacts/telegram-bot/src/lib/select-signals-for-cluster.js';
import type { Logger } from '@ncp/logger';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const SIGNAL: SelectedSignal = {
  id: '11111111-1111-1111-1111-111111111111',
  capturedAt: new Date('2026-05-19T14:25:00Z'),
  redactedText:
    'Hassan worked through error AADSTS50158 while configuring Conditional Access for iOS Authenticator. The issue was MFA interrupt handling.',
  source: 'claude',
  tokenCount: 1200,
};

const CANDIDATE = {
  proposedTitle: 'Conditional Access for iOS',
  primaryKeyword: 'intune',
};

const CLUSTER_CONTEXT = 'CLUSTER_CONTEXT_BLOCK_PLACEHOLDER';

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
  impl: (args: OpusMessagesCreateArgs) => Promise<OpusMessagesResponse>,
): { anthropic: OpusAnthropicLike; create: ReturnType<typeof vi.fn> } {
  const create = vi.fn(impl);
  const anthropic: OpusAnthropicLike = {
    messages: {
      create: create as unknown as OpusAnthropicLike['messages']['create'],
    },
  };
  return { anthropic, create };
}

function happyResponse(): OpusMessagesResponse {
  return {
    stop_reason: 'end_turn',
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          question_text:
            'Last Tuesday around 2:25 PM UTC you worked through AADSTS50158 in Conditional Access. Confirm?',
          signal_id: SIGNAL.id,
          evidence_phrase: 'AADSTS50158 while configuring Conditional Access',
          detected_specifics: ['AADSTS50158', 'Conditional Access'],
          no_specifics: false,
        }),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateQuestion', () => {
  it('happy path: returns { ok: true, question } on valid end_turn response', async () => {
    const { anthropic } = makeAnthropic(async () => happyResponse());
    const result = await generateQuestion({
      signal: SIGNAL,
      candidate: CANDIDATE,
      anthropic,
      logger: makeLogger(),
      clusterContextBlock: CLUSTER_CONTEXT,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.question.question_text).toContain('AADSTS50158');
      expect(result.question.signal_id).toBe(SIGNAL.id);
    }
  });

  it('no_specifics in response: returns { ok: false, reason: "no_specifics" }', async () => {
    const { anthropic } = makeAnthropic(async () => ({
      stop_reason: 'end_turn',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            question_text: 'NO_SPECIFICS',
            signal_id: SIGNAL.id,
            evidence_phrase: 'n/a',
            detected_specifics: [],
            no_specifics: true,
          }),
        },
      ],
    }));
    const result = await generateQuestion({
      signal: SIGNAL,
      candidate: CANDIDATE,
      anthropic,
      logger: makeLogger(),
      clusterContextBlock: CLUSTER_CONTEXT,
    });
    expect(result).toEqual({ ok: false, reason: 'no_specifics' });
  });

  it('stop_reason "end_turn" is treated as success', async () => {
    const { anthropic } = makeAnthropic(async () => happyResponse());
    const result = await generateQuestion({
      signal: SIGNAL,
      candidate: CANDIDATE,
      anthropic,
      logger: makeLogger(),
      clusterContextBlock: CLUSTER_CONTEXT,
    });
    expect(result.ok).toBe(true);
  });

  it('stop_reason "max_tokens" returns { ok: false, reason: "api_error", detail: "truncated" }', async () => {
    const { anthropic } = makeAnthropic(async () => ({
      stop_reason: 'max_tokens',
      content: [],
    }));
    const result = await generateQuestion({
      signal: SIGNAL,
      candidate: CANDIDATE,
      anthropic,
      logger: makeLogger(),
      clusterContextBlock: CLUSTER_CONTEXT,
    });
    expect(result).toEqual({
      ok: false,
      reason: 'api_error',
      detail: 'truncated',
    });
  });

  it('stop_reason "refusal" returns { ok: false, reason: "api_error", detail starts with "refusal: " }', async () => {
    const { anthropic } = makeAnthropic(async () => ({
      stop_reason: 'refusal',
      content: [],
      refusal_message: 'I cannot help with that',
    }));
    const result = await generateQuestion({
      signal: SIGNAL,
      candidate: CANDIDATE,
      anthropic,
      logger: makeLogger(),
      clusterContextBlock: CLUSTER_CONTEXT,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('api_error');
      expect(result.detail).toBe('refusal: I cannot help with that');
    }
  });

  it('stop_reason "model_context_window_exceeded" returns api_error / truncated', async () => {
    const { anthropic } = makeAnthropic(async () => ({
      stop_reason: 'model_context_window_exceeded',
      content: [],
    }));
    const result = await generateQuestion({
      signal: SIGNAL,
      candidate: CANDIDATE,
      anthropic,
      logger: makeLogger(),
      clusterContextBlock: CLUSTER_CONTEXT,
    });
    expect(result).toEqual({
      ok: false,
      reason: 'api_error',
      detail: 'truncated',
    });
  });

  it('client throws: returns { ok: false, reason: "api_error" } (does NOT throw)', async () => {
    const { anthropic } = makeAnthropic(async () => {
      throw new Error('network unreachable');
    });
    const result = await generateQuestion({
      signal: SIGNAL,
      candidate: CANDIDATE,
      anthropic,
      logger: makeLogger(),
      clusterContextBlock: CLUSTER_CONTEXT,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('api_error');
      expect(result.detail).toMatch(/network unreachable/);
    }
  });

  it('schema-invalid response: returns { ok: false, reason: "api_error", detail: "schema_mismatch" }', async () => {
    const { anthropic } = makeAnthropic(async () => ({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'not even close to JSON' }],
    }));
    const result = await generateQuestion({
      signal: SIGNAL,
      candidate: CANDIDATE,
      anthropic,
      logger: makeLogger(),
      clusterContextBlock: CLUSTER_CONTEXT,
    });
    expect(result).toEqual({
      ok: false,
      reason: 'api_error',
      detail: 'schema_mismatch',
    });
  });

  it('call structure: model, thinking, output_config, cache_control on system + cluster context are all set correctly', async () => {
    const { anthropic, create } = makeAnthropic(async () => happyResponse());
    await generateQuestion({
      signal: SIGNAL,
      candidate: CANDIDATE,
      anthropic,
      logger: makeLogger(),
      clusterContextBlock: CLUSTER_CONTEXT,
    });
    expect(create).toHaveBeenCalledTimes(1);
    const args = create.mock.calls[0]![0] as OpusMessagesCreateArgs;

    // Model is exactly claude-opus-4-7
    expect(args.model).toBe(OPUS_MODEL);
    expect(args.model).toBe('claude-opus-4-7');

    // Adaptive thinking, not enabled-with-budget
    expect(args.thinking).toEqual({ type: 'adaptive' });

    // xhigh effort inside output_config (not at top level)
    expect(args.output_config?.effort).toBe('xhigh');

    // Structured-output format with json_schema
    expect(args.output_config?.format?.type).toBe('json_schema');
    expect(args.output_config?.format?.schema).toBeDefined();

    // System block has ephemeral cache_control
    expect(args.system?.[0]?.cache_control).toEqual({ type: 'ephemeral' });

    // Cluster context user-content block has ephemeral cache_control
    const userContent = args.messages[0]!.content;
    expect(Array.isArray(userContent)).toBe(true);
    if (Array.isArray(userContent)) {
      expect(userContent[0]).toMatchObject({
        type: 'text',
        text: CLUSTER_CONTEXT,
        cache_control: { type: 'ephemeral' },
      });
    }
  });

  it('call structure: NONE of the five forbidden Opus patterns appear', async () => {
    const { anthropic, create } = makeAnthropic(async () => happyResponse());
    await generateQuestion({
      signal: SIGNAL,
      candidate: CANDIDATE,
      anthropic,
      logger: makeLogger(),
      clusterContextBlock: CLUSTER_CONTEXT,
    });
    const args = create.mock.calls[0]![0] as OpusMessagesCreateArgs;
    const serialised = JSON.stringify(args);

    // Footgun 1: no manual extended-thinking budget_tokens
    expect(serialised).not.toContain('budget_tokens');
    expect(serialised).not.toContain('"enabled"');

    // Footgun 2: no assistant prefilling — only one user message, no
    // assistant role at all
    for (const m of args.messages) {
      expect(m.role).toBe('user');
    }

    // Footgun 3: no top-level effort field (must be inside output_config)
    expect(
      Object.prototype.hasOwnProperty.call(args, 'effort'),
    ).toBe(false);

    // Footgun 5: no legacy beta headers — we don't pass any custom
    // header surface at all (the SDK shape doesn't accept one on
    // `create()`); assert defensively that no header-shaped fields are
    // present.
    expect(serialised).not.toContain('2025-11-24');
    expect(serialised).not.toContain('interleaved-thinking');
    expect(serialised).not.toContain('context-1m-2025-08-07');
  });

  it('retryReason is appended to the per-signal instruction', async () => {
    const { anthropic, create } = makeAnthropic(async () => happyResponse());
    await generateQuestion({
      signal: SIGNAL,
      candidate: CANDIDATE,
      anthropic,
      logger: makeLogger(),
      clusterContextBlock: CLUSTER_CONTEXT,
      retryReason: 'word_count+generic_phrase',
    });
    const args = create.mock.calls[0]![0] as OpusMessagesCreateArgs;
    const userContent = args.messages[0]!.content;
    if (Array.isArray(userContent)) {
      const second = userContent[1]?.text ?? '';
      expect(second).toMatch(/Previous attempt failed the quality gate/);
      expect(second).toContain('word_count+generic_phrase');
    } else {
      throw new Error('user content was not an array');
    }
  });

  it('SYSTEM_PROMPT content matches snapshot (locks the engineered prompt against accidental edits)', () => {
    expect(SYSTEM_PROMPT).toMatchSnapshot();
  });

  it('returned question.signal_id is overridden to the input signal id (defence against schema-conforming-but-wrong responses)', async () => {
    const { anthropic } = makeAnthropic(async () => ({
      stop_reason: 'end_turn',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            question_text: 'q',
            signal_id: '00000000-0000-0000-0000-000000000000',
            evidence_phrase: 'p',
            detected_specifics: ['x'],
            no_specifics: false,
          }),
        },
      ],
    }));
    const result = await generateQuestion({
      signal: SIGNAL,
      candidate: CANDIDATE,
      anthropic,
      logger: makeLogger(),
      clusterContextBlock: CLUSTER_CONTEXT,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.question.signal_id).toBe(SIGNAL.id);
    }
  });
});

// ---------------------------------------------------------------------------
// buildPerSignalInstruction — pure function, snapshot-locked across the three
// shapes the orchestrator actually produces (first attempt, retry attempt,
// over-long redacted text that exercises the 500-char truncation).
// ---------------------------------------------------------------------------

describe('buildPerSignalInstruction', () => {
  const BASE_SIGNAL: SelectedSignal = {
    id: '22222222-2222-2222-2222-222222222222',
    capturedAt: new Date('2026-05-20T14:23:00Z'),
    redactedText:
      'Subject: Re: Conditional Access AADSTS50158 retry loop. From: <REDACTED:person>. Body: Confirmed — adding the device-compliance grant solved it. Took 40 min.',
    source: 'msgraph',
    tokenCount: 800,
  };

  const BASE_CANDIDATE = {
    proposedTitle: 'Conditional Access for iOS',
    primaryKeyword: 'Conditional Access for iOS Authenticator',
  };

  it('first-attempt shape (no retry reason)', () => {
    const out = buildPerSignalInstruction({
      signal: BASE_SIGNAL,
      candidate: BASE_CANDIDATE,
      anthropic: { messages: { create: async () => ({ stop_reason: null, content: [] }) } },
      logger: makeLogger(),
      clusterContextBlock: 'CTX',
    });
    expect(out).toMatchSnapshot();
    expect(out).toContain(`signal_id: ${BASE_SIGNAL.id}`);
    expect(out).toContain('captured_at: Wednesday at 2:23 PM UTC');
    expect(out).toContain(`primary_keyword: ${BASE_CANDIDATE.primaryKeyword}`);
    expect(out).not.toMatch(/Previous attempt failed the quality gate/);
  });

  it('retry-attempt shape (retryReason appended as trailing paragraph)', () => {
    const out = buildPerSignalInstruction({
      signal: BASE_SIGNAL,
      candidate: BASE_CANDIDATE,
      anthropic: { messages: { create: async () => ({ stop_reason: null, content: [] }) } },
      logger: makeLogger(),
      clusterContextBlock: 'CTX',
      retryReason: 'word_count+generic_phrase',
    });
    expect(out).toMatchSnapshot();
    expect(out).toMatch(/Previous attempt failed the quality gate/);
    expect(out).toContain('word_count+generic_phrase');
    expect(out).toContain('Anchor on a concrete detail');
  });

  it('long-redacted-text shape (truncates to first 500 chars)', () => {
    const long = 'A'.repeat(800) + 'TAIL_MARKER';
    const out = buildPerSignalInstruction({
      signal: { ...BASE_SIGNAL, redactedText: long },
      candidate: BASE_CANDIDATE,
      anthropic: { messages: { create: async () => ({ stop_reason: null, content: [] }) } },
      logger: makeLogger(),
      clusterContextBlock: 'CTX',
    });
    expect(out).toMatchSnapshot();
    expect(out).toContain('A'.repeat(500));
    expect(out).not.toContain('TAIL_MARKER');
  });
});
