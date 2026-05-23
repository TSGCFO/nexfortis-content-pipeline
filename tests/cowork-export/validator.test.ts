import { describe, it, expect } from "vitest";
import {
  validateSession,
  validateSessionOrThrow,
  formatValidationResult,
  SessionValidationError,
} from "../../tools/nfx-cowork-export/src/validator.js";
import { minimalValidSession, smallTypicalSession, sessionWithSubagent } from "./fixtures.js";

describe("validateSession — success path", () => {
  it("returns ok: true with the typed document for a valid session", () => {
    const result = validateSession(minimalValidSession);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.schemaVersion).toBe(1);
      expect(result.document.source).toBe("claude_cowork");
      expect(result.document.events).toEqual([]);
    }
  });

  it("preserves event content through validation", () => {
    const result = validateSession(smallTypicalSession);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.events).toHaveLength(4);
      expect(result.document.events[0]?.kind).toBe("user_text");
    }
  });

  it("preserves nested subagent events through validation", () => {
    const result = validateSession(sessionWithSubagent);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const sub = result.document.events[1];
      expect(sub?.kind).toBe("subagent");
      if (sub?.kind === "subagent") {
        expect(sub.events).toHaveLength(1);
        expect(sub.events[0]?.kind).toBe("assistant_text");
      }
    }
  });
});

describe("validateSession — failure path", () => {
  it("returns ok: false with a list of issues for an invalid document", () => {
    const result = validateSession({ schemaVersion: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("annotates each issue with its JSON path", () => {
    const result = validateSession({
      ...minimalValidSession,
      events: [
        { kind: "user_text", ts: "not a timestamp", uuid: "evt-001", text: "hi" },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const tsIssue = result.errors.find((e) => e.path.includes("ts"));
      expect(tsIssue).toBeDefined();
      expect(tsIssue?.path).toBe("events.0.ts");
    }
  });

  it("returns issues with structured code so callers can branch on them", () => {
    const result = validateSession({ ...minimalValidSession, source: "wrong" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const sourceIssue = result.errors.find((e) => e.path === "source");
      expect(sourceIssue?.code).toBeTruthy();
    }
  });
});

describe("validateSessionOrThrow", () => {
  it("returns the typed document on success", () => {
    const doc = validateSessionOrThrow(minimalValidSession);
    expect(doc.sessionId).toBe("synthetic-session-001");
  });

  it("throws SessionValidationError on failure, carrying all issues", () => {
    expect(() => validateSessionOrThrow({ schemaVersion: 2 })).toThrowError(SessionValidationError);

    try {
      validateSessionOrThrow({ schemaVersion: 2 });
    } catch (err) {
      expect(err).toBeInstanceOf(SessionValidationError);
      if (err instanceof SessionValidationError) {
        expect(err.issues.length).toBeGreaterThan(0);
        expect(err.message).toContain("failed schema validation");
      }
    }
  });
});

describe("formatValidationResult", () => {
  it("returns an empty string for a successful result", () => {
    expect(formatValidationResult({ ok: true, document: minimalValidSession })).toBe("");
  });

  it("formats issues as multi-line text with paths", () => {
    const result = validateSession({ schemaVersion: 2, source: "wrong" });
    if (result.ok) throw new Error("expected validation failure");
    const formatted = formatValidationResult(result);
    expect(formatted).toContain("schemaVersion");
    expect(formatted).toContain("source");
  });
});
