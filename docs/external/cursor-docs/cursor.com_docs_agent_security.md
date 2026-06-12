<!-- Source: https://cursor.com/docs/agent/security -->
<!-- Title: Agent Security | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/agent/security#main-content)

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

Agent

# Agent Security

AI can behave unexpectedly due to prompt injection, hallucinations, and other issues. We protect users with guardrails that limit what agents can do. By default, sensitive actions require your manual approval. This document explains our guardrails and what they mean for you.

These controls and behaviors are our defaults. We recommend keeping them enabled.

## [First-party tool calls](https://cursor.com/docs/agent/security\#first-party-tool-calls)

Cursor includes tools that help agents write code: reading files, editing files, running terminal commands, searching the web, and more.

Reading files and searching code don't require approval. Use [.cursorignore](https://cursor.com/docs/reference/ignore-file) to block agent access to specific files. Actions that could expose sensitive data require your explicit approval.

Agents can modify workspace files without approval, except for configuration files. Changes save immediately to disk. Always use version control so you can revert changes. Configuration files (like workspace settings) need your approval first.

**Warning:** If you have auto-reload enabled, agent changes might execute before you can review them.

By default, terminal commands need your approval. You can either enabled a broader [auto-run mode](https://cursor.com/docs/agent/tools/terminal#auto-run-mode), or add them to your allowlist to get them to run without approval.

You can enable auto-approval if you accept the risk. **Allowlist** and **Allowlist (with Sandbox)** use an [allowlist](https://cursor.com/docs/agent/tools/terminal#protection-settings) to control which terminal commands and MCP tools run without asking. The allowlist is best-effort — bypasses are possible. Never use **Run Everything**, which skips all safety checks. Manage allowlists in **Cursor Settings > Agents > Auto-Run** or [`~/.cursor/permissions.json`](https://cursor.com/docs/reference/permissions).

Before Cursor 3.5, auto-run used **Run in Sandbox**, **Ask Every Time**, and **Run Everything** under different names.

## [Third-party tool calls](https://cursor.com/docs/agent/security\#third-party-tool-calls)

You can connect external tools using [MCP](https://cursor.com/docs/mcp). All MCP connections need your approval. After you approve an MCP connection, each tool call still needs individual approval before running. You can pre-approve specific tools with an [MCP allowlist](https://cursor.com/docs/reference/permissions#mcp-allowlist-format).

## [Network requests](https://cursor.com/docs/agent/security\#network-requests)

Attackers could use network requests to steal data. Our tools only make network requests to:

- GitHub
- Direct link retrieval
- Web search providers

Agents cannot make arbitrary network requests with default settings.

## [Workspace trust](https://cursor.com/docs/agent/security\#workspace-trust)

Cursor supports [workspace trust](https://code.visualstudio.com/docs/editing/workspaces/workspace-trust), but it's disabled by default. When enabled, it prompts you to choose between normal or restricted mode for new workspaces. Restricted mode breaks AI features. For untrusted repos, use a basic text editor instead.

To enable workspace trust:

1. Open your user settings.json file

2. Add the following configuration:















```
"security.workspace.trust.enabled": true
```


Organizations can enforce this setting through MDM solutions.

## [Responsible disclosure](https://cursor.com/docs/agent/security\#responsible-disclosure)

Found a vulnerability? Email [security-reports@cursor.com](mailto:security-reports@cursor.com) with details and steps to reproduce.

We acknowledge vulnerability reports within 5 business days. For critical incidents, we notify all users via email.

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