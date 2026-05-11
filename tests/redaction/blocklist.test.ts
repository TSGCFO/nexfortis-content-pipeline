import { describe, expect, it } from 'vitest';
import {
  BLOCKLIST_EMAIL_HASHES,
  BLOCKLIST_SUBJECT_REGEX,
  BlocklistViolationError,
  assertNotBlocked,
  checkBlocklist,
  hashEmailForBlocklist,
} from '@ncp/redaction';

const TEST_LEGAL_EMAIL = 'test-legal@example.com';
const TEST_LEGAL_EMAIL_HASH = hashEmailForBlocklist(TEST_LEGAL_EMAIL);
const TEST_BLOCKLIST: readonly string[] = [TEST_LEGAL_EMAIL_HASH];

describe('checkBlocklist — email hashes', () => {
  it('returns blocked when sender email matches an injected blocklist hash', () => {
    const result = checkBlocklist(
      {
        source: 'msgraph_email',
        senderEmail: TEST_LEGAL_EMAIL,
        body: 'Hi there.',
      },
      { blocklistHashes: TEST_BLOCKLIST },
    );
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toBe('email_address');
      expect(result.matchedHash).toBe(TEST_LEGAL_EMAIL_HASH);
    }
  });

  it('returns not blocked when sender email does not match', () => {
    const result = checkBlocklist(
      {
        source: 'msgraph_email',
        senderEmail: 'random.person@example.com',
        body: 'Hi there.',
      },
      { blocklistHashes: TEST_BLOCKLIST },
    );
    expect(result.blocked).toBe(false);
  });

  it('matches the injected hash case-insensitively (Lawyer@Example.com vs lowercase hash)', () => {
    const result = checkBlocklist(
      {
        source: 'msgraph_email',
        senderEmail: 'TEST-LEGAL@Example.COM',
        body: 'Hi.',
      },
      { blocklistHashes: TEST_BLOCKLIST },
    );
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toBe('email_address');
    }
  });

  it('checks recipient emails as well as the sender', () => {
    const result = checkBlocklist(
      {
        source: 'msgraph_email',
        senderEmail: 'hassan@nexfortis.com',
        recipientEmails: ['ok@example.com', TEST_LEGAL_EMAIL],
        body: 'Reply.',
      },
      { blocklistHashes: TEST_BLOCKLIST },
    );
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toBe('email_address');
    }
  });

  it('placeholder production blocklist hashes never match a real SHA-256', () => {
    expect(BLOCKLIST_EMAIL_HASHES.length).toBeGreaterThan(0);
    const result = checkBlocklist({
      source: 'msgraph_email',
      senderEmail: 'someone@example.com',
      body: 'Clean message.',
    });
    expect(result.blocked).toBe(false);
  });
});

describe('checkBlocklist — subject regex', () => {
  it('blocks when subject contains "custody arrangement"', () => {
    const result = checkBlocklist({
      source: 'msgraph_email',
      subject: 'Re: custody arrangement discussion',
      body: 'Some body text.',
    });
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toBe('subject_keyword');
    }
  });

  it('blocks across each subject-regex keyword', () => {
    const keywords = [
      'custody',
      'mediator',
      'settlement',
      'family court',
      'divorce',
      'separation agreement',
    ];
    for (const kw of keywords) {
      const result = checkBlocklist({
        source: 'msgraph_email',
        subject: `Re: ${kw} matter`,
        body: 'body',
      });
      expect(result.blocked, `expected block for keyword "${kw}"`).toBe(true);
      if (result.blocked) {
        expect(result.reason).toBe('subject_keyword');
      }
    }
  });

  it('matches the exact regex from architecture-and-data-model.md §11', () => {
    expect(BLOCKLIST_SUBJECT_REGEX.flags).toContain('i');
    expect(BLOCKLIST_SUBJECT_REGEX.test('Custody Hearing Update')).toBe(true);
    expect(BLOCKLIST_SUBJECT_REGEX.test('Q3 revenue forecast')).toBe(false);
  });
});

describe('checkBlocklist — body keywords', () => {
  it('blocks when body mentions "family court"', () => {
    const result = checkBlocklist({
      source: 'msgraph_email',
      subject: 'General update',
      body: 'We discussed it in family court last week.',
    });
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toBe('body_keyword');
    }
  });

  it('is case-insensitive on body keywords', () => {
    const result = checkBlocklist({
      source: 'msgraph_email',
      body: 'Read the COURT ORDER carefully.',
    });
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.reason).toBe('body_keyword');
    }
  });
});

describe('checkBlocklist — clean input', () => {
  it('returns blocked: false for fully clean input', () => {
    const result = checkBlocklist({
      source: 'claude_chat',
      senderEmail: 'hassan@nexfortis.com',
      recipientEmails: ['team@nexfortis.com'],
      subject: 'QuickBooks Online migration checklist',
      body: 'Here are the steps to migrate a desktop file to QBO.',
    });
    expect(result.blocked).toBe(false);
  });
});

describe('assertNotBlocked', () => {
  it('throws BlocklistViolationError when input is blocked', () => {
    expect(() =>
      assertNotBlocked({
        source: 'msgraph_email',
        subject: 'divorce paperwork',
        body: 'body',
      }),
    ).toThrow(BlocklistViolationError);
  });

  it('does not throw when input is clean', () => {
    expect(() =>
      assertNotBlocked({
        source: 'claude_chat',
        body: 'Routine QuickBooks tip.',
      }),
    ).not.toThrow();
  });
});
