import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchMessages,
  __internal,
} from '../../../artifacts/capture-worker/src/jobs/ingest-msgraph-email/fetch-messages.js';
import {
  GraphClient,
} from '../../../artifacts/capture-worker/src/jobs/ingest-msgraph-email/graph-client.js';
import {
  MsGraphAuthError,
} from '../../../artifacts/capture-worker/src/jobs/ingest-msgraph-email/errors.js';
import type {
  GraphMessage,
  GraphMessagesPage,
} from '../../../artifacts/capture-worker/src/jobs/ingest-msgraph-email/types.js';

// Load the committed fixture (real captured Graph response with PII
// scrubbed) directly — never hand-rewrite the shape in test code.
const FIXTURE_PATH = resolve(
  __dirname,
  '../../../docs/integration-contracts/fixtures/msgraph-message-sample.json',
);
interface FixtureEnvelope {
  '@odata.context': string;
  '@odata.nextLink'?: string;
  value: GraphMessage[];
}
const fixture: FixtureEnvelope = JSON.parse(
  readFileSync(FIXTURE_PATH, 'utf-8'),
) as FixtureEnvelope;

const NOW = 1_700_000_000_000;
const FAR_FUTURE = NOW + 60 * 60 * 1000;

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function makeMockClient(
  responses: Array<() => Promise<{
    body: unknown;
    status?: number;
    headers?: Record<string, string>;
  }>>,
): { client: { request: ReturnType<typeof vi.fn> } } {
  let i = 0;
  const request = vi.fn(async () => {
    if (i >= responses.length) {
      throw new Error(`unexpected extra request at index ${i}`);
    }
    const fn = responses[i++];
    const r = await fn!();
    return {
      status: r.status ?? 200,
      ok: (r.status ?? 200) >= 200 && (r.status ?? 200) < 300,
      headers: new Headers(r.headers ?? {}),
      body: r.body,
    };
  });
  return { client: { request } };
}

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iter) out.push(item);
  return out;
}

describe('fetchMessages — page iteration via committed fixture', () => {
  it('yields exactly the fixture single message when the second page is empty', async () => {
    const { client } = makeMockClient([
      () => Promise.resolve({ body: fixture }),
      () => Promise.resolve({ body: { value: [] } }),
    ]);
    const messages = await collect(
      fetchMessages(client as unknown as GraphClient, {
        userUpn: 'user@example.com',
        sinceISO: '2026-05-01T00:00:00Z',
      }),
    );
    expect(messages.length).toBe(1);
    expect(messages[0]?.id).toBe(fixture.value[0]?.id);
    expect(client.request).toHaveBeenCalledTimes(2);
  });

  it('walks @odata.nextLink across multiple pages and yields in order', async () => {
    const msgA = { ...fixture.value[0], id: 'msg-A' } as GraphMessage;
    const msgB = { ...fixture.value[0], id: 'msg-B' } as GraphMessage;
    const msgC = { ...fixture.value[0], id: 'msg-C' } as GraphMessage;
    const { client } = makeMockClient([
      () =>
        Promise.resolve({
          body: {
            '@odata.nextLink': 'https://graph.microsoft.com/v1.0/page2',
            value: [msgA, msgB],
          } satisfies Partial<FixtureEnvelope> & { value: GraphMessage[] },
        }),
      () =>
        Promise.resolve({
          body: {
            value: [msgC],
          } satisfies { value: GraphMessage[] },
        }),
    ]);
    const messages = await collect(
      fetchMessages(client as unknown as GraphClient, {
        userUpn: 'user@example.com',
        sinceISO: '2026-05-01T00:00:00Z',
      }),
    );
    expect(messages.map((m) => m.id)).toEqual(['msg-A', 'msg-B', 'msg-C']);
  });

  it('stops iteration once the 500-message cap is reached', async () => {
    // Page contains 600 messages, but the cap should halt at 500.
    const bigPage: GraphMessagesPage = {
      value: Array.from({ length: 600 }, (_, i) => ({
        ...(fixture.value[0] as GraphMessage),
        id: `msg-${i}`,
      })),
      nextLink: undefined,
    };
    const { client } = makeMockClient([
      () => Promise.resolve({ body: bigPage }),
    ]);
    const messages = await collect(
      fetchMessages(client as unknown as GraphClient, {
        userUpn: 'user@example.com',
        sinceISO: '2026-05-01T00:00:00Z',
      }),
    );
    expect(messages.length).toBe(500);
    expect(messages[0]?.id).toBe('msg-0');
    expect(messages[499]?.id).toBe('msg-499');
  });

  it('uses the contract-documented $select projection in the request URL', () => {
    // Indirect assertion: the SELECT_FIELDS internal constant matches the
    // documented contract. We verify each contract-required field appears.
    const required = [
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
    ];
    for (const f of required) {
      expect(__internal.SELECT_FIELDS.split(',')).toContain(f);
    }
    // And direct assertion: buildInitialUrl bakes them in.
    const url = __internal.buildInitialUrl(
      'user@example.com',
      '2026-05-01T00:00:00Z',
      100,
    );
    expect(url).toContain('%24select=');
    const params = new URL(url).searchParams;
    expect(params.get('$select')).toBe(__internal.SELECT_FIELDS);
    expect(params.get('$filter')).toBe('sentDateTime ge 2026-05-01T00:00:00Z');
    expect(params.get('$orderby')).toBe('sentDateTime asc');
    expect(params.get('$top')).toBe('100');
  });
});

describe('fetchMessages — retry / auth behavior via real GraphClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('honors Retry-After: 2 on 429 and retries successfully', async () => {
    const fetchImpl = vi.fn();
    // 1st call → 429 with Retry-After: 2
    fetchImpl.mockResolvedValueOnce(
      new Response('{}', {
        status: 429,
        headers: { 'Retry-After': '2' },
      }),
    );
    // 2nd call → success with the fixture
    fetchImpl.mockResolvedValueOnce(
      jsonResponse({ value: [fixture.value[0]] }),
    );

    const tokenFetcher = vi.fn(async () => ({
      accessToken: 'AT-1',
      expiresAt: FAR_FUTURE,
    }));
    const client = new GraphClient({
      initialToken: { accessToken: 'AT-1', expiresAt: FAR_FUTURE },
      fetchToken: tokenFetcher,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => NOW,
    });

    const iter = fetchMessages(client, {
      userUpn: 'user@example.com',
      sinceISO: '2026-05-01T00:00:00Z',
      sleep: (ms) => new Promise((res) => setTimeout(res, ms)),
      now: () => NOW,
    });

    const next = iter[Symbol.asyncIterator]().next();
    await vi.advanceTimersByTimeAsync(2000);
    const first = await next;
    expect(first.done).toBe(false);
    expect((first.value as GraphMessage).id).toBe(fixture.value[0]?.id);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('refreshes the token once on 401 and retries the request', async () => {
    const fetchImpl = vi.fn();
    // 1st request: 401
    fetchImpl.mockResolvedValueOnce(
      new Response('{"error":"unauthorized"}', { status: 401 }),
    );
    // 2nd request (after token refresh): success
    fetchImpl.mockResolvedValueOnce(
      jsonResponse({ value: [fixture.value[0]] }),
    );

    const tokenFetcher = vi
      .fn<() => Promise<{ accessToken: string; expiresAt: number }>>()
      .mockResolvedValue({ accessToken: 'AT-NEW', expiresAt: FAR_FUTURE });
    const client = new GraphClient({
      initialToken: { accessToken: 'AT-OLD', expiresAt: FAR_FUTURE },
      fetchToken: tokenFetcher,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => NOW,
    });

    const messages = await collect(
      fetchMessages(client, {
        userUpn: 'user@example.com',
        sinceISO: '2026-05-01T00:00:00Z',
      }),
    );
    expect(messages.length).toBe(1);
    // tokenFetcher invoked exactly once (the on-401 refresh). The initial
    // token came in via `initialToken` and was not fetched by the client.
    expect(tokenFetcher).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws MsGraphAuthError when a second 401 arrives after refresh', async () => {
    const fetchImpl = vi.fn();
    fetchImpl.mockResolvedValueOnce(
      new Response('{"error":"unauthorized"}', { status: 401 }),
    );
    fetchImpl.mockResolvedValueOnce(
      new Response('{"error":"unauthorized"}', { status: 401 }),
    );

    const tokenFetcher = vi
      .fn<() => Promise<{ accessToken: string; expiresAt: number }>>()
      .mockResolvedValue({ accessToken: 'AT-NEW', expiresAt: FAR_FUTURE });
    const client = new GraphClient({
      initialToken: { accessToken: 'AT-OLD', expiresAt: FAR_FUTURE },
      fetchToken: tokenFetcher,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => NOW,
    });

    await expect(
      collect(
        fetchMessages(client, {
          userUpn: 'user@example.com',
          sinceISO: '2026-05-01T00:00:00Z',
        }),
      ),
    ).rejects.toBeInstanceOf(MsGraphAuthError);
  });
});
