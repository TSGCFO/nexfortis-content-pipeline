# Tool Stack Decision Record — NexFortis Content Pipeline v2

**Document Owner:** Hassan Sadiq, NexFortis  
**Parent Epic:** [NexFortis Automated Content Pipeline v2](./epic-prd.md)  
**Status:** Locked  
**Version:** 1.0  
**Created:** May 10, 2026  
**Format:** Architectural Decision Record (ADR)  
**Audience:** Hassan Sadiq, Cursor agents + Claude Code, Computer (orchestrator), future contractors

---

## How to Read This Document

Each ADR documents one tool or structural decision. Before changing any locked tool, read the relevant ADR — the consequences section explains what would break and why the alternative was rejected.

---

## ADR-001: Separate Repository vs. Monorepo Addition

**Status:** Accepted *(reversed from initial recommendation — see Reversal History)*

**Context:** The content pipeline is a new backend automation system with 5 Render services and 12–16 weeks of active development across 15 implementation prompts. It must integrate with the existing NexFortis production site and QB Portal without breaking them.

**Decision:** Build the content pipeline in a **separate GitHub repository** (`TSGCFO/nexfortis-content-pipeline`). Share Supabase, Sanity, and Entra ID app registration with the main monorepo (`TSGCFO/NexFortis-Website-Design-pro`). Do not share code, dependencies, or deployment config.

**Reversal History:** The initial recommendation in this epic was to add `artifacts/content-pipeline/` to the existing monorepo. That recommendation was reversed after recognizing that the content pipeline is an independent backend automation system with its own deployment lifecycle, unrelated to the Next.js blog rendering code.

**Rationale for separate repo:**
- **Clean CI:** Each repo has its own GitHub Actions pipeline. A broken test in the content pipeline does not block a deploy of the production site, and vice versa.
- **Independent deployment:** The five pipeline Render services deploy independently of the main site. A rollback on the pipeline does not require a rollback of the blog.
- **No cross-contamination with live production:** Any dependency bump or type change in the content-pipeline repo has zero blast radius to the live NexFortis site, QB Portal, or shared API server. Keeping both systems in a single monorepo would mean that any package-level change by the implementer could silently break production. Separate repo makes the boundary physically impossible to cross.

**Alternatives Considered:**

| Alternative | Why Rejected |
|---|---|
| Add `artifacts/content-pipeline/` to main monorepo | Any change to a workspace-level dep or shared type in the pipeline work has blast radius to the live production site and QB portal. Not acceptable for a live business. |
| Fully separate infrastructure (separate Supabase project) | Over-engineering. Cross-database joins would be needed to correlate pipeline data with blog data. Shared Supabase is strictly better; the only risk is schema migration conflicts, which are managed by naming conventions and reviewing migration files. |

**Consequences:**
- ✅ Pipeline implementer (Cursor agents / Claude Code) is scoped to the new repo. No blast radius to production.
- ✅ Separate CI config and Render services. Pipeline deploys independently.
- ⚠️ Two repos to maintain (dependency upgrades, CI, secrets). Accepted for a solo operator.
- ⚠️ Shared types require manual sync (see §2 of Architecture spec). Accepted for v2; npm package is v3.

---

## ADR-002: SEOwind vs. Frase (Drafting + Brand Voice)

**Status:** Accepted (Frase Superseded)

**Context:** v1 used Frase.io ($49/mo) as the drafting tool. The fatal limitation: Frase had no structured slot for first-person expertise. Hassan's interview answers had to be prompt-injected, which was fragile and inconsistent.

**Decision:** Replace Frase with **SEOwind Pro ($219/mo)**. SEOwind provides three structured fields that directly solve the v1 limitation: "Your own insights" (exactly where Hassan's corpus-confirmed experiences go), "Statistics & Quotes" (for error codes, timelines, specific configs), and a Custom Brand Voice profile trainable on Hassan's existing writing.

**Alternatives Considered:**

| Alternative | Why Rejected |
|---|---|
| Frase.io ($49/mo) | No structured "own insights" field; brand voice is an afterthought; prompt injection for expertise is fragile |
| Surfer SEO ($89/mo+) | Higher cost; no structured expertise injection; SERP scoring is Surfer's strength but drafting is weaker |
| Koala ($9/mo) | Very low cost, but produces generic AI output without deep SERP analysis; unsuitable for professional IT services brand |
| Direct Claude drafting | No SERP analysis, no brand voice training, no structured brief format; would require building all of that from scratch |

**Consequences:**
- ✅ Structured expertise injection via "Your own insights" field — the single most important differentiator from v1.
- ✅ Brand voice trained once from 5,000–8,000 words of Hassan's writing; applied to every draft.
- ✅ SERP gap analysis built in; no separate tool needed for that layer.
- ⚠️ $219/mo is the highest single tool cost in the stack. Justified by output quality; this is the center of gravity of the content investment.
- ⚠️ API surface is limited as of May 2026; Playwright fallback may be required at launch. Documented as a known risk in F3 PRD §4.4.

---

## ADR-003: Clearscope vs. NeuronWriter / Frase as Secondary Scorer

**Status:** Accepted

**Context:** A second, independent SERP-grounded quality score is needed to catch false positives from SEOwind's own scoring (a tool is unlikely to honestly report that its own output is bad). The scorer must be tool-independent.

**Decision:** **Clearscope (Essentials plan)** as the independent re-scorer. Required score: ≥80.

**Alternatives Considered:**

| Alternative | Why Rejected |
|---|---|
| NeuronWriter | Weaker API documentation; lower reputation for SERP-grounded scoring in the enterprise IT space |
| Frase.io score | Conflict of interest: using Frase to score a non-Frase draft is not the same as independent verification; also Frase was dropped from the drafting layer |
| MarketMuse | Strong product but priced for agency/enterprise; overkill for solo operator; $149/mo minimum |
| Manual Ahrefs/Semrush check | Not API-accessible for automated scoring; process is too manual to run on every draft |

**Consequences:**
- ✅ Genuinely independent score — Clearscope has no stake in SEOwind's output.
- ✅ Best-in-class SERP term coverage grading; ★★★★★ on expertise input in original research.
- ✅ API available (confirm before implementation; Essentials plan API access TBD).
- ⚠️ If Clearscope API is not available on Essentials, manual fallback via `/set_clearscope_score` Telegram command is documented in F3 PRD §4.6.

---

## ADR-004: No Dedicated Typeface/Writer.com

**Status:** Accepted (Both Rejected)

**Context:** Typeface and Writer.com are AI writing platforms with brand voice capabilities. Could they replace or supplement SEOwind?

**Decision:** Neither is added to the stack. SEOwind's Custom Brand Voice is sufficient and adding a second brand voice tool would create voice fragmentation — two different trained profiles drifting over time.

**Consequences:**
- ✅ Simpler stack; one source of truth for brand voice.
- ✅ Lower monthly cost.
- ⚠️ If SEOwind's brand voice quality is unsatisfactory after training, Writer.com is the first alternative to evaluate. Do not add it preemptively.

---

## ADR-005: Supabase pgvector vs. Pinecone / Qdrant

**Status:** Accepted

**Context:** The capture corpus requires vector storage for semantic search and cosine similarity clustering. Three options were evaluated.

**Decision:** **Supabase pgvector** (same existing Supabase project). Enable the `vector` extension; add an HNSW index on `capture_signals.embedding`.

**Alternatives Considered:**

| Alternative | Why Rejected |
|---|---|
| Pinecone | Additional service, additional cost ($70+/mo for meaningful scale), additional credential set. No benefit over pgvector at < 100K vectors for a solo operator. |
| Qdrant (self-hosted) | Self-hosted = Hassan or a contractor must manage it. Not appropriate for a solo operator building on Render. |
| Qdrant (cloud) | Additional service and cost. Same objection as Pinecone. |

**Consequences:**
- ✅ Zero incremental cost (pgvector is free; Supabase is already in production).
- ✅ One fewer credential set; one fewer service to monitor.
- ✅ SQL joins between vector results and relational tables (e.g., `capture_signals JOIN source_filters`) without an API round-trip.
- ⚠️ Supabase pgvector HNSW performance at > 1M vectors is less proven than Pinecone. If corpus exceeds 500K vectors (years away), revisit.

---

## ADR-006: OpenAI text-embedding-3-large vs. Alternatives

**Status:** Accepted

**Context:** The embedding model is used for all corpus signal embeddings and cosine similarity searches. It must produce high-quality embeddings for technical IT content (error codes, config names, product names).

**Decision:** **`text-embedding-3-large`** (OpenAI). 3072 dimensions, cosine distance.

**Alternatives Considered:**

| Alternative | Why Rejected |
|---|---|
| `text-embedding-3-small` | Lower cost but lower recall on technical vocabulary; not worth the quality trade-off at projected volume (< $15/month difference) |
| `text-embedding-ada-002` | Older model; superseded by embed-3 on all benchmarks |
| Cohere `embed-multilingual-v3.0` | No advantage for English-only corpus; adds a new API credential |
| Voyage AI `voyage-2` | Strong benchmarks but adds a new service, credential, and SDK dependency; not worth it when OpenAI is already in the stack |

**Consequences:**
- ✅ Best general-purpose English embedding with strong performance on technical vocabulary.
- ✅ No new service or credential.
- ✅ Cost is bounded: ~$0.13/million tokens; projected at < $15/month.
- ⚠️ If OpenAI changes pricing or discontinues `text-embedding-3-large`, migrate to `text-embedding-3-small` or Voyage AI. The migration is a re-embed job; schema is unchanged (3072-dimension column can be reused if new model also produces 3072 dimensions).

---

## ADR-007: Claude vs. GPT-4 for Synthesis

**Status:** Accepted

**Context:** The synthesis job requires: cluster labeling, pillar classification, question generation (for journalist bot), draft title generation. Which LLM handles these tasks?

**Decision:** **Anthropic Claude** for all pipeline LLM calls (Sonnet for quality-sensitive tasks, Haiku for cost-sensitive tasks). GPT-4 is used indirectly only via Aleyda Solis's Custom GPT in Stage C.

**Alternatives Considered:**

| Alternative | Why Rejected |
|---|---|
| GPT-4o for everything | Would require managing two API keys (OpenAI already used for embeddings; mixing embedding + synthesis on same account increases coupling). Claude Sonnet matches or exceeds GPT-4o on long-context synthesis tasks in 2026 benchmarks. |
| Gemini Pro | Adds a third AI service. No evidence of quality advantage for this use case. |
| Local model (Ollama/Llama) | Not appropriate for a Render-deployed service. Requires GPU hosting; significant setup cost for solo operator. |

**Consequences:**
- ✅ Claude Sonnet's 200K context window handles 30 days of corpus signals in a single synthesis call.
- ✅ Haiku is cost-efficient for high-volume, low-complexity tasks (redaction scrub, classification, message formatting).
- ⚠️ Two AI API credentials (OpenAI + Anthropic). Managed. Not a meaningful operational burden.

---

## ADR-008: Telegram vs. Email / Web Form for Interview Delivery

**Status:** Accepted (Reaffirms v1 decision)

**Context:** v1 chose Telegram for the interview bot. v2 reaffirms this choice.

**Decision:** **Telegram Bot API** (grammY library, long-polling). Hassan's only interface with the pipeline.

**Rationale (unchanged from v1):**
- Telegram is already installed and actively used by Hassan.
- Native voice note support — Hassan can answer by dictation while on-site.
- High notification visibility (not buried in email inbox).
- Telegram Bot API is free, well-documented, and straightforward to self-host.
- grammY (TypeScript-native, actively maintained) replaces node-telegram-bot-api from v1.

**Alternatives Considered:**

| Alternative | Why Rejected |
|---|---|
| Email | High friction. Easy to ignore. No native voice support. Replies get buried. |
| Custom web form | Requires URL, login, and form submission. Higher friction than Telegram. No voice support. |
| Slack | Not installed/used by Hassan. Another app to manage. |
| WhatsApp Business API | Complex approval process; not appropriate for solo operator. |

**Consequences:**
- ✅ Zero new tool adoption for Hassan.
- ✅ Voice note support built in.
- ⚠️ If Telegram ever becomes unavailable in Canada (geopolitical risk is low but non-zero), the fallback is a web form interface. The bot's command/callback structure would need to be replicated.

---

## ADR-009: Inngest vs. Supabase Edge Functions for Cron Orchestration

**Status:** Accepted

**Context:** The pipeline requires cron jobs (daily ingestion, Sunday synthesis, Monday interview scheduling, 14-day Medium reminder), event-driven workflows (draft.requested, interview.session.requested), and step-level retry logic. What orchestrates these?

**Decision:** **Inngest** (free tier). All Inngest functions are registered in their respective artifacts and served via the Inngest serve handler.

**Alternatives Considered:**

| Alternative | Why Rejected |
|---|---|
| Supabase Edge Functions + cron | Edge Functions have a 150-second timeout per invocation. The Sunday synthesis job (embedding hundreds of signals, running clustering) will exceed this. Inngest's step-based execution avoids timeouts by design. |
| Temporal | Enterprise-grade; significant operational overhead; not appropriate for solo operator. |
| BullMQ (Redis-backed) | Requires a Redis instance (additional service + cost). Inngest provides equivalent functionality without a separate stateful service. |
| Simple Node.js cron (`node-cron`) | No retry logic, no observability dashboard, no step-level granularity. A single failure loses the entire job with no replay. |

**Consequences:**
- ✅ Step-level retries mean a failed embedding call doesn't restart the entire ingestion.
- ✅ Inngest dashboard provides observability into function runs without building custom tooling.
- ✅ Free tier is sufficient (10K function runs/month at projected volume).
- ⚠️ If Inngest pricing changes, Supabase Edge Functions (with a separate queue for long-running jobs via Inngest's pg-backed alternative) is the fallback.

---

## ADR-010: Cursor Agents + Claude Code as Primary Implementer (No Replit Agent)

**Status:** Accepted *(reversed from initial draft direction of Replit Agent as primary implementer — see Reversal History)*

**Context:** The content pipeline requires 15 implementation prompts across 12–16 weeks. Who does the coding?

**Decision:** **Path B. Cursor agents (cloud + local) and Claude Code are the primary end-to-end implementers.** Hassan pastes structured prompts (authored by Computer and stored in `./cursor-claude-prompt-library.md`) into Cursor or Claude Code. The implementer executes against the `nexfortis-content-pipeline` repo, writes tests, and opens draft PRs. Hassan reviews and merges. Computer assists with QA.

**Context for the reversal:**
NexFortis was originally built using Replit Agent. That experience surfaced four compounding problems when applied to a backend automation system developed over many prompts:
1. **PR cleanup burden:** Every Replit Agent PR required cleanup — it took minor liberties on adjacent code, added unsolicited "improvements," and the cleanup cost compounded across 14+ prompts.
2. **`replit.md` overwrite:** Replit Agent periodically overwrote its own `replit.md` constraint file — the file that was supposed to carry persistent instructions across sessions. This made persistent prompt engineering structurally impossible: you cannot rely on a constraint file that the agent itself will eventually overwrite.
3. **Single model lock-in:** Replit Agent is locked to one model backend. The content pipeline benefits from model flexibility (Claude Opus 4.7 for nuanced synthesis tasks, GPT-5 for others). Cursor and Claude Code support this.
4. **Wrong strengths for the project:** Replit Agent's primary strength is vibe-coding web apps quickly. The NexFortis content pipeline is a backend automation system — Inngest workers, pgvector, structured redaction, webhook choreography. Replit's fast-iteration UI-focused workflow does not apply.

**Why Cursor / Claude Code:**
- Both respect `AGENTS.md` and `.cursorrules` reliably as stable system-prompt injection. These files do not get overwritten.
- Both support multiple model backends (Claude Opus 4.7, GPT-5, and others).
- Both need precise, explicit instructions — which we have the discipline to write (evidenced by the 15-prompt library at `./cursor-claude-prompt-library.md`).
- Fewer unsolicited changes per PR means less cleanup and faster overall velocity across a multi-week project.

**Alternatives Considered:**

| Alternative | Why Rejected |
|---|---|
| Path A: Replit Agent in monorepo | `replit.md` overwrite makes persistent prompt engineering impossible. Every PR requires cleanup. Single model lock-in. Vibe-coding strengths don't apply to a backend system. |
| Hassan writes all code manually | Defeats the purpose of the system; Hassan's time is the scarcest resource. |
| Fully automated pipeline with no implementer | Requires code; an implementer is necessary. |

**Known tradeoffs and mitigations:**

| Tradeoff | Mitigation |
|---|---|
| Cursor/Claude Code require extremely precise prompts | Prompts in `./cursor-claude-prompt-library.md` are 300–600 words each, with explicit edge cases, type-safety requirements, and Definition-of-Done checklists |
| Hassan has more keyboard time than with a fully autonomous agent | Fewer cleanup PRs means net less total time; each review is meaningful, not a rescue mission |
| Potential for scope drift across many prompts | Each prompt includes a "decisions already made" section and a "decisions coming in future prompts" section to prevent pre-building and maintain forward-context |

**Consequences:**
- ✅ Hassan does not write code. He reviews PRs and approves merges.
- ✅ `AGENTS.md` and `.cursorrules` are stable and persistent — never overwritten.
- ✅ Multiple model backends available per task.
- ✅ Structured prompts from the prompt library are reusable and versioned.
- ⚠️ Prompts must be extremely precise. Vague prompts produce drift. Computer's role as prompt author is critical.
- ⚠️ Hassan reviews each PR carefully. Computer assists with QA to reduce his review burden.

**Reversal History:** Initial draft direction for this project was Replit Agent as primary implementer, extending the pattern used to build the main NexFortis site. That direction was reversed after recognizing: (a) the content pipeline is not a web app — Replit's strengths don't apply; (b) the `replit.md` overwrite problem makes persistent behavioral constraints structurally impossible at scale; (c) the cleanup cost per PR compounds significantly across 15 prompts; (d) model flexibility matters for a multi-step pipeline with diverse task types.
