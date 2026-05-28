<!-- Source: https://cursor.com/docs/account/pricing/request-based-legacy -->
<!-- Title: Request-Based Legacy Pricing | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/account/pricing/request-based-legacy#main-content)

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

# Request-Based Pricing (Legacy)

This page covers Cursor's legacy request-based pricing model that was used before the transition to usage-based pricing.

## [Overview](https://cursor.com/docs/account/pricing/request-based-legacy\#overview)

The request-based pricing model charged users based on the number of AI requests made rather than token usage. Each license had a monthly allotment of requests. If you exceeded your included usage, you could purchase additional usage on-demand.

### [Request](https://cursor.com/docs/account/pricing/request-based-legacy\#request)

A request represents a single message sent to most models, which includes your message, any relevant context from your codebase, and the model's response. View the model table to see request counts for each model.

- **On-demand usage** is available at the model's API rate plus 20%.
- **[Max Mode](https://cursor.com/help/ai-features/max-mode)** is available at the model's API rate plus 20%. Max Mode enables larger context windows, subagents, image generation, and access to the latest frontier models on request-based plans.

## [Models](https://cursor.com/docs/account/pricing/request-based-legacy\#models)

| Name | Default Context | Max Mode | Capabilities | Requests |
| --- | --- | --- | --- | --- |
| ![Anthropic](https://cursor.com/docs-static/images/providers/anthropic-dark.svg)![Anthropic](https://cursor.com/docs-static/images/providers/anthropic-light.svg)<br>[Claude 4.6 Sonnet](https://cursor.com/docs/models/claude-4-6-sonnet) | 200k | 1M | AgentThinking | - |
| ![Anthropic](https://cursor.com/docs-static/images/providers/anthropic-dark.svg)![Anthropic](https://cursor.com/docs-static/images/providers/anthropic-light.svg)<br>[Claude Opus 4.8](https://cursor.com/docs/models/claude-opus-4-8) | 200k | 1M | AgentThinking | - |
| ![Cursor](https://cursor.com/docs-static/images/providers/cursor.svg)<br>[Composer 2.5](https://cursor.com/docs/models/cursor-composer-2-5) | 200k | - | AgentThinking | 2 |
| ![Google](https://cursor.com/docs-static/images/providers/google.svg)<br>[Gemini 3.1 Pro](https://cursor.com/docs/models/gemini-3-1-pro) | 200k | 1M | AgentThinking | 1 |
| ![Google](https://cursor.com/docs-static/images/providers/google.svg)<br>[Gemini 3.5 Flash](https://cursor.com/docs/models/gemini-3-5-flash) | 200k | 1M | AgentThinking | 1 |
| ![OpenAI](https://cursor.com/docs-static/images/providers/openai-dark.svg)![OpenAI](https://cursor.com/docs-static/images/providers/openai-light.svg)<br>[GPT-5.3 Codex](https://cursor.com/docs/models/gpt-5-3-codex) | 272k | - | AgentThinking | - |
| ![OpenAI](https://cursor.com/docs-static/images/providers/openai-dark.svg)![OpenAI](https://cursor.com/docs-static/images/providers/openai-light.svg)<br>[GPT-5.5](https://cursor.com/docs/models/gpt-5-5) | 272k | 1M | AgentThinking | - |
| ![xAI](https://cursor.com/docs-static/images/providers/xai-dark.svg)![xAI](https://cursor.com/docs-static/images/providers/xai-light.svg)<br>[Grok Build 0.1](https://cursor.com/docs/models/grok-build-0-1) | 256k | - | AgentThinking | - |

Show more models

## [Legacy customers](https://cursor.com/docs/account/pricing/request-based-legacy\#legacy-customers)

If you're on a legacy request-based plan, you can continue using it until your next renewal. At renewal, you'll be migrated to the usage-based pricing model.

## [Migration support](https://cursor.com/docs/account/pricing/request-based-legacy\#migration-support)

Our team is available to help with the transition from legacy pricing to the current model. We can provide:

- Detailed cost analysis comparing old vs new pricing
- Migration timeline and planning
- Custom solutions for enterprise customers

Contact `enterprise@cursor.com` for migration assistance.

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