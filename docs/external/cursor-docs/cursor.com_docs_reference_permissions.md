<!-- Source: https://cursor.com/docs/reference/permissions -->
<!-- Title: permissions.json Reference | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/reference/permissions#main-content)

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

# permissions.json reference

Use `permissions.json` to configure global MCP tool and terminal command allowlists for [auto-run](https://cursor.com/docs/agent/tools/terminal#auto-run-mode) without approval.

When `permissions.json` is present and defines an allowlist, it **overrides** the corresponding in-app allowlist in Cursor Settings. The in-app allowlist editor becomes read-only for that allowlist type.

## [File location](https://cursor.com/docs/reference/permissions\#file-location)

Place `permissions.json` in your Cursor data folder:

```
~/.cursor/permissions.json
```

This is a global, per-user file. It applies to all workspaces. There is no per-project override.

The file is read on startup and re-read automatically whenever it changes. JSONC (JSON with comments) is supported.

## [Top-level fields](https://cursor.com/docs/reference/permissions\#top-level-fields)

All fields are optional. Unknown keys are ignored.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `mcpAllowlist` | `string[]` | not set | MCP tools that can auto-run without approval. When set, overrides the in-app MCP allowlist. |
| `terminalAllowlist` | `string[]` | not set | Terminal commands that can auto-run without approval. When set, overrides the in-app terminal allowlist. |

Non-string entries inside either array are silently dropped.

## [Precedence](https://cursor.com/docs/reference/permissions\#precedence)

Allowlists can come from three sources, evaluated in strict priority order:

```
team admin (dashboard)  >  permissions.json  >  IDE settings UI
       (highest)             (overrides IDE)        (lowest)
```

- **Team admin controls**: If your team admin has configured auto-run controls through the dashboard, those settings take effect. Neither `permissions.json` nor the IDE allowlist can add extra entries.
- **permissions.json**: When auto-run is not admin-controlled and `permissions.json` defines an allowlist key, that key's value **replaces** the corresponding IDE allowlist entirely. The in-app editor for that allowlist becomes read-only, and the "Add to allowlist" button is hidden.
- **IDE settings**: When auto-run is not admin-controlled and `permissions.json` does not define a given allowlist key, the IDE allowlist from Cursor Settings is used.

MCP and terminal allowlists are independent. You can define one in `permissions.json` and manage the other in the IDE. For example, defining only `mcpAllowlist` in the file overrides the MCP allowlist but leaves the terminal allowlist under IDE control.

If the file is missing, unparseable, or does not contain a given key, Cursor falls back to the IDE allowlist for that key. If a key is present but set to an empty array, the effective allowlist for that type is empty — it does **not** fall back to the IDE allowlist.

## [How it appears in Cursor Settings](https://cursor.com/docs/reference/permissions\#how-it-appears-in-cursor-settings)

When `permissions.json` defines an allowlist, Cursor Settings notes that the allowlist is configured via `~/.cursor/permissions.json`.

- If the allowlist is controlled by `permissions.json`, the editor becomes read-only and shows the file-defined entries. The "Add to allowlist" option is not available for that allowlist type.
- If the allowlist is admin-controlled, the editor becomes read-only and shows the admin-defined entries.

## [MCP allowlist format](https://cursor.com/docs/reference/permissions\#mcp-allowlist-format)

Each entry is a `server:tool` string. Both parts are matched case-insensitively. The `*` wildcard matches any value for that part.

| Pattern | Matches |
| --- | --- |
| `my-server:my_tool` | Exactly the tool `my_tool` from the server named `my-server` |
| `my-server:*` | All tools from `my-server` |
| `*:my_tool` | The tool `my_tool` from any server |
| `*:*` | All tools from all servers |

The server name is the key you used in `mcp.json` (e.g. `"github"`, `"linear"`). Glob-style `*` patterns also work inside names (e.g. `my-server:list_*` matches `list_issues`, `list_users`, etc.).

Entries that do not contain a `:` are ignored.

## [Terminal allowlist format](https://cursor.com/docs/reference/permissions\#terminal-allowlist-format)

Each entry is a command or command prefix string.

| Pattern | Matches |
| --- | --- |
| `git` | Any command starting with `git` (e.g. `git status`, `git diff`) |
| `git status` | Only `git status` (and anything starting with `git status`) |
| `npm:install*` | `npm install`, `npm install express`, etc. The `:` separates the base command from an args glob. |

Matching is case-sensitive and uses prefix semantics: `git` matches `git status` but not `gitk`.

## [Examples](https://cursor.com/docs/reference/permissions\#examples)

### [Set MCP allowlist globally](https://cursor.com/docs/reference/permissions\#set-mcp-allowlist-globally)

```
{
  // Overrides the in-app MCP allowlist entirely.
  "mcpAllowlist": [\
    "github:*",\
    "linear:list_issues"\
  ]
}
```

### [Set terminal allowlist globally](https://cursor.com/docs/reference/permissions\#set-terminal-allowlist-globally)

```
{
  "terminalAllowlist": [\
    "git",\
    "npm",\
    "yarn",\
    "pnpm",\
    "cargo",\
    "make"\
  ]
}
```

### [Override only one allowlist type](https://cursor.com/docs/reference/permissions\#override-only-one-allowlist-type)

If `permissions.json` only defines `mcpAllowlist`, the MCP allowlist is taken from the file while the terminal allowlist remains under IDE control:

```
{
  "mcpAllowlist": [\
    "github:*",\
    "linear:*"\
  ]
}
```

Any MCP entries previously set in Cursor Settings are ignored while this file is present. Terminal allowlist entries in Cursor Settings still apply.

### [Combined setup](https://cursor.com/docs/reference/permissions\#combined-setup)

```
{
  "mcpAllowlist": [\
    "github:*",\
    "linear:*",\
    "notion:search"\
  ],
  "terminalAllowlist": [\
    "git",\
    "npm",\
    "cargo build",\
    "cargo test"\
  ]
}
```

## [Notes](https://cursor.com/docs/reference/permissions\#notes)

- **Auto-run mode required**: `permissions.json` only takes effect when auto-run is enabled in Cursor Settings ( **Allowlist**, **Allowlist (with Sandbox)**, or **Run Everything**). Before Cursor 3.5, allowlists were not consulted in the deprecated **Ask Every Time** mode.
- **Not a security boundary**: Allowlists are best-effort convenience. They are not a security guarantee. See [Agent Security](https://cursor.com/docs/agent/security) for details.
- **Override, not merge**: When `permissions.json` defines an allowlist key, it fully replaces the in-app allowlist for that type. Entries configured in Cursor Settings are not merged in.
- **IDE display**: When `permissions.json` controls an allowlist, the corresponding settings section becomes read-only and shows the file-defined entries. The "Add to allowlist" option is hidden.
- **CLI permissions are separate**: The Cursor CLI has its own permissions system. See [CLI Permissions](https://cursor.com/docs/cli/reference/permissions) for that reference.

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