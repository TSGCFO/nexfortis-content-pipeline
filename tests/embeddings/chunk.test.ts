import { describe, expect, it } from 'vitest';

import { chunk } from '../../lib/embeddings/src/chunk.js';

const TARGET = 650;
const OVERLAP = 100;
const MAX = 800;

/**
 * Build a long, sentence-free token stream by repeating ` word`. In the
 * `o200k_base` encoding ` word` (with a leading space) is one token, so this
 * yields a deterministic-length token stream. We trim the leading space so
 * the resulting string starts at a word boundary; the resulting token count
 * is therefore exactly `n`.
 */
function buildTokenStream(n: number): string {
  return ' word'.repeat(n).trimStart();
}

/**
 * Count tokens by running `chunk()` with a very large `targetTokens` so the
 * whole input collapses into one chunk and we can read `tokenCount`.
 *
 * We deliberately do NOT import `tiktoken` directly in the test suite — it
 * is a sub-dependency of `@ncp/embeddings` and is not hoisted to the
 * workspace root.
 */
function tokenCount(text: string): number {
  if (text === '') return 0;
  const result = chunk(text, { targetTokens: 100_000, overlapTokens: 0, maxTokens: 100_000 });
  if (result.length !== 1) {
    throw new Error(`tokenCount helper: expected 1 chunk, got ${result.length}`);
  }
  return result[0]!.tokenCount;
}

describe('chunk()', () => {
  it('returns [] for an empty string', () => {
    expect(chunk('')).toEqual([]);
  });

  it('returns a single chunk when text is shorter than targetTokens', () => {
    const text = 'This is a short input that fits in one chunk.';
    const result = chunk(text);
    expect(result).toHaveLength(1);
    const only = result[0]!;
    expect(only.text).toBe(text);
    expect(only.startTokenOffset).toBe(0);
    expect(only.endTokenOffset).toBe(only.tokenCount);
    expect(only.tokenCount).toBe(tokenCount(text));
    expect(only.tokenCount).toBeLessThanOrEqual(TARGET);
  });

  it('splits a long sentence-free input into chunks each within [target - overlap, max]', () => {
    // 2200 tokens => with target=650, overlap=100, step=550:
    //   chunks: [0,650], [550,1200], [1100,1750], [1650,2200] — last chunk is 550 tokens.
    const text = buildTokenStream(2200);
    expect(tokenCount(text)).toBe(2200);

    const result = chunk(text);
    expect(result.length).toBeGreaterThan(1);

    for (const c of result) {
      expect(c.tokenCount).toBeGreaterThanOrEqual(TARGET - OVERLAP); // 550
      expect(c.tokenCount).toBeLessThanOrEqual(MAX); // 800
      expect(c.endTokenOffset - c.startTokenOffset).toBe(c.tokenCount);
    }

    // Coverage: union of chunk token-ranges spans the whole input.
    expect(result[0]!.startTokenOffset).toBe(0);
    expect(result[result.length - 1]!.endTokenOffset).toBe(2200);
  });

  it('produces adjacent chunks that share exactly overlapTokens tokens', () => {
    const text = buildTokenStream(2200);
    const result = chunk(text);
    expect(result.length).toBeGreaterThan(1);

    for (let i = 0; i < result.length - 1; i += 1) {
      const cur = result[i]!;
      const next = result[i + 1]!;

      // (1) Token-offset invariant: next.start = current.end - overlap.
      expect(next.startTokenOffset).toBe(cur.endTokenOffset - OVERLAP);

      // (2) Content invariant: the last `overlapTokens` worth of text in
      //     `cur` (re-tokenized via a single-chunk pass) is identical to
      //     the first `overlapTokens` of `next`. We verify this by using
      //     `chunk()` itself to re-tokenize the slice and reading offsets.
      //
      //     Because the source is " word"-only (1 token = 5 chars after the
      //     first), the last `OVERLAP` tokens correspond to the last
      //     `OVERLAP * 5` characters; we can compare directly.
      const tail = cur.text.slice(-OVERLAP * 5);
      const head = next.text.slice(0, OVERLAP * 5);
      expect(head).toBe(tail);
    }
  });

  it('prefers sentence boundaries when chunking a paragraph with clear ". " splits', () => {
    // Build a sequence of sentences whose total token count is large enough
    // to require multiple chunks. Each sentence ends with ". " so the
    // chunker should snap to those boundaries.
    const sentence = 'The quick brown fox jumps over the lazy dog repeatedly. ';
    // ~12 tokens per sentence; need ~2200 tokens => ~190 sentences.
    const text = sentence.repeat(190).trimEnd();
    const total = tokenCount(text);
    expect(total).toBeGreaterThan(TARGET);

    const result = chunk(text);
    expect(result.length).toBeGreaterThan(1);

    // Each non-final chunk should end on a sentence terminator (i.e. its
    // text ends with ". " or ".") because such boundaries are abundant
    // inside the snap window [target - overlap, max] = [550, 800].
    for (let i = 0; i < result.length - 1; i += 1) {
      const c = result[i]!;
      // The chunker decodes token slices, so trailing whitespace from " "
      // after the period is preserved.
      expect(/[.!?]\s*$/.test(c.text)).toBe(true);
    }
  });

  it('falls back to a mid-sentence split when a single sentence exceeds targetTokens', () => {
    // A single "sentence": 2000 ` word` tokens with no terminator until the end.
    const oneLongSentence = `${buildTokenStream(2000)}.`;
    const total = tokenCount(oneLongSentence);
    expect(total).toBeGreaterThan(TARGET);

    const result = chunk(oneLongSentence);
    expect(result.length).toBeGreaterThan(1);

    // The first chunk's end is forced to the mid-sentence default
    // (start + target = 650) because there is no sentence boundary in
    // [550, 800]. We don't pin to exactly 650 in case tiktoken merges differ
    // slightly across versions, but the chunk MUST be well under `max` and
    // MUST not end on a sentence terminator (because there isn't one).
    const first = result[0]!;
    expect(first.tokenCount).toBeLessThanOrEqual(MAX);
    expect(first.tokenCount).toBeGreaterThanOrEqual(TARGET - OVERLAP);
    expect(/[.!?]\s*$/.test(first.text)).toBe(false);
  });
});
