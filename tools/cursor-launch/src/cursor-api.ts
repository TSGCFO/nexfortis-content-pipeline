/**
 * Tiny REST client for the Cursor Cloud Agents API v1.
 *
 * Designed to work with the credential proxy (api_credentials=['custom-cred:api.cursor.com']):
 * uses plain global fetch which respects HTTPS_PROXY, so the API key never
 * enters this process's env vars. The proxy injects `Authorization: Bearer <key>`.
 *
 * If CURSOR_API_KEY is set in the environment, we add the Authorization header
 * ourselves (for local dev outside the proxy). If it isn't, we omit the header
 * and trust the proxy.
 *
 * Verified endpoints against `docs/external/cursor-docs/cursor.com_docs_cloud-agent_api_endpoints.md`.
 */

import { ProxyAgent, setGlobalDispatcher } from 'undici';

import { REQUIRED_ENV } from './config.js';

import type {
  CreateAgentRequest,
  CreateAgentResponse,
  ListModelsResponse,
  Run,
  StreamEvent,
} from './types.js';

const API_BASE = 'https://api.cursor.com';

// Node's global fetch (undici) does NOT honor HTTPS_PROXY by default. If the
// env var is set (typically when running through the Perplexity credential
// proxy), we explicitly configure undici's global dispatcher so all fetch
// calls in this process route through it. This is what lets us run without
// CURSOR_API_KEY in env — the proxy injects Authorization on outbound
// requests to api.cursor.com.
let proxyConfigured = false;
function ensureProxyConfigured(): void {
  if (proxyConfigured) return;
  const proxyUrl = process.env.HTTPS_PROXY ?? process.env.https_proxy;
  if (proxyUrl) {
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
  }
  proxyConfigured = true;
}

function authHeaders(): Record<string, string> {
  const key = process.env[REQUIRED_ENV.cursorApiKey];
  if (key) {
    return { Authorization: `Bearer ${key}` };
  }
  // No env key — assume the credential proxy will inject auth.
  return {};
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const parsed = JSON.parse(text);
      detail = JSON.stringify(parsed);
    } catch {
      // leave as raw text
    }
    throw new CursorApiError(
      `Cursor API ${res.status} ${res.statusText}: ${detail}`,
      res.status,
    );
  }
  if (!text) {
    throw new CursorApiError('Cursor API returned empty body', res.status);
  }
  return JSON.parse(text) as T;
}

export class CursorApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'CursorApiError';
  }
}

// ─── GET /v1/models ──────────────────────────────────────────────────────────

export async function listModels(signal?: AbortSignal): Promise<ListModelsResponse> {
  ensureProxyConfigured();
  const fetchInit: RequestInit = {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...authHeaders(),
    },
  };
  if (signal) fetchInit.signal = signal;
  const res = await fetch(`${API_BASE}/v1/models`, fetchInit);
  return readJson<ListModelsResponse>(res);
}

// ─── POST /v1/agents ─────────────────────────────────────────────────────────

export async function createAgent(
  body: CreateAgentRequest,
  signal?: AbortSignal,
): Promise<CreateAgentResponse> {
  ensureProxyConfigured();
  const fetchInit: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  };
  if (signal) fetchInit.signal = signal;
  const res = await fetch(`${API_BASE}/v1/agents`, fetchInit);
  return readJson<CreateAgentResponse>(res);
}

// ─── GET /v1/agents/{id}/runs/{runId} ────────────────────────────────────────

export async function getRun(
  agentId: string,
  runId: string,
  signal?: AbortSignal,
): Promise<Run> {
  ensureProxyConfigured();
  const fetchInit: RequestInit = {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...authHeaders(),
    },
  };
  if (signal) fetchInit.signal = signal;
  const res = await fetch(
    `${API_BASE}/v1/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}`,
    fetchInit,
  );
  return readJson<Run>(res);
}

// ─── GET /v1/agents/{id}/runs/{runId}/stream (SSE) ───────────────────────────

/**
 * Subscribes to the SSE stream for a run and yields parsed events.
 *
 * SSE format per cursor.com_docs_cloud-agent_api_endpoints.md (Stream A Run):
 *   id: <opaque>\n
 *   event: <event-type>\n
 *   data: <json>\n
 *   \n
 *
 * The first `status` event has no id (sticky framing event).
 * On 410 stream_expired the stream simply ends; caller should fall back
 * to getRun() to read terminal state.
 */
export async function* streamRun(
  agentId: string,
  runId: string,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent, void, void> {
  ensureProxyConfigured();
  const fetchInit: RequestInit = {
    method: 'GET',
    headers: {
      Accept: 'text/event-stream',
      ...authHeaders(),
    },
  };
  if (signal) fetchInit.signal = signal;

  const res = await fetch(
    `${API_BASE}/v1/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}/stream`,
    fetchInit,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new CursorApiError(
      `Cursor stream ${res.status} ${res.statusText}: ${text}`,
      res.status,
    );
  }
  if (!res.body) {
    throw new CursorApiError('Cursor stream returned no body', res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Split on blank lines (one event per blank-line-terminated block)
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const event = parseSseEvent(rawEvent);
        if (event) yield event;
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

function parseSseEvent(raw: string): StreamEvent | null {
  let eventType: string | undefined;
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith(':')) continue; // blank / comment
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const field = line.slice(0, colon);
    const value = line.slice(colon + 1).replace(/^ /, '');
    if (field === 'event') eventType = value;
    else if (field === 'data') dataLines.push(value);
    // ignore `id:` and `retry:` for now — caller doesn't resume here
  }
  if (!eventType) return null;
  const dataStr = dataLines.join('\n');
  let payload: Record<string, unknown> = {};
  if (dataStr) {
    try {
      payload = JSON.parse(dataStr) as Record<string, unknown>;
    } catch {
      // Unparseable data — skip
      return null;
    }
  }
  // Compose the event with `type` from the SSE event line
  return { type: eventType, ...payload } as StreamEvent;
}
