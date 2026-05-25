/**
 * Tests for `formatConfirmationMessage`. Asserts the rendered body shape
 * (N/M header, evidence quote, HTML-escaping) without booting any IO.
 */

import { describe, expect, it } from 'vitest';

import { formatConfirmationMessage } from '../../../artifacts/telegram-bot/src/lib/format-confirmation-message.js';

const SAMPLE_REDACTED =
  'Hassan worked through AADSTS50158 with Claude for about 40 minutes ' +
  'starting at 13:48 local time. The Conditional Access policy required ' +
  'an MFA prompt that the iOS Authenticator misrendered for tenant ' +
  '<redacted-tenant>.';

const CAPTURED_AT = new Date('2026-05-12T18:48:00Z'); // Tue ~2pm ET

describe('formatConfirmationMessage', () => {
  it('renders an "[N/M]" header containing index + total', () => {
    const out = formatConfirmationMessage({
      questionIndex: 2,
      totalQuestions: 5,
      questionText: 'Was AADSTS50158 the actual blocker?',
      redactedText: SAMPLE_REDACTED,
      capturedAt: CAPTURED_AT,
      tokenCount: 1000,
      topic: 'intune',
    });
    expect(out).toMatch(/^\[2\/5\]/);
  });

  it('escapes HTML in the question text', () => {
    const out = formatConfirmationMessage({
      questionIndex: 1,
      totalQuestions: 1,
      questionText: '<script>alert(1)</script>',
      redactedText: SAMPLE_REDACTED,
      capturedAt: CAPTURED_AT,
      tokenCount: 1000,
      topic: 'intune',
    });
    expect(out).toContain('&lt;script&gt;');
    expect(out).not.toContain('<script>');
  });

  it('escapes HTML in the evidence quote', () => {
    const out = formatConfirmationMessage({
      questionIndex: 1,
      totalQuestions: 1,
      questionText: 'q?',
      redactedText: '<img src=x onerror=alert(1)>',
      capturedAt: CAPTURED_AT,
      tokenCount: 1000,
      topic: 'intune',
    });
    expect(out).toContain('&lt;img');
    expect(out).not.toContain('<img');
  });

  it('quotes only the first 80 words of the redacted_text', () => {
    const long = Array.from({ length: 200 }, (_, i) => `w${i}`).join(' ');
    const out = formatConfirmationMessage({
      questionIndex: 1,
      totalQuestions: 1,
      questionText: 'q?',
      redactedText: long,
      capturedAt: CAPTURED_AT,
      tokenCount: 1000,
      topic: 'intune',
    });
    expect(out).toContain('w0');
    expect(out).toContain('w79');
    expect(out).not.toContain('w80');
  });

  it('includes the estimated duration in minutes', () => {
    const out = formatConfirmationMessage({
      questionIndex: 1,
      totalQuestions: 1,
      questionText: 'q?',
      redactedText: SAMPLE_REDACTED,
      capturedAt: CAPTURED_AT,
      tokenCount: 1000,
      topic: 'intune',
    });
    // 1000 tokens → 8 minutes
    expect(out).toMatch(/about 8 minutes/);
  });

  it('uses singular "minute" when duration is 1', () => {
    const out = formatConfirmationMessage({
      questionIndex: 1,
      totalQuestions: 1,
      questionText: 'q?',
      redactedText: SAMPLE_REDACTED,
      capturedAt: CAPTURED_AT,
      tokenCount: null,
      topic: 'intune',
    });
    expect(out).toMatch(/about 1 minute\b/);
  });

  it('includes the topic in bold tags', () => {
    const out = formatConfirmationMessage({
      questionIndex: 1,
      totalQuestions: 1,
      questionText: 'q?',
      redactedText: SAMPLE_REDACTED,
      capturedAt: CAPTURED_AT,
      tokenCount: 1000,
      topic: 'intune & azure',
    });
    expect(out).toContain('<b>intune &amp; azure</b>');
  });
});
