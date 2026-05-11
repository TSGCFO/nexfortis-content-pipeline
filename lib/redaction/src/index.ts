export type {
  BlockReason,
  PiiStatus,
  RedactionInput,
  RedactionLogEntry,
  RedactionResult,
} from './types.js';

export {
  BLOCKLIST_BODY_KEYWORDS,
  BLOCKLIST_EMAIL_HASHES,
  BLOCKLIST_SUBJECT_REGEX,
  BlocklistViolationError,
  assertNotBlocked,
  checkBlocklist,
  hashEmailForBlocklist,
} from './blocklist.js';
export type {
  BlocklistInput,
  BlocklistResult,
  CheckBlocklistOptions,
} from './blocklist.js';

export { regexPass } from './regex-pass.js';

export { haikuScrub, DEFAULT_HAIKU_MODEL } from './haiku-scrub.js';
export type {
  HaikuEntity,
  HaikuScrubOptions,
  HaikuScrubResult,
  HaikuStructuredOutput,
} from './haiku-scrub.js';

export { redact } from './redact.js';
