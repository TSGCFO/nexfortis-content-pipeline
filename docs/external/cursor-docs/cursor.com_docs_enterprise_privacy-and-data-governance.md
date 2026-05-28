<!-- Source: https://cursor.com/docs/enterprise/privacy-and-data-governance -->
<!-- Title: Privacy and Data Governance | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/enterprise/privacy-and-data-governance#main-content)

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

# Privacy and Data Governance

Understanding how data flows through Cursor is critical for security reviews and compliance assessments. This documentation explains what data goes where, what guarantees you have, and where that data lives geographically.

## [Three data flows](https://cursor.com/docs/enterprise/privacy-and-data-governance\#three-data-flows)

There are three ways data leaves your local environment when using Cursor:

### [1\. The indexing process](https://cursor.com/docs/enterprise/privacy-and-data-governance\#1-the-indexing-process)

When you open a project in Cursor, we create embeddings that represent your code. These embeddings power semantic search across your codebase.

**What gets sent:**

- Your code, temporarily, to create embeddings
- Nothing is stored; embeddings are generated and the original code is discarded

**What gets stored:**

- One-way mathematical embeddings (vectors) that represent code semantics
- Obfuscated file paths
- Line numbers

**How it works:**
When you ask a question or use `Cmd K`, we create an embedding from your request and search for similar embeddings in the vector database. The search returns obfuscated file paths and line numbers. We then look up the actual code on your local machine using those coordinates.

The vector database never sees your raw code. It only stores mathematical representations that can't be reverse-engineered back to source code.

### [2\. LLM requests](https://cursor.com/docs/enterprise/privacy-and-data-governance\#2-llm-requests)

When you use AI features, we send prompts and code context to language model providers like OpenAI, Anthropic, and Google.

**With Privacy Mode enabled:**

- Code is never stored by model providers
- Code is never used for training
- We maintain Zero Data Retention (ZDR) agreements with all providers

**Zero Data Retention agreements:**
We have contractual ZDR policies with OpenAI, Anthropic, Google Vertex AI, and xAI Grok. These agreements legally prevent providers from storing inputs or outputs or using your data for training.

Privacy Mode is on by default for Enterprise teams. See [Privacy Overview](https://cursor.com/privacy-overview) for details.

### [3\. Cloud Agents](https://cursor.com/docs/enterprise/privacy-and-data-governance\#3-cloud-agents)

Cloud Agents are the only feature that requires Cursor to store code. Unlike the indexing process or LLM requests, Cloud Agents need access to your repository over time to make changes.

**Architecture:**

- Agents run in isolated virtual machines
- Each agent has a dedicated environment
- Isolated from other agents and users

**What gets stored:**

- Encrypted copies of repositories that Cloud Agents work on
- Stored temporarily while the agent runs
- Deleted after the agent completes

Cloud Agents are optional. If your security policy prohibits code storage, don't enable Cloud Agents. You can still use all other Cursor features.

See [Cloud Agents](https://cursor.com/docs/cloud-agent) for details.

## [Privacy Mode enforcement](https://cursor.com/docs/enterprise/privacy-and-data-governance\#privacy-mode-enforcement)

Privacy Mode can be enabled at the team level to ensure all team members benefit from ZDR guarantees.

**Team-level enforcement:**

1. Go to your [team dashboard](https://cursor.com/dashboard)
2. Navigate to Settings
3. Enable Privacy Mode for the team
4. Optionally enforce it so members can't disable it

**MDM enforcement:**
For additional assurance, use the Allowed Team IDs policy. This prevents users from logging into personal accounts (which might not have Privacy Mode enabled) on corporate devices.

See [Identity and Access Management](https://cursor.com/docs/enterprise/identity-and-access-management#allowed-team-ids) for policy details and [Deployment Patterns](https://cursor.com/docs/enterprise/deployment-patterns#mdm-configuration) for MDM configuration.

## [Compliance and contracts](https://cursor.com/docs/enterprise/privacy-and-data-governance\#compliance-and-contracts)

Our [DPA](https://cursor.com/terms/dpa) includes comprehensive data protection commitments that follow industry standards, including data minimization, access control, and secure processing.

All [sub-processors](https://trust.cursor.com/subprocessors) are covered by appropriate data processing agreements.

## [Data encryption](https://cursor.com/docs/enterprise/privacy-and-data-governance\#data-encryption)

Cursor encrypts data for all infrastructure, including:

- TLS 1.2+ in transit
- AES-256 at rest

For enhanced security control, enterprise customers can use Customer Managed Encryption Keys (CMEK) for encrypting data stored in Cursor's infrastructure.

With CMEK enabled:

- Embeddings are encrypted using your customer encryption key
- Cloud Agent data is encrypted using your customer encryption key
- You control key rotation and access
- Provides additional layer of security beyond standard encryption

[Contact sales](https://cursor.com/contact-sales?source=docs-cmek) to enable CMEK for your organization.

Enterprise privacy and data controls

Contact our team to learn about CMEK, Privacy Mode enforcement, and more.

[Contact Sales](https://cursor.com/contact-sales?source=docs-privacy-governance)

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