import { describe, expect, it } from 'vitest';
import { regexPass } from '@ncp/redaction';

describe('regexPass — emails', () => {
  it('replaces a single email with [REDACTED_EMAIL]', () => {
    const input = 'Reach me at lawyer@example.com tomorrow.';
    const { redacted, log } = regexPass(input);
    expect(redacted).toBe('Reach me at [REDACTED_EMAIL] tomorrow.');
    expect(log).toHaveLength(1);
    expect(log[0]).toEqual({
      type: 'email',
      offset: input.indexOf('lawyer'),
      replacement: '[REDACTED_EMAIL]',
    });
  });

  it('replaces two emails in different formats', () => {
    const input = 'From a.b+tag@sub.example.co.uk to FOO.BAR@example.com.';
    const { redacted, log } = regexPass(input);
    expect(redacted).toBe('From [REDACTED_EMAIL] to [REDACTED_EMAIL].');
    expect(log).toHaveLength(2);
    expect(log[0]?.type).toBe('email');
    expect(log[1]?.type).toBe('email');
  });
});

describe('regexPass — phone numbers', () => {
  it('replaces NANP numbers in all four common formats', () => {
    const samples = [
      '(415) 555-2671',
      '415-555-2671',
      '415.555.2671',
      '4155552671',
    ];
    for (const s of samples) {
      const { redacted, log } = regexPass(`Call ${s} please.`);
      expect(redacted).toBe('Call [REDACTED_PHONE] please.');
      expect(log).toHaveLength(1);
      expect(log[0]?.type).toBe('phone');
    }
  });

  it('replaces an E.164 phone number', () => {
    const { redacted, log } = regexPass('Dial +14155552671 now.');
    expect(redacted).toBe('Dial [REDACTED_PHONE] now.');
    expect(log).toHaveLength(1);
    expect(log[0]?.type).toBe('phone');
  });

  it('does not over-match a version string', () => {
    const { redacted, log } = regexPass('Version 1.2.3 released.');
    expect(redacted).toBe('Version 1.2.3 released.');
    expect(log).toHaveLength(0);
  });
});

describe('regexPass — credit cards', () => {
  it('replaces a Luhn-valid 16-digit credit card', () => {
    const card = '4539 1488 0343 6467';
    const { redacted, log } = regexPass(`Card: ${card}.`);
    expect(redacted).toBe('Card: [REDACTED_CC].');
    expect(log).toHaveLength(1);
    expect(log[0]?.type).toBe('cc');
  });

  it('does NOT replace a Luhn-invalid 16-digit number', () => {
    const fake = '1234 5678 9012 3456';
    const { redacted, log } = regexPass(`Number: ${fake}.`);
    expect(redacted).toBe(`Number: ${fake}.`);
    expect(log).toHaveLength(0);
  });
});

describe('regexPass — SIN', () => {
  it('replaces a Luhn-valid Canadian SIN in XXX-XXX-XXX format', () => {
    const sin = '046-454-286';
    const { redacted, log } = regexPass(`SIN: ${sin}.`);
    expect(redacted).toBe('SIN: [REDACTED_SIN].');
    expect(log).toHaveLength(1);
    expect(log[0]?.type).toBe('sin');
  });

  it('does NOT replace an ISBN-like 9-digit dashed string with bad grouping', () => {
    const fake = '1-23456-789';
    const { redacted, log } = regexPass(`ISBN ${fake}.`);
    expect(redacted).toBe(`ISBN ${fake}.`);
    expect(log).toHaveLength(0);
  });

  it('does NOT replace a Luhn-invalid 3-3-3 grouping', () => {
    const fake = '123-456-789';
    const { redacted, log } = regexPass(`Number ${fake}.`);
    expect(redacted).toBe(`Number ${fake}.`);
    expect(log).toHaveLength(0);
  });
});

describe('regexPass — IP addresses', () => {
  it('replaces a valid IPv4 address', () => {
    const { redacted, log } = regexPass('Server at 192.168.0.1 is up.');
    expect(redacted).toBe('Server at [REDACTED_IP] is up.');
    expect(log).toHaveLength(1);
    expect(log[0]?.type).toBe('ip');
  });

  it('does NOT replace 1.2.3 (three octets)', () => {
    const { redacted, log } = regexPass('Patch level 1.2.3 shipped.');
    expect(redacted).toBe('Patch level 1.2.3 shipped.');
    expect(log).toHaveLength(0);
  });

  it('does NOT replace an out-of-range IPv4', () => {
    const { redacted, log } = regexPass('Bad addr 999.999.999.999 here.');
    expect(redacted).toBe('Bad addr 999.999.999.999 here.');
    expect(log).toHaveLength(0);
  });
});

describe('regexPass — multiple patterns + offsets', () => {
  it('emits a log entry per replacement keyed to the original offset', () => {
    const input = 'Email me@x.com or call 415-555-2671 from 10.0.0.1.';
    const { redacted, log } = regexPass(input);
    expect(redacted).toBe(
      'Email [REDACTED_EMAIL] or call [REDACTED_PHONE] from [REDACTED_IP].',
    );
    expect(log).toHaveLength(3);
    expect(log[0]?.type).toBe('email');
    expect(log[0]?.offset).toBe(input.indexOf('me@x.com'));
    expect(log[1]?.type).toBe('phone');
    expect(log[1]?.offset).toBe(input.indexOf('415-555-2671'));
    expect(log[2]?.type).toBe('ip');
    expect(log[2]?.offset).toBe(input.indexOf('10.0.0.1'));
  });
});
