<!-- Source: https://cursor.com/docs/cloud-agent/best-practices -->
<!-- Title: Cloud Agent Best Practices | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/cloud-agent/best-practices#main-content)

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

Cloud Agents

# Best Practices

Use these recommendations to get more reliable Cloud Agent runs.

## [Set up the environment first](https://cursor.com/docs/cloud-agent/best-practices\#set-up-the-environment-first)

Use [Cloud agent setup](https://cursor.com/docs/cloud-agent/setup) so that Cursor has its environment configured. Like a human developer, Cursor does better work if its environment is set up correctly.

## [Ensure the agent can access what it needs](https://cursor.com/docs/cloud-agent/best-practices\#ensure-the-agent-can-access-what-it-needs)

Before running a Cloud Agent, verify these prerequisites:

- **Secrets**: Make sure the agent has access to required secrets (API keys, database credentials, etc.) through the [Secrets tab](https://cursor.com/dashboard/cloud-agents) in your dashboard.
- **Egress controls**: If you have [network access](https://cursor.com/docs/cloud-agent/security-network) restrictions enabled, ensure all URLs your local development requires are whitelisted.
- **Local testability**: Your repo should be set up to run well locally without requiring external services that cannot be reached from a VM. If it is hard for a human developer to test locally, it will also be hard for an agent.

## [Use skills and agents.md to configure your agent](https://cursor.com/docs/cloud-agent/best-practices\#use-skills-and-agentsmd-to-configure-your-agent)

If the cloud agent is having difficulty testing its changes, we recommend using [skills](https://cursor.com/docs/skills) and agents.md to configure your agent.

Think of the agent as a smart, but low-context human developer. The best way to make sure it does the right thing is to give it the context it needs to understand what to do.

For example, at Cursor our agents.md lists tips for running and debugging the most commonly used microservices in our mono-repo. We also have lots of skills about how to test and debug key services, each with clear instructions on when to use the skill.

The skills contain in-depth details, such as how to debug a specific microservice or how to set up a third-party dependency when needed for testing.

## [Give the agent the tools it needs](https://cursor.com/docs/cloud-agent/best-practices\#give-the-agent-the-tools-it-needs)

We have often found that agents are limited by the tools they have access to. We recommend using MCP and creating custom tools so that the agent has access to the same systems a human developer would.

## [Mold the tools to the agent](https://cursor.com/docs/cloud-agent/best-practices\#mold-the-tools-to-the-agent)

It is important to create tools that the agent is good at using. We recommend creating tools, and iterating based on observations of how the agent uses them.

For example, at Cursor we have created a custom CLI for the model to run micro-services in our codebase. We found that when running custom dev commands, e.g. from a package.json file, some models would forget arguments, or agents would get distracted by noisy build logs which human developers knew to ignore.

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