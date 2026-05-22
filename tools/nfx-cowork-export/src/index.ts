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
} from "./types.js";

export {
  loadExporterConfig,
  ConfigMissingError,
  ConfigInvalidError,
  type LoadExporterConfigOptions,
} from "./config.js";

export { discoverSessions } from "./discovery.js";
export { filterSession, matchesAnyPrefix } from "./filter-session.js";
export {
  buildAuditRows,
  summarize,
  renderAuditReport,
  type AuditSummary,
} from "./audit.js";
export {
  runDiscovery,
  type RunDiscoveryOptions,
  type RunDiscoveryResult,
} from "./run-discovery.js";
