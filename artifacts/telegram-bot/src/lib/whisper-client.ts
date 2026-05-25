/**
 * Whisper voice-note transcription helper.
 *
 * Wraps `OpenAI#audio.transcriptions.create` with a `Result`-typed surface
 * that never throws. Tests inject a mock `OpenAILike` client.
 *
 * Per PRD §6.5 the model is fixed to `whisper-1`, language to `'en'`, and
 * response format to `'text'`. An empty transcript ("") is not treated as
 * a failure — Whisper occasionally returns an empty string for very short
 * or noisy clips, which is still useful signal (the caller can prompt
 * Hassan to retype).
 *
 * Voice transcription is intentionally NOT placed in `lib/embeddings`
 * (despite the PRD §6.5 pseudocode suggesting so). The PR 2 prompt
 * explicitly overrides that decision: voice transcription is bot-specific
 * and keeps the artifact's IO localised.
 */

export interface OpenAITranscriptionParams {
  model: string;
  file: ReadableStream<Uint8Array> | Blob | File;
  language?: string;
  response_format?: string;
}

/**
 * Structural type of the slice of `openai` we actually use. The real
 * client matches this shape; tests inject a `vi.fn()` mock.
 */
export interface OpenAILike {
  audio: {
    transcriptions: {
      create(params: OpenAITranscriptionParams): Promise<unknown>;
    };
  };
}

export interface TranscribeWithWhisperInput {
  client: OpenAILike;
  audioStream: ReadableStream<Uint8Array> | Blob | File;
  /** Defaults to 'en'. */
  language?: string;
}

export type TranscribeWithWhisperResult =
  | { ok: true; transcript: string }
  | { ok: false; error: string };

export async function transcribeWithWhisper(
  input: TranscribeWithWhisperInput,
): Promise<TranscribeWithWhisperResult> {
  try {
    const response = await input.client.audio.transcriptions.create({
      model: 'whisper-1',
      file: input.audioStream,
      language: input.language ?? 'en',
      response_format: 'text',
    });
    // OpenAI SDK returns the raw string for response_format='text'.
    if (typeof response === 'string') {
      return { ok: true, transcript: response };
    }
    // Some SDK versions wrap in `{ text: '...' }`. Accept that shape too.
    if (
      response !== null &&
      typeof response === 'object' &&
      'text' in response &&
      typeof (response as { text: unknown }).text === 'string'
    ) {
      return { ok: true, transcript: (response as { text: string }).text };
    }
    return {
      ok: false,
      error: 'whisper response was not a string or { text }',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `whisper error: ${message}` };
  }
}
