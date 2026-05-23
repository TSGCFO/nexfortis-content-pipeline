import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  checkSlugBlocklist,
  hashSlug,
} from '../../lib/redaction/src/slug-blocklist.js';

const sha256Hex = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

describe('hashSlug', () => {
  it('produces a 64-char lowercase hex digest', () => {
    const h = hashSlug('synthetic-test-slug');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(sha256Hex('synthetic-test-slug'));
  });

  it('is deterministic — same input produces same digest', () => {
    const a = hashSlug('repeatable-slug');
    const b = hashSlug('repeatable-slug');
    expect(a).toBe(b);
  });

  it('is sensitive to case', () => {
    expect(hashSlug('synthetic-foo')).not.toBe(hashSlug('Synthetic-Foo'));
  });
});

describe('checkSlugBlocklist', () => {
  it('returns blocked: false for an empty blocklist', () => {
    const result = checkSlugBlocklist('any-slug', { blocklistedSlugs: [] });
    expect(result).toEqual({ blocked: false });
  });

  it('returns blocked: false when the slug does not match', () => {
    const result = checkSlugBlocklist('legitimate-it-work', {
      blocklistedSlugs: ['synthetic-blocked-slug-001', 'another-blocked'],
    });
    expect(result).toEqual({ blocked: false });
  });

  it('returns blocked: true with matchedHash when the slug matches exactly', () => {
    const target = 'synthetic-blocked-slug-001';
    const result = checkSlugBlocklist(target, {
      blocklistedSlugs: [target],
    });
    expect(result.blocked).toBe(true);
    expect(result.matchedHash).toBe(sha256Hex(target));
  });

  it('matches case-sensitively (different case is not a match)', () => {
    const result = checkSlugBlocklist('Synthetic-Blocked-Slug', {
      blocklistedSlugs: ['synthetic-blocked-slug'],
    });
    expect(result.blocked).toBe(false);
  });

  it('does not partially match a substring', () => {
    const result = checkSlugBlocklist('synthetic-blocked-slug-extra-suffix', {
      blocklistedSlugs: ['synthetic-blocked-slug'],
    });
    expect(result.blocked).toBe(false);
  });

  it('returns blocked: false for an empty input slug even if blocklist has empty entries', () => {
    const result = checkSlugBlocklist('', {
      blocklistedSlugs: ['', 'some-slug'],
    });
    expect(result.blocked).toBe(false);
  });

  it('skips empty-string entries in the blocklist', () => {
    const result = checkSlugBlocklist('real-slug', {
      blocklistedSlugs: ['', '', 'real-slug'],
    });
    expect(result.blocked).toBe(true);
    expect(result.matchedHash).toBe(sha256Hex('real-slug'));
  });

  it('finds the first matching slug in a multi-entry list', () => {
    const result = checkSlugBlocklist('mid-match', {
      blocklistedSlugs: ['first', 'mid-match', 'last'],
    });
    expect(result.blocked).toBe(true);
    expect(result.matchedHash).toBe(sha256Hex('mid-match'));
  });

  it('matched slug never appears verbatim in the result object', () => {
    const target = 'extremely-sensitive-slug-do-not-leak';
    const result = checkSlugBlocklist(target, {
      blocklistedSlugs: [target],
    });
    // matchedHash is the SHA-256 hex; the original slug must not appear.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(target);
    expect(serialized).toContain(sha256Hex(target));
  });
});
