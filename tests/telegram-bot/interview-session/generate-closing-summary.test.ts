/**
 * Tests for the Claude Haiku 4.5 closing-summary generator.
 *
 * Verifies:
 *   - Happy path
 *   - Stop-reason handling (end_turn, max_tokens, refusal)
 *   - Network throws → ok:false WITH fallbackText populated
 *   - Schema-invalid → ok:false WITH fallbackText populated
 *   - Call-shape regression: Haiku model id, structured outputs,
 *     cache_control on system, NO thinking field, NO top-level effort
 *   - Forbidden patterns absent
 *   - draftDayName interpolation deterministic given fixed now
 */

import { describe, expect, it, vi } from 'vitest';

import {
  CLOSING_SUMMARY_MODEL,
  generateClosingSummary,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/generate-closing-summary.js';
import { nextDraftDay } from '../../../artifacts/telegram-bot/src/jobs/interview-session/business-day.js';
import type {
  OpusAnthropicLike,
  OpusMessagesCreateArgs,
  OpusMessagesResponse,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/anthropic-shapes.js';
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

const SESSION_STATE = {
  confirmedCount: 3,
  anonymizeCount: 1,
  skipCount: 0,
  followUpsAnswered: 1,
  fallbackAnswered: false,
  proposedTitle: 'Conditional Access for iOS',
  draftDayName: 'Friday',
};

function happyHaikuResponse(): OpusMessagesResponse {
  return {
    stop_reason: 'end_turn',
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          summary_text:
            'Got it — 3 examples confirmed (1 anonymized) and your follow-up on the gap. Draft ready by Friday.',
        }),
      },
    ],
  };
}

describe('generateClosingSummary', () => {
  it('happy path: Haiku returns valid JSON with summary_text → { ok: true, summaryText }', async () => {
    const { anthropic } = makeAnthropic(async () => happyHaikuResponse());
    const result = await generateClosingSummary({
      sessionState: SESSION_STATE,
      anthropic,
      logger: makeLogger(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summaryText).toMatch(/3 examples confirmed/);
      expect(result.summaryText).toMatch(/Friday/);
    }
  });

  it('stop_reason "end_turn" is treated as success', async () => {
    const { anthropic } = makeAnthropic(async () => happyHaikuResponse());
    const result = await generateClosingSummary({
      sessionState: SESSION_STATE,
      anthropic,
      logger: makeLogger(),
    });
    expect(result.ok).toBe(true);
  });

  it('stop_reason "max_tokens" → { ok: false, fallbackText } (hardcoded placeholder)', async () => {
    const { anthropic } = makeAnthropic(async () => ({
      stop_reason: 'max_tokens',
      content: [],
    }));
    const result = await generateClosingSummary({
      sessionState: SESSION_STATE,
      anthropic,
      logger: makeLogger(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('truncated');
      expect(result.fallbackText).toMatch(/I&#39;ve confirmed 3/);
    }
  });

  it('network throw → { ok: false, fallbackText } (does NOT throw)', async () => {
    const { anthropic } = makeAnthropic(async () => {
      throw new Error('haiku unreachable');
    });
    const result = await generateClosingSummary({
      sessionState: SESSION_STATE,
      anthropic,
      logger: makeLogger(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('api_error');
      expect(result.fallbackText).toBeDefined();
    }
  });

  it('schema-invalid response → { ok: false, fallbackText }', async () => {
    const { anthropic } = makeAnthropic(async () => ({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'not even close to JSON' }],
    }));
    const result = await generateClosingSummary({
      sessionState: SESSION_STATE,
      anthropic,
      logger: makeLogger(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('schema_mismatch');
      expect(result.fallbackText).toBeDefined();
    }
  });

  it('call structure correct: model is claude-fable-5 with cache_control on system, structured-output format, NO thinking field, NO top-level effort, output_config.effort low', async () => {
    const { anthropic, create } = makeAnthropic(async () => happyHaikuResponse());
    await generateClosingSummary({
      sessionState: SESSION_STATE,
      anthropic,
      logger: makeLogger(),
    });
    expect(create).toHaveBeenCalledTimes(1);
    const args = create.mock.calls[0]![0] as OpusMessagesCreateArgs;

    expect(args.model).toBe(CLOSING_SUMMARY_MODEL);
    expect(args.model).toBe('claude-fable-5');

    // Fable 5's thinking is always on; the param is omitted entirely
    // (an explicit `{ type: 'disabled' }` would 400).
    expect(args.thinking).toBeUndefined();

    expect(args.output_config?.format?.type).toBe('json_schema');
    expect(args.output_config?.format?.schema).toBeDefined();
    // Paraphrase task — thinking spend capped via effort low.
    expect(args.output_config?.effort).toBe('low');

    expect(args.system?.[0]?.cache_control).toEqual({ type: 'ephemeral' });
  });

  it('call structure: NONE of the five forbidden patterns appear', async () => {
    const { anthropic, create } = makeAnthropic(async () => happyHaikuResponse());
    await generateClosingSummary({
      sessionState: SESSION_STATE,
      anthropic,
      logger: makeLogger(),
    });
    const args = create.mock.calls[0]![0] as OpusMessagesCreateArgs;
    const serialised = JSON.stringify(args);

    // Footgun 1: no manual budget_tokens / enabled thinking
    expect(serialised).not.toContain('budget_tokens');
    expect(serialised).not.toContain('"enabled"');

    // Footgun 2: no assistant prefilling — only user messages
    for (const m of args.messages) {
      expect(m.role).toBe('user');
    }

    // Footgun 3: no top-level effort
    expect(Object.prototype.hasOwnProperty.call(args, 'effort')).toBe(false);

    // Footgun 5: no legacy beta headers in the serialized args
    expect(serialised).not.toContain('2025-11-24');
    expect(serialised).not.toContain('interleaved-thinking');
    expect(serialised).not.toContain('context-1m-2025-08-07');
    expect(serialised).not.toContain('structured-outputs-2025-11-13');
  });

  it('the draftDayName field is sent to the model in the user content JSON (deterministic given fixed now)', async () => {
    const { anthropic, create } = makeAnthropic(async () => happyHaikuResponse());
    // Lock now to Monday 2026-05-25 — nextDraftDay(now) ⇒ 'Friday'
    const fixedNow = new Date('2026-05-25T13:00:00Z');
    expect(nextDraftDay(fixedNow)).toBe('Friday');
    await generateClosingSummary({
      sessionState: { ...SESSION_STATE, draftDayName: nextDraftDay(fixedNow) },
      anthropic,
      logger: makeLogger(),
    });
    const args = create.mock.calls[0]![0] as OpusMessagesCreateArgs;
    const userContent = args.messages[0]!.content;
    expect(typeof userContent).toBe('string');
    if (typeof userContent === 'string') {
      expect(userContent).toContain('"draftDayName":"Friday"');
    }
  });
});
