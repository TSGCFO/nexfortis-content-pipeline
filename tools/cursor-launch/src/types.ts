/**
 * Types for the Cursor Cloud Agents REST API v1.
 *
 * Verified against docs in `docs/external/cursor-docs/`:
 *  - cursor.com_docs_cloud-agent_api_endpoints.md (Create An Agent, List Models, Stream A Run)
 *  - Live API at https://api.cursor.com/v1/models (snapshot at docs/external/cursor-models.json)
 */

// ─── /v1/models ──────────────────────────────────────────────────────────────

export interface ModelParameter {
  id: string;
  displayName?: string;
  values: Array<{ value: string; displayName?: string }>;
}

export interface ModelVariant {
  params: Array<{ id: string; value: string }>;
  displayName: string;
  description?: string;
  isDefault?: boolean;
}

export interface Model {
  id: string;
  displayName: string;
  description?: string;
  aliases?: string[];
  parameters?: ModelParameter[];
  variants?: ModelVariant[];
}

export interface ListModelsResponse {
  items: Model[];
}

// ─── /v1/agents (create) ─────────────────────────────────────────────────────

export interface CreateAgentRequest {
  prompt: {
    text: string;
    images?: Array<
      | { data: string; mimeType: string }
      | { url: string }
    >;
  };
  model?: {
    id: string;
    params?: Array<{ id: string; value: string }>;
  };
  name?: string;
  repos?: Array<{
    url: string;
    startingRef?: string;
    prUrl?: string;
  }>;
  workOnCurrentBranch?: boolean;
  autoCreatePR?: boolean;
  skipReviewerRequest?: boolean;
  envVars?: Record<string, string>;
  mcpServers?: Array<McpServerDef>;
  mode?: 'plan' | 'agent';
  agentId?: string;
}

export interface McpServerDef {
  name: string;
  type?: 'http' | 'sse' | 'stdio';
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface CreateAgentResponse {
  agent: {
    id: string;
    name: string;
    status: 'ACTIVE' | 'ARCHIVED';
    env: { type: string; name?: string };
    repos?: Array<{ url: string; startingRef?: string; prUrl?: string }>;
    workOnCurrentBranch: boolean;
    autoCreatePR: boolean;
    url: string;
    createdAt: string;
    updatedAt: string;
    latestRunId: string;
  };
  run: {
    id: string;
    agentId: string;
    status: RunStatus;
    createdAt: string;
    updatedAt: string;
  };
}

export type RunStatus =
  | 'CREATING'
  | 'RUNNING'
  | 'FINISHED'
  | 'ERROR'
  | 'CANCELLED'
  | 'EXPIRED';

// ─── /v1/agents/{id}/runs/{runId} (get) ──────────────────────────────────────

export interface Run {
  id: string;
  agentId: string;
  status: RunStatus;
  result?: string;
  durationMs?: number;
  git?: {
    branches?: Array<{
      branch: string;
      prUrl?: string;
    }>;
  };
  createdAt: string;
  updatedAt: string;
}

// ─── SSE stream events ───────────────────────────────────────────────────────

export type StreamEvent =
  | { type: 'status'; runId: string; status: RunStatus }
  | { type: 'assistant'; text: string }
  | { type: 'thinking'; text: string }
  | {
      type: 'tool_call';
      callId: string;
      name: string;
      status: 'running' | 'completed';
      args?: unknown;
      result?: unknown;
      truncated?: { args?: true; result?: true };
    }
  | { type: 'interaction_update'; [key: string]: unknown }
  | { type: 'heartbeat' }
  | {
      type: 'result';
      runId: string;
      status: RunStatus;
      text?: string;
      durationMs?: number;
      git?: Run['git'];
    }
  | { type: 'error'; code: string; message: string }
  | { type: 'done' };
