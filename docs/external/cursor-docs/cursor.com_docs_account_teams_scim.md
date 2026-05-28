<!-- Source: https://cursor.com/docs/account/teams/scim -->
<!-- Title: SCIM | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/account/teams/scim#main-content)

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

[Overview](https://cursor.com/docs/enterprise/identity-and-access-management)

[SCIM](https://cursor.com/docs/account/teams/scim)

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

# SCIM

## [Overview](https://cursor.com/docs/account/teams/scim\#overview)

SCIM 2.0 provisioning automatically manages your team members and directory groups through your identity provider. Available on Enterprise plans with SSO enabled, [contact sales](https://cursor.com/contact-sales?source=docs-scim) to get access.

## [Prerequisites](https://cursor.com/docs/account/teams/scim\#prerequisites)

- Cursor Enterprise plan
- SSO must be configured first - **SCIM requires an active SSO connection**
- Admin access to your identity provider (Okta, Azure AD, etc.)
- Admin access to your Cursor organization

## [How it works](https://cursor.com/docs/account/teams/scim\#how-it-works)

### [User provisioning](https://cursor.com/docs/account/teams/scim\#user-provisioning)

Users are automatically added to Cursor when assigned to the SCIM application in your identity provider. When unassigned, they're removed. Changes sync in real-time.

### [Directory groups](https://cursor.com/docs/account/teams/scim\#directory-groups)

Directory groups and their membership sync from your identity provider. Group and user management must be done through your identity provider - Cursor displays this information as read-only.

### [Spend management](https://cursor.com/docs/account/teams/scim\#spend-management)

Set different per-user spend limits for each directory group. Directory group limits take precedence over team-level limits. Users in multiple groups receive the highest applicable spend limit.

## [Setup](https://cursor.com/docs/account/teams/scim\#setup)

1

### Ensure SSO is configured

SCIM requires SSO to be set up first. If you haven't configured SSO yet,
follow the [SSO setup guide](https://cursor.com/docs/account/teams/sso) before proceeding.

2

### Access Active Directory Management

Navigate to
[cursor.com/dashboard/members?subtab=active-directory](https://www.cursor.com/dashboard/members?subtab=active-directory)
with an admin account, or go to your dashboard settings and select the "Members
& Groups" tab followed by the "Directory Groups" subtab.

3

### Start SCIM setup

Once SSO is verified, you'll see a link for step-by-step SCIM setup. Click
this to begin the configuration wizard.

4

### Configure SCIM in your identity provider

In your identity provider: - Create or configure your SCIM application - Use
the SCIM endpoint and token provided by Cursor - Enable user and push group
provisioning - Test the connection

5

### Configure spend limits (optional)

Back in Cursor's Active Directory Management page: - View your synchronized
directory groups - Set per-user spend limits for specific groups as needed -
Review which limits apply to users in multiple groups

### [Identity provider setup](https://cursor.com/docs/account/teams/scim\#identity-provider-setup)

For provider-specific setup instructions:

[Identity Provider Guides\\
\\
Setup instructions for Okta, Azure AD, Google Workspace, and more.](https://workos.com/docs/integrations)

## [Managing users and groups](https://cursor.com/docs/account/teams/scim\#managing-users-and-groups)

All user and group management must be done through your identity provider.
Changes made in your identity provider will automatically sync to Cursor, but
you cannot modify users or groups directly in Cursor.

### [User management](https://cursor.com/docs/account/teams/scim\#user-management)

- Add users by assigning them to your SCIM application in your identity provider
- Remove users by unassigning them from the SCIM application
- User profile changes (name, email) sync automatically from your identity provider

### [Group management](https://cursor.com/docs/account/teams/scim\#group-management)

- Directory groups are automatically synced from your identity provider
- Group membership changes are reflected in real-time
- Use groups to organize users and set different spend limits

### [Spend limits](https://cursor.com/docs/account/teams/scim\#spend-limits)

- Set different per-user limits for each directory group
- Users inherit the highest spend limit from their groups
- Group limits override the default team-wide per-user limit

## [FAQ](https://cursor.com/docs/account/teams/scim\#faq)

### [Why isn't SCIM management showing up in my dashboard?](https://cursor.com/docs/account/teams/scim\#why-isnt-scim-management-showing-up-in-my-dashboard)

Ensure SSO is properly configured and working before setting up SCIM. SCIM requires an active SSO connection to function.

### [Why aren't users syncing?](https://cursor.com/docs/account/teams/scim\#why-arent-users-syncing)

Verify that users are assigned to the SCIM application in your identity provider. Users must be explicitly assigned to appear in Cursor.

### [Why aren't groups appearing?](https://cursor.com/docs/account/teams/scim\#why-arent-groups-appearing)

Check that push group provisioning is enabled in your identity provider's SCIM settings. Group sync must be configured separately from user sync.

### [Why aren't spend limits applying?](https://cursor.com/docs/account/teams/scim\#why-arent-spend-limits-applying)

Confirm users are properly assigned to the expected groups in your identity provider. Group membership determines which spend limits apply.

### [Can I manage SCIM users and groups directly in Cursor?](https://cursor.com/docs/account/teams/scim\#can-i-manage-scim-users-and-groups-directly-in-cursor)

No. All user and group management must be done through your identity provider. Cursor displays this information as read-only.

### [How quickly do changes sync?](https://cursor.com/docs/account/teams/scim\#how-quickly-do-changes-sync)

Changes made in your identity provider sync to Cursor in real-time. There may be a brief delay for large bulk operations.

### [Can I sync user roles from my IdP?](https://cursor.com/docs/account/teams/scim\#can-i-sync-user-roles-from-my-idp)

No. Currently, the SCIM integration doesn't support role mapping and all users are provisioned as Members. Any role updates need to be done in the Cursor dashboard.

### [Why are there users on my Members dashboard that aren't in the provisioned IdP groups?](https://cursor.com/docs/account/teams/scim\#why-are-there-users-on-my-members-dashboard-that-arent-in-the-provisioned-idp-groups)

When SCIM is set up, existing users are not automatically removed from Cursor. You can either remove them manually, or sync them with SCIM once and deprovision them from your IdP to have them removed from Cursor.

### [Why don't the users from my synced groups match the users on the Cursor Members dashboard?](https://cursor.com/docs/account/teams/scim\#why-dont-the-users-from-my-synced-groups-match-the-users-on-the-cursor-members-dashboard)

Once a user account is provisioned, they won't appear on the Cursor Members Dashboard until they sign in for the first time.

SCIM is available on the Enterprise plan

Contact our team to request access.

[Contact Sales](https://cursor.com/contact-sales?source=docs-scim)

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