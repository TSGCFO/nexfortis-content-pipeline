/**
 * OS-specific defaults for the four config-path flags + the input dir.
 *
 * Hassan runs the tool on Windows; CI runs it on Linux. The defaults are
 * resolved so a "no flags" invocation does the right thing on Hassan's
 * laptop while staying overridable on other platforms.
 *
 * Defaults table:
 *
 *   --input
 *     Windows: %APPDATA%\Claude\local-agent-mode-sessions
 *     macOS:   ~/Library/Application Support/Claude/local-agent-mode-sessions
 *     Linux:   no default — must be supplied
 *
 *   --output
 *     All:     ./data/imports/claude-cowork
 *
 *   --cwd-allowlist / --family-law-blocklist / --account-allowlist
 *     Windows: %APPDATA%\nfx-cowork-export\<filename>.json
 *     other:   ~/.config/nfx-cowork-export/<filename>.json
 *
 * The "fail-closed" config-file rule (slice 2) still applies — if the default
 * path doesn't exist on disk, the loader still throws ConfigMissingError. The
 * defaults exist so Hassan doesn't have to remember the full paths, not to
 * loosen the safety posture.
 */

import os from 'node:os';
import path from 'node:path';

type Platform = 'windows' | 'macos' | 'linux';

function detectPlatform(): Platform {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'macos';
  return 'linux';
}

function userConfigDir(): string {
  if (detectPlatform() === 'windows') {
    const appdata = process.env['APPDATA'];
    if (appdata !== undefined && appdata.length > 0) {
      return path.join(appdata, 'nfx-cowork-export');
    }
    // Fallback when APPDATA is not set (rare on Windows, common in sandboxes)
    return path.join(os.homedir(), 'AppData', 'Roaming', 'nfx-cowork-export');
  }
  return path.join(os.homedir(), '.config', 'nfx-cowork-export');
}

export interface CliDefaults {
  /** Absolute default for --input on this platform, or null if no sensible default. */
  inputRoot: string | null;
  outputDir: string;
  cwdAllowlist: string;
  familyLawBlocklist: string;
  accountAllowlist: string;
}

export function computeCliDefaults(env: NodeJS.ProcessEnv = process.env): CliDefaults {
  const platform = detectPlatform();
  const userConf = userConfigDir();

  let inputRoot: string | null;
  if (platform === 'windows') {
    const appdata = env['APPDATA'];
    if (appdata !== undefined && appdata.length > 0) {
      inputRoot = path.join(appdata, 'Claude', 'local-agent-mode-sessions');
    } else {
      inputRoot = path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'local-agent-mode-sessions');
    }
  } else if (platform === 'macos') {
    inputRoot = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'local-agent-mode-sessions');
  } else {
    inputRoot = null;
  }

  return {
    inputRoot,
    outputDir: path.join(process.cwd(), 'data', 'imports', 'claude-cowork'),
    cwdAllowlist: path.join(userConf, 'cwd-allowlist.json'),
    familyLawBlocklist: path.join(userConf, 'family-law-slugs.json'),
    accountAllowlist: path.join(userConf, 'account-allowlist.json'),
  };
}
