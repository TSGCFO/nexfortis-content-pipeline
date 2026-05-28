<!-- Source: https://cursor.com/docs/account/teams/pricing -->
<!-- Title: Team Pricing | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/account/teams/pricing#main-content)

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

[Get Started](https://cursor.com/docs/account/teams/setup)

[Pricing](https://cursor.com/docs/account/teams/pricing)

[Members & Roles](https://cursor.com/docs/account/teams/members)

[SSO](https://cursor.com/docs/account/teams/sso)

[Dashboard](https://cursor.com/docs/account/teams/dashboard)

[Analytics](https://cursor.com/docs/account/teams/analytics)

Enterprise

Teams & Enterprise

# Team Pricing

There are two teams plans: Teams ($40/user/mo) and Enterprise (Custom).

Team plans provide additional features like:

- Privacy Mode enforcement
- Admin Dashboard with usage stats (also accessible via [Admin API](https://cursor.com/docs/account/teams/admin-api))
- Centralized team billing
- SAML/OIDC SSO

We recommend Teams for any customer that is happy self-serving. We recommend [Enterprise](https://cursor.com/docs/enterprise) for customers that need priority support, pooled usage, invoicing, SCIM, or advanced security controls. [Contact sales](https://cursor.com/contact-sales?source=docs-teams-pricing) to get started.

## [How pricing works](https://cursor.com/docs/account/teams/pricing\#how-pricing-works)

Teams pricing is usage-based. Each seat includes monthly usage, and you can continue using Cursor beyond that with on-demand usage.

### [Included usage](https://cursor.com/docs/account/teams/pricing\#included-usage)

Each team seat ($40/mo) comes with **$20/mo of included usage**. This usage:

- Is allocated per user (each user gets their own $20)
- Does not transfer between team members
- Resets at the start of each billing cycle
- Covers all agent requests at public list API prices + Cursor Token Rate

Our [Enterprise plan](https://cursor.com/docs/enterprise) offers pooled usage shared between all users in a team. [Get in touch](https://cursor.com/contact-sales?source=docs-teams-pricing) with our team to learn more.

### [On-demand usage](https://cursor.com/docs/account/teams/pricing\#on-demand-usage)

On-demand usage allows you to continue using models after your included amount is consumed, billed in arrears.

When exceeding the $20 of included usage, team members automatically continue with **on-demand usage**:

- Billed monthly at the same rates (API prices + Cursor Token Rate)
- No interruption in service or quality
- Tracked per user in your admin dashboard (see [spending data API](https://cursor.com/docs/account/teams/admin-api#get-spending-data))
- Can be controlled with spending limits

On-demand usage is enabled by default for the Teams plan.

### [Cursor Token Rate](https://cursor.com/docs/account/teams/pricing\#cursor-token-rate)

All non-Auto agent requests include a **Cursor Token Rate of $0.25 per million tokens**. This covers:

- [Semantic search](https://cursor.com/docs/agent/tools/search)
- Custom model execution (Tab, Apply, etc.)
- Infrastructure and processing costs

The Cursor Token Rate applies to all tokens: input, output, and cached tokens. This applies to [BYOK](https://cursor.com/help/models-and-usage/api-keys) as well.

## [Active seats](https://cursor.com/docs/account/teams/pricing\#active-seats)

Cursor bills per active user, not pre-allocated seats. Add or remove users anytime and billing will adjust immediately.

Refunds appear as account credit on your next invoice. Your renewal date stays the same.

## [Spending controls](https://cursor.com/docs/account/teams/pricing\#spending-controls)

Teams can configure monthly team-wide spending limits. You can manage these limits through the dashboard. Per-member spend limits are available on [Enterprise](https://cursor.com/docs/enterprise) plans.

Contact `enterprise@cursor.com` for volume discounts on larger teams.

## [Model Pricing](https://cursor.com/docs/account/teams/pricing\#model-pricing)

All prices are per million tokens. Teams are charged at public list API prices + [Cursor Token Rate](https://cursor.com/docs/account/teams/pricing#cursor-token-rate).

| Name | Input | Cache Write | Cache Read | Output |
| --- | --- | --- | --- | --- |
| ![Anthropic](https://cursor.com/docs-static/images/providers/anthropic-dark.svg)![Anthropic](https://cursor.com/docs-static/images/providers/anthropic-light.svg)<br>[Claude 4.6 Sonnet](https://cursor.com/docs/models/claude-4-6-sonnet) | $3 | $3.75 | $0.3 | $15 |
| ![Anthropic](https://cursor.com/docs-static/images/providers/anthropic-dark.svg)![Anthropic](https://cursor.com/docs-static/images/providers/anthropic-light.svg)<br>[Claude 4.7 Opus](https://cursor.com/docs/models/claude-opus-4-7) | $5 | $6.25 | $0.5 | $25 |
| ![Cursor](https://cursor.com/docs-static/images/providers/cursor.svg)<br>[Composer 2.5](https://cursor.com/docs/models/cursor-composer-2-5) | $0.5 | - | $0.2 | $2.5 |
| ![Google](https://cursor.com/docs-static/images/providers/google.svg)<br>[Gemini 3.1 Pro](https://cursor.com/docs/models/gemini-3-1-pro) | $2 | - | $0.2 | $12 |
| ![Google](https://cursor.com/docs-static/images/providers/google.svg)<br>[Gemini 3.5 Flash](https://cursor.com/docs/models/gemini-3-5-flash) | $1.5 | - | $0.15 | $9 |
| ![OpenAI](https://cursor.com/docs-static/images/providers/openai-dark.svg)![OpenAI](https://cursor.com/docs-static/images/providers/openai-light.svg)<br>[GPT-5.3 Codex](https://cursor.com/docs/models/gpt-5-3-codex) | $1.75 | - | $0.175 | $14 |
| ![OpenAI](https://cursor.com/docs-static/images/providers/openai-dark.svg)![OpenAI](https://cursor.com/docs-static/images/providers/openai-light.svg)<br>[GPT-5.5](https://cursor.com/docs/models/gpt-5-5) | $5 | - | $0.5 | $30 |
| ![xAI](https://cursor.com/docs-static/images/providers/xai-dark.svg)![xAI](https://cursor.com/docs-static/images/providers/xai-light.svg)<br>[Grok 4.3](https://cursor.com/docs/models/grok-4-3) | $1.25 | - | $0.2 | $2.5 |

Show more models

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