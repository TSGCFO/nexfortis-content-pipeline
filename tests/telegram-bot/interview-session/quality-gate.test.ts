/**
 * Quality-gate tests — PRD §7.2 / AC-F2-08. Pure, deterministic, no I/O.
 */

import { describe, expect, it } from 'vitest';

import { qualityGate } from '../../../artifacts/telegram-bot/src/jobs/interview-session/quality-gate.js';
import type { QuestionResponse } from '../../../artifacts/telegram-bot/src/jobs/interview-session/types.js';
import type { SelectedSignal } from '../../../artifacts/telegram-bot/src/lib/select-signals-for-cluster.js';

const SIGNAL: SelectedSignal = {
  id: 's1',
  capturedAt: new Date('2026-05-19T14:00:00Z'),
  redactedText:
    'Hassan debugged AADSTS50158 in Conditional Access for iOS Authenticator on Tuesday afternoon.',
  source: 'claude',
  tokenCount: 1000,
};

function wordsOf(n: number): string {
  return Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
}

function question(
  overrides: Partial<QuestionResponse> = {},
): QuestionResponse {
  return {
    question_text:
      'Last Tuesday around 2 PM you debugged AADSTS50158 — confirm?',
    signal_id: 's1',
    evidence_phrase: 'AADSTS50158',
    detected_specifics: ['AADSTS50158', 'Conditional Access'],
    no_specifics: false,
    ...overrides,
  };
}

describe('qualityGate', () => {
  it('passes a 60-word question with grounded specifics and no banned phrase', () => {
    const r = qualityGate({
      question: question({ question_text: wordsOf(60) + ' AADSTS50158' }),
      signal: SIGNAL,
      primaryKeyword: 'intune',
    });
    expect(r).toEqual({ ok: true });
  });

  it('fails with ["word_count"] when text exceeds 80 words', () => {
    const r = qualityGate({
      question: question({ question_text: wordsOf(81) + ' AADSTS50158' }),
      signal: SIGNAL,
      primaryKeyword: 'intune',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failures).toEqual(['word_count']);
    }
  });

  it('fails with ["no_specifics"] when detected_specifics is empty', () => {
    const r = qualityGate({
      question: question({ detected_specifics: [] }),
      signal: SIGNAL,
      primaryKeyword: 'intune',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failures).toEqual(['no_specifics']);
    }
  });

  it('fails with ["hallucinated_specific"] when a specific does not appear in redacted_text', () => {
    const r = qualityGate({
      question: question({
        detected_specifics: ['ZZZ-NEVER-IN-CORPUS-99999'],
      }),
      signal: SIGNAL,
      primaryKeyword: 'intune',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failures).toEqual(['hallucinated_specific']);
    }
  });

  it('fails with ["generic_phrase"] when the banned opener appears (case-insensitive)', () => {
    const r = qualityGate({
      question: question({
        question_text:
          'What Did You Work On This Week regarding AADSTS50158?',
      }),
      signal: SIGNAL,
      primaryKeyword: 'intune',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failures).toEqual(['generic_phrase']);
    }
  });

  it('reports multi-failure when both word count AND generic phrase fail simultaneously', () => {
    const filler = wordsOf(85);
    const r = qualityGate({
      question: question({
        question_text:
          `${filler} What did you work on this week with AADSTS50158?`,
      }),
      signal: SIGNAL,
      primaryKeyword: 'intune',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failures).toContain('word_count');
      expect(r.failures).toContain('generic_phrase');
    }
  });

  it('case-insensitive specifics check: lowercase specific matches uppercase corpus', () => {
    const r = qualityGate({
      question: question({ detected_specifics: ['aadsts50158'] }),
      signal: SIGNAL, // contains 'AADSTS50158'
      primaryKeyword: 'intune',
    });
    expect(r).toEqual({ ok: true });
  });

  it('boundary: exactly 80 words passes; 81 words fails', () => {
    const at80 = wordsOf(79) + ' AADSTS50158'; // 80 tokens
    const at81 = wordsOf(80) + ' AADSTS50158'; // 81 tokens
    expect(
      qualityGate({
        question: question({ question_text: at80 }),
        signal: SIGNAL,
        primaryKeyword: 'intune',
      }),
    ).toEqual({ ok: true });
    expect(
      qualityGate({
        question: question({ question_text: at81 }),
        signal: SIGNAL,
        primaryKeyword: 'intune',
      }),
    ).toEqual({ ok: false, failures: ['word_count'] });
  });

  it('skips the hallucinated_specific check when no_specifics already fired (does not double-report)', () => {
    const r = qualityGate({
      question: question({ detected_specifics: [] }),
      signal: SIGNAL,
      primaryKeyword: 'intune',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failures).toEqual(['no_specifics']);
      expect(r.failures).not.toContain('hallucinated_specific');
    }
  });
});
