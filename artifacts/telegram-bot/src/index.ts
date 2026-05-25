/**
 * Entry point for the `@ncp/telegram-bot` artifact.
 *
 * On module load we:
 *   - Construct the Inngest client and the `interview-session` function
 *     (PR 1 + PR 2 — Inngest-side).
 *   - Optionally boot the grammY long-poll listener (PR 2 — bot side)
 *     when `TELEGRAM_BOT_TOKEN` + `OPENAI_API_KEY` + `DATABASE_URL` are
 *     present in the environment. Tests and CI imports do NOT set these,
 *     so the bot startup is skipped quietly. Production (Render) sets
 *     them via Render secrets.
 */

import { Inngest } from 'inngest';
import { createLogger } from '@ncp/logger';
import { createDbClient } from '@ncp/db';

import { bootBot } from './bot/index.js';
import type { TelegramMessageEvent } from './bot/handlers/types.js';
import { createInterviewSessionJob } from './jobs/interview-session/index.js';

const logger = createLogger({ source: 'telegram_bot' });

export const inngest = new Inngest({ id: 'telegram-bot' });

export const interviewSessionJob = createInterviewSessionJob(inngest);

export const inngestFunctions = [interviewSessionJob];

logger.debug(
  { source: 'telegram_bot', action: 'module_loaded' },
  'telegram-bot module loaded',
);

/**
 * Boot the grammY long-poll bot if every required env var is present.
 * Returns the boot result (session map + start fn) so a wrapper script
 * can call `start()` to enter the long-poll loop. Exported separately so
 * tests can import `@ncp/telegram-bot` without standing up Telegram.
 */
export async function bootTelegramBot(): Promise<
  ReturnType<typeof bootBot> | null
> {
  const token = process.env['TELEGRAM_BOT_TOKEN'];
  const openaiApiKey = process.env['OPENAI_API_KEY'];
  const databaseUrl = process.env['DATABASE_URL'];
  if (
    typeof token !== 'string' ||
    token.length === 0 ||
    typeof openaiApiKey !== 'string' ||
    openaiApiKey.length === 0 ||
    typeof databaseUrl !== 'string' ||
    databaseUrl.length === 0
  ) {
    logger.info(
      {
        source: 'telegram_bot',
        action: 'bot_boot_skipped',
        reason: 'required env vars not set',
      },
      'skipping grammY bot startup (env not configured)',
    );
    return null;
  }
  const db = createDbClient({ connectionString: databaseUrl });
  return bootBot({
    token,
    openaiApiKey,
    db,
    logger,
    sendInngestEvent: async (event: TelegramMessageEvent) => {
      await inngest.send(event);
    },
  });
}
