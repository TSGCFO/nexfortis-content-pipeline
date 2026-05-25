/**
 * Env-var validation for the long-running grammY bot process.
 *
 * Distinct from `jobs/interview-session/index.ts::readEnv()` because the
 * bot needs the full set of integrations (Whisper + Claude + Telegram +
 * Postgres), whereas the Inngest function only needs a subset. Both
 * follow the same "throw `EnvNotConfiguredError` listing all missing
 * vars" pattern.
 */

import { EnvNotConfiguredError } from '../jobs/interview-session/errors.js';

export interface BotEnv {
  databaseUrl: string;
  telegramBotToken: string;
  telegramChatId: string;
  openaiApiKey: string;
  anthropicApiKey: string;
}

export function readBotEnv(): BotEnv {
  const databaseUrl = process.env['DATABASE_URL'];
  const telegramBotToken = process.env['TELEGRAM_BOT_TOKEN'];
  const telegramChatId = process.env['TELEGRAM_CHAT_ID'];
  const openaiApiKey = process.env['OPENAI_API_KEY'];
  const anthropicApiKey = process.env['ANTHROPIC_API_KEY'];

  const missing: string[] = [];
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    missing.push('DATABASE_URL');
  }
  if (typeof telegramBotToken !== 'string' || telegramBotToken.length === 0) {
    missing.push('TELEGRAM_BOT_TOKEN');
  }
  if (typeof telegramChatId !== 'string' || telegramChatId.length === 0) {
    missing.push('TELEGRAM_CHAT_ID');
  }
  if (typeof openaiApiKey !== 'string' || openaiApiKey.length === 0) {
    missing.push('OPENAI_API_KEY');
  }
  if (typeof anthropicApiKey !== 'string' || anthropicApiKey.length === 0) {
    missing.push('ANTHROPIC_API_KEY');
  }
  if (missing.length > 0) {
    throw new EnvNotConfiguredError(missing);
  }
  return {
    databaseUrl: databaseUrl as string,
    telegramBotToken: telegramBotToken as string,
    telegramChatId: telegramChatId as string,
    openaiApiKey: openaiApiKey as string,
    anthropicApiKey: anthropicApiKey as string,
  };
}
