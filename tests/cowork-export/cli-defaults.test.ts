import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { computeCliDefaults, userConfigDir } from '../../tools/nfx-cowork-export/src/cli-defaults.js';

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

describe('userConfigDir env parameterization', () => {
  // The env parameter is wired through computeCliDefaults so unit tests can
  // exercise the Windows APPDATA branch with a controlled environment without
  // mutating real process.env. On Windows hosts the assertions below check
  // env propagation directly; on non-Windows hosts userConfigDir ignores env
  // (uses ~/.config/...), so we instead assert the function is callable with
  // an arbitrary env and produces a stable path.
  it('accepts an env parameter without erroring (signature regression guard)', () => {
    expect(() => userConfigDir({})).not.toThrow();
    expect(() => userConfigDir({ APPDATA: '/some/fake/path' })).not.toThrow();
  });

  it('on non-Windows, env is unused — passing different envs yields the same path', () => {
    if (process.platform === 'win32') return;
    const a = userConfigDir({});
    const b = userConfigDir({ APPDATA: 'C:\\Users\\Foo\\AppData\\Roaming' });
    const c = userConfigDir({ HOME: '/tmp/elsewhere' });
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('on Windows hosts, the APPDATA env override is honored', () => {
    if (process.platform !== 'win32') return;
    const d = userConfigDir({ APPDATA: 'C:\\Custom\\Roaming' });
    expect(d).toBe(path.join('C:\\Custom\\Roaming', 'nfx-cowork-export'));
  });

  it('computeCliDefaults(env) propagates env to userConfigDir', () => {
    // Smoke test: changing env should change the config paths IF and only IF
    // we are on Windows. On non-Windows the env is ignored — assert nothing
    // breaks under either configuration.
    const a = computeCliDefaults({});
    const b = computeCliDefaults({ APPDATA: 'C:\\Fake\\Roaming' });
    if (process.platform === 'win32') {
      // On Windows: APPDATA-controlled paths should differ.
      expect(a.cwdAllowlist).not.toBe(b.cwdAllowlist);
    } else {
      // On non-Windows: paths are identical because env is unused.
      expect(a.cwdAllowlist).toBe(b.cwdAllowlist);
    }
  });
});
