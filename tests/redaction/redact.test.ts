import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { redact } from '@ncp/redaction';
// Internal test hook: `@anthropic-ai/sdk` lives only in
// `lib/redaction/node_modules/` (not hoisted), so `vi.mock('@anthropic-ai/sdk')`
// at the test-root level does not apply to transitive imports from
// `lib/redaction/src/haiku-scrub.ts`. Instead we inject a fake client via the
// internal factory hook exported (test-only) from haiku-scrub.ts. The
// relative import is intentional and is the escape hatch the prompt
// explicitly allows for this case.
import {
  __resetAnthropicFactory,
  __setAnthropicFactory,
  type AnthropicLike,
} from '../../lib/redaction/src/haiku-scrub.js';

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

const ANTHROPIC_KEY = 'test-anthropic-key';

const messageCreateMock = vi.fn();
const anthropicCtorMock = vi.fn();

const fakeFactory = (apiKey: string): AnthropicLike => {
  anthropicCtorMock({ apiKey });
  return {
    messages: { create: messageCreateMock as AnthropicLike['messages']['create'] },
  };
};

beforeEach(() => {
  messageCreateMock.mockReset();
  anthropicCtorMock.mockReset();
  __setAnthropicFactory(fakeFactory);
});

afterEach(() => {
  __resetAnthropicFactory();
});

describe('redact — blocklist short-circuit', () => {
  it('returns blocked for a family-law subject and does NOT call Haiku', async () => {
    const result = await redact({
      source: 'msgraph_email',
      subject: 'Re: custody arrangement update',
      body: 'Some text including lawyer@example.com',
      anthropicApiKey: ANTHROPIC_KEY,
    });
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.reason).toBe('subject_keyword');
      expect(result.redactedText).toBe('');
    }
    expect(messageCreateMock).not.toHaveBeenCalled();
    expect(anthropicCtorMock).not.toHaveBeenCalled();
  });

  it('returns blocked for a family-law body keyword and does NOT call Haiku', async () => {
    const result = await redact({
      source: 'msgraph_email',
      body: 'Please review the family court schedule next week.',
      anthropicApiKey: ANTHROPIC_KEY,
    });
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.reason).toBe('body_keyword');
    }
    expect(messageCreateMock).not.toHaveBeenCalled();
  });
});

describe('redact — skipHaiku regex-only flow', () => {
  it('runs only the regex pass when skipHaiku is true', async () => {
    const result = await redact({
      source: 'claude_chat',
      body: 'Email me at user@example.com or call 415-555-2671.',
      anthropicApiKey: ANTHROPIC_KEY,
      skipHaiku: true,
    });
    expect(result.status).toBe('redacted');
    if (result.status === 'redacted') {
      expect(result.redactedText).toBe(
        'Email me at [REDACTED_EMAIL] or call [REDACTED_PHONE].',
      );
      expect(result.log).toHaveLength(2);
      expect(result.log[0]?.type).toBe('email');
      expect(result.log[1]?.type).toBe('phone');
    }
    expect(messageCreateMock).not.toHaveBeenCalled();
  });
});

describe('redact — Haiku failure fail-closed', () => {
  it('returns blocked with reason "redaction_failed" when Haiku throws', async () => {
    messageCreateMock.mockRejectedValueOnce(new Error('Anthropic API timeout'));

    const result = await redact({
      source: 'claude_chat',
      body: 'Plain text with no PII.',
      anthropicApiKey: ANTHROPIC_KEY,
    });

    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.reason).toBe('redaction_failed');
      expect(result.redactedText).toBe('');
    }
    expect(messageCreateMock).toHaveBeenCalledTimes(1);
    expect(anthropicCtorMock).toHaveBeenCalledWith({ apiKey: ANTHROPIC_KEY });
  });

  it('returns blocked with reason "redaction_failed" when Haiku returns unparseable text', async () => {
    messageCreateMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'not json at all' }],
    });

    const result = await redact({
      source: 'claude_chat',
      body: 'Clean text.',
      anthropicApiKey: ANTHROPIC_KEY,
    });

    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.reason).toBe('redaction_failed');
    }
  });
});

describe('redact — happy path with mocked Haiku', () => {
  it('produces a combined log and uses Haiku output text', async () => {
    const inputBody =
      'Acme Corp signed with Jane Doe. Reach Jane at jane@example.com.';
    const regexRedacted =
      'Acme Corp signed with Jane Doe. Reach Jane at [REDACTED_EMAIL].';
    const finalRedacted =
      '[REDACTED_COMPANY] signed with [REDACTED_PERSON]. Reach [REDACTED_PERSON] at [REDACTED_EMAIL].';

    messageCreateMock.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            redacted: finalRedacted,
            entities: [
              {
                type: 'company',
                offset: regexRedacted.indexOf('Acme Corp'),
                length: 'Acme Corp'.length,
                replacement: '[REDACTED_COMPANY]',
              },
              {
                type: 'person',
                offset: regexRedacted.indexOf('Jane Doe'),
                length: 'Jane Doe'.length,
                replacement: '[REDACTED_PERSON]',
              },
              {
                type: 'person',
                offset: regexRedacted.indexOf('Reach Jane') + 'Reach '.length,
                length: 'Jane'.length,
                replacement: '[REDACTED_PERSON]',
              },
            ],
          }).slice(1),
        },
      ],
    });

    const result = await redact({
      source: 'claude_chat',
      body: inputBody,
      anthropicApiKey: ANTHROPIC_KEY,
    });

    expect(result.status).toBe('redacted');
    if (result.status === 'redacted') {
      expect(result.redactedText).toBe(finalRedacted);
      const types = result.log.map((e) => e.type);
      expect(types).toContain('email');
      expect(types).toContain('haiku_company');
      expect(types.filter((t) => t === 'haiku_person')).toHaveLength(2);

      const companyEntry = result.log.find((e) => e.type === 'haiku_company');
      expect(companyEntry?.offset).toBe(inputBody.indexOf('Acme Corp'));

      const firstPerson = result.log.find(
        (e) => e.type === 'haiku_person' && e.offset === inputBody.indexOf('Jane Doe'),
      );
      expect(firstPerson).toBeDefined();
    }
    expect(messageCreateMock).toHaveBeenCalledTimes(1);
    expect(anthropicCtorMock).toHaveBeenCalledWith({ apiKey: ANTHROPIC_KEY });
  });
});
