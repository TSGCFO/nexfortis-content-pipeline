<!-- Source: https://cursor.com/docs/models-and-pricing -->
<!-- Title: Models & Pricing | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/models-and-pricing#main-content)

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

Get Started

# Models & Pricing

Cursor supports all frontier coding models from OpenAI, Anthropic, Google, and more. Every individual plan includes two usage pools so you can pick the right balance of intelligence, speed, and cost.

## [Usage pools](https://cursor.com/docs/models-and-pricing\#usage-pools)

There are two separate usage pools for individual plans, each resetting with your monthly billing cycle:

- **Auto + Composer**: Significantly more included usage when Auto or Composer 2.5 is selected. Designed for everyday agentic coding at a lower cost.
- **API**: Charged at the model's API price. Individual plans include at least $20 of API usage each month (more on higher tiers) with the option to pay for additional usage as needed.

Both pools are visible in your editor settings and on your [usage dashboard](https://cursor.com/dashboard/usage).

## [Auto + Composer pool](https://cursor.com/docs/models-and-pricing\#auto-composer-pool)

Auto allows Cursor to select models that balance intelligence, cost efficiency, and reliability. It is useful for everyday tasks.

### [Auto pricing](https://cursor.com/docs/models-and-pricing\#auto-pricing)

| Token type | Price per 1M tokens |
| --- | --- |
| Input + Cache Write | $1.25 |
| Output | $6.00 |
| Cache Read | $0.25 |

### [Composer pricing](https://cursor.com/docs/models-and-pricing\#composer-pricing)

Composer 2.5 is Cursor's own model, trained to be highly capable for agentic coding. Both Auto and Composer 2.5 draw from this pool.

| Name | Input | Cache Write | Cache Read | Output |
| --- | --- | --- | --- | --- |
| ![Cursor](https://cursor.com/docs-static/images/providers/cursor.svg)<br>[Composer 2.5](https://cursor.com/docs/models/cursor-composer-2-5) | $0.5 | - | $0.2 | $2.5 |
| ![Cursor](https://cursor.com/docs-static/images/providers/cursor.svg)<br>[Composer 2.5 (Fast)](https://cursor.com/docs/models/cursor-composer-2-5) | $3 | - | $0.5 | $15 |

## [API pool](https://cursor.com/docs/models-and-pricing\#api-pool)

When you select a specific model (or use Premium routing), usage is drawn from the API pool at that model's API rate.

### [Model pricing](https://cursor.com/docs/models-and-pricing\#model-pricing)

All prices are per million tokens, sourced from each provider's API pricing:

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

### [Premium routing](https://cursor.com/docs/models-and-pricing\#premium-routing)

Premium allows Cursor to select the most capable models for you, recommended for the most complex tasks. The Cursor team selects Premium models based on internal benchmarks, evaluations, and user feedback.

Premium pricing is based on the selected model's API rate. Check your [usage page](https://cursor.com/dashboard/usage) to see cost and model selection at the request level.

## [Plans](https://cursor.com/docs/models-and-pricing\#plans)

All individual plans include unlimited tab completions, extended agent usage limits on all models, access to Bugbot, and access to Cloud Agents.

| Plan | Price | API usage included | Auto + Composer |
| --- | --- | --- | --- |
| **Pro** | $20/mo | $20 | Generous included usage |
| **Pro Plus** | $60/mo | $70 | Generous included usage |
| **Ultra** | $200/mo | $400 | Generous included usage |

Since different models have different API costs, your model selection affects how quickly your included usage is consumed.

### [How much usage do I need?](https://cursor.com/docs/models-and-pricing\#how-much-usage-do-i-need)

- **Daily Tab users**: Always stay within $20
- **Limited Agent users**: Often stay within the included $20
- **Daily Agent users**: Typically $60–$100/mo total usage
- **Power users (multiple agents/automation)**: Often $200+/mo total usage

### [What happens when I reach my limit?](https://cursor.com/docs/models-and-pricing\#what-happens-when-i-reach-my-limit)

When you exceed your included monthly usage, you can either:

- **Add on-demand usage**: Continue at the same API rates with pay-as-you-go billing
- **Upgrade your plan**: Move to a higher tier for more included usage

On-demand usage is billed monthly at the same rates. Requests are never downgraded in quality or speed.

### [Teams](https://cursor.com/docs/models-and-pricing\#teams)

There are two teams plans: Teams ($40/user/mo) and Enterprise (Custom).

Team plans provide additional features like privacy mode enforcement, admin dashboard with usage stats, centralized team billing, and SAML/OIDC SSO.

We recommend Teams for any customer that is happy self-serving. We recommend [Enterprise](https://cursor.com/contact-sales?source=docs-models-pricing) for customers that need priority support, pooled usage, invoicing, SCIM, or advanced security controls.

Learn more about [Teams pricing](https://cursor.com/docs/account/teams/pricing).

## [Cursor Token Rate](https://cursor.com/docs/models-and-pricing\#cursor-token-rate)

On Teams plans, non-Auto agent requests include a Cursor Token Rate of $0.25 per million tokens. This rate applies on top of model API pricing for included usage, on-demand usage, and BYOK usage. Auto is exempt from the Cursor Token Rate.

## [Max Mode](https://cursor.com/docs/models-and-pricing\#max-mode)

Max Mode extends the context window to the maximum a model supports. More context gives models deeper understanding of your codebase, leading to better results on complex tasks. The models table above shows each model's maximum context size.

Max Mode uses token-based pricing at the model's API rate, so it consumes usage faster than the default context window. On current individual plans, Max Mode is billed at the model's API rate. On Teams plans, non-Auto requests include the Cursor Token Rate. On legacy request-based plans, Max Mode adds a 20% surcharge.

## [FAQ](https://cursor.com/docs/models-and-pricing\#faq)

### Where are models hosted?

Models are hosted on US, Canada, & Iceland based infrastructure by the model's provider, a trusted partner, or Cursor directly.

When Privacy Mode is enabled, neither Cursor nor model providers store your data. All data is deleted after each request. For details see our [Privacy Policy](https://cursor.com/privacy) and [Security](https://cursor.com/security) pages.

### Where can I find pricing terms?

For enterprise pricing details, billing terms, and fee calculations, see the [Pricing Policy](https://cursor.com/terms/pricing).

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