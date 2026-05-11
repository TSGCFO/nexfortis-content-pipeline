import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mock the haiku-scrub module directly. Why not `vi.mock('@anthropic-ai/sdk',
 * ...)` (as the prompt suggests)? Under pnpm's hoisted-symlink layout,
 * `@anthropic-ai/sdk` is a transitive dep installed only inside
 * `lib/redaction/node_modules`. Vitest 2.x's `vi.mock` factory applies to
 * imports performed by the test file, but does NOT intercept imports of the
 * same package made from a workspace package whose own `node_modules` resolves
 * the SDK independently. Mocking the local `haiku-scrub` module hits the same
 * "never call the real Anthropic API in tests" goal and is the standard
 * orchestration-test pattern. See PR description for the
 * // TODO(hassan): note.
 */

const { mockHaikuScrub, mockAnthropicCreate } = vi.hoisted(() => ({
  mockHaikuScrub: vi.fn(),
  mockAnthropicCreate: vi.fn(),
}));

vi.mock('../../lib/redaction/src/haiku-scrub.js', () => ({
  haikuScrub: mockHaikuScrub,
}));

// Belt-and-suspenders: also mock the SDK in case any future code path imports
// it directly from the test file's import graph.
vi.mock('@anthropic-ai/sdk', () => {
  const Anthropic = vi.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate },
  }));
  return { default: Anthropic, Anthropic };
});

vi.mock('@ncp/logger', () => ({
  createLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  }),
}));

import { redact } from '../../lib/redaction/src/redact.js';

const ANTHROPIC_API_KEY = 'test-key-not-real';

describe('redact()', () => {
  beforeEach(() => {
    mockHaikuScrub.mockReset();
    mockAnthropicCreate.mockReset();
  });

  it('short-circuits with status: blocked when the subject hits the family-law regex (no Haiku call)', async () => {
    const result = await redact({
      source: 'msgraph_email',
      senderEmail: 'colleague@example.com',
      subject: 'Update on the custody hearing schedule',
      body: 'Some body text with my email me@example.com.',
      anthropicApiKey: ANTHROPIC_API_KEY,
    });
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.reason).toBe('subject_keyword');
      expect(result.redactedText).toBe('');
      expect(result.log).toEqual([]);
    }
    expect(mockHaikuScrub).not.toHaveBeenCalled();
  });

  it('short-circuits with reason: body_keyword when only the body contains a keyword', async () => {
    const result = await redact({
      source: 'claude_export',
      body: 'I had a brief conversation in family court yesterday about scheduling.',
      anthropicApiKey: ANTHROPIC_API_KEY,
    });
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.reason).toBe('body_keyword');
    }
    expect(mockHaikuScrub).not.toHaveBeenCalled();
  });

  it('runs only the regex pass when skipHaiku is true and returns status: redacted', async () => {
    const body = 'Email me at alice@example.com or call +14165551234.';
    const result = await redact({
      source: 'claude_export',
      body,
      anthropicApiKey: ANTHROPIC_API_KEY,
      skipHaiku: true,
    });
    expect(result.status).toBe('redacted');
    if (result.status === 'redacted') {
      expect(result.redactedText).not.toContain('alice@example.com');
      expect(result.redactedText).not.toContain('+14165551234');
      expect(result.redactedText).toContain('[REDACTED_EMAIL]');
      expect(result.redactedText).toContain('[REDACTED_PHONE]');
      expect(result.log.some((e) => e.type === 'email')).toBe(true);
      expect(result.log.some((e) => e.type === 'phone')).toBe(true);
    }
    expect(mockHaikuScrub).not.toHaveBeenCalled();
  });

  it('returns status: blocked with reason: redaction_failed when Haiku throws', async () => {
    mockHaikuScrub.mockRejectedValueOnce(new Error('upstream 503'));
    const result = await redact({
      source: 'claude_export',
      body: 'Email me at alice@example.com.',
      anthropicApiKey: ANTHROPIC_API_KEY,
    });
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.reason).toBe('redaction_failed');
      expect(result.redactedText).toBe('');
      // Pass-1 log should still be present so callers can audit which
      // patterns were caught up to the failure point.
      expect(result.log.some((e) => e.type === 'email')).toBe(true);
    }
    expect(mockHaikuScrub).toHaveBeenCalledTimes(1);
  });

  it('returns status: blocked with reason: redaction_failed when Haiku returns malformed JSON (validation error propagated as throw)', async () => {
    mockHaikuScrub.mockRejectedValueOnce(new Error('haiku_scrub: failed to parse JSON response'));
    const result = await redact({
      source: 'claude_export',
      body: 'Routine note.',
      anthropicApiKey: ANTHROPIC_API_KEY,
    });
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.reason).toBe('redaction_failed');
    }
  });

  it('happy path: combines regex + Haiku entities and remaps Haiku offsets to the ORIGINAL body', async () => {
    const originalBody =
      'Hi, I am Acme Industries CFO Jane Doe — email me at jane.doe@acme.test.';
    // After regex pass, the email "jane.doe@acme.test" is replaced by
    // "[REDACTED_EMAIL]". The Haiku mock is keyed to that POST-regex-pass
    // intermediate.
    const post1 =
      'Hi, I am Acme Industries CFO Jane Doe — email me at [REDACTED_EMAIL].';
    const haikuRedacted = post1
      .replace('Acme Industries', '[REDACTED_COMPANY]')
      .replace('Jane Doe', '[REDACTED_PERSON]');
    mockHaikuScrub.mockResolvedValueOnce({
      redacted: haikuRedacted,
      log: [
        {
          type: 'company',
          offset: post1.indexOf('Acme Industries'),
          replacement: '[REDACTED_COMPANY]',
        },
        {
          type: 'person',
          offset: post1.indexOf('Jane Doe'),
          replacement: '[REDACTED_PERSON]',
        },
      ],
    });

    const result = await redact({
      source: 'claude_export',
      body: originalBody,
      anthropicApiKey: ANTHROPIC_API_KEY,
    });

    expect(result.status).toBe('redacted');
    if (result.status === 'redacted') {
      expect(result.redactedText).toBe(haikuRedacted);
      const types = result.log.map((e) => e.type).sort();
      expect(types).toEqual(['company', 'email', 'person']);
      const companyEntry = result.log.find((e) => e.type === 'company');
      const personEntry = result.log.find((e) => e.type === 'person');
      const emailEntry = result.log.find((e) => e.type === 'email');
      expect(companyEntry?.offset).toBe(originalBody.indexOf('Acme Industries'));
      expect(personEntry?.offset).toBe(originalBody.indexOf('Jane Doe'));
      expect(emailEntry?.offset).toBe(originalBody.indexOf('jane.doe@acme.test'));
      const offsets = result.log.map((e) => e.offset);
      const sorted = offsets.slice().sort((a, b) => a - b);
      expect(offsets).toEqual(sorted);
    }
    expect(mockHaikuScrub).toHaveBeenCalledTimes(1);
    const call = mockHaikuScrub.mock.calls[0];
    expect(call?.[0]).toBe(post1);
    expect(call?.[1]).toEqual({ anthropicApiKey: ANTHROPIC_API_KEY });
  });

  it('passes the post-regex-pass text (not the original body) into haikuScrub so the LLM never sees raw PII', async () => {
    mockHaikuScrub.mockResolvedValueOnce({ redacted: 'safe', log: [] });
    const body = 'My email is alice@example.com.';
    await redact({
      source: 'claude_export',
      body,
      anthropicApiKey: ANTHROPIC_API_KEY,
    });
    const call = mockHaikuScrub.mock.calls[0];
    expect(call?.[0]).not.toContain('alice@example.com');
    expect(call?.[0]).toContain('[REDACTED_EMAIL]');
  });
});
