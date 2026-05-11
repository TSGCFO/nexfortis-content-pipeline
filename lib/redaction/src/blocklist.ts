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

function constantTimeStringEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function emailMatchesBlocklist(emailHash: string, hashes: readonly string[]): boolean {
  let matched = false;
  for (const candidate of hashes) {
    if (constantTimeStringEquals(emailHash, candidate)) {
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
