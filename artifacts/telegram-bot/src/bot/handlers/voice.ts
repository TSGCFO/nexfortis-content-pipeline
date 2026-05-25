/**
 * grammY voice-message handler.
 *
 * On every voice note:
 *   1. Resolve the file path via `bot.api.getFile(file_id)`.
 *   2. Construct the Telegram CDN audio URL (stored in
 *      `interview_sessions.answers[n].audio_url` per PRD §6.5).
 *   3. Download the audio stream via `downloadTelegramFile`.
 *   4. Transcribe via Whisper via `transcribeWithWhisper`.
 *   5. Dispatch a `telegram.message.received` Inngest event with the
 *      transcript + audio URL (or `transcription_error` if any step
 *      failed).
 *
 * Never throws — every IO step has a Result-shape failure path. A failed
 * download or transcription still dispatches the event so the
 * confirmation-loop sees a `voice` message with `transcript: null` and
 * `transcription_error: <reason>`.
 */

import type { Bot, Context } from 'grammy';
import type { Logger } from '@ncp/logger';

import { downloadTelegramFile } from '../../lib/telegram-file-download.js';
import {
  transcribeWithWhisper,
  type OpenAILike,
} from '../../lib/whisper-client.js';
import type { SessionMap } from '../session-map.js';
import type { SendInngestEvent } from './types.js';

const SOURCE = 'telegram_bot' as const;

interface VoiceFileResolver {
  getFile(fileId: string): Promise<{ file_path?: string }>;
}

export interface HandleVoiceMessageInput {
  chatId: string;
  voiceFileId: string;
  token: string;
  sessionMap: SessionMap;
  sendInngestEvent: SendInngestEvent;
  openaiClient: OpenAILike;
  logger: Logger;
  /** Telegram file API (DI for tests). */
  fileResolver: VoiceFileResolver;
  /** Injectable for tests. Defaults to global `fetch`. */
  fetchFn?: typeof fetch;
}

export async function handleVoiceMessage(
  input: HandleVoiceMessageInput,
): Promise<void> {
  const {
    chatId,
    voiceFileId,
    token,
    sessionMap,
    sendInngestEvent,
    openaiClient,
    logger,
    fileResolver,
  } = input;

  const session = sessionMap.getActiveSessionForChat(chatId);
  if (session === undefined) {
    logger.warn(
      {
        source: SOURCE,
        action: 'voice_message_no_active_session',
        chatId,
      },
      'received voice message but no active interview session for chat',
    );
    return;
  }

  let filePath: string | undefined;
  try {
    const fileInfo = await fileResolver.getFile(voiceFileId);
    filePath = fileInfo.file_path;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      {
        source: SOURCE,
        action: 'voice_file_lookup_failed',
        chatId,
        voiceFileId,
        reason: message,
      },
      'telegram getFile lookup failed',
    );
    await sendInngestEvent({
      name: 'telegram.message.received',
      data: {
        chatId,
        sessionId: session.sessionId,
        messageType: 'voice',
        text: '',
        voiceFileId,
        transcript: null,
        transcriptionError: `getFile_failed: ${message}`,
      },
    });
    return;
  }

  if (typeof filePath !== 'string' || filePath.length === 0) {
    await sendInngestEvent({
      name: 'telegram.message.received',
      data: {
        chatId,
        sessionId: session.sessionId,
        messageType: 'voice',
        text: '',
        voiceFileId,
        transcript: null,
        transcriptionError: 'getFile_returned_no_path',
      },
    });
    return;
  }

  const audioUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
  const fetchFn = input.fetchFn ?? fetch;
  const downloadOptions: Parameters<typeof downloadTelegramFile>[0] = {
    token,
    filePath,
    fetchFn,
  };
  const download = await downloadTelegramFile(downloadOptions);
  if (!download.ok) {
    logger.error(
      {
        source: SOURCE,
        action: 'voice_download_failed',
        chatId,
        voiceFileId,
        reason: download.error,
      },
      'telegram file download failed',
    );
    await sendInngestEvent({
      name: 'telegram.message.received',
      data: {
        chatId,
        sessionId: session.sessionId,
        messageType: 'voice',
        text: '',
        voiceFileId,
        audioUrl,
        transcript: null,
        transcriptionError: download.error,
      },
    });
    return;
  }

  const transcription = await transcribeWithWhisper({
    client: openaiClient,
    audioStream: download.stream,
  });
  if (!transcription.ok) {
    logger.error(
      {
        source: SOURCE,
        action: 'voice_transcription_failed',
        chatId,
        voiceFileId,
        reason: transcription.error,
      },
      'whisper transcription failed',
    );
    await sendInngestEvent({
      name: 'telegram.message.received',
      data: {
        chatId,
        sessionId: session.sessionId,
        messageType: 'voice',
        text: '',
        voiceFileId,
        audioUrl,
        transcript: null,
        transcriptionError: transcription.error,
      },
    });
    return;
  }

  await sendInngestEvent({
    name: 'telegram.message.received',
    data: {
      chatId,
      sessionId: session.sessionId,
      messageType: 'voice',
      text: transcription.transcript,
      voiceFileId,
      audioUrl,
      transcript: transcription.transcript,
    },
  });
}

export interface RegisterVoiceHandlerInput {
  bot: Bot;
  token: string;
  sessionMap: SessionMap;
  sendInngestEvent: SendInngestEvent;
  openaiClient: OpenAILike;
  logger: Logger;
  fetchFn?: typeof fetch;
}

export function registerVoiceHandler(input: RegisterVoiceHandlerInput): void {
  input.bot.on('message:voice', async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    const fileId = ctx.message?.voice?.file_id;
    if (chatId === undefined || typeof fileId !== 'string') return;
    const handlerInput: HandleVoiceMessageInput = {
      chatId: String(chatId),
      voiceFileId: fileId,
      token: input.token,
      sessionMap: input.sessionMap,
      sendInngestEvent: input.sendInngestEvent,
      openaiClient: input.openaiClient,
      logger: input.logger,
      fileResolver: {
        getFile: async (id: string) => {
          const file = await input.bot.api.getFile(id);
          return file.file_path !== undefined
            ? { file_path: file.file_path }
            : {};
        },
      },
      ...(input.fetchFn !== undefined ? { fetchFn: input.fetchFn } : {}),
    };
    await handleVoiceMessage(handlerInput);
  });
}
