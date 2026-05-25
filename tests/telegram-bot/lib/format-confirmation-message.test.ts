import { describe, expect, it } from 'vitest';

import { formatConfirmationMessage } from '../../../artifacts/telegram-bot/src/lib/format-confirmation-message.js';

describe('formatConfirmationMessage', () => {
  it('renders [N/M] header followed by question text and italicised quote', () => {
    const out = formatConfirmationMessage({
      questionIndex: 2,
      totalQuestions: 4,
      questionText: 'Last Tuesday you debugged AADSTS50158 — confirm?',
      signalRedactedText: 'Hassan tried to fix the conditional access policy.',
    });
    expect(out).toContain('[2/4] Last Tuesday you debugged AADSTS50158 — confirm?');
    expect(out).toContain('<i>«Hassan tried to fix the conditional access policy.»</i>');
  });

  it('escapes HTML in the question text', () => {
    const out = formatConfirmationMessage({
      questionIndex: 1,
      totalQuestions: 1,
      questionText: '<script>alert(1)</script>',
      signalRedactedText: 'irrelevant',
    });
    expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(out).not.toContain('<script>');
  });

  it('escapes HTML in the evidence quote', () => {
    const out = formatConfirmationMessage({
      questionIndex: 1,
      totalQuestions: 1,
      questionText: 'safe',
      signalRedactedText: '<script>evil()</script>',
    });
    expect(out).toContain('&lt;script&gt;evil()&lt;/script&gt;');
    expect(out).not.toContain('<script>evil');
  });

  it('truncates the evidence quote to 80 words and appends an ellipsis', () => {
    const longText = Array.from({ length: 120 }, (_, i) => `w${i}`).join(' ');
    const out = formatConfirmationMessage({
      questionIndex: 1,
      totalQuestions: 1,
      questionText: 'Q',
      signalRedactedText: longText,
    });
    // The quote portion should end with …»
    expect(out).toMatch(/w79…»<\/i>$/);
    expect(out).not.toContain('w80 ');
  });

  it('does NOT append ellipsis when evidence is exactly 80 words', () => {
    const exactly80 = Array.from({ length: 80 }, (_, i) => `w${i}`).join(' ');
    const out = formatConfirmationMessage({
      questionIndex: 1,
      totalQuestions: 1,
      questionText: 'Q',
      signalRedactedText: exactly80,
    });
    expect(out).toMatch(/w79»<\/i>$/);
    expect(out).not.toContain('…');
  });

  it('omits the quote block entirely when signalRedactedText is empty', () => {
    const out = formatConfirmationMessage({
      questionIndex: 1,
      totalQuestions: 1,
      questionText: 'Q',
      signalRedactedText: '   ',
    });
    expect(out).toBe('[1/1] Q');
  });

  it('collapses internal whitespace runs in the evidence quote to single spaces', () => {
    const out = formatConfirmationMessage({
      questionIndex: 1,
      totalQuestions: 1,
      questionText: 'Q',
      signalRedactedText: 'one   two\n\nthree\tfour',
    });
    expect(out).toContain('<i>«one two three four»</i>');
  });
});
