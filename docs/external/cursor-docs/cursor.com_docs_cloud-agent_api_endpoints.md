<!-- Source: https://cursor.com/docs/cloud-agent/api/endpoints -->
<!-- Title: Cloud Agents API | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/cloud-agent/api/endpoints#main-content)

## Command Palette

Search for a command to run...

## API Overview

[Overview](https://cursor.com/docs/api) [Authentication](https://cursor.com/docs/api#authentication) [Rate Limits](https://cursor.com/docs/api#rate-limits) [Best Practices](https://cursor.com/docs/api#best-practices)

## Cloud Agents API

[Overview](https://cursor.com/docs/cloud-agent/api/endpoints) [Create An Agent](https://cursor.com/docs/cloud-agent/api/endpoints#create-an-agent) [List Agents](https://cursor.com/docs/cloud-agent/api/endpoints#list-agents) [Get An Agent](https://cursor.com/docs/cloud-agent/api/endpoints#get-an-agent) [Create A Run](https://cursor.com/docs/cloud-agent/api/endpoints#create-a-run) [List Runs](https://cursor.com/docs/cloud-agent/api/endpoints#list-runs) [Get A Run](https://cursor.com/docs/cloud-agent/api/endpoints#get-a-run) [Stream A Run](https://cursor.com/docs/cloud-agent/api/endpoints#stream-a-run) [Cancel A Run](https://cursor.com/docs/cloud-agent/api/endpoints#cancel-a-run) [List Artifacts](https://cursor.com/docs/cloud-agent/api/endpoints#list-artifacts) [Download Artifact](https://cursor.com/docs/cloud-agent/api/endpoints#download-an-artifact) [Archive An Agent](https://cursor.com/docs/cloud-agent/api/endpoints#archive-an-agent) [Unarchive An Agent](https://cursor.com/docs/cloud-agent/api/endpoints#unarchive-an-agent) [Delete An Agent](https://cursor.com/docs/cloud-agent/api/endpoints#delete-an-agent-permanently) [Worker Tokens](https://cursor.com/docs/cloud-agent/api/endpoints#worker-tokens) [List Workers](https://cursor.com/docs/cloud-agent/api/endpoints#list-workers) [Get Fleet Summary](https://cursor.com/docs/cloud-agent/api/endpoints#get-fleet-summary) [Get Worker By ID](https://cursor.com/docs/cloud-agent/api/endpoints#get-worker-by-id) [List Pending Pool Requests](https://cursor.com/docs/cloud-agent/api/endpoints#list-pending-pool-requests) [API Key Info](https://cursor.com/docs/cloud-agent/api/endpoints#api-key-info) [List Models](https://cursor.com/docs/cloud-agent/api/endpoints#list-models) [List Repositories](https://cursor.com/docs/cloud-agent/api/endpoints#list-github-repositories) [Webhooks](https://cursor.com/docs/cloud-agent/api/webhooks)

## Admin API

[Overview](https://cursor.com/docs/account/teams/admin-api) [Team Members](https://cursor.com/docs/account/teams/admin-api#get-team-members) [Audit Logs](https://cursor.com/docs/account/teams/admin-api#get-audit-logs) [Get Daily Usage Data](https://cursor.com/docs/account/teams/admin-api#get-daily-usage-data) [Spending Data](https://cursor.com/docs/account/teams/admin-api#get-spending-data) [Get Usage Events Data](https://cursor.com/docs/account/teams/admin-api#get-usage-events-data) [User Spend Limit](https://cursor.com/docs/account/teams/admin-api#set-user-spend-limit) [Remove Team Member](https://cursor.com/docs/account/teams/admin-api#remove-team-member) [Get Repo Blocklists](https://cursor.com/docs/account/teams/admin-api#get-team-repo-blocklists) [Upsert Repo Blocklists](https://cursor.com/docs/account/teams/admin-api#upsert-repo-blocklists) [Delete Repo Blocklist](https://cursor.com/docs/account/teams/admin-api#delete-repo-blocklist) [Billing Groups](https://cursor.com/docs/account/teams/admin-api#billing-groups) [List Groups](https://cursor.com/docs/account/teams/admin-api#list-groups) [Get Group](https://cursor.com/docs/account/teams/admin-api#get-group) [Create Group](https://cursor.com/docs/account/teams/admin-api#create-group) [Update Group](https://cursor.com/docs/account/teams/admin-api#update-group) [Delete Group](https://cursor.com/docs/account/teams/admin-api#delete-group) [Add Members to Group](https://cursor.com/docs/account/teams/admin-api#add-members-to-group) [Remove Members from Group](https://cursor.com/docs/account/teams/admin-api#remove-members-from-group)

## Analytics API

[Overview](https://cursor.com/docs/account/teams/analytics-api) [Agent Edits](https://cursor.com/docs/account/teams/analytics-api#agent-edits) [Tab Usage](https://cursor.com/docs/account/teams/analytics-api#tab-usage) [Daily Active Users](https://cursor.com/docs/account/teams/analytics-api#daily-active-users-dau) [Client Versions](https://cursor.com/docs/account/teams/analytics-api#client-versions) [Model Usage](https://cursor.com/docs/account/teams/analytics-api#model-usage) [Top File Extensions](https://cursor.com/docs/account/teams/analytics-api#top-file-extensions) [MCP Adoption](https://cursor.com/docs/account/teams/analytics-api#mcp-adoption) [Commands Adoption](https://cursor.com/docs/account/teams/analytics-api#commands-adoption) [Plans Adoption](https://cursor.com/docs/account/teams/analytics-api#plans-adoption) [Skills Adoption](https://cursor.com/docs/account/teams/analytics-api#skills-adoption) [Ask Mode Adoption](https://cursor.com/docs/account/teams/analytics-api#ask-mode-adoption) [Conversation Insights](https://cursor.com/docs/account/teams/analytics-api#conversation-insights) [Leaderboard](https://cursor.com/docs/account/teams/analytics-api#leaderboard) [Bugbot Analytics](https://cursor.com/docs/account/teams/analytics-api#bugbot-analytics) [By-User Endpoints](https://cursor.com/docs/account/teams/analytics-api#by-user-endpoints)

## AI Code Tracking API

[Overview](https://cursor.com/docs/account/teams/ai-code-tracking-api) [Commit Metrics (JSON)](https://cursor.com/docs/account/teams/ai-code-tracking-api#get-ai-commit-metrics-json-paginated) [Commit Metrics (CSV)](https://cursor.com/docs/account/teams/ai-code-tracking-api#download-ai-commit-metrics-csv-streaming) [Code Changes (JSON)](https://cursor.com/docs/account/teams/ai-code-tracking-api#get-ai-code-change-metrics-json-paginated) [Code Changes (CSV)](https://cursor.com/docs/account/teams/ai-code-tracking-api#download-ai-code-change-metrics-csv-streaming)

API

Copy pageShare feedbackExplain more

# Cloud Agents API

Public beta

The Cloud Agents API v1 is in public beta. APIs may change before general
availability.

The Cloud Agents API lets you programmatically launch and manage cloud agents that work on your repositories.

- The Cloud Agents API accepts both [Basic and Bearer authentication](https://cursor.com/docs/api#authentication). Generate a user API key from [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations), or use a [service account API key](https://cursor.com/docs/account/enterprise/service-accounts).
- For details on authentication methods, rate limits, and best practices, see the [API Overview](https://cursor.com/docs/api).
- View the full [OpenAPI specification](https://cursor.com/docs-static/cloud-agents-openapi.yaml) for detailed schemas and examples.
- Webhooks are coming soon. The legacy [v0 API](https://cursor.com/docs/cloud-agent/api/v0) still supports them — see [Webhooks](https://cursor.com/docs/cloud-agent/api/webhooks).

Migrating from v0?

This API splits work into a durable agent plus per-prompt runs, replacing the flatter v0 surface. The legacy [v0 reference](https://cursor.com/docs/cloud-agent/api/v0) remains available.

## [Endpoints](https://cursor.com/docs/cloud-agent/api/endpoints\#endpoints)

### [Create An Agent](https://cursor.com/docs/cloud-agent/api/endpoints\#create-an-agent)

POST`/v1/agents`

Create a Cloud Agent and immediately enqueue its initial run. The response returns both the durable `agent` and the initial `run`.

#### [Request Body](https://cursor.com/docs/cloud-agent/api/endpoints\#request-body)

`prompt`object (required)

The task prompt for the agent, including optional images.

`prompt.text`string (required)

The instruction text for the agent.

`prompt.images`array (optional)

Image inputs for the prompt. Each entry must include either `data` (base64-encoded bytes with a required `mimeType`) or `url` (an http or https URL that Cursor fetches). Maximum 5 images, 15 MB each. Supported MIME types: `image/png`, `image/jpeg`, `image/gif`, `image/webp`.

`model`object (optional)

Model selection. Omit this field to use the configured default. When omitted, Cursor resolves your user default model, then your team default model, then a system default.

`model.id`string (required if `model` provided)

An explicit model ID returned by `GET /v1/models` (for example, `claude-4-sonnet-thinking`).

`model.params`array (optional)

Per-model parameters to apply to the run, such as reasoning effort or max mode. Each item has an `id` and `value`. Use only parameters supported by the selected model — call `GET /v1/models` to discover the valid `id`/`params` combinations.

`name`string (optional)

Display name for the agent. Maximum 100 characters. When omitted, Cursor auto-derives a name from the prompt.

`env`object (optional)

Execution environment target. Use a named `cloud` environment, or route to a self-hosted `pool` or `machine`. Mutually exclusive with explicit `repos` when selecting a named Cursor-hosted environment.

`env.type`string (required if `env` provided)

Execution environment type. `cloud` uses Cursor-hosted VMs; `pool` and `machine` route to self-hosted workers.

`env.name`string (optional)

Named Cursor-hosted environment, self-hosted pool, or self-hosted machine name.

`repos`array (optional)

Repository configuration. Mutually exclusive with a named cloud environment. Omit both `repos` and `env` to start a no-repo agent. Maximum 20 repositories.

`repos[0].url`string (required)

GitHub repository URL (for example, `https://github.com/your-org/your-repo`). Required on every repo entry, including when `prUrl` is provided.

`repos[0].startingRef`string (optional)

Branch name or commit SHA to use as the starting point. Ignored when `prUrl` is provided.

`repos[0].prUrl`string (optional)

GitHub pull request URL. When provided, the agent works on this PR's repository and branches; `startingRef` is ignored. `url` must still be set on the same `repos` entry.

`workOnCurrentBranch`boolean (optional, default: false)

When `false` (the default), Cursor pushes commits to a new auto-generated branch (`cursor/...`) based on `repos[0].startingRef` (or the PR base ref when `prUrl` is set). When `true`, Cursor pushes directly to that starting ref — for a non-PR create, that's the branch you passed in `startingRef`; for a `prUrl` create, that's the PR's head branch. The branch the agent pushed shows up in the agent's `git.branches[]`.

`autoCreatePR`boolean (optional)

Whether Cursor should open a pull request when the run completes.

`skipReviewerRequest`boolean (optional)

Whether to skip requesting the user as a reviewer when Cursor opens a PR. Only applies when `autoCreatePR` is `true`.

`envVars`object (optional)

Session-scoped environment variables for the cloud agent. Values are encrypted at rest, injected into the agent's shell, and deleted with the agent. Maximum 50 entries; names up to 255 bytes (can't start with `CURSOR_`), values up to 4096 bytes. Cannot be combined with a client-supplied `agentId`.

**Beta:**`envVars` is rolling out. If it isn't enabled for your account yet, the field is silently ignored on create rather than failing the request — verify the values are present by inspecting the agent shell on a first run before relying on them in production.

`mcpServers`array (optional)

Inline MCP server definitions available to the agent. Maximum 50 servers. Remote servers support `headers` or OAuth `auth`; stdio servers run inside the cloud VM and can receive `env`. Server names must be unique.

`mcpServers[0].name`string (required)

The MCP server name exposed to the agent.

`mcpServers[0].type`string (optional)

Transport type: `http`, `sse`, or `stdio`. Defaults to `http` for remote servers with `url`, and `stdio` for servers with `command`.

`mcpServers[0].url`string (required for remote MCP)

HTTP or HTTPS URL for a remote MCP server. URLs with username or password are not allowed.

`mcpServers[0].command`string (required for stdio MCP)

Command to start a stdio MCP server inside the cloud agent VM. Use `args` and `env` for arguments and runtime secrets.

`customSubagents`array (optional)

Define custom subagents the main agent can delegate to during the run. Maximum 20 subagents. Each entry requires `name`, `description`, and `prompt`, plus an optional `model` (model ID string, `ModelSelection` object, or `"inherit"`). Names must be unique and cannot collide with built-ins (`explore`, `debug`, `shell`, `computerUse`, etc.).

`mode`string (optional, default: agent)

Initial conversation mode for the agent's first run. `plan` explores and drafts a plan before coding ( [Plan mode](https://cursor.com/help/ai-features/plan-mode)); `agent` implements changes directly.

`agentId`string (optional)

Client-supplied agent identifier in the form `bc-<uuid>`. Useful for idempotent create flows — re-POSTing the same `agentId` returns `409 agent_id_conflict` rather than creating a duplicate. Cannot be combined with `envVars`; omit `agentId` so the server mints one when you need session secrets.

```
curl --request POST \
  --url https://api.cursor.com/v1/agents \
  -u YOUR_API_KEY: \
  --header 'Content-Type: application/json' \
  --data '{
    "prompt": {
      "text": "Add a README with setup instructions"
    },
    "model": {
      "id": "composer-2",
      "params": [\
        { "id": "fast", "value": "true" }\
      ]
    },
    "repos": [\
      {\
        "url": "https://github.com/your-org/your-repo",\
        "startingRef": "main"\
      }\
    ],
    "mcpServers": [\
      {\
        "name": "linear",\
        "type": "http",\
        "url": "https://mcp.linear.app/sse",\
        "headers": {\
          "Authorization": "Bearer YOUR_LINEAR_API_KEY"\
        }\
      },\
      {\
        "name": "github",\
        "type": "stdio",\
        "command": "npx",\
        "args": ["-y", "@modelcontextprotocol/server-github"],\
        "env": {\
          "GITHUB_TOKEN": "YOUR_GITHUB_TOKEN"\
        }\
      }\
    ],
    "autoCreatePR": true
  }'
```

**Response:**

```
{
  "agent": {
    "id": "bc-00000000-0000-0000-0000-000000000001",
    "name": "Add README with setup instructions",
    "status": "ACTIVE",
    "env": {
      "type": "cloud"
    },
    "repos": [\
      {\
        "url": "https://github.com/your-org/your-repo",\
        "startingRef": "main"\
      }\
    ],
    "workOnCurrentBranch": false,
    "autoCreatePR": true,
    "url": "https://cursor.com/agents/bc-00000000-0000-0000-0000-000000000001",
    "createdAt": "2026-04-13T18:30:00.000Z",
    "updatedAt": "2026-04-13T18:30:00.000Z",
    "latestRunId": "run-00000000-0000-0000-0000-000000000001"
  },
  "run": {
    "id": "run-00000000-0000-0000-0000-000000000001",
    "agentId": "bc-00000000-0000-0000-0000-000000000001",
    "status": "CREATING",
    "createdAt": "2026-04-13T18:30:00.000Z",
    "updatedAt": "2026-04-13T18:30:00.000Z"
  }
}
```

### [List Agents](https://cursor.com/docs/cloud-agent/api/endpoints\#list-agents)

GET`/v1/agents`

List agents for the authenticated user, newest first.

#### [Query Parameters](https://cursor.com/docs/cloud-agent/api/endpoints\#query-parameters)

`limit`number (optional)

Number of agents to return. Default: 20, Max: 100.

`cursor`string (optional)

Pagination cursor from `nextCursor` on the previous response.

`prUrl`string (optional)

Filter agents by GitHub pull request URL.

`includeArchived`boolean (optional, default: true)

Whether to include archived agents in the response.

List items only include the durable identity fields. Call `GET /v1/agents/{id}` to load the full record (`repos`, `workOnCurrentBranch`, `autoCreatePR`, etc.).

`nextCursor` is **omitted** from the response when there are no more pages — it is not returned as `null`. Treat its absence as "no more results".

```
curl --request GET \
  --url 'https://api.cursor.com/v1/agents?limit=20' \
  -u YOUR_API_KEY:
```

**Response:**

```
{
  "items": [\
    {\
      "id": "bc-00000000-0000-0000-0000-000000000001",\
      "name": "Add README with setup instructions",\
      "status": "ACTIVE",\
      "env": {\
        "type": "cloud"\
      },\
      "url": "https://cursor.com/agents/bc-00000000-0000-0000-0000-000000000001",\
      "createdAt": "2026-04-13T18:30:00.000Z",\
      "updatedAt": "2026-04-13T18:45:00.000Z",\
      "latestRunId": "run-00000000-0000-0000-0000-000000000001"\
    }\
  ],
  "nextCursor": "bc-00000000-0000-0000-0000-000000000002"
}
```

### [Get An Agent](https://cursor.com/docs/cloud-agent/api/endpoints\#get-an-agent)

GET`/v1/agents/{id}`

Retrieve durable metadata for an agent. Execution status lives on runs — fetch `latestRunId` and call [Get A Run](https://cursor.com/docs/cloud-agent/api/endpoints#get-a-run) to read run state.

#### [Path Parameters](https://cursor.com/docs/cloud-agent/api/endpoints\#path-parameters)

`id`string

Unique identifier for the agent (for example, `bc-00000000-0000-0000-0000-000000000001`).

```
curl --request GET \
  --url https://api.cursor.com/v1/agents/bc-00000000-0000-0000-0000-000000000001 \
  -u YOUR_API_KEY:
```

**Response:**

```
{
  "id": "bc-00000000-0000-0000-0000-000000000001",
  "name": "Add README with setup instructions",
  "status": "ACTIVE",
  "env": {
    "type": "cloud"
  },
  "repos": [\
    {\
      "url": "https://github.com/your-org/your-repo",\
      "startingRef": "main"\
    }\
  ],
  "workOnCurrentBranch": false,
  "autoCreatePR": true,
  "url": "https://cursor.com/agents/bc-00000000-0000-0000-0000-000000000001",
  "createdAt": "2026-04-13T18:30:00.000Z",
  "updatedAt": "2026-04-13T18:30:00.000Z",
  "latestRunId": "run-00000000-0000-0000-0000-000000000001"
}
```

### [Create A Run](https://cursor.com/docs/cloud-agent/api/endpoints\#create-a-run)

POST`/v1/agents/{id}/runs`

Send a follow-up prompt to an existing active agent. The new run uses the agent's current conversation and workspace state.

Only one run can be active per agent. Calling this while another run is `CREATING` or `RUNNING` returns `409 agent_busy`. Wait for the existing run to terminate, or cancel it.

#### [Path Parameters](https://cursor.com/docs/cloud-agent/api/endpoints\#path-parameters-1)

`id`string

Unique identifier for the agent (for example, `bc-00000000-0000-0000-0000-000000000001`).

#### [Request Body](https://cursor.com/docs/cloud-agent/api/endpoints\#request-body-1)

`prompt`object (required)

The follow-up prompt, including optional images.

`prompt.text`string (required)

The follow-up instruction text.

`prompt.images`array (optional)

Image inputs for the follow-up. Each entry must include either `data` (base64-encoded bytes with a required `mimeType`) or `url`. Maximum 5 images, 15 MB each. Supported MIME types: `image/png`, `image/jpeg`, `image/gif`, `image/webp`.

`mcpServers`array (optional)

Inline MCP server definitions for this follow-up run. When provided, these replace any create-time inline MCP servers for this run. Omit to keep the agent's current MCP configuration.

`mode`string (optional)

Conversation mode override for this follow-up run: `agent` or `plan`. Omit to keep the conversation's current mode from prior runs.

```
curl --request POST \
  --url https://api.cursor.com/v1/agents/bc-00000000-0000-0000-0000-000000000001/runs \
  -u YOUR_API_KEY: \
  --header 'Content-Type: application/json' \
  --data '{
    "prompt": {
      "text": "Also add troubleshooting steps"
    },
    "mcpServers": [\
      {\
        "name": "docs",\
        "type": "http",\
        "url": "https://example.com/mcp"\
      }\
    ]
  }'
```

**Response:**

```
{
  "run": {
    "id": "run-00000000-0000-0000-0000-000000000002",
    "agentId": "bc-00000000-0000-0000-0000-000000000001",
    "status": "CREATING",
    "createdAt": "2026-04-13T18:50:00.000Z",
    "updatedAt": "2026-04-13T18:50:00.000Z"
  }
}
```

### [List Runs](https://cursor.com/docs/cloud-agent/api/endpoints\#list-runs)

GET`/v1/agents/{id}/runs`

List runs for an agent, newest first.

#### [Path Parameters](https://cursor.com/docs/cloud-agent/api/endpoints\#path-parameters-2)

`id`string

Unique identifier for the agent.

#### [Query Parameters](https://cursor.com/docs/cloud-agent/api/endpoints\#query-parameters-1)

`limit`number (optional)

Number of runs to return. Default: 20, Max: 100.

`cursor`string (optional)

Pagination cursor from `nextCursor` on the previous response.

```
curl --request GET \
  --url 'https://api.cursor.com/v1/agents/bc-00000000-0000-0000-0000-000000000001/runs?limit=20' \
  -u YOUR_API_KEY:
```

**Response:**

```
{
  "items": [\
    {\
      "id": "run-00000000-0000-0000-0000-000000000002",\
      "agentId": "bc-00000000-0000-0000-0000-000000000001",\
      "status": "RUNNING",\
      "createdAt": "2026-04-13T18:50:00.000Z",\
      "updatedAt": "2026-04-13T18:51:00.000Z",\
      "git": {\
        "branches": [\
          {\
            "repoUrl": "github.com/your-org/your-repo",\
            "branch": "cursor/add-readme-a1b2"\
          }\
        ]\
      }\
    }\
  ]
}
```

### [Get A Run](https://cursor.com/docs/cloud-agent/api/endpoints\#get-a-run)

GET`/v1/agents/{id}/runs/{runId}`

Retrieve status, timestamps, and (for terminal runs) the final result, duration, and pushed branches for a specific run.

#### [Path Parameters](https://cursor.com/docs/cloud-agent/api/endpoints\#path-parameters-3)

`id`string

Unique identifier for the agent.

`runId`string

Unique identifier for the run (for example, `run-00000000-0000-0000-0000-000000000001`).

#### [Response Fields](https://cursor.com/docs/cloud-agent/api/endpoints\#response-fields)

The base run fields (`id`, `agentId`, `status`, `createdAt`, `updatedAt`) are always present. The following are populated as soon as data is available:

`durationMs`integer (terminal runs)

Wall-clock duration of the run in milliseconds, computed once the run reaches `FINISHED`, `ERROR`, `CANCELLED`, or `EXPIRED`.

`result`string (terminal runs)

Final assistant reply text for a terminated run.

`git`object (when a branch has been pushed)

The agent's current pushed branches and pull requests. `git.branches[]` contains `{ repoUrl, branch?, prUrl? }` entries — one per branch the agent has pushed (stacked agents produce multiple).

**Per-agent state, not per-run.** Every run on the same agent returns the same `git` snapshot. Use the agent's `latestRunId` or the SSE stream to attribute work to a specific run.

`repoUrl` is returned without the scheme (for example, `github.com/your-org/your-repo`) — different from request `repos[].url`, which keeps the `https://` prefix.

```
curl --request GET \
  --url https://api.cursor.com/v1/agents/bc-00000000-0000-0000-0000-000000000001/runs/run-00000000-0000-0000-0000-000000000001 \
  -u YOUR_API_KEY:
```

**Response:**

```
{
  "id": "run-00000000-0000-0000-0000-000000000001",
  "agentId": "bc-00000000-0000-0000-0000-000000000001",
  "status": "FINISHED",
  "createdAt": "2026-04-13T18:30:00.000Z",
  "updatedAt": "2026-04-13T18:45:00.000Z",
  "durationMs": 12357,
  "result": "Added README.md with installation instructions and usage examples.",
  "git": {
    "branches": [\
      {\
        "repoUrl": "github.com/your-org/your-repo",\
        "branch": "cursor/add-readme-a1b2",\
        "prUrl": "https://github.com/your-org/your-repo/pull/123"\
      }\
    ]
  }
}
```

### [Stream A Run](https://cursor.com/docs/cloud-agent/api/endpoints\#stream-a-run)

GET`/v1/agents/{id}/runs/{runId}/stream`

Stream Server-Sent Events (SSE) for one run. The stream is scoped to the requested run and does not replay prior runs.

#### [Event types](https://cursor.com/docs/cloud-agent/api/endpoints\#event-types)

- `status` — run status update. Payload: `{ runId, status }`.
- `assistant` — assistant text delta. Payload: `{ text }`.
- `thinking` — thinking text delta. Payload: `{ text }`.
- `tool_call` — tool call status update. Payload: `{ callId, name, status, args?, result?, truncated? }`.
- `interaction_update` — optional richer event emitted alongside the simplified events above. Payload matches the `InteractionUpdate` shape consumed by the [TypeScript SDK](https://cursor.com/docs/sdk/typescript), with subtypes like `text-delta`, `tool-call-started` / `tool-call-completed`, `step-started` / `step-completed`, and `turn-ended`. If you only need plain text and tool calls, handle the simplified events and ignore `interaction_update`. If you want the full SDK-shape stream, handle `interaction_update` and ignore the simplified events.
- `heartbeat` — keepalive event. Payload: `{}`.
- `result` — terminal run status. Payload: `{ runId, status, text?, durationMs?, git? }`. `text` is the final assistant reply, `durationMs` is the wall-clock run duration in milliseconds, and `git` mirrors `Run.git` (the agent's current pushed branches, not just this run's).
- `error` — stream error. Payload: `{ code, message }`.
- `done` — stream complete. Payload: `{}`.

#### [Tool call payloads](https://cursor.com/docs/cloud-agent/api/endpoints\#tool-call-payloads)

`tool_call` events use a stable envelope around tool-specific inputs and outputs:

```
type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

interface ToolCallEventData {
  callId: string;
  name: string;
  status: "running" | "completed";
  args?: JsonValue;
  result?: JsonValue;
  truncated?: {
    args?: true;
    result?: true;
  };
}
```

`callId` identifies one tool invocation across updates. `name` is the public tool name, such as `read_file`, `run_terminal_cmd`, or `mcp`. `args` and `result` are tool-specific JSON values. If `args` or `result` is too large to include in the stream, Cursor omits that field and sets the matching `truncated` flag.

#### [Resuming a stream](https://cursor.com/docs/cloud-agent/api/endpoints\#resuming-a-stream)

Most events include an `id` line — an opaque string you should not parse (current format looks like `1713033006000-0`, but treat it as opaque). The leading `status` event has no `id` — it is a sticky framing event that is re-sent at the top of every reconnect.

To resume after a disconnect, reconnect with `Last-Event-ID` set to the most recent received event id. The event id must belong to the requested run; otherwise the request returns `400 invalid_last_event_id`. After a successful resume, expect another `status` event before the resumed range begins.

#### [Retention](https://cursor.com/docs/cloud-agent/api/endpoints\#retention)

Stream responses include the `X-Cursor-Stream-Retention-Seconds` header. After the retention window elapses, this endpoint may return `410 stream_expired`. Treat that as a signal to read terminal state via [Get A Run](https://cursor.com/docs/cloud-agent/api/endpoints#get-a-run) instead of retrying the stream.

```
curl --request GET \
  --url https://api.cursor.com/v1/agents/bc-00000000-0000-0000-0000-000000000001/runs/run-00000000-0000-0000-0000-000000000001/stream \
  -u YOUR_API_KEY: \
  --header 'Accept: text/event-stream'
```

**Example stream:**

```
event: status
data: {"runId":"run-00000000-0000-0000-0000-000000000001","status":"RUNNING"}

id: 1713033000000-0
event: assistant
data: {"text":"I'll update the README now."}

id: 1713033005000-0
event: tool_call
data: {"callId":"call-1","name":"read_file","status":"running","args":{"path":"README.md"}}

id: 1713033006000-0
event: tool_call
data: {"callId":"call-1","name":"read_file","status":"completed","args":{"path":"README.md"},"result":{"success":{"content":"# Project","totalLines":1,"fileSize":9,"path":"README.md"}}}

id: 1713033010000-0
event: result
data: {"runId":"run-00000000-0000-0000-0000-000000000001","status":"FINISHED","text":"Added README.md with installation instructions.","durationMs":12357,"git":{"branches":[{"repoUrl":"github.com/your-org/your-repo","branch":"cursor/add-readme-a1b2"}]}}

id: 1713033010000-0
event: done
data: {}
```

### [Cancel A Run](https://cursor.com/docs/cloud-agent/api/endpoints\#cancel-a-run)

POST`/v1/agents/{id}/runs/{runId}/cancel`

Cancel the active run for an agent. Cancellation is terminal — the run transitions to `CANCELLED` and cannot be resumed. To continue the conversation, create a new run on the same agent.

Cancelling a run that is already in a terminal state, or one that was never active, returns `409 run_not_cancellable`.

#### [Path Parameters](https://cursor.com/docs/cloud-agent/api/endpoints\#path-parameters-4)

`id`string

Unique identifier for the agent.

`runId`string

Unique identifier for the run to cancel.

```
curl --request POST \
  --url https://api.cursor.com/v1/agents/bc-00000000-0000-0000-0000-000000000001/runs/run-00000000-0000-0000-0000-000000000001/cancel \
  -u YOUR_API_KEY:
```

**Response:**

```
{
  "id": "run-00000000-0000-0000-0000-000000000001"
}
```

## [Artifacts](https://cursor.com/docs/cloud-agent/api/endpoints\#artifacts)

Artifacts are agent-scoped because the workspace persists across runs.

### [List Artifacts](https://cursor.com/docs/cloud-agent/api/endpoints\#list-artifacts)

GET`/v1/agents/{id}/artifacts`

List artifacts produced by an agent. Each artifact's `path` is relative to the workspace's `artifacts/` directory.

Pass the `path` value returned here directly to [Download An Artifact](https://cursor.com/docs/cloud-agent/api/endpoints#download-an-artifact). v1 paths are relative; absolute v0 paths (`/opt/cursor/artifacts/...`) are not accepted.

#### [Path Parameters](https://cursor.com/docs/cloud-agent/api/endpoints\#path-parameters-5)

`id`string

Unique identifier for the agent.

```
curl --request GET \
  --url https://api.cursor.com/v1/agents/bc-00000000-0000-0000-0000-000000000001/artifacts \
  -u YOUR_API_KEY:
```

**Response:**

```
{
  "items": [\
    {\
      "path": "artifacts/screenshot.png",\
      "sizeBytes": 12345,\
      "updatedAt": "2026-04-13T18:45:00.000Z"\
    }\
  ]
}
```

### [Download An Artifact](https://cursor.com/docs/cloud-agent/api/endpoints\#download-an-artifact)

GET`/v1/agents/{id}/artifacts/download`

Retrieve a temporary 15-minute presigned S3 URL for a specific artifact.

#### [Path Parameters](https://cursor.com/docs/cloud-agent/api/endpoints\#path-parameters-6)

`id`string

Unique identifier for the agent.

#### [Query Parameters](https://cursor.com/docs/cloud-agent/api/endpoints\#query-parameters-2)

`path`string

Relative artifact path returned by [List Artifacts](https://cursor.com/docs/cloud-agent/api/endpoints#list-artifacts) (for example, `artifacts/screenshot.png`). Must be under `artifacts/`.

```
curl --request GET \
  --url 'https://api.cursor.com/v1/agents/bc-00000000-0000-0000-0000-000000000001/artifacts/download?path=artifacts/screenshot.png' \
  -u YOUR_API_KEY:
```

**Response:**

```
{
  "url": "https://cloud-agent-artifacts.s3.us-east-1.amazonaws.com/...",
  "expiresAt": "2026-04-13T19:00:00.000Z"
}
```

## [Agent Lifecycle](https://cursor.com/docs/cloud-agent/api/endpoints\#agent-lifecycle)

### [Archive An Agent](https://cursor.com/docs/cloud-agent/api/endpoints\#archive-an-agent)

POST`/v1/agents/{id}/archive`

Archive an agent. Archived agents remain readable but cannot accept new runs until unarchived. Use this for reversible "soft delete" flows.

Archive is idempotent — re-archiving an already-archived agent returns `200` with no change. You don't need to check current state before calling.

#### [Path Parameters](https://cursor.com/docs/cloud-agent/api/endpoints\#path-parameters-7)

`id`string

Unique identifier for the agent.

```
curl --request POST \
  --url https://api.cursor.com/v1/agents/bc-00000000-0000-0000-0000-000000000001/archive \
  -u YOUR_API_KEY:
```

**Response:**

```
{
  "id": "bc-00000000-0000-0000-0000-000000000001"
}
```

### [Unarchive An Agent](https://cursor.com/docs/cloud-agent/api/endpoints\#unarchive-an-agent)

POST`/v1/agents/{id}/unarchive`

Unarchive an agent so it can accept new runs again.

Unarchive is idempotent — calling it on an already-active agent returns `200` with no change.

#### [Path Parameters](https://cursor.com/docs/cloud-agent/api/endpoints\#path-parameters-8)

`id`string

Unique identifier for the agent.

```
curl --request POST \
  --url https://api.cursor.com/v1/agents/bc-00000000-0000-0000-0000-000000000001/unarchive \
  -u YOUR_API_KEY:
```

**Response:**

```
{
  "id": "bc-00000000-0000-0000-0000-000000000001"
}
```

### [Delete An Agent Permanently](https://cursor.com/docs/cloud-agent/api/endpoints\#delete-an-agent-permanently)

DELETE`/v1/agents/{id}`

Permanently delete an agent. This action is irreversible. Use [Archive](https://cursor.com/docs/cloud-agent/api/endpoints#archive-an-agent) for reversible removal.

#### [Path Parameters](https://cursor.com/docs/cloud-agent/api/endpoints\#path-parameters-9)

`id`string

Unique identifier for the agent.

```
curl --request DELETE \
  --url https://api.cursor.com/v1/agents/bc-00000000-0000-0000-0000-000000000001 \
  -u YOUR_API_KEY:
```

**Response:**

```
{
  "id": "bc-00000000-0000-0000-0000-000000000001"
}
```

## [Worker Tokens](https://cursor.com/docs/cloud-agent/api/endpoints\#worker-tokens)

### [Create A User-Scoped Worker Token](https://cursor.com/docs/cloud-agent/api/endpoints\#create-a-user-scoped-worker-token)

POST`/v1/sub-tokens`

Create a one-hour user-scoped token for a [My Machines](https://cursor.com/docs/cloud-agent/my-machines) worker to run as an active team member.

Requires an agent-scoped team service account API key. User-scoped tokens can't mint other user-scoped tokens.

The returned token expires after 1 hour and cannot refresh itself. Mint a new token with the service account API key when you need to refresh a running worker.

#### [Request Body](https://cursor.com/docs/cloud-agent/api/endpoints\#request-body-2)

Specify exactly one of the following to identify the target user:

`forUserEmail`string (optional)

Active team member email. Case-insensitive.

`forUserId`integer (optional)

Active team member's numeric Cursor user ID.

By email:

```
curl --request POST \
  --url https://api.cursor.com/v1/sub-tokens \
  --header "Authorization: Bearer $CURSOR_SERVICE_ACCOUNT_API_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "forUserEmail": "alice@company.com"
  }'
```

By user ID:

```
curl --request POST \
  --url https://api.cursor.com/v1/sub-tokens \
  --header "Authorization: Bearer $CURSOR_SERVICE_ACCOUNT_API_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "forUserId": 42
  }'
```

**Response:**

```
{
  "accessToken": "eyJ...",
  "expiresAt": "2026-04-24T19:00:00.000Z",
  "userId": 42,
  "teamId": 456
}
```

## [Fleet Management](https://cursor.com/docs/cloud-agent/api/endpoints\#fleet-management)

Monitor pool worker utilization and build autoscaling against self-hosted Cloud Agent pools. See [Self-Hosted Pool](https://cursor.com/docs/cloud-agent/self-hosted-pool#fleet-management-api) for background.

Authenticate with the pool's service account API key via Basic auth or Bearer token. Other API key types are rejected.

### [List Workers](https://cursor.com/docs/cloud-agent/api/endpoints\#list-workers)

GET`/v0/private-workers`

List self-hosted pool workers for the authenticated service account's team, newest first.

#### [Query Parameters](https://cursor.com/docs/cloud-agent/api/endpoints\#query-parameters-3)

`status`string (optional, default: `all`)

Filter by worker status. One of `all`, `in_use`, or `idle`.

`limit`integer (optional, default: 50)

Results per page. Range: 1 to 100.

`nextPageToken`string (optional)

Pagination cursor from the previous response.

```
curl --request GET \
  --url "https://api.cursor.com/v0/private-workers?status=idle&limit=50" \
  -u "$CURSOR_API_KEY:"
```

### [Get Fleet Summary](https://cursor.com/docs/cloud-agent/api/endpoints\#get-fleet-summary)

GET`/v0/private-workers/summary`

Return connected and in-use worker counts for the authenticated user and their team. Use this to trigger scaling decisions when utilization is high.

```
curl --request GET \
  --url "https://api.cursor.com/v0/private-workers/summary" \
  -u "$CURSOR_API_KEY:"
```

**Example scaling check:**

```
const summary = await response.json();
const team = summary.teamSummary;
if (team && team.totalConnected > 0) {
  const utilization = team.inUse / team.totalConnected;
  if (utilization >= 0.9) {
    // Scale up: provision additional workers
  }
}
```

### [Get Worker By ID](https://cursor.com/docs/cloud-agent/api/endpoints\#get-worker-by-id)

GET`/v0/private-workers/{id}`

Retrieve a single self-hosted pool worker by its ID.

#### [Path Parameters](https://cursor.com/docs/cloud-agent/api/endpoints\#path-parameters-10)

`id`string

Unique identifier for the worker (for example, `pw_123`).

```
curl --request GET \
  --url "https://api.cursor.com/v0/private-workers/pw_123" \
  -u "$CURSOR_API_KEY:"
```

### [List Pending Pool Requests](https://cursor.com/docs/cloud-agent/api/endpoints\#list-pending-pool-requests)

GET`/v0/private-workers/pending-requests`

List self-hosted pool requests that have not been assigned to a worker yet. Use this endpoint to scale capacity when users are waiting for an available pool worker.

This endpoint requires a service account API key. It returns requests for the key's team and excludes My Machines requests. If the key is scoped to specific repositories, pass `repository`; the repository must be in the key's allowed scope.

#### [Query Parameters](https://cursor.com/docs/cloud-agent/api/endpoints\#query-parameters-4)

`limit`number (optional)

Number of pending requests to return. Default: 50, Max: 100.

`pageToken`string (optional)

Pagination cursor from the previous response.

`repository`string (optional)

Filter by repository URL. Required for repo-scoped service account API keys.

```
curl --request GET \
  --url "https://api.cursor.com/v0/private-workers/pending-requests?limit=50&repository=https%3A%2F%2Fgithub.com%2Facme%2Fpayments-service" \
  -u "$CURSOR_API_KEY:"
```

**Response:**

```
{
  "requests": [\
    {\
      "id": "bc-00000000-0000-0000-0000-000000000002",\
      "userId": 321,\
      "serviceAccountId": "sa_abc123",\
      "repoOwner": "acme",\
      "repoName": "payments-service",\
      "repoUrl": "https://github.com/acme/payments-service",\
      "labels": [\
        { "key": "repo", "value": "acme/payments-service" },\
        { "key": "pool", "value": "gpu" },\
        { "key": "env", "value": "production" }\
      ],\
      "createdAtMs": 1737306880000\
    }\
  ],
  "nextPageToken": "eyJjcmVhdGVkQXRNcyI6MTczNzMwNjg4MDAwMH0="
}
```

`repoUrl` omits embedded credentials when the original repository URL includes userinfo.

## [Metadata Endpoints](https://cursor.com/docs/cloud-agent/api/endpoints\#metadata-endpoints)

### [API Key Info](https://cursor.com/docs/cloud-agent/api/endpoints\#api-key-info)

GET`/v1/me`

Retrieve information about the API key being used for authentication.

#### [Response Fields](https://cursor.com/docs/cloud-agent/api/endpoints\#response-fields-1)

`apiKeyName`string

Display name of the API key.

`createdAt`string

When the API key was created (ISO 8601).

`userId`integer (user-scoped keys)

Numeric Cursor user ID of the API key's owner. Omitted for service-account / team API keys, which aren't tied to a specific user.

`userEmail`string (user-scoped keys)

Email address of the API key's owner.

`userFirstName`, `userLastName`string (user-scoped keys)

First and last name of the API key's owner, when populated.

```
curl --request GET \
  --url https://api.cursor.com/v1/me \
  -u YOUR_API_KEY:
```

**Response (user-scoped key):**

```
{
  "apiKeyName": "Production API Key",
  "userId": 42,
  "createdAt": "2026-04-13T18:30:00.000Z",
  "userEmail": "developer@example.com",
  "userFirstName": "Alex",
  "userLastName": "Rivera"
}
```

**Response (service-account key):**

```
{
  "apiKeyName": "Production Service Account",
  "createdAt": "2026-04-13T18:30:00.000Z"
}
```

### [List Models](https://cursor.com/docs/cloud-agent/api/endpoints\#list-models)

GET`/v1/models`

Returns the recommended models you can pass to the `model.id` field on [Create An Agent](https://cursor.com/docs/cloud-agent/api/endpoints#create-an-agent), along with the parameters and variants each model accepts. Model parameters use the same `model.params` shape as the [TypeScript SDK ModelSelection](https://cursor.com/docs/sdk/typescript#modelselection).

To use the configured default model, omit `model` from the request body entirely. Cursor resolves your user default model, then your team default model, then a system default.

#### [Response Fields](https://cursor.com/docs/cloud-agent/api/endpoints\#response-fields-2)

Each item in `items` describes one model:

`id`string

Pass this value as `model.id` when creating an agent.

`displayName`string

Human-readable name shown in the Cursor UI.

`description`string (optional)

Short description of the model.

`aliases`array (optional)

Alternate IDs that resolve to the same model (for example, `composer-latest`).

`parameters`array (optional)

Per-model parameter definitions. Each entry has an `id`, optional `displayName`, and a `values` array of permitted `{ value, displayName? }` entries. Use these to populate `model.params` on the create request.

`variants`array (optional)

Concrete `id`+`params` combinations the model accepts. Each entry has a `params` array (which may be empty), a `displayName`, an optional `description`, and an optional `isDefault` flag.

```
curl --request GET \
  --url https://api.cursor.com/v1/models \
  -u YOUR_API_KEY:
```

**Response:**

```
{
  "items": [\
    {\
      "id": "composer-2",\
      "displayName": "Composer 2",\
      "aliases": ["composer-latest", "composer"],\
      "parameters": [\
        {\
          "id": "fast",\
          "displayName": "Fast",\
          "values": [\
            { "value": "false" },\
            { "value": "true", "displayName": "Fast" }\
          ]\
        }\
      ],\
      "variants": [\
        {\
          "params": [{ "id": "fast", "value": "true" }],\
          "displayName": "Composer 2",\
          "isDefault": true\
        },\
        {\
          "params": [{ "id": "fast", "value": "false" }],\
          "displayName": "Composer 2"\
        }\
      ]\
    },\
    {\
      "id": "claude-4.6-sonnet-thinking",\
      "displayName": "Claude 4.6 Sonnet (Thinking)",\
      "variants": [\
        {\
          "params": [],\
          "displayName": "Claude 4.6 Sonnet (Thinking)",\
          "isDefault": true\
        }\
      ]\
    }\
  ]
}
```

### [List GitHub Repositories](https://cursor.com/docs/cloud-agent/api/endpoints\#list-github-repositories)

GET`/v1/repositories`

List GitHub repositories accessible to the authenticated user through Cursor's GitHub App installation.

**This endpoint has very strict rate limits.**

Limit requests to **1 / user / minute**, and **30 / user / hour.**

This request can take tens of seconds to respond for users with access to many repositories.

Make sure to handle this information not being available gracefully.

```
curl --request GET \
  --url https://api.cursor.com/v1/repositories \
  -u YOUR_API_KEY:
```

**Response:**

```
{
  "items": [\
    {\
      "url": "https://github.com/your-org/your-repo"\
    }\
  ]
}
```

English

- English
- 简体中文
- 日本語
- 繁體中文
- Español
- Français
- Português
- 한국어
- Русский
- Türkçe
- Bahasa Indonesia
- Deutsch
- हिन्दी

Agent

Tokenizer OffContext: 0/200k (0%)

Open chat