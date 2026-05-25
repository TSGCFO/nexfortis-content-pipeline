/**
 * Tests for `transcribeWithWhisper`. Mocks the OpenAILike client.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  transcribeWithWhisper,
  type OpenAILike,
  type OpenAITranscriptionParams,
} from '../../../artifacts/telegram-bot/src/lib/whisper-client.js';

function makeClient(
  createImpl: (
    params: OpenAITranscriptionParams,
  ) => Promise<unknown>,
): { client: OpenAILike; create: ReturnType<typeof vi.fn> } {
  const create = vi.fn(createImpl);
  const client: OpenAILike = {
    audio: { transcriptions: { create } },
  };
  return { client, create };
}

function makeStream(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.close();
    },
  });
}

describe('transcribeWithWhisper', () => {
  it('happy path: returns the transcript string', async () => {
    const { client } = makeClient(async () => 'a transcript');
    const result = await transcribeWithWhisper({
      client,
      audioStream: makeStream(),
    });
    expect(result).toEqual({ ok: true, transcript: 'a transcript' });
  });

  it('returns { ok: false } when the client throws (does NOT throw)', async () => {
    const { client } = makeClient(async () => {
      throw new Error('rate limited');
    });
    const result = await transcribeWithWhisper({
      client,
      audioStream: makeStream(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/rate limited/);
  });

  it('treats an empty transcript as success (not failure)', async () => {
    const { client } = makeClient(async () => '');
    const result = await transcribeWithWhisper({
      client,
      audioStream: makeStream(),
    });
    expect(result).toEqual({ ok: true, transcript: '' });
  });

  it('asserts the model is exactly "whisper-1"', async () => {
    const { client, create } = makeClient(async () => 'x');
    await transcribeWithWhisper({ client, audioStream: makeStream() });
    expect(create).toHaveBeenCalledTimes(1);
    const params = create.mock.calls[0]![0] as OpenAITranscriptionParams;
    expect(params.model).toBe('whisper-1');
  });

  it('asserts the language defaults to "en"', async () => {
    const { client, create } = makeClient(async () => 'x');
    await transcribeWithWhisper({ client, audioStream: makeStream() });
    const params = create.mock.calls[0]![0] as OpenAITranscriptionParams;
    expect(params.language).toBe('en');
  });

  it('asserts the response_format is "text"', async () => {
    const { client, create } = makeClient(async () => 'x');
    await transcribeWithWhisper({ client, audioStream: makeStream() });
    const params = create.mock.calls[0]![0] as OpenAITranscriptionParams;
    expect(params.response_format).toBe('text');
  });

  it('accepts a { text: "..." } object shape too', async () => {
    const { client } = makeClient(async () => ({ text: 'parsed' }));
    const result = await transcribeWithWhisper({
      client,
      audioStream: makeStream(),
    });
    expect(result).toEqual({ ok: true, transcript: 'parsed' });
  });
});
