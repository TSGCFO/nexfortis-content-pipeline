/**
 * Unit tests for the bot-process env reader. Manipulates `process.env`
 * only — no other side effects. Mirrors PR 1's `read-env.test.ts` style.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { readBotEnv } from '../../../artifacts/telegram-bot/src/bot/env.js';
import { EnvNotConfiguredError } from '../../../artifacts/telegram-bot/src/jobs/interview-session/errors.js';

const REQUIRED = [
  'DATABASE_URL',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
] as const;

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('readBotEnv', () => {
  it('returns the typed env when all five vars are set', () => {
    process.env['DATABASE_URL'] = 'postgres://x';
    process.env['TELEGRAM_BOT_TOKEN'] = 'btoken';
    process.env['TELEGRAM_CHAT_ID'] = 'chat';
    process.env['OPENAI_API_KEY'] = 'okey';
    process.env['ANTHROPIC_API_KEY'] = 'akey';
    const env = readBotEnv();
    expect(env).toEqual({
      databaseUrl: 'postgres://x',
      telegramBotToken: 'btoken',
      telegramChatId: 'chat',
      openaiApiKey: 'okey',
      anthropicApiKey: 'akey',
    });
  });

  it('throws EnvNotConfiguredError listing all five when none are set', () => {
    for (const name of REQUIRED) delete process.env[name];
    try {
      readBotEnv();
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvNotConfiguredError);
      const e = err as EnvNotConfiguredError;
      expect(e.missing).toEqual([...REQUIRED]);
    }
  });

  it('throws listing only ANTHROPIC_API_KEY when only that is missing', () => {
    process.env['DATABASE_URL'] = 'postgres://x';
    process.env['TELEGRAM_BOT_TOKEN'] = 'btoken';
    process.env['TELEGRAM_CHAT_ID'] = 'chat';
    process.env['OPENAI_API_KEY'] = 'okey';
    delete process.env['ANTHROPIC_API_KEY'];
    try {
      readBotEnv();
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvNotConfiguredError);
      const e = err as EnvNotConfiguredError;
      expect(e.missing).toEqual(['ANTHROPIC_API_KEY']);
    }
  });

  it('treats empty string as missing', () => {
    process.env['DATABASE_URL'] = 'postgres://x';
    process.env['TELEGRAM_BOT_TOKEN'] = 'btoken';
    process.env['TELEGRAM_CHAT_ID'] = 'chat';
    process.env['OPENAI_API_KEY'] = '';
    process.env['ANTHROPIC_API_KEY'] = 'akey';
    try {
      readBotEnv();
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvNotConfiguredError);
      const e = err as EnvNotConfiguredError;
      expect(e.missing).toEqual(['OPENAI_API_KEY']);
    }
  });

  it('does NOT throw when unrelated env vars are also present', () => {
    process.env['DATABASE_URL'] = 'postgres://x';
    process.env['TELEGRAM_BOT_TOKEN'] = 'btoken';
    process.env['TELEGRAM_CHAT_ID'] = 'chat';
    process.env['OPENAI_API_KEY'] = 'okey';
    process.env['ANTHROPIC_API_KEY'] = 'akey';
    process.env['INNGEST_EVENT_KEY'] = 'irrelevant';
    process.env['SUPABASE_URL'] = 'irrelevant';
    expect(() => readBotEnv()).not.toThrow();
  });
});
