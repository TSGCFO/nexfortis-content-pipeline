#!/usr/bin/env node
/**
 * `nfx-cowork-export` CLI entry point.
 *
 * Slice 2 supports a SUBSET of the flags listed in the locked spec:
 *   --input <dir>                     required
 *   --cwd-allowlist <path>            required (no default in slice 2; slice 5 adds OS-specific defaults)
 *   --family-law-blocklist <path>     required
 *   --account-allowlist <path>        required
 *   --dry-run                         (implicit in slice 2; no other modes ship yet)
 *
 * Slices 3-5 add:
 *   --output, --verbose, --validate-output, and the OS-specific defaults
 *   that let Hassan run the tool without any flags on his Windows laptop.
 */

import os from 'node:os';
import { Command } from 'commander';

import { loadExporterConfig, ConfigMissingError, ConfigInvalidError } from './config.js';
import { runDiscovery } from './run-discovery.js';
import { renderAuditReport } from './audit.js';

const program = new Command();

program
  .name('nfx-cowork-export')
  .description('Local CLI that reads Cowork on-disk session data and emits normalized JSON for the NexFortis content pipeline ingester.')
  .version('0.0.2')
  .requiredOption('--input <dir>', 'Cowork data root to scan (e.g. %APPDATA%\\Claude\\local-agent-mode-sessions on Windows)')
  .requiredOption('--cwd-allowlist <path>', 'Path to cwd-allowlist.json (see cwd-allowlist.example.json)')
  .requiredOption('--family-law-blocklist <path>', 'Path to family-law-slugs.json (see family-law-slugs.example.json)')
  .requiredOption('--account-allowlist <path>', 'Path to account-allowlist.json (see account-allowlist.example.json)')
  .option('--dry-run', 'In slice 2 this flag is implicit; reserved for slice 5+', false);

program.action(async (opts: {
  input: string;
  cwdAllowlist: string;
  familyLawBlocklist: string;
  accountAllowlist: string;
  dryRun: boolean;
}) => {
  try {
    const config = await loadExporterConfig({
      cwdAllowlistPath: opts.cwdAllowlist,
      familyLawSlugsPath: opts.familyLawBlocklist,
      accountAllowlistPath: opts.accountAllowlist,
    });

    const result = await runDiscovery({
      inputRoot: opts.input,
      config,
    });

    process.stdout.write(renderAuditReport(result.rows, result.summary));
    process.stdout.write(os.EOL);
    process.stdout.write(`(slice 2: discovery + session-level filter only — no JSON emitted)${os.EOL}`);
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

program.parseAsync(process.argv);
