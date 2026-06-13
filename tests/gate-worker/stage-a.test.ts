/**
 * Tests for the Stage A rule-based quality gate (F3 PRD §8.1).
 *
 * Covers, per rule, at least one pass and one fail, the fail-fast ordering,
 * and the two named acceptance criteria AC-F3-06 (all-pass) and AC-F3-07
 * (GA-02 specific rejection). All fixtures are synthetic.
 */

import { describe, expect, it } from 'vitest';

import {
  CLICKBAIT_TITLE_PATTERNS,
  countCorpusCitations,
  EXPECTED_BYLINE,
  GENERIC_PHRASE_BLOCKLIST,
  MIN_CORPUS_CITATIONS,
  MIN_TRANSCRIBED_WORDS,
  runGateA,
  type GateAConfirmedChunk,
  type GateAContext,
  type GateADraft,
} from '../../artifacts/gate-worker/src/gates/stage-a.js';

// --- Fixtures ---------------------------------------------------------------

// A clean, passing draft that grounds GA-01 (distinctive tokens AADSTS50158 +
// Authenticator + OHIP), GA-08 (first-person), GA-05/06 (byline + bio), and
// avoids every blocklist.
const PASSING_DRAFT_TEXT = [
  'When a client hit error AADSTS50158 on iOS, I walked them through the fix.',
  '',
  'In my experience, the Microsoft Authenticator app is where Conditional Access',
  'policies actually bite. We reset the OHIP-adjacent records and re-enrolled the',
  'device, and the sign-in succeeded within minutes.',
].join('\n');

const CONFIRMED_CHUNKS: GateAConfirmedChunk[] = [
  { signalId: 's1', text: 'error AADSTS50158 appears during Conditional Access' },
  { signalId: 's2', text: 'the Microsoft Authenticator app handles MFA enrolment' },
  { signalId: 's3', text: 'OHIP record retrieval was the unrelated blocker' },
];

// 100+ words of synthetic transcribed answer material for GA-03.
const LONG_ANSWER = Array.from(
  { length: 120 },
  (_, i) => `word${i}`,
).join(' ');

function makeDraft(overrides: Partial<GateADraft> = {}): GateADraft {
  return {
    draftText: PASSING_DRAFT_TEXT,
    title: 'Fixing Conditional Access Errors on iOS for QuickBooks Clients',
    byline: EXPECTED_BYLINE,
    bioBlock: 'Hassan Sadiq runs NexFortis, a managed-IT and QuickBooks shop.',
    ...overrides,
  };
}

function makeContext(overrides: Partial<GateAContext> = {}): GateAContext {
  return {
    confirmedChunks: CONFIRMED_CHUNKS,
    transcribedAnswers: [LONG_ANSWER],
    ...overrides,
  };
}

// --- AC-F3-06: full pass ----------------------------------------------------

describe('runGateA — passing draft (AC-F3-06)', () => {
  it('passes when all eight rules are satisfied', () => {
    const result = runGateA(makeDraft(), makeContext());
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
    expect(typeof result.evaluatedAt).toBe('string');
    expect(Number.isNaN(Date.parse(result.evaluatedAt))).toBe(false);
  });

  it('uses the injected clock for evaluatedAt (deterministic)', () => {
    const fixed = new Date('2026-06-13T00:00:00.000Z');
    const result = runGateA(makeDraft(), makeContext(), fixed);
    expect(result.evaluatedAt).toBe('2026-06-13T00:00:00.000Z');
  });
});

// --- GA-01: corpus citations -----------------------------------------------

describe('GA-01 corpus citation count', () => {
  it('counts a chunk as cited when a distinctive token reaches the draft', () => {
    expect(countCorpusCitations(makeDraft(), CONFIRMED_CHUNKS)).toBe(3);
  });

  it('does not count generic-only chunks as citations', () => {
    const generic: GateAConfirmedChunk[] = [
      { signalId: 'g1', text: 'our business services help companies' },
      { signalId: 'g2', text: 'the customer wanted a solution' },
    ];
    expect(countCorpusCitations(makeDraft(), generic)).toBe(0);
  });

  it('fails when fewer than the minimum chunks surface in the draft', () => {
    const context = makeContext({
      confirmedChunks: [
        { signalId: 's1', text: 'error AADSTS50158 during Conditional Access' },
        { signalId: 'x', text: 'completely unrelated generic filler content' },
      ],
    });
    const result = runGateA(makeDraft(), context);
    expect(result.passed).toBe(false);
    expect(result.failures[0]?.ruleId).toBe('GA-01');
    expect(result.failures[0]?.quotedViolation).toContain('1 corpus');
    expect(MIN_CORPUS_CITATIONS).toBe(2);
  });
});

// --- GA-02: generic phrase blocklist (AC-F3-07) -----------------------------

describe('GA-02 generic phrase blocklist (AC-F3-07)', () => {
  it('rejects a draft containing a blocklisted phrase and quotes it', () => {
    const draft = makeDraft({
      draftText: `${PASSING_DRAFT_TEXT}\n\nWe deliver by leveraging cutting-edge solutions for everyone.`,
    });
    const result = runGateA(draft, makeContext());
    expect(result.passed).toBe(false);
    expect(result.failures[0]?.ruleId).toBe('GA-02');
    expect(result.failures[0]?.quotedViolation).toBe(
      'leveraging cutting-edge solutions',
    );
    expect(result.failures[0]?.location).toMatch(/paragraph \d+, sentence \d+/);
  });

  it('matches case-insensitively', () => {
    const draft = makeDraft({
      draftText: `${PASSING_DRAFT_TEXT}\n\nThis is a GAME-CHANGER for the team.`,
    });
    const result = runGateA(draft, makeContext());
    expect(result.failures[0]?.ruleId).toBe('GA-02');
    expect(result.failures[0]?.quotedViolation.toLowerCase()).toBe(
      'game-changer',
    );
  });

  it('reports the earliest-occurring blocklisted phrase', () => {
    const draft = makeDraft({
      draftText:
        'Synergy first, says the Authenticator log for AADSTS50158.\n\nThen later we achieve a paradigm shift. I tested it. We did.',
    });
    const result = runGateA(draft, makeContext());
    expect(result.failures[0]?.ruleId).toBe('GA-02');
    expect(result.failures[0]?.quotedViolation.toLowerCase()).toBe('synergy');
  });

  it('keeps the canonical list at 30 phrases', () => {
    expect(GENERIC_PHRASE_BLOCKLIST).toHaveLength(30);
  });
});

// --- GA-03: transcribed words ----------------------------------------------

describe('GA-03 transcribed word count', () => {
  it('fails when fewer than the minimum words were contributed', () => {
    const result = runGateA(
      makeDraft(),
      makeContext({ transcribedAnswers: ['just a few words here'] }),
    );
    expect(result.passed).toBe(false);
    expect(result.failures[0]?.ruleId).toBe('GA-03');
    expect(result.failures[0]?.quotedViolation).toBe('5 words');
  });

  it('sums words across multiple answers', () => {
    const half = Array.from({ length: 60 }, (_, i) => `w${i}`).join(' ');
    const result = runGateA(
      makeDraft(),
      makeContext({ transcribedAnswers: [half, half] }),
    );
    expect(result.passed).toBe(true);
    expect(MIN_TRANSCRIBED_WORDS).toBe(100);
  });
});

// --- GA-04: clickbait title -------------------------------------------------

describe('GA-04 clickbait title words', () => {
  it('rejects an obvious clickbait word', () => {
    const result = runGateA(
      makeDraft({ title: 'The Ultimate Guide to QuickBooks Security' }),
      makeContext(),
    );
    expect(result.passed).toBe(false);
    expect(result.failures[0]?.ruleId).toBe('GA-04');
    expect(result.failures[0]?.location).toBe('title');
  });

  it('rejects a "Top N" listicle title', () => {
    const result = runGateA(
      makeDraft({ title: 'Top 7 Cybersecurity Mistakes' }),
      makeContext(),
    );
    expect(result.failures[0]?.ruleId).toBe('GA-04');
  });

  it('allows "best practice" via the documented exception', () => {
    const result = runGateA(
      makeDraft({ title: 'Conditional Access best practice for small firms' }),
      makeContext(),
    );
    expect(result.passed).toBe(true);
  });

  it('still rejects a bare "Best" not followed by "practice"', () => {
    const result = runGateA(
      makeDraft({ title: 'The Best Way to Secure QuickBooks' }),
      makeContext(),
    );
    expect(result.failures[0]?.ruleId).toBe('GA-04');
  });

  it('covers every documented clickbait label', () => {
    expect(CLICKBAIT_TITLE_PATTERNS.map((p) => p.label)).toContain(
      "You Won't Believe",
    );
  });
});

// --- GA-05 / GA-06: byline + bio -------------------------------------------

describe('GA-05 author byline', () => {
  it('fails when the byline is missing', () => {
    const result = runGateA(makeDraft({ byline: '' }), makeContext());
    expect(result.failures[0]?.ruleId).toBe('GA-05');
    expect(result.failures[0]?.quotedViolation).toBe('(none)');
  });

  it('fails when the byline is someone else', () => {
    const result = runGateA(makeDraft({ byline: 'Jane Doe' }), makeContext());
    expect(result.failures[0]?.ruleId).toBe('GA-05');
    expect(result.failures[0]?.quotedViolation).toBe('Jane Doe');
  });

  it('accepts the canonical byline regardless of surrounding whitespace', () => {
    const result = runGateA(
      makeDraft({ byline: '  Hassan Sadiq  ' }),
      makeContext(),
    );
    expect(result.passed).toBe(true);
  });

  it('rejects a non-canonical case (strict equality per spec)', () => {
    const result = runGateA(
      makeDraft({ byline: 'hassan sadiq' }),
      makeContext(),
    );
    expect(result.failures[0]?.ruleId).toBe('GA-05');
  });
});

describe('GA-06 author bio block', () => {
  it('fails when the bio block is empty or whitespace', () => {
    const result = runGateA(makeDraft({ bioBlock: '   ' }), makeContext());
    expect(result.failures[0]?.ruleId).toBe('GA-06');
  });
});

// --- GA-07: unsourced statistic --------------------------------------------

describe('GA-07 unsourced statistic', () => {
  it('flags a 4+ digit number with no nearby source', () => {
    const draft = makeDraft({
      draftText:
        'When I migrated the tenant using the Authenticator app, we saw 4827 blocked sign-ins tied to AADSTS50158 and moved on.',
    });
    const result = runGateA(draft, makeContext());
    expect(result.passed).toBe(false);
    expect(result.failures[0]?.ruleId).toBe('GA-07');
    expect(result.failures[0]?.quotedViolation).toBe('4827');
  });

  it('passes when a URL appears within the proximity window', () => {
    const draft = makeDraft({
      draftText:
        'When I migrated the tenant on the Authenticator app, we saw 4827 blocked sign-ins (https://example.com/report) for AADSTS50158. We moved on.',
    });
    const result = runGateA(draft, makeContext());
    expect(result.passed).toBe(true);
  });

  it('passes when a named-source cue appears within the window', () => {
    const draft = makeDraft({
      draftText:
        'According to our internal report, I migrated the tenant on the Authenticator app and logged 4827 blocked sign-ins for AADSTS50158.',
    });
    const result = runGateA(draft, makeContext());
    expect(result.passed).toBe(true);
  });

  it('ignores numbers with fewer than four digits', () => {
    const draft = makeDraft({
      draftText:
        'When I migrated the tenant on the Authenticator app, I closed 372 tickets for AADSTS50158. We were busy.',
    });
    const result = runGateA(draft, makeContext());
    expect(result.passed).toBe(true);
  });

  it('does not treat digits embedded in an error code as a statistic', () => {
    const draft = makeDraft({
      draftText:
        'In my experience the Authenticator app resolves AADSTS50158 cleanly. We re-enrolled and the OHIP lookup was unrelated.',
    });
    const result = runGateA(draft, makeContext());
    expect(result.passed).toBe(true);
  });

  it('does not accept "resource" as a source (whole-word cue matching)', () => {
    const draft = makeDraft({
      draftText:
        'When I migrated the tenant on the Authenticator app, our resource pool logged 4827 events for AADSTS50158. We moved on.',
    });
    const result = runGateA(draft, makeContext());
    expect(result.passed).toBe(false);
    expect(result.failures[0]?.ruleId).toBe('GA-07');
  });
});

// --- GA-08: E-E-A-T marker --------------------------------------------------

describe('GA-08 E-E-A-T first-person marker', () => {
  it('fails a draft with no first-person language', () => {
    const draft = makeDraft({
      draftText:
        'The Authenticator app handles error AADSTS50158. The OHIP record was unrelated. Conditional Access policies apply.',
    });
    const result = runGateA(draft, makeContext());
    expect(result.passed).toBe(false);
    expect(result.failures[0]?.ruleId).toBe('GA-08');
  });

  it('passes a draft using "in my experience"', () => {
    const draft = makeDraft({
      draftText:
        'In my experience the Authenticator app fixes AADSTS50158, and the OHIP record was a red herring.',
    });
    const result = runGateA(draft, makeContext());
    expect(result.passed).toBe(true);
  });
});

// --- Fail-fast ordering -----------------------------------------------------

describe('runGateA fail-fast ordering', () => {
  it('returns only the earliest failing rule (GA-01 before GA-02)', () => {
    // No corpus grounding AND a generic phrase: GA-01 must win.
    const draft = makeDraft({
      draftText: 'We deliver seamless integration. I did it. We did it again.',
    });
    const context = makeContext({ confirmedChunks: [] });
    const result = runGateA(draft, context);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.ruleId).toBe('GA-01');
  });

  it('stops at GA-04 when earlier rules pass but the title is clickbait', () => {
    const result = runGateA(
      makeDraft({ title: 'Shocking QuickBooks Secret' }),
      makeContext(),
    );
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.ruleId).toBe('GA-04');
  });
});
