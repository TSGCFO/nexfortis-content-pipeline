/**
 * Structural assertions on the engineered `SYSTEM_PROMPT` for the
 * confirmation-question generator. These are intentionally separate from
 * `generate-question.test.ts` so the prompt-content contract is visible
 * at a glance — anyone editing the prompt sees these tests break first.
 *
 * What we assert:
 *   - ≥3 worked positive examples (each with SIGNAL and a GOOD QUESTION)
 *   - ≥2 worked negative examples (each with SIGNAL, BAD QUESTION, and
 *     WHY IT FAILS)
 *   - A clearly labelled `NO_SPECIFICS` section
 *   - Voice calibration mentions the four tools Hassan actually uses
 *     (Claude, Perplexity, Outlook, Microsoft Teams)
 *   - None of the banned phrases ("please", "kindly", "as an AI")
 *     anywhere in the prompt
 *   - None of the words this repo forbids in code/comments/text
 *     ("scrape", "crawl")
 *   - The prompt does NOT mention the choice buttons, the JSON schema,
 *     "return JSON", or the model name — those are constraints the
 *     engineering brief calls out explicitly
 *
 * The point of these tests is structural — they catch accidental
 * regressions ("oh I'll just simplify this prompt") without locking the
 * exact wording (the snapshot test in `generate-question.test.ts` does
 * that). Together they let small edits flow but loud refactors fail
 * loudly.
 */

import { describe, expect, it } from 'vitest';

import { SYSTEM_PROMPT } from '../../../artifacts/telegram-bot/src/jobs/interview-session/generate-question.js';

describe('SYSTEM_PROMPT — structural contract', () => {
  // ---------------------------------------------------------------------
  // Positive examples
  // ---------------------------------------------------------------------

  it('contains at least 3 worked positive examples (labelled "Positive example N")', () => {
    const matches = SYSTEM_PROMPT.match(/Positive example \d/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  it('every positive example block contains both a SIGNAL and a GOOD QUESTION', () => {
    const blocks = SYSTEM_PROMPT.split(/Positive example \d[^\n]*\n-+/).slice(1);
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    for (const block of blocks) {
      // Only consider the block up to the next section divider so
      // assertions don't leak across sections.
      const section = block.split(/\n[A-Z][^\n]*\n-+\n/)[0] ?? block;
      expect(section).toMatch(/SIGNAL[^\n]*:/);
      expect(section).toMatch(/GOOD QUESTION:/);
    }
  });

  it('positive examples cover the three source types named in the engineering brief', () => {
    expect(SYSTEM_PROMPT).toMatch(/Microsoft Graph email/i);
    expect(SYSTEM_PROMPT).toMatch(/Claude session/i);
    expect(SYSTEM_PROMPT).toMatch(/Microsoft Teams/i);
  });

  // ---------------------------------------------------------------------
  // Negative examples
  // ---------------------------------------------------------------------

  it('contains at least 2 worked negative examples (labelled "Bad example N")', () => {
    const matches = SYSTEM_PROMPT.match(/Bad example \d/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('every negative example block contains a SIGNAL, a BAD QUESTION, and a WHY IT FAILS', () => {
    const blocks = SYSTEM_PROMPT.split(/Bad example \d[^\n]*\n-+/).slice(1);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    for (const block of blocks) {
      const section = block.split(/\n[A-Z][^\n]*\n-+\n/)[0] ?? block;
      expect(section).toMatch(/SIGNAL:/);
      expect(section).toMatch(/BAD QUESTION:/);
      expect(section).toMatch(/WHY IT FAILS:/);
    }
  });

  it('negative examples cover the two failure modes named in the engineering brief', () => {
    // Mode 1: generic opener
    expect(SYSTEM_PROMPT).toMatch(/generic opener/i);
    // Mode 2: asking for new information instead of confirming existing
    expect(SYSTEM_PROMPT).toMatch(/asking for new information/i);
  });

  // ---------------------------------------------------------------------
  // NO_SPECIFICS branch
  // ---------------------------------------------------------------------

  it('has a clearly labelled NO_SPECIFICS branch section', () => {
    expect(SYSTEM_PROMPT).toMatch(/^NO_SPECIFICS branch$/m);
  });

  it('the NO_SPECIFICS branch names the sentinel string "NO_SPECIFICS" and the no_specifics flag', () => {
    expect(SYSTEM_PROMPT).toContain('"NO_SPECIFICS"');
    expect(SYSTEM_PROMPT).toContain('no_specifics: true');
  });

  // ---------------------------------------------------------------------
  // Voice calibration
  // ---------------------------------------------------------------------

  it('mentions the four tools Hassan used during the week', () => {
    expect(SYSTEM_PROMPT).toMatch(/\bClaude\b/);
    expect(SYSTEM_PROMPT).toMatch(/\bPerplexity\b/);
    expect(SYSTEM_PROMPT).toMatch(/\bOutlook\b/);
    expect(SYSTEM_PROMPT).toMatch(/Microsoft Teams/);
  });

  it('mentions Hassan, NexFortis, and that he is in Ontario (voice grounding)', () => {
    expect(SYSTEM_PROMPT).toMatch(/Hassan/);
    expect(SYSTEM_PROMPT).toMatch(/NexFortis/);
    expect(SYSTEM_PROMPT).toMatch(/Ontario/);
  });

  it('has an explicit Voice section', () => {
    expect(SYSTEM_PROMPT).toMatch(/^Voice$/m);
  });

  it('has a chain-of-thought section that tells the model to identify before writing', () => {
    expect(SYSTEM_PROMPT).toMatch(/How to think before writing/);
    expect(SYSTEM_PROMPT).toMatch(/Then write the question\./);
  });

  it('has a Target shape section that anchors the question format', () => {
    expect(SYSTEM_PROMPT).toMatch(/^Target shape$/m);
    expect(SYSTEM_PROMPT).toMatch(/day\/time anchor/i);
    expect(SYSTEM_PROMPT).toMatch(/primary_keyword/);
  });

  // ---------------------------------------------------------------------
  // Banned phrases — voice grates
  // ---------------------------------------------------------------------

  it('contains none of the banned softener phrases', () => {
    const lower = SYSTEM_PROMPT.toLowerCase();
    // Word-boundary matches so we don't false-positive on substrings like
    // "asplease" (not a real word, but defensive).
    expect(lower).not.toMatch(/\bplease\b/);
    expect(lower).not.toMatch(/\bkindly\b/);
    expect(lower).not.toMatch(/\bas an ai\b/);
  });

  // ---------------------------------------------------------------------
  // Banned vocabulary — repo-wide rule
  // ---------------------------------------------------------------------

  it('does not contain the forbidden words "scrape" or "crawl"', () => {
    const lower = SYSTEM_PROMPT.toLowerCase();
    expect(lower).not.toMatch(/\bscrape\b/);
    expect(lower).not.toMatch(/\bcrawl\b/);
  });

  // ---------------------------------------------------------------------
  // Things the engineering brief says must NOT be in the prompt
  // ---------------------------------------------------------------------

  it('does not mention the choice buttons (rendered by buildConfirmationKeyboard)', () => {
    const lower = SYSTEM_PROMPT.toLowerCase();
    expect(lower).not.toMatch(/yes,?\s*use it/);
    expect(lower).not.toMatch(/anonymize client/);
    expect(lower).not.toMatch(/skip this one/);
  });

  it('does not instruct the model to "return JSON" (output_config.format handles that)', () => {
    expect(SYSTEM_PROMPT).not.toMatch(/return JSON/i);
    expect(SYSTEM_PROMPT).not.toMatch(/JSON schema/i);
  });

  it('does not reference the model name or break the fourth wall', () => {
    expect(SYSTEM_PROMPT).not.toMatch(/claude-opus/i);
    expect(SYSTEM_PROMPT).not.toMatch(/\bas a model\b/i);
    expect(SYSTEM_PROMPT).not.toMatch(/\bas a language model\b/i);
  });

  it('does not mention HTML escaping or Telegram markup', () => {
    expect(SYSTEM_PROMPT).not.toMatch(/HTML/);
    expect(SYSTEM_PROMPT).not.toMatch(/parse_mode/);
    expect(SYSTEM_PROMPT).not.toMatch(/markdown/i);
  });
});
