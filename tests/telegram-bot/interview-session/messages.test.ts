/**
 * Tests for the PR 2-new message builders (`messages.ts`).
 *
 * PR 1's three builders have their own files (`build-preview-message.test.ts`,
 * `build-skip-ack-message.test.ts`, `build-timeout-message.test.ts`). This
 * file covers the new completion / corpus-quality / follow-up / voice
 * failure / confirmation-body builders.
 */

import { describe, expect, it } from 'vitest';

import {
  buildCompletionPlaceholderMessage,
  buildConfirmationBody,
  buildCorpusQualityAlertMessage,
  buildFollowUpPlaceholderMessage,
  buildVoiceTranscriptionFailureMessage,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/messages.js';

describe('buildCompletionPlaceholderMessage', () => {
  it('uses singular "example" when confirmedCount=1', () => {
    const out = buildCompletionPlaceholderMessage({ confirmedCount: 1 });
    expect(out).toMatch(/confirmed 1 example\b/);
    expect(out).toMatch(/Friday/);
  });

  it('uses plural "examples" when confirmedCount=0 or >1', () => {
    expect(buildCompletionPlaceholderMessage({ confirmedCount: 0 })).toMatch(
      /confirmed 0 examples\b/,
    );
    expect(buildCompletionPlaceholderMessage({ confirmedCount: 3 })).toMatch(
      /confirmed 3 examples\b/,
    );
  });
});

describe('buildCorpusQualityAlertMessage', () => {
  it('returns the exact PRD §7.2 alert text', () => {
    const out = buildCorpusQualityAlertMessage();
    expect(out).toBe(
      '⚠ Corpus quality may be low for this topic — fewer confirmation questions available than expected.',
    );
  });
});

describe('buildFollowUpPlaceholderMessage', () => {
  it('HTML-escapes the primary keyword (regression guard)', () => {
    const out = buildFollowUpPlaceholderMessage({
      primaryKeyword: '<script>alert(1)</script>',
    });
    expect(out).toContain('&lt;script&gt;');
    expect(out).not.toContain('<script>');
  });
});

describe('buildVoiceTranscriptionFailureMessage', () => {
  it('HTML-escapes the apostrophe in "Couldn\'t"', () => {
    const out = buildVoiceTranscriptionFailureMessage();
    expect(out).toContain('Couldn&#39;t');
    expect(out).not.toContain("Couldn't");
  });
});

describe('buildConfirmationBody', () => {
  it('renders the [N/M] header + question + evidence quote', () => {
    const out = buildConfirmationBody({
      questionIndex: 1,
      totalQuestions: 3,
      questionText: 'Did the AADSTS50158 error block iOS auth?',
      evidenceQuote: 'Hassan worked through AADSTS50158 with Claude…',
    });
    expect(out).toMatch(/^\[1\/3\]/);
    expect(out).toContain('AADSTS50158');
  });

  it('escapes HTML in both the questionText and evidenceQuote', () => {
    const out = buildConfirmationBody({
      questionIndex: 1,
      totalQuestions: 1,
      questionText: '<script>alert(1)</script>',
      evidenceQuote: '<img src=x>',
    });
    expect(out).toContain('&lt;script&gt;');
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;img');
    expect(out).not.toContain('<img');
  });
});
