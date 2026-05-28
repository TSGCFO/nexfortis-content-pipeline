<!-- Source: https://cursor.com/docs/account/enterprise/billing-groups -->
<!-- Title: Billing Groups | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/account/enterprise/billing-groups#main-content)

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

[Overview](https://cursor.com/docs/enterprise)

Identity & Access

[Privacy & Data Governance](https://cursor.com/docs/enterprise/privacy-and-data-governance)

[Network Configuration](https://cursor.com/docs/enterprise/network-configuration)

[Endpoint Security](https://cursor.com/docs/enterprise/endpoint-security)

[LLM Safety & Controls](https://cursor.com/docs/enterprise/llm-safety-and-controls)

[Models & Integrations](https://cursor.com/docs/enterprise/model-and-integration-management)

[Pooled Usage](https://cursor.com/docs/enterprise/pooled-usage)

[Compliance & Monitoring](https://cursor.com/docs/enterprise/compliance-and-monitoring)

[HIPAA BAA](https://cursor.com/docs/enterprise/baa)

[Deployment Patterns](https://cursor.com/docs/enterprise/deployment-patterns)

[Service Accounts](https://cursor.com/docs/account/enterprise/service-accounts)

[Billing Groups](https://cursor.com/docs/account/enterprise/billing-groups)

[Cursor Blame](https://cursor.com/docs/integrations/cursor-blame)

Teams & Enterprise

# Billing Groups

[Billing groups](https://cursor.com/dashboard/members?subtab=billing-groups) allow Enterprise admins to understand and manage spend across groups of users. This functionality is useful for reporting, internal chargebacks, and budgeting.

## [Billing group architecture](https://cursor.com/docs/account/enterprise/billing-groups\#billing-group-architecture)

Admins can assign each member to a billing group. Members can only be in one billing group at a time. Members not actively assigned in any other billing group are placed in a reserved `Unassigned` group.

All usage is attributed to the user's group at the time it occurs. Historical data does not change when users move between groups, though it can be reassigned only when a group is deleted. In that case, all of its usage is moved to the Unassigned group.

## [View billing groups](https://cursor.com/docs/account/enterprise/billing-groups\#view-billing-groups)

Enterprise admins can view billing groups in the web dashboard under the `Members & Groups` tab. This table shows each group, how it is configured, the number of members in it, and spend for the period.

![](https://cursor.com/docs-static/images/account/enterprise/billing-groups/billing-groups-view.png)

## [Create and add members to a billing group](https://cursor.com/docs/account/enterprise/billing-groups\#create-and-add-members-to-a-billing-group)

Admins can create billing groups by clicking `Create Group`. After naming the group, there are four ways to assign members to that group:

1. **SCIM**: Sync the billing group with an existing [SCIM group](https://cursor.com/docs/account/teams/scim#scim).

2. **API**: Create groups and add members programmatically via the [Admin API](https://cursor.com/docs/account/teams/admin-api#billing-groups).

3. **CSV**: Upload a CSV with group names and email addresses of members.

4. **Manual**: Click `Add Members` and manually select `Unassigned` members to be added.


Billing groups synced with SCIM cannot be edited via CSV, API, or manual UI changes. All member assignment for SCIM-synced groups must be handled via SCIM.

## [Move members between billing groups](https://cursor.com/docs/account/enterprise/billing-groups\#move-members-between-billing-groups)

Admins can move members from manual billing groups by clicking on the billing group and selecting `Move`.

- **SCIM**: When members are moved between SCIM groups in your identity provider, the billing group follows those changes automatically.
- **API**: Use the [add members](https://cursor.com/docs/account/teams/admin-api#add-members-to-group) and [remove members](https://cursor.com/docs/account/teams/admin-api#remove-members-from-group) endpoints to move members programmatically.

## [Rename a billing group](https://cursor.com/docs/account/enterprise/billing-groups\#rename-a-billing-group)

Billing groups can be renamed by clicking the gear button on the main menu, or by clicking `Rename` on the page for that specific billing group.

- **API**: Use the [update group](https://cursor.com/docs/account/teams/admin-api#update-group) endpoint to rename groups programmatically.

## [Delete a billing group](https://cursor.com/docs/account/enterprise/billing-groups\#delete-a-billing-group)

Billing groups can be deleted by clicking the gear button on the main menu, or by clicking `Delete` on the page for that specific billing group.

- **API**: Use the [delete group](https://cursor.com/docs/account/teams/admin-api#delete-group) endpoint to delete groups programmatically.

Deleting a billing group is a destructive operation; data cannot be recovered. All historic usage for deleted groups is assigned retroactively to the `Unassigned` group.

Billing groups are available on the Enterprise plan

Contact our team to learn about spend management and reporting.

[Contact Sales](https://cursor.com/contact-sales?source=docs-billing-groups)

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