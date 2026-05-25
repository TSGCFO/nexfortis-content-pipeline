/**
 * Post-generation quality gate for confirmation questions (PRD §7.2).
 *
 * Three checks, evaluated in order so multi-failure responses can report
 * every reason at once (so the regenerate-once retry instruction can hint
 * at all the things to fix):
 *
 *   1. `word_count`              — question_text.trim().split(/\s+/).length ≤ 80
 *   2. `no_specifics`            — detected_specifics is non-empty
 *   3. `hallucinated_specific`   — at least one detected specific appears
 *                                  (case-insensitive substring) in the
 *                                  signal's redacted_text — guards against
 *                                  Claude inventing "specifics" that the
 *                                  corpus doesn't contain. Skipped when
 *                                  check 2 has already failed (specific
 *                                  hallucination is moot if there were no
 *                                  specifics to begin with).
 *   4. `generic_phrase`          — question_text does NOT contain any of
 *                                  the three banned generic openers
 *                                  (case-insensitive)
 *
 * Pure. No I/O. Deterministic.
 *
 * `no_specifics === true` responses from Claude are handled UPSTREAM by
 * `generateQuestion` (it returns `{ ok: false, reason: 'no_specifics' }`
 * before the gate ever runs), so this function never sees them.
 */

import type { SelectedSignal } from '../../lib/select-signals-for-cluster.js';
import type {
  QualityGateFailure,
  QualityGateResult,
  QuestionResponse,
} from './types.js';

/**
 * Generic openers Claude is forbidden from using. Lower-case for the
 * case-insensitive `.includes` check.
 */
const BANNED_PHRASES: readonly string[] = [
  'what did you work on this week',
  'tell me about your week',
  'anything interesting',
];

export const MAX_WORDS = 80;

export interface QualityGateInput {
  question: QuestionResponse;
  signal: SelectedSignal;
  /** Currently unused but accepted for API symmetry with the generator. */
  primaryKeyword: string;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  return trimmed.split(/\s+/).filter((w) => w.length > 0).length;
}

function anySpecificAppearsInRedactedText(
  specifics: readonly string[],
  redactedText: string,
): boolean {
  const haystack = redactedText.toLowerCase();
  for (const s of specifics) {
    if (typeof s !== 'string' || s.length === 0) continue;
    if (haystack.includes(s.toLowerCase())) {
      return true;
    }
  }
  return false;
}

function containsBannedPhrase(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.some((p) => lower.includes(p));
}

export function qualityGate(input: QualityGateInput): QualityGateResult {
  const failures: QualityGateFailure[] = [];

  // Check 1: word count
  if (countWords(input.question.question_text) > MAX_WORDS) {
    failures.push('word_count');
  }

  // Check 2: at least one specific
  const noSpecifics = input.question.detected_specifics.length === 0;
  if (noSpecifics) {
    failures.push('no_specifics');
  } else if (
    // Check 3: specifics must actually appear in the signal (skip when
    // check 2 already failed — moot)
    !anySpecificAppearsInRedactedText(
      input.question.detected_specifics,
      input.signal.redactedText,
    )
  ) {
    failures.push('hallucinated_specific');
  }

  // Check 4: banned generic phrases
  if (containsBannedPhrase(input.question.question_text)) {
    failures.push('generic_phrase');
  }

  if (failures.length === 0) {
    return { ok: true };
  }
  return { ok: false, failures };
}
