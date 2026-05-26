import { describe, expect, it } from 'vitest';

import {
  buildCompletionPlaceholderMessage,
  buildCorpusQualityAlertMessage,
  buildFollowUpPlaceholderMessage,
  buildVoiceTranscriptionFailureMessage,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/messages.js';

describe('buildCompletionPlaceholderMessage', () => {
  it('uses the singular "example" when confirmedCount is exactly 1', () => {
    const out = buildCompletionPlaceholderMessage({ confirmedCount: 1 });
    expect(out).toBe(
      '✅ Got it. I&#39;ve confirmed 1 example. I&#39;ll have a draft ready for your review by Friday.',
    );
  });

  it('uses the plural "examples" when confirmedCount is 0', () => {
    const out = buildCompletionPlaceholderMessage({ confirmedCount: 0 });
    expect(out).toContain('confirmed 0 examples');
  });

  it('uses the plural "examples" when confirmedCount is 3', () => {
    const out = buildCompletionPlaceholderMessage({ confirmedCount: 3 });
    expect(out).toContain('confirmed 3 examples');
  });

  it('clamps negative inputs to 0 (defensive)', () => {
    const out = buildCompletionPlaceholderMessage({ confirmedCount: -2 });
    expect(out).toContain('confirmed 0 examples');
  });

  it('escapes apostrophes as &#39; (HTML parse-mode defensible)', () => {
    const out = buildCompletionPlaceholderMessage({ confirmedCount: 1 });
    expect(out).toContain("I&#39;ve");
    expect(out).toContain("I&#39;ll");
    expect(out).not.toContain("I'");
  });
});

describe('buildCorpusQualityAlertMessage', () => {
  it('returns the literal §7.2 alert string', () => {
    expect(buildCorpusQualityAlertMessage()).toBe(
      '⚠ Corpus quality may be low for this topic — fewer confirmation questions available than expected.',
    );
  });
});

describe('buildFollowUpPlaceholderMessage', () => {
  it('returns the legacy follow-up placeholder sentinel (superseded by follow-up-loop.ts in PR 3 but retained for export stability)', () => {
    const out = buildFollowUpPlaceholderMessage();
    expect(out).toContain('superseded by follow-up-loop.ts');
  });
});

describe('buildVoiceTranscriptionFailureMessage', () => {
  it('emits the apostrophe as &#39; (matches PR 1 builder escaping policy)', () => {
    const out = buildVoiceTranscriptionFailureMessage();
    expect(out).toContain('Couldn&#39;t');
    expect(out).not.toContain("Couldn't");
  });
});
