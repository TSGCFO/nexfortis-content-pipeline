<!-- Source: https://cursor.com/docs/cli/reference/permissions -->
<!-- Title: Permissions | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/cli/reference/permissions#main-content)

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

[Slash Commands](https://cursor.com/docs/cli/reference/slash-commands)

[Parameters](https://cursor.com/docs/cli/reference/parameters)

[Authentication](https://cursor.com/docs/cli/reference/authentication)

[Permissions](https://cursor.com/docs/cli/reference/permissions)

[Configuration](https://cursor.com/docs/cli/reference/configuration)

## Teams & Enterprise

Teams

Enterprise

CLI

# Permissions

Configure what the agent is allowed to do using permission tokens in your CLI configuration. Permissions are set in `~/.cursor/cli-config.json` (global) or `<project>/.cursor/cli.json` (project-specific).

## [Permission types](https://cursor.com/docs/cli/reference/permissions\#permission-types)

### [Shell commands](https://cursor.com/docs/cli/reference/permissions\#shell-commands)

**Format:**`Shell(commandBase)`

Controls access to shell commands. The `commandBase` is the first token in the command line. Supports glob patterns and an optional `command:args` syntax for finer control.

| Example | Description |
| --- | --- |
| `Shell(ls)` | Allow running `ls` commands |
| `Shell(git)` | Allow any `git` subcommand |
| `Shell(npm)` | Allow npm package manager commands |
| `Shell(curl:*)` | Allow `curl` with any arguments |
| `Shell(rm)` | Deny destructive file removal (commonly in `deny`) |

### [File reads](https://cursor.com/docs/cli/reference/permissions\#file-reads)

**Format:**`Read(pathOrGlob)`

Controls read access to files and directories. Supports glob patterns.

| Example | Description |
| --- | --- |
| `Read(src/**/*.ts)` | Allow reading TypeScript files in `src` |
| `Read(**/*.md)` | Allow reading markdown files anywhere |
| `Read(.env*)` | Deny reading environment files |
| `Read(/etc/passwd)` | Deny reading system files |

### [File writes](https://cursor.com/docs/cli/reference/permissions\#file-writes)

**Format:**`Write(pathOrGlob)`

Controls write access to files and directories. Supports glob patterns. When using in print mode, `--force` is required to write files.

| Example | Description |
| --- | --- |
| `Write(src/**)` | Allow writing to any file under `src` |
| `Write(package.json)` | Allow modifying package.json |
| `Write(**/*.key)` | Deny writing private key files |
| `Write(**/.env*)` | Deny writing environment files |

### [Web fetch](https://cursor.com/docs/cli/reference/permissions\#web-fetch)

**Format:**`WebFetch(domainOrPattern)`

Controls which domains the agent can fetch when using the web fetch tool (e.g., to retrieve documentation or web pages). Without an allowlist entry, each fetch prompts for approval. Add domains to `allow` to auto-approve fetches from trusted sources.

| Example | Description |
| --- | --- |
| `WebFetch(docs.github.com)` | Allow fetches from `docs.github.com` |
| `WebFetch(*.example.com)` | Allow fetches from any subdomain of `example.com` |
| `WebFetch(*)` | Allow fetches from any domain (use with caution) |

**Domain pattern matching:**

- `*` matches all domains
- `*.example.com` matches subdomains (e.g., `docs.example.com`, `api.example.com`)
- `example.com` matches that exact domain only

### [MCP tools](https://cursor.com/docs/cli/reference/permissions\#mcp-tools)

**Format:**`Mcp(server:tool)`

Controls which MCP (Model Context Protocol) tools the agent can run. Use `server` (from `mcp.json`) and `tool` name, with `*` for wildcards.

| Example | Description |
| --- | --- |
| `Mcp(datadog:*)` | Allow all tools from the Datadog MCP server |
| `Mcp(*:search)` | Allow any server's `search` tool |
| `Mcp(*:*)` | Allow all MCP tools (use with caution) |

## [Configuration](https://cursor.com/docs/cli/reference/permissions\#configuration)

Add permissions to the `permissions` object in your CLI configuration file:

```
{
  "permissions": {
    "allow": [\
      "Shell(ls)",\
      "Shell(git)",\
      "Read(src/**/*.ts)",\
      "Write(package.json)",\
      "WebFetch(docs.github.com)",\
      "WebFetch(*.github.com)",\
      "Mcp(datadog:*)"\
    ],
    "deny": [\
      "Shell(rm)",\
      "Read(.env*)",\
      "Write(**/*.key)",\
      "WebFetch(malicious-site.com)"\
    ]
  }
}
```

## [Pattern matching](https://cursor.com/docs/cli/reference/permissions\#pattern-matching)

- Glob patterns use `**`, `*`, and `?` wildcards
- Relative paths are scoped to the current workspace
- Absolute paths can target files outside the project
- Deny rules take precedence over allow rules
- Use `command:args` (e.g., `curl:*`) to match both command and arguments with globs

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