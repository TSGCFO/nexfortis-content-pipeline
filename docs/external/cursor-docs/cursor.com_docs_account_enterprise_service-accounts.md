<!-- Source: https://cursor.com/docs/account/enterprise/service-accounts -->
<!-- Title: Service Accounts | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/account/enterprise/service-accounts#main-content)

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

# Service Accounts

Service accounts are available on the [Enterprise plan](https://cursor.com/docs/enterprise).

Service accounts are non-human accounts that enable teams to securely automate Cursor-powered workflows at scale. With service accounts, you can consume APIs, authenticate the [CLI](https://cursor.com/docs/cli/overview), and invoke [cloud agents](https://cursor.com/docs/cloud-agent) without tying integrations to individual developers' personal accounts.

## [Why use service accounts](https://cursor.com/docs/account/enterprise/service-accounts\#why-use-service-accounts)

As teams find new ways to automate coding tasks with Cursor cloud agents, APIs, and CLI, the need for centralized, secure automation becomes critical. Service accounts address this by:

- **Decoupling from individuals**: Automations continue running even as people and roles change
- **Secure credential management**: Easily rotate API keys without disrupting workflows
- **Centralized access control**: Admins manage all service account permissions in one place
- **Attribution and auditability**: Tie cloud agent runs to the initiating service or system

## [Key features](https://cursor.com/docs/account/enterprise/service-accounts\#key-features)

### [No additional seat required](https://cursor.com/docs/account/enterprise/service-accounts\#no-additional-seat-required)

Service accounts are included with your Enterprise plan at no extra cost. They do not consume a seat license.

### [Usage consumption](https://cursor.com/docs/account/enterprise/service-accounts\#usage-consumption)

Service accounts consume usage from your team's usage pool, just like human users. All usage is tracked and visible in your team's analytics and billing.

### [Cloud agent integration](https://cursor.com/docs/account/enterprise/service-accounts\#cloud-agent-integration)

Service accounts can initiate [cloud agent](https://cursor.com/docs/cloud-agent) runs programmatically. This enables automation scenarios such as:

- A ticket created in Linear triggering a cloud agent to implement a feature
- An error in Sentry initiating a cloud agent to investigate and fix the issue
- Internal engineering services kicking off migrations or refactoring tasks

### [Admin visibility](https://cursor.com/docs/account/enterprise/service-accounts\#admin-visibility)

Cloud agent runs initiated by service accounts are accessible to all team admins. This ensures visibility and oversight of automated workflows across your organization.

### [Repository access](https://cursor.com/docs/account/enterprise/service-accounts\#repository-access)

Service accounts can initiate cloud agent runs on any repository that has been authorized via the [Cursor GitHub app](https://cursor.com/docs/integrations/github).

The GitHub integration must be connected at the team level for service accounts to access repositories. If you have a personal GitHub integration but no team-level integration, service accounts will not be able to initiate cloud agent runs.

To connect GitHub at the team level:

1. Navigate to **Dashboard** → **Settings** → **Integrations**
2. Connect the Cursor GitHub app to your organization
3. Authorize the repositories you want service accounts to access

Repository access is governed by the permissions configured for your team's GitHub app installation.

## [Creating a service account](https://cursor.com/docs/account/enterprise/service-accounts\#creating-a-service-account)

Admins can create and manage service accounts from the [Cursor Dashboard](https://cursor.com/dashboard).

1. Navigate to **Dashboard** → **Settings** → **Service Accounts**
2. Click **New Service Account**
3. Enter a name and optional description for the service account
4. Click **Create**

When you create a service account, an API key is generated. Copy this key immediately—it will only be shown once and cannot be retrieved later.

Store your API key securely. If you lose it, you'll need to rotate it to generate a new one.

## [Managing API keys](https://cursor.com/docs/account/enterprise/service-accounts\#managing-api-keys)

Each service account can have API keys associated with it. You can:

- **View masked keys**: See the last few characters of each key for identification
- **Rotate keys**: Generate a new key and invalidate the old one
- **Archive service accounts**: Archive a service account and revoke all its API keys

### [Rotating an API key](https://cursor.com/docs/account/enterprise/service-accounts\#rotating-an-api-key)

To rotate an API key:

1. Navigate to **Dashboard** → **Settings** → **Service Accounts**
2. Find the service account and click the rotate icon next to its API key
3. Copy the new key immediately

The old key is immediately invalidated. Update any integrations using the old key.

## [Using service accounts with the API](https://cursor.com/docs/account/enterprise/service-accounts\#using-service-accounts-with-the-api)

Service accounts authenticate using their API key. Use the key in the `Authorization` header when making requests to the [Cloud Agents API](https://cursor.com/docs/cloud-agent/api/endpoints):

```
curl -X POST https://api.cursor.com/agents \
  -H "Authorization: Bearer YOUR_SERVICE_ACCOUNT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "owner/repo",
    "prompt": "Implement the feature described in issue #123"
  }'
```

See the [Cloud Agents API documentation](https://cursor.com/docs/cloud-agent/api/endpoints) for the full API reference.

## [Using service accounts with the CLI](https://cursor.com/docs/account/enterprise/service-accounts\#using-service-accounts-with-the-cli)

Service accounts can authenticate the [Cursor CLI](https://cursor.com/docs/cli/overview) by setting the API key as `CURSOR_API_KEY`. This is the recommended way to run the CLI in CI/CD pipelines, cron jobs, and other non-interactive environments where browser login isn't possible.

```
export CURSOR_API_KEY=your_service_account_api_key

# Run a task in a CI pipeline
agent -p --force "Refactor the authentication module to use OAuth 2.0"
```

The same environment variable works in any context, including local development. See the [CLI authentication docs](https://cursor.com/docs/cli/reference/authentication) for all authentication options and the [headless CLI guide](https://cursor.com/docs/cli/headless) for scripting patterns.

## [Security best practices](https://cursor.com/docs/account/enterprise/service-accounts\#security-best-practices)

- **Rotate keys regularly**: Establish a key rotation schedule for your service accounts
- **Use descriptive names**: Name service accounts after their purpose (e.g., "Linear Integration", "Sentry Auto-Fix")
- **Limit scope**: Create separate service accounts for different automation workflows
- **Monitor usage**: Review service account activity in your team's analytics dashboard
- **Revoke unused accounts**: Archive service accounts that are no longer in use

## [Archiving a service account](https://cursor.com/docs/account/enterprise/service-accounts\#archiving-a-service-account)

Archiving a service account:

- Revokes all API keys associated with the account
- Breaks any integrations using those keys
- Preserves the account record for auditability

To archive a service account:

1. Navigate to **Dashboard** → **Settings** → **Service Accounts**
2. Click the archive icon next to the service account
3. Confirm the archive action

Archived accounts can be viewed by clicking **Show Archived** on the Service Accounts page. This helps maintain a complete audit trail of service accounts used by your team.

Service accounts are available on the Enterprise plan

Automate Cursor-powered workflows at scale with non-human accounts for APIs and cloud agents.

[Contact Sales](https://cursor.com/contact-sales?source=docs-service-accounts)

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