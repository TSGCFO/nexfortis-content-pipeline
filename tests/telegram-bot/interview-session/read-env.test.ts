/**
 * Unit tests for `readEnv`. Manipulates `process.env` only.
 *
 * PR 2 backport note: `readEnv` now requires five env vars (PR 1's three
 * plus `OPENAI_API_KEY` + `ANTHROPIC_API_KEY`). Tests updated accordingly.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { readEnv } from '../../../artifacts/telegram-bot/src/jobs/interview-session/index.js';
import { EnvNotConfiguredError } from '../../../artifacts/telegram-bot/src/jobs/interview-session/errors.js';

const REQUIRED = [
  'DATABASE_URL',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
] as const;

const ORIGINAL_ENV = { ...process.env };

function setAll(): void {
  process.env['DATABASE_URL'] = 'postgres://x';
  process.env['TELEGRAM_BOT_TOKEN'] = 'btoken';
  process.env['TELEGRAM_CHAT_ID'] = 'chat';
  process.env['OPENAI_API_KEY'] = 'oai';
  process.env['ANTHROPIC_API_KEY'] = 'anth';
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('readEnv', () => {
  it('returns the typed env when all five vars are set', () => {
    setAll();
    const env = readEnv();
    expect(env).toEqual({
      databaseUrl: 'postgres://x',
      telegramBotToken: 'btoken',
      telegramChatId: 'chat',
      openaiApiKey: 'oai',
      anthropicApiKey: 'anth',
    });
  });

  it('throws EnvNotConfiguredError listing only DATABASE_URL when only that is missing', () => {
    setAll();
    delete process.env['DATABASE_URL'];
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

  it('throws listing all five when none are set', () => {
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
        'OPENAI_API_KEY',
        'ANTHROPIC_API_KEY',
      ]);
    }
  });

  it('throws when a var is set to an empty string (treated as missing)', () => {
    setAll();
    process.env['TELEGRAM_BOT_TOKEN'] = '';
    try {
      readEnv();
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvNotConfiguredError);
      const e = err as EnvNotConfiguredError;
      expect(e.missing).toEqual(['TELEGRAM_BOT_TOKEN']);
    }
  });

  it('throws when OPENAI_API_KEY is missing even if the original three PR 1 vars are present', () => {
    process.env['DATABASE_URL'] = 'postgres://x';
    process.env['TELEGRAM_BOT_TOKEN'] = 'btoken';
    process.env['TELEGRAM_CHAT_ID'] = 'chat';
    process.env['ANTHROPIC_API_KEY'] = 'anth';
    delete process.env['OPENAI_API_KEY'];
    try {
      readEnv();
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvNotConfiguredError);
      const e = err as EnvNotConfiguredError;
      expect(e.missing).toEqual(['OPENAI_API_KEY']);
    }
  });

  it('throws when ANTHROPIC_API_KEY is missing', () => {
    process.env['DATABASE_URL'] = 'postgres://x';
    process.env['TELEGRAM_BOT_TOKEN'] = 'btoken';
    process.env['TELEGRAM_CHAT_ID'] = 'chat';
    process.env['OPENAI_API_KEY'] = 'oai';
    delete process.env['ANTHROPIC_API_KEY'];
    try {
      readEnv();
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvNotConfiguredError);
      const e = err as EnvNotConfiguredError;
      expect(e.missing).toEqual(['ANTHROPIC_API_KEY']);
    }
  });
});
