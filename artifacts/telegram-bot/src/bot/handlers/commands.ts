/**
 * grammY command handler for the interview-session bot.
 *
 * PR 2 scope: only `/skip` is registered, and the registration deliberately
 * does NOT add a `/skip` text-suppression — grammY by default would route
 * `/skip` messages through the bot.command path AND skip them from
 * `message:text`. This handler re-emits `/skip` through the regular text
 * pipeline so the existing `runInterviewSession` (PR 1) sees it as the
 * literal string '/skip' in the `telegram.message.received` event.
 *
 * The `/status`, `/help`, `/delete_signal` commands are NOT registered
 * here — they land in PR 3.
 *
 * TODO(pr3): register `/status`, `/help`, `/delete_signal` commands
 * here.
 */

import type { Bot, Context } from 'grammy';
import type { Logger } from '@ncp/logger';

import { handleTextMessage } from './text.js';
import type { SessionMap } from '../session-map.js';
import type { SendInngestEvent } from './types.js';

export interface RegisterCommandsInput {
  bot: Bot;
  sessionMap: SessionMap;
  sendInngestEvent: SendInngestEvent;
  logger: Logger;
}

export function registerCommands(input: RegisterCommandsInput): void {
  input.bot.command('skip', async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    if (chatId === undefined) return;
    // Forward as a normal text event so PR 1's preview_sent /skip
    // branch handles it. The text is the literal "/skip" the user typed
    // (grammY strips the bot mention but keeps the leading slash).
    await handleTextMessage({
      chatId: String(chatId),
      text: '/skip',
      sessionMap: input.sessionMap,
      sendInngestEvent: input.sendInngestEvent,
      logger: input.logger,
    });
  });
}
