/**
 * Core launch logic. Pure function, no CLI/process concerns — easy to test
 * and easy to reuse from other scripts later (e.g. an auto-launcher that
 * reads prompts from a queue).
 */

// NOTE: We deliberately do NOT static-import `@cursor/sdk` at the top of
// this file. The SDK pulls in native bindings (sqlite3) at module load,
// which causes any import of this file (e.g. for `--help` or for type
// re-exports from `index.ts`) to fail in environments where those bindings
// haven't been built. We import lazily inside `launchCursorAgent` instead.
import type { SDKAgent, Run } from '@cursor/sdk';

import { CURSOR_LAUNCH_CONFIG, REQUIRED_ENV } from './config.js';

export interface LaunchOptions {
  /** The prompt to send to the cloud agent. This is the ONLY thing that changes per run. */
  prompt: string;

  /**
   * Behaviour after the agent is launched:
   *  - 'verify-started' (default): wait until status transitions from CREATING → RUNNING, then exit
   *  - 'wait-for-completion': block until the run terminates (status = finished | error | cancelled)
   */
  mode?: 'verify-started' | 'wait-for-completion';
}

export interface LaunchResult {
  agentId: string;
  runId: string;
  cursorWebUrl: string;
  verifiedRunning: boolean;
  /** Only set when mode = 'wait-for-completion' */
  finalStatus?: 'finished' | 'error' | 'cancelled';
  /** Only set when mode = 'wait-for-completion' */
  prUrl?: string;
  /** Only set when mode = 'wait-for-completion' */
  branch?: string;
  /** Only set when mode = 'wait-for-completion' */
  resultText?: string;
}

export interface LaunchLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

const defaultLogger: LaunchLogger = {
  info: (m) => console.warn(`[cursor-launch] ${m}`),
  warn: (m) => console.warn(`[cursor-launch] WARN: ${m}`),
  error: (m) => console.error(`[cursor-launch] ERROR: ${m}`),
};

/**
 * Launches a Cursor cloud agent against the NexFortis content-pipeline repo
 * with the given prompt. All other parameters (model, repo, starting ref,
 * auto-PR) come from `config.ts`.
 *
 * @throws if `CURSOR_API_KEY` env var is missing or empty
 * @throws if the cloud agent fails to leave CREATING within the verify timeout
 *         (only in 'verify-started' mode)
 */
export async function launchCursorAgent(
  options: LaunchOptions,
  logger: LaunchLogger = defaultLogger,
): Promise<LaunchResult> {
  const apiKey = process.env[REQUIRED_ENV.cursorApiKey];
  if (!apiKey) {
    throw new Error(
      `Missing required env var: ${REQUIRED_ENV.cursorApiKey}. ` +
        `Set it before running this script.`,
    );
  }
  if (!options.prompt || options.prompt.trim().length === 0) {
    throw new Error('prompt must be a non-empty string');
  }

  const mode = options.mode ?? 'verify-started';

  logger.info(`Creating cloud agent...`);
  logger.info(`  model:       ${CURSOR_LAUNCH_CONFIG.modelId}`);
  logger.info(`  repo:        ${CURSOR_LAUNCH_CONFIG.repoUrl}`);
  logger.info(`  starting:    ${CURSOR_LAUNCH_CONFIG.startingRef}`);
  logger.info(`  autoCreatePR: ${CURSOR_LAUNCH_CONFIG.autoCreatePR}`);
  logger.info(`  promptChars: ${options.prompt.length}`);

  // Lazy import — see note at top of file. Type-only import above is erased
  // at runtime so this is the first real load of @cursor/sdk.
  const { Agent } = await import('@cursor/sdk');

  const agent: SDKAgent = await Agent.create({
    apiKey,
    model: { id: CURSOR_LAUNCH_CONFIG.modelId },
    cloud: {
      repos: [
        {
          url: CURSOR_LAUNCH_CONFIG.repoUrl,
          startingRef: CURSOR_LAUNCH_CONFIG.startingRef,
        },
      ],
      autoCreatePR: CURSOR_LAUNCH_CONFIG.autoCreatePR,
    },
  });

  const agentId = agent.agentId;
  const cursorWebUrl = `${CURSOR_LAUNCH_CONFIG.cursorWebUrlBase}/${agentId}`;
  logger.info(`Agent created: ${agentId}`);
  logger.info(`Cursor Web URL: ${cursorWebUrl}`);

  logger.info(`Sending prompt...`);
  const run: Run = await agent.send(options.prompt);
  const runId = run.id;
  logger.info(`Run started: ${runId}`);

  // Verify the cloud agent has actually started. We listen for SDKStatusMessage
  // events on the stream — Cursor emits CREATING when VM provisioning starts and
  // RUNNING once the agent is actually doing work.
  //
  // The user explicitly asked: "wait for verification that the agent was
  // launched properly and has actually started a session". Just getting an
  // agentId back from Agent.create is not enough — the VM could still fail
  // to provision. We need a RUNNING status before declaring success.

  const result: LaunchResult = {
    agentId,
    runId,
    cursorWebUrl,
    verifiedRunning: false,
  };

  if (mode === 'verify-started') {
    await verifyRunning(run, logger, CURSOR_LAUNCH_CONFIG.verifyTimeoutMs);
    result.verifiedRunning = true;
    logger.info(`Verified: cloud agent is RUNNING`);
    // Close the agent handle. The cloud agent itself keeps running on
    // Cursor's infra — close() just releases our local connection.
    agent.close();
    return result;
  }

  // wait-for-completion mode: block on the run and surface git/result info
  logger.info(`Waiting for run to complete (this can take many minutes)...`);
  for await (const event of run.stream()) {
    if (event.type === 'status') {
      logger.info(`status -> ${event.status}${event.message ? ` (${event.message})` : ''}`);
      if (event.status === 'RUNNING') {
        result.verifiedRunning = true;
      }
    } else if (event.type === 'assistant') {
      // Don't log every assistant chunk — too noisy. Just log that text arrived.
      // The full conversation can be retrieved via run.conversation() later.
    } else if (event.type === 'task' && event.text) {
      logger.info(`task: ${event.text}`);
    }
  }

  const finalState = await run.wait();
  result.finalStatus = finalState.status;
  if (finalState.result) result.resultText = finalState.result;
  const branch = finalState.git?.branches?.[0];
  if (branch?.branch) result.branch = branch.branch;
  if (branch?.prUrl) result.prUrl = branch.prUrl;

  logger.info(`Run finished with status: ${finalState.status}`);
  if (finalState.durationMs !== undefined) {
    logger.info(`Duration: ${(finalState.durationMs / 1000).toFixed(1)}s`);
  }
  if (result.branch) logger.info(`Branch: ${result.branch}`);
  if (result.prUrl) logger.info(`PR: ${result.prUrl}`);

  agent.close();
  return result;
}

/**
 * Subscribes to the run's event stream and resolves once we see a RUNNING
 * status. Rejects on terminal status (ERROR/CANCELLED/EXPIRED) or timeout.
 */
async function verifyRunning(run: Run, logger: LaunchLogger, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      reject(
        new Error(
          `Cloud agent did not reach RUNNING within ${timeoutMs}ms. ` +
            `Check ${run.id} in Cursor Web.`,
        ),
      );
    }, timeoutMs);

    (async () => {
      try {
        for await (const event of run.stream()) {
          if (event.type !== 'status') continue;
          logger.info(`status -> ${event.status}${event.message ? ` (${event.message})` : ''}`);
          if (event.status === 'RUNNING') {
            if (resolved) return;
            resolved = true;
            clearTimeout(timer);
            resolve();
            return;
          }
          if (
            event.status === 'ERROR' ||
            event.status === 'CANCELLED' ||
            event.status === 'EXPIRED'
          ) {
            if (resolved) return;
            resolved = true;
            clearTimeout(timer);
            reject(
              new Error(
                `Cloud agent terminated before reaching RUNNING. ` +
                  `Status: ${event.status}${event.message ? ` — ${event.message}` : ''}`,
              ),
            );
            return;
          }
          if (event.status === 'FINISHED') {
            // Edge case: extremely short run that finished before we observed RUNNING.
            // Treat as success — the agent did its job.
            if (resolved) return;
            resolved = true;
            clearTimeout(timer);
            logger.warn(`Run finished before observing RUNNING — treating as verified.`);
            resolve();
            return;
          }
        }
        // Stream ended without a definitive status. This shouldn't happen on
        // a healthy cloud agent, but guard against it.
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          reject(new Error('Run stream ended without a RUNNING status'));
        }
      } catch (err) {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    })();
  });
}
