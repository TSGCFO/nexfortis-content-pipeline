# Epic PRD — NexFortis Automated Content Pipeline v2

**Document Owner:** Hassan Sadiq, NexFortis
**Status:** Production Spec — Ready for Implementation
**Version:** 2.0
**Supersedes:** `docs/content-pipeline/content-pipeline-prd.md` (v1.0)
**Created:** May 10, 2026
**Audience:** Hassan Sadiq, Cursor agents + Claude Code (primary implementer), Computer (orchestrator), future contractors

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Why v2 — What Changed Since v1](#2-why-v2--what-changed-since-v1)
3. [Goals](#3-goals)
4. [Non-Goals](#4-non-goals)
5. [Personas](#5-personas)
6. [System Overview](#6-system-overview)
7. [Locked Tool Stack](#7-locked-tool-stack)
8. [Feature Decomposition](#8-feature-decomposition)
9. [Success Metrics](#9-success-metrics)
10. [Risks & Mitigations](#10-risks--mitigations)
11. [Linked Documents](#11-linked-documents)

---

## 1. Executive Summary

### Problem Statement

NexFortis is invisible in organic search. The blog has 5 posts. Competitors with consistent content outrank NexFortis for every term Ontario SMBs use to find IT services. Hassan is the only person who can produce the technical depth Google's Helpful Content System rewards — but he cannot allocate 20–40 hours per month to writing. v1.0 of the pipeline tried to solve this by extracting his expertise once a week through a 15-minute Telegram interview. The fatal flaw: the entire system's output quality was bottlenecked on Hassan's ability to be a great interview subject on demand, every Monday, regardless of his cognitive state. That is not a system. That is a single point of failure with extra steps.

### Proposed Solution

v2 inverts the workflow. Instead of generating expertise on demand once a week, the system **continuously captures expertise Hassan is already producing every day** — Claude conversations, Perplexity research threads, Microsoft 365 emails, Teams call transcripts, ad-hoc voice notes — and embeds them into a searchable Supabase vector store. A nightly synthesis job clusters this raw material into article candidates. The Monday Telegram bot then operates in **journalist mode**: it walks into the interview already holding a folder of evidence, asking targeted, specific questions referencing real conversations and real problems Hassan worked on that week. SEOwind takes the resulting brief — primary keyword + SERP gaps + Hassan's captured expertise + his trained brand voice — and produces a draft that already sounds like him. A multi-stage quality gate (rule-based auto-reject + Clearscope independent re-scoring + Aleyda Solis's E-E-A-T GPT) catches thin content before it ever reaches Sanity. Hassan's review becomes a 5-minute confirmation, not a 30-minute rescue mission.

### Success Criteria

| # | KPI | Target | Measurement |
|---|---|---|---|
| SC1 | Steady publishing cadence | 5–6 articles/month by month 3 | Sanity published count |
| SC2 | Hassan's weekly time | ≤10 minutes (down from 20 in v1) | Self-reported + bot completion logs |
| SC3 | Quality gate pass rate (first try) | ≥70% of drafts pass without rewrite | Pipeline logs |
| SC4 | Capture corpus growth | ≥200 new signals/month by month 2 | Supabase row counts |
| SC5 | Information-gain proxy | Each article cites ≥3 specifics from capture corpus (error codes, client situations, exact configs) | Manual sampling, monthly |
| SC6 | Organic traffic | Positive GSC impression trend by month 3; first non-brand clicks by month 4–6 | Google Search Console |
| SC7 | AI Visibility | NexFortis mentioned in ≥10 tracked LLM prompts by month 6 | Otterly or Semrush AI Visibility Toolkit |

---

## 2. Why v2 — What Changed Since v1

v1.0 was a sound idea built on an unsound assumption. v2 fixes the assumption.

### The v1 architecture had three structural problems

**P1 — Hassan was the bottleneck and the failure mode at the same time.**
The Monday interview produced article quality directly proportional to how sharp Hassan felt that morning. Custody mediation week? Bad article. Tired after a Sunday-night client emergency? Bad article. Over time, the floor falls and the site fills with generic content.

**P2 — Frase had no structured slot for first-person expertise.**
Frase's API accepts a keyword and produces SERP-grounded content. There is no field for "here is the writer's actual experience with this problem — work it into the draft." Hassan's interview answers had to be prompt-injected, which is fragile and inconsistent.

**P3 — The pipeline had no memory.**
Each week's article was generated cold. Hassan could explain the same Conditional Access scenario three times across three different articles, each time worded slightly differently, none of them deeply connected. There was no growing corpus, no compounding asset, no second-brain.

### What v2 changes

| v1 Component | v2 Replacement | Why |
|---|---|---|
| Monday-only expertise extraction | Continuous capture from Claude, Perplexity, email, Teams, voice | Removes single point of failure; turns Hassan's existing workflow into raw material |
| Frase as drafting tool | SEOwind as drafting tool | Structured fields for "Your own insights" + "Statistics & Quotes" + native Brand Voice; ★★★★ on information gain in original research |
| Generic interview questions | Journalist-mode interview with retrieved context | Bot reads from capture corpus before asking; questions cite specific Tuesday conversations and known errors |
| Single quality scorer (Frase) | Three-stage gate: rule-based auto-reject + Clearscope + Aleyda Solis E-E-A-T GPT | Independent re-scoring catches false positives from any single tool |
| Implicit brand voice | SEOwind Custom Brand Voice (Pro plan, $219/mo) | Trained on Hassan's existing technical writing; applied during generation, not post-hoc |
| No corpus | Supabase pgvector store of all captured signals | Compounds over time; same expertise reusable across articles; searchable, dateable, tagged |

### Why these changes will improve SEO outcomes specifically

Google's Helpful Content System rewards two things this pipeline now does that the old pipeline did not:

1. **Information gain** — content that adds something the top results don't have. v2 has a structural mechanism (capture corpus + structured insight injection) for sourcing genuinely novel content from Hassan's real work. v1 hoped he'd produce it on the spot.
2. **Sustained reader engagement** — articles that read like a real practitioner wrote them, with specifics that make them citable and shareable. v2's brand voice layer + concrete capture corpus + voice-trained drafting produces content that doesn't read as AI sludge. v1 produced SERP-optimized but voice-generic output.

---

## 3. Goals

| # | Goal | Priority | Measurement |
|---|------|---|---|
| G1 | Reduce Hassan's weekly time commitment to ≤10 minutes | P0 | Self-reported + bot interaction logs |
| G2 | Capture corpus contains ≥80% of Hassan's "thinking-out-loud" weekly output | P0 | Sampling: % of Claude/Perplexity conversations on IT topics indexed |
| G3 | Every published article cites ≥3 specifics from corpus | P0 | Manual audit, monthly |
| G4 | Publish 5–6 articles/month consistently from month 3 onward | P0 | Sanity counts |
| G5 | All articles pass the three-stage quality gate | P0 | Pipeline logs |
| G6 | Positive organic traffic trend by month 3 | P1 | Google Search Console |
| G7 | NexFortis appears in tracked LLM answers (GEO) by month 6 | P1 | Otterly / Semrush AI Visibility |
| G8 | Zero published articles get penalized in core updates | P1 | GSC + visibility tracking |

---

## 4. Non-Goals

Items deliberately excluded from v2 scope.

| # | Non-Goal | Rationale |
|---|---|---|
| NG1 | Fully autonomous publishing without human approval | Hassan's APPROVE step is the legal and HCU-safe gate. Not negotiable. |
| NG2 | Writing outside the three pillars (QuickBooks, Managed IT/M365, Cybersecurity) | Pillar discipline is core to topical authority. |
| NG3 | More than 6 articles/month | Quality over volume; sudden volume spikes attract HCU scrutiny. |
| NG4 | Capturing every signal Hassan produces | Capture targets *technical-explanation* writing. Personal messages, family-law correspondence, mediation notes, and non-IT material are excluded by source filters. |
| NG5 | Real-time capture (streaming) | Daily/nightly batch ingestion is sufficient and dramatically simpler than streaming pipelines. |
| NG6 | Multi-user / team support | NexFortis remains a solo operation. No team features. |
| NG7 | Replacing Hassan's expertise with model-generated facts | Capture corpus is the source of truth; SEOwind synthesizes, it does not invent. |
| NG8 | Publishing to LinkedIn as a full article | Blog stays canonical. Summaries only on LinkedIn. |
| NG9 | Mac OS support for any agent or local tool | Not in Hassan's environment. |

---

## 5. Personas

### Primary — Hassan Sadiq (Content Owner + Final Approver)

- Solo operator. Limited cognitive bandwidth on most weekdays.
- Heavy daily user of Perplexity, Claude, Microsoft 365, Cursor, Teams.
- Uses Wispr Flow for dictation across many apps.
- Prefers Telegram over email/forms for any quick interaction.
- Will not edit code or YAML to approve articles.
- Will not consistently meet a "produce 15 minutes of brilliance every Monday" expectation.

### Secondary — Cursor Agents + Claude Code (Primary Implementer)

- Receives rigorous prompts authored by Computer and Hassan, covering every edge case, file allowlist/blocklist, dependency pins, and a required Definition-of-Done checklist.
- Operates with full repo context against the `nexfortis-content-pipeline` repository.
- Reliably respects `AGENTS.md` and `.cursorrules` as stable system-prompt injection; does not overwrite them.
- Supports multiple model backends — Claude Opus 4.7, GPT-5, and others as appropriate per task.
- Opens PRs that Hassan reviews and approves before merging; does not merge autonomously.
- Strengths: structured-instruction adherence, edge-case handling, type-safe updates across the codebase.
- Required prompt style: extreme precision on edge cases, error handling, and type safety. Vague prompts produce drift; explicit allowlists and blocklists are mandatory in every prompt.

### Tertiary — Computer (Orchestrator + QA)

- The parent AI that authors prompts for Cursor agents / Claude Code at the correct level of specificity.
- Runs QA on PRs alongside Hassan: reads diff, flags regressions, verifies Definition-of-Done items.
- Retrieves corpus context and research when Hassan needs it during review.
- Does not implement code directly; its output is prompts, analysis, and review commentary.

### Quaternary — Future Contractor

- Picks up a single workstream (e.g. the Telegram bot).
- Must be able to ship without reading the entire content-pipeline repo from scratch.
- Each feature PRD is self-contained for this reason.

---

## 6. System Overview

### Repository Topology

The content pipeline lives in a **separate repository** from the main NexFortis monorepo, not as an additional package inside it. This is a deliberate decision documented in ADR-001 (see `./tool-stack-decision-record.md`).

- **New repo:** `TSGCFO/nexfortis-content-pipeline` (pnpm workspace, mirrors the structure pattern of the main monorepo)
- **Existing repo (untouched by this work):** `TSGCFO/NexFortis-Website-Design-pro`

**What is shared across the two repos (services, not code):**

| Resource | Shared? | Notes |
|---|---|---|
| Supabase project / database | ✅ Yes | New tables (`capture_signals`, `synthesis_clusters`, etc.) live alongside existing blog tables in the same Postgres |
| Sanity project / dataset | ✅ Yes | Pipeline writes drafts into the existing Sanity dataset; blog already reads from it |
| Microsoft Entra app registration | ✅ Yes | One tenant, one app, additional scopes added |
| OpenAI / Anthropic / Telegram accounts | ✅ Yes | Separate keys per project, same accounts |
| Render hosting account | ✅ Yes | New Render service for pipeline workers |
| Code | ❌ No | Pipeline code is fully isolated in the new repo |
| Shared TypeScript types | ⚠️ Inlined copy | A small set of types (`Article`, `Pillar`, `Author`) is duplicated between repos and kept in sync manually. Documented in the Architecture spec. |

**Why separate repo:** The content pipeline is an independent backend automation system with its own deployment lifecycle, unrelated to the Next.js blog rendering code. Keeping it in a separate repo gives clean CI, independent deployment, and zero cross-contamination risk with the live production NexFortis site, QB Portal, and shared API server. Trade-off accepted: two CI configs, two Render services, two dependency upgrade flows.

### Internal repo layout

```
nexfortis-content-pipeline/
  artifacts/
    capture-worker/        (Inngest functions: ingestion + embeddings)
    synthesis-worker/      (nightly clustering + candidate generation)
    telegram-bot/          (journalist-mode interview bot, long-poll)
    gate-worker/           (Quality Gate Stage A/B orchestration)
    sanity-bridge/         (push drafts to Sanity, handle approve webhook)
  lib/
    db/                    (Drizzle schemas + Supabase client)
    embeddings/            (OpenAI embed wrapper, chunking)
    redaction/             (PII + family-law blocklist)
    shared-types/          (Article, Pillar, etc. — inlined copy from main repo)
    logger/                (pino + Sentry)
  docs/
  .env.example
  README.md
```

### End-to-end data flow

```
                    ┌─────────────────────────────────────────────────┐
                    │                CAPTURE LAYER                     │
                    │  (runs daily — center of gravity)                │
                    │                                                  │
                    │  Claude monthly export  ────┐                    │
                    │  Perplexity Spaces ─────────┤                    │
                    │  MS Graph (email)  ─────────┼─► Ingestion Jobs   │
                    │  Teams transcripts ─────────┤   (Inngest crons)  │
                    │  Telegram voice notes ──────┘                    │
                    │                                                  │
                    │                  │                               │
                    │                  ▼                               │
                    │     OpenAI embed-3-large + chunking              │
                    │                  │                               │
                    │                  ▼                               │
                    │     Supabase pgvector  (capture_signals)         │
                    └────────────────────────────────────────────────┬─┘
                                                                     │
                    ┌────────────────────────────────────────────────▼─┐
                    │                SYNTHESIS LAYER                   │
                    │  (runs nightly Sunday — prep for Monday bot)     │
                    │                                                  │
                    │  Topical clustering → article_candidates table   │
                    │  SERP gap scan (SEOwind brief preview) → gaps    │
                    │  Question generation (LLM, RAG over corpus)      │
                    └────────────────────────────────────────────────┬─┘
                                                                     │
                    ┌────────────────────────────────────────────────▼─┐
                    │            JOURNALIST-MODE INTERVIEW             │
                    │  (Monday morning, Telegram bot)                  │
                    │                                                  │
                    │  Bot: "Tuesday you debugged AADSTS50158 with     │
                    │       Claude for ~40 min. Can you confirm this   │
                    │       was a Talencor user and the fix was        │
                    │       Named Locations?  [Yes / No / Context]"    │
                    │                                                  │
                    │  Hassan: voice / text / button — 30s per answer  │
                    └────────────────────────────────────────────────┬─┘
                                                                     │
                    ┌────────────────────────────────────────────────▼─┐
                    │              SEOwind DRAFTING                    │
                    │  - Keyword + SERP analysis                       │
                    │  - "Your own insights" ← confirmed corpus chunks │
                    │  - "Statistics & Quotes" ← specifics             │
                    │  - Custom Brand Voice profile applied            │
                    │  - Draft + SEOwind score                         │
                    └────────────────────────────────────────────────┬─┘
                                                                     │
                    ┌────────────────────────────────────────────────▼─┐
                    │              QUALITY GATE                        │
                    │                                                  │
                    │  Stage A: Rule-based auto-reject                 │
                    │   - <2 corpus citations → reject                 │
                    │   - Generic-phrase blocklist hit → reject        │
                    │   - <100 transcribed words of Hassan → reject    │
                    │                                                  │
                    │  Stage B: Clearscope re-score                    │
                    │   - Independent SERP-grounded scoring            │
                    │   - Must pass ≥80                                │
                    │                                                  │
                    │  Stage C: Aleyda E-E-A-T GPT                     │
                    │   - Pre-publish helpfulness check                │
                    │   - Manual or API call                           │
                    └────────────────────────────────────────────────┬─┘
                                                                     │
                    ┌────────────────────────────────────────────────▼─┐
                    │             SANITY REVIEW + PUBLISH              │
                    │                                                  │
                    │  Draft lands in Sanity Studio                    │
                    │  Telegram notification → Hassan opens in browser │
                    │  Visual edits if needed → "APPROVE" → publish    │
                    │  Webhook → Next.js ISR revalidate                │
                    │  Indexing API ping                               │
                    └────────────────────────────────────────────────┬─┘
                                                                     │
                    ┌────────────────────────────────────────────────▼─┐
                    │              DISTRIBUTION                        │
                    │                                                  │
                    │  T+0:   Blog live                                │
                    │  T+24h: Social drip (Missinglettr)               │
                    │  T+2w:  Medium import (canonical preserved)      │
                    │  Ongoing: GEO tracking (Otterly)                 │
                    └──────────────────────────────────────────────────┘
```

---

## 7. Locked Tool Stack

Cost intentionally not factored — selected for output quality only.

| Layer | Tool | Plan | Why |
|---|---|---|---|
| Capture: AI chats | Claude (Anthropic native export) + Perplexity Spaces export | Existing accounts | Native bulk export available |
| Capture: Email | Microsoft Graph API | Existing M365 tenant | Already authenticated; full Outlook read access |
| Capture: Calls | MS Teams transcripts via Graph | Existing | Auto-generated when recording enabled |
| Capture: Voice notes | Telegram Bot API + Whisper | Existing + OpenAI | Native voice support; cheap accurate transcription |
| Capture storage | Supabase pgvector (existing project) | Existing | Already in production stack |
| Embeddings | OpenAI `text-embedding-3-large` | API | Best general-purpose embedding model; strong on technical vocab |
| Synthesis LLM | Anthropic Claude Sonnet (latest) | API | Best long-context synthesis; question generation quality |
| Interview channel | Telegram Bot | Self-hosted | Lowest friction; voice notes; free |
| Drafting + voice | **SEOwind Pro** | $219/mo | Custom Brand Voice + "Your own insights" + "Statistics & Quotes" + AI Humanizer + Information Gain support |
| Independent re-scorer | **Clearscope** | Essentials | Best-in-class SERP-grounded scoring; ★★★★★ on expertise input in original research |
| E-E-A-T pre-publish check | Aleyda Solis "Content Helpfulness and Quality SEO Analyzer" custom GPT | Free | Industry-respected E-E-A-T scoring |
| CMS | Sanity | Free tier | Visual editor; API; 100K req/mo free |
| Blog | Next.js (existing `artifacts/nexfortis`) | Existing | No change |
| Social distribution | Missinglettr or SocialBee | TBD | Drip campaigns; replaceable |
| Cross-posting | Medium Import Tool | Free | Canonical auto-set |
| Indexing | Google Indexing API | Free | Standard |
| GEO tracking | Otterly ($29/mo) or Semrush AI Visibility ($99/mo) | TBD month 4 | Tracks LLM citations |
| Orchestration | Inngest | Free tier sufficient | Cron jobs + retries; alternative: Supabase Edge Functions + cron |

### Tools deliberately dropped from v1

- **Frase.io** — replaced by SEOwind. Reasoning in Section 2.
- **Typeface / Writer.com** — redundant with SEOwind Custom Brand Voice; stacking would degrade fidelity.
- **NeuronWriter as secondary scorer** — Clearscope is meaningfully better at the job.

---

## 8. Feature Decomposition

The Epic decomposes into four Features. Each has its own Feature PRD.

| # | Feature | Status | Doc | Owner |
|---|---|---|---|---|
| F1 | Continuous Capture & Synthesis Layer | Spec'd | `./capture-synthesis-layer/prd.md` | Hassan + Cursor/Claude |
| F2 | Journalist-Mode Telegram Interview Bot | Spec'd | `./journalist-mode-interview/prd.md` | Hassan + Cursor/Claude |
| F3 | SEOwind Drafting + Multi-Stage Quality Gate | Spec'd | `./seowind-drafting-quality-gate/prd.md` | Hassan + Cursor/Claude |
| F4 | Sanity Review & Publish Workflow | Spec'd | `./sanity-review-publish/prd.md` | Hassan + Cursor/Claude |

**Sequencing:** F1 ships first (it is the foundation). F2 ships second (depends on F1). F3 and F4 can ship in parallel once F1 + F2 are in place. See `./implementation-roadmap.md` for full timeline.

---

## 9. Success Metrics

Beyond the headline KPIs in Section 1, these operational metrics are tracked from day 1:

| Metric | Source | Target | Cadence |
|---|---|---|---|
| Capture signal volume | Supabase counts | ≥200/mo by month 2 | Daily |
| Capture source diversity | Distinct `source` values | All Tier-1 sources active | Weekly |
| Synthesis cluster quality | Manual sample | ≥80% of clusters are usable article candidates | Monthly |
| Bot completion rate | Telegram logs | ≥90% of weekly interviews completed | Weekly |
| Average bot session time | Telegram logs | ≤10 min | Weekly |
| Drafts passing Gate A first try | Pipeline logs | ≥85% | Monthly |
| Drafts passing Gate B (Clearscope ≥80) first try | Pipeline logs | ≥70% | Monthly |
| Drafts requiring rewrite | Pipeline logs | ≤20% | Monthly |
| Sanity approve time | Sanity timestamps | ≤8 min average | Monthly |
| Article publish frequency | Sanity | 5–6/mo | Monthly |
| GSC impressions | GSC | Trending up by month 3 | Monthly |
| AI citation count | GEO tracker | ≥10 prompts by month 6 | Monthly |

---

## 10. Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Claude/Perplexity change export formats | Medium | Medium | Parser is versioned and tested against known fixture files. Manual fallback documented. |
| R2 | SEOwind changes API or pricing | Low | High | Hand-off is via API; can fall back to Frase or Surfer if needed. Brand Voice profile re-trainable. |
| R3 | Cursor/Claude Code drift across many prompts without full forward-context | Medium | Medium | Each prompt carries explicit strategic context, a decisions-already-made section, a future-context preview ("DO NOT modify X / DO NOT install Y because future prompts will"), an allowlist and blocklist of files, and a required Definition-of-Done checklist. PRs are reviewed by Hassan and Computer before merge. |
| R4 | Microsoft Graph rate limits | Low | Medium | Token bucket + exponential backoff. Daily batch sizes well below limits for solo operator. |
| R5 | PII in capture corpus (client names, emails) | High | High | Pre-embed PII redaction step using regex + LLM scrub. Manual review of any chunk before it enters article corpus. |
| R6 | Synthesis surfaces wrong client as "example" | Medium | High | Bot always confirms client attribution as Yes/No question before draft pulls a chunk. |
| R7 | Google core update penalizes the site | Low | Critical | Pillar discipline + human review + small volume + capture-grounded specifics. Recovery playbook in Section 10 of original research doc. |
| R8 | Hassan ignores Monday bot for a month | Medium | Medium | Capture corpus keeps growing; bot can ask retrospective questions ("3 weeks ago you did X — still ok to use?"). Pipeline pauses publishing rather than publishing thin content. |
| R9 | Capture pipeline cost exceeds expectation | Low | Low | All major costs are flat (SEOwind, Clearscope). Embedding cost is bounded; ~$5–15/mo at projected volume. |
| R10 | Custody/family-law content accidentally captured | Low | Critical | Source filters exclude all family-law inbox folders, all conversations containing legal-counsel email addresses, all calls with mediator. Hard-coded blocklist enforced at ingest. |

---

## 11. Linked Documents

- **Architecture & Data Model:** `./architecture-and-data-model.md`
- **Implementation Roadmap:** `./implementation-roadmap.md`
- **Tool Stack Decision Record:** `./tool-stack-decision-record.md`
- **Cursor / Claude Code Prompt Library:** `./cursor-claude-prompt-library.md`
- **Feature PRDs:**
  - F1 Capture & Synthesis: `./capture-synthesis-layer/prd.md`
  - F2 Journalist Interview: `./journalist-mode-interview/prd.md`
  - F3 SEOwind Drafting + Gate: `./seowind-drafting-quality-gate/prd.md`
  - F4 Sanity Publish: `./sanity-review-publish/prd.md`
- **v1 Amendment Note:** `docs/content-pipeline/content-pipeline-prd.md` (v1.0, superseded — see amendment block at top of file)
- **Original Research Sources:**
  - `docs/content-pipeline/research/research-ai-blog-tools.md`
  - `docs/content-pipeline/research/research-google-hcu.md`
  - `docs/content-pipeline/research/research-cross-posting.md`
  - `docs/content-pipeline/research/research-social-media-tools.md`
