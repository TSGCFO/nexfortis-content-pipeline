/**
 * Regression tests for renderExtendedAuditReport in audit-extended.ts.
 *
 * Slice 6 audit-fix scope: when a session is in the parsedSessions array
 * but failed post-check (e.g. tiny_session), the per-workspace-branch and
 * per-account count breakdowns in the audit must NOT count it. Otherwise
 * the headline "Kept (passed filters): N" disagrees with the per-breakdown
 * counts that follow it.
 *
 * This bug was caught by Hassan running the binary cold on his Windows
 * machine against live Cowork data on 2026-05-23. The headline said
 * "Kept: 14" but per-branch and per-account both said "16".
 */

import { describe, expect, it } from 'vitest';

import {
  renderExtendedAuditReport,
  type ExtendedAuditInputs,
} from '../../tools/nfx-cowork-export/src/audit-extended.js';
import type {
  ParsedSession,
  SessionDiscovery,
  AuditRow,
} from '../../tools/nfx-cowork-export/src/types.js';
import type { AuditSummary } from '../../tools/nfx-cowork-export/src/audit.js';

const WORKSPACE_UUID = 'a169f9c6-6681-4506-b902-2240e9506824';

function makeDiscovery(opts: {
  sessionId: string;
  workspaceUuid?: string;
  emailAddress?: string;
}): SessionDiscovery {
  const ws = opts.workspaceUuid ?? WORKSPACE_UUID;
  const sessionFolder = `/x/${ws}/space-uuid/local_${opts.sessionId}`;
  return {
    sessionId: opts.sessionId,
    sessionFolder,
    metaFile: `${sessionFolder}.json`,
    meta: opts.emailAddress
      ? { emailAddress: opts.emailAddress }
      : null,
    transcripts: [
      {
        path: `${sessionFolder}/.claude/projects/-sessions/transcript-1.jsonl`,
        slug: 'test-slug',
        isSubagent: false,
        isAcompact: false,
      },
    ],
  };
}

function makeSession(opts: {
  sessionId: string;
  postCheckKeep: boolean;
  emailAddress?: string;
  workspaceUuid?: string;
}): ParsedSession {
  return {
    discovery: makeDiscovery({
      sessionId: opts.sessionId,
      workspaceUuid: opts.workspaceUuid,
      emailAddress: opts.emailAddress ?? 'hassan@example.test',
    }),
    sessionDecision: { keep: true, reason: 'passed_session_level_filters' },
    transcripts: [
      {
        transcriptId: opts.sessionId,
        sourceFile: '/x/source.jsonl',
        events: [],
        scaffoldStripped: false,
        parseStats: { linesRead: 10, linesFailed: 0, abandoned: false },
      },
    ],
    postCheck: opts.postCheckKeep
      ? {
          keep: true,
          reason: 'passed_post_checks',
          stats: {
            eventCount: 5,
            totalTextChars: 1000,
            allowedTextChars: 1000,
            deniedTextChars: 0,
            noCwdTextChars: 0,
            cwdAllowedRatio: 1,
          },
        }
      : {
          keep: false,
          reason: 'tiny_session',
          stats: {
            eventCount: 1,
            totalTextChars: 50,
            allowedTextChars: 50,
            deniedTextChars: 0,
            noCwdTextChars: 0,
            cwdAllowedRatio: 1,
          },
        },
  };
}

function makeAuditInputs(parsedSessions: ParsedSession[], keptCount: number): ExtendedAuditInputs {
  const rows: AuditRow[] = parsedSessions.map((s) => ({
    sessionId: s.discovery.sessionId,
    slug: 'test-slug',
    account: s.discovery.meta?.emailAddress ?? null,
    decision: s.sessionDecision,
  }));
  const summary: AuditSummary = {
    total: keptCount + 5, // arbitrary; what matters for this test is `kept`
    kept: keptCount,
    droppedByReason: {
      family_law_slug: 0,
      scheduled_task: 1,
      command_message: 0,
      system_path_cwd_initial: 0,
      meta_missing: 0,
      account_not_allowlisted: 1,
      cwd_always_denied: 1,
      cwd_always_allowed_only: 0,
      cwd_no_match: 0,
      tiny_session:
        parsedSessions.filter((s) => !s.postCheck.keep && s.postCheck.reason === 'tiny_session').length,
      cwd_majority_outside_allowlist:
        parsedSessions.filter((s) => !s.postCheck.keep && s.postCheck.reason === 'cwd_majority_outside_allowlist').length,
    },
  };
  return {
    rows,
    summary,
    parsedSessions,
    emitResult: { filesWritten: [], validationFailures: [] },
    redactionSummary: {
      scannedTextFields: 0,
      totalReplacements: 0,
      replacementsByType: {},
    },
    familyLawHashes: [],
    runStartedAt: new Date('2026-05-23T02:00:00.000Z'),
    runFinishedAt: new Date('2026-05-23T02:00:01.000Z'),
    inputRoot: '/x/in',
    outputDir: '/x/out',
    dryRun: false,
  };
}

describe('renderExtendedAuditReport — slice 6 audit counting fix', () => {
  it('per-branch and per-account counts EXCLUDE sessions dropped by post-check', () => {
    // 5 sessions in parsedSessions, but 2 failed post-check (tiny_session).
    // The "Kept (passed filters)" headline number should be 3.
    // The per-branch and per-account counts MUST match — both should show 3,
    // not 5. This is the bug Hassan hit in production with 14 vs 16.
    const sessions: ParsedSession[] = [
      makeSession({ sessionId: 's1', postCheckKeep: true }),
      makeSession({ sessionId: 's2', postCheckKeep: true }),
      makeSession({ sessionId: 's3', postCheckKeep: true }),
      makeSession({ sessionId: 's4', postCheckKeep: false }), // dropped post-check
      makeSession({ sessionId: 's5', postCheckKeep: false }), // dropped post-check
    ];
    const inputs = makeAuditInputs(sessions, 3); // kept = 3, matching the 3 keep:true
    const text = renderExtendedAuditReport(inputs);

    // Headline number
    expect(text).toContain('Kept (passed filters): 3');

    // Per-branch counts: all 5 sessions are in the same workspace UUID.
    // After the fix, this row should say 3 (matching the headline), not 5.
    const branchLineMatch = text.match(/^\s+a169f9c6-[^ ]+\s+(\d+)/m);
    expect(branchLineMatch).not.toBeNull();
    expect(branchLineMatch![1]).toBe('3');

    // Per-account counts: same story. All 5 use hassan@example.test;
    // after the fix the row says 3, not 5.
    const accountLineMatch = text.match(/^\s+hassan@example\.test\s+(\d+)/m);
    expect(accountLineMatch).not.toBeNull();
    expect(accountLineMatch![1]).toBe('3');
  });

  it('per-branch counts agree with headline across multiple workspaces', () => {
    // 4 sessions in workspace A (3 kept, 1 dropped), 2 sessions in workspace B (1 kept, 1 dropped).
    // Headline kept = 4. Per-branch should show A=3 and B=1.
    const wsA = 'a169f9c6-6681-4506-b902-2240e9506824';
    const wsB = 'b2222222-6681-4506-b902-2240e9506824';
    const sessions: ParsedSession[] = [
      makeSession({ sessionId: 'a-1', postCheckKeep: true, workspaceUuid: wsA }),
      makeSession({ sessionId: 'a-2', postCheckKeep: true, workspaceUuid: wsA }),
      makeSession({ sessionId: 'a-3', postCheckKeep: true, workspaceUuid: wsA }),
      makeSession({ sessionId: 'a-4', postCheckKeep: false, workspaceUuid: wsA }),
      makeSession({ sessionId: 'b-1', postCheckKeep: true, workspaceUuid: wsB }),
      makeSession({ sessionId: 'b-2', postCheckKeep: false, workspaceUuid: wsB }),
    ];
    const inputs = makeAuditInputs(sessions, 4);
    const text = renderExtendedAuditReport(inputs);

    expect(text).toContain('Kept (passed filters): 4');

    // Per-branch counts
    const aMatch = text.match(/^\s+a169f9c6-[^ ]+\s+(\d+)/m);
    const bMatch = text.match(/^\s+b2222222-[^ ]+\s+(\d+)/m);
    expect(aMatch).not.toBeNull();
    expect(bMatch).not.toBeNull();
    expect(aMatch![1]).toBe('3');
    expect(bMatch![1]).toBe('1');

    // And the sum across branches equals the headline kept number
    const branchSum = parseInt(aMatch![1]!, 10) + parseInt(bMatch![1]!, 10);
    expect(branchSum).toBe(4);
  });

  it('per-account counts agree with headline across multiple accounts', () => {
    // 3 sessions for account1 (2 kept, 1 dropped), 2 sessions for account2 (1 kept, 1 dropped).
    // Headline kept = 3. Per-account should show account1=2 and account2=1.
    const sessions: ParsedSession[] = [
      makeSession({ sessionId: 'h-1', postCheckKeep: true, emailAddress: 'one@example.test' }),
      makeSession({ sessionId: 'h-2', postCheckKeep: true, emailAddress: 'one@example.test' }),
      makeSession({ sessionId: 'h-3', postCheckKeep: false, emailAddress: 'one@example.test' }),
      makeSession({ sessionId: 'h-4', postCheckKeep: true, emailAddress: 'two@example.test' }),
      makeSession({ sessionId: 'h-5', postCheckKeep: false, emailAddress: 'two@example.test' }),
    ];
    const inputs = makeAuditInputs(sessions, 3);
    const text = renderExtendedAuditReport(inputs);

    expect(text).toContain('Kept (passed filters): 3');

    const oneMatch = text.match(/^\s+one@example\.test\s+(\d+)/m);
    const twoMatch = text.match(/^\s+two@example\.test\s+(\d+)/m);
    expect(oneMatch).not.toBeNull();
    expect(twoMatch).not.toBeNull();
    expect(oneMatch![1]).toBe('2');
    expect(twoMatch![1]).toBe('1');

    // Sum across accounts equals headline kept
    expect(parseInt(oneMatch![1]!, 10) + parseInt(twoMatch![1]!, 10)).toBe(3);
  });

  it('when all parsedSessions pass post-check, counts equal parsedSessions.length (no regression)', () => {
    // Sanity check: the fix doesn't accidentally drop count when nothing failed post-check.
    const sessions: ParsedSession[] = [
      makeSession({ sessionId: 'x1', postCheckKeep: true }),
      makeSession({ sessionId: 'x2', postCheckKeep: true }),
      makeSession({ sessionId: 'x3', postCheckKeep: true }),
    ];
    const inputs = makeAuditInputs(sessions, 3);
    const text = renderExtendedAuditReport(inputs);

    expect(text).toContain('Kept (passed filters): 3');
    const branchMatch = text.match(/^\s+a169f9c6-[^ ]+\s+(\d+)/m);
    expect(branchMatch![1]).toBe('3');
    const accountMatch = text.match(/^\s+hassan@example\.test\s+(\d+)/m);
    expect(accountMatch![1]).toBe('3');
  });
});
