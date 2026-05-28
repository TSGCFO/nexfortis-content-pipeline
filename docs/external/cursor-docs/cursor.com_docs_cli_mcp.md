<!-- Source: https://cursor.com/docs/cli/mcp -->
<!-- Title: MCP | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/cli/mcp#main-content)

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

Get Started

# MCP

## [Overview](https://cursor.com/docs/cli/mcp\#overview)

The Cursor CLI supports [Model Context Protocol (MCP)](https://cursor.com/docs/mcp) servers, allowing you to connect external tools and data sources to `agent`. **MCP in the CLI uses the same configuration as the editor** \- any MCP servers you've configured will work with both.

[Learn about MCP\\
\\
New to MCP? Read the complete guide on configuration, authentication, and\\
available servers](https://cursor.com/docs/mcp)

## [CLI commands](https://cursor.com/docs/cli/mcp\#cli-commands)

Use the `agent mcp` command to manage MCP servers

### [List configured servers](https://cursor.com/docs/cli/mcp\#list-configured-servers)

View all configured MCP servers and their current status:

```
agent mcp list
```

This opens an interactive menu where you can browse, enable, and configure MCP servers at a glance. The list shows:

- Server names and identifiers
- Connection status (connected/disconnected)
- Configuration source (project or global)
- Transport method (stdio, HTTP, SSE)

You can also use the `/mcp list` slash command in interactive mode for the same interface.

### [List available tools](https://cursor.com/docs/cli/mcp\#list-available-tools)

View tools provided by a specific MCP server:

```
agent mcp list-tools <identifier>
```

This displays:

- Tool names and descriptions
- Required and optional parameters
- Parameter types and constraints

### [Login to MCP server](https://cursor.com/docs/cli/mcp\#login-to-mcp-server)

Authenticate with an MCP server configured in your `mcp.json`:

```
agent mcp login <identifier>
```

The CLI uses a streamlined login flow with automatic callback handling. The agent gets access to authenticated MCPs immediately after login completes.

### [Enable MCP server](https://cursor.com/docs/cli/mcp\#enable-mcp-server)

Enable an MCP server:

```
agent mcp enable <identifier>
```

You can also use the `/mcp enable <name>` slash command in interactive mode.

### [Disable MCP server](https://cursor.com/docs/cli/mcp\#disable-mcp-server)

Disable an MCP server:

```
agent mcp disable <identifier>
```

You can also use the `/mcp disable <name>` slash command in interactive mode.

MCP server names with spaces are supported in all `/mcp` commands.

## [Using MCP with Agent](https://cursor.com/docs/cli/mcp\#using-mcp-with-agent)

Once you have MCP servers configured (see the [main MCP guide](https://cursor.com/docs/mcp) for setup), `agent` automatically discovers and uses available tools when relevant to your requests.

```
# Check what MCP servers are availableagent mcp list# See what tools a specific server providesagent mcp list-tools playwright# Use agent - it automatically uses MCP tools when helpfulagent -p "Navigate to google.com and take a screenshot of the search page"# Auto-approve all MCP servers (skip approval prompts)agent --approve-mcps "query my database for recent errors"
```

The CLI follows the same configuration precedence as the editor (project → global → nested), automatically discovering configurations from parent directories.

## [MCP vs ACP](https://cursor.com/docs/cli/mcp\#mcp-vs-acp)

Use MCP when you want Cursor to call external tools and services. Use [ACP](https://cursor.com/docs/cli/acp) when you want to build a custom client that talks to Cursor CLI itself over protocol messages.

## [Related](https://cursor.com/docs/cli/mcp\#related)

[MCP Overview\\
\\
Complete MCP guide: setup, configuration, and authentication](https://cursor.com/docs/mcp) [Available MCP Tools\\
\\
Browse pre-built MCP servers you can use](https://cursor.com/marketplace)

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