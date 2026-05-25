/**
 * Structural assertions on the engineered `SYSTEM_PROMPT`.
 *
 * Prose-style snapshots are brittle — these tests instead assert the
 * STRUCTURAL elements every revision of the prompt must preserve:
 *
 *   - the chain-of-thought section ("How to think about each question")
 *   - the labelled `Shape` template
 *   - at least 3 positive worked examples
 *   - at least 2 negative worked anti-examples
 *   - a labelled `NO_SPECIFICS branch` subsection
 *   - voice calibration that names Hassan's actual tools
 *   - no banned phrases that drift the voice into corporate / chatbot tone
 *
 * If a future PR rewrites the prompt for genuine reasons, these tests
 * break loudly (rather than silently letting prompt quality regress).
 *
 * Also covers `buildPerSignalInstruction` structural invariants — the
 * function is now exported specifically so it can be tested here.
 */

import { describe, expect, it } from 'vitest';

import type { Logger } from '@ncp/logger';

import type { SelectedSignal } from '../../../artifacts/telegram-bot/src/lib/select-signals-for-cluster.js';
import type { OpusAnthropicLike } from '../../../artifacts/telegram-bot/src/jobs/interview-session/anthropic-shapes.js';
import {
  SYSTEM_PROMPT,
  buildPerSignalInstruction,
  type GenerateQuestionInput,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/generate-question.js';

// ─────────────────────────────────────────────────────────────────────────
// SYSTEM_PROMPT structural assertions
// ─────────────────────────────────────────────────────────────────────────

describe('SYSTEM_PROMPT — structure', () => {
  it('contains the labelled Role section', () => {
    expect(SYSTEM_PROMPT).toContain('# Role');
  });

  it('contains the labelled Voice section', () => {
    expect(SYSTEM_PROMPT).toContain('# Voice');
  });

  it('contains the labelled Goal section', () => {
    expect(SYSTEM_PROMPT).toContain('# Goal');
  });

  it('contains a chain-of-thought "how to think" section before writing', () => {
    expect(SYSTEM_PROMPT).toContain('# How to think about each question');
  });

  it('contains a Shape template section showing the target question form', () => {
    expect(SYSTEM_PROMPT).toContain('# Shape');
    expect(SYSTEM_PROMPT).toContain('Looks like last');
    expect(SYSTEM_PROMPT).toContain('Was that real client work');
  });

  it('contains a Positive examples section', () => {
    expect(SYSTEM_PROMPT).toContain('# Positive examples');
  });

  it('contains a Negative examples section', () => {
    expect(SYSTEM_PROMPT).toContain('# Negative examples');
  });

  it('contains a clearly labelled NO_SPECIFICS branch subsection', () => {
    expect(SYSTEM_PROMPT).toContain('# NO_SPECIFICS branch');
  });
});

describe('SYSTEM_PROMPT — positive examples', () => {
  it('contains at least 3 worked positive examples', () => {
    const matches = SYSTEM_PROMPT.match(/^## Example \d+/gm) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  it('positive examples cover three distinct signal types', () => {
    // The three example types we calibrated against: Microsoft Graph
    // email, Claude Co-Work session, Microsoft Teams chat.
    expect(SYSTEM_PROMPT).toContain('Microsoft Graph email');
    expect(SYSTEM_PROMPT).toContain('Co-Work session');
    expect(SYSTEM_PROMPT).toContain('Microsoft Teams chat');
  });

  it('every positive example includes a "WHY IT WORKS" rationale', () => {
    const exampleCount = (SYSTEM_PROMPT.match(/^## Example \d+/gm) ?? []).length;
    const whyItWorksCount = (SYSTEM_PROMPT.match(/^WHY IT WORKS:/gm) ?? [])
      .length;
    expect(whyItWorksCount).toBe(exampleCount);
  });

  it('positive examples reference concrete error codes / figures / mechanisms', () => {
    // Spot-check that the examples contain the kind of specifics we want
    // the model to learn to reach for. Not exhaustive — just regression
    // guards against examples drifting back to vague prose.
    expect(SYSTEM_PROMPT).toContain('AADSTS50158');
    expect(SYSTEM_PROMPT).toContain('$4,217.83');
    expect(SYSTEM_PROMPT).toContain('legacy basic auth');
  });
});

describe('SYSTEM_PROMPT — negative examples', () => {
  it('contains at least 2 worked anti-examples', () => {
    const matches = SYSTEM_PROMPT.match(/^## Anti-example \d+/gm) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('every anti-example includes a "WHY IT FAILS" rationale', () => {
    const antiCount = (SYSTEM_PROMPT.match(/^## Anti-example \d+/gm) ?? [])
      .length;
    const whyFailsCount = (SYSTEM_PROMPT.match(/^WHY IT FAILS:/gm) ?? [])
      .length;
    expect(whyFailsCount).toBe(antiCount);
  });

  it('anti-examples cover the generic-opener failure mode', () => {
    expect(SYSTEM_PROMPT).toContain('generic survey opener');
  });

  it('anti-examples cover the asking-for-new-information failure mode', () => {
    expect(SYSTEM_PROMPT).toContain('asking for new information');
  });
});

describe('SYSTEM_PROMPT — voice calibration', () => {
  it('names the tools Hassan actually uses', () => {
    expect(SYSTEM_PROMPT).toContain('Claude');
    expect(SYSTEM_PROMPT).toContain('Perplexity');
    expect(SYSTEM_PROMPT).toContain('Outlook');
    expect(SYSTEM_PROMPT).toContain('Microsoft Teams');
  });

  it('mentions the Monday morning Telegram phone delivery context', () => {
    expect(SYSTEM_PROMPT).toContain('Telegram');
    expect(SYSTEM_PROMPT).toContain('Monday morning');
    expect(SYSTEM_PROMPT).toContain('phone');
  });

  it('mentions the NexFortis Ontario IT consultant context', () => {
    expect(SYSTEM_PROMPT).toContain('NexFortis');
    expect(SYSTEM_PROMPT).toContain('Ontario');
    expect(SYSTEM_PROMPT).toContain('IT consultant');
  });
});

describe('SYSTEM_PROMPT — banned phrases (voice drift guards)', () => {
  it.each([
    ['please', /\bplease\b/i],
    ['kindly', /\bkindly\b/i],
    ['as an AI', /\bas an AI\b/i],
    ['as a language model', /\bas a language model\b/i],
    ['I hope this helps', /\bI hope this helps\b/i],
  ])('does not contain banned phrase: %s', (_name, pattern) => {
    expect(SYSTEM_PROMPT).not.toMatch(pattern);
  });

  it('does not reference the answer-choice buttons (those are added programmatically)', () => {
    // The original PRD §6.4 prompt told the model to end with "Yes / Anonymize
    // / Skip" \u2014 we deliberately removed that because the keyboard is rendered
    // programmatically. Regression guard so the next person who copies from
    // the PRD doesn't add it back.
    expect(SYSTEM_PROMPT).not.toMatch(/Yes,?\s+use\s+it.*Anonymize.*Skip/i);
  });

  it('does not mention the JSON schema or output_config (the format layer enforces these)', () => {
    expect(SYSTEM_PROMPT).not.toMatch(/JSON schema/i);
    expect(SYSTEM_PROMPT).not.toMatch(/output_config/i);
  });

  it('does not mention word count in the prose (the schema description carries this)', () => {
    // Word count is enforced in two other places — the schema description
    // and the post-generation quality gate. Stating it in the prose adds
    // noise and risks the model truncating mid-sentence to hit a count.
    expect(SYSTEM_PROMPT).not.toMatch(/\b\d+\s+words\b/);
  });
});

describe('SYSTEM_PROMPT — caching invariance', () => {
  it('is a frozen const at module load (same identity across imports)', async () => {
    const reimport = await import(
      '../../../artifacts/telegram-bot/src/jobs/interview-session/generate-question.js'
    );
    expect(reimport.SYSTEM_PROMPT).toBe(SYSTEM_PROMPT);
  });

  it('is non-trivial length (engineered prompts are much longer than the PRD template)', () => {
    // PRD §6.4 template was ~700 chars. The engineered prompt is several
    // KB with examples. This guard catches accidental truncation.
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(3000);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// buildPerSignalInstruction — exported pure helper
// ─────────────────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<GenerateQuestionInput> = {}): GenerateQuestionInput {
  const signal: SelectedSignal = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    source: 'msgraph-email',
    capturedAt: new Date('2026-05-20T14:23:00Z'),
    redactedText:
      'Subject: Re: Conditional Access AADSTS50158 retry loop\nBody: Confirmed — adding the device-compliance grant solved it. Took about 40 min to track down. The Intune compliance policy was missing the registry value.',
  };
  const noopLogger: Logger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  } as unknown as Logger;
  const noopAnthropic: OpusAnthropicLike = {
    messages: { create: async () => ({ stop_reason: 'end_turn', content: [] }) },
  };
  return {
    signal,
    candidate: {
      proposedTitle: 'Conditional Access for iOS in M365',
      primaryKeyword: 'Conditional Access for iOS',
    },
    anthropic: noopAnthropic,
    logger: noopLogger,
    clusterContextBlock: '# Cluster context\n…',
    ...overrides,
  };
}

describe('buildPerSignalInstruction', () => {
  it('contains the signal_id and instructs Claude to echo it', () => {
    const out = buildPerSignalInstruction(makeInput());
    expect(out).toContain('550e8400-e29b-41d4-a716-446655440000');
    expect(out).toMatch(/echo signal_id/i);
  });

  it('contains the candidate proposed_title and primary_keyword', () => {
    const out = buildPerSignalInstruction(makeInput());
    expect(out).toContain('Conditional Access for iOS in M365');
    expect(out).toContain('Conditional Access for iOS');
  });

  it('contains a day-of-week and approximate time derived from capturedAt', () => {
    const out = buildPerSignalInstruction(makeInput());
    // 2026-05-20T14:23:00Z is a Wednesday at 2:23 PM UTC
    expect(out).toContain('Wednesday');
    expect(out).toMatch(/2:23 PM UTC/);
  });

  it('truncates redacted_text to 500 chars to keep the per-call payload bounded', () => {
    const longText = 'X'.repeat(800);
    const out = buildPerSignalInstruction(
      makeInput({
        signal: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          source: 'claude-cowork',
          capturedAt: new Date('2026-05-20T14:23:00Z'),
          redactedText: longText,
        },
      }),
    );
    const xCount = (out.match(/X/g) ?? []).length;
    expect(xCount).toBe(500);
  });

  it('appends the retry-reason guidance when retryReason is provided', () => {
    const out = buildPerSignalInstruction(
      makeInput({ retryReason: 'word_count+generic_phrase' }),
    );
    expect(out).toContain('Previous attempt failed the quality gate');
    expect(out).toContain('word_count+generic_phrase');
    expect(out).toMatch(/cite a concrete detail/i);
  });

  it('does NOT append retry guidance when retryReason is omitted or empty', () => {
    const noRetry = buildPerSignalInstruction(makeInput());
    expect(noRetry).not.toMatch(/Previous attempt failed/);

    const emptyRetry = buildPerSignalInstruction(
      makeInput({ retryReason: '' }),
    );
    expect(emptyRetry).not.toMatch(/Previous attempt failed/);
  });
});
