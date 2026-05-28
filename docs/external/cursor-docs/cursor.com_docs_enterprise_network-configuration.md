<!-- Source: https://cursor.com/docs/enterprise/network-configuration -->
<!-- Title: Network Configuration | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/enterprise/network-configuration#main-content)

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

# Network Configuration

Cursor needs to communicate with backend services and AI providers. This documentation covers how to configure Cursor to work within your network infrastructure, including proxies, firewalls, and encryption requirements.

## [Proxy configuration](https://cursor.com/docs/enterprise/network-configuration\#proxy-configuration)

Many enterprises route traffic through proxy servers for monitoring and security. Cursor works with most proxy configurations, but some proxy settings can cause issues with streaming responses.

### [HTTP/2 vs HTTP/1.1](https://cursor.com/docs/enterprise/network-configuration\#http2-vs-http11)

Cursor uses HTTP/2 bidirectional streaming by default for real-time chat and agent experiences. Some enterprise proxies don't support HTTP/2 streaming correctly. Zscaler is the most widely used proxy with this limitation.

If you experience issues with streaming, Cursor automatically falls back to HTTP/1.1 Server-Sent Events (SSE) mode. This fallback was specifically designed to work with Zscaler and similar proxies that buffer or break HTTP/2 streams. The fallback happens transparently when HTTP/2 bidirectional streaming doesn't work.

### [SSL inspection and DLP](https://cursor.com/docs/enterprise/network-configuration\#ssl-inspection-and-dlp)

Many corporate proxies perform SSL man-in-the-middle inspection to scan traffic for security threats or data loss prevention (DLP). This replaces Cursor's SSL certificates with your proxy's certificates.

When Cursor traffic goes through Secure Web Gateways (SWG), SSL inspection, or DLP, it often causes timeouts, slowness, or errors when using Cursor's Agent capabilities. This is one of the most common deployment blockers for enterprise customers. For endpoint security software (AV, EDR, DLP) that runs on the machine itself rather than at the network level, see [Endpoint Security Configuration](https://cursor.com/docs/enterprise/endpoint-security).

Cursor's services are already encrypted end-to-end. We recommend disabling SSL inspection for these domains:

- `.cursor.sh`
- `cursor-cdn.com`
- `marketplace.cursorapi.com`
- `authenticate.cursor.sh`
- `authenticator.cursor.sh`

If your security policy requires SSL inspection on all traffic, your proxy must support:

- HTTP/2 bidirectional streaming (or that Cursor's HTTP/1.1 fallback works)
- Server-Sent Events (SSE) passthrough without buffering
- Long-running connections without forced timeouts
- Disabling response buffering for streaming content types

### [Testing proxy connectivity](https://cursor.com/docs/enterprise/network-configuration\#testing-proxy-connectivity)

If you experience connection issues, you can test connectivity manually using curl commands. These commands simulate the requests Cursor makes to backend services.

**Test basic connectivity:**

```
curl -v https://api2.cursor.sh |& grep -C1 issuer:
```

This shows which SSL certificate is in use. You should see Amazon RSA. If you see your proxy provider (like Zscaler), SSL inspection is active.

**Test HTTP/1.1 streaming:**

```
echo -ne "\x0\x0\x0\x0\x11{\"payload\":\"foo\"}" | \
  curl --http1.1 -No - -XPOST \
  -H "Content-Type: application/connect+json" \
  --data-binary @- \
  https://api2.cursor.sh/aiserver.v1.HealthService/StreamSSE
```

You should see output appear line by line over 5 seconds. If it appears all at once after 5 seconds, your proxy is buffering streaming responses.

**Test HTTP/2 bidirectional streaming:**

```
(for i in 1 2 3 4 5; do \
  echo -ne "\x0\x0\x0\x0\x12{\"payload\":\"foo$i\"}"; \
  sleep 1; \
done) | curl -No - -XPOST \
  -H "Content-Type: application/connect+json" \
  -T - \
  https://api2.cursor.sh/aiserver.v1.HealthService/StreamBidi
```

Output should appear once per second. If buffered for 5 seconds, your proxy doesn't support HTTP/2 bidirectional streaming.

## [IP allowlisting](https://cursor.com/docs/enterprise/network-configuration\#ip-allowlisting)

If your network uses IP-based access controls, you need to allow traffic to Cursor's backend services.

Rather than maintaining IP address lists (which can change), configure your firewall to allow traffic to these domain patterns:

- `*.cursor.sh`
- `*.cursor-cdn.com`
- `*.cursorapi.com`

## [VPC peering](https://cursor.com/docs/enterprise/network-configuration\#vpc-peering)

Cursor doesn't currently offer VPC peering or private connectivity options.

However, when you run Cursor agents (either in the editor or via the CLI), they inherit your existing network configuration. If you run Cursor on a machine within your VPC, agent operations inherit:

- Your network security groups
- Your firewall rules
- Your DNS configuration
- Your VPN or private network access

This means Cursor agents can access internal resources that the machine can reach, while following your existing network security controls.

## [Encryption](https://cursor.com/docs/enterprise/network-configuration\#encryption)

Cursor encrypts data both in transit and at rest.

### [In transit](https://cursor.com/docs/enterprise/network-configuration\#in-transit)

- TLS 1.2 or higher for all connections to Cursor services
- TLS for connections to third-party AI providers
- Certificate pinning for critical services

### [At rest](https://cursor.com/docs/enterprise/network-configuration\#at-rest)

- AES-256 encryption for stored data
- Encrypted vector database storage
- Encrypted code storage for Cloud Agents (when enabled)

### [Key management](https://cursor.com/docs/enterprise/network-configuration\#key-management)

Cursor manages encryption keys. Keys are rotated according to security best practices and stored in secure key management systems.

For enhanced security control, enterprise customers can use Customer Managed Encryption Keys (CMEK) for encrypting data stored in Cursor's infrastructure. See [Data Encryption](https://cursor.com/docs/enterprise/privacy-and-data-governance#data-encryption) for details.

## [LLM gateways](https://cursor.com/docs/enterprise/network-configuration\#llm-gateways)

Some enterprises want to route LLM traffic through their own gateways for additional monitoring and control.

Custom gateways can introduce additional latency, rate limiting, and compatibility issues. We instead recommend using Cursor's built-in hooks feature to implement your own security controls.

Cursor's [Zero Data Retention policy](https://cursor.com/docs/account/teams/dashboard#privacy-settings) does not apply when using your own API keys. Your data handling will be subject to the privacy policies of your chosen AI provider (OpenAI, Anthropic, Google, Azure, or AWS).

See [Hooks](https://cursor.com/docs/hooks) and [Security Guardrails](https://cursor.com/docs/enterprise/llm-safety-and-controls) for details.

## [Cloud Agents networking](https://cursor.com/docs/enterprise/network-configuration\#cloud-agents-networking)

Cloud Agents run on Cursor's infrastructure, not your local network. They can access:

- Public GitHub repositories
- GitHub Enterprise Cloud repositories you've granted access to
- GitHub Enterprise Server (self-hosted GitHub Enterprise)
- On-prem + cloud-based GitLab and Bitbucket
- Public package registries (npm, PyPI, etc.)

Cloud Agents cannot access:

- Resources behind your corporate firewall
- On-premises GitHub Enterprise Server
- Private package registries without internet access

If your development workflow requires access to internal resources, use the Cursor editor on machines within your network instead of Cloud Agents.

## [Troubleshooting checklist](https://cursor.com/docs/enterprise/network-configuration\#troubleshooting-checklist)

If you experience connection issues:

1. **Test basic connectivity** to `api2.cursor.sh`
2. **Check if SSL inspection is active** and consider excluding Cursor domains
3. **Verify streaming works** using the curl tests above
4. **Check firewall rules** allow traffic to `*.cursor.sh` and related domains
5. **Review proxy logs** for connection errors or timeouts
6. **Test from a machine outside your network** to isolate network-specific issues

Most connectivity issues stem from proxies buffering streaming responses. Work with your network team to disable buffering for Cursor domains or implement proper streaming support.

Need help with enterprise network setup?

Contact our team for deployment assistance and priority support.

[Contact Sales](https://cursor.com/contact-sales?source=docs-network-config)

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