/**
 * Tests for the Claude Opus 4.7 follow-up question generator.
 *
 * Verifies — beyond happy-path correctness:
 *   - Every required Opus pattern from the integration guide is present
 *     in the actual `messages.create` call (test #9).
 *   - None of the FIVE forbidden patterns appear in any call (test #10).
 *   - Stop-reason handling for end_turn, max_tokens, refusal,
 *     model_context_window_exceeded.
 *   - Network throws and schema-invalid responses → api_error (no throw).
 *   - Empty gap input → no_gaps without API call.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  FOLLOW_UP_MODEL,
  generateFollowUp,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/generate-follow-up.js';
import type {
  OpusAnthropicLike,
  OpusMessagesCreateArgs,
  OpusMessagesResponse,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/anthropic-shapes.js';
import type { ConfirmedSignalSummary } from '../../../artifacts/telegram-bot/src/jobs/interview-session/types.js';
import type { Logger } from '@ncp/logger';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const CONFIRMED_SIGNALS: ConfirmedSignalSummary[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    capturedAt: new Date('2026-05-19T14:25:00Z'),
    redactedText: 'AADSTS50158 Conditional Access loop fixed by device-compliance grant.',
    source: 'claude',
  },
];

const CANDIDATE = {
  proposedTitle: 'Conditional Access for iOS',
  primaryKeyword: 'intune',
};

const GAP = 'device-compliance policy ordering and grant evaluation';
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
          follow_up_text:
            'From your experience with that AADSTS50158 fix, when the device-compliance grant sits behind the MFA grant in the CA policy, what does the user actually see on their phone?',
          evidence_phrase: 'AADSTS50158 Conditional Access loop',
        }),
      },
    ],
  };
}

describe('generateFollowUp', () => {
  it('happy path: returns { ok: true, question } on valid end_turn response', async () => {
    const { anthropic } = makeAnthropic(async () => happyResponse());
    const result = await generateFollowUp({
      uncoveredGap: GAP,
      candidate: CANDIDATE,
      confirmedSignals: CONFIRMED_SIGNALS,
      anthropic,
      logger: makeLogger(),
      clusterContextBlock: CLUSTER_CONTEXT,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.question.follow_up_text).toMatch(/AADSTS50158/);
      expect(result.question.evidence_phrase).toMatch(/AADSTS50158/);
    }
  });

  it('stop_reason "end_turn" is treated as success', async () => {
    const { anthropic } = makeAnthropic(async () => happyResponse());
    const result = await generateFollowUp({
      uncoveredGap: GAP,
      candidate: CANDIDATE,
      confirmedSignals: CONFIRMED_SIGNALS,
      anthropic,
      logger: makeLogger(),
      clusterContextBlock: CLUSTER_CONTEXT,
    });
    expect(result.ok).toBe(true);
  });

  it('stop_reason "max_tokens" → { ok: false, reason: "api_error", detail: "truncated" }', async () => {
    const { anthropic } = makeAnthropic(async () => ({
      stop_reason: 'max_tokens',
      content: [],
    }));
    const result = await generateFollowUp({
      uncoveredGap: GAP,
      candidate: CANDIDATE,
      confirmedSignals: CONFIRMED_SIGNALS,
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

  it('stop_reason "refusal" → api_error with "refusal: <message>" detail', async () => {
    const { anthropic } = makeAnthropic(async () => ({
      stop_reason: 'refusal',
      content: [],
      refusal_message: 'I cannot help with that',
    }));
    const result = await generateFollowUp({
      uncoveredGap: GAP,
      candidate: CANDIDATE,
      confirmedSignals: CONFIRMED_SIGNALS,
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

  it('stop_reason "model_context_window_exceeded" → api_error / truncated', async () => {
    const { anthropic } = makeAnthropic(async () => ({
      stop_reason: 'model_context_window_exceeded',
      content: [],
    }));
    const result = await generateFollowUp({
      uncoveredGap: GAP,
      candidate: CANDIDATE,
      confirmedSignals: CONFIRMED_SIGNALS,
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

  it('client throws → api_error (does NOT throw)', async () => {
    const { anthropic } = makeAnthropic(async () => {
      throw new Error('network unreachable');
    });
    const result = await generateFollowUp({
      uncoveredGap: GAP,
      candidate: CANDIDATE,
      confirmedSignals: CONFIRMED_SIGNALS,
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

  it('schema-invalid response → api_error / schema_mismatch', async () => {
    const { anthropic } = makeAnthropic(async () => ({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'definitely not JSON' }],
    }));
    const result = await generateFollowUp({
      uncoveredGap: GAP,
      candidate: CANDIDATE,
      confirmedSignals: CONFIRMED_SIGNALS,
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

  it('empty uncoveredGap → { ok: false, reason: "no_gaps" } WITHOUT calling the API', async () => {
    const { anthropic, create } = makeAnthropic(async () => happyResponse());
    const result = await generateFollowUp({
      uncoveredGap: '',
      candidate: CANDIDATE,
      confirmedSignals: CONFIRMED_SIGNALS,
      anthropic,
      logger: makeLogger(),
      clusterContextBlock: CLUSTER_CONTEXT,
    });
    expect(result).toEqual({ ok: false, reason: 'no_gaps' });
    expect(create).toHaveBeenCalledTimes(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Anthropic call-shape regression — REQUIRED PATTERNS PRESENT
  // ─────────────────────────────────────────────────────────────────────────

  it('call structure: required Opus 4.7 patterns are present', async () => {
    const { anthropic, create } = makeAnthropic(async () => happyResponse());
    await generateFollowUp({
      uncoveredGap: GAP,
      candidate: CANDIDATE,
      confirmedSignals: CONFIRMED_SIGNALS,
      anthropic,
      logger: makeLogger(),
      clusterContextBlock: CLUSTER_CONTEXT,
    });
    expect(create).toHaveBeenCalledTimes(1);
    const args = create.mock.calls[0]![0] as OpusMessagesCreateArgs;

    expect(args.model).toBe(FOLLOW_UP_MODEL);
    expect(args.model).toBe('claude-fable-5');

    expect(args.thinking).toEqual({ type: 'adaptive' });

    expect(args.output_config?.effort).toBe('xhigh');

    expect(args.output_config?.format?.type).toBe('json_schema');
    expect(args.output_config?.format?.schema).toBeDefined();

    expect(args.system?.[0]?.cache_control).toEqual({ type: 'ephemeral' });

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

  // ─────────────────────────────────────────────────────────────────────────
  // Anthropic call-shape regression — FORBIDDEN PATTERNS ABSENT
  // ─────────────────────────────────────────────────────────────────────────

  it('call structure: NONE of the five forbidden Opus patterns appear', async () => {
    const { anthropic, create } = makeAnthropic(async () => happyResponse());
    await generateFollowUp({
      uncoveredGap: GAP,
      candidate: CANDIDATE,
      confirmedSignals: CONFIRMED_SIGNALS,
      anthropic,
      logger: makeLogger(),
      clusterContextBlock: CLUSTER_CONTEXT,
    });
    const args = create.mock.calls[0]![0] as OpusMessagesCreateArgs;
    const serialised = JSON.stringify(args);

    // Footgun 1: no manual extended-thinking budget_tokens
    expect(serialised).not.toContain('budget_tokens');
    expect(serialised).not.toContain('"enabled"');

    // Footgun 2: no assistant-prefilling — only user messages
    for (const m of args.messages) {
      expect(m.role).toBe('user');
    }

    // Footgun 3: no top-level effort
    expect(Object.prototype.hasOwnProperty.call(args, 'effort')).toBe(false);

    // Footgun 5: no legacy beta headers
    expect(serialised).not.toContain('2025-11-24');
    expect(serialised).not.toContain('interleaved-thinking');
    expect(serialised).not.toContain('context-1m-2025-08-07');
    expect(serialised).not.toContain('structured-outputs-2025-11-13');
  });
});
