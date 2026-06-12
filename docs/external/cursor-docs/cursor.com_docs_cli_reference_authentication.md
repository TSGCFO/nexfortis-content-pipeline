<!-- Source: https://cursor.com/docs/cli/reference/authentication -->
<!-- Title: Authentication | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/cli/reference/authentication#main-content)

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

[Slash Commands](https://cursor.com/docs/cli/reference/slash-commands)

[Parameters](https://cursor.com/docs/cli/reference/parameters)

[Authentication](https://cursor.com/docs/cli/reference/authentication)

[Permissions](https://cursor.com/docs/cli/reference/permissions)

[Configuration](https://cursor.com/docs/cli/reference/configuration)

## Teams & Enterprise

Teams

Enterprise

CLI

# Authentication

Cursor CLI supports two authentication methods: browser-based login (recommended) and API keys.

## [Browser authentication (recommended)](https://cursor.com/docs/cli/reference/authentication\#browser-authentication-recommended)

Use the browser flow for the easiest authentication experience:

```
# Log in using browser flow
agent login

# Check authentication status
agent status

# Log out and clear stored authentication
agent logout
```

The login command will open your default browser and prompt you to authenticate with your Cursor account. Once completed, your credentials are securely stored locally.

## [API key authentication](https://cursor.com/docs/cli/reference/authentication\#api-key-authentication)

For automation, scripts, or CI/CD environments, use API key authentication:

### [Step 1: Generate an API key](https://cursor.com/docs/cli/reference/authentication\#step-1-generate-an-api-key)

Generate a user API key from [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations) under **API Keys**.

### [Step 2: Set the API key](https://cursor.com/docs/cli/reference/authentication\#step-2-set-the-api-key)

You can provide the API key in two ways:

**Option 1: Environment variable (recommended)**

```
export CURSOR_API_KEY=your_api_key_here
agent "implement user authentication"
```

**Option 2: Command line flag**

```
agent --api-key your_api_key_here "implement user authentication"
```

## [Authentication status](https://cursor.com/docs/cli/reference/authentication\#authentication-status)

Check your current authentication status:

```
agent status
```

This command will display:

- Whether you're authenticated
- Your account information
- Current endpoint configuration

## [Troubleshooting](https://cursor.com/docs/cli/reference/authentication\#troubleshooting)

- **"Not authenticated" errors:** Run `agent login` or ensure your API key is correctly set
- **SSL certificate errors:** Use the `--insecure` flag for development environments
- **Endpoint issues:** Use the `--endpoint` flag to specify a custom API endpoint

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