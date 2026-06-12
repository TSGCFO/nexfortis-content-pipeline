<!-- Source: https://cursor.com/docs/integrations/jetbrains -->
<!-- Title: JetBrains | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/integrations/jetbrains#main-content)

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

Integrations

# JetBrains

Use Cursor's AI agent in IntelliJ IDEA, PyCharm, WebStorm, and other JetBrains IDEs through the [Agent Client Protocol](https://agentclientprotocol.com/) (ACP).

ACP lets you stay in your JetBrains IDE while Cursor handles agent-driven development. You get access to frontier models from OpenAI, Anthropic, Google, and Cursor, along with secure codebase indexing and semantic search.

## [Prerequisites](https://cursor.com/docs/integrations/jetbrains\#prerequisites)

- A paid [Cursor plan](https://cursor.com/docs/models-and-pricing)
- A JetBrains IDE with the [AI Assistant](https://plugins.jetbrains.com/plugin/22282-ai-assistant) plugin enabled (2025.1+)

## [Get started](https://cursor.com/docs/integrations/jetbrains\#get-started)

1

### Open the AI Chat plugin

Open the AI Chat panel in your JetBrains IDE. You can find it in the right sidebar or through **View** \> **Tool Windows** \> **AI Chat**.

2

### Install Cursor from the ACP registry

In the AI Chat panel, open the agent provider list and select **Add Agent from Registry**. Search for **Cursor** and install it.

3

### Authenticate

After installing, select Cursor as your agent provider.

4

### Start coding

Send a prompt in the AI Chat panel. Cursor's agent reads your project, edits files, runs terminal commands, and creates code directly in your JetBrains IDE.

## [What you get](https://cursor.com/docs/integrations/jetbrains\#what-you-get)

Cursor ACP in JetBrains IDEs provides many of the same agent capabilities available across other Cursor surfaces.

- **Model selection** — Choose from [frontier models](https://cursor.com/docs/models-and-pricing) suited to your task. Different models handle different kinds of work better; switch between them as needed.
- **Codebase understanding** — Cursor indexes your codebase and uses semantic search to find relevant code across large projects.
- **File editing** — The agent reads and writes files in your project, with changes reflected in your JetBrains editor.
- **Terminal commands** — The agent runs shell commands in the IDE's integrated terminal.

## [How it works](https://cursor.com/docs/integrations/jetbrains\#how-it-works)

Cursor ACP uses the [Agent Client Protocol](https://agentclientprotocol.com/), an open standard for connecting AI agents to IDEs. Your JetBrains IDE acts as the ACP client, and Cursor's agent acts as the server.

When you send a prompt, the AI Chat plugin forwards it to Cursor's agent through ACP. The agent processes your request, reads your project files, and streams edits and terminal commands back to the IDE.

## [Pricing](https://cursor.com/docs/integrations/jetbrains\#pricing)

Cursor ACP uses the same usage-based pricing as your Cursor subscription. See [pricing](https://cursor.com/docs/models-and-pricing) for details.

## [Related](https://cursor.com/docs/integrations/jetbrains\#related)

[ACP reference\\
\\
Full ACP protocol details, transport, and client examples](https://cursor.com/docs/cli/acp) [Models\\
\\
Available models and their capabilities](https://cursor.com/docs/models-and-pricing)

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