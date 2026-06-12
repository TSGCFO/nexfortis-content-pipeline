<!-- Source: https://cursor.com/docs/cli/reference/parameters -->
<!-- Title: Parameters | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/cli/reference/parameters#main-content)

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

# Parameters

## [Global options](https://cursor.com/docs/cli/reference/parameters\#global-options)

Global options can be used with any command:

| Option | Description |
| --- | --- |
| `-v, --version` | Output the version number |
| `--api-key <key>` | API key for authentication (can also use `CURSOR_API_KEY` env var) |
| `-H, --header <header>` | Add custom header to agent requests (format: `Name: Value`, can be used multiple times) |
| `-p, --print` | Print responses to console (for scripts or non-interactive use). Has access to all tools, including write and shell. |
| `--output-format <format>` | Output format (only works with `--print`): `text`, `json`, or `stream-json` (default: `text`) |
| `--stream-partial-output` | Stream partial output as individual text deltas (only works with `--print` and `stream-json` format) |
| `--resume [chatId]` | Resume a chat session |
| `--continue` | Continue the previous session (alias for `--resume=-1`) |
| `--model <model>` | Model to use |
| `--mode <mode>` | Set agent mode: `plan` or `ask` (agent is the default when no mode is specified) |
| `--plan` | Start in plan mode (shorthand for `--mode=plan`) |
| `--list-models` | List all available models |
| `-f, --force` | Force allow commands unless explicitly denied |
| `--yolo` | Alias for `--force` |
| `--sandbox <mode>` | Set sandbox mode: `enabled` or `disabled` |
| `--approve-mcps` | Automatically approve all MCP servers |
| `--trust` | Trust the workspace without prompting (headless mode only) |
| `--workspace <path>` | Workspace directory to use |
| `--plugin-dir <path>` | Load a local plugin directory (can be specified multiple times) |
| `--worktree` | Run in a new Git worktree under `~/.cursor/worktrees` (see [CLI worktrees](https://cursor.com/docs/cli/using#cli-worktrees)) |
| `-h, --help` | Display help for command |

## [Commands](https://cursor.com/docs/cli/reference/parameters\#commands)

| Command | Description | Usage |
| --- | --- | --- |
| `agent` | Start in agent mode (the default) | `agent agent` |
| `login` | Authenticate with Cursor | `agent login` |
| `logout` | Sign out and clear stored authentication | `agent logout` |
| `status` \| `whoami` | Check authentication status | `agent status` |
| `about` | Display version, system, and account info | `agent about` |
| `models` | List all available models | `agent models` |
| `mcp` | Manage MCP servers | `agent mcp` |
| `acp` | Start ACP server mode (advanced, hidden command) | `agent acp` |
| `update` | Update Cursor Agent to the latest version | `agent update` |
| `ls` | List previous chat sessions | `agent ls` |
| `resume` | Resume the latest chat session | `agent resume` |
| `create-chat` | Create a new empty chat and return its ID | `agent create-chat` |
| `generate-rule` \| `rule` | Generate a new Cursor rule interactively | `agent generate-rule` |
| `install-shell-integration` | Install shell integration to `~/.zshrc` | `agent install-shell-integration` |
| `uninstall-shell-integration` | Remove shell integration from `~/.zshrc` | `agent uninstall-shell-integration` |
| `help [command]` | Display help for command | `agent help [command]` |

`agent acp` is intended for custom ACP clients and advanced integrations. It is
hidden from default command help output.

When no command is specified, Cursor Agent starts in interactive agent mode by
default.

## [MCP](https://cursor.com/docs/cli/reference/parameters\#mcp)

Manage MCP servers configured for Cursor Agent.

| Subcommand | Description | Usage |
| --- | --- | --- |
| `login <identifier>` | Authenticate with an MCP server configured in `.cursor/mcp.json` | `agent mcp login <identifier>` |
| `list` | List configured MCP servers and their status | `agent mcp list` |
| `list-tools <identifier>` | List available tools and their argument names for a specific MCP | `agent mcp list-tools <identifier>` |
| `enable <identifier>` | Enable an MCP server | `agent mcp enable <identifier>` |
| `disable <identifier>` | Disable an MCP server | `agent mcp disable <identifier>` |

All MCP commands support `-h, --help` for command-specific help.

## [Arguments](https://cursor.com/docs/cli/reference/parameters\#arguments)

When starting in chat mode (default behavior), you can provide an initial prompt:

**Arguments:**

- `prompt` — Initial prompt for the agent

## [Getting help](https://cursor.com/docs/cli/reference/parameters\#getting-help)

All commands support the global `-h, --help` option to display command-specific help.

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