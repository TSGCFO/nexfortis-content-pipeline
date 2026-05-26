/**
 * Tests for the SERP-gap coverage heuristic.
 *
 * Coverage shapes the PR 3 follow-up loop relies on:
 *   - Zero gaps -> empty
 *   - Zero signals -> all gaps returned (nothing covered)
 *   - Case-insensitive substring matching
 *   - Stop-word filter (so trivial "the" overlap doesn't cover)
 *   - Order preservation (caller sorts/truncates)
 */

import { describe, expect, it } from 'vitest';

import {
  computeUncoveredGaps,
  tokenizeGap,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/serp-gap-coverage.js';

function signal(text: string): { redactedText: string } {
  return { redactedText: text };
}

describe('computeUncoveredGaps', () => {
  it('3 gaps, 0 covered: returns all 3', () => {
    const result = computeUncoveredGaps(
      {
        serpGaps: [
          'intune compliance policy',
          'conditional access',
          'autopilot enrollment',
        ],
      },
      [signal('Random unrelated text about coffee.')],
    );
    expect(result).toHaveLength(3);
  });

  it('3 gaps, 2 fully covered: returns the 1 uncovered', () => {
    const result = computeUncoveredGaps(
      {
        serpGaps: [
          'intune compliance policy',
          'conditional access',
          'autopilot enrollment',
        ],
      },
      [
        signal('Intune Compliance Policy v3 was missing a registry value.'),
        signal('Hit a Conditional Access loop on AADSTS50158.'),
      ],
    );
    expect(result).toEqual(['autopilot enrollment']);
  });

  it('zero gaps in candidate: returns empty array', () => {
    expect(
      computeUncoveredGaps({ serpGaps: [] }, [signal('anything')]),
    ).toEqual([]);
  });

  it('null serpGaps: returns empty array', () => {
    expect(
      computeUncoveredGaps({ serpGaps: null }, [signal('anything')]),
    ).toEqual([]);
  });

  it('zero confirmed signals: returns all gaps verbatim', () => {
    const gaps = ['a', 'b', 'c'];
    expect(computeUncoveredGaps({ serpGaps: gaps }, [])).toEqual(gaps);
  });

  it('case-insensitive substring match: "Intune Compliance Policy" covers gap "intune compliance policy"', () => {
    const result = computeUncoveredGaps(
      { serpGaps: ['intune compliance policy'] },
      [signal('Configured Intune Compliance Policy yesterday.')],
    );
    expect(result).toEqual([]);
  });

  it('stop-word filter: gap "the migration" with signal containing only "the" is NOT covered', () => {
    const result = computeUncoveredGaps(
      { serpGaps: ['the migration'] },
      [signal('Discussion of the weather and the office.')],
    );
    expect(result).toEqual(['the migration']);
  });

  it('order preservation: returns uncovered in the same order as input', () => {
    const result = computeUncoveredGaps(
      { serpGaps: ['zeta topic', 'alpha frontier', 'mu region'] },
      [signal('alpha frontier was covered here')],
    );
    expect(result).toEqual(['zeta topic', 'mu region']);
  });
});

describe('tokenizeGap', () => {
  it('lowercases and splits on whitespace', () => {
    expect(tokenizeGap('Intune COMPLIANCE policy')).toEqual([
      'intune',
      'compliance',
      'policy',
    ]);
  });

  it('drops stop words', () => {
    expect(tokenizeGap('the migration of the database')).toEqual([
      'migration',
      'database',
    ]);
  });

  it('returns empty array for an all-stop-word gap', () => {
    expect(tokenizeGap('the and of')).toEqual([]);
  });
});
