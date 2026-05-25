/**
 * Factory for the grammY `Bot` instance, with handlers wired but the
 * long-poll loop deliberately not started.
 *
 * The factory accepts everything the handlers need as explicit deps so
 * the bot can be assembled in tests with a `vi.fn()` Inngest dispatcher
 * and an in-memory session map.
 */

import { Bot } from 'grammy';
import type { Logger } from '@ncp/logger';

import { registerCallbackHandler } from './handlers/callback.js';
import { registerCommands } from './handlers/commands.js';
import { registerTextHandler } from './handlers/text.js';
import { registerVoiceHandler } from './handlers/voice.js';
import type { SendInngestEvent } from './handlers/types.js';
import type { SessionMap } from './session-map.js';
import type { OpenAILike } from '../lib/whisper-client.js';

export interface CreateBotInput {
  token: string;
  sessionMap: SessionMap;
  sendInngestEvent: SendInngestEvent;
  openaiClient: OpenAILike;
  logger: Logger;
  fetchFn?: typeof fetch;
}

export function createBot(input: CreateBotInput): Bot {
  const bot = new Bot(input.token);
  registerCommands({
    bot,
    sessionMap: input.sessionMap,
    sendInngestEvent: input.sendInngestEvent,
    logger: input.logger,
  });
  registerTextHandler({
    bot,
    sessionMap: input.sessionMap,
    sendInngestEvent: input.sendInngestEvent,
    logger: input.logger,
  });
  registerVoiceHandler({
    bot,
    token: input.token,
    sessionMap: input.sessionMap,
    sendInngestEvent: input.sendInngestEvent,
    openaiClient: input.openaiClient,
    logger: input.logger,
    ...(input.fetchFn !== undefined ? { fetchFn: input.fetchFn } : {}),
  });
  registerCallbackHandler({
    bot,
    sessionMap: input.sessionMap,
    sendInngestEvent: input.sendInngestEvent,
    logger: input.logger,
  });
  return bot;
}
