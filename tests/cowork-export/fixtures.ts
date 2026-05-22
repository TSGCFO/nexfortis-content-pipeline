/**
 * Hand-crafted fixture documents used by the schema and validator tests.
 *
 * These are NOT extracted from real Cowork data — they are synthetic,
 * minimal, and exhaustive over the shapes the schema is supposed to accept
 * and reject. Real-data round-trip tests come later in slice 2+ when the
 * parser is built.
 *
 * IMPORTANT: never put real family-law slugs, real client names, or real
 * credentials into fixtures. Use deliberately fake values so the fixtures
 * are safe to commit.
 */

import type { SessionDocument } from "../../tools/nfx-cowork-export/src/schema.js";

const FAKE_EXPORTER = {
  name: "nfx-cowork-export" as const,
  version: "0.0.1",
  sourceFormat: "cowork-jsonl-v1" as const,
  exportedAt: "2026-05-22T13:45:00.000Z",
};

/** The smallest possible valid session — just the required fields, empty events. */
export const minimalValidSession: SessionDocument = {
  schemaVersion: 1,
  _exporter: FAKE_EXPORTER,
  source: "claude_cowork",
  sessionId: "synthetic-session-001",
  createdAt: "2026-04-08T14:23:11.000Z",
  events: [],
};

/** A typical small session with one user message, one assistant reply, two tool calls. */
export const smallTypicalSession: SessionDocument = {
  schemaVersion: 1,
  _exporter: FAKE_EXPORTER,
  source: "claude_cowork",
  sessionId: "synthetic-session-002",
  sessionSlug: "synthetic-slug-002",
  workspaceId: "synthetic-workspace-001",
  title: "Synthetic test session",
  createdAt: "2026-04-08T14:23:11.000Z",
  lastActivityAt: "2026-04-08T14:23:17.000Z",
  model: "claude-opus-4-6",
  account: "fake-user@example.test",
  cwds: ["/sessions/synthetic-slug-002"],
  gitBranches: ["HEAD"],
  mcpServers: ["Claude_in_Chrome"],
  events: [
    {
      kind: "user_text",
      ts: "2026-04-08T14:23:11.000Z",
      uuid: "evt-001",
      cwd: "/sessions/synthetic-slug-002",
      gitBranch: "HEAD",
      text: "Synthetic question about a synthetic problem.",
    },
    {
      kind: "assistant_text",
      ts: "2026-04-08T14:23:14.000Z",
      uuid: "evt-002",
      cwd: "/sessions/synthetic-slug-002",
      gitBranch: "HEAD",
      text: "Synthetic answer about the synthetic problem.",
    },
    {
      kind: "tool_call",
      ts: "2026-04-08T14:23:17.000Z",
      uuid: "evt-003",
      cwd: "/sessions/synthetic-slug-002",
      gitBranch: "HEAD",
      tool: "mcp__Claude_in_Chrome__navigate",
      summary: "https://example.test/page",
    },
    // Demonstrates the "summary is optional when no bespoke extractor exists" rule:
    {
      kind: "tool_call",
      ts: "2026-04-08T14:23:19.000Z",
      uuid: "evt-004",
      cwd: "/sessions/synthetic-slug-002",
      gitBranch: "HEAD",
      tool: "mcp__some__obscure_tool",
      // no `summary` field — and that is valid.
    },
  ],
};

/** A session containing a nested subagent (one level of recursion). */
export const sessionWithSubagent: SessionDocument = {
  schemaVersion: 1,
  _exporter: FAKE_EXPORTER,
  source: "claude_cowork",
  sessionId: "synthetic-session-003",
  createdAt: "2026-04-08T14:23:11.000Z",
  events: [
    {
      kind: "user_text",
      ts: "2026-04-08T14:23:11.000Z",
      uuid: "evt-001",
      text: "Synthetic parent prompt.",
    },
    {
      kind: "subagent",
      ts: "2026-04-08T14:25:02.000Z",
      uuid: "evt-002",
      subagentSlug: "agent-synthetic-001",
      parentToolUseId: "toolu_synthetic_001",
      events: [
        {
          kind: "assistant_text",
          ts: "2026-04-08T14:25:03.000Z",
          uuid: "evt-sub-001",
          text: "Synthetic subagent reply.",
        },
      ],
    },
  ],
};

/** A session containing a subagent that itself contains a subagent (two levels of recursion). */
export const sessionWithNestedSubagent: SessionDocument = {
  schemaVersion: 1,
  _exporter: FAKE_EXPORTER,
  source: "claude_cowork",
  sessionId: "synthetic-session-004",
  createdAt: "2026-04-08T14:23:11.000Z",
  events: [
    {
      kind: "subagent",
      ts: "2026-04-08T14:25:02.000Z",
      uuid: "evt-outer",
      subagentSlug: "agent-outer-001",
      parentToolUseId: "toolu_outer_001",
      events: [
        {
          kind: "subagent",
          ts: "2026-04-08T14:25:30.000Z",
          uuid: "evt-inner",
          subagentSlug: "agent-inner-001",
          parentToolUseId: "toolu_inner_001",
          events: [
            {
              kind: "assistant_text",
              ts: "2026-04-08T14:25:31.000Z",
              uuid: "evt-deep",
              text: "Synthetic deep reply.",
            },
          ],
        },
      ],
    },
  ],
};
