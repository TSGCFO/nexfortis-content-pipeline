import { describe, expect, it, vi } from 'vitest';

import {
  WHISPER_DEFAULT_LANGUAGE,
  WHISPER_MODEL,
  transcribeWithWhisper,
  type OpenAIWhisperLike,
} from '../../../artifacts/telegram-bot/src/lib/whisper-client.js';

function makeMockClient(
  impl: (
    args: Parameters<OpenAIWhisperLike['audio']['transcriptions']['create']>[0],
  ) => Promise<string>,
): { client: OpenAIWhisperLike; create: ReturnType<typeof vi.fn> } {
  const create = vi.fn(impl);
  return {
    create,
    client: {
      audio: { transcriptions: { create: create as unknown as OpenAIWhisperLike['audio']['transcriptions']['create'] } },
    },
  };
}

describe('transcribeWithWhisper', () => {
  it('returns { ok: true, transcript } on successful transcription', async () => {
    const { client } = makeMockClient(async () => 'transcript text');
    const r = await transcribeWithWhisper({
      apiKey: 'k',
      audioStream: 'fake-stream',
      openaiClient: client,
    });
    expect(r).toEqual({ ok: true, transcript: 'transcript text' });
  });

  it('returns { ok: false } when the OpenAI client throws (does NOT throw itself)', async () => {
    const { client } = makeMockClient(async () => {
      throw new Error('Whisper API down');
    });
    const r = await transcribeWithWhisper({
      apiKey: 'k',
      audioStream: 'fake',
      openaiClient: client,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/Whisper transcription failed/);
      expect(r.error).toMatch(/Whisper API down/);
    }
  });

  it('returns { ok: true, transcript: "" } for an empty transcript (not treated as failure)', async () => {
    const { client } = makeMockClient(async () => '');
    const r = await transcribeWithWhisper({
      apiKey: 'k',
      audioStream: 'fake',
      openaiClient: client,
    });
    expect(r).toEqual({ ok: true, transcript: '' });
  });

  it('calls the SDK with model exactly "whisper-1"', async () => {
    const { client, create } = makeMockClient(async () => 'ok');
    await transcribeWithWhisper({
      apiKey: 'k',
      audioStream: 'fake',
      openaiClient: client,
    });
    expect(create).toHaveBeenCalledTimes(1);
    const args = create.mock.calls[0]![0] as { model: string };
    expect(args.model).toBe(WHISPER_MODEL);
    expect(args.model).toBe('whisper-1');
  });

  it('defaults language to "en" when not provided', async () => {
    const { client, create } = makeMockClient(async () => 'ok');
    await transcribeWithWhisper({
      apiKey: 'k',
      audioStream: 'fake',
      openaiClient: client,
    });
    const args = create.mock.calls[0]![0] as { language: string };
    expect(args.language).toBe(WHISPER_DEFAULT_LANGUAGE);
    expect(args.language).toBe('en');
  });

  it('calls the SDK with response_format exactly "text"', async () => {
    const { client, create } = makeMockClient(async () => 'ok');
    await transcribeWithWhisper({
      apiKey: 'k',
      audioStream: 'fake',
      openaiClient: client,
    });
    const args = create.mock.calls[0]![0] as { response_format: string };
    expect(args.response_format).toBe('text');
  });

  it('returns { ok: false } when the SDK returns a non-string value', async () => {
    const { client } = makeMockClient(
      // Cast through unknown — the typed signature says string,
      // but we defensively guard against future SDK shape changes.
      async () => 42 as unknown as string,
    );
    const r = await transcribeWithWhisper({
      apiKey: 'k',
      audioStream: 'fake',
      openaiClient: client,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/non-string body/);
    }
  });
});
