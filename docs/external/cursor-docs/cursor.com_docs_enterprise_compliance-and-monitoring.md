<!-- Source: https://cursor.com/docs/enterprise/compliance-and-monitoring -->
<!-- Title: Compliance and Monitoring | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/enterprise/compliance-and-monitoring#main-content)

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

# Compliance and Monitoring

Compliance requires visibility into who did what, when, and why. This documentation covers audit logs, AI code tracking, certifications, and how to meet regulatory requirements.

## [Audit logs](https://cursor.com/docs/enterprise/compliance-and-monitoring\#audit-logs)

Audit logs provide a record of security events and administrative actions. Available on the [Enterprise plan](https://cursor.com/contact-sales?source=docs-audit-logs), audit logs help you meet compliance requirements and investigate security incidents.

We log the following events:

- **Authentication events:** Logins and logouts
- **User management:** User additions (via SSO, invite, signup, team creation, or auto-enrollment), removals, role changes, and individual spend limits
- **API key management:** Team and user API key creation and revocation
- **Team settings:** Team-wide and per-user spending limits, admin settings, team name changes, Slack integration settings, and repository mappings
- **Repository management:** Repository creation, deletion, and settings updates
- **Cloud Agent environments:** Environment creation, updates, restores, and lifecycle changes
- **Directory groups:** Directory group creation, updates, deletion, membership changes, and permission modifications
- **Privacy settings:** Privacy Mode changes at user or team level
- **Team rules:** Team rule management (including Bugbot rules) for custom workflows
- **Team commands:** Custom command creation, updates, and deletion

We do not log agent responses or generated code content.

Instead, we recommend using [hooks](https://cursor.com/docs/hooks) to log prompts and code.

### [Accessing audit logs](https://cursor.com/docs/enterprise/compliance-and-monitoring\#accessing-audit-logs)

View audit logs in the [team dashboard](https://cursor.com/dashboard/audit-log). This is available on Enterprise plans, and requires admin access.

### [Streaming audit logs](https://cursor.com/docs/enterprise/compliance-and-monitoring\#streaming-audit-logs)

For compliance and security monitoring, stream audit logs to your existing systems:

- SIEM systems (Splunk, Sumo Logic, Datadog, etc.)
- Webhook endpoints for custom processing
- S3 buckets for long-term retention
- Log aggregators like Elasticsearch or CloudWatch

Please contact [hi@cursor.com](mailto:hi@cursor.com) if you would like to receive streaming audit logs.

### [Log format](https://cursor.com/docs/enterprise/compliance-and-monitoring\#log-format)

Audit logs are delivered as JSON and include metadata and event-specific fields:

```
{
  "metadata": {
    "timestamp": "2024-10-14T18:30:45Z",
    "event_id": "evt_abc123xyz789"
  },
  "team_id": "team_xyz789",
  "ip_address": "203.0.113.42",
  "user_email": "alice@company.com",
  "event": { /* event-specific fields */ }
}
```

The event types include:

- `login` \- User login events (web or app)
- `logout` \- User logout events
- `add_user` \- User additions (with source: `sso`, `invite`, `signup`, `createTeam`, or `autoEnroll`)
- `remove_user` \- User removals from team
- `update_user_role` \- Role changes (OWNER, ADMIN, MEMBER)
- `user_spend_limit` \- Individual user spending limit changes
- `team_api_key` \- Team API key actions (create, revoke)
- `user_api_key` \- User API key actions (create, revoke)
- `team_settings` \- Team setting modifications, including:
- `team_hard_limit_dollars` \- Team-wide spending hard limit
- `team_hard_limit_per_user_dollars` \- Per-user hard limit
- `per_user_monthly_limit_dollars` \- Monthly spending limits per user
- `admin_only_usage_pricing` \- Admin-only usage pricing settings
- `team_admin_settings` \- General admin settings
- `team_name` \- Team name changes
- `slack_default_repo` \- Slack integration repository settings
- `slack_default_branch` \- Slack integration branch settings
- `slack_default_model` \- Slack integration model settings
- `slack_share_summary` \- Slack summary sharing settings
- `slack_share_summary_in_external_channel` \- External channel sharing
- `slack_channel_repo_mappings` \- Slack channel to repository mappings
- `team_repo` \- Repository actions (create, delete, update\_settings)
- `create_directory_group` \- Directory group creation
- `update_directory_group` \- Directory group updates
- `update_directory_group_permissions` \- Directory group permission changes
- `delete_directory_group` \- Directory group deletion
- `add_user_to_directory_group` \- Adding users to directory groups
- `remove_user_from_directory_group` \- Removing users from directory groups
- `privacy_mode` \- Privacy Mode changes (scope: "user" or "team")
- `team_rule` \- Team rule management (create, update, delete)
- `bugbot_team_rule` \- Bugbot-specific rule management (create, update, delete)
- `team_command` \- Custom team command management (create, update, delete)

### [Searching and filtering](https://cursor.com/docs/enterprise/compliance-and-monitoring\#searching-and-filtering)

Filter audit logs in the dashboard by:

- Date range
- Event type (authentication, user management, settings)
- Actor (specific user)

Export filtered results to CSV for analysis or compliance reports.

## [Using hooks for compliance logging](https://cursor.com/docs/enterprise/compliance-and-monitoring\#using-hooks-for-compliance-logging)

Audit logs track administrative actions, but some compliance requirements need logging of development activity. Use hooks to log:

### [Prompts submitted hook](https://cursor.com/docs/enterprise/compliance-and-monitoring\#prompts-submitted-hook)

```
#!/bin/bash
input=$(cat)
prompt=$(echo "$input" | jq -r '.prompt')
user_id=$(echo "$input" | jq -r '.user_id')

# Log to your compliance system
curl -X POST "https://compliance.company.com/log" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"prompt\",\"user\":\"$user_id\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"

cat << EOF
{
  "continue": true
}
EOF
```

### [Code generated hook](https://cursor.com/docs/enterprise/compliance-and-monitoring\#code-generated-hook)

```
#!/bin/bash
input=$(cat)
file_path=$(echo "$input" | jq -r '.file_path')
edits=$(echo "$input" | jq -r '.edits')

# Log the code generation event (not the actual code)
curl -X POST "https://compliance.company.com/log" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"generation\",\"file\":\"$file_path\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"

exit 0
```

**Important:** Be careful logging actual code or prompts. They may contain sensitive information. Log metadata (who, when, what file) rather than content when possible.

See [Hooks](https://cursor.com/docs/hooks) for hook implementation details.

## [Certifications and compliance](https://cursor.com/docs/enterprise/compliance-and-monitoring\#certifications-and-compliance)

Cursor maintains compliance with industry standards, including SOC 2 Type II, GDPR, and more.

Access compliance documentation through the [Trust Center](https://trust.cursor.com/) including:

- SOC 2 reports
- Penetration test summaries
- Security architecture documentation
- Data flow diagrams

## [Responsible disclosure](https://cursor.com/docs/enterprise/compliance-and-monitoring\#responsible-disclosure)

If you discover a security vulnerability in Cursor, report it through our responsible disclosure program:

Email [security-reports@cursor.com](mailto:security-reports@cursor.com) with the following information:

1. A detailed description of the vulnerability
2. Steps to reproduce the issue
3. Any relevant screenshots or proof of concept

Audit logs are available on the Enterprise plan

Contact our team to learn more about compliance features.

[Contact Sales](https://cursor.com/contact-sales?source=docs-audit-logs)

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