/**
 * Whisper transcription helper (PRD §6.5).
 *
 * The Whisper integration deliberately lives in the telegram-bot artifact
 * — overriding the PRD's nominal placement under `lib/embeddings/openai.ts`
 * — because voice transcription is bot-specific and the bot already needs
 * its own copy of the OpenAI SDK for nothing else. The PRD was written
 * before the artifact layout settled; the integration guide §9 implicitly
 * permits this by saying "decide if you need [...] yes if the response
 * shape is bounded".
 *
 * Returns a discriminated result; never throws. Caller (the voice handler)
 * decides whether to send the user-facing fallback message.
 *
 * Audio input type is `unknown` to keep this module decoupled from Node's
 * stream module: the OpenAI SDK accepts a `File`, a `Response`, a Node
 * `Readable`, or a stream-derived `Uploadable` — any of which work. Tests
 * pass a string sentinel and verify it round-trips into the SDK mock.
 */

import OpenAI from 'openai';

export type TranscribeWithWhisperResult =
  | { ok: true; transcript: string }
  | { ok: false; error: string };

/**
 * Structural slice of the `OpenAI` SDK we depend on. Tests inject a tiny
 * mock matching this shape; the production wiring passes a real `OpenAI`
 * instance.
 */
export interface OpenAIWhisperLike {
  audio: {
    transcriptions: {
      create(args: {
        model: string;
        file: unknown;
        language?: string;
        response_format: 'text';
      }): Promise<string>;
    };
  };
}

export interface TranscribeWithWhisperInput {
  apiKey: string;
  audioStream: unknown;
  language?: string;
  openaiClient?: OpenAIWhisperLike;
}

export const WHISPER_MODEL = 'whisper-1';
export const WHISPER_DEFAULT_LANGUAGE = 'en';

export async function transcribeWithWhisper(
  input: TranscribeWithWhisperInput,
): Promise<TranscribeWithWhisperResult> {
  const client: OpenAIWhisperLike =
    input.openaiClient ?? (new OpenAI({ apiKey: input.apiKey }) as unknown as OpenAIWhisperLike);
  try {
    const transcript = await client.audio.transcriptions.create({
      model: WHISPER_MODEL,
      file: input.audioStream,
      language: input.language ?? WHISPER_DEFAULT_LANGUAGE,
      response_format: 'text',
    });
    if (typeof transcript !== 'string') {
      return {
        ok: false,
        error: 'Whisper transcription returned non-string body',
      };
    }
    return { ok: true, transcript };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Whisper transcription failed: ${message}` };
  }
}
