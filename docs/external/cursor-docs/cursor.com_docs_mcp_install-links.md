<!-- Source: https://cursor.com/docs/mcp/install-links -->
<!-- Title: MCP Install Links | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/mcp/install-links#main-content)

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

Customizing

# MCP Install Links

Looking to share MCP servers, rules, and more? [Plugins](https://cursor.com/docs/plugins) make it easier to bundle and distribute everything in one package. You can publish to the [Cursor Marketplace](https://cursor.com/docs/plugins#the-marketplace) or your [team's private marketplace](https://cursor.com/docs/plugins#team-marketplaces).

MCP servers can be installed with Cursor deeplinks. It uses the same format as [`mcp.json`](https://cursor.com/docs/mcp) with a name and transport configuration.

Install links:

```
cursor://anysphere.cursor-deeplink/mcp/install?name=$NAME&config=$BASE64_ENCODED_CONFIG
```

| Component | Description |
| --- | --- |
| `cursor://` | Protocol scheme |
| `anysphere.cursor-deeplink` | Deeplink handler |
| `/mcp/install` | Path |
| `name` | Query parameter for server name |
| `config` | Query parameter for base64 encoded JSON configuration |

## [Generate install link](https://cursor.com/docs/mcp/install-links\#generate-install-link)

1. Get name and JSON configuration of server
2. `JSON.stringify` the configuration then base64 encode it
3. Replace `$NAME` and `$BASE64_ENCODED_CONFIG` with the name and encoded config

Helper for generating links:

MCP server JSON configuration

No server detected

Copy deeplink

Copy web link

MarkdownHTMLJSX

Click to copy. Paste in README

## [Example](https://cursor.com/docs/mcp/install-links\#example)

Try this JSON in the MCP install link generator:

Single MCP server config

```
{
  "postgres": {
    "command": "npx",
    "args": [\
      "-y",\
      "@modelcontextprotocol/server-postgres",\
      "postgresql://localhost/mydb"\
    ]
  }
}
```

Result:

| Format | Example |
| --- | --- |
| Text link | [cursor://anysphere.curs...](cursor://anysphere.cursor-deeplink/mcp/install?name=postgres&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBtb2RlbGNvbnRleHRwcm90b2NvbC9zZXJ2ZXItcG9zdGdyZXMiLCJwb3N0Z3Jlc3FsOi8vbG9jYWxob3N0L215ZGIiXX0=) |
| Dark button | [![Add postgres MCP server to Cursor](https://cursor.com/deeplink/mcp-install-dark.png)](cursor://anysphere.cursor-deeplink/mcp/install?name=postgres&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBtb2RlbGNvbnRleHRwcm90b2NvbC9zZXJ2ZXItcG9zdGdyZXMiLCJwb3N0Z3Jlc3FsOi8vbG9jYWxob3N0L215ZGIiXX0=) |
| Light button | [![Add postgres MCP server to Cursor](https://cursor.com/deeplink/mcp-install-light.png)](cursor://anysphere.cursor-deeplink/mcp/install?name=postgres&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBtb2RlbGNvbnRleHRwcm90b2NvbC9zZXJ2ZXItcG9zdGdyZXMiLCJwb3N0Z3Jlc3FsOi8vbG9jYWxob3N0L215ZGIiXX0=) |

## [Install server](https://cursor.com/docs/mcp/install-links\#install-server)

1. Click the link or paste into browser
2. Cursor prompts to install the server
3. Use the server in Cursor

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