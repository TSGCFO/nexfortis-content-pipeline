<!-- Source: https://cursor.com/docs/integrations/github -->
<!-- Title: GitHub | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/integrations/github#main-content)

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

# GitHub

The Cursor GitHub app connects your repositories so you can use features like [Cloud Agents](https://cursor.com/docs/cloud-agent) and [Bugbot](https://cursor.com/docs/bugbot).

## [Setup](https://cursor.com/docs/integrations/github\#setup)

GitHub.comGitHub Enterprise Server

Requires Cursor admin access and GitHub org admin access.

1. Go to [Integrations in the dashboard](https://cursor.com/dashboard/integrations)
2. Click **Connect** next to GitHub (or **Manage Connections** if already connected)
3. Choose **All repositories** or **Selected repositories**
4. Return to the dashboard to configure features on your repositories

To disconnect your GitHub account, return to the integrations dashboard and click **Disconnect Account**.

## [IP allow list configuration](https://cursor.com/docs/integrations/github\#ip-allow-list-configuration)

If your organization uses GitHub's IP allow list feature to restrict access to your repositories, Cursor can be configured to use a hosted egress proxy with a narrow set of IPs.

Before configuring IP allowlists, contact [hi@cursor.com](mailto:hi@cursor.com) to enable this feature for your team. This is required for either configuration method below.

### [Enable IP allow list configuration for installed GitHub Apps (recommended)](https://cursor.com/docs/integrations/github\#enable-ip-allow-list-configuration-for-installed-github-apps-recommended)

The Cursor GitHub app has the IP list already pre-configured. You can enable the allowlist for installed apps to automatically inherit this list. This is the **recommended approach**, as it allows us to update the list and your organization receives updates automatically.

To enable this:

1. Go to your organization's Security settings
2. Navigate to IP allow list settings
3. Check **"Allow access by GitHub Apps"**

For detailed instructions, see [GitHub's documentation](https://docs.github.com/en/enterprise-cloud@latest/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/managing-allowed-ip-addresses-for-your-organization#allowing-access-by-github-apps).

### [Add IPs directly to your allowlist](https://cursor.com/docs/integrations/github\#add-ips-directly-to-your-allowlist)

If your organization uses IdP-defined allowlists in GitHub or otherwise cannot use the pre-configured allowlist, add the proxy IPs listed in [Git egress proxy and IP allow list](https://cursor.com/docs/cloud-agent/security-network#git-egress-proxy-and-ip-allow-list).

## [Advanced networking](https://cursor.com/docs/integrations/github\#advanced-networking)

Self-hosted instances support multiple connection methods beyond IP whitelisting.

### PrivateLink (AWS) or Private Service Connect (GCP)

Available for Enterprise customers. Allow Cursor to access your instance over a private network connection. [Contact your Cursor representative](https://cursor.com/contact-sales?source=docs-bugbot-private-network) for setup.

**Best for:** Instances behind a firewall on a private network in AWS, Azure, or GCP

**Security:** HTTPS encryption with optional mTLS, PrivateLink/Service Connect, VPC allowlisting, service account access tokens

**Drawbacks:** Only supports public clouds with private networking connections between VPCs

### Reverse Proxy Tunnel

Available for Enterprise customers. Run a reverse proxy tunnel on-premises that establishes a long-lived websocket connection to Cursor's servers. Network requests are forwarded through to your instance. Requires no inbound network access. [Contact your Cursor representative](https://cursor.com/contact-sales?source=docs-bugbot-on-prem-proxy) for setup.

**Best for:** Environments without inbound network access

**Security:** HTTPS encryption, service account access tokens

**Drawbacks:** Introduces additional complexity, maintenance requirements, and potential security considerations compared to more direct connection methods

## [Permissions](https://cursor.com/docs/integrations/github\#permissions)

The GitHub app requests the following permissions to support Cursor features:

| Permission | Purpose |
| --- | --- |
| **Repository access** | Clone your code and create working branches |
| **Pull requests** | Create PRs and leave review comments |
| **Issues** | Track bugs and tasks discovered during reviews |
| **Checks and statuses** | Report on code quality and test results |
| **Actions and workflows** | Monitor CI/CD pipelines and trigger CI re-runs from pull requests |
| **Administration** | Read branch protection and required check rules to determine PR mergeability |
| **Custom repository roles** | Determine user access levels so the correct merge and review options appear |
| **Organization custom properties** | Surface organization-defined repository metadata in filtering |

All permissions follow the principle of least privilege.

## [Troubleshooting](https://cursor.com/docs/integrations/github\#troubleshooting)

### Agent can't access repository

- Install the GitHub app with repository access
- Check repository permissions for private repos
- Verify your GitHub account permissions

### Permission denied for pull requests

- Grant the app write access to pull requests
- Check branch protection rules
- Reinstall if the app installation expired

### App not visible in GitHub settings

- Check if installed at organization level
- Reinstall from [github.com/apps/cursor](https://github.com/apps/cursor)
- Contact support if installation is corrupted

## [Next steps](https://cursor.com/docs/integrations/github\#next-steps)

Once your GitHub integration is connected, configure the features that use it:

- [Bugbot](https://cursor.com/docs/bugbot) — automated PR reviews that catch bugs and security issues
- [Cloud Agents](https://cursor.com/docs/cloud-agent) — AI agents that run in the cloud on your repositories

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