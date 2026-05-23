#!/usr/bin/env node
/**
 * `nfx-cowork-export` CLI entry point.
 *
 * Slice 5 wires up the full pipeline:
 *
 *   nfx-cowork-export [flags]
 *
 *   --input <dir>                     OS-specific default (Windows / macOS)
 *   --output <dir>                    default: ./data/imports/claude-cowork
 *   --cwd-allowlist <path>            default: ~/.config/nfx-cowork-export/cwd-allowlist.json
 *                                      (or %APPDATA%\nfx-cowork-export\ on Windows)
 *   --family-law-blocklist <path>     default: same dir, family-law-slugs.json
 *   --dry-run                         parse + filter + redact + validate, write nothing
 *   --verbose                         (reserved for slice 6; currently a no-op)
 *   --validate-output <path>          standalone validator mode: validate the given JSON
 *                                     file against the v1 schema and exit with the result
 *
 * Exit codes:
 *   0  — success
 *   1  — unhandled error
 *   2  — missing config file (fail-closed)
 *   3  — invalid config file (parse / schema)
 *   4  — validation failure on emitted documents (one or more)
 *   5  — `--validate-output` reported invalid
 */

import os from 'node:os';
import { promises as fs } from 'node:fs';
import { Command } from 'commander';

import {
  loadExporterConfig,
  ConfigMissingError,
  ConfigInvalidError,
} from './config.js';
import { runExport } from './run-export.js';
import { computeCliDefaults } from './cli-defaults.js';
import { validateSession } from './validator.js';

const defaults = computeCliDefaults();

const program = new Command();

program
  .name('nfx-cowork-export')
  .description('Local CLI that reads Cowork on-disk session data and emits normalized JSON for the NexFortis content pipeline ingester.')
  .version('0.0.6');

// The "validate-output" mode is a standalone validator — no other flags
// participate. Implemented as an explicit option, not a subcommand, to keep
// the CLI surface flat.
program
  .option('--validate-output <path>', 'Standalone mode: validate an existing emitted JSON file against the v1 schema and exit')
  .option('--input <dir>', 'Cowork data root to scan', defaults.inputRoot ?? undefined)
  .option('--output <dir>', 'Output directory for emitted JSON', defaults.outputDir)
  .option('--cwd-allowlist <path>', 'Path to cwd-allowlist.json', defaults.cwdAllowlist)
  .option('--family-law-blocklist <path>', 'Path to family-law-slugs.json', defaults.familyLawBlocklist)
  .option('--dry-run', 'Parse + filter + redact + validate; write no files. Audit goes to stdout only.', false)
  .option('--verbose', '[reserved — slice 6]', false);

program.action(async (opts: {
  validateOutput?: string;
  input?: string;
  output: string;
  cwdAllowlist: string;
  familyLawBlocklist: string;
  dryRun: boolean;
  verbose: boolean;
}) => {
  // Standalone validator mode
  if (opts.validateOutput !== undefined) {
    await runValidateOutput(opts.validateOutput);
    return;
  }

  // Normal export run — input is required (may have a platform default)
  if (opts.input === undefined || opts.input.length === 0) {
    process.stderr.write(
      'error: --input <dir> is required on this platform (no OS-specific default available)' + os.EOL
    );
    process.exit(1);
  }

  try {
    const config = await loadExporterConfig({
      cwdAllowlistPath: opts.cwdAllowlist,
      familyLawSlugsPath: opts.familyLawBlocklist,
    });

    const result = await runExport({
      inputRoot: opts.input,
      outputDir: opts.output,
      config,
      dryRun: opts.dryRun,
      verbose: opts.verbose,
    });

    process.stdout.write(result.auditText);
    process.stdout.write(os.EOL);

    if (result.auditSidecarPath !== null) {
      process.stdout.write(`Audit sidecar: ${result.auditSidecarPath}${os.EOL}`);
    }

    // Exit code 4 when any emitted document failed validation. The files
    // weren't written (validation gates writing), but the operator needs
    // to know.
    if (result.emitResult.validationFailures.length > 0) {
      process.stderr.write(
        `error: ${result.emitResult.validationFailures.length} document(s) failed schema validation. See audit for paths.${os.EOL}`
      );
      process.exit(4);
    }
  } catch (err) {
    if (err instanceof ConfigMissingError) {
      process.stderr.write(`${err.message}${os.EOL}`);
      process.exit(2);
    }
    if (err instanceof ConfigInvalidError) {
      process.stderr.write(`${err.message}${os.EOL}`);
      process.exit(3);
    }
    process.stderr.write(`Unhandled error: ${(err as Error).message}${os.EOL}`);
    process.exit(1);
  }
});

async function runValidateOutput(filePath: string): Promise<void> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    process.stderr.write(`error: cannot read ${filePath}: ${(err as Error).message}${os.EOL}`);
    process.exit(1);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    process.stderr.write(`error: invalid JSON in ${filePath}: ${(err as Error).message}${os.EOL}`);
    process.exit(5);
  }
  const result = validateSession(parsed);
  if (result.ok) {
    process.stdout.write(`OK: ${filePath} validates against schema v1.${os.EOL}`);
    process.stdout.write(`     sessionId: ${result.document.sessionId}${os.EOL}`);
    process.stdout.write(`     events:    ${result.document.events.length}${os.EOL}`);
    process.exit(0);
  } else {
    process.stderr.write(`INVALID: ${filePath} failed schema validation:${os.EOL}`);
    for (const issue of result.errors) {
      process.stderr.write(`  - ${issue.path || '<root>'}: ${issue.message} [${issue.code}]${os.EOL}`);
    }
    process.exit(5);
  }
}

program.parseAsync(process.argv);
