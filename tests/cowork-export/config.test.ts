import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ConfigInvalidError,
  ConfigMissingError,
  loadExporterConfig,
} from '../../tools/nfx-cowork-export/src/config.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'nfx-config-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function write(file: string, body: unknown): Promise<string> {
  const p = path.join(tmp, file);
  await fs.writeFile(p, typeof body === 'string' ? body : JSON.stringify(body), 'utf8');
  return p;
}

describe('loadExporterConfig — happy path', () => {
  it('loads valid config from three files', async () => {
    const cwdPath = await write('cwd.json', {
      alwaysAllow: ['/sessions/'],
      allowPrefixes: ['C:\\Users\\HassanSadiq\\Projects\\'],
      alwaysDeny: ['C:\\Users\\HassanSadiq\\AppData\\Roaming\\Claude\\'],
    });
    const slugsPath = await write('slugs.json', {
      slugs: ['synthetic-blocked-slug'],
    });
    const acctPath = await write('accounts.json', {
      accounts: ['hassan@example.test'],
    });

    const cfg = await loadExporterConfig({
      cwdAllowlistPath: cwdPath,
      familyLawSlugsPath: slugsPath,
      accountAllowlistPath: acctPath,
    });

    expect(cfg.cwdAllowlist.alwaysAllow).toEqual(['/sessions/']);
    expect(cfg.cwdAllowlist.allowPrefixes).toEqual(['C:\\Users\\HassanSadiq\\Projects\\']);
    expect(cfg.cwdAllowlist.alwaysDeny).toEqual(['C:\\Users\\HassanSadiq\\AppData\\Roaming\\Claude\\']);
    expect(cfg.familyLawSlugs).toEqual(['synthetic-blocked-slug']);
    expect(cfg.accountAllowlist).toEqual(['hassan@example.test']);
  });

  it('tolerates documentation keys like _comment in config files', async () => {
    const cwdPath = await write('cwd.json', {
      _comment: 'documentation',
      _three_buckets: { alwaysAllow: '...', allowPrefixes: '...', alwaysDeny: '...' },
      alwaysAllow: [],
      allowPrefixes: [],
      alwaysDeny: [],
    });
    const slugsPath = await write('slugs.json', { _comment: 'docs', slugs: [] });
    const acctPath = await write('accounts.json', { _comment: 'docs', accounts: [] });

    const cfg = await loadExporterConfig({
      cwdAllowlistPath: cwdPath,
      familyLawSlugsPath: slugsPath,
      accountAllowlistPath: acctPath,
    });

    expect(cfg.familyLawSlugs).toEqual([]);
  });
});

describe('loadExporterConfig — fail-closed on missing files', () => {
  it('throws ConfigMissingError when cwd allowlist file does not exist', async () => {
    const slugsPath = await write('slugs.json', { slugs: [] });
    const acctPath = await write('accounts.json', { accounts: [] });

    await expect(
      loadExporterConfig({
        cwdAllowlistPath: path.join(tmp, 'does-not-exist.json'),
        familyLawSlugsPath: slugsPath,
        accountAllowlistPath: acctPath,
      })
    ).rejects.toBeInstanceOf(ConfigMissingError);
  });

  it('throws ConfigMissingError when family-law slugs file does not exist', async () => {
    const cwdPath = await write('cwd.json', { alwaysAllow: [], allowPrefixes: [], alwaysDeny: [] });
    const acctPath = await write('accounts.json', { accounts: [] });

    await expect(
      loadExporterConfig({
        cwdAllowlistPath: cwdPath,
        familyLawSlugsPath: path.join(tmp, 'does-not-exist.json'),
        accountAllowlistPath: acctPath,
      })
    ).rejects.toBeInstanceOf(ConfigMissingError);
  });

  it('throws ConfigMissingError when account allowlist file does not exist', async () => {
    const cwdPath = await write('cwd.json', { alwaysAllow: [], allowPrefixes: [], alwaysDeny: [] });
    const slugsPath = await write('slugs.json', { slugs: [] });

    await expect(
      loadExporterConfig({
        cwdAllowlistPath: cwdPath,
        familyLawSlugsPath: slugsPath,
        accountAllowlistPath: path.join(tmp, 'does-not-exist.json'),
      })
    ).rejects.toBeInstanceOf(ConfigMissingError);
  });

  it('ConfigMissingError carries the missing path and config kind', async () => {
    const slugsPath = await write('slugs.json', { slugs: [] });
    const acctPath = await write('accounts.json', { accounts: [] });
    const missingPath = path.join(tmp, 'definitely-not-here.json');

    try {
      await loadExporterConfig({
        cwdAllowlistPath: missingPath,
        familyLawSlugsPath: slugsPath,
        accountAllowlistPath: acctPath,
      });
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigMissingError);
      if (err instanceof ConfigMissingError) {
        expect(err.path).toBe(missingPath);
        expect(err.configKind).toBe('cwd-allowlist');
        expect(err.message).toContain('fail-closed by design');
      }
    }
  });
});

describe('loadExporterConfig — fail-closed on invalid files', () => {
  it('throws ConfigInvalidError on malformed JSON', async () => {
    const cwdPath = await write('cwd.json', '{ not json }');
    const slugsPath = await write('slugs.json', { slugs: [] });
    const acctPath = await write('accounts.json', { accounts: [] });

    await expect(
      loadExporterConfig({
        cwdAllowlistPath: cwdPath,
        familyLawSlugsPath: slugsPath,
        accountAllowlistPath: acctPath,
      })
    ).rejects.toBeInstanceOf(ConfigInvalidError);
  });

  it('throws ConfigInvalidError when cwd-allowlist is missing required keys', async () => {
    const cwdPath = await write('cwd.json', { alwaysAllow: [] /* missing allowPrefixes & alwaysDeny */ });
    const slugsPath = await write('slugs.json', { slugs: [] });
    const acctPath = await write('accounts.json', { accounts: [] });

    await expect(
      loadExporterConfig({
        cwdAllowlistPath: cwdPath,
        familyLawSlugsPath: slugsPath,
        accountAllowlistPath: acctPath,
      })
    ).rejects.toBeInstanceOf(ConfigInvalidError);
  });

  it('throws ConfigInvalidError when accounts is not a string array', async () => {
    const cwdPath = await write('cwd.json', { alwaysAllow: [], allowPrefixes: [], alwaysDeny: [] });
    const slugsPath = await write('slugs.json', { slugs: [] });
    const acctPath = await write('accounts.json', { accounts: [123, 456] });

    await expect(
      loadExporterConfig({
        cwdAllowlistPath: cwdPath,
        familyLawSlugsPath: slugsPath,
        accountAllowlistPath: acctPath,
      })
    ).rejects.toBeInstanceOf(ConfigInvalidError);
  });
});
