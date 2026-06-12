<!-- Source: https://cursor.com/docs/enterprise/identity-and-access-management -->
<!-- Title: Identity and Access Management | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/enterprise/identity-and-access-management#main-content)

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

# Identity and Access Management

Identity and access management controls who can use Cursor in your organization and what they can do. You'll set up authentication, automate user provisioning, and enforce policies through device management.

We recommend implementing identity controls in this order:

1. **Set up SSO**: Get centralized authentication working first
2. **Enable SCIM**: Automate user lifecycle management
3. **Deploy MDM policies**: Enforce allowed team IDs and extensions
4. **Assign roles**: Grant admin access to the right people

## [Single Sign-On (SSO) and SAML](https://cursor.com/docs/enterprise/identity-and-access-management\#single-sign-on-sso-and-saml)

SSO lets your users authenticate to Cursor using your existing identity provider. Instead of creating separate Cursor passwords, users log in with their corporate credentials.

Cursor supports SAML 2.0 integration with providers like Okta, Azure AD, Google Workspace, and OneLogin. When you enable SSO, you can require it for all team members, preventing password-based authentication entirely.

See [SSO and SAML setup](https://cursor.com/docs/account/teams/sso) for detailed configuration instructions.

## [SCIM provisioning](https://cursor.com/docs/enterprise/identity-and-access-management\#scim-provisioning)

SCIM 2.0 provisioning automatically manages your team members and directory groups through your identity provider. Available on Enterprise plans with SSO enabled.

Without SCIM, you need to manually add users to your Cursor team and remove them when they leave. With SCIM:

- New employees get Cursor access automatically when added to the right group
- Departing employees lose access when removed from your IDP
- Group membership changes propagate automatically

See [SCIM provisioning](https://cursor.com/docs/account/teams/scim) for setup instructions.

## [Role-Based Access Control (RBAC)](https://cursor.com/docs/enterprise/identity-and-access-management\#role-based-access-control-rbac)

Cursor teams have three roles: Members, Admins, and Unpaid Admins.

See [Members & Roles](https://cursor.com/docs/account/teams/members) for more information.

## [MDM policies](https://cursor.com/docs/enterprise/identity-and-access-management\#mdm-policies)

Mobile Device Management (MDM) systems let you enforce policies on user devices. Cursor supports MDM-based policies on macOS and Intune / Group Policy on Windows to ensure users comply with organizational requirements.

See [Deployment Patterns](https://cursor.com/docs/enterprise/deployment-patterns#mdm-configuration) for platform-specific MDM configuration instructions.

### [Allowed Team IDs](https://cursor.com/docs/enterprise/identity-and-access-management\#allowed-team-ids)

The most important MDM policy prevents users from logging into personal Cursor accounts on corporate devices.

When you set an allowed team ID policy, Cursor only permits authentication to those specific team IDs. If a user tries to log in with a different team ID (like a personal account), Cursor logs them out immediately.

For example, if your employees have corporate laptops, you can set the allowed team ID to your enterprise team ID. This prevents them from accidentally using personal accounts that might not have Privacy Mode enabled.

The `cursorAuth.allowedTeamId` Cursor setting controls which team IDs are permitted to log into Cursor. This setting accepts a comma-separated list of team IDs that are authorized for access.

For example, setting `cursorAuth.allowedTeamId` to `"1,3,7"` allows users from those specific team IDs to log in.

When a user attempts to log in with a team ID that is not in the allowed list:

- They are forcefully logged out immediately
- An error message is displayed
- The application prevents further authentication attempts until a valid team ID is used

To centrally manage allowed team IDs for your organization, configure the `AllowedTeamId` policy using your device management solution. This policy overrides the `cursorAuth.allowedTeamId` setting on users' devices. The value of this policy is a string containing the comma-separated list of authorized team IDs.

See [Deployment Patterns](https://cursor.com/docs/enterprise/deployment-patterns#mdm-configuration) for platform-specific MDM configuration instructions.

### [Allowed Extensions](https://cursor.com/docs/enterprise/identity-and-access-management\#allowed-extensions)

Control which extensions users can install in Cursor. Extensions can access your workspace, so you want to ensure only trusted extensions run.

**How it works:**

The `extensions.allowed` Cursor setting controls which extensions can be installed. This setting accepts a JSON object where keys are publisher names or full extension IDs, and values are booleans indicating whether they are allowed.

> **Important:**`extensions.allowed` uses an allowlist model. As soon as you add any entries, only explicitly allowed entries are permitted, and everything else is blocked. There is no implicit "allow all" fallback. For example, setting `extensions.allowed` to `{"anysphere": false}` does not only block Anysphere extensions; it blocks every other publisher too, because nothing else is on the allowlist.

To block specific extensions while keeping everything else allowed, use the `"*": true` wildcard alongside the entries you want to deny. The wildcard is the least specific match, so publisher and extension ID entries override it:

```
{
  "*": true,
  "untrusted-publisher": false
}
```

To restrict installs to an approved set of publishers and extensions, omit the wildcard and list only what you trust. You can include full extension IDs, pin to specific versions, or pin to a release channel:

```
{
  "anysphere": true,
  "github": true,
  "esbenp.prettier-vscode": true,
  "ms-azuretools.vscode-containers": false,
  "dbaeumer.vscode-eslint": ["3.0.0"],
  "github.vscode-pull-request-github": "stable"
}
```

**Admin Portal Configuration:**

Team admins can configure allowed extensions through the [team dashboard](https://cursor.com/docs/account/teams/dashboard) in the Security & Identity section. The configuration is applied automatically to all team members' Cursor clients. Leave the field empty to stop pushing a value to clients.

> **Resetting clients to "allow all":** Clearing the admin portal field stops pushing a new value, but it does not remove the policy that clients already applied locally. Users keep enforcing the last value they received. To reset everyone back to allowing all extensions, deploy `{"*": true}` first, wait for clients to pick it up, and then clear the field if you no longer want to manage the setting centrally.

> **Note:** Admin portal configuration for this feature requires Cursor client version 2.1 or later. Users on older versions will not have extension restrictions applied.

**MDM Configuration:**

To centrally manage allowed extensions using device management, configure the `AllowedExtensions` policy. This policy overrides both the admin portal setting and user-configured `extensions.allowed` settings. The value of this policy is a JSON string that defines the allowed extensions.

To centrally manage allowed extensions for your organization, configure the `AllowedExtensions` policy using your device management solution. This policy overrides the `extensions.allowed` setting on users' devices. The value of this policy is a JSON string that defines the allowed publishers.

See [Deployment Patterns](https://cursor.com/docs/enterprise/deployment-patterns#mdm-configuration) for platform-specific MDM configuration instructions.

### [The .cursor folder](https://cursor.com/docs/enterprise/identity-and-access-management\#the-cursor-folder)

When you open a project in Cursor, the editor creates a `.cursor` folder at the root of your repository. This folder contains:

- Project-specific settings
- Indexing cache
- Project rules and context

This folder can be checked into source control. Your team members benefit from shared rules and settings, but be aware that these configurations are visible to anyone with repository access.

For repositories you don't control access to, review the `.cursor` folder contents before committing. Don't put sensitive information in rules files.

You can also manage rules and commands through the server on the [team dashboard](https://cursor.com/docs/account/teams/dashboard).

### [Workspace Trust](https://cursor.com/docs/enterprise/identity-and-access-management\#workspace-trust)

The `security.workspace.trust.enabled` Cursor setting controls whether the Workspace Trust feature is enabled. This setting accepts a boolean value that determines if users will be prompted to trust workspaces before full functionality is enabled.

For example, setting `security.workspace.trust.enabled` to `true` enables workspace trust prompts, while setting it to `false` disables the feature entirely (all workspaces are automatically trusted).

When workspace trust is enabled:

- Users are prompted to trust each new workspace when opening it for the first time
- Untrusted workspaces run in a restricted mode with limited functionality
- Trust decisions are saved and remembered for each workspace

To centrally manage workspace trust for your organization, configure the `WorkspaceTrustEnabled` policy using your device management solution. This policy overrides the `security.workspace.trust.enabled` setting on users' devices. The value of this policy is a boolean (`true` or `false`).

See [Deployment Patterns](https://cursor.com/docs/enterprise/deployment-patterns#mdm-configuration) for platform-specific MDM configuration instructions.

Advanced identity controls are available on Enterprise

Contact our team to learn about SCIM, MDM policies, and more.

[Contact Sales](https://cursor.com/contact-sales?source=docs-identity-access)

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