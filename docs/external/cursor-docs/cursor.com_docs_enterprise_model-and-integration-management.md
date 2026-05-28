<!-- Source: https://cursor.com/docs/enterprise/model-and-integration-management -->
<!-- Title: Model and Integration Management | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/enterprise/model-and-integration-management#main-content)

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

[Overview](https://cursor.com/docs/enterprise)

Identity & Access

[Privacy & Data Governance](https://cursor.com/docs/enterprise/privacy-and-data-governance)

[Network Configuration](https://cursor.com/docs/enterprise/network-configuration)

[Endpoint Security](https://cursor.com/docs/enterprise/endpoint-security)

[LLM Safety & Controls](https://cursor.com/docs/enterprise/llm-safety-and-controls)

[Models & Integrations](https://cursor.com/docs/enterprise/model-and-integration-management)

[Pooled Usage](https://cursor.com/docs/enterprise/pooled-usage)

[Compliance & Monitoring](https://cursor.com/docs/enterprise/compliance-and-monitoring)

[HIPAA BAA](https://cursor.com/docs/enterprise/baa)

[Deployment Patterns](https://cursor.com/docs/enterprise/deployment-patterns)

[Service Accounts](https://cursor.com/docs/account/enterprise/service-accounts)

[Billing Groups](https://cursor.com/docs/account/enterprise/billing-groups)

[Cursor Blame](https://cursor.com/docs/integrations/cursor-blame)

Teams & Enterprise

# Model and Integration Management

Your team can access multiple AI models and integrate Cursor with various services. This documentation covers how to control which models are available, manage MCP server trust, and set up integrations with tools like Slack, GitHub, and Linear.

## [Model access control](https://cursor.com/docs/enterprise/model-and-integration-management\#model-access-control)

Enterprise teams can control which AI models team members can use, [contact sales](https://cursor.com/contact-sales?source=docs-model-controls) to get access. This helps manage costs, ensure appropriate usage, and comply with organizational policies.

Model access controls are configured through the [team dashboard](https://cursor.com/docs/account/teams/dashboard). Navigate to Settings and look for "Model Access Control" (Enterprise only).

### [How enterprise model rollout works](https://cursor.com/docs/enterprise/model-and-integration-management\#how-enterprise-model-rollout-works)

When new models become available, Cursor doesn't immediately enable them for all enterprise teams.

Instead, Enterprise teams can opt in to new models for their organization.

See [Models](https://cursor.com/docs/models-and-pricing) for the current list of available models.

## [Restrict personal API keys (BYOK controls)](https://cursor.com/docs/enterprise/model-and-integration-management\#restrict-personal-api-keys-byok-controls)

Enterprise teams can prevent team members from using their own API keys with third-party providers (OpenAI, Anthropic, Azure, AWS Bedrock) in Cursor. All usage goes through Cursor's included models and usage pool.

Configure this in the [team dashboard](https://cursor.com/docs/account/teams/dashboard) under Settings (Enterprise only).

## [MCP server trust management](https://cursor.com/docs/enterprise/model-and-integration-management\#mcp-server-trust-management)

The Model Context Protocol (MCP) lets you connect external tools and data sources to Cursor. MCP servers can:

- Read files from external systems
- Execute operations on your behalf
- Access databases and APIs
- Integrate with third-party services

MCP servers are designed and implemented by external vendors, not Cursor. We work with partners to provide a [vetted marketplace](https://cursor.com/marketplace) of trusted servers, but you should review each server's capabilities and permissions before enabling it for your team.

Because MCP servers have significant capabilities, you need to manage which servers your team can use.

### [MCP Allowlist](https://cursor.com/docs/enterprise/model-and-integration-management\#mcp-allowlist)

Enterprise teams can control which MCP servers team members are allowed to use. Configure this in the [team dashboard](https://cursor.com/docs/account/teams/dashboard) under "MCP Configuration" (Enterprise only).

You can also distribute `~/.cursor/permissions.json` through MDM to set the per-user MCP auto-run allowlist from a managed file.

In that file, `mcpAllowlist` must be a JSON array of strings using `server:tool` syntax:

| Entry | Meaning |
| --- | --- |
| `server:tool` | One specific tool on one specific MCP server |
| `server:*` | All tools from one MCP server |
| `*:tool` | One tool name from any MCP server |
| `*:*` | All MCP tools |

Cursor resolves the effective MCP allowlist in this order:

1. Team dashboard or other admin-controlled settings
2. `~/.cursor/permissions.json`
3. The MCP allowlist in editor settings and inline **Add to allowlist**

Higher-priority sources replace lower-priority ones. They do not merge.

When an allowlist is active, only servers matching an allowlist entry can run. Servers that don't match are blocked.

Adding a server to the allowlist does not push it to users' machines. Team members still need to configure the server in their own [Cursor settings](https://cursor.com/docs/mcp).

All allowlist entries support wildcards using `*` to match any sequence of characters.

#### [Command-based servers (stdio)](https://cursor.com/docs/enterprise/model-and-integration-management\#command-based-servers-stdio)

For local MCP servers configured with `command` and `args`, the allowlist matches against the **full command string**: the `command` value and all `args` values joined with spaces.

Given this `mcp.json` config:

```
{
  "mcpServers": {
    "my-tool": {
      "command": "npx",
      "args": ["-y", "@acme/mcp-tool@latest"]
    }
  }
}
```

The full command string is `npx -y @acme/mcp-tool@latest`. On most systems, the shell resolves `npx` to a full path like `/usr/local/bin/npx` or `/opt/homebrew/bin/npx`, so the actual string becomes `/usr/local/bin/npx -y @acme/mcp-tool@latest`.

Use a leading `*` wildcard to match regardless of the install path:

| Allowlist entry | Matches |
| --- | --- |
| `*npx -y @acme/mcp-tool@latest` | `npx` at any path, with these exact arguments |
| `/usr/local/bin/npx -y @acme/mcp-tool@latest` | Only this exact path |
| `*npx -y @acme/*` | Any `@acme`-scoped MCP package |
| `*python */scripts/mcp-server.py*` | A Python server at any matching path, with any trailing arguments |

#### [URL-based servers (HTTP/SSE)](https://cursor.com/docs/enterprise/model-and-integration-management\#url-based-servers-httpsse)

For remote MCP servers configured with `url`, the allowlist matches against the URL.

Given this `mcp.json` config:

```
{
  "mcpServers": {
    "acme-tools": {
      "url": "https://mcp.acme.com/sse"
    }
  }
}
```

The allowlist entry matches against the full URL `https://mcp.acme.com/sse`:

| Allowlist entry | Matches |
| --- | --- |
| `https://mcp.acme.com/sse` | This exact URL |
| `https://*.acme.com/*` | Any subdomain and path under `acme.com` |
| `https://mcp.acme.com/*` | Any path on this host |

## [Git repository blocklist](https://cursor.com/docs/enterprise/model-and-integration-management\#git-repository-blocklist)

You can prevent Cursor from accessing specific repositories.

Add repository URLs or patterns in the [team dashboard](https://cursor.com/docs/account/teams/dashboard) under "Repository Blocklist" (Enterprise only). Cursor will refuse to index or work with blocked repositories.

## [Integration: Slack](https://cursor.com/docs/enterprise/model-and-integration-management\#integration-slack)

The Slack integration enables Cloud Agents to run directly from Slack. Team members can mention `@cursor` with a prompt and get automated code changes delivered as pull requests.

Cursor requires permissions to read messages, post responses, and access channel metadata. See the [Slack integration documentation](https://cursor.com/docs/integrations/slack#permissions) for the full list.

See [Slack integration](https://cursor.com/docs/integrations/slack) for detailed setup and usage instructions.

## [Integration: GitHub, GHES, and GitLab](https://cursor.com/docs/enterprise/model-and-integration-management\#integration-github-ghes-and-gitlab)

Connect Cursor to your version control system to work with Cloud Agents.

Cursor requires read access to repositories and write access to create PRs. You control which repositories the Cursor app can access.

See [GitHub integration](https://cursor.com/docs/integrations/github) for setup.

## [Integration: Linear](https://cursor.com/docs/enterprise/model-and-integration-management\#integration-linear)

Connect Linear to start Cloud Agents from issues.

Cursor requires read access to issues and write access to update issue status.

See [Linear integration](https://cursor.com/docs/integrations/linear) for details.

Model controls are available on the Enterprise plan

Contact our team to learn about model restrictions and MCP management.

[Contact Sales](https://cursor.com/contact-sales?source=docs-model-integrations)

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