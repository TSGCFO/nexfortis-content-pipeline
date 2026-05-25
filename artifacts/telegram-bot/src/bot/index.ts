/**
 * Bot startup entry point.
 *
 * Called from `src/index.ts` on module load — outside any Inngest
 * function — so the grammY long-poll runs as a sibling process to the
 * Inngest function handlers.
 *
 * Boot sequence:
 *   1. Construct the session map.
 *   2. Hydrate it from the DB (open interview rows).
 *   3. Construct the grammY `Bot` with handlers wired.
 *   4. Subscribe to `interview.session.opened` events from Inngest so
 *      the bot can update the map mid-run. (This subscription is owned
 *      by the caller — `src/index.ts` — because Inngest event handlers
 *      live alongside the function exports.)
 *   5. Start long-polling (`bot.start`).
 *
 * The boot fn is exported so a test or Render entry script can call it
 * after constructing dependencies, and so the unit tests can drive each
 * step in isolation without booting Telegram.
 */

import OpenAI from 'openai';
import type { Logger } from '@ncp/logger';
import type { Database } from '@ncp/db';

import { createBot } from './grammy-instance.js';
import { createSessionMap, type SessionMapInternal } from './session-map.js';
import type { SendInngestEvent } from './handlers/types.js';
import type { OpenAILike } from '../lib/whisper-client.js';

export interface BootBotInput {
  token: string;
  openaiApiKey: string;
  db: Database;
  sendInngestEvent: SendInngestEvent;
  logger: Logger;
}

export interface BootBotResult {
  sessionMap: SessionMapInternal;
  start: () => Promise<void>;
}

export async function bootBot(input: BootBotInput): Promise<BootBotResult> {
  const sessionMap = createSessionMap();
  await sessionMap.loadFromDb({ db: input.db });
  // The real OpenAI SDK accepts the same call surface we describe in
  // `OpenAILike`, but its `file` type is narrower (a custom `Uploadable`
  // union). Whisper accepts a Node `ReadableStream`-like body at runtime;
  // the cast satisfies the structural type at the boundary.
  const openaiClient = new OpenAI({
    apiKey: input.openaiApiKey,
  }) as unknown as OpenAILike;
  const bot = createBot({
    token: input.token,
    sessionMap,
    sendInngestEvent: input.sendInngestEvent,
    openaiClient,
    logger: input.logger,
  });
  return {
    sessionMap,
    start: async () => {
      // grammY's `start()` resolves when the bot stops; in production
      // we run it un-awaited as a long-running process.
      await bot.start();
    },
  };
}
