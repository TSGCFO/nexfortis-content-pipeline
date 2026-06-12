<!-- Source: https://cursor.com/docs/agent/prompting -->
<!-- Title: Prompting agents | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/agent/prompting#main-content)

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

# Prompting agents

Direct Agent with text prompts in the chat input. You can attach context, images, and voice, and switch models at any point.

## [@ mentions](https://cursor.com/docs/agent/prompting\#mentions)

Type `@` in the chat input to attach specific context to your prompt. Start typing after `@` and Cursor shows matching suggestions.

- **Files & Folders**: `@auth.ts` or `@src/components/` to include files or folders (type `/` after selecting a folder to navigate deeper)
- **Docs**: `@Docs` to search indexed documentation, including your own (add via `@Docs > Add new doc`)
- **Terminals**: `@Terminals` to include terminal output as context
- **Past Chats**: `@Past Chats` to reference context from a previous conversation
- **Git diffs**: `@Commit (Diff of Working State)` for uncommitted changes, or `@Branch (Diff with Main)` for your full branch diff
- **Browser**: `@Browser` to attach context from the built-in browser

Use @ mentions when you know which files are relevant. If you're not sure which files matter, skip it — Agent finds relevant files through its own search.

## [Image input](https://cursor.com/docs/agent/prompting\#image-input)

Attach images to your prompt to provide visual context for UI work, debugging, and design implementation.

- **Drag and drop** an image file into the chat input
- **Paste from clipboard** with `Cmd+VCtrl+V`, including screenshots

This is useful for implementing design mockups, debugging visual issues, and referencing error messages or stack traces without manual transcription.

## [Voice input](https://cursor.com/docs/agent/prompting\#voice-input)

Click the microphone icon in the chat input to dictate your prompt instead of typing. Speak naturally, include technical details like file and function names, and review the transcription before sending.

## [Context usage](https://cursor.com/docs/agent/prompting\#context-usage)

Every chat shares a fixed context window with the model. As you add files, run tools, and exchange messages, those tokens fill up. When the window gets close to full, Cursor compresses older parts of the conversation into a summary to leave more room for new conversation.

The context ring next to your prompt input shows how full the window is at a glance. Click the ring to open the breakdown tray, which shows the total tokens used split by category:

- **System prompt**: Cursor's built-in instructions for the model
- **Tools**: definitions of every tool available to the agent
- **Rules**: project and user rules included in the prompt
- **Skills**: skill descriptions injected into the system context
- **MCP**: instructions and catalog from connected MCP servers
- **Subagents**: documentation for subagent types the agent can launch
- **Summarized conversation**: compressed summaries of earlier turns
- **Conversation**: your messages, the agent's replies, and tool results

Hover a segment in the bar or a row in the list to highlight that category.

## [Changing models](https://cursor.com/docs/agent/prompting\#changing-models)

Use the model picker dropdown at the top of the chat input to switch models, or press `Cmd /Ctrl /` to cycle through models. The change applies to the current conversation going forward. Set a default model in **Cursor Settings > Models**.

- **Faster models** work well for quick edits and routine tasks
- **More capable models** are better for complex reasoning and multi-file refactoring

You can switch models mid-conversation, for example when a faster model handled exploration but you need deeper reasoning for implementation. See [Models & Pricing](https://cursor.com/docs/models-and-pricing) for the full list.

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