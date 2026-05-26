/**
 * Structural assertions on the engineered `CLOSING_SUMMARY_SYSTEM_PROMPT`.
 *
 * Same conventions as `system-prompt.test.ts` and `follow-up-prompt.test.ts`.
 */

import { describe, expect, it } from 'vitest';

import { CLOSING_SUMMARY_SYSTEM_PROMPT } from '../../../artifacts/telegram-bot/src/jobs/interview-session/generate-closing-summary.js';

describe('CLOSING_SUMMARY_SYSTEM_PROMPT — structural contract', () => {
  it('contains at least 2 worked positive examples', () => {
    const matches = CLOSING_SUMMARY_SYSTEM_PROMPT.match(/Positive example \d/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('every positive example contains a GOOD SUMMARY and a WHY IT WORKS rationale', () => {
    const blocks = CLOSING_SUMMARY_SYSTEM_PROMPT.split(/Positive example \d[^\n]*\n-+/).slice(1);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    for (const block of blocks) {
      const section = block.split(/\n[A-Z][^\n]*\n-+\n/)[0] ?? block;
      expect(section).toMatch(/GOOD SUMMARY:/);
      expect(section).toMatch(/WHY IT WORKS:/);
    }
  });

  it('contains at least 1 worked negative example', () => {
    expect(CLOSING_SUMMARY_SYSTEM_PROMPT).toMatch(/Bad example/);
    expect(CLOSING_SUMMARY_SYSTEM_PROMPT).toMatch(/BAD SUMMARY:/);
    expect(CLOSING_SUMMARY_SYSTEM_PROMPT).toMatch(/WHY IT FAILS:/);
  });

  it('mentions Hassan, NexFortis, Ontario (voice grounding) and Telegram + Monday morning', () => {
    expect(CLOSING_SUMMARY_SYSTEM_PROMPT).toMatch(/Hassan/);
    expect(CLOSING_SUMMARY_SYSTEM_PROMPT).toMatch(/NexFortis/);
    expect(CLOSING_SUMMARY_SYSTEM_PROMPT).toMatch(/Ontario/);
    expect(CLOSING_SUMMARY_SYSTEM_PROMPT).toMatch(/Telegram/);
    expect(CLOSING_SUMMARY_SYSTEM_PROMPT).toMatch(/Monday-morning/);
  });

  it('has labelled Role / Voice / Job / Shape sections', () => {
    expect(CLOSING_SUMMARY_SYSTEM_PROMPT).toMatch(/^Voice$/m);
    expect(CLOSING_SUMMARY_SYSTEM_PROMPT).toMatch(/^The job$/m);
    expect(CLOSING_SUMMARY_SYSTEM_PROMPT).toMatch(/^Shape$/m);
  });

  it('contains none of the banned softener phrases', () => {
    const lower = CLOSING_SUMMARY_SYSTEM_PROMPT.toLowerCase();
    expect(lower).not.toMatch(/\bplease\b/);
    expect(lower).not.toMatch(/\bkindly\b/);
    expect(lower).not.toMatch(/\bas an ai\b/);
    expect(lower).not.toMatch(/\bi hope this helps\b/);
    expect(lower).not.toMatch(/\bhappy to help\b/);
    expect(lower).not.toMatch(/\blet me know if\b/);
    expect(lower).not.toMatch(/\bas a language model\b/);
  });

  it('does not mention JSON schema / output_config / model name / parse_mode', () => {
    const lower = CLOSING_SUMMARY_SYSTEM_PROMPT.toLowerCase();
    expect(lower).not.toMatch(/json schema/);
    expect(lower).not.toMatch(/output_config/);
    expect(lower).not.toMatch(/parse_mode/);
    expect(lower).not.toMatch(/claude-haiku/);
    expect(lower).not.toMatch(/\bword count\b/);
  });

  it('does not contain forbidden "scrape" or "crawl"', () => {
    const lower = CLOSING_SUMMARY_SYSTEM_PROMPT.toLowerCase();
    expect(lower).not.toMatch(/\bscrape\b/);
    expect(lower).not.toMatch(/\bcrawl\b/);
  });

  it('is at least 1500 characters long — engineered, not a stub', () => {
    expect(CLOSING_SUMMARY_SYSTEM_PROMPT.length).toBeGreaterThan(1500);
  });

  it('content matches snapshot — locks the engineered prompt against drift', () => {
    expect(CLOSING_SUMMARY_SYSTEM_PROMPT).toMatchSnapshot();
  });
});
