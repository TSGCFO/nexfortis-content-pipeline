<!-- Source: https://cursor.com/docs/enterprise/baa -->
<!-- Title: HIPAA Business Associate Agreements | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/enterprise/baa#main-content)

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

# HIPAA Business Associate Agreements

Cursor supports HIPAA Business Associate Agreements (BAAs) for Enterprise customers.

Organizations that are covered entities or business associates under HIPAA can request a BAA as part of their Enterprise agreement. A signed BAA is required before submitting protected health information (PHI) to Cursor.

## [Request a BAA](https://cursor.com/docs/enterprise/baa\#request-a-baa)

BAAs are available on the Enterprise plan. To request one:

1. [Contact sales](https://cursor.com/contact-sales?source=docs-baa)
2. Tell us that you need a HIPAA BAA
3. Share whether you are evaluating Cursor, moving from a Teams plan, or already on Enterprise

Request a HIPAA BAA

Contact sales to request BAA support for Cursor Enterprise.

[Contact Sales](https://cursor.com/contact-sales?source=docs-baa)

## [Using Cursor with PHI](https://cursor.com/docs/enterprise/baa\#using-cursor-with-phi)

The HIPAA Implementation and Configuration Guide is part of the BAA. It includes current details about Eligible Services, Eligible Models, required controls, and customer responsibilities. [Request access in the Trust Center](https://trust.cursor.com/resources?s=i7h69cmvekn7rag2pc9y4r&name=cursor-hipaa-implementation-guide.pdf).

A BAA does not automatically make every product, configuration, or workflow appropriate for PHI. Your organization is responsible for configuring Cursor and instructing users in accordance with your BAA, HIPAA requirements, and the HIPAA Guide.

Before using Cursor with PHI:

- Sign an Enterprise agreement and BAA with Cursor
- Review the HIPAA Guide in the Trust Center
- Enable and lock [Privacy Mode](https://cursor.com/docs/enterprise/privacy-and-data-governance#privacy-mode-enforcement) organization-wide
- Train users to submit PHI only through Eligible Services and approved workflows

Third-party services and integrations are not automatically covered by Cursor's BAA. Your organization remains responsible for assessing and configuring any third-party services it uses with Cursor.

## [Eligible Services](https://cursor.com/docs/enterprise/baa\#eligible-services)

The listed Eligible Services are covered for Enterprise customers with Privacy Mode enabled and locked organization-wide:

- Desktop IDE, including Agent, Tab, Edit, local agent mode, and inline edit
- Cloud Agents and self-hosted Cloud Agents
- CLI
- Tab
- BugBot
- Automations

The HIPAA Guide has the latest details about Eligible Services and implementation requirements. [Request access in the Trust Center](https://trust.cursor.com/resources?s=i7h69cmvekn7rag2pc9y4r&name=cursor-hipaa-implementation-guide.pdf).

## [FAQ](https://cursor.com/docs/enterprise/baa\#faq)

### [Who can request a BAA?](https://cursor.com/docs/enterprise/baa\#who-can-request-a-baa)

Enterprise customers and prospects evaluating Enterprise can request a BAA for Cursor. This typically applies to healthcare organizations and vendors that act as covered entities or business associates.

### [Is BAA support available on Teams?](https://cursor.com/docs/enterprise/baa\#is-baa-support-available-on-teams)

BAA support is available on Enterprise. If your organization is currently on a Teams plan, [contact sales](https://cursor.com/contact-sales?source=docs-baa) to discuss moving to Enterprise and requesting a BAA.

### [Can we submit PHI before the BAA is signed?](https://cursor.com/docs/enterprise/baa\#can-we-submit-phi-before-the-baa-is-signed)

No. Do not submit PHI to Cursor until your Enterprise agreement and BAA are signed and your organization has completed the required implementation steps.

### [Which Cursor services are covered?](https://cursor.com/docs/enterprise/baa\#which-cursor-services-are-covered)

Your signed BAA and the HIPAA Guide list the Eligible Services covered for PHI. [Request access in the Trust Center](https://trust.cursor.com/resources?s=i7h69cmvekn7rag2pc9y4r&name=cursor-hipaa-implementation-guide.pdf).

### [Which models are covered?](https://cursor.com/docs/enterprise/baa\#which-models-are-covered)

The HIPAA Guide lists the current Eligible Models. [Request access in the Trust Center](https://trust.cursor.com/resources?s=i7h69cmvekn7rag2pc9y4r&name=cursor-hipaa-implementation-guide.pdf).

### [Does Cursor's BAA cover third-party model providers or integrations?](https://cursor.com/docs/enterprise/baa\#does-cursors-baa-cover-third-party-model-providers-or-integrations)

Cursor's BAA does not automatically cover third-party services. Review your approved configuration, model provider settings, integration usage, and the HIPAA Guide before submitting PHI.

### [How do we get security and compliance documents?](https://cursor.com/docs/enterprise/baa\#how-do-we-get-security-and-compliance-documents)

Visit the [Trust Center](https://trust.cursor.com/) to request access to available security and compliance documents.

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