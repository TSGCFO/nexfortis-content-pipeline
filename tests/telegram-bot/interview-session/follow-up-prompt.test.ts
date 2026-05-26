/**
 * Structural assertions on the engineered `FOLLOW_UP_SYSTEM_PROMPT` —
 * same shape as PR 2's `system-prompt.test.ts`. Anyone editing the
 * prompt sees these tests break first.
 *
 * What we assert:
 *   - ≥2 worked positive examples (each with a SIGNAL/CONTEXT, a
 *     GOOD QUESTION, and a WHY IT WORKS rationale).
 *   - ≥1 worked negative example (with WHY IT FAILS).
 *   - Voice calibration: Hassan / NexFortis / Ontario / Telegram /
 *     Monday morning.
 *   - No banned phrases.
 *   - No mention of word count, buttons, JSON schema, output_config,
 *     parse_mode, model name.
 *   - Length > 1500 chars.
 *   - Snapshot lock on the full prompt text.
 */

import { describe, expect, it } from 'vitest';

import { FOLLOW_UP_SYSTEM_PROMPT } from '../../../artifacts/telegram-bot/src/jobs/interview-session/generate-follow-up.js';

describe('FOLLOW_UP_SYSTEM_PROMPT — structural contract', () => {
  it('contains at least 2 worked positive examples (labelled "Positive example N")', () => {
    const matches = FOLLOW_UP_SYSTEM_PROMPT.match(/Positive example \d/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('every positive example block contains a GOOD QUESTION and a WHY IT WORKS rationale', () => {
    const blocks = FOLLOW_UP_SYSTEM_PROMPT.split(/Positive example \d[^\n]*\n-+/).slice(1);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    for (const block of blocks) {
      const section = block.split(/\n[A-Z][^\n]*\n-+\n/)[0] ?? block;
      expect(section).toMatch(/GOOD QUESTION:/);
      expect(section).toMatch(/WHY IT WORKS:/);
    }
  });

  it('contains at least 1 worked negative example (labelled "Bad example")', () => {
    const matches = FOLLOW_UP_SYSTEM_PROMPT.match(/Bad example/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('every negative example block contains a BAD QUESTION and a WHY IT FAILS', () => {
    const blocks = FOLLOW_UP_SYSTEM_PROMPT.split(/Bad example[^\n]*\n-+/).slice(1);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    for (const block of blocks) {
      const section = block.split(/\n[A-Z][^\n]*\n-+\n/)[0] ?? block;
      expect(section).toMatch(/BAD QUESTION:/);
      expect(section).toMatch(/WHY IT FAILS:/);
    }
  });

  it('mentions Hassan, NexFortis, and Ontario (voice grounding)', () => {
    expect(FOLLOW_UP_SYSTEM_PROMPT).toMatch(/Hassan/);
    expect(FOLLOW_UP_SYSTEM_PROMPT).toMatch(/NexFortis/);
    expect(FOLLOW_UP_SYSTEM_PROMPT).toMatch(/Ontario/);
  });

  it('mentions Telegram and Monday morning (delivery calibration)', () => {
    expect(FOLLOW_UP_SYSTEM_PROMPT).toMatch(/Telegram/);
    expect(FOLLOW_UP_SYSTEM_PROMPT).toMatch(/Monday morning/);
  });

  it('has explicit Role / Voice / Job sections and a chain-of-thought block', () => {
    expect(FOLLOW_UP_SYSTEM_PROMPT).toMatch(/^Voice$/m);
    expect(FOLLOW_UP_SYSTEM_PROMPT).toMatch(/^The job$/m);
    expect(FOLLOW_UP_SYSTEM_PROMPT).toMatch(/How to think before writing/);
    expect(FOLLOW_UP_SYSTEM_PROMPT).toMatch(/^Target shape$/m);
  });

  it('contains none of the banned softener phrases', () => {
    const lower = FOLLOW_UP_SYSTEM_PROMPT.toLowerCase();
    expect(lower).not.toMatch(/\bplease\b/);
    expect(lower).not.toMatch(/\bkindly\b/);
    expect(lower).not.toMatch(/\bas an ai\b/);
    expect(lower).not.toMatch(/\bi hope this helps\b/);
    expect(lower).not.toMatch(/\bhappy to help\b/);
    expect(lower).not.toMatch(/\blet me know if\b/);
    expect(lower).not.toMatch(/\bas a language model\b/);
  });

  it('does not contain forbidden words "scrape" or "crawl"', () => {
    const lower = FOLLOW_UP_SYSTEM_PROMPT.toLowerCase();
    expect(lower).not.toMatch(/\bscrape\b/);
    expect(lower).not.toMatch(/\bcrawl\b/);
  });

  it('does not mention buttons / word count / JSON schema / output_config / parse_mode / model name', () => {
    const lower = FOLLOW_UP_SYSTEM_PROMPT.toLowerCase();
    expect(lower).not.toMatch(/yes,?\s*use it/);
    expect(lower).not.toMatch(/anonymize client/);
    expect(lower).not.toMatch(/\bword count\b/);
    expect(lower).not.toMatch(/json schema/);
    expect(lower).not.toMatch(/output_config/);
    expect(lower).not.toMatch(/parse_mode/);
    expect(lower).not.toMatch(/claude-opus/);
    expect(lower).not.toMatch(/markdown/);
  });

  it('is at least 1500 characters long — engineered, not a stub', () => {
    expect(FOLLOW_UP_SYSTEM_PROMPT.length).toBeGreaterThan(1500);
  });

  it('content matches snapshot — locks the engineered prompt against drift', () => {
    expect(FOLLOW_UP_SYSTEM_PROMPT).toMatchSnapshot();
  });
});
