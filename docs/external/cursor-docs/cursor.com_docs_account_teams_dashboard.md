<!-- Source: https://cursor.com/docs/account/teams/dashboard -->
<!-- Title: Dashboard | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/account/teams/dashboard#main-content)

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

[Get Started](https://cursor.com/docs/account/teams/setup)

[Pricing](https://cursor.com/docs/account/teams/pricing)

[Members & Roles](https://cursor.com/docs/account/teams/members)

[SSO](https://cursor.com/docs/account/teams/sso)

[Dashboard](https://cursor.com/docs/account/teams/dashboard)

[Analytics](https://cursor.com/docs/account/teams/analytics)

Enterprise

Teams & Enterprise

# Dashboard

The dashboard lets you access billing, set up usage-based pricing, and manage your Team.

## [Overview](https://cursor.com/docs/account/teams/dashboard\#overview)

Get a quick summary of your team's activity, usage statistics, and recent changes. The overview page provides at-a-glance insights into your workspace.

![Team dashboard](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Faccount%2Fteam%2Fdashboard.png&w=1920&q=75&dpl=dpl_7UAjkDundnDt84UyVxZXdo4fDHt5)

## [Settings](https://cursor.com/docs/account/teams/dashboard\#settings)

![Team settings](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Faccount%2Fteam%2Fsettings.png&w=1920&q=75&dpl=dpl_7UAjkDundnDt84UyVxZXdo4fDHt5)

Configure team-wide preferences and security settings. The settings page includes:

## [Teams & Enterprise Settings](https://cursor.com/docs/account/teams/dashboard\#teams-enterprise-settings)

### Privacy Settings

Control data sharing preferences for your team. Configure zero data retention policies with AI providers (OpenAI, Anthropic, Google Vertex AI, xAi Grok) and manage team-wide privacy enforcement.

### Usage-Based Pricing Settings

Enable usage-based pricing and set spending limits. Configure monthly team
spending limits. Control whether only admins can modify these settings.

### Team Marketplaces

Import custom team marketplaces from GitHub in dashboard settings under
Plugins. Teams plans can add up to 1 team marketplace. Enterprise plans can
add unlimited team marketplaces. Learn more in [Team Marketplaces](https://cursor.com/docs/plugins#team-marketplaces).

### Bedrock IAM Role

Configure AWS Bedrock IAM roles for secure cloud integration.

### Single Sign-On (SSO)

Set up SSO authentication for enterprise teams to streamline user access and
improve security.

### Cursor Admin API Keys

Create and manage API keys for programmatic access to Cursor's admin features.

### Active Sessions

Monitor and manage active user sessions across your team.

### Invite Code Management

Create and manage invite codes for adding new team members.

### API Endpoints

Access Cursor's REST API endpoints for programmatic integration. All API endpoints are available on both Team and [Enterprise](https://cursor.com/docs/enterprise) plans, except for the [AI Code Tracking API](https://cursor.com/docs/account/teams/ai-code-tracking-api) which requires Enterprise plan.

## [Enterprise-Only Settings](https://cursor.com/docs/account/teams/dashboard\#enterprise-only-settings)

**Device-level enforcement:** In addition to dashboard settings, enterprises can enforce policies like allowed team IDs and allowed extensions on user devices through MDM. See [Identity and Access Management](https://cursor.com/docs/enterprise/identity-and-access-management#mdm-policies) and [Deployment Patterns](https://cursor.com/docs/enterprise/deployment-patterns#mdm-configuration) for details.

### Model Access Control

Control which AI models are available to team members. Set restrictions on
specific models or model tiers to manage costs and ensure appropriate usage
across your organization. Learn more in [Model and Integration Management](https://cursor.com/docs/enterprise/model-and-integration-management#model-access-control).

### Enhanced Spend Limits

Set individual spending limits for each team member. Configure member-level overrides, group-based limits via directory sync, or default per-member caps.

### Auto Run Configuration

Configure automatic command execution settings. Control which commands can be executed automatically and set security
policies for code execution.

### Repository Blocklist

Prevent access to specific repositories for security or compliance reasons. Learn more in [Model and Integration Management](https://cursor.com/docs/enterprise/model-and-integration-management#repository-blocklist).

### MCP Configuration

Configure Model Context Protocol settings.
Manage how models access and process context from your development
environment. Learn more in [Model and Integration Management](https://cursor.com/docs/enterprise/model-and-integration-management#mcp-server-trust-management).

### Cursor Ignore Configuration

Set up ignore patterns for files and directories. Control which files and directories are excluded from AI analysis and
suggestions. Learn more in [Security Guardrails](https://cursor.com/docs/enterprise/llm-safety-and-controls#cursorignore).

### .cursor Directory Protection

Protect the .cursor directory from unauthorized agent access. Ensure sensitive configuration and cache files remain secure. Learn more in [Security Guardrails](https://cursor.com/docs/enterprise/llm-safety-and-controls#cursor-directory-protection).

### AI Code Tracking API

Access detailed AI-generated code analytics for your team's repositories. Retrieve per-commit AI usage metrics and granular accepted AI changes through REST API endpoints. Requires Enterprise team plan. Learn more in [AI Code Tracking API](https://cursor.com/docs/account/teams/ai-code-tracking-api).

### Audit Log

View comprehensive, tamper-proof records of security events and administrative actions. Track authentication, team changes, permission updates, API key actions, settings modifications, and more. Requires an Enterprise subscription. Learn more in [Compliance and Monitoring](https://cursor.com/docs/enterprise/compliance-and-monitoring#audit-logs).

**SCIM** (System for Cross-domain Identity Management) provisioning is also
available for [Enterprise](https://cursor.com/docs/enterprise) plans. See our [SCIM\\
documentation](https://cursor.com/docs/account/teams/scim) for setup instructions.

## [Members](https://cursor.com/docs/account/teams/dashboard\#members)

Manage your team members, invite new users, and control access permissions. Set role-based permissions and monitor member activity.

![Team members](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Faccount%2Fteam%2Fmembers.png&w=1920&q=75&dpl=dpl_7UAjkDundnDt84UyVxZXdo4fDHt5)

## [Audit Log](https://cursor.com/docs/account/teams/dashboard\#audit-log)

Track security events, administrative actions, and team changes with comprehensive audit logs. View detailed records of who did what, when, and from where. Audit logs capture authentication events, membership changes, permission updates, API key actions, settings modifications, and more.

![Audit Log](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Faccount%2Fteam%2Faudit-log.png&w=1920&q=75&dpl=dpl_7UAjkDundnDt84UyVxZXdo4fDHt5)

**Audit Log** is available exclusively on [Enterprise](https://cursor.com/docs/enterprise) plans and can only be viewed by admins.

## [Integrations](https://cursor.com/docs/account/teams/dashboard\#integrations)

![Integrations](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Faccount%2Fteam%2Fintegrations.png&w=1920&q=75&dpl=dpl_7UAjkDundnDt84UyVxZXdo4fDHt5)

Connect Cursor with your favorite tools and services. Configure integrations with version control systems, project management tools, and other developer services.

## [Cloud Agents](https://cursor.com/docs/account/teams/dashboard\#cloud-agents)

![Cloud agents](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Faccount%2Fteam%2Fintegrations.png&w=1920&q=75&dpl=dpl_7UAjkDundnDt84UyVxZXdo4fDHt5)

Monitor and manage cloud agents running in your workspace. View agent status, logs, and resource usage.

## [Bugbot](https://cursor.com/docs/account/teams/dashboard\#bugbot)

Access automated bug detection and fixing capabilities. Bugbot helps identify and resolve common issues in your codebase automatically.

![Bugbot code review](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Faccount%2Fteam%2Fbugbot.png&w=1920&q=75&dpl=dpl_7UAjkDundnDt84UyVxZXdo4fDHt5)

## [Active Directory Management](https://cursor.com/docs/account/teams/dashboard\#active-directory-management)

For enterprise teams, manage user authentication and access through Active Directory integration. Configure SSO and user provisioning.

## [Usage](https://cursor.com/docs/account/teams/dashboard\#usage)

Track detailed usage metrics including AI requests, model usage, and resource consumption. Monitor usage across team members and projects.

![Usage](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Faccount%2Fteam%2Fusage.png&w=1920&q=75&dpl=dpl_7UAjkDundnDt84UyVxZXdo4fDHt5)

## [Billing & Invoices](https://cursor.com/docs/account/teams/dashboard\#billing-invoices)

Manage your subscription, update payment methods, and access billing history. Download invoices and manage usage-based pricing settings.

![Billing](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Faccount%2Fteam%2Fbilling.png&w=1920&q=75&dpl=dpl_7UAjkDundnDt84UyVxZXdo4fDHt5)

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