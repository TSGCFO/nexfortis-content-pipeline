import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { computeCliDefaults } from '../../tools/nfx-cowork-export/src/cli-defaults.js';

describe('computeCliDefaults', () => {
  it('produces an outputDir under cwd', () => {
    const d = computeCliDefaults({});
    expect(d.outputDir).toBe(path.join(process.cwd(), 'data', 'imports', 'claude-cowork'));
  });

  it('produces the three config paths in a consistent directory', () => {
    const d = computeCliDefaults({});
    const dir1 = path.dirname(d.cwdAllowlist);
    const dir2 = path.dirname(d.familyLawBlocklist);
    const dir3 = path.dirname(d.accountAllowlist);
    expect(dir1).toBe(dir2);
    expect(dir2).toBe(dir3);
    expect(path.basename(d.cwdAllowlist)).toBe('cwd-allowlist.json');
    expect(path.basename(d.familyLawBlocklist)).toBe('family-law-slugs.json');
    expect(path.basename(d.accountAllowlist)).toBe('account-allowlist.json');
  });

  it('config dir on Linux/macOS uses ~/.config/nfx-cowork-export/', () => {
    // process.platform is set to whatever the test runner is — on the CI image
    // here it's linux. We only assert the path SHAPE on non-windows.
    if (process.platform === 'win32') return;
    const d = computeCliDefaults({});
    const expectedDir = path.join(os.homedir(), '.config', 'nfx-cowork-export');
    expect(path.dirname(d.cwdAllowlist)).toBe(expectedDir);
  });

  it('inputRoot is null on Linux (no canonical local-agent-mode-sessions location)', () => {
    if (process.platform === 'win32' || process.platform === 'darwin') return;
    const d = computeCliDefaults({});
    expect(d.inputRoot).toBeNull();
  });
});
