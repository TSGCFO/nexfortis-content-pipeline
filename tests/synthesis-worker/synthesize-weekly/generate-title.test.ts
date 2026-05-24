import { describe, expect, it, vi } from 'vitest';

import { generateTitle } from '../../../artifacts/synthesis-worker/src/jobs/synthesize-weekly/generate-title.js';
import type {
  AnthropicLike,
  ClassifiedCluster,
} from '../../../artifacts/synthesis-worker/src/jobs/synthesize-weekly/types.js';

function makeClient(response: string | Error): AnthropicLike {
  return {
    messages: {
      create: vi.fn(async () => {
        if (response instanceof Error) throw response;
        return { content: [{ type: 'text', text: response }] };
      }),
    },
  };
}

function makeCluster(): ClassifiedCluster {
  return {
    signalIds: ['a', 'b', 'c'],
    members: [],
    label: 'Conditional Access for iOS',
    topicKeywords: ['intune', 'aad', 'ios'],
    pillar: 'managed-it',
  };
}

describe('generateTitle', () => {
  it('returns the generated title when Sonnet succeeds and the title is under 80 chars', async () => {
    const client = makeClient('Configuring Conditional Access for iOS Authenticator');
    const title = await generateTitle(makeCluster(), client);
    expect(title).toBe('Configuring Conditional Access for iOS Authenticator');
    expect(title.length).toBeLessThanOrEqual(80);
  });

  it('falls back to the cluster label when Sonnet returns whitespace', async () => {
    const client = makeClient('   \n\t  ');
    const title = await generateTitle(makeCluster(), client);
    expect(title).toBe('Conditional Access for iOS');
  });

  it('falls back to the cluster label when Sonnet throws', async () => {
    const client = makeClient(new Error('overloaded'));
    const title = await generateTitle(makeCluster(), client);
    expect(title).toBe('Conditional Access for iOS');
  });

  it('truncates a 200-character title to 80 chars', async () => {
    const longTitle = 'x'.repeat(200);
    const client = makeClient(longTitle);
    const title = await generateTitle(makeCluster(), client);
    expect(title.length).toBe(80);
  });

  it('strips wrapping quotes the model occasionally adds', async () => {
    const client = makeClient('"My title"');
    const title = await generateTitle(makeCluster(), client);
    expect(title).toBe('My title');
  });
});
