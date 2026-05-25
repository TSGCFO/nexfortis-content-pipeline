/**
 * Question quality gate (PRD §7.2).
 *
 * Validates a Claude-generated confirmation question against three rules:
 *
 *   1. Word count ≤80. Counted via `text.trim().split(/\s+/).length`.
 *      Boundary: exactly 80 passes, 81 fails.
 *   2. At least one specific detected, AND every detected specific must
 *      appear (case-insensitive substring match) in the signal's
 *      `redacted_text`. This prevents Claude from inventing "specifics"
 *      that aren't actually in the corpus.
 *   3. No banned generic phrase. The list is conservative and matches the
 *      examples called out in the prompt + PRD.
 *
 * The gate accumulates failures rather than short-circuiting so the
 * regenerate-once retry has a useful failure context to feed back to
 * Claude. The `primaryKeyword` parameter is accepted for forward
 * compatibility (PR 3 may add an "explicitly references the keyword"
 * heuristic); PR 2 does not consult it.
 *
 * Pure function — no clock, no DB, no LLM.
 */

import type {
  GeneratedQuestion,
  QualityGateFailure,
  QualityGateResult,
  SignalForInterview,
} from './types.js';

/** Phrases that, if present (case-insensitive), instantly fail the gate. */
const BANNED_GENERIC_PHRASES: readonly string[] = [
  'what did you work on this week',
  'tell me about your week',
  'anything interesting',
];

const MAX_WORDS = 80;

export interface QualityGateInput {
  question: GeneratedQuestion;
  signal: Pick<SignalForInterview, 'redactedText'>;
  /** Primary keyword for the candidate. Accepted but not consulted in PR 2. */
  primaryKeyword: string;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

function containsAnyBannedPhrase(text: string): boolean {
  const lc = text.toLowerCase();
  for (const phrase of BANNED_GENERIC_PHRASES) {
    if (lc.includes(phrase)) return true;
  }
  return false;
}

export function checkQualityGate(input: QualityGateInput): QualityGateResult {
  const failures: QualityGateFailure[] = [];
  const text = input.question.questionText;

  if (countWords(text) > MAX_WORDS) {
    failures.push('word_count');
  }

  const specifics = input.question.detectedSpecifics;
  if (specifics.length === 0) {
    failures.push('no_specifics');
  } else {
    const corpusLc = input.signal.redactedText.toLowerCase();
    const anyMissing = specifics.some(
      (s) => !corpusLc.includes(s.toLowerCase()),
    );
    if (anyMissing) {
      failures.push('hallucinated_specific');
    }
  }

  if (containsAnyBannedPhrase(text)) {
    failures.push('generic_phrase');
  }

  // Reference primaryKeyword to silence noUnusedParameters concerns from
  // future strict configs without changing the public signature.
  void input.primaryKeyword;

  if (failures.length === 0) {
    return { ok: true };
  }
  return { ok: false, failures };
}
