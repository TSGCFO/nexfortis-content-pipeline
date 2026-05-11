# v1 PRD Amendment Note

**Document Owner:** Hassan Sadiq, NexFortis  
**Status:** Informational — No Action Required (read-only)  
**Created:** May 10, 2026  
**Applies To:** `docs/content-pipeline/content-pipeline-prd.md` (v1.0)

---

## Status of v1.0

**`docs/content-pipeline/content-pipeline-prd.md` is superseded by v2.**

The authoritative specification is now the NexFortis Automated Content Pipeline v2 Epic PRD at:
`docs/ways-of-work/plan/content-pipeline-v2/epic-prd.md`

The v1.0 file is preserved for historical reference. It must not be implemented. A three-line banner (below) should be inserted at the very top of the v1 file by Hassan or the next developer who opens it:

```
> ⚠️ SUPERSEDED — This document (v1.0) has been replaced by the Content Pipeline v2 Epic PRD.
> See: docs/ways-of-work/plan/content-pipeline-v2/epic-prd.md
> Do not implement from this document. Preserved for historical reference only.
```

The rest of the v1 file must remain intact below the banner.

---

## The Architectural Pivot

v1 proposed a pipeline built around a **single weekly expertise-extraction event** (Monday Telegram interview → Frase draft). v2 inverts this. The pivot has two dimensions:

**1. Capture first, interview second.**  
Instead of relying on Hassan to generate expertise on demand every Monday, v2 captures the expertise Hassan is already producing daily — in Claude conversations, Perplexity research threads, Microsoft 365 emails, Teams transcripts, and voice notes — and stores it in a searchable Supabase vector corpus. The Monday interview in v2 is a confirmation exercise against already-captured evidence, not a cold knowledge-extraction exercise.

**2. SEOwind replaces Frase; three-stage gate replaces single scorer.**  
Frase had no structured slot for first-person expertise. SEOwind provides dedicated "Your own insights" and "Statistics & Quotes" brief fields, plus Custom Brand Voice training. The single Frase score in v1 is replaced by a three-stage gate: rule-based auto-reject (Stage A), independent Clearscope re-score (Stage B), and Aleyda Solis E-E-A-T GPT (Stage C).

---

## What Remains Valid from v1

The following v1 sections remain accurate and are carried forward into v2 without material change:

| v1 Section | Status | Note |
|---|---|---|
| §7 Content Architecture (Pillar/Cluster Model) | ✅ Valid | Three pillars (QB, Managed IT, Cybersecurity), pillar/cluster structure, content calendar rotation — unchanged |
| §8 Google's Helpful Content System — Rules & Rationale | ✅ Valid | HCU rules, information gain analysis, E-E-A-T framework — all still accurate and carried into v2 |
| §9 E-E-A-T Implementation Checklist | ✅ Valid | All P0/P1/P2 E-E-A-T requirements are inherited by v2 |
| §10 Social Media & SEO Research | ✅ Valid | Blog-first distribution, no LinkedIn full articles, Medium Import Tool canonical rules — unchanged |
| §11 Cross-Posting Rules | ✅ Valid | All platform-by-platform rules intact |
| §4 User Stories — US6 (no surprise publishing) | ✅ Valid | Human approval gate is non-negotiable in v2 (NG1 in Epic PRD) |

---

## What Is Obsolete in v1

The following v1 sections describe components that have been replaced and must not be implemented:

| v1 Section | Status | Replacement in v2 |
|---|---|---|
| §5 System Overview (Frase-centric diagram) | ❌ Obsolete | See Epic PRD §6 (System Overview) |
| §6 Step 1: Topic Selection via Frase | ❌ Obsolete | F1: Synthesis job clusters corpus signals; article candidates are corpus-driven, not Frase-driven |
| §6 Step 2: Smart Interview (generic questions) | ❌ Obsolete | F2: Journalist-mode interview with retrieved context and confirmation-first questions |
| §6 Step 3: Research & Draft via Frase | ❌ Obsolete | F3: SEOwind brief assembly + multi-stage quality gate |
| §12 Tool Stack & Costs (Frase, old Telegram bot) | ❌ Obsolete | See Epic PRD §7 (Locked Tool Stack) |
| §13 Requirements (Frase score ≥80 as sole gate) | ❌ Obsolete | Three-stage gate in F3 |
| §15 Design Decisions (Decision 2: Frase over alternatives) | ❌ Obsolete | ADR-002 in tool-stack-decision-record.md supersedes |
| §16 Implementation Phases (Phase 1–4) | ❌ Obsolete | See implementation-roadmap.md (Track 1 and Track 2) |
