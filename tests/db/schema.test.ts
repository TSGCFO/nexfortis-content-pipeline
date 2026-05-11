import { afterEach, describe, expect, it, vi } from 'vitest';
import * as db from '@ncp/db';
import {
  articleCandidates,
  candidateStatusEnum,
  captureSignals,
  clusterStatusEnum,
  createDbClient,
  DbConnectionConfigError,
  drafts,
  draftStatusEnum,
  interviewSessions,
  piiStatusEnum,
  publishedArticles,
  sessionStatusEnum,
  sourceFilters,
  synthesisClusters,
} from '@ncp/db';

describe('@ncp/db barrel exports', () => {
  it('re-exports each of the seven tables', () => {
    expect(db.captureSignals).toBeDefined();
    expect(db.synthesisClusters).toBeDefined();
    expect(db.articleCandidates).toBeDefined();
    expect(db.interviewSessions).toBeDefined();
    expect(db.drafts).toBeDefined();
    expect(db.publishedArticles).toBeDefined();
    expect(db.sourceFilters).toBeDefined();
  });
});

describe('table primary keys', () => {
  it.each([
    ['captureSignals', captureSignals],
    ['synthesisClusters', synthesisClusters],
    ['articleCandidates', articleCandidates],
    ['interviewSessions', interviewSessions],
    ['drafts', drafts],
    ['publishedArticles', publishedArticles],
    ['sourceFilters', sourceFilters],
  ] as const)('%s has an `id` primary-key column named "id"', (_label, table) => {
    expect(table.id).toBeDefined();
    expect(table.id.name).toBe('id');
    expect(table.id.primary).toBe(true);
  });
});

describe('pgEnum declarations', () => {
  it('piiStatusEnum has exactly the spec values', () => {
    expect(piiStatusEnum.enumValues).toEqual([
      'clean',
      'redacted',
      'blocked',
      'pending',
    ]);
  });

  it('clusterStatusEnum has exactly the spec values', () => {
    expect(clusterStatusEnum.enumValues).toEqual([
      'active',
      'used',
      'discarded',
    ]);
  });

  it('candidateStatusEnum has exactly the spec values', () => {
    expect(candidateStatusEnum.enumValues).toEqual([
      'pending',
      'awaiting_interview',
      'interview_complete',
      'skipped',
      'timed_out',
      'draft_requested',
      'shelved',
      'published',
      'archived',
    ]);
  });

  it('sessionStatusEnum has exactly the spec values', () => {
    expect(sessionStatusEnum.enumValues).toEqual([
      'pending',
      'preview_sent',
      'confirming',
      'follow_up',
      'completed',
      'skipped',
      'timed_out',
    ]);
  });

  it('draftStatusEnum has exactly the spec values', () => {
    expect(draftStatusEnum.enumValues).toEqual([
      'generating',
      'gate_a_fail',
      'gate_b_fail',
      'awaiting_manual_clearscope',
      'gate_passed',
      'in_sanity_review',
      'rejected_by_hassan',
      'shelved',
      'published',
    ]);
  });
});

describe('createDbClient configuration errors', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws DbConnectionConfigError when given an invalid connectionString', () => {
    expect(() => createDbClient({ connectionString: 'not-a-postgres-url' }))
      .toThrowError(DbConnectionConfigError);
  });

  it('throws DbConnectionConfigError when DATABASE_URL is unset and no option is given', () => {
    vi.stubEnv('DATABASE_URL', undefined as unknown as string);
    expect(() => createDbClient()).toThrowError(DbConnectionConfigError);
  });

  it('thrown error carries the stable machine-readable `code`', () => {
    try {
      createDbClient({ connectionString: 'not-a-postgres-url' });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DbConnectionConfigError);
      if (err instanceof DbConnectionConfigError) {
        expect(err.code).toBe('DB_CONNECTION_CONFIG');
      }
    }
  });
});
