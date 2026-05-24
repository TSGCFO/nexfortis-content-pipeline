import { describe, expect, it, vi } from 'vitest';

import { classifyPillar } from '../../../artifacts/synthesis-worker/src/jobs/synthesize-weekly/classify-pillar.js';
import type { AnthropicLike } from '../../../artifacts/synthesis-worker/src/jobs/synthesize-weekly/types.js';

function makeClient(
  responses: Array<string | Error>,
): AnthropicLike & { calls: number } {
  let idx = 0;
  const obj = {
    calls: 0,
    messages: {
      create: vi.fn(async (_args) => {
        obj.calls += 1;
        const r = responses[idx++];
        if (r === undefined) {
          throw new Error(`no more canned responses (call ${obj.calls})`);
        }
        if (r instanceof Error) {
          throw r;
        }
        return { content: [{ type: 'text', text: r }] };
      }),
    },
  };
  return obj as unknown as AnthropicLike & { calls: number };
}

const NEVER_SLEEP = (): Promise<void> => Promise.resolve();

describe('classifyPillar', () => {
  it('returns the pillar when Anthropic returns a valid value', async () => {
    const client = makeClient(['quickbooks']);
    const r = await classifyPillar('QB Online migration', ['quickbooks', 'migration'], client, {
      sleepFn: NEVER_SLEEP,
    });
    expect(r).toEqual({ pillar: 'quickbooks', rawResponse: 'quickbooks' });
    expect(client.calls).toBe(1);
  });

  it('returns null pillar with rawResponse=OFF_PILLAR when Anthropic returns OFF_PILLAR', async () => {
    const client = makeClient(['OFF_PILLAR']);
    const r = await classifyPillar('productivity tooling', ['notion'], client, {
      sleepFn: NEVER_SLEEP,
    });
    expect(r).toEqual({ pillar: null, rawResponse: 'OFF_PILLAR' });
    expect(client.calls).toBe(1);
  });

  it('trims surrounding whitespace from the response', async () => {
    const client = makeClient(['  managed-it  ']);
    const r = await classifyPillar('Intune device compliance', ['intune'], client, {
      sleepFn: NEVER_SLEEP,
    });
    expect(r).toEqual({ pillar: 'managed-it', rawResponse: 'managed-it' });
  });

  it('retries once when the response is an invalid string; returns null after two failures', async () => {
    const client = makeClient(['productivity', 'productivity']);
    const r = await classifyPillar('mixed topic', ['notion', 'todo'], client, {
      sleepFn: NEVER_SLEEP,
    });
    expect(r).toEqual({ pillar: null, rawResponse: 'productivity' });
    expect(client.calls).toBe(2);
  });

  it('retries once when the SDK throws; returns null rawResponse=ERROR after two throws', async () => {
    const client = makeClient([new Error('429'), new Error('503')]);
    const r = await classifyPillar('something', ['foo'], client, {
      sleepFn: NEVER_SLEEP,
    });
    expect(r).toEqual({ pillar: null, rawResponse: 'ERROR' });
    expect(client.calls).toBe(2);
  });

  it('waits the configured backoff between attempts', async () => {
    const sleepFn = vi.fn(async () => Promise.resolve());
    const client = makeClient([new Error('boom'), 'cybersecurity']);
    const r = await classifyPillar('breach', ['siem'], client, { sleepFn });
    expect(r).toEqual({ pillar: 'cybersecurity', rawResponse: 'cybersecurity' });
    expect(sleepFn).toHaveBeenCalledTimes(1);
    expect(sleepFn.mock.calls[0]?.[0]).toBe(5000);
  });
});
