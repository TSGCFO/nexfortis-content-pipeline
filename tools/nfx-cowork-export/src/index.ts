/**
 * Public surface of the exporter package.
 *
 * The CLI is the primary entrypoint for end users (`nfx-cowork-export ...`),
 * but the library exports here let the validator be used from elsewhere in
 * the pipeline workspace — notably the ingester's pre-flight check.
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
