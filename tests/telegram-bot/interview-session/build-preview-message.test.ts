/**
 * Unit tests for `buildPreviewMessage`. Pure function — zero mocks.
 */

import { describe, expect, it } from 'vitest';

import { buildPreviewMessage } from '../../../artifacts/telegram-bot/src/jobs/interview-session/build-preview-message.js';

describe('buildPreviewMessage', () => {
  it('returns a string containing the escaped proposed title', () => {
    const msg = buildPreviewMessage({
      proposedTitle: 'Conditional Access for iOS',
      pillar: 'managed-it',
      primaryKeyword: 'intune',
      signalCount: 3,
    });
    expect(msg).toContain('Conditional Access for iOS');
  });

  it('returns a string containing the pillar verbatim', () => {
    const msg = buildPreviewMessage({
      proposedTitle: 'T',
      pillar: 'cybersecurity',
      primaryKeyword: 'k',
      signalCount: 1,
    });
    expect(msg).toContain('Pillar: cybersecurity');
  });

  it('returns a string containing the escaped primary keyword', () => {
    const msg = buildPreviewMessage({
      proposedTitle: 'T',
      pillar: 'quickbooks',
      primaryKeyword: 'payroll setup',
      signalCount: 4,
    });
    expect(msg).toContain('Target keyword: payroll setup');
  });

  it('renders "1 thing" (singular) when signalCount === 1', () => {
    const msg = buildPreviewMessage({
      proposedTitle: 'T',
      pillar: 'managed-it',
      primaryKeyword: 'k',
      signalCount: 1,
    });
    expect(msg).toContain('1 thing in your work');
    expect(msg).not.toContain('1 things');
  });

  it('renders "5 things" (plural) when signalCount === 5', () => {
    const msg = buildPreviewMessage({
      proposedTitle: 'T',
      pillar: 'managed-it',
      primaryKeyword: 'k',
      signalCount: 5,
    });
    expect(msg).toContain('5 things in your work');
    expect(msg).not.toContain('5 thing in your work');
  });

  it('HTML-escapes <, > and & in the proposed title (no raw injection)', () => {
    const msg = buildPreviewMessage({
      proposedTitle: 'Foo & <bar>',
      pillar: 'managed-it',
      primaryKeyword: 'k',
      signalCount: 2,
    });
    expect(msg).toContain('Foo &amp; &lt;bar&gt;');
    // No raw injection: no literal `<bar>` substring.
    expect(msg).not.toContain('<bar>');
    // The only `&` occurrences should be HTML entities, not bare `&`.
    // Scan: every `&` must be followed by `[a-z]+;` or `#\d+;`.
    const bareAmpRe = /&(?!(?:[a-zA-Z]+|#\d+);)/;
    expect(bareAmpRe.test(msg)).toBe(false);
  });

  it("renders the apostrophe in week's as the HTML entity &#39;", () => {
    const msg = buildPreviewMessage({
      proposedTitle: 'Title',
      pillar: 'managed-it',
      primaryKeyword: 'k',
      signalCount: 3,
    });
    expect(msg).toContain('This week&#39;s article');
    // The raw apostrophe character should NOT appear in the message.
    expect(msg).not.toContain("week's");
  });
});
