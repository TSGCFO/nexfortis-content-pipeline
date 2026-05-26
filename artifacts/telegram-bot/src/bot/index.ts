/**
 * Bot runtime entry — wires env + DB + OpenAI + session map + grammY bot
 * and exposes a `startBot()` factory. Importing this module is
 * side-effect-free; the bot only starts when `startBot()` is called
 * (so tests can import the artifact freely without touching Telegram).
 *
 * In production, a thin shell script (`node dist/bot/index.js` via a
 * future `bin` field, or a separate `bot-entry.ts` later) will invoke
 * `startBot()`.
 */

import OpenAI from 'openai';

import { createDbClient } from '@ncp/db';
import { createLogger, type Logger } from '@ncp/logger';
import { Inngest } from 'inngest';

import type { OpenAIWhisperLike } from '../lib/whisper-client.js';
import { readBotEnv, type BotEnv } from './env.js';
import { createBot, type AnyTelegramReceivedPayload } from './grammy-instance.js';
import { SessionMap, type ActiveSession } from './session-map.js';

const SOURCE = 'telegram_bot' as const;

export interface StartBotOptions {
  /** Pre-built Inngest client. Defaults to a fresh `Inngest({ id: 'telegram-bot' })`. */
  inngest?: Inngest;
  /** Pre-built logger. Defaults to `createLogger({ source: 'telegram_bot' })`. */
  logger?: Logger;
  /** Pre-built env. Defaults to `readBotEnv()`. */
  env?: BotEnv;
  /** Pre-built sessionMap. Defaults to a fresh `new SessionMap()`. */
  sessionMap?: SessionMap;
}

export interface StartBotResult {
  bot: ReturnType<typeof createBot>;
  sessionMap: SessionMap;
  loadedSessions: number;
}

export async function startBot(
  options: StartBotOptions = {},
): Promise<StartBotResult> {
  const env = options.env ?? readBotEnv();
  const logger = options.logger ?? createLogger({ source: SOURCE });
  const sessionMap = options.sessionMap ?? new SessionMap();
  const inngest = options.inngest ?? new Inngest({ id: 'telegram-bot' });
  const db = createDbClient({ connectionString: env.databaseUrl });
  const openai = new OpenAI({ apiKey: env.openaiApiKey }) as unknown as OpenAIWhisperLike;

  const loadedSessions = await sessionMap.loadFromDb({
    db,
    chatIds: [env.telegramChatId],
  });
  logger.info(
    {
      source: SOURCE,
      action: 'session_map_loaded',
      loaded: loadedSessions,
    },
    'session map hydrated from DB',
  );

  const sendInngestEvent = async (
    payload: AnyTelegramReceivedPayload,
  ): Promise<void> => {
    await inngest.send(payload);
  };

  const bot = createBot({
    token: env.telegramBotToken,
    sessionMap,
    sendInngestEvent,
    openai,
    openaiApiKey: env.openaiApiKey,
    logger,
    // PR 3: `/status` reads from the DB, `/delete_signal` writes to it.
    db,
    chatId: env.telegramChatId,
  });

  // Fire-and-forget — grammY's long-poll runner blocks indefinitely.
  // Production callers `await bot.start()` themselves; the factory
  // returns the bot pre-built so callers can hook into `bot.start()`
  // and graceful-shutdown signals.
  return { bot, sessionMap, loadedSessions };
}

export { SessionMap, type ActiveSession };
