/**
 * grammY voice-message handler (PRD §6.5 / AC-F2-04).
 *
 * Pipeline:
 *   1. Look up the active session for the chat. No session → log + ignore.
 *   2. Resolve the Telegram file path via `ctx.api.getFile(file_id)`.
 *   3. Download the audio bytes via `downloadTelegramFile`.
 *   4. Send the stream to Whisper (`whisper-1`) via `transcribeWithWhisper`.
 *   5. Dispatch `telegram.message.received` with the transcript + audio
 *      CDN URL.
 *
 * Failure handling per PRD §6.5: on download or transcription failure,
 * dispatch the event with `transcript: null` and `transcriptionError` so
 * the confirmation loop knows to send the fallback prompt. The bot ALSO
 * sends the fallback message directly so Hassan sees it immediately
 * (independent of whether the Inngest function's wait re-fires fast).
 *
 * Note: PR 2 dispatches but does NOT itself send the
 * `buildVoiceTranscriptionFailureMessage` here — the confirmation-loop
 * handles that downstream so we don't double-message. Hassan can simply
 * type a follow-up text reply.
 */

import type { Context } from 'grammy';

import type { Logger } from '@ncp/logger';

import {
  downloadTelegramFile,
  type DownloadTelegramFileResult,
} from '../../lib/telegram-file-download.js';
import {
  transcribeWithWhisper,
  type OpenAIWhisperLike,
} from '../../lib/whisper-client.js';
import type { SessionMap } from '../session-map.js';

const SOURCE = 'telegram_bot' as const;

export interface VoiceHandlerSendInngestFn {
  (payload: {
    name: 'telegram.message.received';
    data: {
      chatId: string;
      sessionId: string;
      text: string;
      messageType: 'voice';
      voiceFileId: string;
      audioUrl?: string;
      transcript?: string | null;
      transcriptionError?: string;
    };
  }): Promise<void>;
}

export interface CreateVoiceHandlerDeps {
  sessionMap: SessionMap;
  sendInngestEvent: VoiceHandlerSendInngestFn;
  logger: Logger;
  /** Telegram bot token — needed to build the file CDN URL. */
  token: string;
  /** OpenAI client (or compatible mock) for the Whisper call. */
  openai: OpenAIWhisperLike;
  /** Injectable for tests. */
  downloadFn?: typeof downloadTelegramFile;
  /** Injectable for tests. */
  transcribeFn?: typeof transcribeWithWhisper;
  /** Injectable for tests. */
  openaiApiKey?: string;
}

export interface VoiceHandlerCtxLike {
  chat?: { id: number | string } | undefined;
  message?: {
    voice?: { file_id?: string; duration?: number } | undefined;
  } | undefined;
  /** grammY's `Bot.api.getFile`. */
  api?: {
    getFile: (fileId: string) => Promise<{ file_path?: string }>;
  } | undefined;
}

export function createVoiceHandler(
  deps: CreateVoiceHandlerDeps,
): (ctx: VoiceHandlerCtxLike | Context) => Promise<void> {
  return async (ctx: VoiceHandlerCtxLike | Context): Promise<void> => {
    try {
      const chatRaw = ctx.chat?.id;
      const voice = ctx.message?.voice;
      if (chatRaw === undefined || !voice || typeof voice.file_id !== 'string') {
        return;
      }
      const chatId = String(chatRaw);
      const voiceFileId = voice.file_id;

      const active = deps.sessionMap.getActiveSessionForChat(chatId);
      if (active === undefined) {
        deps.logger.warn(
          {
            source: SOURCE,
            action: 'voice_no_active_session',
            chatId,
          },
          'received voice message with no active session for chat; ignoring',
        );
        return;
      }

      if (ctx.api === undefined) {
        deps.logger.error(
          {
            source: SOURCE,
            action: 'voice_no_api',
            chatId,
          },
          'voice handler invoked without ctx.api — cannot resolve file path',
        );
        return;
      }

      // Resolve the file path on Telegram's CDN.
      let filePath: string;
      try {
        const file = await ctx.api.getFile(voiceFileId);
        if (typeof file.file_path !== 'string' || file.file_path.length === 0) {
          throw new Error('Telegram getFile returned empty file_path');
        }
        filePath = file.file_path;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        deps.logger.warn(
          {
            source: SOURCE,
            action: 'voice_get_file_failed',
            chatId,
            voiceFileId,
            reason,
          },
          'getFile failed — dispatching with transcription_error',
        );
        await deps.sendInngestEvent({
          name: 'telegram.message.received',
          data: {
            chatId,
            sessionId: active.sessionId,
            text: '',
            messageType: 'voice',
            voiceFileId,
            transcript: null,
            transcriptionError: `getFile_failed: ${reason}`,
          },
        });
        return;
      }

      const audioUrl = `https://api.telegram.org/file/bot${deps.token}/${filePath}`;
      // Audit/dispatch shape MUST NOT log the token. Use a redacted URL
      // for any internal logging.
      const redactedAudioUrl = `https://api.telegram.org/file/bot***/${filePath}`;

      const downloadFn = deps.downloadFn ?? downloadTelegramFile;
      const download: DownloadTelegramFileResult = await downloadFn({
        token: deps.token,
        filePath,
      });
      if (!download.ok) {
        deps.logger.warn(
          {
            source: SOURCE,
            action: 'voice_download_failed',
            chatId,
            voiceFileId,
            audioUrl: redactedAudioUrl,
            reason: download.error,
          },
          'audio download failed — dispatching with transcription_error',
        );
        await deps.sendInngestEvent({
          name: 'telegram.message.received',
          data: {
            chatId,
            sessionId: active.sessionId,
            text: '',
            messageType: 'voice',
            voiceFileId,
            audioUrl,
            transcript: null,
            transcriptionError: `download_failed: ${download.error}`,
          },
        });
        return;
      }

      const transcribeFn = deps.transcribeFn ?? transcribeWithWhisper;
      const transcription = await transcribeFn({
        apiKey: deps.openaiApiKey ?? '',
        audioStream: download.stream,
        openaiClient: deps.openai,
      });
      if (!transcription.ok) {
        deps.logger.warn(
          {
            source: SOURCE,
            action: 'voice_transcription_failed',
            chatId,
            voiceFileId,
            audioUrl: redactedAudioUrl,
            reason: transcription.error,
          },
          'whisper failed — dispatching with transcription_error',
        );
        await deps.sendInngestEvent({
          name: 'telegram.message.received',
          data: {
            chatId,
            sessionId: active.sessionId,
            text: '',
            messageType: 'voice',
            voiceFileId,
            audioUrl,
            transcript: null,
            transcriptionError: transcription.error,
          },
        });
        return;
      }

      await deps.sendInngestEvent({
        name: 'telegram.message.received',
        data: {
          chatId,
          sessionId: active.sessionId,
          text: transcription.transcript,
          messageType: 'voice',
          voiceFileId,
          audioUrl,
          transcript: transcription.transcript,
        },
      });
    } catch (err) {
      deps.logger.error(
        {
          source: SOURCE,
          action: 'voice_handler_threw',
          reason: err instanceof Error ? err.message : String(err),
        },
        'voice handler caught an error; not propagating to grammY runtime',
      );
    }
  };
}
