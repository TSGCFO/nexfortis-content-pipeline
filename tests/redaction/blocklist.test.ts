import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  assertNotBlocked,
  BLOCKLIST_BODY_KEYWORDS,
  BLOCKLIST_EMAIL_HASHES,
  BLOCKLIST_SUBJECT_REGEX,
  BlocklistViolationError,
  checkBlocklist,
} from '../../lib/redaction/src/blocklist.js';

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

const TEST_LEGAL_EMAIL = 'test-legal@example.com';
const TEST_MEDIATOR_EMAIL = 'test-mediator@example.com';

const TEST_HASHES: readonly string[] = Object.freeze([
  sha256Hex(TEST_LEGAL_EMAIL),
  sha256Hex(TEST_MEDIATOR_EMAIL),
]);

describe('checkBlocklist', () => {
  it('blocks when senderEmail hash matches the blocklist', () => {
    const result = checkBlocklist(
      {
        source: 'msgraph_email',
        senderEmail: TEST_LEGAL_EMAIL,
        body: 'Hello, this is a routine message.',
      },
      { blocklistHashes: TEST_HASHES },
    );
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toBe('email_address');
      expect(result.matchedHash).toBe(sha256Hex(TEST_LEGAL_EMAIL));
    }
  });

  it('blocks when a recipientEmails entry hash matches the blocklist', () => {
    const result = checkBlocklist(
      {
        source: 'msgraph_email',
        senderEmail: 'noreply@harmless.com',
        recipientEmails: ['hassan@nexfortis.com', TEST_MEDIATOR_EMAIL],
        body: 'Hello.',
      },
      { blocklistHashes: TEST_HASHES },
    );
    expect(result.blocked).toBe(true);
    if (result.blocked) expect(result.reason).toBe('email_address');
  });

  it('does not block when no email matches', () => {
    const result = checkBlocklist(
      {
        source: 'msgraph_email',
        senderEmail: 'not-on-list@example.com',
        body: 'Hello, this is a routine accounting message.',
      },
      { blocklistHashes: TEST_HASHES },
    );
    expect(result.blocked).toBe(false);
  });

  it('blocks case-insensitively (Lawyer@Example.com matches the lower-cased hash)', () => {
    const mixedCase = 'Test-Legal@Example.COM ';
    const result = checkBlocklist(
      {
        source: 'msgraph_email',
        senderEmail: mixedCase,
        body: 'Hello.',
      },
      { blocklistHashes: TEST_HASHES },
    );
    expect(result.blocked).toBe(true);
    if (result.blocked) expect(result.reason).toBe('email_address');
  });

  it('blocks when subject matches the family-law regex (custody arrangement)', () => {
    const result = checkBlocklist(
      {
        source: 'msgraph_email',
        senderEmail: 'somebody@example.com',
        subject: 'Update on the custody arrangement',
        body: 'Routine status text without obvious keywords.',
      },
      { blocklistHashes: TEST_HASHES },
    );
    expect(result.blocked).toBe(true);
    if (result.blocked) expect(result.reason).toBe('subject_keyword');
  });

  it('blocks when body contains a high-confidence family-law keyword', () => {
    const result = checkBlocklist(
      {
        source: 'msgraph_email',
        senderEmail: 'colleague@example.com',
        subject: 'Quick update',
        body: 'I had to step out for a meeting at family court this morning.',
      },
      { blocklistHashes: TEST_HASHES },
    );
    expect(result.blocked).toBe(true);
    if (result.blocked) expect(result.reason).toBe('body_keyword');
  });

  it('returns blocked: false on completely clean input', () => {
    const result = checkBlocklist(
      {
        source: 'claude_export',
        body: 'NexFortis helps small businesses streamline accounting workflows.',
      },
      { blocklistHashes: TEST_HASHES },
    );
    expect(result.blocked).toBe(false);
  });

  it('placeholder production hashes never match a real SHA-256-hashed email', () => {
    // Documents the fail-closed-by-default property: until Hassan replaces the
    // placeholder strings, no real email can match (the constant-time compare
    // returns false on length mismatch).
    const result = checkBlocklist(
      {
        source: 'msgraph_email',
        senderEmail: TEST_LEGAL_EMAIL,
        body: 'Hello.',
      },
      // Use the production const explicitly — no override.
      { blocklistHashes: BLOCKLIST_EMAIL_HASHES },
    );
    expect(result.blocked).toBe(false);
  });
});

describe('BLOCKLIST_SUBJECT_REGEX', () => {
  it('matches every expected family-law keyword case-insensitively', () => {
    const cases = [
      'CUSTODY hearing',
      'Mediator follow-up',
      'Settlement draft',
      'Family Court update',
      'Divorce proceedings',
      'Separation agreement v3',
    ];
    for (const subject of cases) {
      expect(BLOCKLIST_SUBJECT_REGEX.test(subject)).toBe(true);
    }
  });

  it('does not match unrelated subjects', () => {
    expect(BLOCKLIST_SUBJECT_REGEX.test('Quarterly bookkeeping reminder')).toBe(false);
  });
});

describe('BLOCKLIST_BODY_KEYWORDS', () => {
  it('is a non-empty conservative list', () => {
    expect(BLOCKLIST_BODY_KEYWORDS.length).toBeGreaterThan(0);
    expect(BLOCKLIST_BODY_KEYWORDS.length).toBeLessThanOrEqual(10);
  });
});

describe('BlocklistViolationError', () => {
  it('carries a code and the originating reason', () => {
    const err = new BlocklistViolationError('email_address');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('BLOCKLIST_VIOLATION');
    expect(err.reason).toBe('email_address');
    expect(err.name).toBe('BlocklistViolationError');
  });
});

describe('assertNotBlocked', () => {
  it('returns silently when input is not blocked', () => {
    expect(() =>
      assertNotBlocked(
        { source: 'test', body: 'A clean message about NexFortis services.' },
        { blocklistHashes: TEST_HASHES },
      ),
    ).not.toThrow();
  });

  it('throws BlocklistViolationError with the reason when blocked by email', () => {
    let caught: unknown;
    try {
      assertNotBlocked(
        {
          source: 'test',
          senderEmail: TEST_LEGAL_EMAIL,
          body: 'Unrelated body.',
        },
        { blocklistHashes: TEST_HASHES },
      );
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BlocklistViolationError);
    expect((caught as BlocklistViolationError).reason).toBe('email_address');
    expect((caught as BlocklistViolationError).code).toBe('BLOCKLIST_VIOLATION');
  });

  it('throws BlocklistViolationError when blocked by subject keyword', () => {
    expect(() =>
      assertNotBlocked(
        { source: 'test', subject: 'Custody update', body: 'Unrelated body.' },
        { blocklistHashes: TEST_HASHES },
      ),
    ).toThrow(BlocklistViolationError);
  });
});
