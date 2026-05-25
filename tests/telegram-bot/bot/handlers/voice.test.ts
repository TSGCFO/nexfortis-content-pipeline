/**
 * Tests for `handleVoiceMessage` — voice download + transcription + dispatch.
 */

import { describe, expect, it, vi } from 'vitest';

import { handleVoiceMessage } from '../../../../artifacts/telegram-bot/src/bot/handlers/voice.js';
import { createSessionMap } from '../../../../artifacts/telegram-bot/src/bot/session-map.js';
import type { OpenAILike } from '../../../../artifacts/telegram-bot/src/lib/whisper-client.js';
import type { Logger } from '@ncp/logger';

function makeLogger(): Logger {
  return {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  };
}

function makeOpenSessionMap(): ReturnType<typeof createSessionMap> {
  const m = createSessionMap();
  m.recordOpened('chat-1', {
    sessionId: 'sess-1',
    candidateId: 'cand-1',
    openedAt: new Date(),
  });
  return m;
}

function makeOpenAI(
  result: string | Error,
): { client: OpenAILike; create: ReturnType<typeof vi.fn> } {
  const create = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  return { client: { audio: { transcriptions: { create } } }, create };
}

function makeFetchOk(): ReturnType<typeof vi.fn> {
  return vi.fn(async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    });
    return new Response(stream, { status: 200 });
  });
}

describe('handleVoiceMessage', () => {
  it('happy path: dispatches voice event with transcript + audio_url', async () => {
    const sessionMap = makeOpenSessionMap();
    const { client } = makeOpenAI('the transcript');
    const fetchFn = makeFetchOk();
    const sendInngestEvent = vi.fn(async () => undefined);
    const fileResolver = {
      getFile: vi.fn(async () => ({ file_path: 'voice/v1.oga' })),
    };
    await handleVoiceMessage({
      chatId: 'chat-1',
      voiceFileId: 'FILE_ID',
      token: 'TOK',
      sessionMap,
      sendInngestEvent,
      openaiClient: client,
      logger: makeLogger(),
      fileResolver,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(sendInngestEvent).toHaveBeenCalledTimes(1);
    const payload = sendInngestEvent.mock.calls[0]![0] as {
      data: {
        messageType: string;
        audioUrl?: string;
        transcript?: string | null;
        transcriptionError?: string;
      };
    };
    expect(payload.data.messageType).toBe('voice');
    expect(payload.data.audioUrl).toBe(
      'https://api.telegram.org/file/botTOK/voice/v1.oga',
    );
    expect(payload.data.transcript).toBe('the transcript');
    expect(payload.data.transcriptionError).toBeUndefined();
  });

  it('does NOT dispatch when no active session for the chat', async () => {
    const sessionMap = createSessionMap();
    const { client } = makeOpenAI('x');
    const sendInngestEvent = vi.fn(async () => undefined);
    const fileResolver = {
      getFile: vi.fn(async () => ({ file_path: 'voice/v1.oga' })),
    };
    await handleVoiceMessage({
      chatId: 'unknown',
      voiceFileId: 'FILE_ID',
      token: 'TOK',
      sessionMap,
      sendInngestEvent,
      openaiClient: client,
      logger: makeLogger(),
      fileResolver,
    });
    expect(sendInngestEvent).not.toHaveBeenCalled();
  });

  it('Telegram getFile fails → still dispatches with transcriptionError', async () => {
    const sessionMap = makeOpenSessionMap();
    const { client } = makeOpenAI('x');
    const sendInngestEvent = vi.fn(async () => undefined);
    const fileResolver = {
      getFile: vi.fn(async () => {
        throw new Error('telegram_unavailable');
      }),
    };
    await handleVoiceMessage({
      chatId: 'chat-1',
      voiceFileId: 'FILE_ID',
      token: 'TOK',
      sessionMap,
      sendInngestEvent,
      openaiClient: client,
      logger: makeLogger(),
      fileResolver,
    });
    expect(sendInngestEvent).toHaveBeenCalledTimes(1);
    const payload = sendInngestEvent.mock.calls[0]![0] as {
      data: { transcript: string | null; transcriptionError?: string };
    };
    expect(payload.data.transcript).toBeNull();
    expect(payload.data.transcriptionError).toMatch(/getFile_failed/);
  });

  it('download fails (404) → dispatches with transcriptionError, transcript: null', async () => {
    const sessionMap = makeOpenSessionMap();
    const { client } = makeOpenAI('x');
    const fetchFn = vi.fn(async () => new Response('not found', { status: 404 }));
    const sendInngestEvent = vi.fn(async () => undefined);
    const fileResolver = {
      getFile: vi.fn(async () => ({ file_path: 'voice/v1.oga' })),
    };
    await handleVoiceMessage({
      chatId: 'chat-1',
      voiceFileId: 'FILE_ID',
      token: 'TOK',
      sessionMap,
      sendInngestEvent,
      openaiClient: client,
      logger: makeLogger(),
      fileResolver,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(sendInngestEvent).toHaveBeenCalledTimes(1);
    const payload = sendInngestEvent.mock.calls[0]![0] as {
      data: { transcript: string | null; transcriptionError?: string };
    };
    expect(payload.data.transcript).toBeNull();
    expect(payload.data.transcriptionError).toMatch(/404/);
  });

  it('whisper transcription throws → dispatches with transcriptionError, audio_url still present', async () => {
    const sessionMap = makeOpenSessionMap();
    const { client } = makeOpenAI(new Error('whisper rate limited'));
    const sendInngestEvent = vi.fn(async () => undefined);
    const fileResolver = {
      getFile: vi.fn(async () => ({ file_path: 'voice/v1.oga' })),
    };
    const fetchFn = makeFetchOk();
    await handleVoiceMessage({
      chatId: 'chat-1',
      voiceFileId: 'FILE_ID',
      token: 'TOK',
      sessionMap,
      sendInngestEvent,
      openaiClient: client,
      logger: makeLogger(),
      fileResolver,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    const payload = sendInngestEvent.mock.calls[0]![0] as {
      data: {
        audioUrl?: string;
        transcript?: string | null;
        transcriptionError?: string;
      };
    };
    expect(payload.data.audioUrl).toBe(
      'https://api.telegram.org/file/botTOK/voice/v1.oga',
    );
    expect(payload.data.transcript).toBeNull();
    expect(payload.data.transcriptionError).toMatch(/whisper rate limited/);
  });
});
