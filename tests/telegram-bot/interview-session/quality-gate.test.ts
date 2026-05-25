/**
 * Tests for `checkQualityGate` (PRD §7.2).
 *
 * Pure unit tests — no DB, no LLM, no clock.
 */

import { describe, expect, it } from 'vitest';

import { checkQualityGate } from '../../../artifacts/telegram-bot/src/jobs/interview-session/quality-gate.js';
import type {
  GeneratedQuestion,
  QualityGateFailure,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/types.js';

function makeQuestion(
  partial: Partial<GeneratedQuestion> = {},
): GeneratedQuestion {
  return {
    questionText: partial.questionText ?? 'Was AADSTS50158 the actual blocker on iOS Authenticator?',
    signalId: partial.signalId ?? '00000000-0000-0000-0000-000000000000',
    evidencePhrase: partial.evidencePhrase ?? 'AADSTS50158',
    detectedSpecifics: partial.detectedSpecifics ?? ['AADSTS50158'],
  };
}

const REDACTED_WITH_SPECIFIC =
  'Hassan worked through AADSTS50158 with Claude for 40 minutes on Tuesday.';

describe('checkQualityGate', () => {
  it('returns { ok: true } when 1 specific is present in redacted_text and word count is OK', () => {
    const result = checkQualityGate({
      question: makeQuestion(),
      signal: { redactedText: REDACTED_WITH_SPECIFIC },
      primaryKeyword: 'intune',
    });
    expect(result).toEqual({ ok: true });
  });

  it('returns failure including "word_count" when question is 81 words', () => {
    const eightyOneWords = Array.from({ length: 81 }, (_, i) => `w${i}`).join(' ');
    const result = checkQualityGate({
      question: makeQuestion({ questionText: eightyOneWords }),
      signal: { redactedText: REDACTED_WITH_SPECIFIC },
      primaryKeyword: 'intune',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failures).toContain('word_count' as QualityGateFailure);
  });

  it('returns failure "no_specifics" when detected_specifics is empty', () => {
    const result = checkQualityGate({
      question: makeQuestion({ detectedSpecifics: [] }),
      signal: { redactedText: REDACTED_WITH_SPECIFIC },
      primaryKeyword: 'intune',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failures).toContain('no_specifics' as QualityGateFailure);
  });

  it('returns failure "hallucinated_specific" when a specific is absent from redacted_text', () => {
    const result = checkQualityGate({
      question: makeQuestion({ detectedSpecifics: ['AADSTS50158'] }),
      signal: { redactedText: 'Hassan worked on something unrelated.' },
      primaryKeyword: 'intune',
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.failures).toContain('hallucinated_specific' as QualityGateFailure);
  });

  it('returns failure "generic_phrase" when question contains a banned phrase (case-insensitive)', () => {
    const result = checkQualityGate({
      question: makeQuestion({
        questionText: 'WHAT DID YOU WORK ON THIS WEEK regarding AADSTS50158?',
      }),
      signal: { redactedText: REDACTED_WITH_SPECIFIC },
      primaryKeyword: 'intune',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failures).toContain('generic_phrase' as QualityGateFailure);
  });

  it('accumulates multiple failures simultaneously (word_count + generic_phrase)', () => {
    const eighty1 = Array.from({ length: 81 }, (_, i) => `w${i}`).join(' ');
    const result = checkQualityGate({
      question: makeQuestion({
        questionText: `${eighty1} tell me about your week`,
      }),
      signal: { redactedText: REDACTED_WITH_SPECIFIC },
      primaryKeyword: 'intune',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failures).toContain('word_count' as QualityGateFailure);
      expect(result.failures).toContain('generic_phrase' as QualityGateFailure);
    }
  });

  it('checks specifics case-insensitively (lowercase specific matches uppercase corpus)', () => {
    const result = checkQualityGate({
      question: makeQuestion({ detectedSpecifics: ['aadsts50158'] }),
      signal: { redactedText: 'AADSTS50158 appeared during sign-in.' },
      primaryKeyword: 'intune',
    });
    expect(result).toEqual({ ok: true });
  });

  it('boundary: exactly 80 words passes', () => {
    const eighty = Array.from({ length: 80 }, () => 'AADSTS50158').join(' ');
    const result = checkQualityGate({
      question: makeQuestion({ questionText: eighty }),
      signal: { redactedText: REDACTED_WITH_SPECIFIC },
      primaryKeyword: 'intune',
    });
    expect(result).toEqual({ ok: true });
  });
});
