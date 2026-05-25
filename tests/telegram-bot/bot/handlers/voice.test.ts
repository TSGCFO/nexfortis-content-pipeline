import { describe, expect, it, vi } from 'vitest';

import { createVoiceHandler } from '../../../../artifacts/telegram-bot/src/bot/handlers/voice.js';
import { SessionMap } from '../../../../artifacts/telegram-bot/src/bot/session-map.js';
import type { OpenAIWhisperLike } from '../../../../artifacts/telegram-bot/src/lib/whisper-client.js';
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

function withActive(): SessionMap {
  const sm = new SessionMap();
  sm.recordOpened('CHAT', {
    sessionId: 'sess-1',
    candidateId: 'cand-1',
    openedAt: new Date('2026-05-25T12:00:00Z'),
  });
  return sm;
}

function makeOpenAI(impl: (args: unknown) => Promise<string>): OpenAIWhisperLike {
  return {
    audio: {
      transcriptions: {
        create: vi.fn(impl) as unknown as OpenAIWhisperLike['audio']['transcriptions']['create'],
      },
    },
  };
}

function makeGetFile(filePath: string): {
  api: { getFile: ReturnType<typeof vi.fn> };
} {
  return {
    api: { getFile: vi.fn(async () => ({ file_path: filePath })) },
  };
}

function downloadOk(): ReturnType<typeof vi.fn> {
  return vi.fn(async () => ({
    ok: true as const,
    stream: new ReadableStream(),
  }));
}

function downloadFail(): ReturnType<typeof vi.fn> {
  return vi.fn(async () => ({
    ok: false as const,
    error: 'HTTP 404',
  }));
}

describe('createVoiceHandler', () => {
  it('happy path: dispatches { messageType: voice, transcript, audioUrl }', async () => {
    const send = vi.fn(async () => undefined);
    const handler = createVoiceHandler({
      sessionMap: withActive(),
      sendInngestEvent: send,
      logger: makeLogger(),
      token: 'TOK',
      openai: makeOpenAI(async () => 'I confirm yes'),
      downloadFn: downloadOk() as unknown as Parameters<
        typeof createVoiceHandler
      >[0]['downloadFn'],
    });
    await handler({
      chat: { id: 'CHAT' },
      message: { voice: { file_id: 'F42', duration: 4 } },
      api: makeGetFile('voice/file_42.oga').api,
    });
    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0]![0];
    expect(payload.data.messageType).toBe('voice');
    expect(payload.data.transcript).toBe('I confirm yes');
    expect(payload.data.text).toBe('I confirm yes');
    expect(payload.data.audioUrl).toBe(
      'https://api.telegram.org/file/botTOK/voice/file_42.oga',
    );
    expect(payload.data.voiceFileId).toBe('F42');
  });

  it('no active session: logs a warn and does NOT dispatch', async () => {
    const send = vi.fn(async () => undefined);
    const logger = makeLogger();
    const handler = createVoiceHandler({
      sessionMap: new SessionMap(),
      sendInngestEvent: send,
      logger,
      token: 'TOK',
      openai: makeOpenAI(async () => 'never called'),
    });
    await handler({
      chat: { id: 'OTHER' },
      message: { voice: { file_id: 'F42' } },
      api: makeGetFile('voice/file_42.oga').api,
    });
    expect(send).not.toHaveBeenCalled();
    const warn = (logger.warn as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) =>
        (c[0] as Record<string, unknown>)['action'] ===
        'voice_no_active_session',
    );
    expect(warn).toBeDefined();
  });

  it('download failure: still dispatches with transcript:null + transcriptionError', async () => {
    const send = vi.fn(async () => undefined);
    const handler = createVoiceHandler({
      sessionMap: withActive(),
      sendInngestEvent: send,
      logger: makeLogger(),
      token: 'TOK',
      openai: makeOpenAI(async () => 'never called'),
      downloadFn: downloadFail() as unknown as Parameters<
        typeof createVoiceHandler
      >[0]['downloadFn'],
    });
    await handler({
      chat: { id: 'CHAT' },
      message: { voice: { file_id: 'F42' } },
      api: makeGetFile('voice/file_42.oga').api,
    });
    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0]![0];
    expect(payload.data.transcript).toBeNull();
    expect(payload.data.transcriptionError).toMatch(/download_failed/);
  });

  it('transcription failure: dispatches with transcript:null + transcriptionError', async () => {
    const send = vi.fn(async () => undefined);
    const handler = createVoiceHandler({
      sessionMap: withActive(),
      sendInngestEvent: send,
      logger: makeLogger(),
      token: 'TOK',
      openai: makeOpenAI(async () => {
        throw new Error('Whisper down');
      }),
      downloadFn: downloadOk() as unknown as Parameters<
        typeof createVoiceHandler
      >[0]['downloadFn'],
    });
    await handler({
      chat: { id: 'CHAT' },
      message: { voice: { file_id: 'F42' } },
      api: makeGetFile('voice/file_42.oga').api,
    });
    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0]![0];
    expect(payload.data.transcript).toBeNull();
    expect(payload.data.transcriptionError).toMatch(/Whisper transcription failed/);
  });

  it('getFile failure: dispatches with transcript:null + getFile_failed error', async () => {
    const send = vi.fn(async () => undefined);
    const handler = createVoiceHandler({
      sessionMap: withActive(),
      sendInngestEvent: send,
      logger: makeLogger(),
      token: 'TOK',
      openai: makeOpenAI(async () => 'never called'),
    });
    await handler({
      chat: { id: 'CHAT' },
      message: { voice: { file_id: 'F42' } },
      api: {
        getFile: vi.fn(async () => {
          throw new Error('Telegram getFile 5xx');
        }),
      },
    });
    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0]![0];
    expect(payload.data.transcript).toBeNull();
    expect(payload.data.transcriptionError).toMatch(/getFile_failed/);
  });
});
