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
import type { SDKAgent, Run, McpServerConfig } from '@cursor/sdk';

import { CURSOR_LAUNCH_CONFIG, REQUIRED_ENV } from './config.js';
import { resolveModel } from './resolve-model.js';

export interface LaunchOptions {
  /** The prompt to send to the cloud agent. This is the ONLY required field. */
  prompt: string;

  /**
   * Behaviour after the agent is launched:
   *  - 'verify-started' (default): wait until status transitions from CREATING → RUNNING, then exit
   *  - 'wait-for-completion': block until the run terminates
   */
  mode?: 'verify-started' | 'wait-for-completion';

  /** Override the model. If undefined, the launcher resolves from CURSOR_LAUNCH_CONFIG.modelPreferenceOrder. */
  modelId?: string;

  /** Additional model params (e.g. thinking=high). Merged with defaults if model accepts them. */
  modelParams?: Array<{ id: string; value: string }>;

  /**
   * Attach to an existing PR. When set:
   *  - `repos[0].prUrl` is sent to Cursor
   *  - `workOnCurrentBranch` is automatically set to `true` so commits push
   *    back to the PR's existing branch (matches the established workflow:
   *    follow-up prompts update the same PR).
   */
  prUrl?: string;

  /** Session-scoped env vars injected into the cloud VM (beta feature in Cursor). */
  envVars?: Record<string, string>;

  /** Inline MCP server defs available to the agent for this run. */
  mcpServers?: Record<string, McpServerConfig>;

  /** Human-readable agent label that shows in Cursor Web's list. */
  name?: string;

  /** Initial conversation mode. 'plan' = research first, 'agent' = implement directly. */
  conversationMode?: 'agent' | 'plan';
}

export interface LaunchResult {
  agentId: string;
  runId: string;
  cursorWebUrl: string;
  verifiedRunning: boolean;
  /** Model + params actually used (after resolution). */
  resolvedModel: { id: string; params?: Array<{ id: string; value: string }> };
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
 * with the given prompt. Everything else (model, repo, starting ref, auto-PR,
 * MCP servers, env vars, PR attach) can be overridden via LaunchOptions.
 *
 * @throws if `CURSOR_API_KEY` env var is missing or empty
 * @throws if no preferred model is available and no override was given
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

  // Resolve model (may call Cursor.models.list() if no explicit override).
  // Build incrementally to satisfy exactOptionalPropertyTypes.
  const resolveInput: import('./resolve-model.js').ResolveModelInput = { apiKey };
  if (options.modelId) resolveInput.modelId = options.modelId;
  if (options.modelParams) resolveInput.modelParams = options.modelParams;
  const modelResolution = await resolveModel(resolveInput, logger);
  logger.info(`Model: ${modelResolution.selection.id} (${modelResolution.rationale})`);

  // Build cloud options
  const startingRef = options.prUrl ? undefined : CURSOR_LAUNCH_CONFIG.startingRef;
  const repoEntry: { url: string; startingRef?: string; prUrl?: string } = {
    url: CURSOR_LAUNCH_CONFIG.repoUrl,
  };
  if (startingRef) repoEntry.startingRef = startingRef;
  if (options.prUrl) repoEntry.prUrl = options.prUrl;

  // workOnCurrentBranch: when attached to a PR, push commits back to the
  // PR's existing branch (rather than spawning a new cursor/... branch).
  // This matches the established workflow: fixup prompts update the same PR.
  const workOnCurrentBranch = options.prUrl ? true : false;

  logger.info(`Creating cloud agent...`);
  logger.info(`  repo:               ${CURSOR_LAUNCH_CONFIG.repoUrl}`);
  if (options.prUrl) {
    logger.info(`  attaching to PR:    ${options.prUrl}`);
    logger.info(`  workOnCurrentBranch: true (auto-set because --pr-url was passed)`);
  } else {
    logger.info(`  starting ref:       ${CURSOR_LAUNCH_CONFIG.startingRef}`);
  }
  logger.info(`  autoCreatePR:       ${CURSOR_LAUNCH_CONFIG.autoCreatePR}`);
  if (options.name) logger.info(`  agent name:         ${options.name}`);
  if (options.conversationMode) logger.info(`  conversation mode:  ${options.conversationMode}`);
  if (options.mcpServers && Object.keys(options.mcpServers).length > 0) {
    logger.info(`  MCP servers:        ${Object.keys(options.mcpServers).join(', ')}`);
  }
  if (options.envVars && Object.keys(options.envVars).length > 0) {
    logger.info(`  session env vars:   ${Object.keys(options.envVars).join(', ')} (values redacted)`);
  }
  logger.info(`  promptChars:        ${options.prompt.length}`);

  // Lazy import — see note at top of file.
  const { Agent } = await import('@cursor/sdk');

  // Build the Agent.create payload. The SDK is strict about exactOptionalPropertyTypes
  // so we build it incrementally.
  const cloudOpts: {
    repos: Array<{ url: string; startingRef?: string; prUrl?: string }>;
    autoCreatePR: boolean;
    workOnCurrentBranch?: boolean;
    envVars?: Record<string, string>;
  } = {
    repos: [repoEntry],
    autoCreatePR: CURSOR_LAUNCH_CONFIG.autoCreatePR,
  };
  if (workOnCurrentBranch) cloudOpts.workOnCurrentBranch = true;
  if (options.envVars && Object.keys(options.envVars).length > 0) {
    cloudOpts.envVars = options.envVars;
  }

  const createPayload: Parameters<typeof Agent.create>[0] = {
    apiKey,
    model: modelResolution.selection,
    cloud: cloudOpts,
  };
  if (options.name) createPayload.name = options.name;
  if (options.conversationMode) createPayload.mode = options.conversationMode;
  if (options.mcpServers && Object.keys(options.mcpServers).length > 0) {
    createPayload.mcpServers = options.mcpServers;
  }

  const agent: SDKAgent = await Agent.create(createPayload);

  const agentId = agent.agentId;
  const cursorWebUrl = `${CURSOR_LAUNCH_CONFIG.cursorWebUrlBase}/${agentId}`;
  logger.info(`Agent created: ${agentId}`);
  logger.info(`Cursor Web URL: ${cursorWebUrl}`);

  logger.info(`Sending prompt...`);
  const run: Run = await agent.send(options.prompt);
  const runId = run.id;
  logger.info(`Run started: ${runId}`);

  const result: LaunchResult = {
    agentId,
    runId,
    cursorWebUrl,
    verifiedRunning: false,
    resolvedModel: modelResolution.selection.params
      ? { id: modelResolution.selection.id, params: [...modelResolution.selection.params] }
      : { id: modelResolution.selection.id },
  };

  if (mode === 'verify-started') {
    await verifyRunning(run, logger, CURSOR_LAUNCH_CONFIG.verifyTimeoutMs);
    result.verifiedRunning = true;
    logger.info(`Verified: cloud agent is RUNNING`);
    agent.close();
    return result;
  }

  // wait-for-completion mode
  logger.info(`Waiting for run to complete (this can take many minutes)...`);
  for await (const event of run.stream()) {
    if (event.type === 'status') {
      logger.info(`status -> ${event.status}${event.message ? ` (${event.message})` : ''}`);
      if (event.status === 'RUNNING') {
        result.verifiedRunning = true;
      }
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
            // Extremely short run finished before we observed RUNNING.
            if (resolved) return;
            resolved = true;
            clearTimeout(timer);
            logger.warn(`Run finished before observing RUNNING — treating as verified.`);
            resolve();
            return;
          }
        }
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
