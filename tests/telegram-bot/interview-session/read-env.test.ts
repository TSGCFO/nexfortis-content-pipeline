/**
 * Unit tests for `readEnv`. Manipulates `process.env` only.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { readEnv } from '../../../artifacts/telegram-bot/src/jobs/interview-session/index.js';
import { EnvNotConfiguredError } from '../../../artifacts/telegram-bot/src/jobs/interview-session/errors.js';

const REQUIRED = [
  'DATABASE_URL',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
] as const;

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('readEnv', () => {
  it('returns the typed env when all three vars are set', () => {
    process.env['DATABASE_URL'] = 'postgres://x';
    process.env['TELEGRAM_BOT_TOKEN'] = 'btoken';
    process.env['TELEGRAM_CHAT_ID'] = 'chat';
    const env = readEnv();
    expect(env).toEqual({
      databaseUrl: 'postgres://x',
      telegramBotToken: 'btoken',
      telegramChatId: 'chat',
    });
  });

  it('throws EnvNotConfiguredError listing only DATABASE_URL when only that is missing', () => {
    delete process.env['DATABASE_URL'];
    process.env['TELEGRAM_BOT_TOKEN'] = 'btoken';
    process.env['TELEGRAM_CHAT_ID'] = 'chat';
    try {
      readEnv();
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvNotConfiguredError);
      const e = err as EnvNotConfiguredError;
      expect(e.code).toBe('ENV_NOT_CONFIGURED');
      expect(e.missing).toEqual(['DATABASE_URL']);
      expect(e.message).toMatch(/DATABASE_URL/);
    }
  });

  it('throws listing all three when none are set', () => {
    for (const name of REQUIRED) delete process.env[name];
    try {
      readEnv();
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvNotConfiguredError);
      const e = err as EnvNotConfiguredError;
      expect(e.missing).toEqual([
        'DATABASE_URL',
        'TELEGRAM_BOT_TOKEN',
        'TELEGRAM_CHAT_ID',
      ]);
    }
  });

  it('throws when a var is set to an empty string (treated as missing)', () => {
    process.env['DATABASE_URL'] = 'postgres://x';
    process.env['TELEGRAM_BOT_TOKEN'] = '';
    process.env['TELEGRAM_CHAT_ID'] = 'chat';
    try {
      readEnv();
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvNotConfiguredError);
      const e = err as EnvNotConfiguredError;
      expect(e.missing).toEqual(['TELEGRAM_BOT_TOKEN']);
    }
  });

  it('does NOT throw when only unrelated vars (ANTHROPIC_API_KEY, OPENAI_API_KEY) are present alongside the three required ones', () => {
    process.env['DATABASE_URL'] = 'postgres://x';
    process.env['TELEGRAM_BOT_TOKEN'] = 'btoken';
    process.env['TELEGRAM_CHAT_ID'] = 'chat';
    process.env['ANTHROPIC_API_KEY'] = 'foo';
    process.env['OPENAI_API_KEY'] = 'bar';
    process.env['INNGEST_EVENT_KEY'] = 'baz';
    expect(() => readEnv()).not.toThrow();
    const env = readEnv();
    expect(env.databaseUrl).toBe('postgres://x');
  });
});
