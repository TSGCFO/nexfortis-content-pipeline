<!-- Source: https://cursor.com/docs/reference/deeplinks -->
<!-- Title: Deeplinks | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/reference/deeplinks#main-content)

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

# Deeplinks

Deeplinks allow you to share prompts, commands, and rules with others, enabling collaboration and knowledge sharing across teams and communities.

Links can also be opened via [cursor.com](https://cursor.com/). Append the path and url params to the end of the url, for example: [cursor.com/link/prompt?text=...](https://cursor.com/link/prompt?text=Research+and+find+one+bug+in+this+codebase)

Always review your prompts and commands before sharing to ensure they don't contain sensitive information like API keys, passwords, or proprietary code.

## [Prompts](https://cursor.com/docs/reference/deeplinks\#prompts)

Share prompts that others can use to get started quickly with specific tasks or workflows. When someone clicks a prompt deeplink, it opens Cursor with the prompt pre-filled in the chat. The user must review and confirm the prompt before it gets executed. Deeplinks never trigger automatic execution.

Research and find one bug in this codebase

[Cursor LogoTry in Cursor](cursor://anysphere.cursor-deeplink/prompt?text=Research%20and%20find%20one%20bug%20in%20this%20codebase)

PlaygroundTypeScriptPython

Text

Progress circle

Copy link

## [Commands](https://cursor.com/docs/reference/deeplinks\#commands)

Share commands that others can execute directly in their Cursor environment. Command deeplinks allow you to share custom commands defined in your `.cursor/commands` directory. When someone clicks a command deeplink, it opens Cursor and creates a new command with the specified name and content. The user must review and confirm the command before it gets executed.

debug-api: Add console.log statements to debug API responses

[Cursor LogoAdd to Cursor](cursor://anysphere.cursor-deeplink/command?name=debug-api&text=Add%20console.log%20statements%20to%20debug%20API%20responses)

PlaygroundTypeScriptPython

Name

Use letters, numbers, dots, hyphens, and underscores only

Content

Progress circle

This will be saved as a command in .cursor/commands/

Copy link

## [Rules](https://cursor.com/docs/reference/deeplinks\#rules)

Share rules that others can add to their Cursor environment. Rule deeplinks allow you to share custom rules defined in your `.cursor/rules` directory. When someone clicks a rule deeplink, it opens Cursor and creates a new rule with the specified name and content. The user must review and confirm the rule before it gets added.

typescript-strict: Always use strict TypeScript types and avoid 'any'

[Cursor LogoAdd to Cursor](cursor://anysphere.cursor-deeplink/rule?name=typescript-strict&text=Always%20use%20strict%20TypeScript%20types%20and%20avoid%20%27any%27)

PlaygroundTypeScriptPython

Name

Use letters, numbers, dots, hyphens, and underscores only

Content

Progress circle

This will be saved as a rule in .cursor/rules/

Copy link

## [FAQ](https://cursor.com/docs/reference/deeplinks\#faq)

### What is the maximum length for deeplink URLs?

Deeplink URLs have a maximum length of 8,000 characters. When generating deeplinks programmatically, ensure your content doesn't exceed this limit when URL-encoded. The interactive generators above will show you the current URL length and remaining characters as you type.

### How do I use deeplinks on the web instead of in the Cursor app?

You can swap the deeplink protocol for web links by changing the base URL from `cursor://anysphere.cursor-deeplink/` to `https://cursor.com/link/`. For example:

```
cursor://anysphere.cursor-deeplink/prompt?text=Hello%20world
```

```
https://cursor.com/link/prompt?text=Hello%20world
```

Web links will redirect users to cursor.com where they can open the deeplink in their browser or copy it to use in Cursor.

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