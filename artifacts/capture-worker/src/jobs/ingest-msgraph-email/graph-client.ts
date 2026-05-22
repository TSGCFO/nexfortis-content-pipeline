/**
 * Typed wrapper around Microsoft Graph's `/v1.0` REST surface.
 *
 * Holds the current `client_credentials` access token in memory for the
 * duration of one Inngest run, proactively refreshes within a 60s safety
 * window, and refreshes-once-then-retries on 401 responses. A second 401
 * surfaces as `MsGraphAuthError` and aborts the run.
 *
 * Implementation note: we use native `fetch` (already a Node 22+ global)
 * rather than the `@microsoft/microsoft-graph-client` SDK's `Client` so we
 * can read the `Retry-After` header off the raw 429 response — the SDK
 * collapses error responses into a `GraphError` that does not expose
 * headers. The SDK package is still declared as a runtime dependency per the
 * prompt's allowlist for future expansion (subscriptions, batch endpoints,
 * etc.) where its middleware chain becomes useful.
 * TODO(hassan): if the SDK adds first-class Retry-After surfacing, revisit
 * and switch the wrapper to use `Client.api(...)` for parity with other
 * Graph integrations.
 */

import { MsGraphApiError, MsGraphAuthError } from './errors.js';
import type { AccessTokenResult } from './access-token.js';

export interface TokenFetcher {
  (): Promise<AccessTokenResult>;
}

export interface GraphResponse<T = unknown> {
  status: number;
  ok: boolean;
  headers: Headers;
  body: T;
}

export interface GraphClientOptions {
  initialToken: AccessTokenResult;
  fetchToken: TokenFetcher;
  /**
   * @internal Test seam. Defaults to global `fetch`.
   */
  fetchImpl?: typeof fetch;
  /**
   * @internal Test seam. Defaults to `Date.now`.
   */
  now?: () => number;
}

/**
 * Safety margin within which a still-valid token is proactively refreshed.
 * Matches `EXPIRY_SAFETY_MARGIN_MS` in `access-token.ts`.
 */
const PROACTIVE_REFRESH_MS = 60_000;

export class GraphClient {
  private accessToken: string;
  private expiresAt: number;
  private readonly fetchToken: TokenFetcher;
  private readonly fetchImpl: typeof fetch;
  private readonly nowFn: () => number;

  constructor(opts: GraphClientOptions) {
    this.accessToken = opts.initialToken.accessToken;
    this.expiresAt = opts.initialToken.expiresAt;
    this.fetchToken = opts.fetchToken;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.nowFn = opts.now ?? Date.now;
  }

  /**
   * Force-refresh the in-memory token. Exposed for tests; production code
   * relies on `request` to call this when it sees a 401.
   */
  async forceRefresh(): Promise<void> {
    const next = await this.fetchToken();
    this.accessToken = next.accessToken;
    this.expiresAt = next.expiresAt;
  }

  /**
   * Issue an authorized GET to a Graph API URL. Returns the raw response
   * envelope (status + headers + parsed JSON body) so callers can implement
   * their own 429 / 5xx policies based on header values.
   *
   * - On 401: refresh the token once and retry once. A second 401 throws
   *   `MsGraphAuthError`.
   * - All other statuses: return the envelope. Callers branch on
   *   `response.status` and `response.headers` to decide retry/abort.
   * - Network errors: thrown as `MsGraphApiError(status=0)` so callers see
   *   a single error surface.
   */
  async request<T = unknown>(url: string): Promise<GraphResponse<T>> {
    if (this.nowFn() >= this.expiresAt - PROACTIVE_REFRESH_MS) {
      await this.forceRefresh();
    }

    const first = await this.doFetch<T>(url);
    if (first.status !== 401) {
      return first;
    }

    await this.forceRefresh();
    const second = await this.doFetch<T>(url);
    if (second.status === 401) {
      throw new MsGraphAuthError(
        'MS Graph: second 401 after token refresh — aborting run. Check app permissions and admin consent.',
      );
    }
    return second;
  }

  private async doFetch<T>(url: string): Promise<GraphResponse<T>> {
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: 'application/json',
        },
      });
    } catch (err) {
      throw new MsGraphApiError(
        `MS Graph: network error contacting ${url}`,
        { status: 0, cause: err },
      );
    }

    let body: T;
    try {
      body = (await response.json()) as T;
    } catch (err) {
      // Empty body on 4xx/5xx is legal; coerce to {} so callers branch on
      // `status` rather than body shape.
      if (!response.ok) {
        body = {} as T;
      } else {
        throw new MsGraphApiError(
          `MS Graph: response body was not JSON (status ${response.status})`,
          { status: response.status, cause: err },
        );
      }
    }

    return {
      status: response.status,
      ok: response.ok,
      headers: response.headers,
      body,
    };
  }
}
