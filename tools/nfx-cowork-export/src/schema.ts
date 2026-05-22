/**
 * Output schema for the Cowork session exporter.
 *
 * THIS FILE IS THE CONTRACT. Every emitted JSON file is validated against this
 * schema before it touches disk. The ingester (pipeline side, not in this repo
 * yet) reads files against this same schema and refuses to consume any file
 * whose `schemaVersion` it does not recognize.
 *
 * Any change to the shape produced here MUST:
 *   1. Bump `SCHEMA_VERSION` (see below).
 *   2. Add an entry to CHANGELOG.md describing the change and migration path.
 *   3. Ship in a single commit together with both of the above.
 *
 * Closed `kind` set for v1: "user_text" | "assistant_text" | "tool_call" | "subagent".
 * Adding a new kind requires a schemaVersion bump.
 */

import { z } from "zod";

// The current schema version emitted by this exporter.
// The ingester's schemaVersion guard is what enforces compatibility — it MUST
// refuse files with values it does not recognize. See CHANGELOG.md for history.
export const SCHEMA_VERSION = 1;

// Primitive constraints

/**
 * ISO 8601 UTC with millisecond precision and a literal `Z` suffix.
 * Example: "2026-04-08T14:23:11.000Z"
 */
const ISO_UTC_MS_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const isoUtcMs = z
  .string()
  .regex(ISO_UTC_MS_REGEX, "expected ISO 8601 UTC with milliseconds and Z suffix (e.g. 2026-04-08T14:23:11.000Z)");

const nonEmptyString = z.string().min(1);

// Event shapes

const eventCommon = {
  ts: isoUtcMs,
  uuid: nonEmptyString,
  cwd: z.string().optional(),
  gitBranch: z.string().optional(),
} as const;

const userTextEvent = z.object({
  ...eventCommon,
  kind: z.literal("user_text"),
  text: nonEmptyString,
});

const assistantTextEvent = z.object({
  ...eventCommon,
  kind: z.literal("assistant_text"),
  text: nonEmptyString,
});

const toolCallEvent = z.object({
  ...eventCommon,
  kind: z.literal("tool_call"),
  tool: nonEmptyString,
  summary: z.string().max(80).optional(),
});

export type UserTextEvent = z.infer<typeof userTextEvent>;
export type AssistantTextEvent = z.infer<typeof assistantTextEvent>;
export type ToolCallEvent = z.infer<typeof toolCallEvent>;

// Optional fields use `| undefined` explicitly because tsconfig has
// `exactOptionalPropertyTypes: true`, under which `cwd?: string` and the
// zod-inferred `cwd?: string | undefined` are not assignable to each other.
export type SubagentEvent = {
  kind: "subagent";
  ts: string;
  uuid: string;
  cwd?: string | undefined;
  gitBranch?: string | undefined;
  subagentSlug: string;
  parentToolUseId: string;
  events: Event[];
};

export type Event = UserTextEvent | AssistantTextEvent | ToolCallEvent | SubagentEvent;

// Forward-declaration so the lazy callback inside `subagentEventSchema` can
// close over a reference resolved after the discriminated union is built.
let eventSchemaRef: z.ZodType<Event>;

const subagentEventSchema = z.object({
  ...eventCommon,
  kind: z.literal("subagent"),
  subagentSlug: nonEmptyString,
  parentToolUseId: nonEmptyString,
  events: z.array(z.lazy(() => eventSchemaRef)),
});

eventSchemaRef = z.discriminatedUnion("kind", [
  userTextEvent,
  assistantTextEvent,
  toolCallEvent,
  subagentEventSchema,
]);

export const eventSchema = eventSchemaRef;

// Exporter provenance block

export const exporterMetaSchema = z.object({
  name: z.literal("nfx-cowork-export"),
  version: nonEmptyString,
  sourceFormat: z.literal("cowork-jsonl-v1"),
  exportedAt: isoUtcMs,
});

export type ExporterMeta = z.infer<typeof exporterMetaSchema>;

// Top-level session document

export const sessionSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  _exporter: exporterMetaSchema,
  source: z.literal("claude_cowork"),
  sessionId: nonEmptyString,
  sessionSlug: z.string().optional(),
  continuationGroupId: z.string().optional(),
  workspaceId: z.string().optional(),
  title: z.string().optional(),
  createdAt: isoUtcMs,
  lastActivityAt: isoUtcMs.optional(),
  model: z.string().optional(),
  account: z.string().optional(),
  cwds: z.array(z.string()).optional(),
  gitBranches: z.array(z.string()).optional(),
  mcpServers: z.array(z.string()).optional(),
  events: z.array(eventSchema),
});

export type SessionDocument = z.infer<typeof sessionSchema>;
