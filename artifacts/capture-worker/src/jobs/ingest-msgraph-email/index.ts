/**
 * Inngest cron function: ingest Microsoft 365 email via MS Graph.
 *
 * Application-scope `client_credentials` flow against
 * `/users/{MS_GRAPH_USER_UPN}/messages`. Pipeline per CS-03 + §4.2:
 * fetch → parse → dedupe → redact → blocklist (drop-on-match) → chunk →
 * embed → store, with incremental-fetch state in `ingest_checkpoints`.
 *
 * Discrete operations are wrapped in `step.run` for retry granularity:
 *   - fetch-access-token
 *   - get-checkpoint
 *   - resolve-folder-ids
 *   - process-{messageId}
 *   - update-checkpoint
 *
 * TODO(hassan): per-page fetches are NOT wrapped in `step.run` today
 * because `fetch-messages.ts` exposes an `AsyncIterable<GraphMessage>` rather
 * than a per-page primitive (per the prompt's interface contract). The
 * 500-message cap keeps runs short enough that a mid-run crash refetches at
 * most ≈500 messages, all of which are deduped by `source_id` on insert.
 * If we later want page-level durability, lift the iterator's page fetch
 * into a callback that `index.ts` can wrap in `step.run`.
 */

import type { Inngest, InngestFunction } from 'inngest';

import {
  createDbClient,
  sourceFilters,
  type Database,
} from '@ncp/db';
import { chunk as chunkText, embed as embedTexts } from '@ncp/embeddings';
import { createLogger } from '@ncp/logger';
import { redact } from '@ncp/redaction';

import { fetchAccessToken, type AccessTokenResult } from './access-token.js';
import {
  getLastIngestedAt,
  setLastIngestedAt,
} from './checkpoint.js';
import { AccessTokenError } from './errors.js';
import { fetchMessages } from './fetch-messages.js';
import { GraphClient } from './graph-client.js';
import { processMessage } from './process.js';
import type { GraphMessage, RunSummary } from './types.js';

const SOURCE = 'msgraph-email' as const;
const DEFAULT_FOLDER_NAMES = ['Inbox', 'Sent Items'] as const;
const MAX_MESSAGES_PER_RUN = 500;

interface MsGraphEnv {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  userUpn: string;
  openaiApiKey: string;
  openaiOrgId?: string;
  anthropicApiKey: string;
}

function readEnv(): MsGraphEnv {
  const tenantId = process.env['MS_GRAPH_TENANT_ID'];
  const clientId = process.env['MS_GRAPH_CLIENT_ID'];
  const clientSecret = process.env['MS_GRAPH_CLIENT_SECRET'];
  const userUpn = process.env['MS_GRAPH_USER_UPN'];
  const openaiApiKey = process.env['OPENAI_API_KEY'];
  const anthropicApiKey = process.env['ANTHROPIC_API_KEY'];
  const openaiOrgId = process.env['OPENAI_ORG_ID'];

  for (const [name, value] of [
    ['MS_GRAPH_TENANT_ID', tenantId],
    ['MS_GRAPH_CLIENT_ID', clientId],
    ['MS_GRAPH_CLIENT_SECRET', clientSecret],
    ['MS_GRAPH_USER_UPN', userUpn],
    ['OPENAI_API_KEY', openaiApiKey],
    ['ANTHROPIC_API_KEY', anthropicApiKey],
  ] as const) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new AccessTokenError(
        `MS Graph email ingester: required env var ${name} is missing or empty.`,
      );
    }
  }

  return {
    tenantId: tenantId as string,
    clientId: clientId as string,
    clientSecret: clientSecret as string,
    userUpn: userUpn as string,
    openaiApiKey: openaiApiKey as string,
    anthropicApiKey: anthropicApiKey as string,
    ...(typeof openaiOrgId === 'string' && openaiOrgId.length > 0
      ? { openaiOrgId }
      : {}),
  };
}

interface MailFolderListItem {
  id: string;
  displayName: string;
}

interface MailFolderListResponse {
  value?: MailFolderListItem[];
}

async function resolveFolderIds(
  client: GraphClient,
  db: Database,
  userUpn: string,
  logger: ReturnType<typeof createLogger>,
): Promise<string[]> {
  // Fetch all source_filters rows and filter for ours in JS. The table is
  // small (one row per source) and only read at run start, so this is
  // cheaper than pulling drizzle-orm's `eq`/`sql` helpers into this package
  // (which is outside the prompt allowlist for this PR).
  const rows = await db
    .select({
      source: sourceFilters.source,
      allowlistPatterns: sourceFilters.allowlistPatterns,
    })
    .from(sourceFilters);

  const ours = rows.find((r) => r.source === SOURCE);
  const allowList = ours?.allowlistPatterns;
  let configuredNames: string[] | null = null;
  if (Array.isArray(allowList)) {
    const folderNames: string[] = [];
    for (const pattern of allowList) {
      if (
        pattern &&
        typeof pattern === 'object' &&
        'displayName' in pattern &&
        typeof pattern.displayName === 'string'
      ) {
        folderNames.push(pattern.displayName);
      }
    }
    if (folderNames.length > 0) {
      configuredNames = folderNames;
    }
  }
  const wanted = configuredNames ?? [...DEFAULT_FOLDER_NAMES];

  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userUpn)}/mailFolders?$top=100`;
  const response = await client.request<MailFolderListResponse>(url);
  if (!response.ok) {
    logger.warn(
      {
        source: 'capture-worker',
        action: 'resolve_folder_ids_failed',
        status: response.status,
      },
      'mailFolders lookup failed; falling back to mailbox-wide query',
    );
    return [];
  }

  const folders = Array.isArray(response.body.value) ? response.body.value : [];
  const byName = new Map<string, string>();
  for (const f of folders) {
    if (typeof f?.displayName === 'string' && typeof f?.id === 'string') {
      byName.set(f.displayName, f.id);
    }
  }

  const resolved: string[] = [];
  for (const name of wanted) {
    const id = byName.get(name);
    if (typeof id === 'string') {
      resolved.push(id);
    } else {
      logger.warn(
        {
          source: 'capture-worker',
          action: 'folder_not_found',
          folderName: name,
        },
        'configured folder not found in mailbox; skipping',
      );
    }
  }
  return resolved;
}

/**
 * Factory: produces the Inngest cron function bound to the given client.
 *
 * Exported as a factory rather than a top-level `inngest.createFunction(...)`
 * call so `src/index.ts` (which owns the `Inngest` instance) imports this
 * module and constructs the function, avoiding a circular import.
 */
export function createIngestMsgraphEmailCron(
  inngest: Inngest.Any,
): InngestFunction.Any {
  return inngest.createFunction(
    {
      id: 'ingest-msgraph-email',
      name: 'Ingest Microsoft 365 Email via Graph',
    },
    { cron: '0 4 * * *' },
    async ({ step }) => {
    const logger = createLogger({ source: 'capture-worker' });
    const env = readEnv();
    const db = createDbClient();

    const tokenFetcher = (): Promise<AccessTokenResult> =>
      fetchAccessToken({
        tenantId: env.tenantId,
        clientId: env.clientId,
        clientSecret: env.clientSecret,
      });

    const initialToken = await step.run('fetch-access-token', tokenFetcher);
    const client = new GraphClient({
      initialToken,
      fetchToken: tokenFetcher,
    });

    const sinceISO = await step.run('get-checkpoint', async () => {
      const ts = await getLastIngestedAt(db);
      return ts.toISOString();
    });

    const folderIds = await step.run('resolve-folder-ids', () =>
      resolveFolderIds(client, db, env.userUpn, logger),
    );

    const summary: RunSummary = {
      source: SOURCE,
      signalsFetched: 0,
      signalsNew: 0,
      signalsSkippedDuplicate: 0,
      signalsBlockedPii: 0,
      signalsSkippedEmpty: 0,
      signalsSkippedDraft: 0,
      errors: 0,
      cappedAt500: false,
    };

    let mostRecentSentAt: Date | undefined;
    let processedCount = 0;

    try {
      const iter = fetchMessages(client, {
        userUpn: env.userUpn,
        sinceISO,
        ...(folderIds.length > 0 ? { folderIds } : {}),
        pageSize: 100,
        maxMessages: MAX_MESSAGES_PER_RUN,
      });

      for await (const msg of iter as AsyncIterable<GraphMessage>) {
        processedCount += 1;
        const result = await step.run(`process-${msg.id ?? `unknown-${processedCount}`}`, () =>
          processMessage(msg, {
            db,
            redactFn: redact,
            chunkFn: chunkText,
            embedFn: embedTexts,
            logger,
            anthropicApiKey: env.anthropicApiKey,
            openaiApiKey: env.openaiApiKey,
            ...(env.openaiOrgId !== undefined
              ? { openaiOrgId: env.openaiOrgId }
              : {}),
          }),
        );

        summary.signalsFetched += 1;
        switch (result.status) {
          case 'stored':
            summary.signalsNew += result.signalsInserted;
            summary.signalsSkippedDuplicate += result.signalsSkippedDuplicate;
            if (typeof msg.sentDateTime === 'string') {
              const t = new Date(msg.sentDateTime);
              if (
                !Number.isNaN(t.getTime()) &&
                (mostRecentSentAt === undefined || t > mostRecentSentAt)
              ) {
                mostRecentSentAt = t;
              }
            }
            break;
          case 'blocked':
            summary.signalsBlockedPii += 1;
            break;
          case 'skipped_empty':
            summary.signalsSkippedEmpty += 1;
            break;
          case 'skipped_draft':
            summary.signalsSkippedDraft += 1;
            break;
          case 'failed':
            summary.errors += 1;
            logger.error(
              {
                source: 'capture-worker',
                action: 'process_message_error',
                reason: result.error,
              },
              'message processing failed; continuing run',
            );
            break;
        }
      }

      if (processedCount >= MAX_MESSAGES_PER_RUN) {
        summary.cappedAt500 = true;
        logger.warn(
          {
            source: 'capture-worker',
            action: 'message_cap_hit',
            cap: MAX_MESSAGES_PER_RUN,
          },
          'message cap reached this run; next run will resume from checkpoint',
        );
      }

      if (mostRecentSentAt instanceof Date) {
        const checkpointTs = mostRecentSentAt;
        await step.run('update-checkpoint', () =>
          setLastIngestedAt(db, checkpointTs),
        );
      }

      logger.info(
        { ...summary, action: 'ingest_msgraph_email_completed' },
        'msgraph email ingest completed',
      );
      return summary;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        {
          source: 'capture-worker',
          action: 'ingest_msgraph_email_aborted',
          reason: message,
          signalsFetched: summary.signalsFetched,
          signalsNew: summary.signalsNew,
          signalsSkippedDuplicate: summary.signalsSkippedDuplicate,
          signalsBlockedPii: summary.signalsBlockedPii,
          signalsSkippedEmpty: summary.signalsSkippedEmpty,
          signalsSkippedDraft: summary.signalsSkippedDraft,
          errors: summary.errors,
          cappedAt500: summary.cappedAt500,
        },
        'msgraph email ingest aborted',
      );
      throw err;
    }
  },
  );
}
