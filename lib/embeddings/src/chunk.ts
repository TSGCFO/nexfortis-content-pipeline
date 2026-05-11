/**
 * Token-aware chunking for `text-embedding-3-large`.
 *
 * Defaults: `targetTokens = 650` (midpoint of the §7.3-recommended 500–800
 * range), `overlapTokens = 100`. Uses the `o200k_base` tiktoken encoding,
 * the encoding `text-embedding-3-large` uses for token counting.
 *
 * Algorithm: a sliding window over the token stream of the input. When the
 * default end of a window falls inside the input, the chunker tries to snap
 * it back/forward to a sentence boundary that falls inside
 * `[start + (target - overlap), start + maxTokens]`, picking the boundary
 * closest to `start + target`. If no sentence boundary fits the window
 * (i.e. one sentence is bigger than `target`), the chunker falls back to a
 * mid-sentence split exactly at `start + target`.
 *
 * Adjacent chunks share exactly `overlapTokens` tokens — `chunks[i+1]`
 * starts at `chunks[i].endTokenOffset - overlapTokens`.
 */

import { get_encoding, type Tiktoken } from 'tiktoken';

import type { Chunk } from './types.js';

export interface ChunkOptions {
  targetTokens?: number;
  overlapTokens?: number;
  /**
   * Hard upper bound on the size of a single chunk in tokens. Defaults to
   * 800 (the upper bound of the §7.3 range). The chunker never emits a chunk
   * with more than this many tokens unless `targetTokens > maxTokens`.
   */
  maxTokens?: number;
}

const DEFAULT_TARGET_TOKENS = 650;
const DEFAULT_OVERLAP_TOKENS = 100;
const DEFAULT_MAX_TOKENS = 800;

// Sentence terminators (run of `.`, `!`, `?`) or one or more newlines.
// We deliberately do NOT require trailing whitespace in this regex — the
// space following a period is usually merged into the FIRST token of the
// next sentence by BPE, so the only token-aligned split point is right
// after the terminator itself.
const SENTENCE_TERMINATOR_RE = /[.!?]+|[\n\r]+/g;

const utf8Decoder = new TextDecoder('utf-8');
const utf8Encoder = new TextEncoder();

function decodeTokens(enc: Tiktoken, tokens: Uint32Array): string {
  return utf8Decoder.decode(enc.decode(tokens));
}

/**
 * Find token-index boundaries where a sentence terminator ends and the
 * boundary aligns with an actual token boundary.
 *
 * Algorithm:
 *  1. Decode each token to its raw bytes; track the cumulative byte length
 *     after each token (`tokenCumBytes[i]` = bytes covered by `tokens[0..=i]`).
 *  2. Find the byte position of every sentence terminator in the source
 *     text via regex + UTF-8 encoding of the prefix.
 *  3. For each such byte position, look up whether it equals some
 *     `tokenCumBytes[i]`. If yes, the slice `tokens[0..i+1]` decodes to a
 *     prefix of `text` that ends exactly at that terminator — a clean
 *     splitting point.
 *
 * Boundaries that fall inside a token (rare for ASCII, can happen for tokens
 * that absorb both the terminator and following whitespace) are silently
 * dropped — the caller falls back to the default mid-sentence split.
 */
function findSentenceBoundaryTokenIndices(
  text: string,
  enc: Tiktoken,
  tokens: Uint32Array,
): number[] {
  const tokenCumBytes = new Uint32Array(tokens.length);
  let acc = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const b = enc.decode_single_token_bytes(tokens[i]!);
    acc += b.length;
    tokenCumBytes[i] = acc;
  }

  const charBoundaries: number[] = [];
  SENTENCE_TERMINATOR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SENTENCE_TERMINATOR_RE.exec(text)) !== null) {
    charBoundaries.push(match.index + match[0].length);
  }
  if (charBoundaries.length === 0) return [];

  const result: number[] = [];
  for (const charPos of charBoundaries) {
    if (charPos >= text.length) continue;
    const prefix = text.slice(0, charPos);
    const bytePos = utf8Encoder.encode(prefix).length;
    // Binary search for `bytePos` in `tokenCumBytes`.
    let lo = 0;
    let hi = tokenCumBytes.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (tokenCumBytes[mid]! < bytePos) lo = mid + 1;
      else hi = mid;
    }
    if (lo < tokenCumBytes.length && tokenCumBytes[lo] === bytePos) {
      // Slice `tokens[0..lo+1]` decodes to bytes 0..bytePos.
      result.push(lo + 1);
    }
  }

  // Deduplicate and sort ascending.
  return Array.from(new Set(result)).sort((a, b) => a - b);
}

function pickBoundary(
  candidates: number[],
  minEnd: number,
  maxEnd: number,
  preferred: number,
): number | null {
  let best: number | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    if (c < minEnd || c > maxEnd) continue;
    const dist = Math.abs(c - preferred);
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}

export function chunk(text: string, opts?: ChunkOptions): Chunk[] {
  if (text === '') return [];

  const target = opts?.targetTokens ?? DEFAULT_TARGET_TOKENS;
  const overlap = opts?.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;
  const maxTokens = opts?.maxTokens ?? DEFAULT_MAX_TOKENS;

  if (target <= 0) {
    throw new Error('chunk: targetTokens must be positive');
  }
  if (overlap < 0 || overlap >= target) {
    throw new Error('chunk: overlapTokens must be in [0, targetTokens)');
  }
  if (maxTokens < target) {
    throw new Error('chunk: maxTokens must be >= targetTokens');
  }

  const enc = get_encoding('o200k_base');
  try {
    const tokens = enc.encode(text);
    const total = tokens.length;

    if (total === 0) return [];
    if (total <= target) {
      return [
        {
          text: decodeTokens(enc, tokens),
          tokenCount: total,
          startTokenOffset: 0,
          endTokenOffset: total,
        },
      ];
    }

    const sentenceBoundaries = findSentenceBoundaryTokenIndices(text, enc, tokens);

    const chunks: Chunk[] = [];
    let start = 0;
    while (start < total) {
      const remaining = total - start;
      let end: number;

      if (remaining <= maxTokens) {
        // Final chunk: take everything left to avoid losing trailing content.
        end = total;
      } else {
        const preferredEnd = start + target;
        const minEnd = start + (target - overlap);
        const maxEnd = start + maxTokens;
        const snapped = pickBoundary(
          sentenceBoundaries,
          minEnd,
          maxEnd,
          preferredEnd,
        );
        end = snapped ?? preferredEnd;
      }

      const slice = tokens.slice(start, end);
      chunks.push({
        text: decodeTokens(enc, slice),
        tokenCount: end - start,
        startTokenOffset: start,
        endTokenOffset: end,
      });

      if (end >= total) break;
      // Next chunk overlaps the last `overlap` tokens of this chunk exactly.
      start = end - overlap;
    }

    return chunks;
  } finally {
    enc.free();
  }
}
