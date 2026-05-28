<!-- Source: https://cursor.com/docs/integrations/microsoft-teams -->
<!-- Title: Microsoft Teams | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/integrations/microsoft-teams#main-content)

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

# Microsoft Teams

With Cursor's integration for Microsoft Teams, you can use [Cloud Agents](https://cursor.com/docs/cloud-agent) to work on tasks directly from Microsoft Teams by mentioning `@Cursor` with a prompt.

media loading

### Network Error

A network error caused the media download to fail.



PlayPause

en0:00

en0:00

PlayPause10

Seek backward
10
10

Seek forward
10
0:00 / 0:00

MuteUnmute

Quality1x

Playback rate

Audio

Captions

start airplaystop airplay

Start castingStop casting

Enter picture in picture modeExit picture in picture mode

Enter fullscreen modeExit fullscreen mode![](https://image.mux.com/TfyuhEPVOHhiRWgSJhsxVoEqW1Q5pLq01VeBShOx2S6s/thumbnail.webp)

## [Get started](https://cursor.com/docs/integrations/microsoft-teams\#get-started)

### [Installation](https://cursor.com/docs/integrations/microsoft-teams\#installation)

1. Go to [Cursor integrations](https://www.cursor.com/dashboard/integrations)

2. Click _Connect_ next to Microsoft Teams or go to the [Microsoft Marketplace listing](https://marketplace.microsoft.com/en-us/product/WA200010720)

3. Install the Cursor app in your Microsoft Teams workspace

4. After installing in Microsoft Teams, you'll be redirected back to Cursor to finalize setup
1. Connect GitHub or GitLab, if you haven't connected a repository provider yet
2. Enable usage-based pricing
3. Confirm privacy settings
5. Start using Cloud Agents in Microsoft Teams by mentioning `@Cursor`


## [How to use](https://cursor.com/docs/integrations/microsoft-teams\#how-to-use)

Mention `@Cursor` and give your prompt. Cursor automatically picks the right repository and model based on your message, the thread context, and your recent agent activity.

To use a specific repository, include its name in your message:

- `@Cursor in cursor-app, fix the login bug`
- `@Cursor fix the auth issue in backend-api`

To use a specific model, mention it in your message:

- `@Cursor with opus, fix the login bug`
- `@Cursor use gpt-5.2 to refactor the auth module`

### [Commands](https://cursor.com/docs/integrations/microsoft-teams\#commands)

Run `@Cursor help` for an up-to-date command list.

| Command | Description |
| --- | --- |
| `@Cursor [prompt]` | Start a Cloud Agent. In channel threads with existing agents, adds follow-up instructions |
| `@Cursor help` | Show setup and usage help |
| `@Cursor unlink` | Disconnect your Cursor account from Microsoft Teams |
| `@Cursor disconnect` | Disconnect your Cursor account from Microsoft Teams |
| `@Cursor [options] [prompt]` | Use advanced options: `repo`, `branch`, `model` |

#### [Options](https://cursor.com/docs/integrations/microsoft-teams\#options)

Customize Cloud Agent behavior with these options:

| Option | Description | Example |
| --- | --- | --- |
| `repo` | Specify repository | `repo=acme/web-app` |
| `branch` | Specify base branch | `branch=main` |
| `model` | Specify model | `model=opus` |

#### [Syntax formats](https://cursor.com/docs/integrations/microsoft-teams\#syntax-formats)

Natural:

```
@Cursor with opus, fix the login bug in backend-api
```

Inline:

```
@Cursor repo=acme/backend branch=dev model=opus Fix the login bug
```

#### [Option precedence](https://cursor.com/docs/integrations/microsoft-teams\#option-precedence)

When combining options:

- **Explicit values** override defaults
- **Inline options** override model and repository values inferred from your message
- **Dashboard settings** apply when no value is specified or inferred

The bot parses options from anywhere in the message, allowing natural command writing.

#### [Using thread context](https://cursor.com/docs/integrations/microsoft-teams\#using-thread-context)

Cloud Agents understand and use context from existing Microsoft Teams discussions. This is useful when your team discusses an issue and you want the agent to make the code change based on that conversation.

Cloud Agents read the relevant thread or chat context when invoked,
understanding and acting on your team's discussion.

#### [Follow-up instructions](https://cursor.com/docs/integrations/microsoft-teams\#follow-up-instructions)

In channel threads, reply in the agent's thread with another `@Cursor` mention to add follow-up instructions.

In personal chats and group chats, continue the conversation from Cursor using _Open in Web_ or _Open in Desktop_.

### [Status updates & handoff](https://cursor.com/docs/integrations/microsoft-teams\#status-updates-handoff)

When Cloud Agent starts, Microsoft Teams shows a launch card with the selected repository, model, and branch. The card includes options to _Open in Web_, _Open in Desktop_, and _Switch repository_.

When Cloud Agent completes, you get a Microsoft Teams notification with the result. If the agent opened a pull request, the card includes an option to view the PR.

### [Managing agents](https://cursor.com/docs/integrations/microsoft-teams\#managing-agents)

Manage Cloud Agents using actions on the Microsoft Teams cards.

Available options:

- **Add follow-up**: Add instructions to an existing agent from a channel thread
- **Switch repository**: Relaunch the same request against a different repository
- **Delete**: Stop and archive the Cloud Agent
- **Open in Web**: Continue in the web interface
- **Open in Desktop**: Continue in Cursor
- **Update settings**: Manage your Cloud Agent defaults
- **Give feedback**: Send feedback about agent performance

## [Configuration](https://cursor.com/docs/integrations/microsoft-teams\#configuration)

Manage default settings and privacy options from [Dashboard -> Cloud Agents](https://www.cursor.com/dashboard/cloud-agents).

### [Settings](https://cursor.com/docs/integrations/microsoft-teams\#settings)

#### [Default model](https://cursor.com/docs/integrations/microsoft-teams\#default-model)

Used when no model is specified in your message. See [settings](https://www.cursor.com/dashboard/cloud-agents) for available options.

#### [Repository selection](https://cursor.com/docs/integrations/microsoft-teams\#repository-selection)

Cursor automatically selects the right repository based on:

1. **Your message content**: repository names or keywords in your prompt
2. **Recent agent activity**: repositories you've used recently
3. **Default repository**: fallback when no match is found

To use a specific repository, include its name in your message. For example: `@Cursor in mobile-app, fix the login bug`.

#### [Base branch](https://cursor.com/docs/integrations/microsoft-teams\#base-branch)

Starting branch for Cloud Agent. Leave blank to use the repository's default branch, often `main`.

### [Routing behavior](https://cursor.com/docs/integrations/microsoft-teams\#routing-behavior)

Cursor evaluates your Microsoft Teams message in this order:

1. **Explicit options**: `repo`, `branch`, and `model` values in your prompt
2. **Your message content**: repository names, model names, or branch names in your prompt
3. **Recent agent activity**: repositories you've used recently
4. **Default repository**: fallback when no match is found

### [Privacy](https://cursor.com/docs/integrations/microsoft-teams\#privacy)

Cloud Agents support Privacy Mode.

Read more about [Privacy Mode](https://www.cursor.com/privacy-overview) or manage your [privacy settings](https://www.cursor.com/dashboard/cloud-agents).

Privacy Mode (Legacy) is not supported. Cloud Agents require temporary
code storage while running.

#### [Display agent summary](https://cursor.com/docs/integrations/microsoft-teams\#display-agent-summary)

Display agent summaries and diff images. They may contain file paths or code snippets. You can turn this on or off.

## [Permissions](https://cursor.com/docs/integrations/microsoft-teams\#permissions)

Cursor requests these Microsoft Teams permissions for Cloud Agents to work in your workspace:

| Permission | Description |
| --- | --- |
| `identity` | Identifies the Microsoft Teams user starting or managing an agent |
| `messageTeamMembers` | Sends direct messages for setup, account linking, and notifications |
| `ChannelMessage.Read.Group` | Reads channel messages and replies for thread context |
| `ChatMessage.Read.Chat` | Reads personal and group chat messages for conversation context |
| `ChannelSettings.Read.Group` | Reads channel metadata, including channel names and descriptions |
| `TeamSettings.Read.Group` | Reads team metadata, including team names and descriptions |

The Cursor app supports personal chats, team channels, and group chats in Microsoft Teams.

## [Disclaimer](https://cursor.com/docs/integrations/microsoft-teams\#disclaimer)

Cursor can make mistakes. Please double-check code and responses.

## [Privacy Policy](https://cursor.com/docs/integrations/microsoft-teams\#privacy-policy)

For information about how Cursor collects, uses, and protects your data, see our [Privacy Policy](https://cursor.com/privacy).

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