import { createHash, timingSafeEqual } from 'node:crypto';

export type BlockedReason = 'email_address' | 'subject_keyword' | 'body_keyword';

/**
 * Thrown by callers that prefer an exception-based flow. The orchestrator
 * (`redact()`) does NOT throw — it returns a discriminated `{ status: 'blocked' }`
 * result. This class is exported for ingester code that wants to throw.
 */
export class BlocklistViolationError extends Error {
  readonly code = 'BLOCKLIST_VIOLATION' as const;
  readonly reason: BlockedReason;

  constructor(reason: BlockedReason, message?: string) {
    super(message ?? `Blocklist violation: ${reason}`);
    this.name = 'BlocklistViolationError';
    this.reason = reason;
  }
}

export interface BlocklistInput {
  source: string;
  senderEmail?: string;
  recipientEmails?: string[];
  subject?: string;
  body: string;
}

export type BlocklistResult =
  | { blocked: false }
  | { blocked: true; reason: BlockedReason; matchedHash?: string };

export interface CheckBlocklistOptions {
  /**
   * Override for the production hash list. Used by tests so they never need to
   * mutate the real `BLOCKLIST_EMAIL_HASHES` const.
   */
  blocklistHashes?: readonly string[];
  subjectRegex?: RegExp;
  bodyKeywords?: readonly string[];
}

/**
 * Production family-law / legal-counsel email hash list.
 *
 * These are intentionally placeholder values. Hassan must replace them with
 * real SHA-256 hex digests of the lower-cased, trimmed email addresses via a
 * separate manual edit before any ingester ships. The placeholder strings are
 * not valid 64-char hex, so the constant-time hash comparison will always
 * reject them — fail-closed by accident is acceptable here, fail-open is not.
 */
export const BLOCKLIST_EMAIL_HASHES: readonly string[] = Object.freeze([
  '__PLACEHOLDER_LEGAL_HASH_1__',
  '__PLACEHOLDER_MEDIATOR_HASH_2__',
]);

/**
 * Subject regex copied verbatim from
 * `architecture-and-data-model.md` §11. Do not loosen — false positives here
 * cost a single capture; false negatives leak personal content into the corpus.
 */
export const BLOCKLIST_SUBJECT_REGEX: RegExp =
  /(custody|mediator|settlement|family court|divorce|separation agreement)/i;

/**
 * Conservative high-confidence body keyword list. Lean strict; any of these
 * appearing in body text indicates family-law correspondence with high
 * probability.
 */
export const BLOCKLIST_BODY_KEYWORDS: readonly string[] = Object.freeze([
  'court order',
  'custody arrangement',
  'mediation session',
  'family law',
  'family court',
  'separation agreement',
  'divorce proceedings',
]);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Constant-time comparison of two hex-encoded hash strings.
 *
 * Both inputs must be valid equal-length hex strings; if either is malformed
 * (e.g. a placeholder like `__PLACEHOLDER_LEGAL_HASH_1__`) the function
 * returns `false`. This means placeholder blocklist entries can never match a
 * real SHA-256 hash — fail-closed-by-accident behavior we rely on.
 *
 * Approach: parse both hex strings into byte buffers, then compare with
 * `crypto.timingSafeEqual`. We do this rather than UTF-8-encode the hex
 * strings directly because hex-decoded-then-compared is the idiomatic
 * cryptographic pattern and makes the intent (compare the underlying hashes,
 * not the textual encoding) unambiguous.
 */
function hexHashesMatch(candidateHex: string, blocklistHex: string): boolean {
  if (candidateHex.length === 0 || candidateHex.length !== blocklistHex.length) {
    return false;
  }
  let bufA: Buffer;
  let bufB: Buffer;
  try {
    bufA = Buffer.from(candidateHex, 'hex');
    bufB = Buffer.from(blocklistHex, 'hex');
  } catch {
    return false;
  }
  // `Buffer.from(_, 'hex')` silently drops invalid characters; verify the
  // round-trip is exact so placeholder strings can't accidentally match a
  // truncated buffer of equal size.
  if (bufA.length === 0 || bufA.length !== bufB.length) {
    return false;
  }
  if (bufA.length * 2 !== candidateHex.length || bufB.length * 2 !== blocklistHex.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function emailMatchesBlocklist(emailHash: string, hashes: readonly string[]): boolean {
  // Walk the entire list even after we find a match so the timing of a
  // matching call is indistinguishable from a non-matching one.
  let matched = false;
  for (const candidate of hashes) {
    if (hexHashesMatch(emailHash, candidate)) {
      matched = true;
    }
  }
  return matched;
}

/**
 * Synchronous blocklist check. MUST run before any redaction logic so that the
 * regex-pass log never records personal-content patterns from a blocked
 * capture.
 */
export function checkBlocklist(
  input: BlocklistInput,
  opts: CheckBlocklistOptions = {},
): BlocklistResult {
  const hashes = opts.blocklistHashes ?? BLOCKLIST_EMAIL_HASHES;
  const subjectRegex = opts.subjectRegex ?? BLOCKLIST_SUBJECT_REGEX;
  const bodyKeywords = opts.bodyKeywords ?? BLOCKLIST_BODY_KEYWORDS;

  const emails: string[] = [];
  if (typeof input.senderEmail === 'string' && input.senderEmail.length > 0) {
    emails.push(input.senderEmail);
  }
  if (Array.isArray(input.recipientEmails)) {
    for (const r of input.recipientEmails) {
      if (typeof r === 'string' && r.length > 0) emails.push(r);
    }
  }

  for (const email of emails) {
    const hash = sha256Hex(normalizeEmail(email));
    if (emailMatchesBlocklist(hash, hashes)) {
      return { blocked: true, reason: 'email_address', matchedHash: hash };
    }
  }

  if (typeof input.subject === 'string' && subjectRegex.test(input.subject)) {
    return { blocked: true, reason: 'subject_keyword' };
  }

  const lowerBody = input.body.toLowerCase();
  for (const kw of bodyKeywords) {
    if (lowerBody.includes(kw.toLowerCase())) {
      return { blocked: true, reason: 'body_keyword' };
    }
  }

  return { blocked: false };
}

/**
 * Convenience wrapper for callers that prefer exception-based control flow.
 *
 * The orchestrator (`redact()`) does NOT use this — it returns a
 * `{ status: 'blocked' }` discriminated result. This helper is provided for
 * ingester code (e.g. an MS Graph email ingester) that wants to short-circuit
 * with a `throw` on the first blocked capture rather than thread a result
 * through multiple call sites.
 *
 * Throws `BlocklistViolationError` if `checkBlocklist` returns `blocked: true`.
 */
export function assertNotBlocked(
  input: BlocklistInput,
  opts: CheckBlocklistOptions = {},
): void {
  const result = checkBlocklist(input, opts);
  if (result.blocked) {
    throw new BlocklistViolationError(
      result.reason,
      `capture blocked by family-law blocklist: ${result.reason}`,
    );
  }
}
