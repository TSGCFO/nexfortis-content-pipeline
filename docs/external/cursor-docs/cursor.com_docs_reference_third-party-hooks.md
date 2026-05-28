<!-- Source: https://cursor.com/docs/reference/third-party-hooks -->
<!-- Title: Third Party Hooks | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/reference/third-party-hooks#main-content)

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

# Third Party Hooks

Cursor supports loading hooks from third-party tools, enabling compatibility with existing hook configurations from other AI coding assistants.

## [Claude Code Hooks](https://cursor.com/docs/reference/third-party-hooks\#claude-code-hooks)

Cursor can load and execute hooks configured for Claude Code, allowing you to use the same hook scripts across both tools.

### [Requirements](https://cursor.com/docs/reference/third-party-hooks\#requirements)

To enable Claude Code hooks compatibility:

1. **Enable Third-party skills** in Cursor Settings → Features → Third-party skills
2. The feature must be enabled for your account

### [Configuration Locations](https://cursor.com/docs/reference/third-party-hooks\#configuration-locations)

Claude Code hooks are loaded from these locations (in priority order):

| Location | Path | Description |
| --- | --- | --- |
| **Project local** | `.claude/settings.local.json` | Project-specific, gitignored overrides |
| **Project** | `.claude/settings.json` | Project-level hooks, checked into repo |
| **User** | `~/.claude/settings.json` | User-level hooks, apply globally |

### [Priority Order](https://cursor.com/docs/reference/third-party-hooks\#priority-order)

When hooks are configured in multiple locations, they are merged in this priority order (highest to lowest):

1. Enterprise hooks (managed deployment)
2. Team hooks (dashboard-configured)
3. Project hooks (`.cursor/hooks.json`)
4. User hooks (`~/.cursor/hooks.json`)
5. Claude project local (`.claude/settings.local.json`)
6. Claude project (`.claude/settings.json`)
7. Claude user (`~/.claude/settings.json`)

All matching hooks from every source run. When responses conflict, higher-priority sources take precedence during merge.

Enterprise-managed hooks and dashboard distribution require an Enterprise plan. [Contact sales](https://cursor.com/contact-sales?source=docs-third-party-hooks) to learn more.

### [Claude Code Hook Format](https://cursor.com/docs/reference/third-party-hooks\#claude-code-hook-format)

Claude Code hooks use a similar but slightly different format. Cursor automatically maps Claude hook names to their Cursor equivalents.

**Example Claude Code settings.json:**

```
{
  "hooks": {
    "PreToolUse": [\
      {\
        "matcher": "Shell",\
        "hooks": [\
          {\
            "type": "command",\
            "command": "./hooks/validate-shell.sh"\
          }\
        ]\
      }\
    ],
    "PostToolUse": [\
      {\
        "matcher": ".*",\
        "hooks": [\
          {\
            "type": "command",\
            "command": "./hooks/audit.sh"\
          }\
        ]\
      }\
    ]
  }
}
```

### [Response Format Compatibility](https://cursor.com/docs/reference/third-party-hooks\#response-format-compatibility)

Cursor supports both Claude Code's nested `hookSpecificOutput` response format and the older flat response format. Hook scripts written for Claude Code will work in Cursor regardless of which format they use.

#### [`PreToolUse` Response Formats](https://cursor.com/docs/reference/third-party-hooks\#pretooluse-response-formats)

**Nested format (Claude Code style):**

```
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Blocked by policy",
    "updatedInput": { "command": "npm ci" }
  }
}
```

**Flat format (Cursor native style):**

```
{
  "permission": "deny",
  "user_message": "Blocked by policy",
  "updated_input": { "command": "npm ci" }
}
```

Both formats are equivalent. The nested `permissionDecision` maps to `permission`, `permissionDecisionReason` maps to `user_message`, and `updatedInput` maps to `updated_input`.

#### [`Stop` / `SubagentStop` Response Formats](https://cursor.com/docs/reference/third-party-hooks\#stop-subagentstop-response-formats)

**Nested format (Claude Code style):**

```
{
  "hookSpecificOutput": {
    "decision": "block",
    "reason": "Tasks incomplete, continue working"
  }
}
```

**Flat format (Claude Code legacy style):**

```
{
  "decision": "block",
  "reason": "Tasks incomplete, continue working"
}
```

**Cursor native format:**

```
{
  "followup_message": "Tasks incomplete, continue working"
}
```

For `Stop` and `SubagentStop` hooks, a `decision` of `"block"` with a `reason` is treated as an automatic follow-up, equivalent to providing `followup_message` in the native Cursor format.

### [Hook Step Mapping](https://cursor.com/docs/reference/third-party-hooks\#hook-step-mapping)

Claude Code hook names are automatically mapped to Cursor hook names:

| Claude Code Hook | Cursor Hook |
| --- | --- |
| `PreToolUse` | `preToolUse` |
| `PostToolUse` | `postToolUse` |
| `UserPromptSubmit` | `beforeSubmitPrompt` |
| `Stop` | `stop` |
| `SubagentStop` | `subagentStop` |
| `SessionStart` | `sessionStart` |
| `SessionEnd` | `sessionEnd` |
| `PreCompact` | `preCompact` |

### [Exit Code Behavior](https://cursor.com/docs/reference/third-party-hooks\#exit-code-behavior)

Both Cursor and Claude Code hooks support exit code `2` to block an action. This provides consistent behavior when sharing hooks between tools:

```
#!/bin/bash
# Block dangerous commands
if [[ "$COMMAND" == *"rm -rf"* ]]; then
  echo '{"permission": "deny", "user_message": "Destructive command blocked"}'
  exit 2
fi
echo '{"permission": "allow"}'
exit 0
```

- **Exit code 0**: Hook succeeded, use the JSON output
- **Exit code 2**: Block the action (equivalent to `permission: "deny"`)
- **Other exit codes**: Hook failed, action proceeds (fail-open)

### [Migration from Claude Code](https://cursor.com/docs/reference/third-party-hooks\#migration-from-claude-code)

If you have existing Claude Code hooks, you can:

1. **Keep using Claude Code config files**: Enable third-party skills and your existing `.claude/settings.json` hooks will work automatically
2. **Migrate to Cursor format**: Copy your hooks to `.cursor/hooks.json` using the Cursor format for full feature support

**Cursor format equivalent:**

```
{
  "version": 1,
  "hooks": {
    "preToolUse": [\
      {\
        "command": "./hooks/validate-shell.sh",\
        "matcher": "Shell"\
      }\
    ],
    "postToolUse": [\
      {\
        "command": "./hooks/audit.sh"\
      }\
    ]
  }
}
```

## [Supported Features](https://cursor.com/docs/reference/third-party-hooks\#supported-features)

When using Claude Code hooks in Cursor, the following features are supported:

| Claude Code Event | Cursor Mapping | Supported |
| --- | --- | --- |
| `PreToolUse` | `preToolUse` | Yes |
| `PostToolUse` | `postToolUse` | Yes |
| `Stop` | `stop` | Yes |
| `SubagentStop` | `subagentStop` | Yes |
| `SessionStart` | `sessionStart` | Yes |
| `SessionEnd` | `sessionEnd` | Yes |
| `PreCompact` | `preCompact` | Yes |
| `UserPromptSubmit` | `beforeSubmitPrompt` | Yes |
| `Notification` | - | No |
| `PermissionRequest` | - | No |

**Additional supported features:**

| Feature | Supported |
| --- | --- |
| Command-based hooks (`type: "command"`) | Yes |
| Prompt-based hooks (`type: "prompt"`) | Yes |
| Nested `hookSpecificOutput` responses | Yes |
| Exit code 2 blocking | Yes |
| Tool matchers (regex patterns) | Yes |
| Timeout configuration | Yes |

### [Tool Name Mapping](https://cursor.com/docs/reference/third-party-hooks\#tool-name-mapping)

Claude Code tool names are mapped to Cursor tool names:

| Claude Code Tool | Cursor Tool | Supported |
| --- | --- | --- |
| `Bash` | `Shell` | Yes |
| `Read` | `Read` | Yes |
| `Write` | `Write` | Yes |
| `Edit` | `Write` | Yes |
| `Grep` | `Grep` | Yes |
| `Task` | `Task` | Yes |
| `Glob` | - | No |
| `WebFetch` | - | No |
| `WebSearch` | - | No |

### [Limitations](https://cursor.com/docs/reference/third-party-hooks\#limitations)

Some features are only available when using the native Cursor format:

- `subagentStart` hook (Claude Code only has `SubagentStop`)
- Loop limit configuration (`loop_limit`)
- Team/Enterprise hook distribution via dashboard

## [Troubleshooting](https://cursor.com/docs/reference/third-party-hooks\#troubleshooting)

**Claude Code hooks not loading**

1. Verify "Third-party skills" is enabled in Cursor Settings
2. Check that your `.claude/settings.json` file is valid JSON
3. Cursor watches config files and reloads them automatically. If hooks still do not load, restart Cursor.

**Hooks running but not blocking**

1. Ensure your hook script exits with code `2` to block actions
2. Check the JSON output format matches the expected schema
3. View the Hooks output channel in Cursor for error details

**Different behavior between Cursor and Claude Code**

Some behavior differences may exist due to different execution environments. Test your hooks in both tools to ensure compatibility.

Enterprise hook deployment

Use managed Enterprise hooks and team distribution from the dashboard.

[Contact Sales](https://cursor.com/contact-sales?source=docs-third-party-hooks)

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