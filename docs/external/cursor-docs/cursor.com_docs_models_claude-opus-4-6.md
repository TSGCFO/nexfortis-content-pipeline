<!-- Source: https://cursor.com/docs/models/claude-opus-4-6 -->
<!-- Title: Claude 4.6 Opus | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/models/claude-opus-4-6#main-content)

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

Models

![Anthropic](https://cursor.com/docs-static/images/providers/anthropic-dark.svg)![Anthropic](https://cursor.com/docs-static/images/providers/anthropic-light.svg)

# Claude 4.6 Opus

Model ID

claude-4-6-opus

Context window

200k

Max context

1M

Provider

Anthropic

Capabilities

AgentThinking

Speed

Medium

Cost

High

Intelligence

Frontier

We recommend using [Claude Opus 4.8](https://cursor.com/docs/models/claude-opus-4-8). It scores higher on [CursorBench](https://cursor.com/blog/cursorbench), offers stronger autonomous capabilities, and is priced the same.

Opus 4.6 is Anthropic's previous flagship model. It tracks conversation intent across many turns and maintains coherent reasoning throughout long sessions. It plans before it acts, produces concrete fixes, and writes idiomatic code with strong style.

## [Strengths](https://cursor.com/docs/models/claude-opus-4-6\#strengths)

- Plans upfront and reasons coherently across many conversation turns. Strong for system design, complex refactors, and code reviews.
- Handles log-heavy, multi-project troubleshooting across CI, Docker, and monitoring.
- Writes idiomatic code with strong architecture decisions. Preferred for code reviews and production-critical changes.
- Tracks your intent across the full conversation. Strongest when prior context matters.
- Produces concrete bugfixes and feature work that spans multiple components.

## [Limitations](https://cursor.com/docs/models/claude-opus-4-6\#limitations)

- Most expensive model. Consumes usage limits faster than alternatives.
- Can over-elaborate or drift context in long sessions.
- Sometimes overconfident when given limited context.

## [Tools](https://cursor.com/docs/models/claude-opus-4-6\#tools)

Opus 4.6 has access to all agent tools when used with Cursor including:

### Semantic search

Search your [indexed codebase](https://cursor.com/docs/context/semantic-search) by meaning, not exact matches.

### Search files and folders

Find files by name, read directory structures, and grep for patterns.

### Web

Generate search queries and fetch results from the web.

### Read files

Read file contents, including images for vision-capable models.

### Edit files

Suggest edits and apply them automatically.

### Run shell commands

Execute terminal commands and monitor output.

### Browser

Control a browser to take screenshots, test applications, and verify visual changes. See the [Browser documentation](https://cursor.com/docs/agent/browser).

### Image generation

Generate images from text descriptions or reference images.

### Ask questions

Ask clarifying questions while continuing to work in the background.

### Fetch rules

Retrieve [rules](https://cursor.com/docs/rules) based on type and description.

Learn more about [how tools work](https://cursor.com/docs/agent/overview#tools) and [tool calling fundamentals](https://cursor.com/learn/tool-calling).

## [Pricing](https://cursor.com/docs/models/claude-opus-4-6\#pricing)

Cursor [plans](https://cursor.com/docs/models-and-pricing) include two usage pools. Opus 4.6 draws from the **API** pool, which charges at the rates below. Individual plans include at least $20 of API usage each month (more on higher tiers). All prices are per million tokens.

| Name | Input | Cache Write | Cache Read | Output |
| --- | --- | --- | --- | --- |
| ![Anthropic](https://cursor.com/docs-static/images/providers/anthropic-dark.svg)![Anthropic](https://cursor.com/docs-static/images/providers/anthropic-light.svg)<br>[Claude 4.6 Opus](https://cursor.com/docs/models/claude-opus-4-6) | $5 | $6.25 | $0.5 | $25 |

All Opus 4.6 prompts bill at the base per-token rates in the table above, including when you use Max Mode and context goes above 200k. Anthropic no longer applies a separate long-context multiplier for Opus 4.6.

Opus 4.6 supports a thinking variant for deeper reasoning.

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