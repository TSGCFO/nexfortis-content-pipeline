# Feature PRD — SEOwind Drafting + Multi-Stage Quality Gate (F3)

**Document Owner:** Hassan Sadiq, NexFortis  
**Parent Epic:** [NexFortis Automated Content Pipeline v2](../epic-prd.md)  
**Depends On:** F1 (corpus + `article_candidates`), F2 (completed `interview_sessions` with confirmed chunks)  
**Status:** Production Spec — Ready for Implementation  
**Version:** 1.0  
**Created:** May 10, 2026  
**Audience:** Hassan Sadiq, Cursor agents / Claude Code (primary implementer), Computer (orchestrator), future contractors

---

## Table of Contents

1. [Goal](#1-goal)
2. [User Personas](#2-user-personas)
3. [User Stories](#3-user-stories)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Technical Specifications](#6-technical-specifications)
7. [AI System Requirements](#7-ai-system-requirements)
8. [Acceptance Criteria](#8-acceptance-criteria)
8b. [Shared Resources](#8b-shared-resources)
9. [Out of Scope](#9-out-of-scope)

---

## 1. Goal

### Problem

Even with great corpus evidence and a productive interview, a draft article can still fail on SEO fundamentals (wrong keyword density, missing semantic terms), voice (sounds nothing like Hassan), or quality signals (unsourced statistics, generic phrasing that triggers HCU classifiers). v1 relied on Frase as a single scorer, which was fragile: one tool's score could be gamed or could drift. A single rejection message ("score below 80") gave Hassan no actionable path forward.

### Solution

A three-stage quality gate fires after every SEOwind draft. Stage A is rule-based and automatic — it catches the most common failure modes (generic phrases, insufficient corpus grounding, clickbait titles) and produces a structured error message identifying exactly which rule failed and quoting the offending text. Stage B uses Clearscope for independent SERP-grounded re-scoring (target ≥80). Stage C is Aleyda Solis's Content Helpfulness and Quality SEO Analyzer custom GPT — Hassan runs this manually pre-publish, or the pipeline calls it via the OpenAI Custom GPT API if accessible. Rejected drafts are sent back to SEOwind with the specific failures attached. Maximum three attempts before the candidate is shelved.

### Impact

| Outcome | How Measured | Target |
|---|---|---|
| High first-pass quality | % of drafts passing Gate A on first attempt | ≥85% |
| Clearscope re-score | % of drafts scoring ≥80 on Clearscope without manual intervention | ≥70% |
| Rejection messages are actionable | % of rejection notifications that include a quoted violation | 100% |
| No shelved candidates from low quality | % of candidates reaching Sanity within 3 draft attempts | ≥95% |

---

## 2. User Personas

### Hassan Sadiq — Passive Recipient + Stage C Reviewer

Does not operate the drafting pipeline. Receives a Telegram message when a draft is ready. Runs Stage C (Aleyda Solis GPT) manually: opens the URL, pastes the draft URL + target query, reads the score. If the score is acceptable (qualitative judgment, no hard threshold), he proceeds to Sanity review. If not, he flags the article as needing a rewrite via Telegram.

### Cursor Agents / Claude Code — Primary Implementer

Operates inside the `nexfortis-content-pipeline` repository, specifically `artifacts/gate-worker/`. Does not touch the main monorepo, Sanity Studio, or the Next.js blog. All quality gate logic is in this artifact. Opens draft PRs; does not merge. Respects `AGENTS.md` and `.cursorrules` as stable system-prompt injection.

---

## 3. User Stories

**US-F3-00 — Implementer scope (Cursor agent / Claude Code)**  
As the implementer (Cursor agent / Claude Code) receiving a prompt for this feature, I want a complete list of which tables I may read and write, which external APIs I will call, the edge cases to handle explicitly, and what the Definition of Done checklist requires, so I can implement the gate worker and verify it without ambiguity.

**US-F3-01 — Automatic draft request on interview completion**  
As the pipeline system, when an interview session reaches `completed` status, I want a `draft.requested` Inngest event to fire automatically, so that the drafting pipeline starts without any manual action from Hassan.

**US-F3-02 — SEOwind brief assembly**  
As the pipeline system, I want the gate worker to assemble a complete SEOwind brief (keyword, SERP gaps, corpus insights, statistics, brand voice profile ID) before calling SEOwind, so that every generated draft has the maximum available context and doesn't produce generic output.

**US-F3-03 — Stage A structured rejection**  
As Hassan, when a draft fails Stage A, I want a Telegram message that quotes the specific failing text and names the rule that rejected it ("Generic phrase detected: 'leveraging cutting-edge solutions' at paragraph 3"), so I know exactly what SEOwind produced incorrectly and can judge whether the rewrite request makes sense.

**US-F3-04 — Stage B independent scoring**  
As Hassan, I want the draft's Clearscope score to appear in the Telegram review notification and in the Sanity document metadata, so that I can see the independent SERP-grounded grade alongside the SEOwind score and make an informed review decision.

**US-F3-05 — Stage C manual trigger**  
As Hassan, I want the Telegram draft-ready notification to include a direct link to Aleyda Solis's Content Helpfulness GPT with instructions for running the check, so that I can complete Stage C in under 2 minutes without searching for the tool.

**US-F3-06 — Rewrite loop with failure context**  
As the pipeline system, when a draft fails Stage A or B, I want to send a `draft.rewrite_requested` event that includes the structured error payload (which rules failed, what text violated them), so SEOwind's next draft attempt addresses specific issues rather than starting cold.

**US-F3-07 — 3-attempt shelf limit**  
As the pipeline system, when a candidate has failed 3 draft attempts, I want to set `article_candidates.status = 'shelved'` and notify Hassan via Telegram ("Draft shelved after 3 attempts. The [topic] candidate has been archived. Next synthesis will pick a new topic."), so the pipeline doesn't loop indefinitely on a low-quality candidate.

**US-F3-08 — SEOwind API uncertainty fallback**  
As a future contractor or Cursor agent, I want the SEOwind integration to be documented with an explicit fallback path (Playwright browser automation if no public API is available), so that the pipeline can be implemented even if SEOwind's API surface is more limited than expected, with the maintenance burden clearly stated.

**US-F3-09 — Corpus citation requirement**  
As Hassan, I want any draft with fewer than 2 citations sourced from the capture corpus to be automatically rejected, so that no article reaches Sanity that doesn't contain real specifics from my actual work experience.

---

## 4. Functional Requirements

### 4.1 Draft Request Trigger

When `interview_sessions.status` transitions to `completed`, the interview session job dispatches:

```
event: "draft.requested"
data: {
  candidateId: string,
  sessionId: string,
  confirmedChunkIds: string[],   // from interview_sessions.confirmed_chunk_ids
  pillar: Pillar,
  primaryKeyword: string
}
```

### 4.2 SEOwind Brief Assembly

The gate worker fetches the following before calling SEOwind:

| Brief Field | Source | Notes |
|---|---|---|
| `keyword` | `article_candidates.primary_keyword` | |
| `title` | `article_candidates.proposed_title` | |
| `serp_gaps` | `article_candidates.serp_gaps` | JSON array of gap topics |
| `your_own_insights` | `capture_signals.redacted_text` for each `confirmed_chunk_id` | Formatted as bullet points, max 2,000 chars total |
| `statistics_and_quotes` | Regex-extracted numbers, error codes, version strings from confirmed chunks | e.g., "AADSTS50158", "Named Locations", "~40 minutes" |
| `brand_voice_profile_id` | Env var `SEOWIND_BRAND_VOICE_ID` | Pre-trained by Hassan; see §4.3 |
| `pillar` | `article_candidates.pillar` | Used for internal tag; not sent to SEOwind |

### 4.3 Brand Voice Profile

SEOwind Pro ($219/mo) supports Custom Brand Voice training. Hassan trains the profile once from a 5,000–8,000 word sample of his existing technical writing (existing blog posts + email responses in his authentic voice). The resulting `brand_voice_profile_id` is stored in the environment variable `SEOWIND_BRAND_VOICE_ID` and applied to every draft request.

This is a manual setup step by Hassan before any draft is generated. The Prompt 1 scaffold (see `./cursor-claude-prompt-library.md`) creates an `.env.example` with this variable; Hassan populates it.

### 4.4 SEOwind API Integration

**Known integration risk:** SEOwind's public API surface is limited as of May 2026. The pipeline will attempt to use SEOwind's documented API endpoints. If the required endpoints (brief submission + draft generation + score retrieval) are not publicly available, the fallback is a Playwright browser automation script.

**Path A — SEOwind API (preferred):**
```typescript
// artifacts/gate-worker/src/integrations/seowind.ts
export async function submitBriefAndGenerateDraft(brief: SEOwindBrief): Promise<{
  draftUrl: string;
  seowindScore: number;
  draftText: string;
}> {
  const response = await fetch("https://app.seowind.io/api/v1/documents", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.SEOWIND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(brief),
  });
  // ... parse response
}
```

**Path B — Playwright fallback (if Path A is not viable):**

A Playwright script logs into SEOwind, fills in the brief fields, triggers generation, and extracts the resulting draft text and score. This approach works but has a maintenance burden: SEOwind UI changes will break the script. The script must be versioned and its brittleness documented explicitly in `artifacts/gate-worker/src/integrations/seowind-playwright.ts` with a header comment:

```typescript
// WARNING: This is a browser automation fallback because SEOwind's API
// does not expose [specific endpoint]. Maintenance burden: HIGH.
// If SEOwind publishes the [endpoint] API, migrate to seowind.ts immediately.
// Last verified working: [date]. If broken, check SEOwind UI changes first.
```

**Document this risk to Hassan:** Path B adds ~30 minutes of potential breakage per quarter when SEOwind updates their UI. The trade-off is acceptable for v2 but should be migrated to Path A as soon as SEOwind exposes the needed API surface.

### 4.5 Quality Gate Stage A — Rule-Based Auto-Reject

The gate runs every rule; all must pass. First failure halts the check and returns the structured error immediately (no need to evaluate remaining rules for the first failure iteration — fail fast).

| Rule ID | Rule | Threshold | Error Message Template |
|---|---|---|---|
| GA-01 | Corpus citation count | `< 2` citations from confirmed chunks | "Draft contains [N] corpus citations; minimum is 2. Confirm chunks were included in the SEOwind brief." |
| GA-02 | Generic phrase blocklist | Any match in the 30-phrase list (§4.5a) | "Generic phrase detected: '[matched phrase]' at [location]. Rewrite this section to be specific." |
| GA-03 | Hassan's transcribed words | `< 100` transcribed words of Hassan in source material | "Only [N] words from Hassan's interview were used as source material; minimum is 100. Session may have too few confirmations." |
| GA-04 | Clickbait title words | Any match in title | "Clickbait word in title: '[word]'. Rewrite title to be descriptive and accurate." |
| GA-05 | Author byline absent | `byline` field not present or not "Hassan Sadiq" | "No author byline found or byline is not 'Hassan Sadiq'." |
| GA-06 | Author bio absent | `bio_block` field empty | "Author bio block is missing." |
| GA-07 | Unsourced statistic | Any number ≥ 4 digits with no adjacent URL or named source within 200 chars | "Unsourced statistic: '[number in context]'. Add a source citation or remove the statistic." |
| GA-08 | E-E-A-T marker absent | No first-person phrase in draft (`I`, `we`, `my client`, `in my experience`) | "Draft contains no E-E-A-T markers (no first-person experience language). SEOwind brief may not have included corpus insights." |

#### 4.5a Generic Phrase Blocklist (30 entries)

The following phrases, if found in the draft, cause an immediate GA-02 rejection:

1. in today's fast-paced digital world
2. leveraging cutting-edge solutions
3. businesses of all sizes
4. in today's competitive landscape
5. it's more important than ever
6. in conclusion, it is clear that
7. seamless integration
8. end-to-end solution
9. best-in-class
10. robust and scalable
11. game-changer
12. transformative impact
13. holistic approach
14. synergy
15. paradigm shift
16. at the end of the day
17. move the needle
18. circle back
19. low-hanging fruit
20. drill down
21. take it to the next level
22. think outside the box
23. on the same page
24. going forward
25. streamline your workflow
26. empower your business
27. unlock your potential
28. in this day and age
29. the bottom line is
30. it goes without saying

Match is case-insensitive. Partial matches within longer phrases count (e.g., "leveraging cutting-edge" inside a sentence).

#### 4.5b Clickbait Title Blocklist

Words that cause GA-04 rejection if present in the article title:

`Ultimate`, `Complete`, `Shocking`, `Best`, `Top N` (where N is any digit), `Incredible`, `Breathtaking`, `You Won't Believe`, `Amazing`, `Stunning`, `Must-Read`, `Secret`, `Hack`, `Trick`

Match is case-insensitive, whole-word only for single words (e.g., "best" triggers but "best practice" does not — exception: "best" alone or followed by a noun triggers; evaluate with regex `/\bbest\b(?!\s+practice)/i`).

### 4.6 Quality Gate Stage B — Clearscope Re-Score

**What Clearscope does:** Independent SERP-grounded content grading. Analyzes the top results for the target keyword and grades the draft on term coverage, depth, and relevance. Score ≥80 required to pass.

**API availability:** Clearscope has a documented API (as of May 2026). Confirm the `POST /v1/reports` endpoint (submit URL or text for scoring) before implementation. If the API is unavailable or paywalled above the current plan tier, document the manual fallback:
- Manual: paste draft text into Clearscope, read score, manually update `drafts.clearscope_score` in Supabase.
- Automated (preferred): `POST` draft text to Clearscope API, receive score, store in `drafts.clearscope_score`.

```typescript
// artifacts/gate-worker/src/integrations/clearscope.ts
export async function scoreDraft(keyword: string, draftText: string): Promise<number> {
  // Returns a score 0–100
  // Throws ClearscopeAPIError if API is unavailable — triggers manual fallback alert
}
```

If the API call fails, send Hassan a Telegram message: "Clearscope API unavailable. Please score manually at app.clearscope.io and reply with the score: `/set_clearscope_score [draft_id] [score]`." The bot handles this command to update `drafts.clearscope_score` and resume the gate.

**Threshold:** Score `< 80` → Gate B rejection. Error: "Clearscope score: [N]/100 (minimum 80). Topic coverage is insufficient for the target keyword '[keyword]'."

### 4.7 Quality Gate Stage C — Aleyda Solis E-E-A-T GPT

**What it is:** A custom ChatGPT (OpenAI Custom GPT) built by Aleyda Solis, an industry-respected SEO consultant, that evaluates content helpfulness and quality using Google's own quality rater rubric. Free to use; requires ChatGPT Plus or Team account.

**Integration options:**
- **Manual (MVP):** Hassan opens the GPT URL, pastes the live article URL + target query. Reads the qualitative score. If acceptable, proceeds to approve in Sanity.
- **API (aspirational):** OpenAI Custom GPT API may allow calling the GPT via the standard Assistants API with the GPT's `assistant_id`. Attempt this integration; if it works, store the score in `drafts.eeat_score`. If it fails or requires workarounds, fall back to manual.

**No hard numeric threshold for Stage C.** The score is qualitative and Hassan-judged. Stage C is a final sense-check, not a binary gate. The pipeline records `drafts.eeat_score` as a text field for the response summary.

**Telegram notification for Stage C:**
```
📋 Stage C check needed before approving:
Article: [title]
Aleyda Solis Content GPT: https://chat.openai.com/g/g-[id]

Paste this into the GPT:
URL: [sanity-preview-url]
Query: [primary_keyword]

Then reply /approve_eeat [draft_id] to continue, or /reject_eeat [draft_id] [reason].
```

### 4.8 Rewrite Loop

On any Stage A or B rejection:

1. Increment `drafts.attempt_number`.
2. If `attempt_number > 3`: set `article_candidates.status = 'shelved'`; notify Hassan; stop.
3. Otherwise: dispatch `draft.rewrite_requested` event with the full `gate_a_failures` JSONB payload (or Stage B score + shortfall).
4. The gate worker receives `draft.rewrite_requested`, appends failure context to the SEOwind brief (`corrections` field), and re-submits to SEOwind.
5. The corrected brief explicitly tells SEOwind which phrase to avoid, which section to fix, and that the corpus insight field must be populated.

Rewrite brief correction format:
```json
{
  "corrections": [
    { "rule": "GA-02", "location": "paragraph 3", "violation": "leveraging cutting-edge solutions", "instruction": "Replace with a specific technical description from the corpus insights provided." },
    { "rule": "GA-07", "location": "paragraph 5", "violation": "99% of businesses", "instruction": "Either cite the source of this statistic inline or remove it." }
  ]
}
```

---

## 5. Non-Functional Requirements

| ID | Requirement | Threshold |
|---|---|---|
| NFR-01 | Stage A evaluation speed | < 30 seconds for all 8 rules |
| NFR-02 | Stage B API call timeout | 60-second timeout; retry once on network error |
| NFR-03 | Rejection notification latency | Hassan receives Telegram within 2 minutes of gate failure |
| NFR-04 | Rewrite loop idempotency | Re-submitting the same brief twice produces the same `attempt_number` (no double-increment) |
| NFR-05 | Audit trail | Every gate run logged: which rules were evaluated, pass/fail for each, timestamps |
| NFR-06 | Stage A false-positive rate | Manually reviewed monthly; target < 5% false positives (legitimate text flagged incorrectly) |

---

## 6. Technical Specifications

### 6.1 Repository Placement

```
nexfortis-content-pipeline/
  artifacts/
    gate-worker/               ← THIS FEATURE
      src/
        jobs/
          draft-generator.ts   ← handles draft.requested event; assembles brief; calls SEOwind
          gate-runner.ts       ← orchestrates Stage A → B → C notification
          rewrite-handler.ts   ← handles draft.rewrite_requested; rebuilds brief with corrections
        integrations/
          seowind.ts           ← Path A: API client
          seowind-playwright.ts ← Path B: browser automation fallback
          clearscope.ts        ← Stage B scorer
          openai-eeat.ts       ← Stage C: Custom GPT API attempt
        gates/
          stage-a.ts           ← rule evaluator; returns GateAResult[]
          stage-b.ts           ← Clearscope caller; returns GateBResult
        index.ts               ← Inngest serve handler
```

### 6.2 Gate A Data Types

```typescript
// artifacts/gate-worker/src/gates/stage-a.ts

export interface GateAFailure {
  ruleId: string;           // e.g. "GA-02"
  ruleName: string;         // e.g. "Generic Phrase Blocklist"
  location: string;         // e.g. "paragraph 3, sentence 2"
  quotedViolation: string;  // the exact text that triggered the rule
  instruction: string;      // human-readable fix instruction
}

export interface GateAResult {
  passed: boolean;
  failures: GateAFailure[];  // empty array if passed
  evaluatedAt: string;       // ISO timestamp
}

export async function runGateA(
  draft: DraftDocument,
  session: InterviewSession
): Promise<GateAResult> {
  const failures: GateAFailure[] = [];
  // Evaluate GA-01 through GA-08 in order
  // Stop on first failure (fail fast) in the MVP implementation
  // Full run (all rules) can be a v2.1 enhancement for better reporting
  return { passed: failures.length === 0, failures, evaluatedAt: new Date().toISOString() };
}
```

### 6.3 Draft Database Schema (Preview)

Full DDL is in `./architecture-and-data-model.md`. Relevant to this feature:

```sql
-- drafts table (managed by this feature)
status values used here:
  'generating'    → SEOwind API call in flight
  'gate_a_fail'   → Stage A rejected
  'gate_b_fail'   → Stage B rejected
  'gate_passed'   → all automated stages passed; waiting for Stage C / Hassan
  'shelved'       → 3 attempts exhausted
  'approved'      → Hassan approved (set by F4)
```

### 6.4 Inngest Events Produced and Consumed

| Event | Direction | Payload |
|---|---|---|
| `draft.requested` | Consumed (from F2) | `{ candidateId, sessionId, confirmedChunkIds, pillar, primaryKeyword }` |
| `draft.generated` | Produced (internal) | `{ draftId, seowindScore, draftText }` |
| `draft.rewrite_requested` | Produced + consumed | `{ draftId, gateAFailures, gateBScore }` |
| `draft.gate_passed` | Produced (to F4) | `{ draftId, seowindScore, clearscopeScore }` |
| `draft.shelved` | Produced | `{ candidateId, attemptCount: 3 }` |

### 6.5 Environment Variables

| Variable | Description |
|---|---|
| `SEOWIND_API_KEY` | SEOwind Pro API key |
| `SEOWIND_BRAND_VOICE_ID` | Pre-trained brand voice profile ID |
| `CLEARSCOPE_API_KEY` | Clearscope API key |
| `OPENAI_API_KEY` | For Stage C Custom GPT API attempt |
| `TELEGRAM_BOT_TOKEN` | For rejection/approval notifications |
| `TELEGRAM_CHAT_ID` | Hassan's chat ID |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key |
| `INNGEST_EVENT_KEY` | |
| `INNGEST_SIGNING_KEY` | |

---

## 7. AI System Requirements

### 7.1 LLM Usage Map

| Task | Model | Rationale |
|---|---|---|
| Draft generation | SEOwind (built-in model) | SEOwind's proprietary generation pipeline, not a direct LLM call |
| Stage C E-E-A-T check | Aleyda Solis Custom GPT (OpenAI GPT-4 under the hood) | Industry-validated rubric |
| Rewrite brief correction text | Claude Haiku | Simple instruction formatting; cost-efficient |

No direct Claude or GPT call for draft generation. SEOwind handles that internally.

### 7.2 Evaluation

**Gate A false-positive rate:** Monthly manual review. Randomly sample 10 Gate A rejections; how many were legitimately bad vs. incorrectly flagged? Target < 5% false positives. If higher, refine the regex patterns in `stage-a.ts`.

**Clearscope calibration:** Quarterly. Compare Clearscope scores of published articles against their GSC ranking positions. If high Clearscope score (≥80) doesn't correlate with ranking (≥top 20 for target keyword at 3 months), re-evaluate the threshold.

---

## 8. Acceptance Criteria

### AC-F3-01: Draft.Requested Triggers Brief Assembly

**Given** an `interview_sessions` row transitions to `status = 'completed'`,  
**When** the `draft.requested` event fires,  
**Then:**
- A new `drafts` row is created with `status = 'generating'` and `attempt_number = 1`.
- `drafts.seowind_brief` JSONB is populated with: keyword, title, SERP gaps, corpus insights (bullet points from confirmed chunks), statistics (extracted numbers/error codes), brand voice profile ID.
- The corpus insights field contains text from all confirmed `capture_signal` chunks referenced in `interview_sessions.confirmed_chunk_ids`.

### AC-F3-02: Stage A Pass

**Given** a draft contains ≥2 corpus citations, no phrases from the blocklist, ≥100 transcribed words of Hassan, no clickbait title words, present author byline ("Hassan Sadiq"), present bio block, no unsourced statistics, and ≥1 first-person phrase,  
**When** Stage A runs,  
**Then:**
- `GateAResult.passed` is `true`.
- `GateAResult.failures` is an empty array.
- `drafts.gate_a_failures` is set to `[]`.
- The gate proceeds to Stage B.

### AC-F3-03: Stage A Reject — Specific Error

**Given** a draft contains the phrase "leveraging cutting-edge solutions" in paragraph 3,  
**When** Stage A runs rule GA-02,  
**Then:**
- `GateAResult.passed` is `false`.
- `GateAResult.failures[0].ruleId` is `"GA-02"`.
- `GateAResult.failures[0].quotedViolation` contains `"leveraging cutting-edge solutions"`.
- `GateAResult.failures[0].location` references paragraph 3.
- Hassan receives a Telegram message within 2 minutes containing the quoted violation.
- `drafts.status` is set to `"gate_a_fail"`.

### AC-F3-04: Stage B Pass

**Given** Stage A passed and Clearscope returns a score of 82 for the target keyword,  
**When** Stage B runs,  
**Then:**
- `drafts.clearscope_score` is set to `82`.
- `drafts.status` is updated to `"gate_passed"`.
- A `draft.gate_passed` event is dispatched.

### AC-F3-05: Stage B Fail — Manual Fallback

**Given** the Clearscope API is unavailable (returns 5xx),  
**When** Stage B runs,  
**Then:**
- Hassan receives a Telegram message: "Clearscope API unavailable. Please score manually at app.clearscope.io and reply `/set_clearscope_score [draft_id] [score]`."
- `drafts.status` is set to `"awaiting_manual_clearscope"`.
- When Hassan sends `/set_clearscope_score [id] 83`, `drafts.clearscope_score` is updated to 83 and the gate resumes.

### AC-F3-06: Rewrite Loop — 3rd Attempt Shelved

**Given** a draft has `attempt_number = 3` and Stage A fails again,  
**When** the gate runner evaluates the result,  
**Then:**
- No further draft attempts are made.
- `drafts.status` is set to `"shelved"`.
- `article_candidates.status` is set to `"shelved"`.
- Hassan receives: "Draft shelved after 3 attempts. The [topic] candidate has been archived. Next synthesis will pick a new topic."
- A `draft.shelved` Inngest event is dispatched.
- The next `synthesize-weekly` run picks the next-best candidate.

### AC-F3-07: Stage C Notification

**Given** a draft passes Stages A and B,  
**When** the gate worker completes Stage B,  
**Then:**
- Hassan receives a Telegram message that includes: the article title, the direct URL to Aleyda Solis's Content Helpfulness GPT, the exact text to paste into the GPT (article URL + primary keyword), and the bot commands `/approve_eeat` and `/reject_eeat`.
- The draft is visible in Sanity Studio as a draft (pushed by F4, not this feature).

---

## 8b. Shared Resources

| System | Shared? | Notes |
|---|---|---|
| Supabase project | ✅ Yes — same project | Reads `interview_sessions`, `article_candidates`, `capture_signals`; writes `drafts` |
| SEOwind | Separate service | New integration; API key in Render env vars for this artifact only |
| Clearscope | Separate service | New integration; API key for this artifact |
| Sanity project | ✅ Yes — same project | Gate worker does NOT write to Sanity; F4 (sanity-bridge) does |
| Telegram Bot | ✅ Yes — same bot token | Rejection notifications and Stage C instructions sent via same bot |
| OpenAI account | Recommended separate key | Stage C Custom GPT API attempt |

---

## 9. Out of Scope

| Item | Rationale |
|---|---|
| Draft generation without SEOwind (Claude directly) | SEOwind's brand voice + SERP integration is the entire point. Direct Claude drafts bypass the structured brief. |
| Stage A rule modification at runtime | Rules are hardcoded in `stage-a.ts`. Changes require a PR. Hassan cannot add/remove rules via Telegram. |
| Automatic Stage C scoring without manual review | Stage C is qualitative and requires Hassan's judgment. Full automation is a v2.1 aspiration. |
| Social post generation | Social posts are generated by the distribution layer (out of scope for this feature). |
| Clearscope keyword rank tracking | Clearscope's rank tracking feature is separate from scoring; not integrated in v2. |
