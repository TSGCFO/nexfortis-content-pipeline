<!-- Source: https://cursor.com/docs/integrations/slack -->
<!-- Title: Slack | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/integrations/slack#main-content)

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

# Slack

With Cursor's integration for Slack, you can use [Cloud Agents](https://cursor.com/docs/cloud-agent) to work on your tasks directly from Slack by mentioning `@cursor` with a prompt.

## [Get started](https://cursor.com/docs/integrations/slack\#get-started)

### [Installation](https://cursor.com/docs/integrations/slack\#installation)

1. Go to [Cursor integrations](https://www.cursor.com/dashboard/integrations)

2. Click _Connect_ next to Slack or go to [installation page](https://cursor.com/api/install-slack-app) from here

3. You'll be prompted to install the Cursor app for Slack in your workspace.

4. After installing in Slack, you'll be redirected back to Cursor to finalize setup
1. Connect GitHub (if not already connected) and pick a default repository
2. Enable usage-based pricing
3. Confirm privacy settings
5. Start using Cloud Agents in Slack by mentioning `@cursor`


## [How to use](https://cursor.com/docs/integrations/slack\#how-to-use)

Mention `@cursor` and give your prompt. Cursor automatically picks the right repository and model based on your message and your recent agent activity.

To use a specific repository, include its name in your message:

- `@Cursor in cursor-app, fix the login bug`
- `@Cursor fix the auth issue in backend-api`

To use a specific model, mention it in your message:

- `@Cursor with opus, fix the login bug`
- `@Cursor use gpt-5.2 to refactor the auth module`

### [Commands](https://cursor.com/docs/integrations/slack\#commands)

Run `@Cursor help` for an up-to-date command list.

| Command | Description |
| --- | --- |
| `@Cursor [prompt]` | Start a Cloud Agent. In threads with existing agents, adds followup instructions |
| `@Cursor settings` | Configure defaults and channel's default repository |
| `@Cursor [options] [prompt]` | Use advanced options: `branch`, `autopr` |
| `@Cursor agent [prompt]` | Force create a new agent in a thread |
| `@Cursor list my agents` | Show your running agents |

#### [Options](https://cursor.com/docs/integrations/slack\#options)

Customize Cloud Agent behavior with these options:

| Option | Description | Example |
| --- | --- | --- |
| `branch` | Specify base branch | `branch=main` |
| `autopr` | Enable/disable automatic PR creation | `autopr=false` |

#### [Syntax Formats](https://cursor.com/docs/integrations/slack\#syntax-formats)

Natural:

```
@Cursor with opus, fix the login bug in backend-api
```

Inline:

```
@Cursor branch=dev autopr=false Fix the login bug in backend-api
```

#### [Option precedence](https://cursor.com/docs/integrations/slack\#option-precedence)

When combining options:

- **Explicit values** override defaults
- **Later values** override earlier ones if duplicated
- **Inline options** take precedence over settings modal defaults

The bot parses options from anywhere in the message, allowing natural command writing.

#### [Using thread context](https://cursor.com/docs/integrations/slack\#using-thread-context)

Cloud Agents understand and use context from existing thread discussions. Useful when your team discusses an issue and you want the agent to implement the solution based on that conversation.

Cloud Agents read the entire thread for context when invoked,
understanding and implementing solutions based on the team's discussion.

#### [When to use force commands](https://cursor.com/docs/integrations/slack\#when-to-use-force-commands)

**When do I need `@Cursor agent`?**

In threads with existing agents, `@Cursor [prompt]` adds followup instructions (only works if you own the agent). Use `@Cursor agent [prompt]` to launch a separate agent.

**When do I need `Add follow-up` (from context menu)?**

Use the context menu (⋯) on an agent's response for followup instructions. Useful when multiple agents exist in a thread and you need to specify which one to follow up on.

### [Status updates & handoff](https://cursor.com/docs/integrations/slack\#status-updates-handoff)

When Cloud Agent runs, you first get an option to _Open in Cursor_.

![Open in Cursor button in Slack](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Fcloud-agent%2Fslack%2Fslack-open-in-cursor.png&w=1920&q=75&dpl=dpl_6LdMA7sdxDoCT6KB9Rg8wuq34E3u)

When Cloud Agent completes, you get a notification in Slack and an option to view the created PR in GitHub.

![View PR in GitHub in Slack](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Fcloud-agent%2Fslack%2Fslack-view-pr.png&w=1920&q=75&dpl=dpl_6LdMA7sdxDoCT6KB9Rg8wuq34E3u)

### [Managing agents](https://cursor.com/docs/integrations/slack\#managing-agents)

To see all running agents, run `@Cursor list my agents`.

Manage Cloud Agents using the context menu by clicking the three dots (⋯) on any agent message.

![Slack agent context menu](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Fcloud-agent%2Fslack%2Fslack-context-menu.png&w=1920&q=75&dpl=dpl_6LdMA7sdxDoCT6KB9Rg8wuq34E3u)

Available options:

- **Add follow-up**: Add instructions to an existing agent
- **Delete**: Stop and archive the Cloud Agent
- **View request ID**: View unique request ID for troubleshooting (include when contacting support)
- **Give feedback**: Provide feedback about agent performance

## [Configuration](https://cursor.com/docs/integrations/slack\#configuration)

Manage default settings and privacy options from [Dashboard → Cloud Agents](https://www.cursor.com/dashboard/cloud-agents).

### [Settings](https://cursor.com/docs/integrations/slack\#settings)

#### [Default Model](https://cursor.com/docs/integrations/slack\#default-model)

Used when no model is specified in your message. See [settings](https://www.cursor.com/dashboard/cloud-agents) for available options.

#### [Repository Selection](https://cursor.com/docs/integrations/slack\#repository-selection)

Cursor automatically selects the right repository based on:

1. **Your message content** — Repository names or keywords in your prompt
2. **Recent agent activity** — Repositories you've used recently
3. **Routing rules** — Custom keyword-to-repo mappings (see below)
4. **Default repository** — Fallback when no match is found

To use a specific repository, include its name in your message. For example: `@Cursor in mobile-app, fix the login bug`.

#### [Base Branch](https://cursor.com/docs/integrations/slack\#base-branch)

Starting branch for Cloud Agent. Leave blank to use the repository's default branch (often `main`)

### [Channel Settings](https://cursor.com/docs/integrations/slack\#channel-settings)

Configure default settings at the channel level using `@Cursor settings`. These settings are per team and override your personal defaults for that channel.

Channel settings only apply to public channels.

Particularly useful when:

- Different channels work on different repositories
- Teams want consistent settings across all members

To configure channel settings:

1. Run `@Cursor settings` in the desired channel
2. Set the default repository for that channel
3. All team members using Cloud Agents in that channel use these defaults

Channel settings take precedence over personal defaults but can be overridden
by mentioning a specific repo in your message.

### [Routing Rules](https://cursor.com/docs/integrations/slack\#routing-rules)

Routing rules let you define keywords that automatically map to specific repositories. When your message contains specific keywords, Cursor routes the agent to the associated repo.

#### [Setting up routing rules](https://cursor.com/docs/integrations/slack\#setting-up-routing-rules)

1. Go to [Dashboard → Cloud Agents](https://www.cursor.com/dashboard/cloud-agents)
2. Find the **Routing Rules** section
3. Add keyword-to-repository mappings

#### [Example rules](https://cursor.com/docs/integrations/slack\#example-rules)

| Keyword | Repository |
| --- | --- |
| `frontend` | `acme/web-app` |
| `mobile` | `acme/mobile-app` |
| `api` | `acme/backend-services` |
| `docs` | `acme/documentation` |

With these rules configured:

- `@Cursor fix the frontend nav bug` → routes to `acme/web-app`
- `@Cursor update the mobile onboarding flow` → routes to `acme/mobile-app`
- `@Cursor add rate limiting to the api` → routes to `acme/backend-services`

#### [How routing works](https://cursor.com/docs/integrations/slack\#how-routing-works)

Cursor evaluates your message in this order:

1. **Your message content** — Repository names or keywords in your prompt
2. **Recent agent activity** — Repositories you've used recently
3. **Routing rules** — Custom keyword-to-repo mappings
4. **Channel default** — The repository set for this channel
5. **Default repository** — Fallback when no match is found

### [Privacy](https://cursor.com/docs/integrations/slack\#privacy)

Cloud Agents support Privacy Mode.

Read more about [Privacy Mode](https://www.cursor.com/privacy-overview) or manage your [privacy settings](https://www.cursor.com/dashboard/cloud-agents).

Privacy Mode (Legacy) is not supported. Cloud Agents require temporary
code storage while running.

#### [Display Agent Summary](https://cursor.com/docs/integrations/slack\#display-agent-summary)

Display agent summaries and diff images. May contain file paths or code snippets. Can be turned On/Off.

#### [Display Agent Summary in External Channels](https://cursor.com/docs/integrations/slack\#display-agent-summary-in-external-channels)

For Slack Connect with other workspaces or channels with external members like Guests, choose to display agent summaries in external channels.

## [Permissions](https://cursor.com/docs/integrations/slack\#permissions)

Cursor requests these Slack permissions for Cloud Agents to work within your workspace:

| Permission | Description |
| --- | --- |
| `app_mentions:read` | Detects @mentions to start Cloud Agents and respond to requests |
| `channels:history` | Reads previous messages in threads for context when adding follow-up instructions |
| `channels:join` | Automatically joins public channels when invited or requested |
| `channels:read` | Accesses channel metadata (IDs and names) to post replies and updates |
| `chat:write` | Sends status updates, completion notifications, and PR links when agents finish |
| `files:read` | Downloads shared files (logs, screenshots, code samples) for additional context |
| `files:write` | Uploads visual summaries of agent changes for quick review |
| `groups:history` | Reads previous messages in private channels for context in multi-turn conversations |
| `groups:read` | Accesses private channel metadata to post responses and maintain conversation flow |
| `im:history` | Accesses direct message history for context in continued conversations |
| `im:read` | Reads DM metadata to identify participants and maintain proper threading |
| `im:write` | Initiates direct messages for private notifications or individual communication |
| `mpim:history` | Accesses group DM history for multi-participant conversations |
| `mpim:read` | Reads group DM metadata to address participants and ensure proper delivery |
| `reactions:read` | Observes emoji reactions for user feedback and status signals |
| `reactions:write` | Adds emoji reactions to mark status - ⏳ for running, ✅ for completed, ❌ for failed |
| `team:read` | Identifies workspace details to separate installations and apply settings |
| `users:read` | Matches Slack users with Cursor accounts for permissions and secure access |

## [Disclaimer](https://cursor.com/docs/integrations/slack\#disclaimer)

Cursor can make mistakes. Please double-check code and responses.

## [Privacy Policy](https://cursor.com/docs/integrations/slack\#privacy-policy)

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