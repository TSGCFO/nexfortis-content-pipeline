/**
 * grammY bot factory.
 *
 * Constructs a configured `Bot` instance with the PR 2 handlers wired up
 * (text / voice / callback) and the `/skip` command registered as a
 * passthrough to the text handler. Returns the bot un-started — callers
 * decide when to `bot.start()` (long-polling).
 *
 * The grammY listener strings used here:
 *   - `bot.on('message:text', ...)`   — any text message (including
 *                                       commands that we register
 *                                       ourselves; the command handler
 *                                       runs first per grammY composer
 *                                       semantics)
 *   - `bot.on('message:voice', ...)`  — voice notes
 *   - `bot.on('callback_query:data', ...)` — inline button taps
 *
 * Per the PR 2 prompt: NO additional commands beyond `/skip` are
 * registered here. `/status`, `/help`, `/delete_signal` are PR 3 scope.
 */

import { Bot } from 'grammy';

import type { Logger } from '@ncp/logger';

import type { OpenAIWhisperLike } from '../lib/whisper-client.js';
import {
  createCallbackHandler,
  type CallbackSendInngestFn,
} from './handlers/callback.js';
import { registerCommands } from './handlers/commands.js';
import {
  createTextHandler,
  type SendInngestEventFn as TextSendInngestEventFn,
} from './handlers/text.js';
import {
  createVoiceHandler,
  type VoiceHandlerSendInngestFn,
} from './handlers/voice.js';
import type { SessionMap } from './session-map.js';

/**
 * Union of the per-handler dispatch payload shapes — the production
 * `inngest.send(...)` accepts any of them. Per-handler typed-narrower
 * functions in the handlers re-narrow before calling.
 */
export type AnyTelegramReceivedPayload =
  | Parameters<TextSendInngestEventFn>[0]
  | Parameters<VoiceHandlerSendInngestFn>[0]
  | Parameters<CallbackSendInngestFn>[0];

export interface CreateBotDeps {
  token: string;
  sessionMap: SessionMap;
  sendInngestEvent: (payload: AnyTelegramReceivedPayload) => Promise<void>;
  openai: OpenAIWhisperLike;
  openaiApiKey: string;
  logger: Logger;
}

export function createBot(deps: CreateBotDeps): Bot {
  const bot = new Bot(deps.token);

  const textHandler = createTextHandler({
    sessionMap: deps.sessionMap,
    sendInngestEvent: deps.sendInngestEvent as unknown as TextSendInngestEventFn,
    logger: deps.logger,
  });
  const voiceHandler = createVoiceHandler({
    sessionMap: deps.sessionMap,
    sendInngestEvent:
      deps.sendInngestEvent as unknown as VoiceHandlerSendInngestFn,
    logger: deps.logger,
    token: deps.token,
    openai: deps.openai,
    openaiApiKey: deps.openaiApiKey,
  });
  const callbackHandler = createCallbackHandler({
    sessionMap: deps.sessionMap,
    sendInngestEvent: deps.sendInngestEvent as unknown as CallbackSendInngestFn,
    logger: deps.logger,
  });

  // Register `/skip` first so grammY's command parser dispatches it
  // ahead of the generic text handler.
  registerCommands(bot, { textHandler: textHandler as (ctx: unknown) => Promise<void>, logger: deps.logger });

  bot.on('message:text', async (ctx) => {
    await textHandler(ctx);
  });
  bot.on('message:voice', async (ctx) => {
    await voiceHandler(ctx);
  });
  bot.on('callback_query:data', async (ctx) => {
    await callbackHandler(ctx);
  });

  return bot;
}
