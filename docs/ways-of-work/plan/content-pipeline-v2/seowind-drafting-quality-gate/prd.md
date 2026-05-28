# Feature PRD — SEOwind Drafting + Multi-Stage Quality Gate (F3)

**Document Owner:** Hassan Sadiq, NexFortis  
**Parent Epic:** [NexFortis Automated Content Pipeline v2](../epic-prd.md)  
**Depends On:** F1 (corpus + `article_candidates`), F2 (completed `interview_sessions` with confirmed chunks)  
**Status:** Production Spec — Ready for Implementation  
**Version:** 2.0  
**Created:** May 10, 2026  
**Revised:** (SEOwind rewrite — verified against seowind-knowledge-map.md, 2,107 lines, full corpus of 627 readable docs)  
**Audience:** Hassan Sadiq, Cursor agents / Claude Code (primary implementer), Computer (orchestrator), future contractors

---

## Open Questions — Resolved

All seven open questions raised during the rewrite have been answered by Hassan. Captured here for traceability; the implementation must use these answers verbatim.

1. **Insights field character limit — RESOLVED.** Maximum is **15,000 characters**. The Custom Insights assembly module (§7) must enforce this as the hard cap. The assembled `insights_text` block is truncated at the assembly stage — never at the Playwright fill stage — so over-budget content is logged and visible in the database before any UI interaction.

2. **MFA on the SEOwind account — RESOLVED.** No MFA is enabled. The Playwright login flow uses email + password only. No MFA detection branch is required, but the implementation should still alert if login fails for any reason (e.g., expired session, password change).

3. **Publishing volume — RESOLVED.** No higher-volume SEOwind plan is needed. The project is intentionally capped at **5–6 articles per month** (per epic PRD §NG3: "More than 6 articles/month — Quality over volume; sudden volume spikes attract HCU scrutiny"). At ~1.5 briefs/week, we are at ~7.5% of the Platform plan's 20-article monthly capacity. **The volume cap is a deliberate HCU defense, not a SEOwind constraint.** Implementation must NOT add features that enable exceeding 6 articles/month without explicit policy review.

4. **Content Update workflow — RESOLVED.** Out of scope entirely. The Content Update tab is for refreshing existing published articles, not creating new ones. The F3 pipeline never invokes Content Update. The Playwright script never navigates to the Content Update tab. Any future content-refresh capability is a separate v2.x feature with its own PRD.

5. **SEOwind URL schema — RESOLVED.**
   - **Brief detail page:** `https://seowind.io/app/brief/{uuid}/` (host is `seowind.io`, not `app.seowind.io`; the `id` is a UUID v4; trailing slash required).
   - **Article editor page:** `https://seowind.io/app/dashboard/articleEditor/?id={uuid}&title={url-encoded-title}&description={url-encoded-meta-description}&isOnboardingBrief={bool}&hideArticle={bool}`. The article ID matches the brief ID (one-to-one). Title and description query params are URL-encoded. `isOnboardingBrief` and `hideArticle` are boolean flags — our pipeline always sees `isOnboardingBrief=false`.
   - The Playwright module hardcodes both URL patterns. No discovery step is needed.

6. **Outline editor UI mechanic — RESOLVED.** The outline editor uses **toggles**, NOT drag-and-drop. Earlier drafts of this PRD incorrectly described it as drag-and-drop with keyboard shortcuts — that was a knowledge-map error corrected by Hassan. **However, the implementation still does NOT touch the manual outline editor** — we rely entirely on SEOwind's AI Outline generation (per §5). The corrected toggle-based mechanic is documented here only so future contributors do not waste effort assuming drag-and-drop.

7. **Rate limits on brief creation — RESOLVED.** At 5–6 briefs/month (~1.5/week), rate limits are not a practical concern. No back-to-back brief creation occurs in the steady-state pipeline. No rate-limit handling is required in the v2 implementation. If a future feature ever creates briefs in rapid succession, this should be re-evaluated.

---

## Table of Contents

1. [Goal](#1-goal)
2. [User Personas](#2-user-personas)
3. [User Stories](#3-user-stories)
4. [The End-to-End Flow](#4-the-end-to-end-flow)
5. [The Playwright Automation Architecture](#5-the-playwright-automation-architecture)
6. [The Brief Assembly Module](#6-the-brief-assembly-module)
7. [The Custom Insights Assembly](#7-the-custom-insights-assembly)
8. [Quality Gate Stages](#8-quality-gate-stages)
9. [Post-Publish EEAT Score Capture](#9-post-publish-eeat-score-capture)
10. [Functional Requirements](#10-functional-requirements)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Technical Specifications](#12-technical-specifications)
13. [AI System Requirements](#13-ai-system-requirements)
14. [Acceptance Criteria](#14-acceptance-criteria)
15. [Stop Conditions for Implementers](#15-stop-conditions-for-implementers)
16. [Out of Scope](#16-out-of-scope)
17. [Shared Resources](#17-shared-resources)

---

## 1. Goal

### Problem

Even with great corpus evidence and a productive interview, a draft article can still fail on SEO fundamentals (wrong keyword density, missing semantic terms), voice (sounds nothing like Hassan), or quality signals (unsourced statistics, generic phrasing that triggers HCU classifiers). v1 relied on Frase as a single scorer, which was fragile: one tool's score could be gamed or could drift. A single rejection message ("score below 80") gave Hassan no actionable path forward.

The original v2 F3 PRD was drafted before anyone had read SEOwind's actual documentation. It contained fabricated integration details — a non-existent REST API endpoint (`https://app.seowind.io/api/v1/documents`), a `SEOWIND_API_KEY` environment variable, and a `SEOWIND_BRAND_VOICE_ID` that would need to be retrieved programmatically. None of these exist. Exhaustive review of all 627 readable SEOwind documentation files confirms: **SEOwind has zero REST API, GraphQL endpoint, webhook, Zapier connector, Make.com module, or programmatic integration of any kind** (per knowledge map §12.4). The only automation surface is the web UI itself.

### Solution

This PRD completely replaces the fabricated API integration with the verified reality: Playwright browser automation drives SEOwind's UI like a robot. Our pipeline assembles a structured brief payload from `article_candidates` and `interview_sessions` data, then navigates SEOwind's pages, filling in each field and waiting for async operations to complete. SEOwind generates the article, the AI Editor opens automatically, and Playwright extracts the article text via DOM operations. A three-stage quality gate (rule-based auto-reject + Clearscope re-scoring + Aleyda Solis E-E-A-T GPT) then fires before anything reaches Sanity.

The optimization target, per Hassan's stated goal, is articles that **rank and beat Google's Helpful Content Update (HCU)**. SEOwind's own philosophy aligns precisely: "For us, research is 90% of the work, and AI writing is a cherry on top" (per `seowind.io_ai-article-writer_.md`). Our pipeline feeds SEOwind the research — the corpus evidence, the confirmed chunks, the brand expertise — and SEOwind synthesizes it into ranked content.

### Impact

| Outcome | How Measured | Target |
|---|---|---|
| High first-pass quality | % of drafts passing Gate A on first attempt | ≥85% |
| Clearscope re-score | % of drafts scoring ≥80 on Clearscope without manual intervention | ≥70% |
| Rejection messages are actionable | % of rejection notifications that include a quoted violation | 100% |
| No shelved candidates from low quality | % of candidates reaching Sanity within 3 draft attempts | ≥95% |
| EEAT score post-publish | EEAT Score Checker score captured for every published article | 100% |

---

## 2. User Personas

### Hassan Sadiq — Passive Recipient + Stage C Reviewer

Does not operate the drafting pipeline day-to-day. Receives a Telegram message when a draft is ready. Runs Stage C (Aleyda Solis GPT) manually: opens the URL, pastes the draft URL + target query, reads the score. If the score is acceptable (qualitative judgment, no hard threshold), he proceeds to Sanity review. If not, he flags the article as needing a rewrite via Telegram.

### Cursor Agents / Claude Code — Primary Implementer

Operates inside the `nexfortis-content-pipeline` repository, specifically `artifacts/gate-worker/`. Does not touch the main monorepo, Sanity Studio, or the Next.js blog. All quality gate logic is in this artifact. Opens draft PRs; does not merge. Respects `AGENTS.md` and `.cursorrules` as stable system-prompt injection.

---

## 3. User Stories

**US-F3-00 — Implementer scope (Cursor agent / Claude Code)**  
As the implementer (Cursor agent / Claude Code) receiving a prompt for this feature, I want a complete list of which tables I may read and write, which external service I will interact with (SEOwind — via Playwright only, no API), the exact Playwright page flow, the edge cases to handle explicitly, and what the Definition of Done checklist requires, so I can implement the gate worker and verify it without ambiguity.

**US-F3-01 — Automatic draft request on interview completion**  
As the pipeline system, when an interview session reaches `completed` status, I want a `draft.requested` Inngest event to fire automatically, so that the drafting pipeline starts without any manual action from Hassan.

**US-F3-02 — SEOwind brief assembly and Playwright delivery**  
As the pipeline system, I want the gate worker to assemble a complete SEOwind brief payload (keyword, location, language, project, assembled insights text from confirmed chunks) and then deliver it to SEOwind via Playwright automation, so that every generated draft has the maximum available context and does not produce generic output. Per knowledge map §11, brand voice is pre-configured at the Project level and requires no per-brief action.

**US-F3-03 — Stage A structured rejection**  
As Hassan, when a draft fails Stage A, I want a Telegram message that quotes the specific failing text and names the rule that rejected it ("Generic phrase detected: 'leveraging cutting-edge solutions' at paragraph 3"), so I know exactly what SEOwind produced incorrectly and can judge whether the rewrite request makes sense.

**US-F3-04 — Stage B independent scoring**  
As Hassan, I want the draft's Clearscope score to appear in the Telegram review notification and in the Sanity document metadata, so that I can see the independent SERP-grounded grade and make an informed review decision.

**US-F3-05 — Stage C manual trigger**  
As Hassan, I want the Telegram draft-ready notification to include a direct link to Aleyda Solis's Content Helpfulness GPT with instructions for running the check, so that I can complete Stage C in under 2 minutes without searching for the tool.

**US-F3-06 — Rewrite loop with failure context**  
As the pipeline system, when a draft fails Stage A or B, I want to send a `draft.rewrite_requested` event that includes the structured error payload (which rules failed, what text violated them), so SEOwind's next draft attempt addresses specific issues rather than starting cold. The Playwright script will re-run the full UI flow for each attempt, pasting an amended insights block that includes correction instructions.

**US-F3-07 — 3-attempt shelf limit**  
As the pipeline system, when a candidate has failed 3 draft attempts, I want to set `article_candidates.status = 'shelved'` and notify Hassan via Telegram ("Draft shelved after 3 attempts. The [topic] candidate has been archived. Next synthesis will pick a new topic."), so the pipeline does not loop indefinitely on a low-quality candidate.

**US-F3-08 — Playwright resilience**  
As a future contractor or Cursor agent, I want the Playwright automation to handle the full async lifecycle (brief creation wait 1–4 min, article generation wait 10–15 min) with explicit polling loops and timeout thresholds documented, so the script does not fail silently on slow SEOwind responses.

**US-F3-09 — Corpus citation requirement**  
As Hassan, I want any draft with fewer than 2 citations sourced from the capture corpus to be automatically rejected, so that no article reaches Sanity that does not contain real specifics from my actual work experience.

**US-F3-10 — EEAT score capture post-publish**  
As Hassan, I want the EEAT Score Checker tool to be run on every published article URL, and the four EEAT pillar scores (Experience, Expertise, Authoritativeness, Trustworthiness) stored in our DB, so I can track content quality improvement over time and use low scores to trigger Content Update runs.

---

## 4. The End-to-End Flow

This section documents the complete journey from `interview_sessions.status = 'completed'` to a published article in Sanity. Every step is grounded in verified SEOwind behavior.

### Trigger: Interview Session Completed

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

### Step 1: Brief Assembly

The gate worker's `draft-generator.ts` receives the `draft.requested` event and:

1. Fetches the `article_candidates` row for `candidateId`.
2. Fetches all `capture_signals` rows matching `confirmedChunkIds`.
3. Builds the `SEOwindBriefPayload` (see §6 for full field mapping).
4. Assembles the `insights_text` string (see §7 for assembly logic).
5. Creates a new `drafts` row with `status = 'generating'` and `attempt_number = 1`.
6. Stores the assembled brief in `drafts.seowind_brief` JSONB.

### Step 2: Playwright Delivery to SEOwind

The gate worker calls `seowind-playwright.ts` with the assembled brief. Playwright:

1. Logs into SEOwind (`/app/authentication/login/`).
2. Creates a new brief via the "Create Article" modal.
3. Waits for SEOwind to process the brief (1–4 minutes, per knowledge map §12.1 Correction F).
4. Opens the brief detail page.
5. Populates the "Your Insights and Instructions" field with `insights_text`.
6. Enables the "Company Details" toggle.
7. Clicks "Generate AI Article."
8. Waits for the AI Editor to open (up to 15 minutes, per knowledge map §6).
9. Extracts the article text from the AI Editor.
10. Returns the article text and the brief's SEOwind URL to the gate worker.

See §5 for the full Playwright architecture including error handling and retry semantics.

### Step 3: Gate A — Rule-Based Auto-Reject

The extracted article text is evaluated against 8 rules (see §8.1). First failure halts evaluation and fires the structured rejection message. If all rules pass, Gate A passes.

### Step 4: Gate B — Clearscope Re-Score

The article text is submitted to Clearscope for independent SERP-grounded scoring. Score ≥80 required (see §8.2).

### Step 5: Gate C Notification

If Stages A and B pass, the gate worker dispatches a `draft.gate_passed` event and sends Hassan a Telegram message with Stage C instructions (Aleyda Solis E-E-A-T GPT, manual check, see §8.3).

### Step 6: Rewrite Loop (on failure)

On Stage A or B failure: increment `attempt_number`, attach the error payload to the insights block as correction instructions, and re-run Playwright for a new draft. Maximum 3 attempts before shelving.

### Step 7: Sanity Push (F4)

On `draft.gate_passed`, the `sanity-bridge` artifact (F4) handles pushing the draft to Sanity Studio. F3 does NOT write to Sanity — that is F4's domain.

### Step 8: Post-Publish EEAT Score Capture

After F4 confirms publish (`published_articles` row created), the gate worker receives a `article.published` event and runs the EEAT Score Checker via Playwright on the live article URL (see §9).

### Data Flow Summary

```
interview_sessions (COMPLETED)
  │
  ▼ draft.requested event
gate-worker: draft-generator.ts
  │
  ├─► fetch confirmed chunks from capture_signals
  ├─► assemble SEOwindBriefPayload
  ├─► assemble insights_text
  ├─► create drafts row (status='generating')
  │
  ▼
seowind-playwright.ts
  │
  ├─► login (email/password)
  ├─► create brief modal → wait 1–4 min (poll)
  ├─► open brief → fill insights → toggle company details
  ├─► click Generate AI Article → wait 10–15 min (poll)
  ├─► AI Editor opens automatically
  ├─► extract article text
  ▼
gate-runner.ts
  │
  ├─► Gate A: 8 rules evaluated (fail fast)
  ├─► Gate B: Clearscope score ≥80
  │
  ▼ (pass)
draft.gate_passed event → F4 (Sanity push)
  │
  ▼ (after publish confirmed)
eeat-capture.ts → EEAT Score Checker Playwright → store scores in published_articles
```

---

## 5. The Playwright Automation Architecture

### Overview

SEOwind is a web application with no documented REST API, GraphQL endpoint, webhook, Zapier connector, Make.com module, or programmatic integration (per knowledge map §12.4 — confirmed by exhaustive search of all 627 readable files). **Every interaction with SEOwind must go through browser automation.**

The chosen delivery mechanism is **Playwright** (Microsoft's browser automation library). This is not a fallback or "Plan B" — it is the only plan, because no API exists.

### Environment Variables

The following environment variables are required for the `gate-worker` Playwright integration. Note: `SEOWIND_API_KEY` and `SEOWIND_BRAND_VOICE_ID` do NOT exist and must never appear in code.

| Variable | Description |
|---|---|
| `SEOWIND_USERNAME` | SEOwind account email address |
| `SEOWIND_PASSWORD` | SEOwind account password |
| `SEOWIND_PROJECT_ID` | The SEOwind project ID for NexFortis (visible in the Projects tab; set once manually) |
| `SEOWIND_BASE_URL` | `https://seowind.io` (override for future URL changes) |
| `PLAYWRIGHT_HEADLESS` | `true` in production, `false` for local debugging |
| `PLAYWRIGHT_TIMEOUT_MS` | Milliseconds for page-level operations; default `30000` (30s) |
| `SEOWIND_ARTICLE_GENERATION_TIMEOUT_MS` | Milliseconds to wait for AI article generation; default `900000` (15 min) |
| `SEOWIND_BRIEF_CREATION_TIMEOUT_MS` | Milliseconds to wait for brief processing; default `300000` (5 min) |

### Page-by-Page Playwright Flow

#### Page 1: Login

**URL:** `https://seowind.io/app/authentication/login/` (per knowledge map §2, Step 0)

```typescript
await page.goto(`${process.env.SEOWIND_BASE_URL}/app/authentication/login/`);
await page.fill('[type=email]', process.env.SEOWIND_USERNAME);
await page.fill('[type=password]', process.env.SEOWIND_PASSWORD);
await page.click('[type=submit]'); // or button containing "Sign In"
await page.waitForURL('**/app/**', { timeout: PLAYWRIGHT_TIMEOUT_MS });
```

**Login failure handling:** Hassan's account has no MFA (per §Open Questions Resolved #2). If after submitting credentials the URL has not changed to a dashboard URL within 10 seconds, the implementation must capture a screenshot, log the failure, and alert Hassan via Telegram with the screenshot path. Common causes: expired session, password change, account locked. The script does NOT attempt to retry login automatically — a single failed login halts the run.

**Session persistence:** After first login, store the Playwright browser context (cookies + localStorage) to disk. On subsequent runs, attempt to restore the session. Only re-login if the session is expired (redirect back to login page on any navigation).

#### Page 2: Dashboard — Create Brief Modal

**Navigation:** Dashboard root URL (inferred: `https://seowind.io/app/`), per knowledge map §2, Step 4.

```typescript
await page.click('text=Create Article'); // per knowledge map §2 Step 4
// Modal appears — per knowledge map §6: "Once you click the 'Create Article' button, the following popup will appear."
await page.waitForSelector('[role=dialog]'); // or modal CSS class
```

**Modal fields to fill** (per knowledge map §12.5 Brief Creation Form):

| Field | Playwright Action | Source Data |
|---|---|---|
| Focus Keyword | `page.fill(keywordInput, brief.focusKeyword)` | `article_candidates.primary_keyword` |
| Location | Click dropdown → click option | `brief.location` (default: "United States") |
| State (if US) | Click dropdown → click option | `brief.usState` (optional, default: none) |
| Language | Click dropdown → click option | `brief.language` (default: "English") |
| Project | Click dropdown → click option matching `SEOWIND_PROJECT_ID` | env var |

**Important:** Location and language dropdowns are likely custom-styled (not native `<select>`) (per knowledge map §6). Use `page.click()` + `page.click(option)` pattern, not `page.selectOption()`. Confirm selectors via live DOM inspection.

After filling: click the "Create brief" button.

#### Async Wait 1: Brief Processing (1–4 minutes)

Per knowledge map §2 Step 4: "Please be patient, take a break for 1-2 minutes when the system is gathering data" (updated docs say 1-2 min; older docs said 3-4 min). Plan for up to 5 minutes.

**Polling strategy:**

```typescript
// After creating brief, watch the dashboard for the "Open" button to appear
// on the row with our keyword
await page.waitForFunction(
  (keyword) => {
    // Look for a table row containing our keyword AND an "Open" action button
    const rows = document.querySelectorAll('tr, [data-testid="brief-row"]');
    // ... check each row for keyword + Open button
    return someRowHasOpenButton;
  },
  brief.focusKeyword,
  { timeout: SEOWIND_BRIEF_CREATION_TIMEOUT_MS }
);
```

If timeout exceeded: mark `drafts.status = 'error_brief_timeout'`; alert Hassan; do not retry automatically.

#### Page 3: Brief Detail

**Navigation:** Click "Open" on the dashboard row for this brief.

The brief detail URL is hardcoded as `https://seowind.io/app/brief/{brief_uuid}/` (per §Open Questions Resolved #5). The article editor URL is `https://seowind.io/app/dashboard/articleEditor/?id={article_uuid}&title={url-encoded-title}&description={url-encoded-meta-description}&isOnboardingBrief=false&hideArticle=false`. Both URL patterns are constants in the Playwright module — no discovery step required at runtime.

**Right panel — "Build your brief" (per knowledge map §12.5 Brief Building Section):**

1. **Insights toggle:** Click "Your Insights and Instructions" toggle → wait for textarea to appear.
2. **Fill insights textarea:** `await page.fill(insightsTextarea, brief.insightsText)` — this is "the most automation-friendly part of the entire brief flow" (per knowledge map §6).
3. **Company Details toggle:** Click to enable "Include in AI Article — Company Details" (per knowledge map §12.5: "Must be toggled ON per brief").
4. **AI Outline:** If the outline is empty, click "Get AI Outline" button → in the popup modal, click "Select All" → click "Add selected" (per knowledge map §2 Step 10). This populates the outline with SERP-data-driven headings.
5. **Verify AI Review & Refine Agent toggle:** Ensure this is ON (per knowledge map §11 recommendation: "AI Review & Refine Agent — always on").

**We do NOT use the manual outline editor.** The outline editor uses toggles to add or remove headings (NOT drag-and-drop — an earlier knowledge-map error that has been corrected; see §Open Questions Resolved #6). We delegate outline generation to SEOwind's own SERP-driven AI Outline feature, which avoids the entire manual-editor surface. The toggle-based mechanic is documented here only so future contributors do not waste effort on drag-and-drop automation. If our `article_candidates` row has a structured `outline_structure` in a future v2.x release, we will revisit — but the default is AI outline only.

#### Async Wait 2: AI Article Generation (up to 15 minutes)

Per knowledge map §6 and §2 Step 14: "After generating an article with SEOwind, it opens automatically in the AI Editor." The duration is not documented; the knowledge map recommends a 10–15 minute generous timeout.

```typescript
await page.click('text=Generate AI Article');
// Wait for redirect to the AI Editor URL
await page.waitForURL('**/app/articles/**', { // or equivalent; confirm URL pattern
  timeout: SEOWIND_ARTICLE_GENERATION_TIMEOUT_MS // 900000ms = 15 min
});
```

**No webhook or API callback exists for generation completion** (per knowledge map §6, §12.4). The redirect to the AI Editor is the only signal. Playwright must hold the browser session open and wait for this redirect.

If timeout exceeded: mark `drafts.status = 'error_generation_timeout'`; alert Hassan; do not retry automatically.

#### Page 4: AI Editor — Extract Article

Per knowledge map §2 Step 15 and §12.2 Feature I: the AI Editor opens automatically after generation. It includes EEAT auto-scoring visible in the editor.

**Article extraction options (in priority order):**

1. **DOM extraction:** Locate the article content element (likely a `contenteditable` div or rich text container) and use `page.textContent()` or `page.evaluate()` to extract the full HTML/text.
2. **Clipboard:** Use `page.keyboard.press('Control+A')` then `page.keyboard.press('Control+C')` and read clipboard via `page.evaluate(() => navigator.clipboard.readText())`.

The extracted content is stored in `drafts.draft_text` (TEXT column).

**EEAT score in editor (optional, per knowledge map §12.2 Feature I):** The editor shows an auto-EEAT score. If extractable from the DOM, store in `drafts.seowind_score` as a JSON object with pillar scores. This is best-effort; do not fail if not extractable.

**Article URL capture:** Store the AI Editor URL (`/app/articles/{id}` pattern) in `drafts.seowind_draft_url`.

### Error Handling and Retry Semantics

| Error Type | Action |
|---|---|
| Login failure (wrong credentials) | Alert Hassan; halt; do not retry |
| MFA prompt detected | Alert Hassan with session URL; pause automation; resume after human completes |
| Brief creation timeout | Mark `error_brief_timeout`; alert Hassan; do not auto-retry |
| Article generation timeout | Mark `error_generation_timeout`; alert Hassan; do not auto-retry |
| Selector not found (UI change) | Log full page HTML to file; alert Hassan with "SEOwind UI may have changed" message; halt |
| Network error (transient) | Retry the page action up to 3 times with 5s exponential backoff |
| Gate A or B failure | Re-run full Playwright flow for next attempt (up to 3 total attempts) |

**UI change detection:** SEOwind may update their UI. The Playwright script must be written with resilience:
- Use `text=` selectors where possible (more stable than CSS class selectors which change with UI rebuilds).
- Log the Playwright version in use and the date of last verified working run in a header comment in `seowind-playwright.ts`.
- Set up a monthly alert to manually verify the script still works (Hassan logs in and triggers a test run).

### The `seowind-playwright.ts` Header Comment (Required)

```typescript
/**
 * SEOwind UI Automation via Playwright
 *
 * CRITICAL ARCHITECTURE NOTE:
 * SEOwind has NO REST API, GraphQL endpoint, webhook, Zapier connector,
 * Make.com module, or programmatic integration of any kind.
 * (Verified: exhaustive search of all 627 readable SEOwind docs, May 2026.
 *  See seowind-knowledge-map.md §12.4.)
 *
 * This script IS the integration. All interactions go through the browser.
 *
 * Last verified working: [date] against SEOwind UI version [observed]
 * If broken: check whether SEOwind has changed their UI.
 * Alert Hassan immediately if UI change is detected.
 *
 * DO NOT add a REST API client. DO NOT add SEOWIND_API_KEY to env vars.
 * DO NOT add SEOWIND_BRAND_VOICE_ID to env vars (brand voice is project-level, UI-managed).
 */
```

---

## 6. The Brief Assembly Module

### Location

`artifacts/gate-worker/src/jobs/draft-generator.ts` — receives `draft.requested` event and calls the assembly functions.

`artifacts/gate-worker/src/integrations/brief-assembler.ts` — builds the `SEOwindBriefPayload` from DB data.

### The `SEOwindBriefPayload` Type

```typescript
// artifacts/gate-worker/src/integrations/brief-assembler.ts

export interface SEOwindBriefPayload {
  // Brief creation popup fields (per knowledge map §12.5)
  focusKeyword: string;        // article_candidates.primary_keyword
  location: string;            // default "United States"
  usState?: string;            // optional; omit unless explicitly set
  language: string;            // default "English"
  projectId: string;           // SEOWIND_PROJECT_ID env var (pre-configured in SEOwind UI)

  // Brief detail panel fields
  insightsText: string;        // assembled from confirmed_chunk_ids (see §7)
  enableCompanyDetails: boolean; // always true — must be toggled per brief

  // Optional: supplementary brief data (used for context in next attempt's corrections)
  correctionInstructions?: string; // populated on rewrite attempts
}
```

### Field-Level Mapping

Per knowledge map §12.5 and §5 (Brief Assembly — Every Field in Detail):

| Brief Field | Source | Notes |
|---|---|---|
| `focusKeyword` | `article_candidates.primary_keyword` | One keyword only; no multi-keyword |
| `location` | `article_candidates.target_location` or default "United States" | 180+ locations supported |
| `language` | `article_candidates.target_language` or default "English" | 12 languages supported |
| `projectId` | `SEOWIND_PROJECT_ID` env var | Pre-configured by Hassan in SEOwind Projects tab; set once |
| `insightsText` | Assembled from `confirmedChunkIds` (see §7) | Single whole-article textarea; no per-section routing |
| `enableCompanyDetails` | Always `true` | Per knowledge map §12.1: must toggle ON per brief |

**What is NOT in the payload (by design):**

- `brandVoiceId` — Brand Voice is set at the Project level and applied automatically to all briefs in that project. There is no per-brief brand voice override for the article writer flow. No code should set, read, or store a brand voice ID. (per knowledge map §4, §12.1 Correction A)
- `title` — We let SEOwind's AI generate the title from SERP data; our `article_candidates.proposed_title` is available but we trust SEOwind's SERP-grounded title generation as default.
- `secondaryKeywords` — Populated by SEOwind's SERP analysis automatically; we do not need to inject them.
- `outline` — We use SEOwind's AI Outline feature (per knowledge map §11); no pre-built outline injected by default.

### One-Time Project Setup (Manual, by Hassan — Not Automated)

Before any Playwright automation can run, Hassan must complete these one-time steps manually in the SEOwind UI:

1. **Create a Project** (Projects tab) with `nexfortis.com` as the domain. SEOwind will auto-scrape Company Information, Product & Services, and Target Audience from the domain (per knowledge map §2 Step 1).
2. **Populate Company Details** (Company Name, Company Information, Product & Service Information, Target Audience). These will be toggled on per brief automatically (per knowledge map §2 Step 2).
3. **Set Brand Voice** (Projects → Brand Voice → Create Your Brand Voice). Paste sample text from Hassan's existing technical writing → SEOwind generates the profile → review and save. This is set once and auto-applied to all briefs in this project (per knowledge map §4).
4. **Select AI Model** (Projects → AI Model). Choose Claude 4.5 Sonnet, GPT-5, or Gemini 2.5 Pro for this project.
5. **Connect GSC** (Projects → GSC Integration → Sign in with Google). Required for internal linking and keyword cannibalization check (per knowledge map §12.4 GSC Integration).
6. **Note the Project ID** from the URL after setup and store it in `SEOWIND_PROJECT_ID` env var.

These steps are one-time. The pipeline does not automate them.

---

## 7. The Custom Insights Assembly

### What Insights Are

Per `seowind.io_docs_add-your-insights-to-ai-article_.md` and knowledge map §3: the "Your Insights and Instructions" field is a **single free-text textarea** in the brief's right panel. It accepts the user's expertise, opinions, examples, and instructions. SEOwind's AI automatically distinguishes between "insights" (expertise, examples, opinions) and "instructions" (guidance on tone, structure, format) within the same text block — no special markup needed.

The AI does **not** simply append the insights — it **places them strategically throughout the article** based on relevance to each section. Exact placement is a black-box internal to SEOwind.

### Plan Gate

Custom Insights is available on Pro, Agency, and Enterprise plans (per knowledge map §12.2 Feature W3; per `seowind.io_custom-insights_.md`). Hassan is on Pro — this feature is confirmed available. The pipeline must not be built assuming Basic plan access.

### Character Limit — RESOLVED at 15,000 characters

The Insights and Instructions textarea accepts up to **15,000 characters** (confirmed by Hassan; see §Open Questions Resolved #1). The Custom Insights assembly module enforces this as a hard cap.

- **`MAX_INSIGHTS_CHARS = 15_000`** in `artifacts/gate-worker/src/integrations/insights-assembler.ts`.
- Truncation happens at the assembly stage, never at the Playwright fill stage. Over-budget content is logged with the assembled length, the cap, and the count of confirmed chunks that did not fit. The truncation marker (e.g., `… [truncated: N additional chunks omitted]`) is appended to the assembled block so SEOwind sees a clean end-of-text.
- The assembler greedy-fills in chunk-priority order until the next chunk would exceed the cap, then stops. Priority is: confirmed answers first, then follow-up answers, then evidence chunks in `captured_at DESC` order.

### Assembly Algorithm

`artifacts/gate-worker/src/integrations/insights-assembler.ts`

```typescript
export async function assembleInsightsText(
  confirmedChunkIds: string[],
  supabase: SupabaseClient,
  maxChars: number = MAX_INSIGHTS_CHARS // 15_000 — confirmed by Hassan with SEOwind
): Promise<string> {
  // 1. Fetch capture_signals rows for all confirmed chunk IDs
  const chunks = await fetchChunks(confirmedChunkIds, supabase);
  
  // 2. Sort by relevance (most recently captured first, or by signal strength)
  const sorted = sortByRelevance(chunks);
  
  // 3. Build prose sections by content type
  const sections: string[] = [];
  
  // Personal experience and case study chunks
  const experienceChunks = sorted.filter(c => isExperienceContent(c));
  if (experienceChunks.length > 0) {
    sections.push(formatExperienceSection(experienceChunks));
  }
  
  // Expert knowledge and technical data chunks
  const expertChunks = sorted.filter(c => isExpertContent(c));
  if (expertChunks.length > 0) {
    sections.push(formatExpertSection(expertChunks));
  }
  
  // Specific facts, error codes, configurations, client scenarios
  const specificChunks = sorted.filter(c => hasSpecifics(c));
  if (specificChunks.length > 0) {
    sections.push(formatSpecificsSection(specificChunks));
  }
  
  // 4. Assemble into one coherent prose block
  let assembled = sections.join('\n\n');
  
  // 5. Truncate to maxChars if needed, at a sentence boundary
  if (assembled.length > maxChars) {
    assembled = truncateAtSentenceBoundary(assembled, maxChars);
  }
  
  return assembled;
}
```

### Format Requirements

Per knowledge map §3 (How SEOwind Incorporates Insights):

- **Format:** Free prose. No JSON, no markdown tables, no bullet-point dumps.
- **Acceptable types:** Personal experience stories, expert knowledge / insider information, research findings, actionable tips, technical explanations, custom solutions, real client scenarios (PII-redacted per the capture pipeline).
- **Not required:** No special section headers, no tagging for specific outline headings. SEOwind distributes insights automatically.
- **Tone instructions:** Per-brief tone tweaks (if needed) can be appended at the end of the insights block as plain instructions, e.g.: "Please write in a direct, technical, practitioner tone. Avoid AI-sounding filler phrases."

### Rewrite Attempt Corrections

On a failed draft (Gate A or B), the next attempt's `insightsText` must include the correction instructions at the top:

```typescript
function buildCorrectionPrefix(failures: GateAFailure[]): string {
  const lines = [
    'CORRECTION INSTRUCTIONS FOR THIS DRAFT:',
    ...failures.map(f => `- Rule ${f.ruleId}: Replace "${f.quotedViolation}" in ${f.location}. ${f.instruction}`),
    '',
    'EXPERTISE AND CONTEXT:'
  ];
  return lines.join('\n');
}

// Final insights text for rewrite attempt:
const insightsText = buildCorrectionPrefix(failures) + '\n\n' + baseInsightsText;
```

---

## 8. Quality Gate Stages

### 8.1 Stage A — Rule-Based Auto-Reject

The gate runs all rules; all must pass. First failure halts the check and returns the structured error immediately (fail fast).

| Rule ID | Rule | Threshold | Error Message Template |
|---|---|---|---|
| GA-01 | Corpus citation count | `< 2` citations from confirmed chunks | "Draft contains [N] corpus citations; minimum is 2. Confirm chunks were included in the SEOwind brief." |
| GA-02 | Generic phrase blocklist | Any match in the 30-phrase list (§8.1a) | "Generic phrase detected: '[matched phrase]' at [location]. Rewrite this section to be specific." |
| GA-03 | Hassan's transcribed words | `< 100` transcribed words from confirmed source material | "Only [N] words from Hassan's interview were used as source material; minimum is 100." |
| GA-04 | Clickbait title words | Any match in title (§8.1b) | "Clickbait word in title: '[word]'. Rewrite title to be descriptive and accurate." |
| GA-05 | Author byline absent | `byline` field not present or not "Hassan Sadiq" | "No author byline found or byline is not 'Hassan Sadiq'." |
| GA-06 | Author bio absent | `bio_block` field empty | "Author bio block is missing." |
| GA-07 | Unsourced statistic | Any number ≥ 4 digits with no adjacent URL or named source within 200 chars | "Unsourced statistic: '[number in context]'. Add a source citation or remove the statistic." |
| GA-08 | E-E-A-T marker absent | No first-person phrase in draft (`I`, `we`, `my client`, `in my experience`) | "Draft contains no E-E-A-T markers (no first-person experience language). SEOwind brief may not have included corpus insights." |

**Rationale for GA-08:** Per knowledge map §7 (E-E-A-T and HCU Alignment), the Insights textarea is the primary mechanism for injecting "Experience" signals — the first E in E-E-A-T. If no first-person language appears, it likely means the insights block was not incorporated, indicating an assembly or Playwright failure.

#### 8.1a Generic Phrase Blocklist (30 entries)

These phrases, if found in the draft, cause immediate GA-02 rejection. Per knowledge map §12.9 W6 (AI-sounding phrases to avoid), this list also incorporates SEOwind's own anti-AI-pattern guidance:

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

Match is case-insensitive. Partial matches within longer phrases count.

Note: Per knowledge map §12.9 W6, SEOwind itself recommends avoiding phrases like "revolutionize" and "chasm" — these are implicitly covered by the spirit of this blocklist. The implementer may add them if the false-positive rate is acceptable.

#### 8.1b Clickbait Title Blocklist

Words that cause GA-04 rejection if present in the article title:

`Ultimate`, `Complete`, `Shocking`, `Best`, `Top N` (where N is any digit), `Incredible`, `Breathtaking`, `You Won't Believe`, `Amazing`, `Stunning`, `Must-Read`, `Secret`, `Hack`, `Trick`

Match is case-insensitive, whole-word only. Exception: "best practice" does not trigger (use regex `/\bbest\b(?!\s+practice)/i`).

### 8.2 Stage B — Clearscope Re-Score

**What Clearscope does:** Independent SERP-grounded content grading. Analyzes the top results for the target keyword and grades the draft on term coverage, depth, and relevance. Score ≥80 required.

**API availability:** Clearscope has a documented API. Confirm the endpoint before implementation. If unavailable or paywalled, use manual fallback:
- Manual: paste draft text into Clearscope, read score, manually update `drafts.clearscope_score`.
- Automated: `POST` draft text to Clearscope API, receive score, store in `drafts.clearscope_score`.

If the API call fails, send Hassan a Telegram message: "Clearscope API unavailable. Please score manually at app.clearscope.io and reply with the score: `/set_clearscope_score [draft_id] [score]`."

**Threshold:** Score `< 80` → Gate B rejection: "Clearscope score: [N]/100 (minimum 80). Topic coverage is insufficient for the target keyword '[keyword]'."

### 8.3 Stage C — Aleyda Solis E-E-A-T GPT

**What it is:** A custom ChatGPT built by Aleyda Solis that evaluates content helpfulness and quality using Google's quality rater rubric. Free; requires ChatGPT Plus or Team.

**Integration:** Manual only in MVP. Hassan opens the GPT URL, pastes the live article URL + target query, reads the qualitative score. If acceptable, he approves in Sanity. The pipeline records the response as `drafts.eeat_score` (TEXT field).

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

**No hard numeric threshold for Stage C.** The score is qualitative and Hassan-judged.

---

## 9. Post-Publish EEAT Score Capture

### The Tool

The EEAT Score Checker is a free tool at `https://seowind.io/eeat-score-checker/` (per knowledge map §12.2 Feature B; §7). It accepts a published URL and returns:
- EEAT score 1–10 for each of the four pillars (Experience, Expertise, Authoritativeness, Trustworthiness)
- A radar chart (visual only; not parseable by automation)
- Section-by-section recommendations

No login required. Run time under 60 seconds per `seowind.io_eeat-score-checker_.md`.

### Automation

After `published_articles` row is created (by F4), the gate worker receives an `article.published` event and runs Playwright against the EEAT Score Checker:

```typescript
async function captureEEATScore(articleUrl: string): Promise<EEATScores> {
  const page = await browser.newPage();
  await page.goto('https://seowind.io/eeat-score-checker/');
  await page.fill('[type=url]', articleUrl); // URL input field
  await page.click('text=Run EEAT Audit'); // or equivalent button
  await page.waitForSelector('[data-eeat-results]', { timeout: 90000 }); // wait for results (< 60s)
  
  // Extract the four pillar scores from the DOM
  return {
    experience: extractScore(page, 'experience'),
    expertise: extractScore(page, 'expertise'),
    authoritativeness: extractScore(page, 'authoritativeness'),
    trustworthiness: extractScore(page, 'trustworthiness'),
    checkedAt: new Date().toISOString(),
  };
}
```

### Data Shape and Storage

The EEAT scores are stored in the `published_articles` table (see the DDL addition in §12):

```typescript
interface EEATScores {
  experience: number;       // 1–10
  expertise: number;        // 1–10
  authoritativeness: number; // 1–10
  trustworthiness: number;  // 1–10
  checkedAt: string;        // ISO timestamp
}
```

Stored as a JSONB column `eeat_scores` in `published_articles`. This enables:
- Tracking score improvement over time.
- Identifying articles where any pillar scores < 5 (Needs Improvement per knowledge map §12.8) for Content Update prioritization.
- Reporting in Hassan's weekly Telegram summary.

### EEAT Scoring Framework (per knowledge map §12.8)

| Score Range | Category |
|---|---|
| 8–10 | High Performance |
| 6–7 | Good Performance |
| 4–5 | Needs Improvement |
| 1–3 | Critical Issues |

Articles scoring < 5 on any pillar should be flagged for Content Update (Content Update is deferred to v2.1 per §16).

---

## 10. Functional Requirements

### 10.1 Draft Request Trigger

When `interview_sessions.status` transitions to `completed`, dispatch:

```
event: "draft.requested"
data: {
  candidateId: string,
  sessionId: string,
  confirmedChunkIds: string[],
  pillar: Pillar,
  primaryKeyword: string
}
```

### 10.2 SEOwind Brief Assembly

The gate worker assembles the `SEOwindBriefPayload` from DB data (per §6). Field-level mapping is as specified in §6.

### 10.3 Playwright Delivery

The gate worker calls `seowind-playwright.ts` with the assembled brief. The Playwright script navigates SEOwind's UI per the page-by-page flow in §5. No API calls are made to SEOwind. No `SEOWIND_API_KEY` or `SEOWIND_BRAND_VOICE_ID` env vars are referenced.

### 10.4 Brand Voice — Project-Level, Not Per-Brief

Brand Voice is set once in the SEOwind UI at the Project level and auto-applied to all briefs in that project (per knowledge map §4). The pipeline does NOT set, modify, or read brand voice per brief. Brand voice ID is not stored anywhere in our system.

Tone adjustments per brief are delivered via the `insightsText` block as plain-text instructions appended at the end.

### 10.5 Async Generation Handling

Both brief creation (1–4 min) and article generation (10–15 min) are async operations. Playwright must poll for completion signals (dashboard "Open" button; AI Editor URL redirect). Timeouts must be configured via env vars (`SEOWIND_BRIEF_CREATION_TIMEOUT_MS`, `SEOWIND_ARTICLE_GENERATION_TIMEOUT_MS`). No synchronous/blocking assumption.

### 10.6 Gate A through C (see §8)

Unchanged from v1.0 design, except that the "SEOwind score" referenced in earlier versions is now the EEAT auto-score visible in the AI Editor (best-effort extraction; not a hard requirement for gate passing).

### 10.7 Rewrite Loop

On Stage A or B failure:
1. Increment `drafts.attempt_number`.
2. If `attempt_number > 3`: set `article_candidates.status = 'shelved'`; notify Hassan; stop.
3. Append correction instructions to insights text; re-run Playwright for a new attempt.

### 10.8 EEAT Score Capture Post-Publish

On `article.published` event: run Playwright against EEAT Score Checker with the live article URL; store results in `published_articles.eeat_scores`.

---

## 11. Non-Functional Requirements

| ID | Requirement | Threshold |
|---|---|---|
| NFR-01 | Stage A evaluation speed | < 30 seconds for all 8 rules |
| NFR-02 | Stage B API call timeout | 60-second timeout; retry once on network error |
| NFR-03 | Rejection notification latency | Hassan receives Telegram within 2 minutes of gate failure |
| NFR-04 | Rewrite loop idempotency | Re-submitting the same brief twice produces the same `attempt_number` (no double-increment) |
| NFR-05 | Audit trail | Every gate run logged: which rules evaluated, pass/fail, timestamps, Playwright screenshots on failure |
| NFR-06 | Stage A false-positive rate | Monthly manual review; target < 5% false positives |
| NFR-07 | Playwright session persistence | Reuse authenticated session across runs; only re-login on session expiry |
| NFR-08 | Playwright failure visibility | On any unhandled Playwright error, capture full-page screenshot and store in `/tmp/seowind-error-{timestamp}.png`; include path in Telegram alert |

---

## 12. Technical Specifications

### 12.1 Repository Placement

```
nexfortis-content-pipeline/
  artifacts/
    gate-worker/               ← THIS FEATURE
      src/
        jobs/
          draft-generator.ts   ← handles draft.requested; assembles brief; calls Playwright
          gate-runner.ts       ← orchestrates Stage A → B → C notification
          rewrite-handler.ts   ← handles draft.rewrite_requested; rebuilds brief with corrections
          eeat-capture.ts      ← handles article.published; runs EEAT Score Checker
        integrations/
          seowind-playwright.ts ← Playwright UI automation (THE ONLY SEOwind integration)
          brief-assembler.ts   ← builds SEOwindBriefPayload from DB data
          insights-assembler.ts ← assembles insightsText from confirmed chunk IDs
          clearscope.ts        ← Stage B scorer
          openai-eeat.ts       ← Stage C: Custom GPT API attempt (aspirational)
        gates/
          stage-a.ts           ← rule evaluator; returns GateAResult[]
          stage-b.ts           ← Clearscope caller; returns GateBResult
        index.ts               ← Inngest serve handler
```

**Note: There is no `seowind.ts` (REST API client) in this architecture.** The original design had `seowind.ts` as "Path A" and `seowind-playwright.ts` as "Path B." With the confirmed absence of any SEOwind API, only `seowind-playwright.ts` exists. There is no Path A.

### 12.2 Gate A Data Types

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
  // Fail fast: stop on first failure in MVP
  return { passed: failures.length === 0, failures, evaluatedAt: new Date().toISOString() };
}
```

### 12.3 Draft Database Schema

Full DDL is in `./architecture-and-data-model.md §5.5`. Relevant status values for this feature:

```
'generating'                → Playwright in flight
'error_brief_timeout'       → brief creation timed out; needs manual intervention
'error_generation_timeout'  → article generation timed out; needs manual intervention
'error_playwright'          → unexpected Playwright error; screenshot saved
'gate_a_fail'               → Stage A rejected
'gate_b_fail'               → Stage B rejected
'gate_passed'               → all automated stages passed; waiting for Stage C / Hassan
'shelved'                   → 3 attempts exhausted
'approved'                  → Hassan approved (set by F4)
```

### 12.4 `published_articles` Schema Addition

The `eeat_scores` JSONB column must be added to the `published_articles` table (DDL in `architecture-and-data-model.md §5.6`):

```sql
ALTER TABLE published_articles
  ADD COLUMN IF NOT EXISTS eeat_scores JSONB DEFAULT NULL;
  -- stores { experience, expertise, authoritativeness, trustworthiness, checkedAt }
```

This migration is additive and non-breaking.

### 12.5 Inngest Events Produced and Consumed

| Event | Direction | Payload |
|---|---|---|
| `draft.requested` | Consumed (from F2) | `{ candidateId, sessionId, confirmedChunkIds, pillar, primaryKeyword }` |
| `draft.generated` | Produced (internal) | `{ draftId, draftText, seowindDraftUrl }` |
| `draft.rewrite_requested` | Produced + consumed | `{ draftId, gateAFailures, gateBScore }` |
| `draft.gate_passed` | Produced (to F4) | `{ draftId, clearscopeScore }` |
| `draft.shelved` | Produced | `{ candidateId, attemptCount: 3 }` |
| `article.published` | Consumed (from F4) | `{ publishedArticleId, articleUrl }` |
| `eeat.captured` | Produced | `{ publishedArticleId, eeatScores }` |

### 12.6 Environment Variables (gate-worker)

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | For Stage C Custom GPT API attempt |
| `SEOWIND_USERNAME` | SEOwind account email |
| `SEOWIND_PASSWORD` | SEOwind account password |
| `SEOWIND_PROJECT_ID` | SEOwind project ID (set once after manual project creation) |
| `SEOWIND_BASE_URL` | `https://seowind.io` |
| `PLAYWRIGHT_HEADLESS` | `true` in production |
| `PLAYWRIGHT_TIMEOUT_MS` | Default `30000` |
| `SEOWIND_ARTICLE_GENERATION_TIMEOUT_MS` | Default `900000` (15 min) |
| `SEOWIND_BRIEF_CREATION_TIMEOUT_MS` | Default `300000` (5 min) |
| `CLEARSCOPE_API_KEY` | Clearscope API key |
| `TELEGRAM_BOT_TOKEN` | Rejection/approval notifications |
| `TELEGRAM_CHAT_ID` | Hassan's chat ID |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key |
| `INNGEST_EVENT_KEY` | |
| `INNGEST_SIGNING_KEY` | |

**Removed from gate-worker env vars (these do not exist):**
- ~~`SEOWIND_API_KEY`~~ — SEOwind has no API
- ~~`SEOWIND_BRAND_VOICE_ID`~~ — brand voice is project-level, UI-managed

---

## 13. AI System Requirements

### 13.1 LLM Usage Map

| Task | Model | Rationale |
|---|---|---|
| Draft generation | SEOwind (built-in AI — Claude, GPT, or Gemini per project setting) | SEOwind's multi-agent pipeline; model selected at Project level |
| Stage C E-E-A-T check | Aleyda Solis Custom GPT (OpenAI GPT-4 under the hood) | Industry-validated rubric |
| Rewrite brief correction text | Claude Haiku | Simple instruction formatting; cost-efficient |

No direct Claude or GPT call for draft generation. SEOwind handles that internally via its Research Agent → Writing Agent → Eval & Refine Agent pipeline (per knowledge map §12.2 Feature H).

### 13.2 Evaluation

**Gate A false-positive rate:** Monthly manual review. Sample 10 Gate A rejections; how many were legitimately bad vs. incorrectly flagged? Target < 5% false positives. If higher, refine regex patterns in `stage-a.ts`.

**Clearscope calibration:** Quarterly. Compare Clearscope scores of published articles against GSC ranking positions. If high score (≥80) doesn't correlate with ranking (≥top 20 at 3 months), re-evaluate threshold.

**EEAT score trend:** Monthly review of `published_articles.eeat_scores` across all articles. Any pillar consistently < 5 → review what's missing from the Insights assembly or the corpus.

---

## 14. Acceptance Criteria

### AC-F3-01: Draft.Requested Triggers Brief Assembly (per knowledge map §5, §11)

**Given** an `interview_sessions` row transitions to `status = 'completed'`,  
**When** the `draft.requested` event fires,  
**Then:**
- A new `drafts` row is created with `status = 'generating'` and `attempt_number = 1`.
- `drafts.seowind_brief` JSONB is populated with: `focusKeyword`, `location`, `language`, `projectId`, `insightsText` (assembled from confirmed chunk IDs), `enableCompanyDetails: true`.
- `insightsText` contains redacted text from all confirmed `capture_signal` chunks in `interview_sessions.confirmed_chunk_ids`.
- `drafts.seowind_brief` does NOT contain `brandVoiceId`, `apiKey`, or any field suggesting API integration.

### AC-F3-02: Playwright Login Succeeds

**Given** valid credentials in `SEOWIND_USERNAME` and `SEOWIND_PASSWORD`,  
**When** `seowind-playwright.ts` runs,  
**Then:**
- Playwright navigates to `https://seowind.io/app/authentication/login/`.
- Fills email and password fields.
- Submits and waits for redirect to dashboard.
- If redirect does not occur within 10s, checks for MFA prompt and alerts Hassan.

### AC-F3-03: Brief Created and Opened (per knowledge map §2, §6)

**Given** Playwright is logged in,  
**When** the brief creation flow runs,  
**Then:**
- Clicks "Create Article" button.
- Fills Focus Keyword, Location, Language, Project in the modal.
- Submits the modal.
- Polls the dashboard for up to `SEOWIND_BRIEF_CREATION_TIMEOUT_MS` until an "Open" button appears for the brief with matching keyword.
- Clicks "Open" and navigates to the brief detail page.

### AC-F3-04: Insights and Company Details Populated (per knowledge map §3, §12.1, §12.5)

**Given** Playwright is on the brief detail page,  
**When** the brief detail configuration runs,  
**Then:**
- Toggles ON "Your Insights and Instructions."
- Fills the textarea with `insights_text` (no truncation if within `MAX_INSIGHTS_CHARS`).
- Toggles ON "Company Details."
- Verifies AI Outline is populated (clicks "Get AI Outline" → "Select All" → "Add selected" if empty).
- `SEOWIND_BRAND_VOICE_ID` is never referenced — brand voice is already set at project level.

### AC-F3-05: AI Article Generation Completes

**Given** the brief is fully configured,  
**When** "Generate AI Article" is clicked,  
**Then:**
- Playwright waits for URL to change to the AI Editor URL pattern.
- Wait is bounded by `SEOWIND_ARTICLE_GENERATION_TIMEOUT_MS`.
- If timeout exceeded: `drafts.status = 'error_generation_timeout'`; Hassan alerted.
- On success: article text extracted from AI Editor DOM; stored in `drafts.draft_text`.
- `drafts.seowind_draft_url` is populated with the AI Editor page URL.

### AC-F3-06: Stage A Pass (per §8.1)

**Given** a draft contains ≥2 corpus citations, no generic phrases, ≥100 transcribed words of Hassan, no clickbait title, present author byline ("Hassan Sadiq"), present bio block, no unsourced statistics, ≥1 first-person phrase,  
**When** Stage A runs,  
**Then:**
- `GateAResult.passed` is `true`.
- `GateAResult.failures` is an empty array.
- Gate proceeds to Stage B.

### AC-F3-07: Stage A Reject — Specific Error

**Given** a draft contains "leveraging cutting-edge solutions" in paragraph 3,  
**When** Stage A runs rule GA-02,  
**Then:**
- `GateAResult.passed` is `false`.
- `GateAResult.failures[0].ruleId` is `"GA-02"`.
- `GateAResult.failures[0].quotedViolation` contains `"leveraging cutting-edge solutions"`.
- Hassan receives a Telegram message within 2 minutes containing the quoted violation.
- `drafts.status` is `"gate_a_fail"`.

### AC-F3-08: Stage B Pass

**Given** Stage A passed and Clearscope returns 82,  
**When** Stage B runs,  
**Then:**
- `drafts.clearscope_score` is `82`.
- `drafts.status` is `"gate_passed"`.
- `draft.gate_passed` event dispatched.

### AC-F3-09: Rewrite Loop — 3rd Attempt Shelved

**Given** a draft has `attempt_number = 3` and Stage A fails again,  
**When** the gate runner evaluates the result,  
**Then:**
- No further Playwright runs.
- `drafts.status = "shelved"`.
- `article_candidates.status = "shelved"`.
- Hassan receives the shelved notification.
- `draft.shelved` Inngest event dispatched.

### AC-F3-10: EEAT Score Captured Post-Publish (per knowledge map §7, §12.2 Feature B)

**Given** an `article.published` event fires with a live article URL,  
**When** `eeat-capture.ts` runs,  
**Then:**
- Playwright navigates to `https://seowind.io/eeat-score-checker/`.
- Submits the article URL.
- Waits up to 90s for results.
- Extracts Experience, Expertise, Authoritativeness, Trustworthiness scores (1–10 each).
- Stores in `published_articles.eeat_scores` JSONB.
- Dispatches `eeat.captured` Inngest event.

### AC-F3-11: Brand Voice Never Automated

**Given** any run of the gate worker or Playwright automation,  
**When** the code is inspected by a reviewer,  
**Then:**
- No reference to `SEOWIND_BRAND_VOICE_ID` exists in any source file.
- No reference to `SEOWIND_API_KEY` exists in any source file.
- No code attempts to set, modify, or read brand voice via any URL or API endpoint.
- Brand voice configuration exists only in the SEOwind UI (Project settings), set once by Hassan.

### AC-F3-12: No API Endpoint Referenced

**Given** the gate worker codebase,  
**When** a full text search is run for `api.seowind.io`, `api/v1/documents`, `SEOWIND_API_KEY`,  
**Then:**
- Zero matches found.
- All SEOwind interaction is via Playwright browser automation.

---

## 15. Stop Conditions for Implementers

These are hard rules for Cursor agents and Claude Code. Violating them requires creating a new PR after explicit human discussion with Hassan.

**SC-01 — NEVER assume a SEOwind API exists.**  
SEOwind has no REST API, GraphQL, webhook, Zapier, Make.com, or n8n integration as of this writing (per knowledge map §12.4). If you believe one has appeared, stop and ask Hassan before building. Do not speculatively build an API client.

**SC-02 — NEVER hardcode or reference a brand voice ID.**  
There is no `SEOWIND_BRAND_VOICE_ID` environment variable. Brand voice is set in the SEOwind Projects UI by Hassan, once, and applied automatically to all briefs in the project. No code in this repo reads, writes, or references a brand voice ID.

**SC-03 — ALWAYS handle async generation timeout explicitly.**  
The article generation wait (up to 15 minutes) must be bounded by `SEOWIND_ARTICLE_GENERATION_TIMEOUT_MS`. A missing or infinite wait will leave the Inngest function running until Render times out, wasting compute and leaving a `drafts` row stuck in `'generating'` forever.

**SC-04 — NEVER set brand voice per-brief in the article writer flow.**  
The article writer brief form has no per-brief brand voice override toggle (per knowledge map §12.1 Correction A). Attempting to programmatically set brand voice via the brief form will either do nothing or break the automation. Tone adjustments go in the Insights textarea, not in a brand voice field.

**SC-05 — DO NOT touch any code file.**  
This is a docs-only PR for the rewrite. Do not modify `package.json`, `tsconfig.json`, or any TypeScript source file. When implementing features from this PRD in a separate implementation PR, follow the allowed-files list in the relevant Cursor prompt.

**SC-06 — DO NOT build the manual outline editor automation as a first step.**  
The outline editor is the highest-complexity automation surface (per knowledge map §6). Start with the AI Outline generation popup ("Get AI Outline" → "Select All" → "Add selected"). Only build manual outline injection if a specific `article_candidates.outline_structure` field is populated and the need is confirmed by Hassan.

**SC-07 — ALWAYS store `seowind_draft_url` from the AI Editor URL.**  
This is the persistent reference to the draft in SEOwind. It allows Hassan to manually open the draft in SEOwind for inspection. Never discard this URL after extraction.

**SC-08 — ALWAYS screenshot on Playwright failure.**  
Any unhandled Playwright error must capture a full-page screenshot (`page.screenshot({ fullPage: true })`), save it to `/tmp/seowind-error-{timestamp}.png`, and include the path in the Telegram alert to Hassan. This is essential for diagnosing UI changes.

---

## 16. Out of Scope

| Item | Rationale |
|---|---|
| SEOwind REST API integration | No API exists (per knowledge map §12.4). Confirmed by exhaustive search of 627 docs. |
| Brand voice automation per brief | Brand voice is project-level, UI-managed, one-time setup. No per-brief override exists for new article briefs (per knowledge map §4, §12.1). |
| Per-section or per-heading Insights injection | The Insights field is a single whole-article textarea. No per-section routing exists in SEOwind's current UI (per knowledge map §3). |
| Content Update automation (SEOwind tab) | Deferred to v2.1. The Content Update workflow is a separate SEOwind feature requiring a different Playwright flow (per knowledge map §2 Step 17, §12.2 Feature E). |
| SEO Missions automation | Deferred to v2.1. SEO Missions is a keyword gap analysis feature separate from article generation (per knowledge map §2 Step 18). |
| Internal linking for non-NexFortis projects | GSC integration is project-specific and configured by Hassan for NexFortis.com only. |
| Draft generation without SEOwind | SEOwind's SERP-grounded brief + multi-agent pipeline is the reason for using the tool. Direct LLM calls bypass this. |
| Automatic Stage C scoring | Stage C is qualitative and requires Hassan's judgment. Full automation is a v2.1 aspiration. |
| Social post generation | Handled by the distribution layer (outside F3 scope). |
| AI Humanizer automation | Optional feature; can be evaluated post-launch if articles feel robotic. Not in v2 scope. |
| Google Docs brief export | Brief export to Google Docs is a human convenience feature; not needed for pipeline automation. |

---

## 17. Shared Resources

| System | Shared? | Notes |
|---|---|---|
| Supabase project | ✅ Yes | Reads `interview_sessions`, `article_candidates`, `capture_signals`; writes `drafts`, `published_articles.eeat_scores` |
| SEOwind | Separate service | UI automation via Playwright. No API key. No brand voice ID. |
| Clearscope | Separate service | Stage B scorer. API key in gate-worker env vars. |
| Sanity project | ✅ Yes | Gate worker does NOT write to Sanity; F4 (sanity-bridge) does |
| Telegram Bot | ✅ Yes | Rejection, approval, and Stage C instruction notifications |
| OpenAI account | Recommended separate key | Stage C Custom GPT API attempt (aspirational) |
