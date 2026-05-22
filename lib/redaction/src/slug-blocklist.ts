/**
 * Family-law session-slug blocklist mechanism.
 *
 * Used by `tools/nfx-cowork-export` (and any future caller) to drop entire
 * Cowork sessions whose slug appears on a configured deny list.
 *
 * Design:
 *
 * - **Plaintext slugs in config, hashed slugs in logs.** The deny list is a
 *   list of plaintext slug strings (case-sensitive). Callers supply it from
 *   their own config file. When a match occurs, the result carries the
 *   SHA-256 hex hash of the matched slug — never the slug itself. This is
 *   what the audit log writes, so personal-context slugs never leak.
 *
 * - **No regex, no wildcards.** v1 is exact-match only. Wildcards would invite
 *   false positives and the cost of catching one more case-variant is one
 *   line in the config file.
 *
 * - **Constant-time comparison.** The match loop uses `timingSafeEqual` over
 *   the byte arrays of slug-vs-candidate. Family-law adjacency is sensitive
 *   enough that we don't want timing leaks even though the surface is small.
 *
 * - **Empty list is allowed.** A user with no family-law slugs to block
 *   passes an empty array and the function returns `{ blocked: false }` for
 *   any input. Fail-closed posture is enforced at the CALLER level (refuse
 *   to run if the config FILE is missing) — that policy doesn't belong in
 *   the matcher.
 */

import { createHash, timingSafeEqual } from 'node:crypto';

export interface SlugBlocklistResult {
  /** True when `slug` matched any entry in `blocklistedSlugs`. */
  blocked: boolean;
  /**
   * SHA-256 hex digest of the matched slug (lowercase, UTF-8 encoded).
   *
   * Present only when `blocked === true`. Safe to log to the audit trail —
   * does not leak the slug itself. Absent when `blocked === false`.
   */
  matchedHash?: string;
}

export interface CheckSlugBlocklistOptions {
  /**
   * Plaintext slugs to block. Case-sensitive exact match against the
   * `slug` argument. Empty array is valid — returns `blocked: false` for
   * any input.
   */
  blocklistedSlugs: readonly string[];
}

/**
 * Compute the SHA-256 hex digest of a slug. Exposed because callers
 * sometimes want to log a hash for an UNMATCHED slug too (for instance to
 * trace which sessions were inspected without revealing them).
 */
export function hashSlug(slug: string): string {
  return createHash('sha256').update(slug, 'utf8').digest('hex');
}

/**
 * Check whether `slug` appears in the supplied blocklist.
 *
 * Returns `{ blocked: false }` if the input slug is empty (empty slug is
 * a bug at the parser layer, not a "matched" condition).
 */
export function checkSlugBlocklist(
  slug: string,
  options: CheckSlugBlocklistOptions
): SlugBlocklistResult {
  if (slug.length === 0) {
    return { blocked: false };
  }

  const slugBytes = Buffer.from(slug, 'utf8');

  for (const candidate of options.blocklistedSlugs) {
    if (candidate.length === 0) continue;
    const candidateBytes = Buffer.from(candidate, 'utf8');
    if (candidateBytes.length !== slugBytes.length) continue;
    if (timingSafeEqual(slugBytes, candidateBytes)) {
      return { blocked: true, matchedHash: hashSlug(slug) };
    }
  }

  return { blocked: false };
}
