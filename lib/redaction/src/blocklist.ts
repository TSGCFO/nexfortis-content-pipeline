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
 * Each entry is the SHA-256 hex digest of a lower-cased, trimmed email
 * address. Plaintext addresses are NEVER stored in this repo — the role
 * comments below are deliberately generic. To add an entry:
 *
 *   echo -n "address@example.com" | tr '[:upper:]' '[:lower:]' | sha256sum
 *
 * Populated 2026-06-12 from the real case correspondents, replacing the
 * original placeholders. Any change requires a PR and Hassan's review.
 */
export const BLOCKLIST_EMAIL_HASHES: readonly string[] = Object.freeze([
  // Own family-law counsel (firm: lead, associate, clerks, accounting, office)
  '41aa7880739b091b4e8be5880bb6c1a8bf99ed613905f57869290a58a738b65d',
  '778e016a9cab30778aafb3c821775eeb4fbe6bc1d7a1ca1334b1c18a41cbbc83',
  '80acc69ec898b85163b7e0e3b8af359682437d497fc9a973df5624d49d247b78',
  '04b72c62a007601262b307ea1470399cca49c598cba7f328ccbeeaa346244521',
  '97664c8524b7ac6fe439b78f4dc1289412748110975b971d44af92e3f00dd7f5',
  'c2d4fa12e8ece62e406d537cda429bc7c62e0476f56d14f9515895ac6370a5ef',
  // Mediator's office + mediator
  'f2ef8ce23f11fa153650d2d05a40bd937f90343879ca06d3aa0b07a9cf396abf',
  '6ca7d6f8c93f5f7b21487c9ab5a9ae0eb4e5e420a58f1dd206f0cb35d7ada39e',
  // Opposing counsel (lead + staff)
  'e936e41c7ed606b7362abdb37f934305db9ecb316ca2f6485715b3e1de4e6b73',
  '332bf78036f66de565ea8de1b692586c713cdc9f08d2891146b8d82f5c1cb831',
  // Prior/other counsel
  'e19e3c987a97620af9f7c141c0b48b36b6d1d1da14c9300b8a39f86f6f1e27f2',
  // Opposing party
  '20c50022758c8f07ac0e16d997d5d0492130bca87c33054eb6ef60d7964f0fbe',
  // Family member copied on case correspondence
  '85fe5b322551b5b16ef35bdb70253b3b3e597c6f694fff11a007fa40846a099f',
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
