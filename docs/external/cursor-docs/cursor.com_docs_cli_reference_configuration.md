<!-- Source: https://cursor.com/docs/cli/reference/configuration -->
<!-- Title: Configuration | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/cli/reference/configuration#main-content)

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

# Configuration

Configure the Agent CLI using the `cli-config.json` file.

## [File location](https://cursor.com/docs/cli/reference/configuration\#file-location)

| Type | Platform | Path |
| --- | --- | --- |
| Global | macOS/Linux | `~/.cursor/cli-config.json` |
| Global | Windows | `$env:USERPROFILE\.cursor\cli-config.json` |
| Project | All | `<project>/.cursor/cli.json` |

Only permissions can be configured at the project level. All other CLI
settings must be set globally.

Override with environment variables:

- **`CURSOR_CONFIG_DIR`**: custom directory path
- **`XDG_CONFIG_HOME`** (Linux/BSD): uses `$XDG_CONFIG_HOME/cursor/cli-config.json`

## [Schema](https://cursor.com/docs/cli/reference/configuration\#schema)

### [Required fields](https://cursor.com/docs/cli/reference/configuration\#required-fields)

| Field | Type | Description |
| --- | --- | --- |
| `version` | number | Config schema version (current: `1`) |
| `editor.vimMode` | boolean | Enable Vim keybindings (default: `false`) |
| `permissions.allow` | string\[\] | Permitted operations (see [Permissions](https://cursor.com/docs/cli/reference/permissions)) |
| `permissions.deny` | string\[\] | Forbidden operations (see [Permissions](https://cursor.com/docs/cli/reference/permissions)) |

### [Optional fields](https://cursor.com/docs/cli/reference/configuration\#optional-fields)

| Field | Type | Description |
| --- | --- | --- |
| `model` | object | Selected model configuration |
| `hasChangedDefaultModel` | boolean | CLI-managed model override flag |
| `network.useHttp1ForAgent` | boolean | Use HTTP/1.1 instead of HTTP/2 for agent connections (default: `false`) |
| `attribution.attributeCommitsToAgent` | boolean | Add "Made with Cursor" trailer to Agent commits (default: `true`) |
| `attribution.attributePRsToAgent` | boolean | Add "Made with Cursor" footer to Agent PRs (default: `true`) |

## [Examples](https://cursor.com/docs/cli/reference/configuration\#examples)

### [Minimal config](https://cursor.com/docs/cli/reference/configuration\#minimal-config)

```
{
  "version": 1,
  "editor": { "vimMode": false },
  "permissions": { "allow": ["Shell(ls)"], "deny": [] }
}
```

### [Enable Vim mode](https://cursor.com/docs/cli/reference/configuration\#enable-vim-mode)

```
{
  "version": 1,
  "editor": { "vimMode": true },
  "permissions": { "allow": ["Shell(ls)"], "deny": [] }
}
```

### [Configure permissions](https://cursor.com/docs/cli/reference/configuration\#configure-permissions)

```
{
  "version": 1,
  "editor": { "vimMode": false },
  "permissions": {
    "allow": ["Shell(ls)", "Shell(echo)"],
    "deny": ["Shell(rm)"]
  }
}
```

See [Permissions](https://cursor.com/docs/cli/reference/permissions) for available permission types and examples.

## [Troubleshooting](https://cursor.com/docs/cli/reference/configuration\#troubleshooting)

**Config errors**: Move the file aside and restart:

```
mv ~/.cursor/cli-config.json ~/.cursor/cli-config.json.bad
```

**Changes don't persist**: Ensure valid JSON and write permissions. Some fields are CLI-managed and may be overwritten.

## [Notes](https://cursor.com/docs/cli/reference/configuration\#notes)

- Pure JSON format (no comments)
- CLI performs self-repair for missing fields
- Corrupted files are backed up as `.bad` and recreated
- Permission entries are exact strings (see [Permissions](https://cursor.com/docs/cli/reference/permissions) for details)

## [Models](https://cursor.com/docs/cli/reference/configuration\#models)

You can select a model for the CLI using the `/model` slash command.

```
/model auto
/model gpt-5.2
/model sonnet-4.5-thinking
```

See the [Slash commands](https://cursor.com/docs/cli/reference/slash-commands) docs for other commands.

## [Proxy configuration](https://cursor.com/docs/cli/reference/configuration\#proxy-configuration)

If your network routes traffic through a proxy server, configure the CLI using environment variables and the config file.

### [Environment variables](https://cursor.com/docs/cli/reference/configuration\#environment-variables)

Set these environment variables before running the CLI:

```
export HTTP_PROXY=http://your-proxy:port
export HTTPS_PROXY=http://your-proxy:port
export NODE_USE_ENV_PROXY=1
```

If your proxy performs SSL inspection (man-in-the-middle), also trust your organization's CA certificate:

```
export NODE_EXTRA_CA_CERTS=/path/to/corporate-ca-cert.pem
```

### [HTTP/1.1 fallback](https://cursor.com/docs/cli/reference/configuration\#http11-fallback)

Some enterprise proxies (like Zscaler) don't support HTTP/2 bidirectional streaming. Enable HTTP/1.1 mode in your config:

```
{
  "version": 1,
  "editor": { "vimMode": false },
  "permissions": { "allow": [], "deny": [] },
  "network": {
    "useHttp1ForAgent": true
  }
}
```

This switches agent connections to HTTP/1.1 with Server-Sent Events (SSE), which works with most corporate proxies.

See [Network Configuration](https://cursor.com/docs/enterprise/network-configuration) for proxy testing commands and troubleshooting.

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