/**
 * Tests for shared helpers in `tools/nfx-cowork-export/src/utils.ts`.
 *
 * Coverage focus: `workspaceIdFromPath()`. This helper used to live in two
 * separate copies (`emit.ts` and `audit-extended.ts`); slice 6 prep
 * consolidated it here. These tests pin the behavior so a future change
 * cannot silently break it for one consumer but not the other.
 *
 * Naming note: the helper is *called* workspaceIdFromPath but it returns the
 * lowest-level UUID-shaped ancestor of the session folder. In the typical
 * Cowork on-disk layout `<root>/<outer-uuid>/<inner-uuid>/local_<session>/`
 * that's the inner UUID — what Cowork sometimes calls the "space" rather
 * than the "workspace". The naming is preserved as-is from slice 5 (we
 * didn't rename in slice 6 prep — that would touch the SessionDocument
 * field name as well, which the pipeline ingester reads). These tests
 * document the actual behavior.
 */

import { describe, expect, it } from 'vitest';

import { isValidTimestamp, workspaceIdFromPath } from '../../tools/nfx-cowork-export/src/utils.js';

describe('isValidTimestamp', () => {
  it('accepts ISO 8601 UTC with millisecond precision', () => {
    expect(isValidTimestamp('2026-04-08T14:23:11.000Z')).toBe(true);
    expect(isValidTimestamp('2026-12-31T23:59:59.999Z')).toBe(true);
  });

  it('rejects non-ms-precision and non-Z timestamps', () => {
    expect(isValidTimestamp('2026-04-08T14:23:11Z')).toBe(false);
    expect(isValidTimestamp('2026-04-08T14:23:11.000+00:00')).toBe(false);
    expect(isValidTimestamp('')).toBe(false);
  });
});

describe('workspaceIdFromPath', () => {
  const OUTER_UUID = 'a169f9c6-6681-4506-b902-2240e9506824';
  const INNER_UUID = '2a85e1de-5bb8-407a-922a-5e9a4a734317';
  const SESSION_UUID = 'dbf27bc1-703a-4b60-a58b-78ab960b3c79';

  it('returns the closest UUID-shaped ancestor (the inner UUID in a 3-level layout)', () => {
    const folder = `/sessions/x/mnt/cowork/${OUTER_UUID}/${INNER_UUID}/local_${SESSION_UUID}`;
    expect(workspaceIdFromPath(folder)).toBe(INNER_UUID);
  });

  it('handles backup layouts with extra prefix segments — still returns closest UUID ancestor', () => {
    const folder = `/backups/raw-backup-20260511-124455/${OUTER_UUID}/${INNER_UUID}/local_${SESSION_UUID}`;
    expect(workspaceIdFromPath(folder)).toBe(INNER_UUID);
  });

  it('normalizes Windows backslash paths before walking ancestors', () => {
    const folder = `C:\\Users\\HassanSadiq\\Cowork\\${OUTER_UUID}\\${INNER_UUID}\\local_${SESSION_UUID}`;
    expect(workspaceIdFromPath(folder)).toBe(INNER_UUID);
  });

  it('returns the only UUID ancestor when there is just one above the session folder', () => {
    const folder = `/root/${OUTER_UUID}/local_${SESSION_UUID}`;
    expect(workspaceIdFromPath(folder)).toBe(OUTER_UUID);
  });

  it('returns null when no UUID-shaped ancestor exists above the session folder', () => {
    const folder = '/some/non-uuid/path/local_' + SESSION_UUID;
    expect(workspaceIdFromPath(folder)).toBeNull();
  });

  it('returns null on a flat session folder with no ancestors', () => {
    expect(workspaceIdFromPath('local_' + SESSION_UUID)).toBeNull();
    expect(workspaceIdFromPath('')).toBeNull();
  });

  it('skips the session-folder segment itself even if it looks like a bare UUID', () => {
    // Defensive: even if the leaf is a bare UUID rather than `local_<uuid>`,
    // we walk one level UP before matching. So the returned UUID is the
    // immediate parent, not the leaf.
    const folder = `/root/${OUTER_UUID}/${SESSION_UUID}`;
    expect(workspaceIdFromPath(folder)).toBe(OUTER_UUID);
  });

  it('is case-insensitive on the hex characters of the UUID', () => {
    const upperInner = INNER_UUID.toUpperCase();
    const folder = `/root/${OUTER_UUID}/${upperInner}/local_${SESSION_UUID}`;
    expect(workspaceIdFromPath(folder)).toBe(upperInner);
  });

  it('handles trailing slashes without confusing the ancestor walk', () => {
    const folder = `/root/${OUTER_UUID}/${INNER_UUID}/local_${SESSION_UUID}/`;
    // Trailing slash creates an empty segment, which the filter() drops, so
    // the walk lands on the same place it would without the trailing slash.
    expect(workspaceIdFromPath(folder)).toBe(INNER_UUID);
  });
});
