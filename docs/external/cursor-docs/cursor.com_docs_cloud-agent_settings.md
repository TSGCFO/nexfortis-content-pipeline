<!-- Source: https://cursor.com/docs/cloud-agent/settings -->
<!-- Title: Dashboard settings | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/cloud-agent/settings#main-content)

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

# Cloud Agents settings

Workspace admins can configure Cloud Agents from the [Cloud Agents dashboard](https://cursor.com/dashboard/cloud-agents).

## [Environment management](https://cursor.com/docs/cloud-agent/settings\#environment-management)

The **Environments** view lists the saved environments available to your team. Environments can be scoped to one repo or to a group of repos.

Open an environment to review:

- The repositories it applies to
- Whether it uses a snapshot or `.cursor/environment.json`
- The update script that runs before an agent starts
- Runtime secrets and build secrets
- Network access settings
- Version history and setup runs

Use **Update with Agent** when you want Cursor to inspect the current environment and propose a new setup. Use **New Setup Run** when you want Cursor to start setting up the environment fresh. Use **Restore** from version history to make a prior environment version active again.

## [Default settings](https://cursor.com/docs/cloud-agent/settings\#default-settings)

- **Default model** – the model used when a run does not specify one. Pick any model that supports Max Mode.
- **Default repository** – when empty, agents ask the user to choose a repo. Supplying a repo here lets users skip that step.
- **Base branch** – the branch agents fork from when creating pull requests. Leave blank to use the repository’s default branch.

## [Network access settings](https://cursor.com/docs/cloud-agent/settings\#network-access-settings)

Control which network resources Cloud Agents can reach. User and team settings support three modes:

- **Allow all network access** – no domain restrictions.
- **Default + allowlist** – the [default domains](https://cursor.com/docs/agent/tools/terminal#default-network-allowlist) plus any domains you add.
- **Allowlist only** – only domains you explicitly add.

Users, team admins, and environment owners can configure network access. Environment-level settings can inherit user or team policy, add an environment allowlist, or define their own access mode. See [Network Access](https://cursor.com/docs/cloud-agent/security-network) for full details.

## [Security settings](https://cursor.com/docs/cloud-agent/settings\#security-settings)

All security options require admin privileges.

- **Display agent summary** – controls whether Cursor shows the agent's file-diff images and code snippets. Disable this if you prefer not to expose file paths or code in the sidebar.
- **Display agent summary in external channels** – extends the previous toggle to Slack or any external channel you've connected.
- **Team follow-ups** – controls whether team members can send follow-up messages to cloud agents created by other users on the team. See [team follow-ups](https://cursor.com/docs/cloud-agent/settings#team-follow-ups) below.

## [Team feature settings](https://cursor.com/docs/cloud-agent/settings\#team-feature-settings)

Team admins can enable or disable these features for their team:

- **Long running agents** – controls whether team members can run agents for extended durations. Admins can enable or restrict this capability at the team level.
- **Computer use** – controls whether agents can use computer interaction capabilities (available to enterprise teams only).

Changes save instantly and affect new agents immediately.

### [Team follow-ups](https://cursor.com/docs/cloud-agent/settings\#team-follow-ups)

Team members can send follow-up messages to cloud agents created by other users on the same team. This is useful when a teammate starts an agent and you need to course-correct, add context, or continue the work while they're unavailable.

Team admins control this behavior from the [Cloud Agents security settings](https://cursor.com/dashboard/cloud-agents) with three options:

| Setting | Behavior |
| --- | --- |
| **Disabled** | Only the original creator can send follow-ups to their agent. No team follow-ups are allowed. |
| **Service accounts only** | Team members can send follow-ups to agents created by a [service account](https://cursor.com/docs/account/enterprise/service-accounts), but not to agents created by other human users. |
| **All** | Any team member can send follow-ups to any agent on the team, regardless of who created it. |

Lateral movement and secret exposure

Enabling team follow-ups means a user can influence the execution of a cloud agent that runs with _another user's_ secrets and credentials. A follow-up message can instruct the agent to read environment variables, print secrets to logs, push credentials to an external endpoint, or perform actions using the original creator's access tokens.

A team member with limited permissions could escalate their access by directing an agent that holds a more privileged user's secrets. Treat this setting with the same care you would give shared SSH keys or service credentials.

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