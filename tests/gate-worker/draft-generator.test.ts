/**
 * Tests for the draft-generator job (F3 Step 1 — Brief Assembly).
 *
 * The DI core is exercised with a fake `db` that dispatches by table identity
 * (the real table objects are imported and compared by reference). Covers the
 * created / idempotent-skip paths, brief contents, answer extraction, event
 * parsing, and env validation. Synthetic fixtures only.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  articleCandidates,
  captureSignals,
  drafts,
  interviewSessions,
  type Database,
  type InterviewAnswer,
} from '@ncp/db';
import type { Logger } from '@ncp/logger';

import {
  extractAnswerProse,
  parseDraftRequested,
  readEnv,
  runDraftGenerator,
  type DraftRequestedData,
} from '../../artifacts/gate-worker/src/jobs/draft-generator/index.js';

function makeLogger(): Logger {
  const noop = vi.fn();
  return {
    trace: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    fatal: noop,
  } as unknown as Logger;
}

interface FakeDbOpts {
  existingDraft?: { id: string };
  sessionAnswers?: InterviewAnswer[];
  sessionMissing?: boolean;
  chunks?: Array<{ redactedText: string; capturedAt: Date }>;
  newDraftId?: string;
}

interface FakeDbState {
  inserts: Array<{ table: unknown; values: Record<string, unknown> }>;
  updates: Array<{ table: unknown; set: Record<string, unknown> }>;
}

function makeFakeDb(opts: FakeDbOpts = {}): {
  db: Database;
  state: FakeDbState;
} {
  const state: FakeDbState = { inserts: [], updates: [] };
  const db = {
    select() {
      return {
        from(table: unknown) {
          return {
            where(): Promise<unknown[]> {
              if (table === drafts) {
                return Promise.resolve(
                  opts.existingDraft ? [opts.existingDraft] : [],
                );
              }
              if (table === interviewSessions) {
                if (opts.sessionMissing) return Promise.resolve([]);
                return Promise.resolve([
                  { answers: opts.sessionAnswers ?? [] },
                ]);
              }
              if (table === captureSignals) {
                return Promise.resolve(opts.chunks ?? []);
              }
              return Promise.resolve([]);
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(values: Record<string, unknown>) {
          state.inserts.push({ table, values });
          return {
            returning(): Promise<Array<{ id: string }>> {
              return Promise.resolve([{ id: opts.newDraftId ?? 'draft-new' }]);
            },
          };
        },
      };
    },
    update(table: unknown) {
      return {
        set(set: Record<string, unknown>) {
          return {
            where(): Promise<void> {
              state.updates.push({ table, set });
              return Promise.resolve();
            },
          };
        },
      };
    },
  };
  return { db: db as unknown as Database, state };
}

const EVENT: DraftRequestedData = {
  candidateId: 'cand-1',
  sessionId: 'sess-1',
  confirmedChunkIds: ['chunk-1', 'chunk-2'],
  pillar: 'managed-it',
  primaryKeyword: 'conditional access for ios',
};

function answer(overrides: Partial<InterviewAnswer>): InterviewAnswer {
  return {
    question_index: 0,
    response: 'CONFIRM',
    timestamp: '2026-05-22T12:00:00Z',
    ...overrides,
  };
}

describe('runDraftGenerator', () => {
  it('creates a drafts row with the assembled brief (AC-F3-01)', async () => {
    const { db, state } = makeFakeDb({
      sessionAnswers: [
        answer({ transcript: 'When a client hit AADSTS50158 on iOS, I fixed it.' }),
      ],
      chunks: [
        {
          redactedText: 'error AADSTS50158 during Conditional Access',
          capturedAt: new Date('2026-05-20T00:00:00Z'),
        },
      ],
      newDraftId: 'draft-123',
    });

    const outcome = await runDraftGenerator({
      db,
      logger: makeLogger(),
      projectId: 'proj-xyz',
      event: EVENT,
    });

    expect(outcome).toEqual({ kind: 'created', draftId: 'draft-123' });

    expect(state.inserts).toHaveLength(1);
    const insert = state.inserts[0]!;
    expect(insert.table).toBe(drafts);
    expect(insert.values['candidateId']).toBe('cand-1');
    expect(insert.values['sessionId']).toBe('sess-1');
    expect(insert.values['attemptNumber']).toBe(1);
    expect(insert.values['status']).toBe('generating');

    const brief = insert.values['seowindBrief'] as {
      focusKeyword: string;
      enableCompanyDetails: boolean;
      projectId: string;
      insightsText: string;
    };
    expect(brief.focusKeyword).toBe('conditional access for ios');
    expect(brief.enableCompanyDetails).toBe(true);
    expect(brief.projectId).toBe('proj-xyz');
    expect(brief.insightsText).toContain('When a client hit AADSTS50158');
    expect(brief.insightsText).toContain('error AADSTS50158');

    // Candidate is advanced to the drafting stage.
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0]!.table).toBe(articleCandidates);
    expect(state.updates[0]!.set['status']).toBe('draft_requested');
  });

  it('is idempotent: skips when a first-attempt draft already exists', async () => {
    const { db, state } = makeFakeDb({ existingDraft: { id: 'draft-existing' } });

    const outcome = await runDraftGenerator({
      db,
      logger: makeLogger(),
      projectId: 'proj-xyz',
      event: EVENT,
    });

    expect(outcome).toEqual({
      kind: 'skipped_existing',
      draftId: 'draft-existing',
    });
    expect(state.inserts).toHaveLength(0);
    expect(state.updates).toHaveLength(0);
  });

  it('fails fast when no session matches the (session, candidate) pair', async () => {
    const { db, state } = makeFakeDb({ sessionMissing: true });

    await expect(
      runDraftGenerator({
        db,
        logger: makeLogger(),
        projectId: 'proj-xyz',
        event: EVENT,
      }),
    ).rejects.toThrow(/no interview_sessions row/);
    expect(state.inserts).toHaveLength(0);
  });

  it('still creates a draft when there are no answers or chunks', async () => {
    const { db, state } = makeFakeDb({
      sessionAnswers: [],
      chunks: [],
      newDraftId: 'draft-empty',
    });

    const outcome = await runDraftGenerator({
      db,
      logger: makeLogger(),
      projectId: 'proj-xyz',
      event: { ...EVENT, confirmedChunkIds: [] },
    });

    expect(outcome.kind).toBe('created');
    const brief = state.inserts[0]!.values['seowindBrief'] as {
      insightsText: string;
    };
    expect(brief.insightsText).toBe('');
  });
});

describe('extractAnswerProse', () => {
  it('prefers transcript, then typed text, and drops button-only answers', () => {
    const prose = extractAnswerProse([
      answer({ transcript: '  voice words  ' }),
      answer({ text: 'typed words' }),
      answer({ response: 'SKIP' }), // no transcript/text → dropped
      answer({ transcript: '   ' }), // whitespace-only → dropped
    ]);
    expect(prose).toEqual(['voice words', 'typed words']);
  });
});

describe('parseDraftRequested', () => {
  it('accepts a well-formed payload', () => {
    expect(parseDraftRequested({ ...EVENT })).toEqual(EVENT);
  });

  it('rejects a missing candidateId', () => {
    expect(() => parseDraftRequested({ ...EVENT, candidateId: '' })).toThrow(
      /candidateId/,
    );
  });

  it('rejects an unknown pillar', () => {
    expect(() =>
      parseDraftRequested({ ...EVENT, pillar: 'marketing' }),
    ).toThrow(/pillar/);
  });

  it('rejects non-string confirmedChunkIds', () => {
    expect(() =>
      parseDraftRequested({ ...EVENT, confirmedChunkIds: [1, 2] }),
    ).toThrow(/confirmedChunkIds/);
  });

  it('rejects a non-object payload', () => {
    expect(() => parseDraftRequested(null)).toThrow();
  });
});

describe('readEnv', () => {
  const saved = {
    db: process.env['DATABASE_URL'],
    project: process.env['SEOWIND_PROJECT_ID'],
  };

  beforeEach(() => {
    delete process.env['DATABASE_URL'];
    delete process.env['SEOWIND_PROJECT_ID'];
  });

  afterEach(() => {
    if (saved.db === undefined) delete process.env['DATABASE_URL'];
    else process.env['DATABASE_URL'] = saved.db;
    if (saved.project === undefined) delete process.env['SEOWIND_PROJECT_ID'];
    else process.env['SEOWIND_PROJECT_ID'] = saved.project;
  });

  it('throws when required env vars are missing', () => {
    expect(() => readEnv()).toThrow(/DATABASE_URL/);
  });

  it('returns the config when both vars are set', () => {
    process.env['DATABASE_URL'] = 'postgres://localhost/test';
    process.env['SEOWIND_PROJECT_ID'] = 'proj-1';
    expect(readEnv()).toEqual({
      databaseUrl: 'postgres://localhost/test',
      seowindProjectId: 'proj-1',
    });
  });
});
