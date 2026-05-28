<!-- Source: https://cursor.com/docs/cloud-agent/self-hosted-pool -->
<!-- Title: Self-Hosted Pool | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/cloud-agent/self-hosted-pool#main-content)

## Command Palette

Search for a command to run...

## Get Started

[Welcome](https://cursor.com/docs) [Quickstart](https://cursor.com/docs/get-started/quickstart)
Models & Pricing
[Changelog](https://cursor.com/changelog)

## Agent

[Overview](https://cursor.com/docs/agent/overview) [Agents Window](https://cursor.com/docs/agent/agents-window) [Agent Review](https://cursor.com/docs/agent/agent-review) [Planning](https://cursor.com/docs/agent/plan-mode) [Prompting](https://cursor.com/docs/agent/prompting) [Debugging](https://cursor.com/docs/agent/debug-mode)
Tools
[Security](https://cursor.com/docs/agent/security)

## Customizing

[Plugins](https://cursor.com/docs/plugins) [Rules](https://cursor.com/docs/rules) [Skills](https://cursor.com/docs/skills) [Subagents](https://cursor.com/docs/subagents) [Hooks](https://cursor.com/docs/hooks) [MCP](https://cursor.com/docs/mcp)

## Cloud Agents

[Overview](https://cursor.com/docs/cloud-agent) [Setup](https://cursor.com/docs/cloud-agent/setup) [Capabilities](https://cursor.com/docs/cloud-agent/capabilities) [My Machines](https://cursor.com/docs/cloud-agent/my-machines) [Self-Hosted Pool](https://cursor.com/docs/cloud-agent/self-hosted-pool) [Google Cloud Run](https://cursor.com/docs/cloud-agent/self-hosted-cloud-run) [Bugbot](https://cursor.com/docs/bugbot) [Automations](https://cursor.com/docs/cloud-agent/automations) [Best Practices](https://cursor.com/docs/cloud-agent/best-practices) [Security Agents](https://cursor.com/docs/security-agents) [Security & Network](https://cursor.com/docs/cloud-agent/security-network) [Settings](https://cursor.com/docs/cloud-agent/settings) [API](https://cursor.com/docs/cloud-agent/api/endpoints)

## Integrations

[Slack](https://cursor.com/docs/integrations/slack) [Microsoft Teams](https://cursor.com/docs/integrations/microsoft-teams) [Jira](https://cursor.com/docs/integrations/jira) [Linear](https://cursor.com/docs/integrations/linear) [GitHub](https://cursor.com/docs/integrations/github) [GitLab](https://cursor.com/docs/integrations/gitlab) [JetBrains](https://cursor.com/docs/integrations/jetbrains) [Xcode](https://cursor.com/docs/integrations/xcode) [Deeplinks](https://cursor.com/docs/reference/deeplinks)

## SDK

[TypeScript](https://cursor.com/docs/sdk/typescript) [Python](https://cursor.com/docs/sdk/python)

## CLI

[Overview](https://cursor.com/docs/cli/overview) [Installation](https://cursor.com/docs/cli/installation) [Capabilities](https://cursor.com/docs/cli/using) [Shell Mode](https://cursor.com/docs/cli/shell-mode) [ACP](https://cursor.com/docs/cli/acp) [Headless / CI](https://cursor.com/docs/cli/headless)
Reference

## Teams & Enterprise

Teams

Enterprise

Cloud Agents

# Self-Hosted Pool

Self-Hosted Pool is for Enterprise teams that want Cloud Agents to run inside company-managed infrastructure. Instead of each developer starting a worker on a personal machine, admins operate a pool of workers that can be assigned to agents across the organization.

Use a pool when you need:

- Centrally managed workers for a team or organization
- Service account authentication instead of individual browser logins
- Kubernetes, autoscaling, or fleet management
- Labels that route work to the right environment, team, repo, or hardware profile
- Enterprise controls around network access, secrets, build outputs, and monitoring

For a fast personal setup, see [My Machines](https://cursor.com/docs/cloud-agent/my-machines).

## [How it works](https://cursor.com/docs/cloud-agent/self-hosted-pool\#how-it-works)

A worker opens a long-lived outbound HTTPS connection to Cursor's cloud. The agent loop (inference and planning) runs in Cursor's cloud and sends tool calls over this connection. The worker executes those tool calls locally in your infrastructure: terminal commands, file edits, browser actions, and access to internal services.

Your repos, build caches, secrets, and tool execution stay in your environment while Cursor handles orchestration, model access, and the Cloud Agent experience. Cloud Agent [artifacts](https://cursor.com/docs/cloud-agent/self-hosted-pool#artifacts), like screenshots and videos, are uploaded to Cursor so you can view them in PRs and the dashboard.

Workers only need outbound access. No inbound ports, public IPs, or VPN tunnels are required. See [Networking](https://cursor.com/docs/cloud-agent/self-hosted-pool#networking) for the full list of required hosts.

Self-Hosted Cloud Agents support up to 10 workers per user and 50 per team. For larger company-wide deployments, [contact us](https://cursor.com/contact-sales?source=self-hosted-agents) to discuss scaling.

## [Prerequisites](https://cursor.com/docs/cloud-agent/self-hosted-pool\#prerequisites)

- A **Cursor Enterprise plan**
- Self-hosted settings configured by a team admin in the [Cloud Agents dashboard](https://cursor.com/dashboard/cloud-agents#self-hosted-agents):

  - **Allow Self-Hosted Agents** lets users opt in to self-hosted runs.
  - **Require Self-Hosted Agents** routes every Cloud Agent run to self-hosted workers.
- A [service account API key](https://cursor.com/docs/account/enterprise/service-accounts) for pool worker authentication
- A worker machine or image with:
  - `agent` CLI installed
  - `git` installed and available on `PATH`
  - A cloned repository with a configured remote
  - Access to the build tools, package registries, secrets, and internal services your agents need

## [Install the CLI](https://cursor.com/docs/cloud-agent/self-hosted-pool\#install-the-cli)

```
# macOS, Linux, and WSL
curl https://cursor.com/install -fsS | bash

# Windows PowerShell
irm 'https://cursor.com/install?win32=true' | iex
```

Confirm the CLI is available:

```
agent --version
```

## [Authenticate workers](https://cursor.com/docs/cloud-agent/self-hosted-pool\#authenticate-workers)

Pool workers must authenticate with a [service account API key](https://cursor.com/docs/account/enterprise/service-accounts).

User, personal, team, and organization API keys can't start pool workers. Use personal or user API keys with personal workers on [My Machines](https://cursor.com/docs/cloud-agent/my-machines).

```
export CURSOR_API_KEY="your-service-account-api-key"
```

You can also pass the key directly:

```
agent worker start --api-key "your-service-account-api-key"
```

## [Start a pool worker](https://cursor.com/docs/cloud-agent/self-hosted-pool\#start-a-pool-worker)

Run the worker from the git repo it should serve:

```
cd /path/to/repo
agent worker start --pool
```

`--pool` registers the worker for pool assignment. Each Cloud Agent session claims one worker at a time. For orchestrated environments, combine it with `--idle-release-timeout` so the process exits cleanly after work completes:

```
agent worker start --pool --idle-release-timeout 600
```

`--idle-release-timeout` keeps the worker alive for a window (in seconds) after a session ends to handle follow-up messages. If a follow-up arrives, the timer resets. Once the timeout fires, the CLI exits with code 0.

## [Pool names](https://cursor.com/docs/cloud-agent/self-hosted-pool\#pool-names)

Group pool workers under a name when you want sessions to route to a specific subset, like GPU machines, a staging fleet, or a team's dedicated build boxes.

The `--pool-name` flag tags the worker with a `pool=<name>` label the backend uses for routing:

```
agent worker start --pool --pool-name gpu
```

When `--pool-name` is omitted, the worker joins the `default` pool. Workers from CLI versions that predate the flag also match the default pool, so you can roll out pool names gradually without disrupting existing fleets.

Set the pool name from the environment when an orchestrator injects config:

```
export CURSOR_WORKER_POOL_NAME=gpu
agent worker start --pool
```

`--pool-name` requires `--pool` (or the legacy `--single-use` alias). Multi-use workers don't belong to a pool.

From the [Cloud Agents dashboard](https://cursor.com/dashboard/cloud-agents), pick a pool in the worker selector when starting a session or editing an automation. You can also include `pool=<name>` in a Slack, GitHub, or Linear trigger. Sessions route only to workers registered with that pool name.

## [Triggering pool agents](https://cursor.com/docs/cloud-agent/self-hosted-pool\#triggering-pool-agents)

Use pool triggers when you want a Cloud Agent to run on your team's shared worker fleet. Pool workers are the right target for centrally managed capacity, autoscaling, CI-like runners, and repo-scoped infrastructure.

Team admins control self-hosted routing from the Self-Hosted section of the [Cloud Agents dashboard](https://cursor.com/dashboard/cloud-agents). **Allow Self-Hosted Agents** lets users opt in per request. Without opt-in, runs use Cursor's managed infrastructure. **Require Self-Hosted Agents** routes Cloud Agent runs to self-hosted workers.

When Cursor starts a pool agent, it matches workers with labels. Every pool request includes a `repo=<owner/repo>` label. Requests for a named pool also include `pool=<name>`.

Pool workers handle:

- Runs covered by **Require Self-Hosted Agents**, unless the request targets a specific My Machines worker with `worker=` or `machine=`
- Requests with `self_hosted=true`, `self_hosted`, or `selfhosted`
- Requests with `pool=<name>`, which also selects that named pool
- Self-hosted requests with repository selection from the trigger surface, such as `repo=<owner/repo>` where supported

`repo=` selects the repository for the run. For self-hosted pool runs, that repository becomes the `repo=<owner/repo>` worker label. It does not target a personal machine.

Use these options from integrations to start pool agents:

- **Slack**: Mention `@Cursor` with `self_hosted=true`, standalone `self_hosted`, `selfhosted`, or `pool=<name>`. Legacy aliases like `private_worker=true`, `useprivateworker`, and `useprivateworkers=false` still work.
- **GitHub**: Comment `@cursoragent self_hosted=true ...` or `@cursoragent pool=<name> ...` on an issue, pull request, or review comment. The legacy `private_worker=true` alias still works.
- **Linear**: Add `pool=<name>` or `[pool=<name>]` to the issue body. You can also use issue or project labels where the parent label is `pool` and the child label is the value. Linear does not parse standalone `self_hosted=true`.

Policy handling depends on where the request starts:

- **Slack** rejects self-hosted opt-in when Allow Self-Hosted Agents is off and replies in Slack. If Require Self-Hosted Agents is on, every Slack mention runs self-hosted.
- **GitHub** lets repo `OWNER` and `COLLABORATOR` users route runs to self-hosted workers. Other commenters run on managed infrastructure when they opt in, or are skipped if Require Self-Hosted Agents is on. This protects public repos where outside contributors can leave comments.
- **Linear** rejects explicit self-hosted requests when Allow Self-Hosted Agents is off. The issue gets an agent activity error that asks an admin to turn on self-hosted workers or remove the hint to run on Cursor's managed infrastructure.

To target one of your own machines by name, use [My Machines](https://cursor.com/docs/cloud-agent/my-machines#trigger-this-machine-from-a-chat-surface) with `worker=` or `machine=`.

The Cloud Agent API uses the same resolver with `usePrivateWorker` and `labels` fields. See the [Cloud Agent API docs](https://cursor.com/docs/cloud-agent/api/endpoints) for endpoint details.

## [Hooks](https://cursor.com/docs/cloud-agent/self-hosted-pool\#hooks)

Self-hosted workers run project hooks committed in your repository through `.cursor/hooks.json`.

If you're on Enterprise, self-hosted workers also support team hooks and enterprise-managed hooks.

See [Hooks](https://cursor.com/docs/hooks) for configuration details.

## [Labels](https://cursor.com/docs/cloud-agent/self-hosted-pool\#labels)

Labels are key-value pairs that describe a worker. They control how Cloud Agent sessions route to the right pool.

CLI flagsJSON fileTOML fileEnvironment variable

Good for quick testing or small pools:

```
agent worker start --pool \
  --label team=backend \
  --label env=production
```

The `repo` and `pool` labels are reserved. `repo` comes from the worker directory's git remote. `pool` is set by [`--pool-name`](https://cursor.com/docs/cloud-agent/self-hosted-pool#pool-names). Don't set either manually.

## [MCP servers](https://cursor.com/docs/cloud-agent/self-hosted-pool\#mcp-servers)

MCP servers on self-hosted workers are routed by transport type:

| Transport | Runs on | Use case |
| --- | --- | --- |
| Command (stdio) | Worker | The MCP process starts on the worker and can reach private networks, internal APIs, and services behind your firewall. |
| HTTP / SSE (url) | Cursor backend | Cursor handles OAuth, session caching, and auth for HTTP-based MCP servers. |

If your MCP server needs to access private-network endpoints, use the command (stdio) transport. The process runs directly on the worker and shares its network. For HTTP-based MCP servers, Cursor manages the connection from its backend, handling OAuth and session caching.

## [Artifacts](https://cursor.com/docs/cloud-agent/self-hosted-pool\#artifacts)

Artifact behavior is identical on self-hosted workers and Cursor-hosted agents. The agent produces the artifact inside the worker and the worker uploads it to Cursor-managed storage over HTTPS. Everything downstream (PR embeds, dashboard previews, notification attachments) is handled by Cursor's backend and doesn't depend on where the worker runs.

Artifacts are on by default. See [Capabilities](https://cursor.com/docs/cloud-agent/capabilities#demos-and-artifacts) for what they look like in the UI.

To disable artifact uploads, block outbound traffic to `cloud-agent-artifacts.s3.us-east-1.amazonaws.com`. The agent session keeps working; artifacts produced during the session fail to upload.

## [Networking](https://cursor.com/docs/cloud-agent/self-hosted-pool\#networking)

Workers need outbound HTTPS access to:

- `api2.cursor.sh` and `api2direct.cursor.sh` for the agent session
- `cloud-agent-artifacts.s3.us-east-1.amazonaws.com` for [artifact](https://cursor.com/docs/cloud-agent/self-hosted-pool#artifacts) uploads

If your firewall can only match wildcards, `*.s3.us-east-1.amazonaws.com` covers the artifact host, but also opens every other bucket in the region. Prefer an exact-host rule when the firewall supports it.

No inbound ports, public IPs, or VPN tunnels are required. If you use a proxy, set `HTTPS_PROXY` or `https_proxy` in the worker environment.

### [Failure modes](https://cursor.com/docs/cloud-agent/self-hosted-pool\#failure-modes)

| If you block... | Effect |
| --- | --- |
| `api2.cursor.sh` or `api2direct.cursor.sh` | The worker can't start or continue an agent session. |
| `cloud-agent-artifacts.s3.us-east-1.amazonaws.com` | Artifact uploads fail. PR embeds, dashboard previews, and notification attachments that depend on artifacts are missing. The agent session and other tool calls keep working. |
| An outbound host a specific tool or integration needs | Only that tool or integration fails. The agent continues. |

The [Prerequisites](https://cursor.com/docs/cloud-agent/self-hosted-pool#prerequisites) section covers the broader set of hosts a worker needs during agent runs (git hosts, package registries, internal APIs).

## [Kubernetes](https://cursor.com/docs/cloud-agent/self-hosted-pool\#kubernetes)

We provide a Helm chart and Kubernetes operator for managing worker pools at scale. See the [Kubernetes deployment guide](https://cursor.com/docs/cloud-agent/self-hosted-k8s) for setup instructions.

## [Reference deployments](https://cursor.com/docs/cloud-agent/self-hosted-pool\#reference-deployments)

The [self-hosted Cloud Agents cookbook](https://github.com/cursor/cookbook/tree/main/self-hosted-cloud-agent) has Terraform and Helm examples for running worker pools on AWS:

- [EC2 + Docker](https://github.com/cursor/cookbook/tree/main/self-hosted-cloud-agent/ec2): one worker container on a single host. The smallest footprint.
- [ECS/Fargate](https://github.com/cursor/cookbook/tree/main/self-hosted-cloud-agent/ecs): AWS-native service with CloudWatch metrics and ECS Service Auto Scaling.
- [EKS + Helm](https://github.com/cursor/cookbook/tree/main/self-hosted-cloud-agent/eks): Kubernetes path using Cursor's worker-set controller and `WorkerDeployment` resources.

Each guide has an architecture overview and a copy-paste setup README.

## [Fleet management API](https://cursor.com/docs/cloud-agent/self-hosted-pool\#fleet-management-api)

For non-Kubernetes environments, use the fleet management API to monitor utilization and build autoscaling. See the [Cloud Agents API reference](https://cursor.com/docs/cloud-agent/api/endpoints#fleet-management) for the full endpoint list.

Authenticate with the pool's service account API key via Basic auth or Bearer token. Other API key types can't manage pool worker fleet capacity.

### [List workers](https://cursor.com/docs/cloud-agent/self-hosted-pool\#list-workers)

```
curl --request GET \
  --url "https://api.cursor.com/v0/private-workers?status=idle&limit=50" \
  -u "$CURSOR_API_KEY:"
```

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `status` | `all` \| `in_use` \| `idle` | `all` | Filter by worker status |
| `limit` | integer (1-100) | `50` | Results per page |
| `nextPageToken` | string |  | Pagination cursor |

### [Get summary](https://cursor.com/docs/cloud-agent/self-hosted-pool\#get-summary)

```
curl --request GET \
  --url "https://api.cursor.com/v0/private-workers/summary" \
  -u "$CURSOR_API_KEY:"
```

Returns connected and in-use counts for your user and team. Use this to trigger scaling when utilization is high:

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

### [Get worker by ID](https://cursor.com/docs/cloud-agent/self-hosted-pool\#get-worker-by-id)

```
curl --request GET \
  --url "https://api.cursor.com/v0/private-workers/pw_123" \
  -u "$CURSOR_API_KEY:"
```

## [Monitoring](https://cursor.com/docs/cloud-agent/self-hosted-pool\#monitoring)

The management server exposes `GET /metrics`, `GET /healthz`, and `GET /readyz` when you start a worker with `--management-addr`:

```
agent worker start --pool --management-addr ":8080"
```

Scrape metrics from your worker:

```
curl http://localhost:8080/metrics
```

### [Available metrics](https://cursor.com/docs/cloud-agent/self-hosted-pool\#available-metrics)

**Gauges**

| Metric | Type | Description |
| --- | --- | --- |
| `cursor_self_hosted_worker_connected` | Gauge | `1` when the outbound connection to Cursor's cloud is active, `0` otherwise. |
| `cursor_self_hosted_worker_session_active` | Gauge | `1` when a cloud agent session is running on this worker, `0` when idle. |
| `cursor_self_hosted_worker_last_activity_unix_seconds` | Gauge | Unix timestamp of the last frame or heartbeat from Cursor's cloud. `0` if no activity yet. |

**Counters**

| Metric | Type | Description |
| --- | --- | --- |
| `cursor_self_hosted_worker_connect_attempts_total` | Counter | Outbound connection attempts to Cursor's cloud. |
| `cursor_self_hosted_worker_connect_retry_total` | Counter | Connection retries after a failed attempt. |
| `cursor_self_hosted_worker_session_ends_total` | Counter | Agent sessions ended on this worker, labeled by `reason`. |

### [Session end reasons](https://cursor.com/docs/cloud-agent/self-hosted-pool\#session-end-reasons)

The `cursor_self_hosted_worker_session_ends_total` counter includes a `reason` label with one of these values:

| Reason | Description |
| --- | --- |
| `stream_end` | Connection closed normally. |
| `stream_error` | Connection failed with an error. |
| `session_closed` | HTTP/2 session closed cleanly. |
| `session_error` | HTTP/2 session entered an error state. |
| `connection_timeout` | Initial connection timed out before streaming started. |
| `session_aborted` | Session was aborted, for example because the worker was stopped. |

## [Security](https://cursor.com/docs/cloud-agent/self-hosted-pool\#security)

Forward Return Inference (LLM) loop

AGENT LOOP · CURSOR CLOUDTOOL EXECUTION · YOUR NETWORKOutbound-only · no inbound from CursorInference (LLM)model inferenceagent-cliagent worker startCursor UIweb / IDEAgent Looporchestrationstate managementBridgeframe routingWorkerworker runtimeToolsTerminalFilesystemBrowserstart runtool callstream to UIresultsoutbound HTTP/2prompttool callsstarts workerexec tool callsresults

**Data flow.** Two things leave your network: file chunks the model reads during inference, and Cloud Agent [artifacts](https://cursor.com/docs/cloud-agent/self-hosted-pool#artifacts) (screenshots, videos, and log references) the worker uploads to Cursor-managed storage so they can appear in PRs and the dashboard. Your repos, build caches, and secrets stay on your machines.

**Outbound-only.** Workers connect outbound over HTTPS. No inbound ports or firewall changes required.

**Privacy mode.** Self-hosted Cloud Agents respect Cursor's [privacy mode](https://cursor.com/data-use), which enables zero data retention across all model providers. None of your code is stored or used for training.

**Isolation.** Each agent session gets its own dedicated worker. Sessions are not shared across workers.

**Authentication.** Pool workers authenticate with a [service account API key](https://cursor.com/docs/account/enterprise/service-accounts). Other API key types are rejected.

**Dashboard visibility.** Team admins can see all connected workers. Team members see only workers assigned to them.

## [CLI reference](https://cursor.com/docs/cloud-agent/self-hosted-pool\#cli-reference)

```
agent worker start [options]
```

| Flag | Env var | Description |
| --- | --- | --- |
| `--worker-dir <path>` |  | Working directory. Must be a git repo. Default: current directory. |
| `--management-addr <addr>` |  | Address for `/healthz`, `/readyz`, and `/metrics` endpoints, for example `:8080`. |
| `--label <key=value>` |  | Add a label. Repeatable. Mutually exclusive with `--labels-file`. |
| `--labels-file <path>` | `CURSOR_WORKER_LABELS_FILE` | Path to JSON or TOML labels file. Mutually exclusive with `--label`. |
| `--idle-release-timeout <sec>` | `CURSOR_WORKER_IDLE_RELEASE_TIMEOUT` | Seconds to stay connected after a session ends. Default: no timeout. |
| `--pool` |  | Register for pool assignment. Each session claims one worker at a time. |
| `--single-use` |  | Legacy alias for `--pool`. |
| `--pool-name <name>` | `CURSOR_WORKER_POOL_NAME` | Pool label for pool-managed workers. Requires `--pool`. Default: `default`. |
| `--api-key <key>` | `CURSOR_API_KEY` | Service account API key for pool workers. |
| `--auth-token <token>` |  | Pre-minted access token. Used by the Kubernetes operator and other automation that exchanges an API key for a short-lived token externally. |
| `--auth-token-file <path>` |  | File containing an access token. The CLI re-reads this file when reconnecting after an auth failure or disconnect, which lets a controller rotate the mounted token without restarting the pod. |
| `-e, --endpoint <url>` |  | API endpoint. Default: `https://api2.cursor.sh`. |

## [FAQ](https://cursor.com/docs/cloud-agent/self-hosted-pool\#faq)

### How should I size workers?

There is no fixed worker spec. Size each worker the same way you size a CI
runner or devbox for the repo it serves.

Each worker needs enough CPU, memory, disk, and network access to clone the
repo and run the builds, tests, and tools your agents need.

### Can I bake skills into the worker image?

Yes. Project-level skills in `.cursor/skills/` or `.agents/skills/` are
automatically available on self-hosted workers.

To share skills across a team, check them into the repo or bake them into
your custom worker image.

### Do MCP servers work on self-hosted workers?

Yes. Configure MCP servers through the Cloud Agents dashboard. See the
[MCP servers](https://cursor.com/docs/cloud-agent/self-hosted-pool#mcp-servers) section for how routing works by transport type.

## [Related](https://cursor.com/docs/cloud-agent/self-hosted-pool\#related)

- [My Machines](https://cursor.com/docs/cloud-agent/my-machines)
- [Kubernetes deployment guide](https://cursor.com/docs/cloud-agent/self-hosted-k8s)
- [Self-hosted Cloud Agents cookbook](https://github.com/cursor/cookbook/tree/main/self-hosted-cloud-agent) (EC2, ECS, EKS reference deployments)
- [Cloud Agent security and network](https://cursor.com/docs/cloud-agent/security-network)
- [Service accounts](https://cursor.com/docs/account/enterprise/service-accounts)

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