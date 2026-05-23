/**
 * Regression test: the runtime version constants in the source code must
 * stay in sync with `tools/nfx-cowork-export/package.json`.
 *
 * Slice 6 caught a real bug where `package.json` was bumped to 0.0.6 for
 * the release, but two hardcoded constants in the source still said 0.0.5:
 *
 *   - `src/cli.ts:49` — drives the CLI `--version` output
 *   - `src/emit.ts:43` — EXPORTER_VERSION baked into every emitted JSON's
 *     `_exporter.version` field
 *
 * Hassan caught it during his production end-to-end run when the audit
 * said the binary was 0.0.6 but the emitted files reported 0.0.5.
 *
 * This test reads package.json directly and asserts the constants match,
 * so the next version bump can't repeat the same mistake.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { EXPORTER_VERSION } from '../../tools/nfx-cowork-export/src/emit.js';

// Resolve the package.json path relative to THIS test file so it works in
// both vitest's normal run and in any future runner setup.
const here = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(
  here,
  '../../tools/nfx-cowork-export/package.json',
);

interface MinimalPackageJson {
  version: string;
}

const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as MinimalPackageJson;

describe('version constants match package.json', () => {
  it('package.json carries a non-empty version string', () => {
    expect(pkg.version).toBeTruthy();
    expect(typeof pkg.version).toBe('string');
  });

  it('EXPORTER_VERSION in src/emit.ts equals package.json version (baked into every emitted JSON)', () => {
    expect(EXPORTER_VERSION).toBe(pkg.version);
  });

  it('cli.ts .version() string equals package.json version (used by --version flag)', () => {
    // Read cli.ts and look for the literal .version('...') call.
    const cliPath = path.resolve(here, '../../tools/nfx-cowork-export/src/cli.ts');
    const cliSrc = readFileSync(cliPath, 'utf8');
    const match = cliSrc.match(/\.version\(\s*'([^']+)'\s*\)/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe(pkg.version);
  });
});
