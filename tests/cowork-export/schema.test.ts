import { describe, it, expect } from "vitest";
import { sessionSchema, SCHEMA_VERSION } from "../../tools/nfx-cowork-export/src/schema.js";
import { isValidTimestamp } from "../../tools/nfx-cowork-export/src/utils.js";
import {
  minimalValidSession,
  smallTypicalSession,
  sessionWithSubagent,
  sessionWithNestedSubagent,
} from "./fixtures.js";

describe("schema constants", () => {
  it("SCHEMA_VERSION is 1 (bumping requires a CHANGELOG entry)", () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});

describe("isValidTimestamp", () => {
  it("accepts ISO 8601 UTC with millisecond precision", () => {
    expect(isValidTimestamp("2026-04-08T14:23:11.000Z")).toBe(true);
    expect(isValidTimestamp("2026-12-31T23:59:59.999Z")).toBe(true);
  });

  it("rejects timestamps without milliseconds", () => {
    expect(isValidTimestamp("2026-04-08T14:23:11Z")).toBe(false);
  });

  it("rejects timestamps without Z suffix", () => {
    expect(isValidTimestamp("2026-04-08T14:23:11.000")).toBe(false);
    expect(isValidTimestamp("2026-04-08T14:23:11.000+00:00")).toBe(false);
  });

  it("rejects malformed dates", () => {
    expect(isValidTimestamp("")).toBe(false);
    expect(isValidTimestamp("not a date")).toBe(false);
    expect(isValidTimestamp("2026-04-08")).toBe(false);
  });
});

describe("sessionSchema — valid documents", () => {
  it("accepts the minimal valid session", () => {
    expect(sessionSchema.safeParse(minimalValidSession).success).toBe(true);
  });

  it("accepts a typical small session with mixed event kinds", () => {
    expect(sessionSchema.safeParse(smallTypicalSession).success).toBe(true);
  });

  it("accepts a session with a nested subagent", () => {
    expect(sessionSchema.safeParse(sessionWithSubagent).success).toBe(true);
  });

  it("accepts subagents nested inside subagents (recursion works)", () => {
    expect(sessionSchema.safeParse(sessionWithNestedSubagent).success).toBe(true);
  });

  it("accepts tool_call events without a summary field", () => {
    const doc = {
      ...minimalValidSession,
      events: [
        {
          kind: "tool_call",
          ts: "2026-04-08T14:23:11.000Z",
          uuid: "evt-001",
          tool: "obscure_tool_no_extractor",
        },
      ],
    };
    expect(sessionSchema.safeParse(doc).success).toBe(true);
  });

  it("accepts tool_call events with a summary up to 80 chars", () => {
    const doc = {
      ...minimalValidSession,
      events: [
        {
          kind: "tool_call",
          ts: "2026-04-08T14:23:11.000Z",
          uuid: "evt-001",
          tool: "Bash",
          summary: "x".repeat(80),
        },
      ],
    };
    expect(sessionSchema.safeParse(doc).success).toBe(true);
  });
});

describe("sessionSchema — invalid documents", () => {
  it("rejects a document missing schemaVersion", () => {
    const { schemaVersion: _drop, ...rest } = minimalValidSession;
    expect(sessionSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a document with schemaVersion !== 1", () => {
    expect(sessionSchema.safeParse({ ...minimalValidSession, schemaVersion: 2 }).success).toBe(false);
  });

  it('rejects a document with source !== "claude_cowork"', () => {
    expect(sessionSchema.safeParse({ ...minimalValidSession, source: "claude_web" }).success).toBe(false);
  });

  it("rejects a document missing _exporter", () => {
    const { _exporter: _drop, ...rest } = minimalValidSession;
    expect(sessionSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects an _exporter block with wrong sourceFormat", () => {
    const doc = {
      ...minimalValidSession,
      _exporter: { ...minimalValidSession._exporter, sourceFormat: "wrong-format" },
    };
    expect(sessionSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects a document missing sessionId", () => {
    const { sessionId: _drop, ...rest } = minimalValidSession;
    expect(sessionSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a document missing createdAt", () => {
    const { createdAt: _drop, ...rest } = minimalValidSession;
    expect(sessionSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a document with a non-ms-precision createdAt", () => {
    expect(sessionSchema.safeParse({ ...minimalValidSession, createdAt: "2026-04-08T14:23:11Z" }).success).toBe(false);
  });

  it("rejects an event with an unknown kind", () => {
    const doc = {
      ...minimalValidSession,
      events: [{ kind: "unknown_kind", ts: "2026-04-08T14:23:11.000Z", uuid: "evt-001" }],
    };
    expect(sessionSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects an event missing kind entirely", () => {
    const doc = {
      ...minimalValidSession,
      events: [{ ts: "2026-04-08T14:23:11.000Z", uuid: "evt-001", text: "hi" }],
    };
    expect(sessionSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects an event missing ts", () => {
    const doc = {
      ...minimalValidSession,
      events: [{ kind: "user_text", uuid: "evt-001", text: "hi" }],
    };
    expect(sessionSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects an event missing uuid", () => {
    const doc = {
      ...minimalValidSession,
      events: [{ kind: "user_text", ts: "2026-04-08T14:23:11.000Z", text: "hi" }],
    };
    expect(sessionSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects a user_text event with empty text", () => {
    const doc = {
      ...minimalValidSession,
      events: [{ kind: "user_text", ts: "2026-04-08T14:23:11.000Z", uuid: "evt-001", text: "" }],
    };
    expect(sessionSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects a tool_call event missing the tool field", () => {
    const doc = {
      ...minimalValidSession,
      events: [{ kind: "tool_call", ts: "2026-04-08T14:23:11.000Z", uuid: "evt-001" }],
    };
    expect(sessionSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects a tool_call event with a summary longer than 80 chars", () => {
    const doc = {
      ...minimalValidSession,
      events: [
        {
          kind: "tool_call",
          ts: "2026-04-08T14:23:11.000Z",
          uuid: "evt-001",
          tool: "Bash",
          summary: "x".repeat(81),
        },
      ],
    };
    expect(sessionSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects a subagent event missing subagentSlug", () => {
    const doc = {
      ...minimalValidSession,
      events: [
        {
          kind: "subagent",
          ts: "2026-04-08T14:23:11.000Z",
          uuid: "evt-001",
          parentToolUseId: "toolu_x",
          events: [],
        },
      ],
    };
    expect(sessionSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects a subagent event missing parentToolUseId", () => {
    const doc = {
      ...minimalValidSession,
      events: [
        {
          kind: "subagent",
          ts: "2026-04-08T14:23:11.000Z",
          uuid: "evt-001",
          subagentSlug: "agent-x",
          events: [],
        },
      ],
    };
    expect(sessionSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects a subagent event whose events field is not an array", () => {
    const doc = {
      ...minimalValidSession,
      events: [
        {
          kind: "subagent",
          ts: "2026-04-08T14:23:11.000Z",
          uuid: "evt-001",
          subagentSlug: "agent-x",
          parentToolUseId: "toolu_x",
          events: "not an array",
        },
      ],
    };
    expect(sessionSchema.safeParse(doc).success).toBe(false);
  });
});

describe("sessionSchema — strict mode (rejects unknown fields)", () => {
  it("rejects an unknown field on the top-level document", () => {
    const doc = { ...minimalValidSession, rogueExtraField: "should be rejected" };
    expect(sessionSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects an unknown field on the _exporter block", () => {
    const doc = {
      ...minimalValidSession,
      _exporter: { ...minimalValidSession._exporter, extraProvenance: "leak" },
    };
    expect(sessionSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects an unknown field on a user_text event (e.g. typo 'txt' instead of 'text')", () => {
    const doc = {
      ...minimalValidSession,
      events: [
        {
          kind: "user_text",
          ts: "2026-04-08T14:23:11.000Z",
          uuid: "evt-001",
          text: "hi",
          txt: "this typo should be rejected, not silently dropped",
        },
      ],
    };
    expect(sessionSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects an unknown field on an assistant_text event", () => {
    const doc = {
      ...minimalValidSession,
      events: [
        {
          kind: "assistant_text",
          ts: "2026-04-08T14:23:11.000Z",
          uuid: "evt-001",
          text: "hi",
          unexpectedExtra: "x",
        },
      ],
    };
    expect(sessionSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects an unknown field on a tool_call event", () => {
    const doc = {
      ...minimalValidSession,
      events: [
        {
          kind: "tool_call",
          ts: "2026-04-08T14:23:11.000Z",
          uuid: "evt-001",
          tool: "Bash",
          extraArg: "should fail",
        },
      ],
    };
    expect(sessionSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects an unknown field on a subagent event", () => {
    const doc = {
      ...minimalValidSession,
      events: [
        {
          kind: "subagent",
          ts: "2026-04-08T14:23:11.000Z",
          uuid: "evt-001",
          subagentSlug: "agent-x",
          parentToolUseId: "toolu_x",
          events: [],
          extraField: "no",
        },
      ],
    };
    expect(sessionSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects an unknown field on a nested subagent's event", () => {
    const doc = {
      ...minimalValidSession,
      events: [
        {
          kind: "subagent",
          ts: "2026-04-08T14:23:11.000Z",
          uuid: "evt-outer",
          subagentSlug: "agent-x",
          parentToolUseId: "toolu_x",
          events: [
            {
              kind: "assistant_text",
              ts: "2026-04-08T14:23:12.000Z",
              uuid: "evt-inner",
              text: "hi",
              rogueNested: "should also be rejected",
            },
          ],
        },
      ],
    };
    expect(sessionSchema.safeParse(doc).success).toBe(false);
  });
});

describe("sessionSchema — continuationGroupId rules", () => {
  it("accepts a non-empty continuationGroupId", () => {
    const doc = { ...minimalValidSession, continuationGroupId: "sha256:abc123" };
    expect(sessionSchema.safeParse(doc).success).toBe(true);
  });

  it("accepts a document without continuationGroupId at all", () => {
    expect(sessionSchema.safeParse(minimalValidSession).success).toBe(true);
  });

  it("rejects an empty-string continuationGroupId (empty is a bug, not 'no group')", () => {
    const doc = { ...minimalValidSession, continuationGroupId: "" };
    expect(sessionSchema.safeParse(doc).success).toBe(false);
  });
});
