import { describe, expect, it } from 'vitest';

import { regexPass } from '../../lib/redaction/src/regex-pass.js';

describe('regexPass', () => {
  it('replaces multiple emails with [REDACTED_EMAIL]', () => {
    const text = 'Contact alice@example.com or bob.smith+work@sub.example.co.uk for details.';
    const { redacted, log } = regexPass(text);
    expect(redacted).not.toContain('alice@example.com');
    expect(redacted).not.toContain('bob.smith+work@sub.example.co.uk');
    expect(redacted).toContain('[REDACTED_EMAIL]');
    const emailEntries = log.filter((e) => e.type === 'email');
    expect(emailEntries).toHaveLength(2);
    expect(emailEntries[0]?.offset).toBe(text.indexOf('alice@example.com'));
    expect(emailEntries[1]?.offset).toBe(text.indexOf('bob.smith+work@sub.example.co.uk'));
  });

  it('replaces NANP and E.164 phone numbers in their various separators', () => {
    const formats = [
      '(555) 555-5555',
      '555-555-5555',
      '555.555.5555',
      '5555555555',
      '+15555555555',
    ];
    for (const fmt of formats) {
      const text = `Call me at ${fmt} please.`;
      const { redacted, log } = regexPass(text);
      expect(redacted).toContain('[REDACTED_PHONE]');
      expect(redacted).not.toContain(fmt);
      expect(log.some((e) => e.type === 'phone')).toBe(true);
    }
  });

  it('replaces Luhn-valid credit card but leaves Luhn-invalid 16-digit string alone', () => {
    const validCard = '4242 4242 4242 4242';
    const invalidCard = '1234 5678 9012 3456';
    const text = `Valid: ${validCard} Invalid: ${invalidCard}`;
    const { redacted, log } = regexPass(text);
    expect(redacted).toContain('[REDACTED_CC]');
    expect(redacted).not.toContain(validCard);
    expect(redacted).toContain(invalidCard);
    expect(log.filter((e) => e.type === 'cc')).toHaveLength(1);
  });

  it('replaces Canadian SIN format and ignores ISBN-like 9-digit-with-dashes when Luhn-invalid', () => {
    const validSin = '046-454-286';
    const isbn = '978-3-16-148';
    const text = `SIN ${validSin} ISBN ${isbn}`;
    const { redacted, log } = regexPass(text);
    expect(redacted).toContain('[REDACTED_SIN]');
    expect(redacted).not.toContain(validSin);
    expect(redacted).toContain(isbn);
    expect(log.filter((e) => e.type === 'sin')).toHaveLength(1);
  });

  it('replaces IPv4 address but leaves a "1.2.3" version-style string alone', () => {
    const text = 'server 192.168.1.42 running v1.2.3 of the agent.';
    const { redacted, log } = regexPass(text);
    expect(redacted).toContain('[REDACTED_IP]');
    expect(redacted).not.toContain('192.168.1.42');
    expect(redacted).toContain('v1.2.3');
    expect(log.some((e) => e.type === 'ipv4')).toBe(true);
  });

  it('does NOT replace an out-of-range IPv4 (octets > 255)', () => {
    // Cherry-picked guard from the alternative implementation (PR #6, closed):
    // strings like 999.999.999.999 share the dotted-quad shape but cannot be
    // valid IPv4 addresses. The bounded-octet regex must reject them outright.
    const text = 'fake address 999.888.777.666 in the logs';
    const { redacted, log } = regexPass(text);
    expect(redacted).toBe(text);
    expect(log.filter((e) => e.type === 'ipv4')).toHaveLength(0);
  });

  it('records each replacement with the offset of the match in the ORIGINAL text', () => {
    const text = 'Email alice@example.com and call +14165551234 right now.';
    const { log } = regexPass(text);
    const emailEntry = log.find((e) => e.type === 'email');
    const phoneEntry = log.find((e) => e.type === 'phone');
    expect(emailEntry?.offset).toBe(text.indexOf('alice@example.com'));
    expect(phoneEntry?.offset).toBe(text.indexOf('+14165551234'));
    expect(emailEntry?.replacement).toBe('[REDACTED_EMAIL]');
    expect(phoneEntry?.replacement).toBe('[REDACTED_PHONE]');
  });

  it('returns text unchanged and empty log when no PII is present', () => {
    const text = 'NexFortis helps small businesses streamline their accounting.';
    const result = regexPass(text);
    expect(result.redacted).toBe(text);
    expect(result.log).toEqual([]);
    expect(result.replacements).toEqual([]);
  });
});
