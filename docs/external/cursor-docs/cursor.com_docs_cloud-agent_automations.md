<!-- Source: https://cursor.com/docs/cloud-agent/automations -->
<!-- Title: Automations | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/cloud-agent/automations#main-content)

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

# Automations

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

Enter fullscreen modeExit fullscreen mode![](https://image.mux.com/00QMZHDmPVrg00wxQglgnYXlXZ639VpcYzMR1g314vvvs/thumbnail.webp)

Cursor Automations run [cloud agents](https://cursor.com/docs/cloud-agent) in the background, either on a schedule or in response to events from GitHub, GitLab, Slack, webhooks, Linear, and more.

Automations can be used to automate tasks like [reviewing recent PR commits for bugs](https://cursor.com/marketplace/automations/find-bugs), [performing deep review for vulnerabilities](https://cursor.com/marketplace/automations/find-vulnerabilities), [triaging bugs in Slack](https://cursor.com/marketplace/automations/fix-slack-bugs), and [summarizing changes to your codebase on a schedule](https://cursor.com/marketplace/automations/daily-digest).

## [Getting started](https://cursor.com/docs/cloud-agent/automations\#getting-started)

Create a new automation in the [Agents Window](https://cursor.com/docs/agent/agents-window), at [cursor.com/automations](https://cursor.com/automations), or start from a template in the [Cursor Marketplace](https://cursor.com/marketplace/automations).

For any path:

1. Choose a trigger, e.g. every hour or when a pull request is opened.
2. Write a prompt with instructions for the automation.
3. Choose the tools the agent is able to use, such as Send to Slack, Comment on Pull Request, or tools from MCP.
4. Choose whether the automation needs a repository, multiple repositories, or no repository at all.
5. Create the automation and watch it run!

## [Billing](https://cursor.com/docs/cloud-agent/automations\#billing)

Automations create cloud agents and are billed based on cloud agent usage. See [cloud agent pricing](https://cursor.com/docs/models-and-pricing#model-pricing) for details.

Automations always run in [Max Mode](https://cursor.com/docs/models-and-pricing#max-mode) because they run as cloud agents. There is no toggle to turn Max Mode off.

How usage is billed depends on the automation's [permission scope](https://cursor.com/docs/cloud-agent/automations#permissions):

- **Team Owned**: Usage is billed to the team's usage pool. Automations execute under a shared team service account, so no individual user's usage is affected.
- **Private**: Usage is billed to the user who created the automation.
- **Team Visible**: Usage is billed to the user who created the automation, the same as Private.

## [Triggers](https://cursor.com/docs/cloud-agent/automations\#triggers)

Triggers decide when an automation runs. An automation can have more than one trigger and is run when _any_ trigger fires.

For certain triggers like Slack or cron schedules, Cursor defaults to not using a repository. If your automation should make code changes, specify which repository or repositories agents should work in. For GitHub and GitLab triggers, specifying a repo or multiple repos is required.

### [Scheduled triggers](https://cursor.com/docs/cloud-agent/automations\#scheduled-triggers)

Scheduled triggers run on a recurring schedule. Choose from preset options or enter a cron expression for precise control.

Scheduled triggers may run with a delay but will not start before the indicated time.

### [GitHub and GitLab triggers](https://cursor.com/docs/cloud-agent/automations\#github-and-gitlab-triggers)

GitHub and GitLab triggers respond to pull request events, such as when a pull request is opened or merged. You can connect the automation to one repository or a multi-repo environment.

- **Draft opened** \- When a draft pull request is created.
- **Pull request opened** \- When a non-draft PR is created or a draft is marked ready for review.
- **Pull request pushed** \- When new commits are pushed to an existing PR.
- **Pull request label changed** \- When a specific label, or any label, is added to or removed from an existing PR.
- **Pull request merged** \- When a PR is merged.
- **Pull request commented** \- When someone comments on a PR.
- **Push to branch** \- When commits are pushed to a specific branch outside a pull request.
- **CI completed** \- When a GitHub or GitLab check finishes on a pull request or branch.

### [Slack triggers](https://cursor.com/docs/cloud-agent/automations\#slack-triggers)

Slack triggers respond to events from the [Cursor Slack integration](https://cursor.com/docs/integrations/slack).

Only public Slack channels are visible to Slack triggers at this time.

- **New message in channel** \- When a message is sent to a connected Slack channel. Without a message filter, the trigger only fires on top-level channel messages. Add a keyword or regex filter if you want runs from threaded replies as well.
- **Channel created** \- When a new public Slack channel is created in your workspace.

### [Webhook triggers](https://cursor.com/docs/cloud-agent/automations\#webhook-triggers)

Webhook triggers create a private HTTP endpoint for your automation. POST to the endpoint to start a run. You can use webhooks to connect automations to internal systems, CI pipelines, monitoring tools, and more.

To retrieve the webhook URL, you must save the automation first, which will then generate a webhook URL to call and an API key for authentication.

### [Linear triggers](https://cursor.com/docs/cloud-agent/automations\#linear-triggers)

Linear triggers respond to events from the [Cursor Linear integration](https://cursor.com/docs/integrations/linear).

- **Issue created** \- When a new issue is created.
- **Status changed** \- When an issue's status changes.
- **End of cycle** \- When a Linear cycle completes.

### [Sentry triggers](https://cursor.com/docs/cloud-agent/automations\#sentry-triggers)

Sentry triggers run when error and issue events occur in your Sentry project. Use them to automatically investigate errors, identify root causes, and propose fixes. See the [Investigate Sentry issues](https://cursor.com/marketplace/automations/investigate-sentry-issues) marketplace template for a ready-made example.

- **Issue created** \- When a new issue is created in Sentry.
- **Issue updated** \- When an existing issue changes, such as a status or assignment update.
- **Any issue event** \- Matches all issue event types.

### [PagerDuty triggers](https://cursor.com/docs/cloud-agent/automations\#pagerduty-triggers)

PagerDuty triggers run on incident events and can be helpful to automatically triage or even resolve incidents.

- **Incident triggered** \- When a new incident is created.
- **Incident acknowledged** \- When an incident is acknowledged.
- **Incident resolved** \- When an incident is resolved.
- **Any incident event** \- Matches all incident event types.

## [Tools](https://cursor.com/docs/cloud-agent/automations\#tools)

Cursor Automations can have tools enabled for richer capabilities around GitHub, Slack, memory, MCP, and more. Automations also include the same base set of tools as other cloud agents. See [Cloud agent capabilities](https://cursor.com/docs/cloud-agent/capabilities) for details.

### [Open pull request](https://cursor.com/docs/cloud-agent/automations\#open-pull-request)

Lets the agent create a new pull request on GitHub. The agent can write code, create a branch, and open the pull request.

Use this when the automation should make code changes.

The pull request is opened against the repositories specified for the GitHub or GitLab trigger. For other triggers, it uses the repositories specified by the environment.

### [Comment on pull request](https://cursor.com/docs/cloud-agent/automations\#comment-on-pull-request)

Posts comments on the triggering pull request. Supports top-level review comments and inline code comments.

This action requires a pull request trigger.

If you enable approvals, the agent can also approve, request changes, and dismiss reviews. Otherwise, it can only post comments.

### [Request reviewers](https://cursor.com/docs/cloud-agent/automations\#request-reviewers)

Requests reviewers on the triggering pull request. The agent can use `git`, memory, and other tools to identify domain experts.

This action requires a pull request trigger.

### [Send to Slack](https://cursor.com/docs/cloud-agent/automations\#send-to-slack)

Sends messages to a Slack channel. You can target a specific channel or let the agent dynamically choose any channel.

When you allow any channel, Cursor also includes the read access needed for the agent to discover available public channels.

Note that the agent is granted read access to public channels that it can send messages to.

### [Read Slack channels](https://cursor.com/docs/cloud-agent/automations\#read-slack-channels)

Gives the agent read-only access to list and read messages from public Slack channels.

Use this when the agent needs more context before it replies or opens a pull request.

### [MCP server](https://cursor.com/docs/cloud-agent/automations\#mcp-server)

Connects an [MCP (Model Context Protocol)](https://cursor.com/docs/mcp) server so the agent can use external tools and data sources.

Connecting an MCP server gives the agent access to every tool exposed by that server. Only connect servers you trust with the permissions your automation needs.

### [Memories](https://cursor.com/docs/cloud-agent/automations\#memories)

Memories let the agent read and write persistent notes across runs for the same automation. Use this to build agents that remember and improve over time. Each memory is stored as a named entry (`MEMORIES.md` by default) that exists outside the agent's working filesystem.

Memories are enabled by default but can be disabled. Memories can be viewed and edited from the tool configuration UI.

Memories persist across runs and should be used with caution if your automation handles untrusted input. Inputs may lead to misleading or malicious memories that unintentionally impact future automation runs.

## [Automation settings](https://cursor.com/docs/cloud-agent/automations\#automation-settings)

### [Model](https://cursor.com/docs/cloud-agent/automations\#model)

You can select which model the cloud agent uses for your automation.

### [Repositories](https://cursor.com/docs/cloud-agent/automations\#repositories)

Choose whether the automation needs a repository, multiple repositories, or no repository at all.

For certain triggers like Slack or cron schedules, Cursor defaults to not using a repository. If your automation should make code changes, specify which repository or repositories agents should work in.

For GitHub and GitLab triggers, specifying a repo or multiple repos is required.

#### [Single-repo automations](https://cursor.com/docs/cloud-agent/automations\#single-repo-automations)

By default, an automation runs against one repository and branch. This is the right choice when the agent should read, review, or change code in a single codebase.

GitHub and GitLab triggers infer the repository from the pull request. For other triggers, choose the repository and branch in the automation settings.

#### [Multi-repo automations](https://cursor.com/docs/cloud-agent/automations\#multi-repo-automations)

Use a multi-repo environment when an automation needs to work across multiple repositories. Select multiple repos when you configure the environment, or choose an existing one from your [Cloud Agents dashboard](https://cursor.com/dashboard/cloud-agents#environments).

### [Automations with no repo](https://cursor.com/docs/cloud-agent/automations\#automations-with-no-repo)

Automations can run without any attached repos. These automations do not clone code. Use them for workflows that only need Slack, MCP, webhooks, Linear, or PagerDuty.

Tools that require code access, such as **Open pull request**, **Comment on pull request**, and **Request reviewers**, are not available without a repository.

### [Permissions](https://cursor.com/docs/cloud-agent/automations\#permissions)

Control who can view and manage the automation. The permission scope also determines how usage is [billed](https://cursor.com/docs/cloud-agent/automations#billing).

- **Private**: Only you can manage the automation. Team admins can view and disable the automation.
- **Team Visible**: Only you can manage the automation. Team members can view the automation, and team admins can disable the automation. It still runs with your auth.
- **Team Owned**: Team members can view the automation. Only team admins can manage the automation. It runs with the team's shared automations service account.

Promoting an automation from Private or Team Visible to Team Owned changes the identity it runs as. It stops using your auth and starts using the team's shared automations service account. If the automation uses webhook triggers, regenerate its webhook API key after the scope change. If it uses MCPs or other integrations that rely on personal OAuth credentials, make sure those are configured for the team's service account instead. Only team admins can promote an automation to Team Owned.

### [Identity](https://cursor.com/docs/cloud-agent/automations\#identity)

When an automation acts on external services, it uses the following identities:

- GitHub comments, review approvals, and reviewer requests run as `cursor`.
- Team-scoped automations open pull requests as `cursor`.
- Private automations open pull requests as your GitHub account.
- Slack messages are sent as the Cursor bot.

## [Writing prompts](https://cursor.com/docs/cloud-agent/automations\#writing-prompts)

Prompts define what the agent should do. Write them the same way you would write instructions for a cloud agent run.

Tips:

- Be specific about what the agent should check, change, or produce.
- Reference the actions you enabled - you can at-mention tools or informally mention their names.
- Include decision rules for what to do in different cases.
- Set a quality bar for when the agent should open a pull request, comment, or do nothing.
- Describe the output format you want.

## [Related](https://cursor.com/docs/cloud-agent/automations\#related)

- [Agents Window](https://cursor.com/docs/agent/agents-window)
- [Cloud agents overview](https://cursor.com/docs/cloud-agent)
- [Cloud agent setup](https://cursor.com/docs/cloud-agent/setup)
- [Cloud agent pricing](https://cursor.com/docs/models-and-pricing#model-pricing)
- [Skills](https://cursor.com/docs/skills)
- [GitHub integration](https://cursor.com/docs/integrations/github)
- [GitLab integration](https://cursor.com/docs/integrations/gitlab)
- [Slack integration](https://cursor.com/docs/integrations/slack)
- [Microsoft Teams integration](https://cursor.com/docs/integrations/microsoft-teams)
- [Linear integration](https://cursor.com/docs/integrations/linear)

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