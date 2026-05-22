import { describe, expect, it, vi } from 'vitest';

import {
  fetchAccessToken,
  type FetchAccessTokenOptions,
} from '../../../artifacts/capture-worker/src/jobs/ingest-msgraph-email/access-token.js';
import { AccessTokenError } from '../../../artifacts/capture-worker/src/jobs/ingest-msgraph-email/errors.js';

function makeFetchOk(body: unknown, status = 200): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

function makeFetchStatus(status: number, body: unknown): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

const BASE_OPTS: Pick<FetchAccessTokenOptions, 'tenantId' | 'clientId' | 'clientSecret'> = {
  tenantId: 'test-tenant',
  clientId: 'test-client',
  clientSecret: 'test-secret',
};

describe('fetchAccessToken', () => {
  it('returns accessToken and expiresAt computed from now + expires_in - 60s safety margin', async () => {
    const now = 1_700_000_000_000;
    const fetchImpl = makeFetchOk({
      access_token: 'AT-123',
      expires_in: 3600,
      token_type: 'Bearer',
    });
    const result = await fetchAccessToken({
      ...BASE_OPTS,
      fetchImpl,
      now: () => now,
    });
    expect(result.accessToken).toBe('AT-123');
    expect(result.expiresAt).toBe(now + 3600 * 1000 - 60_000);
  });

  it('throws AccessTokenError on 400 (invalid_client)', async () => {
    const fetchImpl = makeFetchStatus(400, {
      error: 'invalid_client',
      error_description: 'AADSTS7000215: Invalid client secret provided.',
    });
    await expect(
      fetchAccessToken({ ...BASE_OPTS, fetchImpl, now: () => 1 }),
    ).rejects.toBeInstanceOf(AccessTokenError);
  });

  it('throws AccessTokenError on 401 (bad secret)', async () => {
    const fetchImpl = makeFetchStatus(401, {
      error: 'invalid_client',
    });
    await expect(
      fetchAccessToken({ ...BASE_OPTS, fetchImpl, now: () => 1 }),
    ).rejects.toBeInstanceOf(AccessTokenError);
  });

  it('throws AccessTokenError when fetch itself throws (network error)', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNRESET');
    }) as unknown as typeof fetch;
    const err = await fetchAccessToken({
      ...BASE_OPTS,
      fetchImpl,
      now: () => 1,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AccessTokenError);
  });

  it('throws AccessTokenError when response is missing access_token', async () => {
    const fetchImpl = makeFetchOk({ expires_in: 3600 });
    await expect(
      fetchAccessToken({ ...BASE_OPTS, fetchImpl, now: () => 1 }),
    ).rejects.toBeInstanceOf(AccessTokenError);
  });

  it('throws AccessTokenError when response is missing expires_in', async () => {
    const fetchImpl = makeFetchOk({ access_token: 'AT-XYZ' });
    await expect(
      fetchAccessToken({ ...BASE_OPTS, fetchImpl, now: () => 1 }),
    ).rejects.toBeInstanceOf(AccessTokenError);
  });

  it('posts grant_type=client_credentials and scope=…/.default in the request body', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, ...(init !== undefined ? { init } : {}) });
      return new Response(
        JSON.stringify({ access_token: 'AT', expires_in: 3600 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    await fetchAccessToken({ ...BASE_OPTS, fetchImpl, now: () => 1 });

    expect(calls.length).toBe(1);
    expect(calls[0]?.url).toContain(
      'login.microsoftonline.com/test-tenant/oauth2/v2.0/token',
    );
    const body = calls[0]?.init?.body;
    expect(typeof body).toBe('string');
    const params = new URLSearchParams(body as string);
    expect(params.get('grant_type')).toBe('client_credentials');
    expect(params.get('scope')).toBe('https://graph.microsoft.com/.default');
    expect(params.get('client_id')).toBe('test-client');
    expect(params.get('client_secret')).toBe('test-secret');
  });

  it.each([
    ['tenantId', { tenantId: '', clientId: 'c', clientSecret: 's' }],
    ['clientId', { tenantId: 't', clientId: '', clientSecret: 's' }],
    ['clientSecret', { tenantId: 't', clientId: 'c', clientSecret: '' }],
  ])(
    'throws AccessTokenError synchronously before any HTTP call when %s is missing',
    async (_label, partial) => {
      const fetchImpl = vi.fn() as unknown as typeof fetch;
      await expect(
        fetchAccessToken({ ...partial, fetchImpl, now: () => 1 }),
      ).rejects.toBeInstanceOf(AccessTokenError);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );
});
