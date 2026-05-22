/**
 * Paginated, rate-limit-aware iterator over `/users/{upn}/messages`.
 *
 * Follows `@odata.nextLink` until exhausted (or until the 500-message
 * per-run cap is hit). Honors `Retry-After` on 429 responses, retries 5xx
 * exactly once after 10s, and surfaces 4xx as `MsGraphApiError`.
 *
 * Pure async generator over `GraphMessage`: callers iterate with
 * `for await (const msg of fetchMessages(...))`. Page-level errors abort the
 * iteration so the cron handler can decide whether to update the checkpoint.
 */

import { MsGraphApiError, MsGraphRateLimitError } from './errors.js';
import type { GraphClient, GraphResponse } from './graph-client.js';
import type { GraphMessage, GraphMessagesPage } from './types.js';

export interface FetchMessagesOptions {
  userUpn: string;
  /** ISO 8601 UTC timestamp; used for `$filter=sentDateTime ge {value}`. */
  sinceISO: string;
  /**
   * Optional folder allowlist. When provided and non-empty, the iterator
   * fetches per-folder from `/users/{upn}/mailFolders/{folderId}/messages`
   * (in order). When omitted, fetches from the global `/messages` endpoint
   * (which spans Inbox + Sent Items + everything else the mailbox holds).
   */
  folderIds?: string[];
  pageSize?: number;
  /**
   * Hard cap on the number of messages yielded per call. Defaults to 500
   * per the prompt's edge cases. When hit, iteration stops cleanly and the
   * caller logs a warning so the next run can resume.
   */
  maxMessages?: number;
  /**
   * @internal Test seam. Defaults to `setTimeout`-based sleep.
   */
  sleep?: (ms: number) => Promise<void>;
  /**
   * @internal Test seam. Override for current time when computing
   * HTTP-date `Retry-After` values.
   */
  now?: () => number;
}

interface RawOdataPage {
  '@odata.nextLink'?: string;
  value?: unknown;
}

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_MESSAGES = 500;
const SELECT_FIELDS = [
  'id',
  'subject',
  'body',
  'from',
  'toRecipients',
  'ccRecipients',
  'bccRecipients',
  'sentDateTime',
  'receivedDateTime',
  'webLink',
  'parentFolderId',
  'isDraft',
].join(',');
const MAX_429_RETRIES = 5;
const SERVER_ERROR_RETRY_DELAY_MS = 10_000;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildInitialUrl(
  userUpn: string,
  sinceISO: string,
  pageSize: number,
  folderId?: string,
): string {
  const upn = encodeURIComponent(userUpn);
  const base = folderId
    ? `${GRAPH_BASE}/users/${upn}/mailFolders/${encodeURIComponent(folderId)}/messages`
    : `${GRAPH_BASE}/users/${upn}/messages`;
  const params = new URLSearchParams();
  params.set('$select', SELECT_FIELDS);
  params.set('$filter', `sentDateTime ge ${sinceISO}`);
  params.set('$orderby', 'sentDateTime asc');
  params.set('$top', String(pageSize));
  return `${base}?${params.toString()}`;
}

function parseRetryAfter(
  header: string | null,
  nowMs: number,
): number | undefined {
  if (header === null || header.length === 0) return undefined;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }
  const dateMs = Date.parse(trimmed);
  if (Number.isNaN(dateMs)) return undefined;
  return Math.max(0, dateMs - nowMs);
}

function normalizePage(raw: unknown): GraphMessagesPage {
  if (typeof raw !== 'object' || raw === null) {
    throw new MsGraphApiError('MS Graph: page response was not an object', {
      status: 200,
    });
  }
  const envelope = raw as RawOdataPage;
  const value = Array.isArray(envelope.value) ? envelope.value : [];
  const nextLink =
    typeof envelope['@odata.nextLink'] === 'string'
      ? envelope['@odata.nextLink']
      : undefined;
  return {
    value: value as GraphMessage[],
    ...(nextLink !== undefined ? { nextLink } : { nextLink: undefined }),
  };
}

async function fetchPageWithRetry(
  client: GraphClient,
  url: string,
  sleep: (ms: number) => Promise<void>,
  nowFn: () => number,
): Promise<GraphMessagesPage> {
  let attempt = 0;
  let serverErrorRetried = false;

  while (true) {
    const response: GraphResponse = await client.request(url);

    if (response.ok) {
      return normalizePage(response.body);
    }

    if (response.status === 429) {
      if (attempt >= MAX_429_RETRIES) {
        throw new MsGraphRateLimitError(
          `MS Graph: 429 retry budget exhausted after ${attempt} attempts`,
          { retries: attempt },
        );
      }
      const retryAfterMs =
        parseRetryAfter(response.headers.get('retry-after'), nowFn()) ??
        1000 * 2 ** attempt;
      attempt += 1;
      await sleep(retryAfterMs);
      continue;
    }

    if (response.status >= 500 && response.status < 600) {
      if (serverErrorRetried) {
        throw new MsGraphApiError(
          `MS Graph: second 5xx after retry (status ${response.status})`,
          { status: response.status },
        );
      }
      serverErrorRetried = true;
      await sleep(SERVER_ERROR_RETRY_DELAY_MS);
      continue;
    }

    throw new MsGraphApiError(
      `MS Graph: request to ${url} failed with status ${response.status}`,
      { status: response.status },
    );
  }
}

/**
 * Yield messages one at a time across all pages and (optionally) all
 * folders. Stops when:
 *   - all pages of all folders are exhausted, or
 *   - the per-run message cap is hit (caller decides what to log), or
 *   - any unrecoverable error is thrown (caller catches).
 */
export async function* fetchMessages(
  client: GraphClient,
  opts: FetchMessagesOptions,
): AsyncIterable<GraphMessage> {
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxMessages = opts.maxMessages ?? DEFAULT_MAX_MESSAGES;
  const sleep = opts.sleep ?? defaultSleep;
  const nowFn = opts.now ?? Date.now;

  const folderTargets =
    opts.folderIds !== undefined && opts.folderIds.length > 0
      ? opts.folderIds
      : [undefined];

  let yielded = 0;
  for (const folderId of folderTargets) {
    let url: string | undefined = buildInitialUrl(
      opts.userUpn,
      opts.sinceISO,
      pageSize,
      folderId,
    );

    while (url !== undefined) {
      const page = await fetchPageWithRetry(client, url, sleep, nowFn);
      for (const msg of page.value) {
        if (yielded >= maxMessages) {
          return;
        }
        yielded += 1;
        yield msg;
      }
      url = page.nextLink;
    }
  }
}

/**
 * Exposed for tests so they can assert URL composition without invoking
 * the full iterator.
 */
export const __internal = {
  buildInitialUrl,
  parseRetryAfter,
  SELECT_FIELDS,
  DEFAULT_PAGE_SIZE,
  DEFAULT_MAX_MESSAGES,
};
