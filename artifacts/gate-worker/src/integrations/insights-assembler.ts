/**
 * Custom Insights assembly (F3 PRD §7).
 *
 * Builds the free-prose block that goes into SEOwind's "Your Insights and
 * Instructions" textarea from Hassan's confirmed interview answers, his
 * follow-up answers, and the confirmed corpus evidence chunks.
 *
 * This module is pure: the caller (`draft-generator.ts`, a later slice) loads
 * the interview session + `capture_signals` rows and categorises them into the
 * typed inputs below. Keeping categorisation in the caller avoids guessing
 * content types here and keeps assembly deterministic and testable.
 *
 * Priority order (PRD §7 "Character Limit"): confirmed answers first, then
 * follow-up answers, then evidence chunks in captured-at DESC order. The block
 * greedy-fills in that order until the next segment would exceed the cap, then
 * stops and appends a truncation marker.
 */

import type { GateAFailure } from '../gates/stage-a.js';

/**
 * SEOwind's "Your Insights and Instructions" textarea hard cap. The live UI
 * limit is 20,000 characters (confirmed by Hassan against the running app).
 * NOTE: PRD §7 still records the earlier 15,000 figure and needs a docs update.
 */
export const MAX_INSIGHTS_CHARS = 20_000;

/** A confirmed corpus evidence chunk (from `capture_signals`). */
export interface EvidenceChunk {
  /** Redacted corpus text (`capture_signals.redacted_text`). */
  text: string;
  /** When the signal was captured (`capture_signals.captured_at`). */
  capturedAt: Date;
}

export interface InsightsInput {
  /** Hassan's confirmed interview answers — highest priority. */
  confirmedAnswers: string[];
  /** Hassan's follow-up answers — next priority. */
  followUpAnswers: string[];
  /** Confirmed corpus evidence; sorted captured-at DESC during assembly. */
  evidenceChunks: EvidenceChunk[];
  /**
   * Optional per-brief tone instruction, appended at the end of the block as a
   * plain instruction (PRD §7 "Format Requirements").
   */
  toneInstruction?: string;
  /**
   * Optional rewrite-correction prefix (from `buildCorrectionPrefix`),
   * prepended ahead of the expertise on a rewrite attempt (PRD §7).
   */
  correctionPrefix?: string;
}

export interface InsightsResult {
  /** The assembled insights text, ready for the SEOwind textarea. */
  text: string;
  /** True when one or more segments did not fit under the cap. */
  truncated: boolean;
  /** Count of priority segments dropped because of the cap. */
  omittedChunks: number;
}

const SEGMENT_SEPARATOR = '\n\n';

/**
 * Conservative upper bound for the truncation marker (plus its leading
 * separator). Reserved out of the budget before filling, so the assembled
 * text — body plus marker — always stays within the cap.
 */
const MARKER_RESERVE = 80;

function greedyFill(
  segments: string[],
  budget: number,
): { kept: string[]; omitted: number } {
  const kept: string[] = [];
  let used = 0;
  let omitted = 0;
  for (const segment of segments) {
    const addition =
      kept.length === 0
        ? segment.length
        : SEGMENT_SEPARATOR.length + segment.length;
    if (used + addition <= budget) {
      kept.push(segment);
      used += addition;
    } else {
      omitted += 1;
    }
  }
  return { kept, omitted };
}

/**
 * Cut `text` down to at most `max` chars, preferring a sentence boundary and
 * falling back to a word boundary so the result reads as clean prose.
 */
function truncateAtBoundary(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSentence = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
  );
  if (lastSentence > max * 0.5) {
    return slice.slice(0, lastSentence + 1).trimEnd();
  }
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > 0) return slice.slice(0, lastSpace).trimEnd();
  return slice.trimEnd();
}

/**
 * Build the "CORRECTION INSTRUCTIONS" prefix prepended to a rewrite attempt's
 * insights (PRD §7 "Rewrite Attempt Corrections").
 */
export function buildCorrectionPrefix(failures: GateAFailure[]): string {
  const lines = [
    'CORRECTION INSTRUCTIONS FOR THIS DRAFT:',
    ...failures.map(
      (f) =>
        `- Rule ${f.ruleId}: Replace "${f.quotedViolation}" in ${f.location}. ${f.instruction}`,
    ),
    '',
    'EXPERTISE AND CONTEXT:',
  ];
  return lines.join('\n');
}

/**
 * Assemble the Insights and Instructions text from the categorised inputs,
 * greedy-filling priority segments under `maxChars` and appending a truncation
 * marker when segments are dropped.
 */
export function assembleInsightsText(
  input: InsightsInput,
  maxChars: number = MAX_INSIGHTS_CHARS,
): InsightsResult {
  const correction = input.correctionPrefix?.trim() ?? '';
  const tone = input.toneInstruction?.trim() ?? '';
  const prefix = correction.length > 0 ? correction + SEGMENT_SEPARATOR : '';
  const suffix = tone.length > 0 ? SEGMENT_SEPARATOR + tone : '';

  const sortedEvidence = [...input.evidenceChunks].sort(
    (a, b) => b.capturedAt.getTime() - a.capturedAt.getTime(),
  );
  const segments = [
    ...input.confirmedAnswers,
    ...input.followUpAnswers,
    ...sortedEvidence.map((c) => c.text),
  ]
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const bodyBudget = Math.max(0, maxChars - prefix.length - suffix.length);

  // First pass against the full budget: if everything fits, no marker is
  // needed and we keep the whole body.
  const fullFill = greedyFill(segments, bodyBudget);
  if (fullFill.omitted === 0) {
    const body = fullFill.kept.join(SEGMENT_SEPARATOR);
    return { text: prefix + body + suffix, truncated: false, omittedChunks: 0 };
  }

  // Truncation will happen: reserve room for the marker and refill so that
  // body + marker stays within the cap.
  const reserved = Math.max(0, bodyBudget - MARKER_RESERVE);
  const reservedFill = greedyFill(segments, reserved);
  let body = reservedFill.kept.join(SEGMENT_SEPARATOR);
  let keptCount = reservedFill.kept.length;
  let contentTruncated = false;

  // Nothing fit whole but there is content and room: include a hard-truncated
  // first segment so the brief is never empty.
  const first = segments[0];
  if (keptCount === 0 && first !== undefined && reserved > 0) {
    body = truncateAtBoundary(first, reserved);
    keptCount = 1;
    contentTruncated = true;
  }

  // omittedChunks counts whole segments dropped — not partial truncation of an
  // included segment.
  const omitted = segments.length - keptCount;

  let marker = '';
  if (omitted > 0) {
    const noun = omitted === 1 ? 'segment' : 'segments';
    marker = `${SEGMENT_SEPARATOR}… [truncated: ${omitted} additional ${noun} omitted]`;
  } else if (contentTruncated) {
    marker = `${SEGMENT_SEPARATOR}… [truncated to fit]`;
  }

  // Final safety net: in pathological cases (cap smaller than the marker), make
  // sure the result never exceeds the cap.
  let text = prefix + body + marker + suffix;
  if (text.length > maxChars) {
    text = text.slice(0, maxChars);
  }

  return { text, truncated: true, omittedChunks: omitted };
}
