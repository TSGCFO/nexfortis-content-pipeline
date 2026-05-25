/**
 * grammY command registration.
 *
 * PR 2 only registers `/skip` and only as a passthrough to the text
 * handler. PR 1 already handles `/skip` correctly when received as a
 * text message in the `preview_sent` state, so this file does nothing
 * more than ensure grammY's command parser doesn't intercept it before
 * the text handler sees it.
 *
 * `/status`, `/help`, `/delete_signal` registrations land in PR 3.
 *
 * The forward-to-text design preserves PR 1's existing /skip handling:
 * the text handler dispatches an Inngest `telegram.message.received`
 * event with `text: '/skip'`, which the Inngest function's existing
 * `if (reply.data.text === '/skip')` branch picks up.
 */

import type { Bot } from 'grammy';

import type { Logger } from '@ncp/logger';

// TODO(pr3): register `/status`, `/help`, `/delete_signal` here when the
// mid-session command surface lands (PRD §4.8).

export interface RegisterCommandsDeps {
  textHandler: (ctx: unknown) => Promise<void>;
  logger: Logger;
}

export interface BotCommandRegistry {
  command: (
    name: string,
    handler: (ctx: unknown) => Promise<void>,
  ) => unknown;
}

export function registerCommands(
  bot: BotCommandRegistry | Bot,
  deps: RegisterCommandsDeps,
): void {
  // Forward `/skip` straight through the text handler. The text handler
  // already includes it in the dispatched event payload as `text:
  // '/skip'`; the Inngest function reads that and runs the existing PR 1
  // skip branch.
  const handler = async (ctx: unknown) => {
    await deps.textHandler(ctx);
  };
  (bot as BotCommandRegistry).command('skip', handler);
}
