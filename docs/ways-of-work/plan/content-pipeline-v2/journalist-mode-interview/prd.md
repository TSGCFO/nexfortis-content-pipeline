# Feature PRD — Journalist-Mode Telegram Interview Bot (F2)

**Document Owner:** Hassan Sadiq, NexFortis  
**Parent Epic:** [NexFortis Automated Content Pipeline v2](../epic-prd.md)  
**Depends On:** F1 — Continuous Capture & Synthesis Layer (corpus and `article_candidates` table must exist)  
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
9. [Out of Scope](#9-out-of-scope)

---

## 1. Goal

### Problem

v1's interview bot asked generic questions every Monday, regardless of what Hassan had actually been working on. The quality of every article depended entirely on whether Hassan could spontaneously recall and articulate relevant expertise on demand. Some weeks he could; many weeks he couldn't. The system had no memory of his work, so every interview started cold.

### Solution

The journalist-mode bot enters every interview already holding a folder of evidence gathered from the capture corpus. It does not ask "what did you work on this week?" It says: "Last Tuesday at roughly 2 PM you spent about 40 minutes debugging error AADSTS50158 with Claude. That looks like a real client situation. Can you confirm?" Hassan's cognitive load drops from "generate insight from scratch" to "confirm, clarify, or skip." The confirmation pattern is the core innovation: the bot validates evidence before the article uses it, ensuring that every specifics-grounded claim in the final draft has Hassan's explicit blessing.

### Impact

| Outcome | How Measured | Target |
|---|---|---|
| Reduce Hassan's weekly content time | Telegram session duration logs | ≤10 minutes per week |
| High interview completion rate | Bot completion flag vs. initiated sessions | ≥90% of sessions completed |
| Confirmed evidence in every article | `interview_sessions.confirmed_chunk_ids` count | ≥3 confirmed corpus chunks per candidate |
| Bot is never generic | Absence of default open-ended questions in sessions where ≥1 confirmation question is answered | 100% of sessions have ≥1 context-grounded question |

---

## 2. User Personas

### Hassan Sadiq — Interview Subject

Receives the bot Monday morning. Likely on his phone. May be between client calls. Cannot spend more than 10 minutes. Responds via voice note (preferred), text, or inline button. Does not configure the bot; he only responds to it.

### Cursor Agents / Claude Code — Primary Implementer

Receives structured prompts with an explicit scope boundary inside the **`nexfortis-content-pipeline` repository**. Primary files for this feature: `artifacts/telegram-bot/src/` and `artifacts/telegram-bot/src/jobs/interview-session.ts`. Must not modify Sanity schema, the Next.js site, or `lib/db/` schemas. Must not read or reference files in the `NexFortis-Website-Design-pro` repository. Opens draft PRs; does not merge. Respects `AGENTS.md` and `.cursorrules` as stable system-prompt injection.

### Future Contractor

May be handed the Telegram bot module in isolation. The conversation state machine in §6.3 is designed to be readable without context from other features.

---

## 3. User Stories

**US-F2-00 — Implementer scope clarity (Cursor agent / Claude Code)**  
As the implementer (Cursor agent / Claude Code) receiving a prompt for this feature, I want an explicit list of which files I may create or modify, which database tables I may write to, edge cases to handle, and what constitutes "done" for each prompt, so I can implement and verify completion without drifting outside the scoped task.

**US-F2-01 — Topic preview before questions (happy path)**  
As Hassan, I want to receive a short preview message first — "This week: Conditional Access policies for iOS Authenticator. Found 3 things in your work this week — ready for a quick confirm?" — so I know what the interview is about and can mentally context-switch before the questions start.

**US-F2-02 — Confirmation-first questions**  
As Hassan, I want each question to reference something specific from my actual week's work (a conversation, an error code, a meeting) rather than asking me to recall topics generally, so that answering takes 15–30 seconds of confirmation rather than 2–3 minutes of recollection.

**US-F2-03 — Voice note answers**  
As Hassan, I want to answer any question by sending a Telegram voice note, so that I can respond while walking between tasks without typing, and the transcription is stored automatically.

**US-F2-04 — Button answers for confirmations**  
As Hassan, I want confirmation questions to include inline buttons (✅ Yes / 🔒 Anonymize / ⏭ Skip this one), so that I can answer a factual yes/no in one tap without typing or dictating.

**US-F2-05 — Open-ended follow-up (conditional)**  
As Hassan, I want the bot to ask an open-ended follow-up question only when the confirmed evidence has a known SERP gap that the corpus doesn't fill, so that I'm not asked generic questions when the corpus already has what the article needs.

**US-F2-06 — 48-hour soft reminder**  
As the pipeline system, when Hassan has not responded to a session-start message within 48 hours, I want to send a single soft reminder ("No rush — when you have 5 min, the interview for [topic] is still waiting"), so that one busy day doesn't cause a missed week.

**US-F2-07 — 7-day automatic skip**  
As the pipeline system, when Hassan has not completed any interview response within 7 days of the session opening, I want to automatically mark the session as `status = 'timed_out'`, archive the candidate, and surface the next-best candidate, so that the pipeline does not stall indefinitely.

**US-F2-08 — Full rejection fallback**  
As the pipeline system, when Hassan rejects all proposed confirmation examples (clicks ⏭ Skip on every one), I want to fall back to exactly one open-ended question ("Anything else related to [topic] from your week that we should know about?"), flag the candidate for re-synthesis next cycle, and note that this week's article may have thinner corpus grounding, so that the pipeline continues rather than dying silently.

**US-F2-09 — Anonymize client details**  
As Hassan, when I confirm a situation but click 🔒 Anonymize, I want the bot to acknowledge that the example will be used without any client attribution, so I can allow the technical content while protecting the client relationship.

**US-F2-10 — Session summary before close**  
As Hassan, after answering all questions, I want the bot to send a closing summary ("Got it. I've confirmed 3 examples and 1 follow-up answer. Draft will be ready for review by [day].") so I know the session is complete and what to expect next.

---

## 4. Functional Requirements

### 4.1 Session Trigger

The interview session is triggered by the Sunday-night synthesis job (F1). After creating an `article_candidates` row, the synthesis job dispatches an Inngest event `interview.session.requested` with the candidate ID. The interview session job handles this event.

Inngest function:
```
event: "interview.session.requested"
handler: artifacts/telegram-bot/src/jobs/interview-session.ts
```

The session does NOT start immediately on Sunday night. It is scheduled to open Monday morning at **8:00 AM Eastern** (13:00 UTC) via Inngest's `step.sleep` or a scheduled dispatch. Rationale: Hassan should not receive interview messages on Sunday night.

### 4.2 Topic Preview Message

The first message sent is always a topic preview. Format:

```
📋 This week's article: [Proposed Title]
Pillar: [Managed IT / QuickBooks / Cybersecurity]
Target keyword: [primary_keyword]

I found [N] things in your work this week that could make this article concrete.
Quick confirm? Takes about 5 minutes.

Reply anything to start, or /skip to skip this week.
```

If Hassan replies `/skip`, the candidate is archived (`status = 'skipped'`) and the pipeline surfaces the next candidate. No further messages that week.

### 4.3 Confirmation Questions

The synthesis job prepares 3–5 confirmation questions per candidate. Each question references a specific `capture_signal` by ID and presents the evidence in plain language.

**Confirmation question format:**
```
[1/4] Last [day of week] at around [time], you worked through [error/situation/topic] with Claude for about [duration]. Looks like a real client situation.

[Quote from the signal: first 80 words of redacted_text]

(1) ✅ Yes, use it  
(2) 🔒 Anonymize client  
(3) ⏭ Skip this one
```

The day/time is derived from `capture_signals.captured_at`. Duration is estimated from conversation token count (rough heuristic: 1,000 tokens ≈ 8 minutes).

**Question generation:** Claude Sonnet generates each confirmation question from the signal's `redacted_text` and the candidate's `primary_keyword`. The question must cite evidence from the corpus; generic questions that could apply to any topic are rejected by a post-generation validation step (see §7.2).

### 4.4 Open-Ended Follow-Up Questions

After confirmation questions are exhausted, the bot checks: does the confirmed evidence fully cover all identified SERP gaps in `article_candidates.serp_gaps`? If ≥1 gap is uncovered, it asks 1–2 open-ended follow-up questions. Format:

```
One more thing — the top-ranking articles on [primary_keyword] don't cover [SERP gap topic]. From your experience, [specific open-ended question about the gap]?

Answer via voice or text. There's no wrong answer.
```

If all gaps are covered by confirmed evidence, follow-up questions are skipped entirely.

### 4.5 Answer Handling

| Answer Type | Handling |
|---|---|
| Inline button (Yes / Anonymize / Skip) | Parsed immediately; no transcription needed |
| Text message | Stored as `answers[n].text`; linked to question `n` |
| Voice note | Streamed to Whisper API (see §6.5); both audio URL and transcript stored in `answers[n]` |

All answers stored in `interview_sessions.answers` JSONB field.

### 4.6 Conversation State Machine

```
States:
  PENDING          → session created, Monday 8 AM message not yet sent
  PREVIEW_SENT     → topic preview message sent; awaiting any reply
  CONFIRMING       → confirmation questions being sent, 1 per reply
  FOLLOW_UP        → optional open-ended questions if SERP gap unfilled
  COMPLETED        → all questions answered; closing summary sent
  TIMED_OUT        → no response in 7 days; candidate archived
  SKIPPED          → Hassan replied /skip; candidate archived

Transitions:
  PENDING → PREVIEW_SENT     on Monday 8 AM dispatch
  PREVIEW_SENT → CONFIRMING   on any non-/skip reply
  PREVIEW_SENT → SKIPPED      on /skip reply
  CONFIRMING → CONFIRMING     on each answer (questions sent one at a time)
  CONFIRMING → FOLLOW_UP      when all confirmation Qs answered and gap exists
  CONFIRMING → COMPLETED      when all confirmation Qs answered and no gap
  FOLLOW_UP → COMPLETED       when follow-up answered
  ANY → TIMED_OUT             on 7-day timer from PREVIEW_SENT
```

State is stored in `interview_sessions.status`. Each transition is logged in `interview_sessions.questions` JSONB (includes timestamps).

### 4.7 Reminder Logic

- **48-hour soft reminder:** If state is `PREVIEW_SENT` or `CONFIRMING` and no activity for 48 hours, send one reminder. Message: "No rush — your article on [topic] is waiting whenever you have 5 min."
- **Reminder sent flag:** Store in session JSONB to prevent double-sending.
- **7-day timeout:** Inngest scheduled step fires 7 days after session open. Transitions to `TIMED_OUT`. Sends: "This week's interview timed out. The topic will be re-queued next cycle."

### 4.8 Bot Commands

| Command | Action |
|---|---|
| `/skip` | Skip this week's topic. Archive candidate. |
| `/delete_signal <id>` | Soft-delete a capture signal (§F1 feature, handled by same bot) |
| `/status` | Report current pipeline status (how many signals captured, last synthesis run, current candidate) |
| `/help` | List available commands |

---

## 5. Non-Functional Requirements

| ID | Requirement | Threshold |
|---|---|---|
| NFR-01 | Voice note transcription latency | ≤90 seconds from voice note received to transcript stored |
| NFR-02 | Whisper transcription accuracy | ≥90% word accuracy on Hassan's speech patterns (validated against known test clips) |
| NFR-03 | Session total duration | ≤10 minutes for a typical 3–5 question session (measured from first reply to closing summary) |
| NFR-04 | Bot uptime | 99%+ during Monday 8 AM–Tuesday 8 PM Eastern window (peak usage) |
| NFR-05 | State persistence | Session state survives a bot restart (stored in Supabase, not in-memory) |
| NFR-06 | Question quality gate | 0% generic questions (no question may be sent without a corresponding `capture_signal_id`) |

---

## 6. Technical Specifications

### 6.1 Repository Placement

This feature lives in the **`nexfortis-content-pipeline`** repository, in its own `telegram-bot` artifact. The bot runs as a long-polling Node.js process on its own Render service.

```
nexfortis-content-pipeline/
  artifacts/
    telegram-bot/              ← THIS FEATURE
      src/
        jobs/
          interview-session.ts ← Inngest handler for session lifecycle
        bot.ts                 ← grammY bot instance, long-poll runner
        handlers/
          confirmation.ts      ← inline button callbacks
          voice.ts             ← audio routing to Whisper
          text.ts              ← text message routing
          commands.ts          ← /skip, /status, /help, /delete_signal
        index.ts               ← entry point; starts long-poll + Inngest serve
  lib/
    db/                        ← reads interview_sessions, article_candidates, capture_signals
    embeddings/                ← openai.ts (Whisper transcription)
    logger/
```

### 6.2 Telegram Bot Library

**Library:** `grammy` (npm package `grammy`, version `^1.31.0`). Rationale: actively maintained, TypeScript-native, smaller than `node-telegram-bot-api`, better webhook support. `node-telegram-bot-api` is acceptable as fallback if grammy introduces a breaking change.

**Deployment:** Long-polling (not webhook). Rationale: simpler to deploy on Render without webhook URL setup; adequate for solo-user volume. Switch to webhook if latency becomes an issue.

```typescript
// artifacts/telegram-bot/src/bot.ts
import { Bot, InlineKeyboard } from "grammy";

export const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

export function buildConfirmationKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Yes, use it", "confirm_yes")
    .text("🔒 Anonymize client", "confirm_anon")
    .text("⏭ Skip this one", "confirm_skip");
}
```

### 6.3 Interview Session Inngest Function

```typescript
// artifacts/telegram-bot/src/jobs/interview-session.ts
export const interviewSessionJob = inngest.createFunction(
  { id: "interview-session", name: "Journalist-Mode Interview Session" },
  { event: "interview.session.requested" },
  async ({ event, step }) => {
    const { candidateId } = event.data;

    // Wait until Monday 8 AM Eastern
    await step.sleepUntil("wait-for-monday-morning", nextMondayAt8amEastern());

    // Create session record
    const session = await step.run("create-session", () =>
      createInterviewSession(candidateId)
    );

    // Send topic preview
    await step.run("send-preview", () => sendTopicPreview(session));

    // Wait for response (up to 7 days)
    const response = await step.waitForEvent("preview-response", {
      event: "telegram.message.received",
      timeout: "7d",
      match: `data.chatId == "${process.env.TELEGRAM_CHAT_ID}"`,
    });

    if (!response || response.data.text === "/skip") {
      await step.run("skip-session", () => archiveSession(session.id, "skipped"));
      return;
    }

    // Send confirmation questions one at a time
    // ... (full implementation per spec §4.3)
  }
);
```

### 6.4 Question Generation

Claude Sonnet generates each confirmation question from the signal. Prompt template (stored in `src/lib/question-generator.ts`):

```
You are writing a confirmation question for Hassan Sadiq, an IT consultant.
He will receive this via Telegram on his phone.

Context:
- Article candidate: [proposed_title]
- Target keyword: [primary_keyword]
- Signal captured at: [day_of_week] at approximately [time]
- Signal source: [source]
- Signal content (redacted): [first 500 chars of redacted_text]

Write ONE confirmation question of ≤60 words. Requirements:
1. Reference a specific detail from the signal content (error code, config, situation).
2. State the approximate time/day the signal was captured.
3. Ask only for confirmation of what you already see in the corpus — do not ask for new information.
4. End with the choice: Yes, use it / Anonymize client / Skip this one (buttons will be added programmatically).
5. Do NOT write generic questions. If you cannot reference a specific detail, return ERROR:NO_SPECIFICS.

Question:
```

If Claude returns `ERROR:NO_SPECIFICS`, that signal is excluded from this session and logged as `signal_excluded_no_specifics`.

### 6.5 Voice Note Transcription

```typescript
// lib/embeddings/openai.ts  (shared lib, nexfortis-content-pipeline)
import OpenAI from "openai";
import { Readable } from "stream";

export async function transcribeVoiceNote(
  fileUrl: string,     // Telegram file URL
  sessionId: string
): Promise<string> {
  const audioStream = await fetchTelegramFile(fileUrl);  // returns Node.js Readable
  const response = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: audioStream,
    language: "en",
    response_format: "text",
  });
  // Store audio URL + transcript in interview_sessions.answers JSONB
  await storeVoiceAnswer(sessionId, fileUrl, response);
  return response;
}
```

Environment variable: `OPENAI_API_KEY` (shared with embeddings job).

Audio files are stored as Telegram CDN URLs in `interview_sessions.answers`. Do not re-upload audio to Supabase Storage in v2 (cost and complexity). The Telegram CDN URL is valid as long as the bot token is valid.

### 6.6 Database Writes

This feature writes to:
- `interview_sessions` (create, update status, update answers JSONB)
- `article_candidates` (update status: `'awaiting_interview'` → `'interview_complete'` or `'skipped'` or `'timed_out'`)

This feature reads from:
- `article_candidates` (candidate details, evidence chunks, SERP gaps)
- `capture_signals` (redacted_text, captured_at, source for question generation)

This feature must NOT write to:
- `capture_signals` (read only in this feature)
- `drafts` (downstream feature)
- Any table outside the `content-pipeline` service scope

### 6.7 Environment Variables

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | grammY bot token |
| `TELEGRAM_CHAT_ID` | Hassan's personal chat ID (hardcoded to his account only) |
| `OPENAI_API_KEY` | Whisper transcription |
| `ANTHROPIC_API_KEY` | Claude Sonnet question generation |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (not anon) |
| `INNGEST_EVENT_KEY` | Event dispatch |
| `INNGEST_SIGNING_KEY` | Webhook verification |

---

## 7. AI System Requirements

### 7.1 LLM Usage Map

| Task | Model | Rationale |
|---|---|---|
| Confirmation question generation | Claude Sonnet (latest) | Quality matters — a bad question gets ignored; invest compute here |
| Open-ended follow-up question | Claude Sonnet (latest) | Must reference SERP gap specifically; same quality requirement |
| Telegram closing summary message | Claude Haiku (latest) | Simple formatting task; cost-efficient |

### 7.2 Question Quality Gate

After Claude generates a question, a validation function checks:

1. Does the question contain at least one of: a specific error code, a day/time reference, a technology name from the signal?
2. Is the question ≤80 words?
3. Does the question ask for confirmation of something in the corpus (not new information)?

If any check fails, the question is regenerated once. If it fails again, the signal is excluded from this session (`signal_excluded_quality_gate`). This is logged. If more than 2 signals are excluded from a single session, a Telegram alert is sent to Hassan: "Corpus quality may be low for this topic — fewer confirmation questions available than expected."

### 7.3 Evaluation

**Session completion rate:** Tracked weekly. Target ≥90%. If it falls below 80% for two consecutive weeks, the question format is reviewed.

**"Yes" confirmation rate:** What % of confirmation questions does Hassan answer with ✅ Yes? Target >50%. A very low yes-rate (e.g., <20%) suggests the synthesis is surfacing poor candidates — the clustering threshold should be reviewed.

**Voice note usage rate:** Tracked. If Hassan is almost always using buttons and text (voice usage <10%), the voice transcription complexity may not be worth maintaining. Document this as a v2.1 consideration.

---

## 8. Acceptance Criteria

### AC-F2-01: Monday Morning Delivery

**Given** the synthesis job created an `article_candidates` row on Sunday night,  
**When** Monday 8:00 AM Eastern arrives,  
**Then:**
- A topic preview Telegram message is sent to Hassan's chat ID.
- The `interview_sessions` row is created with `status = 'preview_sent'`.
- The message includes the proposed title, pillar, target keyword, and signal count.
- No confirmation questions are sent yet.

### AC-F2-02: Confirmation Question Sent on Reply

**Given** Hassan replies (any text) to the preview message,  
**When** the bot receives the reply,  
**Then:**
- The session state transitions to `confirming`.
- The first confirmation question is sent within 10 seconds.
- The question includes a verbatim excerpt (≤80 words) from the referenced `capture_signal.redacted_text`.
- Inline buttons (✅ Yes, use it / 🔒 Anonymize client / ⏭ Skip this one) appear below the message.
- The `interview_sessions.questions` JSONB is updated with the question text and the `capture_signal_id` it references.

### AC-F2-03: Button Answer Recorded

**Given** a confirmation question with inline buttons is displayed,  
**When** Hassan taps ✅ Yes, use it,  
**Then:**
- The button callback is received by the bot.
- `interview_sessions.answers` JSONB is updated: `{ question_index: N, signal_id: "...", response: "yes", timestamp: "..." }`.
- `interview_sessions.confirmed_chunk_ids` is updated to include the signal's chunk IDs.
- The next question (or closing summary if last) is sent within 5 seconds.

### AC-F2-04: Voice Note Transcription

**Given** Hassan sends a voice note in response to an open-ended question,  
**When** the bot receives the voice note,  
**Then:**
- The audio file URL is retrieved from Telegram's file API.
- The audio is sent to Whisper API (`whisper-1` model).
- The transcript is stored in `interview_sessions.answers[n].transcript`.
- The Telegram CDN URL is stored in `interview_sessions.answers[n].audio_url`.
- A text acknowledgment is sent to Hassan within 90 seconds: "Got it. Transcribed and saved."

### AC-F2-05: 48-Hour Reminder

**Given** a session is in `preview_sent` or `confirming` state,  
**When** 48 hours pass with no new message from Hassan,  
**Then:**
- Exactly one reminder message is sent.
- The `session.reminder_sent` flag in the JSONB is set to `true`.
- No second reminder is sent, regardless of further inactivity.

### AC-F2-06: 7-Day Timeout

**Given** a session was opened (preview sent) and no completion occurs,  
**When** 7 calendar days pass,  
**Then:**
- `interview_sessions.status` is set to `timed_out`.
- `article_candidates.status` is set to `archived`.
- A Telegram message is sent: "This week's interview timed out. The [topic] candidate will be re-queued next synthesis cycle."
- The pipeline does not stall — the next `synthesize-weekly` run picks the next candidate.

### AC-F2-07: All Confirmations Skipped — Fallback

**Given** Hassan clicks ⏭ Skip on all N confirmation questions,  
**When** the last skip is recorded,  
**Then:**
- Exactly one open-ended fallback question is sent: "Anything on [topic] from your recent work we should know about before drafting?"
- The candidate is flagged `low_corpus_confidence = true` in `article_candidates`.
- Any answer to the fallback is recorded in `interview_sessions.answers`.
- The session proceeds to completion normally.

### AC-F2-08: Generic Question Prevention

**Given** Claude generates a confirmation question that fails the quality gate (no specific error code, day/time reference, or technology name from the signal),  
**When** the validation function runs,  
**Then:**
- The question is NOT sent to Hassan.
- Claude is called once more to regenerate.
- If the second attempt also fails, the signal is excluded from this session and `signal_excluded_quality_gate` is incremented in the session log.
- Hassan never receives a generic question of the form "What did you work on this week?"

---

## 8b. Shared Resources

| System | Shared? | Notes |
|---|---|---|
| Supabase project | ✅ Yes — same project | Reads `article_candidates`, `capture_signals`; writes `interview_sessions` |
| Telegram Bot token | ✅ Yes — same bot | Shared with F1 notification messages; handlers are disambiguated by conversation state |
| OpenAI account | Recommended separate key | Whisper calls from this artifact; embeddings from capture-worker; keep keys separate |
| Anthropic account | Recommended separate key | Claude Sonnet question generation |
| Microsoft Entra ID | ❌ Not used by this feature | Graph API only needed in F1 capture workers |
| Sanity project | ❌ Not used by this feature | Sanity push is handled in F4 |

---

## 9. Out of Scope

| Item | Rationale |
|---|---|
| Multi-candidate interviews in one session | One article candidate per weekly session. Keeps sessions under 10 minutes. |
| Hassan initiating an interview manually | Bot-initiated only. Manual triggers can be added in v2.1 via a `/new_interview` command. |
| Image/photo answer support | Voice and text are sufficient. Image handling adds Telegram API complexity. |
| Interview scheduling preference (day/time) | Monday 8 AM Eastern is fixed for v2. Configurable time is a v2.1 enhancement. |
| Multi-language support | Hassan operates in English. |
| Webhook deployment (vs long-polling) | Long-polling sufficient for solo user. Webhook is a v2.1 optimization. |
| Storing audio in Supabase Storage | Telegram CDN URLs are sufficient. Storage migration is a v2.1 option if URLs expire. |
