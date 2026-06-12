<!-- Source: https://cursor.com/docs/integrations/linear -->
<!-- Title: Linear | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/integrations/linear#main-content)

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

# Linear

Use [Cloud Agents](https://cursor.com/docs/cloud-agent) directly from Linear by delegating issues to Cursor or mentioning `@Cursor` in comments.

## [Get started](https://cursor.com/docs/integrations/linear\#get-started)

### [Installation](https://cursor.com/docs/integrations/linear\#installation)

You must be a Cursor admin to connect the Linear integration. Other team
settings are available to non-admin members.

1. Go to [Cursor integrations](https://www.cursor.com/dashboard/integrations)
2. Click _Connect_ next to Linear
3. Connect your Linear workspace and select team
4. Click _Authorize_
5. Complete any remaining Cloud Agent setup in Cursor:
   - Connect GitHub and select default repository
   - Enable usage-based pricing
   - Confirm privacy settings

### [Account linking](https://cursor.com/docs/integrations/linear\#account-linking)

First use prompts account linking between Cursor and Linear. GitHub connection required for PR creation.

## [How to use](https://cursor.com/docs/integrations/linear\#how-to-use)

Delegate issues to Cursor or mention `@Cursor` in comments. Cursor analyzes issues and filters out non-development work automatically.

### [Delegating issues](https://cursor.com/docs/integrations/linear\#delegating-issues)

1. Open Linear issue
2. Click assignee field
3. Select "Cursor"

![Delegating an issue to Cursor in Linear](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Fintegrations%2Flinear%2Flinear-delegate.png&w=1920&q=75&dpl=dpl_7UAjkDundnDt84UyVxZXdo4fDHt5)

### [Mentioning Cursor](https://cursor.com/docs/integrations/linear\#mentioning-cursor)

Mention `@Cursor` in a comment to assign a new agent or provide additional instructions, for example: `@Cursor fix the authentication bug described above`.

## [Workflow](https://cursor.com/docs/integrations/linear\#workflow)

Cloud Agents show real-time status in Linear and create PRs automatically when complete. Track progress in [Cursor dashboard](https://www.cursor.com/dashboard/cloud-agents).

![Cloud Agent status updates in Linear](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Fintegrations%2Flinear%2Flinear-activity.png&w=1920&q=75&dpl=dpl_7UAjkDundnDt84UyVxZXdo4fDHt5)

### [Follow-up instructions](https://cursor.com/docs/integrations/linear\#follow-up-instructions)

You can respond in the agent session and it'll get sent as a follow-up to the agent. Simply mention `@Cursor` in a Linear comment to provide additional guidance to a running Cloud Agent.

## [Configuration](https://cursor.com/docs/integrations/linear\#configuration)

Configure Cloud Agent settings from [Dashboard → Cloud Agents](https://www.cursor.com/dashboard/cloud-agents).

| Setting | Location | Description |
| --- | --- | --- |
| **Default Repository** | Cursor Dashboard | Primary repository when no project repository configured |
| **Default Model** | Cursor Dashboard | AI model for Cloud Agents |
| **Base Branch** | Cursor Dashboard | Branch to create PRs from (typically `main` or `develop`) |

### [Configuration options](https://cursor.com/docs/integrations/linear\#configuration-options)

You can configure Cloud Agent behavior using several methods:

**Issue description or comments**: Use `[key=value]` syntax, for example:

- `@cursor please fix [repo=anysphere/everysphere]`
- `@cursor implement feature [model=claude-3.5-sonnet] [branch=feature-branch]`

**Issue labels**: Use parent-child label structure where the parent label is the configuration key and the child label is the value.

**Project labels**: Same parent-child structure as issue labels, applied at the project level.

Supported configuration keys:

- `repo`: Specify target repository (e.g., `owner/repository`)
- `branch`: Specify base branch for PR creation
- `model`: Specify AI model to use

### [Repository selection](https://cursor.com/docs/integrations/linear\#repository-selection)

Cursor determines which repository to work on using this priority order:

1. **Issue description/comments**: `[repo=owner/repository]` syntax in issue text or comments
2. **Issue labels**: Repository labels attached to the specific Linear issue
3. **Project labels**: Repository labels attached to the Linear project
4. **Default repository**: Repository specified in Cursor dashboard settings

#### [Setting up repository labels](https://cursor.com/docs/integrations/linear\#setting-up-repository-labels)

To create repository labels in Linear:

1. Go to **Settings** in your Linear workspace
2. Click **Labels**
3. Click **New group**
4. Name the group "repo" (case insensitive - must be exactly "repo", not "Repository" or other variations)
5. Within that group, create labels for each repository using the format `owner/repo`

These labels can then be assigned to issues or projects to specify which repository the Cloud Agent should work on.

![Configuring repository labels in Linear](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Fintegrations%2Flinear%2Flinear-project-labels.png&w=1920&q=75&dpl=dpl_7UAjkDundnDt84UyVxZXdo4fDHt5)

## [Advanced features](https://cursor.com/docs/integrations/linear\#advanced-features)

### [Triage rules (Advanced)](https://cursor.com/docs/integrations/linear\#triage-rules-advanced)

Set up automation rules in Linear to automatically delegate issues to Cursor:

1. Go to Linear project settings
2. Navigate to triage rules
3. Create rules that automatically:
   - Add specific labels
   - Assign issues to Cursor
   - Trigger Cloud Agents based on conditions

Triage rules are an advanced feature with some current limitations. Linear
requires a human assignee for rules to fire, though this requirement may be
removed in future updates.

### [Getting help](https://cursor.com/docs/integrations/linear\#getting-help)

Check [agent activity](https://www.cursor.com/dashboard/cloud-agents) and include request IDs when contacting support.

## [Feedback](https://cursor.com/docs/integrations/linear\#feedback)

Share feedback through Linear comments or your Cursor dashboard support channels.

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