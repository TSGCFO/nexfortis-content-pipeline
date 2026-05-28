#!/usr/bin/env node
/**
 * CLI for the NexFortis Cursor cloud-agent launcher.
 *
 * Usage:
 *   nfx-cursor-launch --prompt-file ./prompt.md
 *   nfx-cursor-launch --prompt-file ./prompt.md --wait
 *   echo "Refactor the foo module" | nfx-cursor-launch --stdin
 *
 * Exit codes:
 *   0  — agent launched and verified RUNNING (or finished cleanly with --wait)
 *   1  — usage error (bad flags, missing prompt, missing API key)
 *   2  — agent launched but failed to reach RUNNING (timeout or terminal error)
 *   3  — with --wait, run terminated with status `error` or `cancelled`
 */

import { readFile } from 'node:fs/promises';

import { Command } from 'commander';

import { launchCursorAgent } from './launch.js';

interface CliOptions {
  promptFile?: string;
  stdin?: boolean;
  wait?: boolean;
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

async function main(): Promise<void> {
  const program = new Command();
  program
    .name('nfx-cursor-launch')
    .description(
      'Launch a Cursor cloud agent on TSGCFO/nexfortis-content-pipeline ' +
        'with Claude Opus 4.8. The prompt is the only thing that changes per run.',
    )
    .option('--prompt-file <path>', 'read prompt text from a file')
    .option('--stdin', 'read prompt text from stdin')
    .option(
      '--wait',
      'block until the run terminates (status finished/error/cancelled). ' +
        'Default: exit as soon as the cloud agent reaches RUNNING.',
    )
    .parse(process.argv);

  const opts = program.opts<CliOptions>();

  let prompt: string;
  try {
    prompt = await readPrompt(opts);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  try {
    const result = await launchCursorAgent({
      prompt,
      mode: opts.wait ? 'wait-for-completion' : 'verify-started',
    });

    // Emit a final JSON line on stdout so callers (CI, scripts) can parse it.
    // All human-readable logs go to stderr via the logger.
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
    // Distinguish usage vs runtime failures by inspecting the error message
    if (msg.includes('Missing required env var') || msg.includes('non-empty string')) {
      process.exit(1);
    }
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(`Unexpected error: ${err instanceof Error ? err.stack ?? err.message : err}`);
  process.exit(2);
});
