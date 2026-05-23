import { describe, expect, it } from 'vitest';

import {
  filterSession,
  matchesAnyPrefix,
} from '../../tools/nfx-cowork-export/src/filter-session.js';
import type {
  ExporterConfig,
  SessionDiscovery,
  SessionMeta,
} from '../../tools/nfx-cowork-export/src/types.js';

const EMPTY_CONFIG: ExporterConfig = {
  cwdAllowlist: { alwaysAllow: [], allowPrefixes: [], alwaysDeny: [] },
  familyLawSlugs: [],
};

function makeDiscovery(opts: {
  sessionId?: string;
  slug?: string;
  meta?: SessionMeta | null;
  hasParent?: boolean;
  hasAcompact?: boolean;
  hasSubagent?: boolean;
}): SessionDiscovery {
  const slug = opts.slug ?? 'test-slug';
  const transcripts = [];
  if (opts.hasParent !== false) {
    transcripts.push({
      path: `/x/${slug}/parent.jsonl`,
      slug,
      isSubagent: false,
      isAcompact: false,
    });
  }
  if (opts.hasAcompact) {
    transcripts.push({
      path: `/x/${slug}/agent-acompact-abc.jsonl`,
      slug,
      isSubagent: false,
      isAcompact: true,
    });
  }
  if (opts.hasSubagent) {
    transcripts.push({
      path: `/x/${slug}/subagents/agent-abc.jsonl`,
      slug,
      isSubagent: true,
      isAcompact: false,
    });
  }
  return {
    sessionId: opts.sessionId ?? 'session-id',
    sessionFolder: '/x/session',
    metaFile: opts.meta ? '/x/meta.json' : null,
    meta: opts.meta === undefined ? ({} as SessionMeta) : opts.meta,
    transcripts,
  };
}

describe('filterSession — keep decision', () => {
  it('keeps a session that passes every filter', () => {
    const decision = filterSession(
      makeDiscovery({
        meta: { initialMessage: 'Hey, real question.', emailAddress: 'hassan@example.test' },
      }),
      EMPTY_CONFIG
    );
    expect(decision.keep).toBe(true);
  });
});

describe('filterSession — drop reasons', () => {
  it('drops when no parent transcripts exist (only acompact/subagent)', () => {
    const decision = filterSession(
      makeDiscovery({
        meta: { initialMessage: 'hi' },
        hasParent: false,
        hasAcompact: true,
        hasSubagent: true,
      }),
      EMPTY_CONFIG
    );
    expect(decision).toEqual({ keep: false, reason: 'no_transcripts' });
  });

  it('drops when meta is missing entirely', () => {
    const decision = filterSession(makeDiscovery({ meta: null }), EMPTY_CONFIG);
    expect(decision).toEqual({ keep: false, reason: 'meta_missing' });
  });

  it('drops when initialMessage starts with <scheduled-task', () => {
    const decision = filterSession(
      makeDiscovery({ meta: { initialMessage: '<scheduled-task name="morning-brief" />' } }),
      EMPTY_CONFIG
    );
    expect(decision.keep).toBe(false);
    if (!decision.keep) expect(decision.reason).toBe('scheduled_task');
  });

  it('drops when initialMessage starts with <command-message', () => {
    const decision = filterSession(
      makeDiscovery({ meta: { initialMessage: '<command-message>/setup-cowork</command-message>' } }),
      EMPTY_CONFIG
    );
    expect(decision.keep).toBe(false);
    if (!decision.keep) expect(decision.reason).toBe('command_message');
  });

  it('drops when initialMessage starts with <system-path-cwd', () => {
    const decision = filterSession(
      makeDiscovery({ meta: { initialMessage: '<system-path-cwd>...</system-path-cwd>' } }),
      EMPTY_CONFIG
    );
    expect(decision.keep).toBe(false);
    if (!decision.keep) expect(decision.reason).toBe('system_path_cwd');
  });

  it('drops when slug appears on the family-law blocklist', () => {
    const decision = filterSession(
      makeDiscovery({
        slug: 'synthetic-blocked-slug',
        meta: { initialMessage: 'hi', emailAddress: 'hassan@example.test' },
      }),
      { ...EMPTY_CONFIG, familyLawSlugs: ['synthetic-blocked-slug'] }
    );
    expect(decision.keep).toBe(false);
    if (!decision.keep) {
      expect(decision.reason).toBe('family_law_slug');
      // The detail is the SHA-256 hash, NOT the slug itself
      expect(decision.detail).toMatch(/^[0-9a-f]{64}$/);
      expect(decision.detail).not.toContain('synthetic');
    }
  });

  // (Removed: tests that previously asserted account_not_allowlisted drops
  // and empty-allowlist passes. The account filter was removed entirely —
  // every session on the user's own laptop is theirs by definition. See
  // the new "no longer filters by account" describe block at the bottom
  // of this file for the regression check.)

  it('drops when cwd matches an alwaysDeny prefix', () => {
    const decision = filterSession(
      makeDiscovery({
        meta: {
          initialMessage: 'hi',
          emailAddress: 'hassan@example.test',
          cwd: 'C:\\Users\\HassanSadiq\\AppData\\Roaming\\Claude\\foo',
        },
      }),
      {
        ...EMPTY_CONFIG,
        cwdAllowlist: {
          alwaysAllow: ['/sessions/'],
          allowPrefixes: [],
          alwaysDeny: ['C:\\Users\\HassanSadiq\\AppData\\Roaming\\Claude\\'],
        },
      }
    );
    expect(decision.keep).toBe(false);
    if (!decision.keep) expect(decision.reason).toBe('cwd_always_denied');
  });

  it('drops when cwd does not match any allow prefix', () => {
    const decision = filterSession(
      makeDiscovery({
        meta: { initialMessage: 'hi', emailAddress: 'hassan@example.test', cwd: '/random/path' },
      }),
      {
        ...EMPTY_CONFIG,
        cwdAllowlist: {
          alwaysAllow: ['/sessions/'],
          allowPrefixes: ['C:\\Users\\HassanSadiq\\Projects\\'],
          alwaysDeny: [],
        },
      }
    );
    expect(decision.keep).toBe(false);
    if (!decision.keep) expect(decision.reason).toBe('cwd_not_allowed');
  });

  it('keeps when cwd matches an alwaysAllow prefix (Cowork sandbox)', () => {
    const decision = filterSession(
      makeDiscovery({
        meta: { initialMessage: 'hi', emailAddress: 'hassan@example.test', cwd: '/sessions/some-slug' },
      }),
      {
        ...EMPTY_CONFIG,
        cwdAllowlist: {
          alwaysAllow: ['/sessions/'],
          allowPrefixes: [],
          alwaysDeny: [],
        },
      }
    );
    expect(decision.keep).toBe(true);
  });

  it('keeps when cwd matches an allowPrefix', () => {
    const decision = filterSession(
      makeDiscovery({
        meta: {
          initialMessage: 'hi',
          emailAddress: 'hassan@example.test',
          cwd: 'C:\\Users\\HassanSadiq\\Projects\\nexfortis content pipeline',
        },
      }),
      {
        ...EMPTY_CONFIG,
        cwdAllowlist: {
          alwaysAllow: [],
          allowPrefixes: ['C:\\Users\\HassanSadiq\\Projects\\'],
          alwaysDeny: [],
        },
      }
    );
    expect(decision.keep).toBe(true);
  });
});

describe('filterSession — precedence', () => {
  it('family-law slug wins over command-message initialMessage', () => {
    const decision = filterSession(
      makeDiscovery({
        slug: 'synthetic-blocked-slug',
        meta: { initialMessage: '<command-message>/foo</command-message>' },
      }),
      { ...EMPTY_CONFIG, familyLawSlugs: ['synthetic-blocked-slug'] }
    );
    expect(decision.keep).toBe(false);
    if (!decision.keep) expect(decision.reason).toBe('family_law_slug');
  });

  // (Removed: "scheduled_task wins over account_not_allowlisted" — the
  // account filter no longer exists, so this priority test is moot.)
});

describe('matchesAnyPrefix — path normalization', () => {
  it('is case-insensitive', () => {
    expect(matchesAnyPrefix('C:\\Users\\Hassan', ['c:\\users\\'])).toBe(true);
    expect(matchesAnyPrefix('c:\\users\\hassan', ['C:\\Users\\'])).toBe(true);
  });

  it('treats backslash and forward slash as equivalent', () => {
    expect(matchesAnyPrefix('C:\\Users\\Hassan', ['C:/Users/'])).toBe(true);
    expect(matchesAnyPrefix('C:/Users/Hassan', ['C:\\Users\\'])).toBe(true);
  });

  it('handles trailing-slash variations', () => {
    expect(matchesAnyPrefix('C:\\Users\\Hassan\\Projects', ['C:\\Users\\Hassan\\Projects'])).toBe(true);
    expect(matchesAnyPrefix('C:\\Users\\Hassan\\Projects\\foo', ['C:\\Users\\Hassan\\Projects'])).toBe(true);
  });

  it('returns false on non-matching prefix', () => {
    expect(matchesAnyPrefix('/random/path', ['C:\\Users\\'])).toBe(false);
  });

  it('ignores empty-string prefixes (does not match everything)', () => {
    expect(matchesAnyPrefix('/anything', [''])).toBe(false);
  });

  it('returns false when prefixes array is empty', () => {
    expect(matchesAnyPrefix('/anything', [])).toBe(false);
  });
});

describe('filterSession — account is no longer a filter (account-filter removal)', () => {
  // After the account-allowlist removal, every session on the user's laptop
  // is theirs by definition. These tests lock the new behavior: the filter
  // pipeline must NEVER drop a session based on meta.emailAddress.

  function passingDiscovery(emailAddress: string): SessionDiscovery {
    return makeDiscovery({
      meta: {
        initialMessage: 'a normal first message',
        emailAddress,
        cwd: '/sessions/x/mnt/projects/work',  // sandbox path; alwaysAllow covers /sessions/
      },
    });
  }

  it('sessions under the current email pass through', () => {
    const decision = filterSession(
      passingDiscovery('hassansadiq73@gmail.com'),
      { ...EMPTY_CONFIG, cwdAllowlist: { alwaysAllow: ['/sessions/'], allowPrefixes: [], alwaysDeny: [] } }
    );
    expect(decision.keep).toBe(true);
  });

  it('sessions under an old / defunct email pass through (this was the bug)', () => {
    // Hassan switched email accounts; the old account's sessions are still
    // his and should NOT be dropped by anything account-related.
    const decision = filterSession(
      passingDiscovery('old-work-email@some-defunct-domain.test'),
      { ...EMPTY_CONFIG, cwdAllowlist: { alwaysAllow: ['/sessions/'], allowPrefixes: [], alwaysDeny: [] } }
    );
    expect(decision.keep).toBe(true);
  });

  it('sessions with NO emailAddress in meta still pass through', () => {
    const decision = filterSession(
      makeDiscovery({
        meta: {
          initialMessage: 'a normal first message',
          // emailAddress intentionally absent
          cwd: '/sessions/x/mnt/projects/work',
        } as unknown as SessionMeta,
      }),
      { ...EMPTY_CONFIG, cwdAllowlist: { alwaysAllow: ['/sessions/'], allowPrefixes: [], alwaysDeny: [] } }
    );
    expect(decision.keep).toBe(true);
  });

  it('no FilterDecision in the keep:false union has reason "account_not_allowlisted"', () => {
    // Drive every drop path and assert that none of them returned the removed reason.
    // This is a paranoid check that the removal is total: even if some future
    // code path tried to return account_not_allowlisted, TypeScript would reject
    // it (the union member is gone from types.ts), but assert at runtime too.
    const samples: SessionDiscovery[] = [
      // Will drop for family_law_slug
      makeDiscovery({ slug: 'synthetic-blocked-slug', meta: { initialMessage: 'hi', emailAddress: 'x@y.test', cwd: '/ok' } }),
      // Will drop for scheduled_task
      makeDiscovery({ meta: { initialMessage: '<scheduled-task name="x" />', emailAddress: 'x@y.test', cwd: '/ok' } }),
    ];
    const cfg = { ...EMPTY_CONFIG, familyLawSlugs: ['synthetic-blocked-slug'] };
    for (const s of samples) {
      const d = filterSession(s, cfg);
      if (!d.keep) {
        expect(d.reason).not.toBe('account_not_allowlisted');
      }
    }
  });
});
