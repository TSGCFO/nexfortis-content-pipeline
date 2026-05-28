#!/usr/bin/env node
/**
 * CLI for the NexFortis Cursor cloud-agent launcher.
 *
 * Common flows:
 *
 *   # Fresh launch from main with default model (latest Opus, thinking=high):
 *   nfx-cursor-launch --prompt-file ./next-prompt.md
 *
 *   # Fixup prompt on existing PR — auto pushes to that PR's branch:
 *   nfx-cursor-launch --prompt-file ./fixup.md --pr-url https://github.com/TSGCFO/nexfortis-content-pipeline/pull/42
 *
 *   # Override model + params:
 *   nfx-cursor-launch --prompt-file ./p.md --model claude-opus-4-7 --model-param thinking=high
 *
 *   # With session env vars (beta):
 *   nfx-cursor-launch --prompt-file ./p.md --env STAGING_TOKEN=abc --env DB_URL=xxx
 *
 *   # With inline MCP servers from a JSON file:
 *   nfx-cursor-launch --prompt-file ./p.md --mcp ./mcp-servers.json
 *
 * Exit codes:
 *   0  — agent launched and verified RUNNING (or finished cleanly with --wait)
 *   1  — usage error (bad flags, missing prompt, missing API key, bad config)
 *   2  — agent launched but failed to reach RUNNING (timeout or terminal error)
 *   3  — with --wait, run terminated with status `error` or `cancelled`
 */

import { readFile } from 'node:fs/promises';

import type { McpServerConfig } from '@cursor/sdk';
import { Command, Option } from 'commander';

import { launchCursorAgent } from './launch.js';

interface CliOptions {
  promptFile?: string;
  stdin?: boolean;
  wait?: boolean;
  model?: string;
  modelParam?: string[];
  prUrl?: string;
  env?: string[];
  mcp?: string;
  name?: string;
  plan?: boolean;
}

async function readPrompt(opts: CliOptions): Promise<string> {
  if (opts.promptFile && opts.stdin) {
    throw new Error('Pass either --prompt-file or --stdin, not both');
  }
  if (opts.promptFile) {
    const text = await readFile(opts.promptFile, 'utf8');
    if (!text.trim()) throw new Error(`Prompt file is empty: ${opts.promptFile}`);
    return text;
  }
  if (opts.stdin) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    if (!text.trim()) throw new Error('No prompt received on stdin');
    return text;
  }
  throw new Error('Provide a prompt via --prompt-file <path> or --stdin');
}

function parseKeyValuePairs(
  pairs: string[],
  flagName: string,
): Array<{ id: string; value: string }> {
  return pairs.map((pair) => {
    const eq = pair.indexOf('=');
    if (eq < 1) {
      throw new Error(`Bad ${flagName} value '${pair}'. Expected key=value.`);
    }
    const id = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1);
    if (!id) throw new Error(`Empty key in ${flagName} value '${pair}'.`);
    return { id, value };
  });
}

function parseEnvVars(pairs: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    if (eq < 1) {
      throw new Error(`Bad --env value '${pair}'. Expected KEY=value.`);
    }
    const key = pair.slice(0, eq).trim();
    const val = pair.slice(eq + 1);
    if (!key) throw new Error(`Empty key in --env value '${pair}'.`);
    if (key.startsWith('CURSOR_')) {
      throw new Error(
        `--env keys cannot start with 'CURSOR_' (Cursor reserves that namespace). Got: ${key}`,
      );
    }
    out[key] = val;
  }
  return out;
}

async function loadMcpFile(path: string): Promise<Record<string, McpServerConfig>> {
  const text = await readFile(path, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`--mcp file is not valid JSON (${path}): ${err instanceof Error ? err.message : err}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    const kind = Array.isArray(parsed) ? 'array' : parsed === null ? 'null' : typeof parsed;
    throw new Error(
      `--mcp file must contain a JSON object mapping server-name -> config. Got: ${kind}`,
    );
  }
  // Trust the shape; Cursor will validate it and surface a ConfigurationError
  // if it's wrong. We deliberately don't reimplement Cursor's MCP schema here.
  return parsed as Record<string, McpServerConfig>;
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name('nfx-cursor-launch')
    .description(
      'Launch a Cursor cloud agent on TSGCFO/nexfortis-content-pipeline. ' +
        'Defaults to the latest Opus model from a hardcoded preference list, ' +
        'starts from main, auto-creates a PR. ' +
        'Pass --pr-url to attach to an existing PR for fixup prompts.',
    )
    .option('--prompt-file <path>', 'read prompt text from a file')
    .option('--stdin', 'read prompt text from stdin')
    .option(
      '--wait',
      'block until the run terminates. Default: exit as soon as the cloud agent reaches RUNNING.',
    )
    .option(
      '--model <id>',
      'override the model. Default: first available from the hardcoded preference list (latest Opus).',
    )
    .option(
      '--model-param <id=value>',
      'add a model parameter (e.g. thinking=high). Can be passed multiple times.',
      (value: string, prev: string[]) => [...(prev ?? []), value],
      [] as string[],
    )
    .option(
      '--pr-url <url>',
      'attach to an existing GitHub PR. Auto-enables workOnCurrentBranch so commits push to that PR.',
    )
    .option(
      '--env <KEY=value>',
      'inject a session-scoped env var into the cloud agent VM. Can be passed multiple times. (Beta feature in Cursor.)',
      (value: string, prev: string[]) => [...(prev ?? []), value],
      [] as string[],
    )
    .option(
      '--mcp <file>',
      'path to a JSON file with inline MCP server definitions (object of name -> config).',
    )
    .option('--name <text>', 'set the human-readable label that shows in Cursor Web.')
    .addOption(new Option('--plan', 'start the agent in plan mode (research before coding).'))
    .parse(process.argv);

  const opts = program.opts<CliOptions>();

  let prompt: string;
  try {
    prompt = await readPrompt(opts);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  let modelParams: Array<{ id: string; value: string }> | undefined;
  let envVars: Record<string, string> | undefined;
  let mcpServers: Record<string, McpServerConfig> | undefined;
  try {
    if (opts.modelParam && opts.modelParam.length > 0) {
      modelParams = parseKeyValuePairs(opts.modelParam, '--model-param');
    }
    if (opts.env && opts.env.length > 0) {
      envVars = parseEnvVars(opts.env);
    }
    if (opts.mcp) {
      mcpServers = await loadMcpFile(opts.mcp);
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  try {
    const launchOptions: Parameters<typeof launchCursorAgent>[0] = {
      prompt,
      mode: opts.wait ? 'wait-for-completion' : 'verify-started',
    };
    if (opts.model) launchOptions.modelId = opts.model;
    if (modelParams) launchOptions.modelParams = modelParams;
    if (opts.prUrl) launchOptions.prUrl = opts.prUrl;
    if (envVars) launchOptions.envVars = envVars;
    if (mcpServers) launchOptions.mcpServers = mcpServers;
    if (opts.name) launchOptions.name = opts.name;
    if (opts.plan) launchOptions.conversationMode = 'plan';

    const result = await launchCursorAgent(launchOptions);

    // Emit a final JSON line on stdout so callers (CI, scripts) can parse it.
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');

    if (opts.wait) {
      if (result.finalStatus === 'finished') process.exit(0);
      else process.exit(3);
    } else {
      if (result.verifiedRunning) process.exit(0);
      else process.exit(2);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Launch failed: ${msg}`);
    if (
      msg.includes('Missing required env var') ||
      msg.includes('non-empty string') ||
      msg.includes('--env') ||
      msg.includes('--model-param') ||
      msg.includes('--mcp')
    ) {
      process.exit(1);
    }
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(`Unexpected error: ${err instanceof Error ? err.stack ?? err.message : err}`);
  process.exit(2);
});
