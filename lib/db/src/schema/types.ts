import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { articleCandidates } from './article-candidates.js';
import { captureSignals } from './capture-signals.js';
import { drafts } from './drafts.js';
import { interviewSessions } from './interview-sessions.js';
import { publishedArticles } from './published-articles.js';
import { sourceFilters } from './source-filters.js';
import { synthesisClusters } from './synthesis-clusters.js';

export type CaptureSignalInsert = InferInsertModel<typeof captureSignals>;
export type CaptureSignalSelect = InferSelectModel<typeof captureSignals>;

export type SynthesisClusterInsert = InferInsertModel<typeof synthesisClusters>;
export type SynthesisClusterSelect = InferSelectModel<typeof synthesisClusters>;

export type ArticleCandidateInsert = InferInsertModel<typeof articleCandidates>;
export type ArticleCandidateSelect = InferSelectModel<typeof articleCandidates>;

export type InterviewSessionInsert = InferInsertModel<typeof interviewSessions>;
export type InterviewSessionSelect = InferSelectModel<typeof interviewSessions>;

export type DraftInsert = InferInsertModel<typeof drafts>;
export type DraftSelect = InferSelectModel<typeof drafts>;

export type PublishedArticleInsert = InferInsertModel<typeof publishedArticles>;
export type PublishedArticleSelect = InferSelectModel<typeof publishedArticles>;

export type SourceFilterInsert = InferInsertModel<typeof sourceFilters>;
export type SourceFilterSelect = InferSelectModel<typeof sourceFilters>;
