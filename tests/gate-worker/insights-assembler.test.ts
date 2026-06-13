/**
 * Tests for the Custom Insights assembler (F3 PRD §7).
 *
 * Covers priority ordering, evidence captured-at sorting, the 15k character
 * cap with truncation marker + omitted count, tone/correction wrapping, and
 * the correction-prefix format. Synthetic fixtures throughout.
 */

import { describe, expect, it } from 'vitest';

import {
  assembleInsightsText,
  buildCorrectionPrefix,
  MAX_INSIGHTS_CHARS,
  type EvidenceChunk,
  type InsightsInput,
} from '../../artifacts/gate-worker/src/integrations/insights-assembler.js';
import type { GateAFailure } from '../../artifacts/gate-worker/src/gates/stage-a.js';

function chunk(text: string, iso: string): EvidenceChunk {
  return { text, capturedAt: new Date(iso) };
}

function makeInput(overrides: Partial<InsightsInput> = {}): InsightsInput {
  return {
    confirmedAnswers: ['Confirmed answer about Conditional Access.'],
    followUpAnswers: ['Follow-up detail about the Authenticator app.'],
    evidenceChunks: [chunk('Evidence about AADSTS50158.', '2026-05-20T00:00:00Z')],
    ...overrides,
  };
}

describe('assembleInsightsText', () => {
  it('orders confirmed answers, then follow-ups, then evidence', () => {
    const result = assembleInsightsText(makeInput());
    const text = result.text;
    expect(result.truncated).toBe(false);
    expect(result.omittedChunks).toBe(0);
    expect(text.indexOf('Confirmed answer')).toBeLessThan(
      text.indexOf('Follow-up detail'),
    );
    expect(text.indexOf('Follow-up detail')).toBeLessThan(
      text.indexOf('Evidence about'),
    );
  });

  it('sorts evidence chunks captured-at DESC', () => {
    const result = assembleInsightsText(
      makeInput({
        confirmedAnswers: [],
        followUpAnswers: [],
        evidenceChunks: [
          chunk('older evidence', '2026-05-01T00:00:00Z'),
          chunk('newest evidence', '2026-05-30T00:00:00Z'),
          chunk('middle evidence', '2026-05-15T00:00:00Z'),
        ],
      }),
    );
    expect(result.text.indexOf('newest evidence')).toBeLessThan(
      result.text.indexOf('middle evidence'),
    );
    expect(result.text.indexOf('middle evidence')).toBeLessThan(
      result.text.indexOf('older evidence'),
    );
  });

  it('drops empty and whitespace-only segments', () => {
    const result = assembleInsightsText(
      makeInput({ confirmedAnswers: ['', '   ', 'real answer'] }),
    );
    expect(result.text).toContain('real answer');
    expect(result.text).not.toMatch(/\n\n\n/);
  });

  it('greedy-fills, stays within the cap, and marks the omitted count', () => {
    const seg = (c: string): string => c.repeat(40);
    const result = assembleInsightsText(
      {
        confirmedAnswers: [
          seg('A'),
          seg('B'),
          seg('C'),
          seg('D'),
          seg('E'),
          seg('F'),
        ],
        followUpAnswers: [],
        evidenceChunks: [],
      },
      200,
    );
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(200);
    // Highest-priority segment is always kept.
    expect(result.text).toContain('AAAA');
    expect(result.omittedChunks).toBeGreaterThan(0);
    // The marker count matches the reported omitted count.
    expect(result.text).toContain(`${result.omittedChunks} additional`);
    expect(result.text).toMatch(/segments omitted]$/);
  });

  it('uses singular wording when exactly one segment is dropped', () => {
    const result = assembleInsightsText(
      {
        confirmedAnswers: ['A'.repeat(200), 'B'.repeat(200)],
        followUpAnswers: [],
        evidenceChunks: [],
      },
      290,
    );
    expect(result.omittedChunks).toBe(1);
    expect(result.text).toMatch(/1 additional segment omitted/);
  });

  it('keeps the whole result within the cap when truncating', () => {
    const big = 'x'.repeat(200);
    const result = assembleInsightsText(
      {
        confirmedAnswers: [big, big, big],
        followUpAnswers: [],
        evidenceChunks: [],
      },
      120,
    );
    expect(result.text.length).toBeLessThanOrEqual(120);
    expect(result.truncated).toBe(true);
  });

  it('prepends the correction prefix and appends the tone instruction', () => {
    const result = assembleInsightsText(
      makeInput({
        correctionPrefix: 'CORRECTION INSTRUCTIONS FOR THIS DRAFT:',
        toneInstruction: 'Write in a direct, technical, practitioner tone.',
      }),
    );
    expect(result.text.startsWith('CORRECTION INSTRUCTIONS')).toBe(true);
    expect(
      result.text.endsWith('Write in a direct, technical, practitioner tone.'),
    ).toBe(true);
  });

  it('returns empty text when there is no content', () => {
    const result = assembleInsightsText({
      confirmedAnswers: [],
      followUpAnswers: [],
      evidenceChunks: [],
    });
    expect(result.text).toBe('');
    expect(result.truncated).toBe(false);
    expect(result.omittedChunks).toBe(0);
  });

  it('defaults the cap to 15,000 characters', () => {
    expect(MAX_INSIGHTS_CHARS).toBe(15_000);
  });
});

describe('buildCorrectionPrefix', () => {
  it('formats Stage A failures into correction instructions (PRD §7)', () => {
    const failures: GateAFailure[] = [
      {
        ruleId: 'GA-02',
        ruleName: 'Generic Phrase Blocklist',
        location: 'paragraph 3, sentence 2',
        quotedViolation: 'leveraging cutting-edge solutions',
        instruction: 'Rewrite this section to be specific.',
      },
    ];
    const prefix = buildCorrectionPrefix(failures);
    expect(prefix.startsWith('CORRECTION INSTRUCTIONS FOR THIS DRAFT:')).toBe(
      true,
    );
    expect(prefix).toContain(
      '- Rule GA-02: Replace "leveraging cutting-edge solutions" in paragraph 3, sentence 2.',
    );
    expect(prefix.trimEnd().endsWith('EXPERTISE AND CONTEXT:')).toBe(true);
  });

  it('feeds cleanly into assembleInsightsText as a prefix', () => {
    const failures: GateAFailure[] = [
      {
        ruleId: 'GA-04',
        ruleName: 'Clickbait Title Words',
        location: 'title',
        quotedViolation: 'Ultimate',
        instruction: 'Rewrite title to be descriptive and accurate.',
      },
    ];
    const result = assembleInsightsText(
      makeInput({ correctionPrefix: buildCorrectionPrefix(failures) }),
    );
    expect(result.text).toContain('CORRECTION INSTRUCTIONS FOR THIS DRAFT:');
    expect(result.text).toContain('Confirmed answer about Conditional Access.');
  });
});
