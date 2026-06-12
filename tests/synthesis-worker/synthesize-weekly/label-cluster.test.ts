import { describe, expect, it, vi } from 'vitest';

import {
  INCOHERENT_SENTINEL,
  labelCluster,
  TEXT_CONCAT_CAP,
} from '../../../artifacts/synthesis-worker/src/jobs/synthesize-weekly/label-cluster.js';
import type {
  AnthropicLike,
  Cluster,
  SignalRow,
} from '../../../artifacts/synthesis-worker/src/jobs/synthesize-weekly/types.js';

function makeClient(
  responses: Array<string | Error>,
): { client: AnthropicLike; createSpy: ReturnType<typeof vi.fn> } {
  let idx = 0;
  const createSpy = vi.fn(async (_args) => {
    const r = responses[idx++];
    if (r === undefined) throw new Error('no more responses');
    if (r instanceof Error) throw r;
    // Structured outputs (output_config.format) return a complete JSON
    // object in the text block — no prefill reconstruction involved.
    return { content: [{ type: 'text', text: r }] };
  });
  return {
    client: { messages: { create: createSpy } } as AnthropicLike,
    createSpy,
  };
}

function makeSignal(id: string, text: string): SignalRow {
  return {
    id,
    redactedText: text,
    capturedAt: new Date('2026-05-20T12:00:00Z'),
    embedding: Float32Array.from([1, 0, 0, 0]),
  };
}

function makeCluster(texts: string[]): Cluster {
  const members = texts.map((t, i) => makeSignal(`s${i}`, t));
  return { signalIds: members.map((m) => m.id), members };
}

describe('labelCluster', () => {
  it('parses valid JSON and returns label + topicKeywords', async () => {
    const { client } = makeClient([
      '{"label":"Conditional Access for iOS","topicKeywords":["intune","aad","ios"]}',
    ]);
    const cluster = makeCluster(['error AADSTS50158', 'CA policy + iOS', 'Authenticator app']);
    const result = await labelCluster(cluster, client);
    expect(result).toEqual({
      label: 'Conditional Access for iOS',
      topicKeywords: ['intune', 'aad', 'ios'],
    });
  });

  it('returns the ERROR:INCOHERENT sentinel as-is when Sonnet refuses to label', async () => {
    const { client } = makeClient([
      `{"label":"${INCOHERENT_SENTINEL}","topicKeywords":[]}`,
    ]);
    const cluster = makeCluster(['unrelated 1', 'unrelated 2', 'unrelated 3']);
    const result = await labelCluster(cluster, client);
    expect(result.label).toBe(INCOHERENT_SENTINEL);
    expect(result.topicKeywords).toEqual([]);
  });

  it('throws when Sonnet returns malformed JSON', async () => {
    const { client } = makeClient(['not json at all']);
    const cluster = makeCluster(['a', 'b', 'c']);
    await expect(labelCluster(cluster, client)).rejects.toThrow(/label-cluster/);
  });

  it('caps concatenated input at TEXT_CONCAT_CAP characters', async () => {
    const { client, createSpy } = makeClient([
      '{"label":"Big topic","topicKeywords":["k1","k2","k3"]}',
    ]);
    // Three large blocks; total without cap = 12,001 chars. The labeler
    // joins on '\n---\n' between blocks, so total input is even larger
    // before the slice — it must still be capped to TEXT_CONCAT_CAP in
    // the user prompt content.
    const big = 'x'.repeat(4000);
    const cluster = makeCluster([big, big, big]);
    await labelCluster(cluster, client);

    expect(createSpy).toHaveBeenCalledTimes(1);
    const args = createSpy.mock.calls[0]![0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const userMessage = args.messages.find((m) => m.role === 'user');
    expect(userMessage).toBeDefined();
    // The user prompt embeds the concatenated text inline. The
    // concatenated body within the prompt must not exceed TEXT_CONCAT_CAP.
    // We look for the longest 'x'-run in the content and assert its
    // length is bounded.
    const longestXRun = (userMessage!.content.match(/x+/g) ?? [])
      .map((s) => s.length)
      .reduce((a, b) => Math.max(a, b), 0);
    expect(longestXRun).toBeLessThanOrEqual(TEXT_CONCAT_CAP);
  });

  it('truncates labels longer than 80 chars', async () => {
    const longLabel = 'a'.repeat(150);
    const { client } = makeClient([
      `{"label":"${longLabel}","topicKeywords":["k1","k2","k3"]}`,
    ]);
    const cluster = makeCluster(['t1', 't2', 't3']);
    const result = await labelCluster(cluster, client);
    expect(result.label.length).toBe(80);
  });
});
