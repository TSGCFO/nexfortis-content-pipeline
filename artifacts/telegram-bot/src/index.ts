/**
 * `@ncp/telegram-bot` artifact entry — module exports only.
 *
 * Importing this module is SIDE-EFFECT FREE: no Inngest functions
 * register listeners, no grammY bot starts long-polling. Tests can
 * import freely.
 *
 * Production runtime:
 *   - Inngest functions in `inngestFunctions` are mounted via an Inngest
 *     `serve()` HTTP endpoint (set up by a separate `bin` script or by
 *     the deploy runtime).
 *   - The grammY long-poll bot is started by calling `startBot()` from
 *     a runtime entry script (e.g. `node dist/bot/index.js` once a
 *     thin `bin` wrapper lands, or via Render's `startCommand`).
 *
 * The module-level `sessionMap` singleton is shared between the bot
 * handlers (which read it) and the `recordSessionOpenedJob` Inngest
 * function (which mutates it). In a single-process / single-replica
 * deployment (which long-polling forces anyway), this is sufficient.
 */

import { Inngest } from 'inngest';

import { createLogger } from '@ncp/logger';

import { SessionMap } from './bot/session-map.js';
import { createHandleSkipCommandJob } from './jobs/interview-session/handle-skip-command.js';
import { createInterviewSessionJob } from './jobs/interview-session/index.js';
import { createRecordSessionOpenedJob } from './jobs/interview-session/jobs-record-session-opened.js';

const logger = createLogger({ source: 'telegram_bot' });

export const inngest = new Inngest({ id: 'telegram-bot' });

/**
 * Shared in-memory `chatId → ActiveSession` map. The bot's handlers
 * read it; the `record-session-opened` Inngest function writes to it
 * when `interview.session.opened` events arrive. `startBot()` also
 * calls `sessionMap.loadFromDb` once at boot to repopulate after a
 * restart.
 */
export const sessionMap = new SessionMap();

export const interviewSessionJob = createInterviewSessionJob(inngest);

export const recordSessionOpenedJob = createRecordSessionOpenedJob({
  inngest,
  sessionMap,
});

/**
 * PR 3: sibling Inngest function that handles mid-session `/skip`
 * commands. Triggered by `interview.session.command.skip` events from
 * the grammY command handler — idempotently flips the session to
 * `skipped` and sends the ack message.
 */
export const handleSkipCommandJob = createHandleSkipCommandJob(inngest);

export const inngestFunctions = [
  interviewSessionJob,
  recordSessionOpenedJob,
  handleSkipCommandJob,
];

logger.debug(
  { source: 'telegram_bot', action: 'module_loaded' },
  'telegram-bot module loaded',
);

export { startBot } from './bot/index.js';
export { SessionMap } from './bot/session-map.js';
