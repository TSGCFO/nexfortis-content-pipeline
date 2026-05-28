<!-- Source: https://cursor.com/docs/agent/agent-review -->
<!-- Title: Agent Review | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/agent/agent-review#main-content)

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

# Agent Review

Agent Review runs a dedicated code review on your local changes from inside Cursor.

## [Setup](https://cursor.com/docs/agent/agent-review\#setup)

To configure Agent Review:

1. Open **Cursor Settings**
2. Go to **Agents**
3. Find **Agent Review** and configure your preferences

Agent Review also reads repository rules from `BUGBOT.md` files. To set up these rule files, see [BugBot docs](https://cursor.com/docs/bugbot).

You can set it to run automatically after every agent task, or leave it manual and trigger it yourself.

## [Running a review](https://cursor.com/docs/agent/agent-review\#running-a-review)

There are three ways to start a review:

- **Automatic**: When enabled in settings, Agent Review runs after every commit is made.
- **Slash command**: Type `/agent-review` in the agent window input to trigger a review on demand.
- **Source Control tab**: Open the Source Control tab and run Agent Review to compare all local changes against your main branch. This catches issues across your full set of changes, not only the latest edit.

## [Review depth](https://cursor.com/docs/agent/agent-review\#review-depth)

Agent Review supports two depth levels. Choose based on the thoroughness of review you need.

| Depth | Speed | Cost | Best for |
| --- | --- | --- | --- |
| **Quick** | Fast | Low | Small diffs, formatting changes, or a fast sanity check |
| **Deep** | Slow | High | Complex logic, security-sensitive code, or large refactors |

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