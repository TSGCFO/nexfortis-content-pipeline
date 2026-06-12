<!-- Source: https://cursor.com/docs/enterprise/endpoint-security -->
<!-- Title: Endpoint Security Configuration | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/enterprise/endpoint-security#main-content)

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

# Endpoint Security Configuration

Cursor loads JavaScript modules and performs file I/O during startup. Endpoint security software that intercepts file operations or injects into processes can slow startup past internal timeouts, causing features like Agent to fail. This page covers how to configure exclusions so Cursor works alongside your security stack.

## [What to exclude](https://cursor.com/docs/enterprise/endpoint-security\#what-to-exclude)

Add the following processes and paths to your security product's exclusion list.

### [Windows](https://cursor.com/docs/enterprise/endpoint-security\#windows)

**Processes:**

| Process | User install path | System install path |
| --- | --- | --- |
| `Cursor.exe` | `%LOCALAPPDATA%\Programs\cursor\Cursor.exe` | `%ProgramFiles%\cursor\Cursor.exe` |
| `rg.exe` | `%LOCALAPPDATA%\Programs\cursor\resources\app\node_modules\@vscode\ripgrep\bin\rg.exe` | `%ProgramFiles%\cursor\resources\app\node_modules\@vscode\ripgrep\bin\rg.exe` |
| `inno_updater.exe` | `%LOCALAPPDATA%\Programs\cursor\resources\app\node_modules\cursor-inno-updater\inno_updater.exe` | `%ProgramFiles%\cursor\resources\app\node_modules\cursor-inno-updater\inno_updater.exe` |

**Paths:**

| Path | Description |
| --- | --- |
| `%LOCALAPPDATA%\Programs\cursor\` | Application binaries and bundled modules (user install) |
| `%ProgramFiles%\cursor\` | Application binaries and bundled modules (system install) |

### [macOS](https://cursor.com/docs/enterprise/endpoint-security\#macos)

**Processes:**`Cursor.app`

**Paths:**

| Path | Description |
| --- | --- |
| `/Applications/Cursor.app/` | Application bundle |

## [Why exclusions may be needed](https://cursor.com/docs/enterprise/endpoint-security\#why-exclusions-may-be-needed)

Cursor's extension host reads JavaScript files from its own install directory at startup. When security software adds per-file scanning latency, the cumulative delay can exceed Cursor's startup timeout.

This primarily affects startup. Once modules are loaded into memory, ongoing file operations are infrequent and unlikely to cause issues.

Cursor's own files are code-signed binaries and bundled JavaScript, not user-generated content. Excluding them from real-time scanning is low-risk and does not reduce protection for user files or network traffic.

Both **process exclusions** and **path exclusions** may be needed. Some products use kernel-level minifilter drivers that scan all file I/O regardless of which process is reading. A process-only exclusion may not be sufficient — add path exclusions for the Cursor install directory as well.

## [Identifying active security software](https://cursor.com/docs/enterprise/endpoint-security\#identifying-active-security-software)

These commands can help identify which products are running so you know where you may need to configure exclusions. On Windows, run in an **Administrator PowerShell** window:

```
# Registered AV products
Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct |
  Select-Object displayName, pathToSignedProductExe

# Kernel-level filesystem filter drivers
fltmc

# Check for EDR process injection via environment variables
[System.Environment]::GetEnvironmentVariables() |
  Where-Object { $_.Keys -match "BPP|COR_PROFILER|COMPLUS|__COMPAT" }

# Windows Defender status
Get-MpComputerStatus |
  Select-Object IsTamperProtected, RealTimeProtectionEnabled, AMRunningMode
```

**How to read `fltmc` output:** Standard Windows drivers you can ignore include `WdFilter`, `storqosflt`, `wcifs`, `CldFlt`, `bfs`, `FileCrypt`, `luafv`, `Wof`, `FileInfo`, `npsvctrig`, `bindflt`, and `UnionFS`. Other drivers are likely from third-party security software.

**How to read the environment variable output:** If it returns any results, an EDR product is injecting code into every new process on the machine, and an exclusion may be necessary.

## [Verifying exclusions are working](https://cursor.com/docs/enterprise/endpoint-security\#verifying-exclusions-are-working)

After applying exclusions, restart Cursor and verify that Agent features work without timing out. If you previously saw empty Extension Host logs (Cmd/Ctrl+Shift+P → "Output" → "Extension Host"), they should now show normal startup output.

## [Troubleshooting checklist](https://cursor.com/docs/enterprise/endpoint-security\#troubleshooting-checklist)

1. Run the [identification commands above](https://cursor.com/docs/enterprise/endpoint-security#identifying-active-security-software) to determine which security products are running
2. Add both process and path exclusions for the identified products in their management consoles
3. Restart Cursor and test Agent — this is the definitive test of whether exclusions are working
4. If exclusions don't resolve the issue, [export logs](https://cursor.com/help/troubleshooting/agent-issues#what-if-i-see-agent-execution-timed-out) and contact Cursor support with the diagnostic output\`

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