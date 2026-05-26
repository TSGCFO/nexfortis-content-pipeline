/**
 * SERP-gap coverage heuristic for the PR 3 follow-up loop (PRD §4.4).
 *
 * Given an `article_candidates.serp_gaps` array (a `string[]` of gap
 * topics surfaced from SEOwind brief previews) and the set of
 * `capture_signals` Hassan confirmed in the confirmation loop, returns
 * the subset of gaps that are NOT plausibly addressed by the confirmed
 * signals.
 *
 * Heuristic — deliberately simple (PRD calls this out as a v2.1
 * sophistication candidate):
 *
 *   for each gap:
 *     tokens = tokenize(gap)            -- lowercase, /\s+/, drop stop words
 *     if any non-stop-word token appears (case-insensitive substring)
 *        in ANY confirmed signal's redacted_text -> covered
 *
 * Substring (not whole-word) match is intentional: gap "intune
 * compliance policy" should be covered by signal "Intune Compliance
 * Policy v3", and "v3" shouldn't matter to the comparison. Stop words
 * filter prevents trivial matches on "the" / "of" / etc.
 *
 * TODO(v2.1): replace this with embedding-cosine coverage once the
 * synthesis worker stores gap embeddings alongside the candidate row.
 * The naive heuristic is sufficient for "did Hassan already talk about
 * this?" inside a 3-5 signal cluster; it will under-cover (i.e., over-
 * trigger follow-ups) when gap and signal share a concept but no
 * literal token, which is the conservative direction for content
 * quality.
 *
 * Pure function. No I/O. Deterministic.
 */

/**
 * Conservative English stop-word list. Lower-case only. Kept short on
 * purpose — false-positive matches via "the" / "of" / "to" are the
 * primary risk; we don't need a full NLP list to defend against that.
 */
const STOP_WORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'been',
  'being',
  'but',
  'by',
  'for',
  'from',
  'how',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'was',
  'were',
  'when',
  'where',
  'will',
  'with',
]);

export interface SerpGapCandidate {
  serpGaps: readonly string[] | null;
}

export interface SerpGapSignal {
  redactedText: string;
}

/**
 * Tokenize a gap string for coverage comparison: lowercase, split on
 * whitespace, drop empties, drop stop words. Exported so tests can
 * pin its behaviour independently.
 */
export function tokenizeGap(gap: string): string[] {
  return gap
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !STOP_WORDS.has(t));
}

/**
 * Returns the subset of `candidate.serpGaps` not plausibly covered by
 * the confirmed signals. Order preserved from the input; deduplication
 * is NOT performed (the caller can dedupe / truncate as needed).
 *
 * Empty / null `serpGaps` yields `[]`. Zero confirmed signals yields
 * every gap (nothing is covered).
 */
export function computeUncoveredGaps(
  candidate: SerpGapCandidate,
  confirmedSignals: ReadonlyArray<SerpGapSignal>,
): string[] {
  const gaps = candidate.serpGaps;
  if (gaps === null || gaps === undefined || gaps.length === 0) {
    return [];
  }
  if (confirmedSignals.length === 0) {
    return [...gaps];
  }

  // Pre-lowercase haystacks once per signal — runtime O(gaps * signals * tokens).
  const haystacks: string[] = confirmedSignals.map((s) =>
    s.redactedText.toLowerCase(),
  );

  const uncovered: string[] = [];
  for (const gap of gaps) {
    const tokens = tokenizeGap(gap);
    if (tokens.length === 0) {
      // A gap that's entirely stop words can never be matched against a
      // signal — treat as uncovered (caller can decide whether to send).
      uncovered.push(gap);
      continue;
    }
    let covered = false;
    outer: for (const haystack of haystacks) {
      for (const token of tokens) {
        if (haystack.includes(token)) {
          covered = true;
          break outer;
        }
      }
    }
    if (!covered) {
      uncovered.push(gap);
    }
  }
  return uncovered;
}
