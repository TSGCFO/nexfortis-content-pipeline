/**
 * SEOwind brief assembly (F3 PRD §6).
 *
 * Builds the `SEOwindBriefPayload` — the structured brief that a later slice
 * hands to the (manual, for now) SEOwind flow and persists to
 * `drafts.seowind_brief`. This module is pure; the caller supplies the
 * already-assembled `insightsText` (see `insights-assembler.ts`) and the
 * candidate/keyword data.
 *
 * Hard constraints (PRD §6, §10.4, SC-02/SC-04, AC-F3-11/12):
 * - `enableCompanyDetails` is always `true` (toggled per brief).
 * - The payload NEVER carries a brand voice id or an API key — brand voice is
 *   project-level and UI-managed, and SEOwind has no API.
 */

/** Default brief location when the candidate carries no override (PRD §6). */
export const DEFAULT_LOCATION = 'United States';

/** Default brief language when the candidate carries no override (PRD §6). */
export const DEFAULT_LANGUAGE = 'English';

export interface SEOwindBriefPayload {
  /** Brief creation popup: focus keyword (`article_candidates.primary_keyword`). */
  focusKeyword: string;
  /** Target location; defaults to "United States". */
  location: string;
  /** Optional US state; omitted unless explicitly set. */
  usState?: string;
  /** Target language; defaults to "English". */
  language: string;
  /** SEOwind project id (`SEOWIND_PROJECT_ID`, pre-configured in the UI). */
  projectId: string;
  /** Assembled insights and instructions (see `insights-assembler.ts`). */
  insightsText: string;
  /** Always true — Company Details must be toggled on per brief. */
  enableCompanyDetails: boolean;
  /** Optional correction instructions carried on rewrite attempts. */
  correctionInstructions?: string;
}

export interface BriefAssemblyInput {
  /** `article_candidates.primary_keyword`. */
  primaryKeyword: string;
  /** SEOwind project id from the `SEOWIND_PROJECT_ID` env var. */
  projectId: string;
  /** Assembled insights text. */
  insightsText: string;
  /** Optional location override; falls back to DEFAULT_LOCATION. */
  location?: string;
  /** Optional language override; falls back to DEFAULT_LANGUAGE. */
  language?: string;
  /** Optional US state. */
  usState?: string;
  /** Optional correction instructions for a rewrite attempt. */
  correctionInstructions?: string;
}

/**
 * Build a `SEOwindBriefPayload` from the candidate/keyword data and the
 * pre-assembled insights text. Brand voice and API keys are intentionally
 * never set (PRD §6 "What is NOT in the payload").
 */
export function assembleBrief(input: BriefAssemblyInput): SEOwindBriefPayload {
  const location = input.location?.trim();
  const language = input.language?.trim();

  return {
    focusKeyword: input.primaryKeyword,
    location: location && location.length > 0 ? location : DEFAULT_LOCATION,
    language: language && language.length > 0 ? language : DEFAULT_LANGUAGE,
    projectId: input.projectId,
    insightsText: input.insightsText,
    enableCompanyDetails: true,
    ...(input.usState !== undefined ? { usState: input.usState } : {}),
    ...(input.correctionInstructions !== undefined
      ? { correctionInstructions: input.correctionInstructions }
      : {}),
  };
}
