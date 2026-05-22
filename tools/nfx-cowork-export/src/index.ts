/**
 * Public surface of the exporter package.
 */

export {
  SCHEMA_VERSION,
  sessionSchema,
  exporterMetaSchema,
  eventSchema,
  type SessionDocument,
  type Event,
  type ExporterMeta,
} from "./schema.js";

export { isValidTimestamp } from "./utils.js";

export {
  validateSession,
  validateSessionOrThrow,
  formatValidationResult,
  SessionValidationError,
  type ValidationResult,
  type ValidationIssue,
} from "./validator.js";

// Slice 2 — discovery + session filtering surface
export type {
  SessionDiscovery,
  SessionMeta,
  TranscriptFile,
  FilterDecision,
  SessionDropReason,
  ExporterConfig,
  AuditRow,
  ParsedSession,
  ParsedTranscript,
} from "./types.js";

export {
  loadExporterConfig,
  ConfigMissingError,
  ConfigInvalidError,
  type LoadExporterConfigOptions,
} from "./config.js";

export {
  discoverSessions,
  classifyTranscriptPath,
  toPosixPath,
  subagentsDirectoryForParent,
  transcriptIdFromPath,
} from "./discovery.js";
export { filterSession, matchesAnyPrefix } from "./filter-session.js";
export {
  buildAuditRows,
  summarize,
  renderAuditReport,
  type AuditSummary,
} from "./audit.js";

// Slice 3 — per-event parser + tool-call summaries + post-check
export {
  parseTranscript,
  classifyAndConvert,
  type ParseResult,
} from "./parser.js";
export {
  extractToolSummary,
  findExtractor,
  type ToolSummaryExtractor,
} from "./tool-summary.js";
export {
  postCheckSession,
  type PostCheckDecision,
  type PostCheckStats,
  MIN_EVENTS,
  MIN_TEXT_CHARS,
  MIN_CWD_ALLOWED_RATIO,
} from "./post-check.js";

// Slice 4 — auto-continuation + subagent stitching
export {
  SCAFFOLD_PREFIX,
  stripContinuationScaffold,
  computeContinuationGroupId,
  firstUserText,
  type ScaffoldStripResult,
} from "./continuation.js";
export {
  AGENT_TOOL_NAME,
  doStitch,
  readAgentDispatchMap,
  stitchSubagents,
  type SubagentStitchInput,
} from "./stitch.js";

export {
  runDiscovery,
  type RunDiscoveryOptions,
  type RunDiscoveryResult,
} from "./run-discovery.js";
