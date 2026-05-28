<!-- Source: https://cursor.com/docs/models/claude-opus-4-7 -->
<!-- Title: Claude 4.7 Opus | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/models/claude-opus-4-7#main-content)

## Command Palette

Search for a command to run...

## Get Started

[Welcome](https://cursor.com/docs) [Quickstart](https://cursor.com/docs/get-started/quickstart)
Models & Pricing

[Overview](https://cursor.com/docs/models-and-pricing)

[Claude 4.6 Sonnet](https://cursor.com/docs/models/claude-4-6-sonnet)

[Claude 4.7 Opus](https://cursor.com/docs/models/claude-opus-4-7)

[Gemini 3.1 Pro](https://cursor.com/docs/models/gemini-3-1-pro)

[Gemini 3.5 Flash](https://cursor.com/docs/models/gemini-3-5-flash)

[GPT-5.5](https://cursor.com/docs/models/gpt-5-5)

[GPT-5.3 Codex](https://cursor.com/docs/models/gpt-5-3-codex)

[Grok 4.3](https://cursor.com/docs/models/grok-4-3)

[Composer 2.5](https://cursor.com/docs/models/cursor-composer-2-5)

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

# Claude 4.7 Opus

Model ID

claude-opus-4-7

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

Opus 4.7 is Anthropic's strongest model and a meaningful jump over Opus 4.6 on [CursorBench](https://cursor.com/blog/cursorbench). It excels at autonomous, multi-step work: it holds intent across long sessions, self-corrects when it hits friction, and writes production-ready code without hand-holding. We recommend the high thinking variant for the best results.

## [Strengths](https://cursor.com/docs/models/claude-opus-4-7\#strengths)

- Autonomous and self-directed. Opus 4.7 drives multi-step tasks to completion without losing track of the goal, even across large codebases and long conversations.
- Creative reasoning. It approaches problems from unexpected angles, explores alternative solutions, and produces more inventive code than its predecessor.
- Strong at planning. It maps out work before executing, catches edge cases early, and builds coherent architectures across many files.
- Reliable tool use. It calls tools purposefully, chains tool results into follow-up actions, and adapts when tool output surprises it.

## [Limitations](https://cursor.com/docs/models/claude-opus-4-7\#limitations)

- Most expensive model. Consumes usage limits faster than alternatives.
- Can over-elaborate in long sessions where brevity matters more than depth.

## [Tools](https://cursor.com/docs/models/claude-opus-4-7\#tools)

Opus 4.7 has access to all agent tools when used with Cursor including:

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

## [Pricing](https://cursor.com/docs/models/claude-opus-4-7\#pricing)

Cursor [plans](https://cursor.com/docs/models-and-pricing) include two usage pools. Opus 4.7 draws from the **API** pool, which charges at the rates below. Individual plans include at least $20 of API usage each month (more on higher tiers). All prices are per million tokens.

| Name | Input | Cache Write | Cache Read | Output |
| --- | --- | --- | --- | --- |
| ![Anthropic](https://cursor.com/docs-static/images/providers/anthropic-dark.svg)![Anthropic](https://cursor.com/docs-static/images/providers/anthropic-light.svg)<br>[Claude 4.7 Opus](https://cursor.com/docs/models/claude-opus-4-7) | $5 | $6.25 | $0.5 | $25 |

All Opus 4.7 prompts bill at the base per-token rates in the table above, including when you use Max Mode and context goes above 200k. There is no separate long-context multiplier for Opus 4.7; up to 1M tokens at the same rates.

Opus 4.7 supports a thinking variant for deeper reasoning. We recommend using the high thinking variant for the strongest results.

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