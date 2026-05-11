# Feature PRD — Sanity Review & Publish Workflow (F4)

**Document Owner:** Hassan Sadiq, NexFortis  
**Parent Epic:** [NexFortis Automated Content Pipeline v2](../epic-prd.md)  
**Depends On:** F3 (draft must pass quality gate; `draft.gate_passed` event must fire)  
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

The final step in v1 was straightforward but had two failure modes: (1) Hassan would get a notification and ignore it, leaving a good draft rotting in a queue for weeks; (2) when he did approve, the publish workflow was manually triggered with no automatic ISR revalidation or Indexing API ping. The result: articles that Google took days to discover, and no distribution queue.

### Solution

The sanity-bridge artifact pushes a quality-gated draft into Sanity Studio as a structured document with all metadata populated — scores, corpus citation IDs, pillar, keyword. Hassan gets a Telegram notification with a direct Sanity link and an honest time estimate ("5-minute review"). His approval is one button in Sanity Studio; a webhook fires the entire downstream sequence: ISR revalidation on the Next.js blog, Google Indexing API ping, social distribution queue entry. A reject path sends the reason back through the pipeline as a new `draft.rewrite_requested` event. Edge cases (stale draft, later major edit) are handled with re-revalidation triggers.

### Impact

| Outcome | How Measured | Target |
|---|---|---|
| Hassan's review time | Sanity audit log: time between draft arrival and approve action | ≤8 minutes average |
| Time-to-index after publish | Google Indexing API response vs GSC first impression | ≤48 hours |
| Approve rate on first review | `published_articles` count / `drafts with status gate_passed` | ≥80% |
| 7-day escalation effectiveness | % of escalated drafts approved within 24h of escalation | ≥70% |

---

## 2. User Personas

### Hassan Sadiq — Final Approver

Receives a Telegram message. Opens Sanity Studio on his phone or laptop. Reads the draft, optionally edits inline, clicks "Approve" in the custom Sanity document action. That is the entirety of his interaction. He does not touch code, env vars, or Render. On rejection, he types a short reason in a Sanity field and clicks "Reject."

### Cursor Agents / Claude Code — Primary Implementer

Operates inside `artifacts/sanity-bridge/` in the `nexfortis-content-pipeline` repository. Also writes the Sanity document type schema (a `schema.ts` file that gets deployed to the Sanity project — same project used by the main site). Does not modify the Next.js blog's rendering code; ISR revalidation is triggered via the Next.js revalidate API endpoint already present in the main site. Opens draft PRs; does not merge. Respects `AGENTS.md` and `.cursorrules` as stable system-prompt injection.

---

## 3. User Stories

**US-F4-00 — Implementer scope (Cursor agent / Claude Code)**  
As the implementer (Cursor agent / Claude Code) receiving a prompt for this feature, I want an explicit list of which Sanity schema types I may add, which Next.js endpoints I may call (but not modify), which Supabase tables I write to, edge cases to handle explicitly, and what the PR must contain, so I can implement the sanity-bridge without touching the live blog's rendering code.

**US-F4-01 — Draft arrives in Sanity (happy path)**  
As Hassan, I want a draft article to appear in Sanity Studio immediately after it passes the quality gate, so that my review is of a fully formatted document — not raw text in a Telegram message.

**US-F4-02 — Review notification with metadata**  
As Hassan, I want the Telegram notification to include the article title, word count, SEOwind score, Clearscope score, and a direct deep link to the Sanity draft, so that I can decide in 10 seconds whether to open the review or defer it.

**US-F4-03 — Approve from Sanity**  
As Hassan, I want a clearly labeled "Approve" action in Sanity Studio — not a status dropdown, a real button — that publishes the document and triggers the full downstream sequence, so that approval is a single deliberate action I can't accidentally trigger.

**US-F4-04 — Publish triggers downstream automatically**  
As the pipeline system, when Hassan clicks Approve, I want the following to happen automatically and in order without any further action from Hassan: (1) Sanity publishes the document, (2) Next.js ISR revalidates `/blog/[slug]`, (3) Google Indexing API is pinged, (4) a social distribution queue entry is created, so that the article is live and indexed within minutes of approval.

**US-F4-05 — Reject with reason flows back to pipeline**  
As Hassan, when I reject a draft in Sanity, I want to type a short reason (e.g., "The section on Named Locations is wrong — Conditional Access doesn't work that way") and click "Reject," and I want that reason to flow back into the pipeline as a rewrite request, so I don't have to fix the article myself.

**US-F4-06 — 7-day escalation**  
As the pipeline system, when a draft has been sitting in Sanity unreviewed for 7 days, I want to send Hassan a follow-up Telegram message with slightly higher urgency ("This draft is 7 days old — quick 5-min review when you get a chance?") so it doesn't quietly expire.

**US-F4-07 — Medium cross-post queued automatically**  
As the pipeline system, after a blog post publishes, I want the Medium cross-post to be automatically scheduled for exactly 14 days later (not sooner), so that Google indexes the blog version as canonical before Medium sees the content.

**US-F4-08 — Re-revalidation after major edit**  
As Hassan, when I make a substantial edit to a published article (adding a new section, updating statistics), I want to be able to click a "Re-publish" action in Sanity Studio that re-triggers the ISR revalidation and Indexing API ping, so that Google's index and the live site stay in sync without a manual deployment.

**US-F4-09 — Edge case: publish webhook fails**  
As the pipeline system, if the ISR revalidation webhook call fails (the Next.js site is down or the endpoint returns an error), I want the failure to be logged, a Telegram alert sent to Hassan, and the system to retry 3 times at 5-minute intervals before giving up, so that a transient outage doesn't silently leave an approved article un-revalidated.

**US-F4-10 — Edge case: Indexing API quota**  
As the pipeline system, if the Google Indexing API returns a 429 (quota exceeded), I want the ping to be retried the next day via an Inngest scheduled step, and Hassan to be notified that indexing is delayed, so he knows the article may take longer to appear in Google.

---

## 4. Functional Requirements

### 4.1 Sanity Document Schema

The sanity-bridge deploys a `post` document type (or extends the existing one if it already exists in the Sanity project). This schema must match whatever the Next.js blog already expects — coordinate with the existing Sanity schema before adding fields.

**Schema fields:**

| Field | Type | Notes |
|---|---|---|
| `_id` | string | Sanity auto-generated |
| `title` | string | Required |
| `slug` | slug | Auto-derived from title; editable |
| `body` | array (Portable Text) | Main content |
| `pillar` | string (enum) | `quickbooks` / `managed-it` / `cybersecurity` |
| `primary_keyword` | string | From `article_candidates` |
| `secondary_keywords` | string[] | From SERP gap analysis |
| `pillar_cluster_parent` | reference | Ref to pillar page document |
| `corpus_citations` | string[] | Array of `capture_signal` UUIDs |
| `author` | reference | Ref to Hassan's author document |
| `bio_snapshot` | text | Snapshot of bio at time of publish (so edits to author doc don't retroactively change old articles) |
| `eeat_score` | text | Stage C result (qualitative text) |
| `clearscope_score` | number | Stage B score |
| `seowind_score` | number | SEOwind optimization score |
| `capture_signal_count` | number | Count of confirmed corpus chunks |
| `draft_attempt_number` | number | How many rewrite attempts |
| `status` | string (enum) | `draft` / `approved` / `published` / `archived` |
| `scheduled_publish_at` | datetime | Optional; for scheduling future publication |
| `pipeline_draft_id` | string | UUID of `drafts` row in Supabase (for webhook correlation) |

**Sanity document actions (custom):**
- **Approve** — transitions `status` from `draft` to `approved`; fires Sanity webhook to the `sanity-bridge` webhook handler.
- **Reject** — opens a modal asking for a rejection reason (string); transitions `status` to `archived`; fires Sanity webhook with reason.
- **Re-publish** — for already-published documents; fires revalidate + Indexing API ping only (does not change status).

### 4.2 Draft Push to Sanity

Triggered by the `draft.gate_passed` Inngest event. The sanity-bridge:

1. Fetches the full draft text from `drafts.seowind_draft_url` (or `drafts.draft_text` JSONB if stored directly).
2. Converts the draft from HTML/Markdown to Sanity Portable Text using `@portabletext/to-portable-text` or equivalent.
3. Creates a Sanity document via the Content API:
   ```
   POST https://[projectId].api.sanity.io/v2021-06-07/data/mutate/[dataset]
   Authorization: Bearer $SANITY_WRITE_TOKEN
   ```
4. Sets `status = 'draft'` in Sanity (not published to the live site).
5. Stores the returned Sanity `_id` in `drafts.sanity_doc_id`.
6. Updates `drafts.status` to `'in_sanity_review'`.
7. Sends Hassan the review notification Telegram message.

### 4.3 Telegram Review Notification

Message format:
```
📝 Article ready for review:
"[title]"

Pillar: [pillar]
Keyword: [primary_keyword]
Words: [word_count]
SEOwind: [seowind_score]/100
Clearscope: [clearscope_score]/100
Corpus citations: [capture_signal_count]
Draft attempt: [attempt_number]

Open in Sanity Studio:
[deep link to Sanity Studio draft document]

Estimated review time: 5 minutes.
```

Deep link format: `https://nexfortis.sanity.studio/desk/post;[document_id]`

### 4.4 Approve Webhook Handler

The Sanity webhook fires a `POST` to the sanity-bridge's `/webhooks/sanity` endpoint when the Approve action is triggered.

Webhook payload (Sanity GROQ filter on publish):
```json
{
  "_id": "...",
  "status": "approved",
  "pipeline_draft_id": "...",
  "slug": { "current": "..." }
}
```

On receipt, the sanity-bridge:
1. Verifies the webhook secret header (`SANITY_WEBHOOK_SECRET`).
2. Publishes the Sanity document (transition from draft to published state).
3. Calls the Next.js revalidate endpoint: `POST https://nexfortis.com/api/revalidate?secret=$NEXT_REVALIDATE_SECRET&path=/blog/[slug]`
4. Calls Google Indexing API: `POST https://indexing.googleapis.com/v3/urlNotifications:publish` with `{ url: "https://nexfortis.com/blog/[slug]", type: "URL_UPDATED" }`.
5. Creates a social distribution queue entry (Missinglettr or SocialBee webhook, or RSS detection — per the chosen tool).
6. Schedules a Medium import Inngest event for 14 days later.
7. Updates `published_articles` row in Supabase.
8. Sends Hassan a publish confirmation Telegram message.

**Publish confirmation format:**
```
🚀 Published!
"[title]"
https://nexfortis.com/blog/[slug]

Google Indexing API: pinged ✅
ISR revalidate: done ✅
Social posts: scheduled for [date] ✅
Medium import: scheduled for [date — 14 days] ✅
```

### 4.5 Reject Webhook Handler

On receipt of a reject webhook:
1. Stores the rejection reason in `drafts.rejection_reason`.
2. Updates `drafts.status` to `'rejected_by_hassan'`.
3. Dispatches `draft.rewrite_requested` event with the reason as an additional `human_feedback` field in the payload (alongside any gate failures from F3).
4. Sends a Telegram acknowledgment: "Rejection noted. The pipeline will generate a revised draft addressing your feedback."

If `drafts.attempt_number` is already 3, shelf the candidate instead.

### 4.6 7-Day Stale Draft Escalation

An Inngest scheduled step fires 7 days after each draft enters `in_sanity_review`. If the draft is still in `in_sanity_review` at that point:
1. Send escalation Telegram: "This draft has been waiting 7 days. Take 5 minutes to review or reject it: [Sanity link]"
2. Set a `escalation_sent_at` timestamp in `drafts` JSONB.
3. Do not send a second escalation. After 14 days with no action, notify Hassan once more and set `drafts.status = 'stale_draft'`. Do not automatically archive.

### 4.7 Medium Cross-Post Scheduling

The Inngest event `medium.import.scheduled` is dispatched at publish time with a `scheduledFor` value of 14 days in the future. When it fires:
1. Send a Telegram message to Hassan: "Time to import to Medium. Use the Import Tool: [https://medium.com/p/import](https://medium.com/p/import). Paste this URL: [nexfortis.com/blog/slug]"
2. Log the import reminder in `published_articles.medium_import_reminded_at`.

The actual Medium import is manual (Hassan uses Medium's Import Tool). Fully automated Medium import is a v2.1 enhancement (Medium's API does not support programmatic import in a straightforward way as of v2).

### 4.8 Re-Revalidation (After Major Edits)

When Hassan clicks the "Re-publish" action in Sanity Studio on an already-published document:
1. Sanity fires the same webhook endpoint with `type: "re_publish"`.
2. The bridge repeats steps 3–4 from §4.4 (revalidate + Indexing API ping only — no social, no Medium, no new `published_articles` row).
3. Updates `published_articles.last_revalidated_at`.
4. Sends Hassan: "Re-published. ISR revalidated and Google Indexing API re-pinged. ✅"

---

## 5. Non-Functional Requirements

| ID | Requirement | Threshold |
|---|---|---|
| NFR-01 | Draft-to-Sanity push latency | Draft appears in Sanity Studio within 60 seconds of `draft.gate_passed` event |
| NFR-02 | Approve-to-live latency | Article live on nexfortis.com within 2 minutes of Hassan's Approve click |
| NFR-03 | Indexing API ping latency | Ping sent within 30 seconds of Sanity publish |
| NFR-04 | Webhook idempotency | Receiving the same Sanity webhook twice (network retry) does not publish twice |
| NFR-05 | ISR revalidation retry | 3 retries at 5-minute intervals on failure before Hassan is alerted |
| NFR-06 | Sanity write token scope | Write token scoped to `post` document type only; does not have admin rights |

---

## 6. Technical Specifications

### 6.1 Repository Placement

```
nexfortis-content-pipeline/
  artifacts/
    sanity-bridge/             ← THIS FEATURE
      src/
        jobs/
          push-to-sanity.ts    ← handles draft.gate_passed event
          medium-reminder.ts   ← handles medium.import.scheduled event
          stale-draft.ts       ← 7-day escalation check
        webhooks/
          sanity-webhook.ts    ← POST /webhooks/sanity handler (approve + reject + re-publish)
        integrations/
          sanity-client.ts     ← Sanity Content API client
          revalidate.ts        ← Next.js ISR revalidate caller
          indexing-api.ts      ← Google Indexing API caller
          social-queue.ts      ← Missinglettr or SocialBee queue entry
        index.ts               ← Express or Hono HTTP server + Inngest serve
      sanity/
        schemas/
          post.ts              ← Sanity document type definition
          actions/
            approve.ts         ← Sanity Studio custom action
            reject.ts
            republish.ts
```

**Important:** The `sanity/schemas/post.ts` file in this artifact defines the document type. It is deployed to the Sanity project using `sanity deploy` from within this directory — NOT from the main monorepo. The main Next.js site's Sanity Studio configuration may already have a `post` type. The sanity-bridge schema must be merged with (not replace) the existing type.

**Coordination required:** Before the implementer (Cursor agent / Claude Code) runs this prompt, Hassan must confirm whether the main monorepo's Sanity Studio already has a `post` schema, and if so, export it so the sanity-bridge can extend it correctly. This is documented as a `// TODO(hassan): confirm existing Sanity post schema before implementing` in the scaffold.

### 6.2 Sanity Content API Mutation

```typescript
// artifacts/sanity-bridge/src/integrations/sanity-client.ts
import { createClient } from "@sanity/client";

export const sanityClient = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  token: process.env.SANITY_WRITE_TOKEN,
  apiVersion: "2021-06-07",
  useCdn: false,
});

export async function pushDraftToSanity(draft: DraftPayload): Promise<string> {
  const doc = buildSanityDocument(draft);  // converts to Portable Text, maps fields
  const result = await sanityClient.create(doc);
  return result._id;
}
```

### 6.3 Next.js ISR Revalidate

The existing `NexFortis-Website-Design-pro` Next.js site must already expose an on-demand ISR revalidate API route. This is a standard Next.js pattern. The sanity-bridge calls it:

```typescript
// artifacts/sanity-bridge/src/integrations/revalidate.ts
export async function revalidateBlogSlug(slug: string): Promise<void> {
  const url = `${process.env.NEXFORTIS_SITE_URL}/api/revalidate`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: process.env.NEXT_REVALIDATE_SECRET,
      path: `/blog/${slug}`,
    }),
  });
  if (!resp.ok) throw new RevalidateError(`ISR revalidate failed: ${resp.status}`);
}
```

`NEXFORTIS_SITE_URL` = `https://nexfortis.com` in production.

**The sanity-bridge does NOT modify the main monorepo's revalidate endpoint.** It only calls it. If the endpoint doesn't exist in the main site, Hassan must add it separately as a one-time setup task (not part of the sanity-bridge Cursor prompt).

### 6.4 Google Indexing API

Uses a service account with `indexing.googleapis.com` scope. The service account JSON key is stored as `GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON` env var (base64-encoded).

```typescript
// artifacts/sanity-bridge/src/integrations/indexing-api.ts
import { GoogleAuth } from "google-auth-library";

export async function pingIndexingAPI(url: string): Promise<void> {
  const auth = new GoogleAuth({
    credentials: JSON.parse(
      Buffer.from(process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON!, "base64").toString()
    ),
    scopes: ["https://www.googleapis.com/auth/indexing"],
  });
  const client = await auth.getClient();
  await client.request({
    url: "https://indexing.googleapis.com/v3/urlNotifications:publish",
    method: "POST",
    data: { url, type: "URL_UPDATED" },
  });
}
```

### 6.5 Webhook Security

Sanity webhooks are verified using the `SANITY_WEBHOOK_SECRET` header. The bridge verifies this on every incoming webhook before processing.

```typescript
import { isValidSignature, SIGNATURE_HEADER_NAME } from "@sanity/webhook";

export function verifySanityWebhook(req: Request, body: string): boolean {
  const signature = req.headers.get(SIGNATURE_HEADER_NAME);
  return isValidSignature(body, signature, process.env.SANITY_WEBHOOK_SECRET!);
}
```

### 6.6 Environment Variables

| Variable | Description |
|---|---|
| `SANITY_PROJECT_ID` | Sanity project ID (shared with main site) |
| `SANITY_DATASET` | Sanity dataset name (e.g., `production`) |
| `SANITY_WRITE_TOKEN` | Token scoped to `post` document writes |
| `SANITY_WEBHOOK_SECRET` | Webhook signature verification secret |
| `NEXT_REVALIDATE_SECRET` | Secret for the main site's `/api/revalidate` endpoint |
| `NEXFORTIS_SITE_URL` | `https://nexfortis.com` |
| `GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON` | Base64-encoded service account JSON |
| `TELEGRAM_BOT_TOKEN` | |
| `TELEGRAM_CHAT_ID` | |
| `SUPABASE_URL` | |
| `SUPABASE_SERVICE_ROLE_KEY` | |
| `INNGEST_EVENT_KEY` | |
| `INNGEST_SIGNING_KEY` | |

---

## 7. AI System Requirements

No LLM calls in this feature. The sanity-bridge is a pure data pipeline: it transforms structured draft data into Sanity documents, handles webhooks, and calls external APIs. The complexity is in the data transformation and webhook choreography, not in AI inference.

If future requirements demand AI-generated social post copy at publish time, that would be a new sub-feature using Claude Haiku. Not in scope for v2.

---

## 8. Acceptance Criteria

### AC-F4-01: Draft Pushed to Sanity

**Given** a `draft.gate_passed` event fires with a valid `draftId`,  
**When** the sanity-bridge push-to-sanity job runs,  
**Then:**
- A Sanity document with `_type: "post"` and `status: "draft"` is created within 60 seconds.
- The document is NOT in Sanity's published state (not visible on nexfortis.com).
- `drafts.sanity_doc_id` in Supabase is set to the returned Sanity `_id`.
- Hassan receives the review notification Telegram message with all metadata fields populated.
- The deep link in the Telegram message opens the correct Sanity Studio document.

### AC-F4-02: Approve Triggers Full Sequence

**Given** a Sanity document is in draft state and Hassan clicks the Approve action,  
**When** the Sanity webhook fires and the bridge processes it,  
**Then:**
- The Sanity document transitions to published state.
- The Next.js ISR revalidate endpoint is called for `/blog/[slug]` within 30 seconds.
- The Google Indexing API ping is sent within 30 seconds.
- A social distribution queue entry is created.
- A `medium.import.scheduled` Inngest event is scheduled for exactly 14 days later.
- A `published_articles` row is inserted in Supabase with `published_at` set to the current timestamp.
- Hassan receives the publish confirmation Telegram message within 2 minutes.

### AC-F4-03: Idempotent Webhook

**Given** a network error causes Sanity to send the approve webhook twice,  
**When** the bridge processes the second webhook for the same `pipeline_draft_id`,  
**Then:**
- The Sanity document is not published a second time.
- The ISR revalidate is not called a second time.
- The `published_articles` table has exactly one row for this draft.
- The second webhook is acknowledged with 200 and logged as a duplicate.

### AC-F4-04: Reject Flows Back to Pipeline

**Given** Hassan clicks Reject in Sanity Studio and types "The Conditional Access section is factually wrong — MFA claims token is not the same as Named Locations",  
**When** the reject webhook fires,  
**Then:**
- `drafts.rejection_reason` is set to the typed reason.
- `drafts.status` is set to `'rejected_by_hassan'`.
- A `draft.rewrite_requested` Inngest event fires with `human_feedback: "The Conditional Access section..."` in the payload.
- Hassan receives a Telegram acknowledgment within 30 seconds.
- If `drafts.attempt_number` is 3, the candidate is shelved instead.

### AC-F4-05: 7-Day Stale Escalation

**Given** a draft was pushed to Sanity 7 days ago and `drafts.status` is still `'in_sanity_review'`,  
**When** the stale-draft Inngest step fires,  
**Then:**
- Hassan receives one escalation Telegram message with the direct Sanity link.
- `drafts.escalation_sent_at` is set.
- No second escalation is sent within the next 7 days.

### AC-F4-06: Re-Revalidation

**Given** an article is already published and Hassan clicks "Re-publish" in Sanity,  
**When** the webhook fires with `type: "re_publish"`,  
**Then:**
- The Next.js ISR revalidate is called for the slug.
- The Google Indexing API ping is sent.
- `published_articles.last_revalidated_at` is updated.
- No new `published_articles` row is created.
- No social posts or Medium reminders are queued.
- Hassan receives: "Re-published. ISR revalidated and Google Indexing API re-pinged. ✅"

### AC-F4-07: ISR Revalidate Failure Retry

**Given** the Next.js site is temporarily unavailable when the approve webhook fires,  
**When** the first ISR revalidate call returns a 503,  
**Then:**
- The call is retried twice more at 5-minute intervals.
- After 3 failures, Hassan receives a Telegram alert: "ISR revalidate failed after 3 attempts. Article is published in Sanity but the live site may be stale. Trigger a manual redeploy on Render."
- The failure is logged in the bridge's error log.

---

## 8b. Shared Resources

| System | Shared? | Notes |
|---|---|---|
| Supabase project | ✅ Yes — same project | Writes `published_articles`; reads `drafts` |
| Sanity project | ✅ Yes — same project | Writes post documents; shares Studio with main site |
| Next.js blog (`NexFortis-Website-Design-pro`) | ✅ Yes — calls its API | Bridge calls the revalidate endpoint; does NOT modify any files in that repo |
| Google Indexing API | Separate service account | New setup; service account JSON stored in env vars |
| Telegram Bot | ✅ Yes — same bot token | |
| Microsoft Entra ID | ❌ Not used | |
| SEOwind / Clearscope | ❌ Not used | F3 responsibility |

---

## 9. Out of Scope

| Item | Rationale |
|---|---|
| Automated social post copy generation | Social copy is handled by Missinglettr/SocialBee after RSS detection; not authored by this pipeline. |
| Full Medium API integration | Medium's API does not support programmatic article creation in a maintainable way. The 14-day reminder + Hassan using Import Tool is the v2 approach. |
| Scheduled publication (future date) | `scheduled_publish_at` field exists in the schema but the scheduling logic is not implemented in v2. Inngest `step.sleepUntil` can enable this in v2.1. |
| Content A/B testing | Out of scope for a solo operator at this volume. |
| Rollback (unpublish) | Not yet supported. A manual Sanity "unpublish" action by Hassan is the fallback. |
| Modifying Next.js blog rendering code | The bridge calls the existing revalidate endpoint only. Rendering changes are outside this repo's scope. |
