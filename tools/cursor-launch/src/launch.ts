/**
 * Core launch logic. Pure function, no CLI/process concerns.
 *
 * Talks to Cursor via plain HTTPS (fetch). Authentication is supplied either by:
 *  - `CURSOR_API_KEY` env var (set explicitly by the caller), OR
 *  - The credential proxy (`api_credentials=['custom-cred:api.cursor.com']` on
 *    the surrounding bash call), in which case no env var is needed and the
 *    API key never enters this process.
 *
 * Verified against docs/external/cursor-docs/cursor.com_docs_cloud-agent_api_endpoints.md
 * and the live /v1/models response in docs/external/cursor-models.json.
 */

import { CURSOR_LAUNCH_CONFIG } from './config.js';
import { createAgent, getRun } from './cursor-api.js';
import { resolveModel } from './resolve-model.js';

import type { CreateAgentRequest, McpServerDef, RunStatus } from './types.js';

export interface LaunchOptions {
  /** The prompt to send to the cloud agent. */
  prompt: string;

  /**
   * Behaviour after launch:
   *  - 'verify-started' (default): wait until status transitions CREATING -> RUNNING, then exit
   *  - 'wait-for-completion': block until the run terminates
   */
  mode?: 'verify-started' | 'wait-for-completion';

  /** Override the model. If undefined, the launcher resolves from CURSOR_LAUNCH_CONFIG.modelPreferenceOrder. */
  modelId?: string;

  /** Additional model params. Merged with defaults; CLI params win on conflict. */
  modelParams?: Array<{ id: string; value: string }>;

  /**
   * Attach to an existing PR. When set:
   *  - `repos[0].prUrl` is sent in the create body
   *  - `workOnCurrentBranch` is automatically set to `true` so commits push
   *    back to the PR's existing branch (fixup workflow).
   */
  prUrl?: string;

  /** Session-scoped env vars injected into the cloud VM (beta in Cursor). */
  envVars?: Record<string, string>;

  /** Inline MCP server definitions for this run. */
  mcpServers?: McpServerDef[];

  /** Human-readable agent label in Cursor Web. */
  name?: string;

  /** Initial conversation mode. */
  conversationMode?: 'agent' | 'plan';

  /** Skip requesting the user as PR reviewer. */
  skipReviewerRequest?: boolean;
}

export interface LaunchResult {
  agentId: string;
  runId: string;
  cursorWebUrl: string;
  verifiedRunning: boolean;
  resolvedModel: { id: string; params?: Array<{ id: string; value: string }> };
  /** Only set when mode = 'wait-for-completion' */
  finalStatus?: RunStatus;
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
 * Launches a Cursor cloud agent against the NexFortis content-pipeline repo.
 */
export async function launchCursorAgent(
  options: LaunchOptions,
  logger: LaunchLogger = defaultLogger,
): Promise<LaunchResult> {
  if (!options.prompt || options.prompt.trim().length === 0) {
    throw new Error('prompt must be a non-empty string');
  }

  const mode = options.mode ?? 'verify-started';

  // Resolve model
  const resolveInput: import('./resolve-model.js').ResolveModelInput = {};
  if (options.modelId) resolveInput.modelId = options.modelId;
  if (options.modelParams) resolveInput.modelParams = options.modelParams;
  const modelResolution = await resolveModel(resolveInput, logger);
  logger.info(`Model: ${modelResolution.selection.id} (${modelResolution.rationale})`);

  // Build repo entry
  const repoEntry: { url: string; startingRef?: string; prUrl?: string } = {
    url: CURSOR_LAUNCH_CONFIG.repoUrl,
  };
  if (options.prUrl) {
    repoEntry.prUrl = options.prUrl;
  } else {
    repoEntry.startingRef = CURSOR_LAUNCH_CONFIG.startingRef;
  }

  // workOnCurrentBranch: auto-true when attached to PR so commits push back
  const workOnCurrentBranch = options.prUrl ? true : false;

  // Build create-agent body incrementally
  const body: CreateAgentRequest = {
    prompt: { text: options.prompt },
    model: modelResolution.selection,
    repos: [repoEntry],
    autoCreatePR: CURSOR_LAUNCH_CONFIG.autoCreatePR,
  };
  if (workOnCurrentBranch) body.workOnCurrentBranch = true;
  if (options.name) body.name = options.name;
  if (options.conversationMode) body.mode = options.conversationMode;
  if (options.skipReviewerRequest) body.skipReviewerRequest = true;
  if (options.envVars && Object.keys(options.envVars).length > 0) {
    body.envVars = options.envVars;
  }
  if (options.mcpServers && options.mcpServers.length > 0) {
    body.mcpServers = options.mcpServers;
  }

  logger.info(`Creating cloud agent (POST /v1/agents)...`);
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
  if (options.skipReviewerRequest) logger.info(`  skipReviewerRequest: true`);
  if (body.mcpServers) {
    logger.info(`  MCP servers:        ${body.mcpServers.map((s) => s.name).join(', ')}`);
  }
  if (body.envVars) {
    logger.info(`  session env vars:   ${Object.keys(body.envVars).join(', ')} (values redacted)`);
  }
  logger.info(`  promptChars:        ${options.prompt.length}`);

  const createResponse = await createAgent(body);
  const { agent, run } = createResponse;
  const cursorWebUrl =
    agent.url ?? `${CURSOR_LAUNCH_CONFIG.cursorWebUrlBase}/${agent.id}`;
  logger.info(`Agent created: ${agent.id} (initial run status: ${run.status})`);
  logger.info(`Cursor Web URL: ${cursorWebUrl}`);

  const result: LaunchResult = {
    agentId: agent.id,
    runId: run.id,
    cursorWebUrl,
    verifiedRunning: false,
    resolvedModel: modelResolution.selection.params
      ? { id: modelResolution.selection.id, params: [...modelResolution.selection.params] }
      : { id: modelResolution.selection.id },
  };

  if (mode === 'verify-started') {
    await verifyRunning(agent.id, run.id, run.status, logger, CURSOR_LAUNCH_CONFIG.verifyTimeoutMs);
    result.verifiedRunning = true;
    logger.info(`Verified: cloud agent is RUNNING`);
    return result;
  }

  // wait-for-completion mode — poll until terminal status. (SSE is documented
  // but doesn't work reliably through every HTTPS proxy, and polling is
  // simpler.)
  logger.info(`Waiting for run to complete (polling every 10s; this can take many minutes)...`);
  const completePollIntervalMs = 10_000;
  let lastStatus: RunStatus = run.status;
  let elapsed = 0;
  while (true) {
    await new Promise((r) => setTimeout(r, completePollIntervalMs));
    elapsed += completePollIntervalMs;
    const polled = await getRun(agent.id, run.id);
    if (polled.status !== lastStatus) {
      logger.info(`status -> ${polled.status}`);
      lastStatus = polled.status;
    } else if (elapsed % 60_000 === 0) {
      logger.info(`still ${polled.status} (${Math.round(elapsed / 1000)}s elapsed)`);
    }
    if (polled.status === 'RUNNING') result.verifiedRunning = true;
    if (
      polled.status === 'FINISHED' ||
      polled.status === 'ERROR' ||
      polled.status === 'CANCELLED' ||
      polled.status === 'EXPIRED'
    ) {
      break;
    }
  }

  const finalRun = await getRun(agent.id, run.id);
  result.finalStatus = finalRun.status;
  if (!result.resultText && finalRun.result) result.resultText = finalRun.result;
  const finalBranch = finalRun.git?.branches?.[0];
  if (!result.branch && finalBranch?.branch) result.branch = finalBranch.branch;
  if (!result.prUrl && finalBranch?.prUrl) result.prUrl = finalBranch.prUrl;

  logger.info(`Run finished with status: ${finalRun.status}`);
  if (finalRun.durationMs !== undefined) {
    logger.info(`Duration: ${(finalRun.durationMs / 1000).toFixed(1)}s`);
  }
  if (result.branch) logger.info(`Branch: ${result.branch}`);
  if (result.prUrl) logger.info(`PR: ${result.prUrl}`);
  return result;
}

/**
 * Polls GET /v1/agents/{id}/runs/{runId} until status reaches RUNNING.
 * Throws on terminal status (ERROR/CANCELLED/EXPIRED) or timeout.
 *
 * We use polling rather than the SSE /stream endpoint because:
 *  1. SSE through certain HTTPS proxies (including the Perplexity credential
 *     proxy) buffers / breaks the stream framing.
 *  2. For 'verify-started' we only care about a single state transition
 *     (CREATING → RUNNING). One small fetch every few seconds is fine.
 *  3. Removes a layer of streaming-protocol fragility (text/event-stream
 *     parsing, undici timeouts, etc.).
 */
async function verifyRunning(
  agentId: string,
  runId: string,
  initialStatus: RunStatus,
  logger: LaunchLogger,
  timeoutMs: number,
): Promise<void> {
  // Fast-path: if the initial create response already says RUNNING/FINISHED, we're done.
  if (initialStatus === 'RUNNING' || initialStatus === 'FINISHED') {
    if (initialStatus === 'FINISHED') {
      logger.warn(`Run already FINISHED on create response — treating as verified.`);
    }
    return;
  }
  if (initialStatus === 'ERROR' || initialStatus === 'CANCELLED' || initialStatus === 'EXPIRED') {
    throw new Error(`Run terminated before polling began. Status: ${initialStatus}`);
  }

  const pollIntervalMs = 4_000;
  const startedAt = Date.now();
  let lastStatus: RunStatus = initialStatus;
  let pollCount = 0;

  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    pollCount += 1;
    const polled = await getRun(agentId, runId);
    if (polled.status !== lastStatus) {
      logger.info(`status -> ${polled.status}`);
      lastStatus = polled.status;
    } else if (pollCount % 5 === 0) {
      // Heartbeat every ~20s so the user sees we're alive
      logger.info(`still ${polled.status} (${Math.round((Date.now() - startedAt) / 1000)}s elapsed)`);
    }

    if (polled.status === 'RUNNING') return;
    if (polled.status === 'FINISHED') {
      logger.warn(`Run finished before observing RUNNING — treating as verified.`);
      return;
    }
    if (
      polled.status === 'ERROR' ||
      polled.status === 'CANCELLED' ||
      polled.status === 'EXPIRED'
    ) {
      throw new Error(`Cloud agent terminated before reaching RUNNING. Status: ${polled.status}`);
    }
  }

  throw new Error(
    `Cloud agent did not reach RUNNING within ${Math.round(timeoutMs / 1000)}s. ` +
      `Last status: ${lastStatus}. Check ${runId} in Cursor Web.`,
  );
}

