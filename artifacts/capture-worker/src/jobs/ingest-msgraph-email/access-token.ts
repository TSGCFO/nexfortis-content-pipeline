/**
 * Microsoft Entra ID `client_credentials` access-token acquisition.
 *
 * No refresh-token plumbing: with application permissions there is no user
 * context, so the token endpoint is hit fresh whenever a token is needed.
 * Tokens typically live ~60min; the caller caches in memory for one Inngest
 * run and proactively refreshes within 60s of `expiresAt`.
 *
 * The function is exported as a small, easily-mockable pure function: tests
 * stub `fetch` (or pass in a custom `fetchImpl`) and assert the request body
 * shape directly.
 */

import { AccessTokenError } from './errors.js';

export interface FetchAccessTokenOptions {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  /**
   * @internal Test seam. Production code lets this default to global `fetch`.
   */
  fetchImpl?: typeof fetch;
  /**
   * @internal Test seam. Production code defaults to `Date.now`.
   */
  now?: () => number;
}

export interface AccessTokenResult {
  accessToken: string;
  /** Absolute epoch ms after which the token is treated as expired. */
  expiresAt: number;
}

/**
 * Safety margin subtracted from the upstream `expires_in` to avoid races at
 * the boundary. The caller is expected to also refresh proactively within
 * this same window.
 */
const EXPIRY_SAFETY_MARGIN_MS = 60_000;

function assertEnvString(value: string | undefined, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AccessTokenError(
      `MS Graph access token: required env var ${name} is missing or empty.`,
    );
  }
  return value;
}

interface TokenEndpointSuccess {
  access_token: string;
  expires_in: number;
  token_type?: string;
}

export async function fetchAccessToken(
  opts: FetchAccessTokenOptions,
): Promise<AccessTokenResult> {
  const tenantId = assertEnvString(opts.tenantId, 'MS_GRAPH_TENANT_ID');
  const clientId = assertEnvString(opts.clientId, 'MS_GRAPH_CLIENT_ID');
  const clientSecret = assertEnvString(
    opts.clientSecret,
    'MS_GRAPH_CLIENT_SECRET',
  );
  const fetchImpl = opts.fetchImpl ?? fetch;
  const nowFn = opts.now ?? Date.now;

  const url = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  });

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });
  } catch (err) {
    throw new AccessTokenError(
      'MS Graph access token: network error contacting login.microsoftonline.com',
      { cause: err },
    );
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch (err) {
    throw new AccessTokenError(
      `MS Graph access token: response body was not JSON (status ${response.status})`,
      { cause: err, status: response.status },
    );
  }

  if (!response.ok) {
    const errCode =
      typeof (parsed as { error?: unknown })?.error === 'string'
        ? (parsed as { error: string }).error
        : 'unknown_error';
    throw new AccessTokenError(
      `MS Graph access token: token endpoint returned ${response.status} (${errCode})`,
      { status: response.status },
    );
  }

  const success = parsed as Partial<TokenEndpointSuccess>;
  if (typeof success.access_token !== 'string' || success.access_token.length === 0) {
    throw new AccessTokenError(
      'MS Graph access token: response missing `access_token` field',
      { status: response.status },
    );
  }
  if (typeof success.expires_in !== 'number' || !Number.isFinite(success.expires_in)) {
    throw new AccessTokenError(
      'MS Graph access token: response missing valid numeric `expires_in` field',
      { status: response.status },
    );
  }

  const expiresAt = nowFn() + success.expires_in * 1000 - EXPIRY_SAFETY_MARGIN_MS;
  return { accessToken: success.access_token, expiresAt };
}
