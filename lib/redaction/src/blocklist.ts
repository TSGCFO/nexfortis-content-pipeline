import { createHash, timingSafeEqual } from 'node:crypto';

export class BlocklistViolationError extends Error {
  public readonly code = 'BLOCKLIST_VIOLATION';

  constructor(
    message: string,
    public readonly reason: 'email_address' | 'subject_keyword' | 'body_keyword',
  ) {
    super(message);
    this.name = 'BlocklistViolationError';
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
  | {
      blocked: true;
      reason: 'email_address' | 'subject_keyword' | 'body_keyword';
      matchedHash?: string;
    };

export interface CheckBlocklistOptions {
  blocklistHashes?: readonly string[];
}

/**
 * Pre-computed SHA-256 hex hashes of the legal counsel + mediator email
 * addresses. The real values are populated separately by Hassan via a manual
 * edit before any ingester ships — these placeholder values cannot match any
 * real SHA-256 hash because they are not valid hex.
 */
export const BLOCKLIST_EMAIL_HASHES: readonly string[] = [
  '__PLACEHOLDER_LEGAL_HASH_1__',
  '__PLACEHOLDER_MEDIATOR_HASH_2__',
];

/**
 * Matches the family-law subject regex from
 * architecture-and-data-model.md §11.
 */
export const BLOCKLIST_SUBJECT_REGEX: RegExp =
  /(custody|mediator|settlement|family court|divorce|separation agreement)/i;

/**
 * Conservative set of high-confidence family-law body keywords. Lean strict:
 * false positives here cost a single capture, false negatives cost the user.
 */
export const BLOCKLIST_BODY_KEYWORDS: readonly string[] = [
  'court order',
  'custody arrangement',
  'mediation session',
  'family law',
  'separation agreement',
  'family court',
  'child custody',
];

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Compares two hex-encoded hash strings in constant time. Returns false if
 * either string is not valid equal-length hex; placeholder blocklist entries
 * therefore can never match a real hash.
 */
function hashesMatch(candidateHex: string, blocklistHex: string): boolean {
  if (candidateHex.length === 0 || candidateHex.length !== blocklistHex.length) {
    return false;
  }
  let a: Buffer;
  let b: Buffer;
  try {
    a = Buffer.from(candidateHex, 'hex');
    b = Buffer.from(blocklistHex, 'hex');
  } catch {
    return false;
  }
  if (a.length === 0 || a.length !== b.length) {
    return false;
  }
  if (a.length * 2 !== candidateHex.length || b.length * 2 !== blocklistHex.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

function emailMatchesBlocklist(
  email: string,
  hashes: readonly string[],
): { matched: true; hash: string } | { matched: false } {
  const normalized = normalizeEmail(email);
  if (normalized.length === 0) return { matched: false };
  const candidateHash = sha256Hex(normalized);
  for (const entry of hashes) {
    if (hashesMatch(candidateHash, entry)) {
      return { matched: true, hash: candidateHash };
    }
  }
  return { matched: false };
}

export function checkBlocklist(
  input: BlocklistInput,
  options?: CheckBlocklistOptions,
): BlocklistResult {
  const hashes = options?.blocklistHashes ?? BLOCKLIST_EMAIL_HASHES;

  if (input.senderEmail !== undefined) {
    const m = emailMatchesBlocklist(input.senderEmail, hashes);
    if (m.matched) {
      return { blocked: true, reason: 'email_address', matchedHash: m.hash };
    }
  }

  if (input.recipientEmails) {
    for (const recipient of input.recipientEmails) {
      const m = emailMatchesBlocklist(recipient, hashes);
      if (m.matched) {
        return { blocked: true, reason: 'email_address', matchedHash: m.hash };
      }
    }
  }

  if (input.subject !== undefined && BLOCKLIST_SUBJECT_REGEX.test(input.subject)) {
    return { blocked: true, reason: 'subject_keyword' };
  }

  const bodyLower = input.body.toLowerCase();
  for (const kw of BLOCKLIST_BODY_KEYWORDS) {
    if (bodyLower.includes(kw.toLowerCase())) {
      return { blocked: true, reason: 'body_keyword' };
    }
  }

  return { blocked: false };
}

/**
 * Convenience helper for callers that prefer exception-style control flow.
 * Throws BlocklistViolationError if blocked.
 */
export function assertNotBlocked(
  input: BlocklistInput,
  options?: CheckBlocklistOptions,
): void {
  const result = checkBlocklist(input, options);
  if (result.blocked) {
    throw new BlocklistViolationError(
      `Input blocked by family-law blocklist (reason: ${result.reason})`,
      result.reason,
    );
  }
}

/**
 * Test helper exported for unit tests: hash a plaintext email the same way
 * the production blocklist does. Not intended for production callers.
 */
export function hashEmailForBlocklist(email: string): string {
  return sha256Hex(normalizeEmail(email));
}
