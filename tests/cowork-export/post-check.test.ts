import { describe, expect, it } from 'vitest';

import { postCheckSession, MIN_EVENTS } from '../../tools/nfx-cowork-export/src/post-check.js';
import type { Event } from '../../tools/nfx-cowork-export/src/schema.js';
import type { ExporterConfig } from '../../tools/nfx-cowork-export/src/types.js';

const CONFIG_DEFAULT: ExporterConfig = {
  cwdAllowlist: {
    alwaysAllow: ['/sessions/'],
    allowPrefixes: ['C:\\Users\\HassanSadiq\\Projects\\'],
    alwaysDeny: ['C:\\Users\\HassanSadiq\\AppData\\Roaming\\Claude\\'],
  },
  familyLawSlugs: [],
};

const TEXT_500 = 'x'.repeat(500);

function userText(text: string, cwd?: string): Event {
  return {
    kind: 'user_text',
    ts: '2026-04-08T14:23:11.000Z',
    uuid: `u-${Math.random().toString(36).slice(2)}`,
    text,
    ...(cwd !== undefined ? { cwd } : {}),
  };
}

function asstText(text: string, cwd?: string): Event {
  return {
    kind: 'assistant_text',
    ts: '2026-04-08T14:23:11.000Z',
    uuid: `a-${Math.random().toString(36).slice(2)}`,
    text,
    ...(cwd !== undefined ? { cwd } : {}),
  };
}

function toolCall(tool: string, cwd?: string): Event {
  return {
    kind: 'tool_call',
    ts: '2026-04-08T14:23:11.000Z',
    uuid: `t-${Math.random().toString(36).slice(2)}`,
    tool,
    ...(cwd !== undefined ? { cwd } : {}),
  };
}

describe('postCheckSession — tiny-session check', () => {
  it('drops a session with fewer than MIN_EVENTS events', () => {
    const events = [userText('a'.repeat(1000), '/sessions/x'), asstText('b'.repeat(1000), '/sessions/x')];
    expect(events.length).toBeLessThan(MIN_EVENTS);
    const r = postCheckSession(events, CONFIG_DEFAULT);
    expect(r.keep).toBe(false);
    if (!r.keep) expect(r.reason).toBe('tiny_session');
  });

  it('drops a session with fewer than MIN_TEXT_CHARS total chars', () => {
    const events = [
      userText('a', '/sessions/x'),
      asstText('b', '/sessions/x'),
      toolCall('Bash', '/sessions/x'),
      toolCall('Bash', '/sessions/x'),
    ];
    expect(events.length).toBeGreaterThanOrEqual(MIN_EVENTS);
    const r = postCheckSession(events, CONFIG_DEFAULT);
    expect(r.keep).toBe(false);
    if (!r.keep) expect(r.reason).toBe('tiny_session');
  });

  it('keeps a session that meets both thresholds', () => {
    const events = [
      userText(TEXT_500, '/sessions/x'),
      asstText('reply', '/sessions/x'),
      toolCall('Bash', '/sessions/x'),
    ];
    const r = postCheckSession(events, CONFIG_DEFAULT);
    expect(r.keep).toBe(true);
  });

  it('counts tool_call events toward event count but not text chars', () => {
    // 3 events total, but only 2 text events combining to 100 chars
    const events = [
      userText('x'.repeat(50), '/sessions/x'),
      asstText('x'.repeat(50), '/sessions/x'),
      toolCall('Bash', '/sessions/x'),
    ];
    const r = postCheckSession(events, CONFIG_DEFAULT);
    expect(r.keep).toBe(false);
    if (!r.keep) {
      expect(r.reason).toBe('tiny_session');
      expect(r.stats.eventCount).toBe(3);
      expect(r.stats.totalTextChars).toBe(100); // not 200, tool_call doesn't count
    }
  });
});

describe('postCheckSession — cwd majority check', () => {
  it('drops when <80% of text chars are in allowed cwds', () => {
    // 100 chars in allowed, 500 chars denied → 100/600 = ~16.7%
    const events = [
      userText('x'.repeat(100), '/sessions/allowed-slug'),
      asstText('x'.repeat(500), 'C:\\Users\\HassanSadiq\\OtherProject'),
      toolCall('Bash'), // ignored
    ];
    const r = postCheckSession(events, CONFIG_DEFAULT);
    expect(r.keep).toBe(false);
    if (!r.keep) expect(r.reason).toBe('cwd_majority_outside_allowlist');
  });

  it('keeps when ≥80% of text chars are in allowed cwds', () => {
    // 800 in allowed, 100 denied → 800/900 = 88.9%
    const events = [
      userText('x'.repeat(800), '/sessions/allowed-slug'),
      asstText('x'.repeat(100), 'C:\\elsewhere'),
      asstText('x'.repeat(100), '/sessions/allowed-slug'),
    ];
    const r = postCheckSession(events, CONFIG_DEFAULT);
    expect(r.keep).toBe(true);
  });

  it('keeps when 100% of text chars are in allowed cwds', () => {
    const events = [
      userText('x'.repeat(1000), '/sessions/allowed-slug'),
      asstText('x'.repeat(500), 'C:\\Users\\HassanSadiq\\Projects\\nexfortis'),
      asstText('x'.repeat(100), '/sessions/allowed-slug'),
    ];
    const r = postCheckSession(events, CONFIG_DEFAULT);
    expect(r.keep).toBe(true);
    if (r.keep) {
      expect(r.stats.cwdAllowedRatio).toBe(1);
      expect(r.stats.deniedTextChars).toBe(0);
    }
  });

  it('treats events with no cwd as neither allowed nor denied (excluded from ratio)', () => {
    // 600 chars with no cwd, plus 600 chars in allowed cwd
    const events = [
      userText('x'.repeat(600)), // no cwd
      asstText('x'.repeat(600), '/sessions/x'),
      asstText('x'.repeat(100), '/sessions/x'),
    ];
    const r = postCheckSession(events, CONFIG_DEFAULT);
    expect(r.keep).toBe(true);
    if (r.keep) {
      expect(r.stats.noCwdTextChars).toBe(600);
      // 600 (asstText in /sessions/x) + 100 (third asstText in /sessions/x)
      expect(r.stats.allowedTextChars).toBe(700);
      expect(r.stats.cwdAllowedRatio).toBe(1);
    }
  });

  it('keeps the session when NO text events have a cwd (trust the session-level pre-check)', () => {
    const events = [
      userText('x'.repeat(300)),
      asstText('x'.repeat(300)),
      asstText('x'.repeat(300)),
    ];
    const r = postCheckSession(events, CONFIG_DEFAULT);
    expect(r.keep).toBe(true);
    if (r.keep) {
      expect(Number.isNaN(r.stats.cwdAllowedRatio)).toBe(true);
    }
  });

  it('counts alwaysDeny prefix as denied even if it would match alwaysAllow', () => {
    const events = [
      userText('x'.repeat(1000), 'C:\\Users\\HassanSadiq\\AppData\\Roaming\\Claude\\foo'),
      asstText('x'.repeat(100), '/sessions/x'),
      asstText('x'.repeat(100), '/sessions/x'),
    ];
    const r = postCheckSession(events, CONFIG_DEFAULT);
    expect(r.keep).toBe(false);
    if (!r.keep) expect(r.reason).toBe('cwd_majority_outside_allowlist');
  });
});

describe('postCheckSession — stats reporting', () => {
  it('reports detailed stats on every decision', () => {
    const events = [
      userText('x'.repeat(300), '/sessions/x'),
      asstText('x'.repeat(200), 'C:\\elsewhere'),
      asstText('x'.repeat(500), '/sessions/x'),
    ];
    const r = postCheckSession(events, CONFIG_DEFAULT);
    expect(r.stats.eventCount).toBe(3);
    expect(r.stats.totalTextChars).toBe(1000);
    expect(r.stats.allowedTextChars).toBe(800);
    expect(r.stats.deniedTextChars).toBe(200);
    expect(r.stats.cwdAllowedRatio).toBe(0.8);
  });

  it('handles an empty event list cleanly (tiny_session, no division by zero)', () => {
    const r = postCheckSession([], CONFIG_DEFAULT);
    expect(r.keep).toBe(false);
    if (!r.keep) {
      expect(r.reason).toBe('tiny_session');
      expect(r.stats.eventCount).toBe(0);
      expect(r.stats.totalTextChars).toBe(0);
      expect(Number.isNaN(r.stats.cwdAllowedRatio)).toBe(true);
    }
  });
});
