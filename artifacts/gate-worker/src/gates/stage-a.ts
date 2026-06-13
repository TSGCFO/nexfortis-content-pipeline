/**
 * Stage A — Rule-Based Auto-Reject gate.
 *
 * Implements GA-01 through GA-08 from the F3 PRD §8.1 (SEOwind Drafting +
 * Multi-Stage Quality Gate). This is a pure, synchronous, deterministic rule
 * evaluator: given an extracted SEOwind draft and the corpus/interview context
 * it was built from, it returns either a pass or the first failing rule.
 *
 * Design notes:
 * - **Fail fast.** Rules are evaluated in GA-01 → GA-08 order; the first
 *   failure halts evaluation and is returned as the sole entry in `failures`
 *   (per PRD §8.1 and §12.2: "stop on first failure in MVP").
 * - **Pure and synchronous.** No DB, no network, no Playwright. The caller
 *   (`gate-runner.ts`, a later slice) is responsible for loading the draft and
 *   building the context from the `drafts` / `interview_sessions` /
 *   `capture_signals` rows, persisting the result, and notifying Hassan.
 * - **The gate-worker owns the precise `GateAFailure` schema.** The `drafts`
 *   table stores a deliberately permissive `{ rule, message, context? }` shape
 *   (see `lib/db/src/schema/drafts.ts`); mapping this rich failure onto that
 *   column happens in the persistence slice, not here.
 *
 * Two rules use documented heuristics that are expected to be calibrated
 * against real drafts per NFR-06 (monthly false-positive review):
 * - GA-01 (corpus citation count) uses a distinctive-token presence check
 *   (see `countCorpusCitations`).
 * - GA-07 (unsourced statistic) follows the spec's literal "≥ 4 digits" rule,
 *   which will also flag bare 4-digit years; see `checkUnsourcedStatistic`.
 */

export interface GateADraft {
  /** Full article text extracted from the SEOwind AI Editor. */
  draftText: string;
  /** Article title (SEOwind-generated). Checked by GA-04. */
  title: string;
  /** Author byline attached to the draft. Checked by GA-05. */
  byline: string;
  /** Author bio block attached to the draft. Checked by GA-06. */
  bioBlock: string;
}

/** A single confirmed corpus chunk that fed the SEOwind brief. */
export interface GateAConfirmedChunk {
  signalId: string;
  /** Redacted corpus text of the confirmed `capture_signals` row. */
  text: string;
}

/**
 * Everything Stage A needs that is derived from the interview session and the
 * confirmed corpus, assembled by the caller from `interview_sessions` +
 * `capture_signals`.
 */
export interface GateAContext {
  /** Confirmed corpus chunks (from `interview_sessions.confirmed_chunk_ids`). */
  confirmedChunks: GateAConfirmedChunk[];
  /**
   * Hassan's transcribed / typed interview answers — the raw words he
   * contributed as source material. Used by GA-03.
   */
  transcribedAnswers: string[];
}

export interface GateAFailure {
  ruleId: string;
  ruleName: string;
  /** Best-effort human location, e.g. "paragraph 3, sentence 2" or "title". */
  location: string;
  /** The exact text (or summary) that triggered the rule. */
  quotedViolation: string;
  /** Human-readable fix instruction, suitable for a rewrite correction. */
  instruction: string;
}

export interface GateAResult {
  passed: boolean;
  /** Empty when passed; exactly one entry when failed (fail-fast). */
  failures: GateAFailure[];
  evaluatedAt: string;
}

// --- Thresholds and blocklists (exported for tests + future calibration) ----

/** GA-05: the only acceptable byline. */
export const EXPECTED_BYLINE = 'Hassan Sadiq';

/** GA-01: minimum distinct confirmed chunks that must surface in the draft. */
export const MIN_CORPUS_CITATIONS = 2;

/** GA-03: minimum words of Hassan's own transcribed source material. */
export const MIN_TRANSCRIBED_WORDS = 100;

/** GA-07: a number with at least this many digits is a "statistic". */
export const UNSOURCED_STAT_MIN_DIGITS = 4;

/** GA-07: a source must appear within this many chars of the statistic. */
export const SOURCE_PROXIMITY_CHARS = 200;

/**
 * GA-02 generic phrase blocklist (PRD §8.1a, 30 entries). Stored lower-cased;
 * matching is case-insensitive substring (partial matches within longer
 * phrases count).
 */
export const GENERIC_PHRASE_BLOCKLIST: readonly string[] = Object.freeze([
  "in today's fast-paced digital world",
  'leveraging cutting-edge solutions',
  'businesses of all sizes',
  "in today's competitive landscape",
  "it's more important than ever",
  'in conclusion, it is clear that',
  'seamless integration',
  'end-to-end solution',
  'best-in-class',
  'robust and scalable',
  'game-changer',
  'transformative impact',
  'holistic approach',
  'synergy',
  'paradigm shift',
  'at the end of the day',
  'move the needle',
  'circle back',
  'low-hanging fruit',
  'drill down',
  'take it to the next level',
  'think outside the box',
  'on the same page',
  'going forward',
  'streamline your workflow',
  'empower your business',
  'unlock your potential',
  'in this day and age',
  'the bottom line is',
  'it goes without saying',
]);

/**
 * GA-04 clickbait title blocklist (PRD §8.1b). Case-insensitive, whole-word.
 * "best" is exempt when immediately followed by "practice".
 */
export const CLICKBAIT_TITLE_PATTERNS: ReadonlyArray<{
  label: string;
  regex: RegExp;
}> = Object.freeze([
  { label: 'Ultimate', regex: /\bultimate\b/i },
  { label: 'Complete', regex: /\bcomplete\b/i },
  { label: 'Shocking', regex: /\bshocking\b/i },
  { label: 'Best', regex: /\bbest\b(?!\s+practice)/i },
  { label: 'Top N', regex: /\btop\s+\d+\b/i },
  { label: 'Incredible', regex: /\bincredible\b/i },
  { label: 'Breathtaking', regex: /\bbreathtaking\b/i },
  { label: "You Won't Believe", regex: /\byou\s+won[’']?t\s+believe\b/i },
  { label: 'Amazing', regex: /\bamazing\b/i },
  { label: 'Stunning', regex: /\bstunning\b/i },
  { label: 'Must-Read', regex: /\bmust[-\s]?read\b/i },
  { label: 'Secret', regex: /\bsecret\b/i },
  { label: 'Hack', regex: /\bhack\b/i },
  { label: 'Trick', regex: /\btrick\b/i },
]);

/**
 * GA-08 first-person markers (PRD §8.1, GA-08). "I" is matched case-sensitively
 * (the pronoun, not a stray lower-case letter); the rest are case-insensitive.
 */
export const FIRST_PERSON_PATTERNS: readonly RegExp[] = Object.freeze([
  /\bI\b/,
  /\bwe\b/i,
  /\bmy client\b/i,
  /\bin my experience\b/i,
]);

/** GA-07: any of these near a statistic counts as a source attribution. */
export const ATTRIBUTION_CUES: readonly string[] = Object.freeze([
  'source',
  'according to',
  'per ',
  'study',
  'survey',
  'report',
  'research',
  'data from',
  'cited',
  'citation',
  'reference',
  'statista',
  'gartner',
  'forrester',
]);

const URL_REGEX = /(https?:\/\/|www\.)\S+/i;

/**
 * GA-01: common long words that are NOT distinctive enough to count as a
 * corpus citation even though they pass the length threshold.
 */
const NON_DISTINCTIVE_LONG_WORDS: ReadonlySet<string> = new Set([
  'because',
  'through',
  'however',
  'therefore',
  'although',
  'business',
  'businesses',
  'company',
  'companies',
  'customer',
  'customers',
  'service',
  'services',
  'solution',
  'solutions',
  'important',
  'different',
  'something',
  'everything',
  'available',
  'technology',
  'organization',
  'management',
]);

// --- Small text utilities ---------------------------------------------------

function alphanumericTokens(text: string): string[] {
  return text.match(/[A-Za-z0-9]+/g) ?? [];
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Best-effort mapping of a character offset in the draft to a human location
 * like "paragraph 3, sentence 2" (both 1-based). Paragraphs are blank-line
 * separated; sentences end at `.`, `!`, or `?`.
 */
function locateOffset(text: string, offset: number): string {
  const before = text.slice(0, Math.max(0, offset));
  const paragraphsBefore = before.split(/\n\s*\n/);
  const paragraphIndex = paragraphsBefore.length;
  const currentParagraph = paragraphsBefore[paragraphsBefore.length - 1] ?? '';
  const sentenceIndex = currentParagraph.split(/(?<=[.!?])\s+/).length;
  return `paragraph ${paragraphIndex}, sentence ${sentenceIndex}`;
}

/**
 * Extract the distinctive tokens from a corpus chunk — those most likely to
 * survive SEOwind's paraphrasing as a recognisable "citation":
 * - tokens containing a digit (error codes, versions, ports), length ≥ 3;
 * - all-caps acronyms (OHIP, QBO, RMM, MFA, GSC), length ≥ 3;
 * - long alphabetic words (length ≥ 7) that are not generic.
 *
 * Returned lower-cased for case-insensitive comparison.
 */
function distinctiveTokens(text: string): Set<string> {
  const result = new Set<string>();
  for (const token of alphanumericTokens(text)) {
    const lower = token.toLowerCase();
    const hasDigit = /\d/.test(token);
    const isAcronym =
      !hasDigit && token.length >= 3 && token === token.toUpperCase();
    const isLongWord =
      !hasDigit &&
      /^[A-Za-z]+$/.test(token) &&
      token.length >= 7 &&
      !NON_DISTINCTIVE_LONG_WORDS.has(lower);

    if ((hasDigit && token.length >= 3) || isAcronym || isLongWord) {
      result.add(lower);
    }
  }
  return result;
}

/**
 * GA-01 helper: count how many confirmed chunks have at least one distinctive
 * token present in the draft. This is a deterministic proxy for "the corpus
 * insights made it into the article"; it is expected to be calibrated against
 * real drafts (NFR-06).
 */
export function countCorpusCitations(
  draft: GateADraft,
  chunks: GateAConfirmedChunk[],
): number {
  const draftTokens = new Set(
    alphanumericTokens(draft.draftText).map((t) => t.toLowerCase()),
  );
  let cited = 0;
  for (const chunk of chunks) {
    const tokens = distinctiveTokens(chunk.text);
    let hit = false;
    for (const token of tokens) {
      if (draftTokens.has(token)) {
        hit = true;
        break;
      }
    }
    if (hit) cited += 1;
  }
  return cited;
}

// --- Individual rule evaluators (each returns a failure or null) ------------

function checkCorpusCitations(
  draft: GateADraft,
  context: GateAContext,
): GateAFailure | null {
  const count = countCorpusCitations(draft, context.confirmedChunks);
  if (count >= MIN_CORPUS_CITATIONS) return null;
  return {
    ruleId: 'GA-01',
    ruleName: 'Corpus Citation Count',
    location: 'whole draft',
    quotedViolation: `${count} corpus citations`,
    instruction: `Draft contains ${count} corpus citations; minimum is ${MIN_CORPUS_CITATIONS}. Confirm chunks were included in the SEOwind brief.`,
  };
}

function checkGenericPhrases(draft: GateADraft): GateAFailure | null {
  const lower = draft.draftText.toLowerCase();
  let earliest: { phrase: string; index: number } | null = null;
  for (const phrase of GENERIC_PHRASE_BLOCKLIST) {
    const index = lower.indexOf(phrase);
    if (index !== -1 && (earliest === null || index < earliest.index)) {
      earliest = { phrase, index };
    }
  }
  if (earliest === null) return null;
  return {
    ruleId: 'GA-02',
    ruleName: 'Generic Phrase Blocklist',
    location: locateOffset(draft.draftText, earliest.index),
    quotedViolation: draft.draftText.slice(
      earliest.index,
      earliest.index + earliest.phrase.length,
    ),
    instruction: `Generic phrase detected: '${earliest.phrase}'. Rewrite this section to be specific.`,
  };
}

function checkTranscribedWords(context: GateAContext): GateAFailure | null {
  const words = context.transcribedAnswers.reduce(
    (sum, answer) => sum + countWords(answer),
    0,
  );
  if (words >= MIN_TRANSCRIBED_WORDS) return null;
  return {
    ruleId: 'GA-03',
    ruleName: "Hassan's Transcribed Words",
    location: 'interview answers',
    quotedViolation: `${words} words`,
    instruction: `Only ${words} words from Hassan's interview were used as source material; minimum is ${MIN_TRANSCRIBED_WORDS}.`,
  };
}

function checkClickbaitTitle(draft: GateADraft): GateAFailure | null {
  for (const { label, regex } of CLICKBAIT_TITLE_PATTERNS) {
    const match = regex.exec(draft.title);
    if (match) {
      return {
        ruleId: 'GA-04',
        ruleName: 'Clickbait Title Words',
        location: 'title',
        quotedViolation: match[0],
        instruction: `Clickbait word in title: '${label}'. Rewrite title to be descriptive and accurate.`,
      };
    }
  }
  return null;
}

function checkByline(draft: GateADraft): GateAFailure | null {
  const byline = draft.byline.trim();
  if (byline.toLowerCase() === EXPECTED_BYLINE.toLowerCase()) return null;
  return {
    ruleId: 'GA-05',
    ruleName: 'Author Byline',
    location: 'byline',
    quotedViolation: byline.length > 0 ? byline : '(none)',
    instruction: `No author byline found or byline is not '${EXPECTED_BYLINE}'.`,
  };
}

function checkBio(draft: GateADraft): GateAFailure | null {
  if (draft.bioBlock.trim().length > 0) return null;
  return {
    ruleId: 'GA-06',
    ruleName: 'Author Bio Block',
    location: 'bio block',
    quotedViolation: '(empty)',
    instruction: 'Author bio block is missing.',
  };
}

function digitCount(token: string): number {
  return (token.match(/\d/g) ?? []).length;
}

function checkUnsourcedStatistic(draft: GateADraft): GateAFailure | null {
  const text = draft.draftText;
  // Standalone numbers only: the word boundaries keep digit runs embedded in
  // identifiers (error codes like AADSTS50158, versions like v2024) from being
  // mistaken for statistics.
  const numberRegex = /\b\d[\d,]*(?:\.\d+)?\b/g;
  for (const match of text.matchAll(numberRegex)) {
    const token = match[0];
    const index = match.index;
    if (index === undefined) continue;
    if (digitCount(token) < UNSOURCED_STAT_MIN_DIGITS) continue;

    const windowStart = Math.max(0, index - SOURCE_PROXIMITY_CHARS);
    const windowEnd = Math.min(
      text.length,
      index + token.length + SOURCE_PROXIMITY_CHARS,
    );
    const window = text.slice(windowStart, windowEnd);
    const windowLower = window.toLowerCase();

    const hasSource =
      URL_REGEX.test(window) ||
      ATTRIBUTION_CUES.some((cue) => windowLower.includes(cue));
    if (hasSource) continue;

    return {
      ruleId: 'GA-07',
      ruleName: 'Unsourced Statistic',
      location: locateOffset(text, index),
      quotedViolation: token,
      instruction: `Unsourced statistic: '${token}'. Add a source citation or remove the statistic.`,
    };
  }
  return null;
}

function checkEeatMarker(draft: GateADraft): GateAFailure | null {
  const hasMarker = FIRST_PERSON_PATTERNS.some((re) => re.test(draft.draftText));
  if (hasMarker) return null;
  return {
    ruleId: 'GA-08',
    ruleName: 'E-E-A-T Marker',
    location: 'whole draft',
    quotedViolation: '(no first-person language)',
    instruction:
      'Draft contains no E-E-A-T markers (no first-person experience language). SEOwind brief may not have included corpus insights.',
  };
}

/**
 * Run Stage A. Rules are evaluated in GA-01 → GA-08 order and the first
 * failure short-circuits the rest (fail-fast). A passing result has an empty
 * `failures` array.
 */
export function runGateA(
  draft: GateADraft,
  context: GateAContext,
): GateAResult {
  const evaluators: Array<() => GateAFailure | null> = [
    () => checkCorpusCitations(draft, context),
    () => checkGenericPhrases(draft),
    () => checkTranscribedWords(context),
    () => checkClickbaitTitle(draft),
    () => checkByline(draft),
    () => checkBio(draft),
    () => checkUnsourcedStatistic(draft),
    () => checkEeatMarker(draft),
  ];

  for (const evaluate of evaluators) {
    const failure = evaluate();
    if (failure) {
      return {
        passed: false,
        failures: [failure],
        evaluatedAt: new Date().toISOString(),
      };
    }
  }

  return { passed: true, failures: [], evaluatedAt: new Date().toISOString() };
}
