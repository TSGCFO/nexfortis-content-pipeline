<!-- Source: https://cursor.com/docs/enterprise/llm-safety-and-controls -->
<!-- Title: LLM Safety and Controls | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/enterprise/llm-safety-and-controls#main-content)

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

# LLM Safety and Controls

AI models can behave unexpectedly. This documentation covers how to control what agents can do, set up safety guardrails, and guide LLM behavior toward desired outcomes.

## [Understanding model behavior](https://cursor.com/docs/enterprise/llm-safety-and-controls\#understanding-model-behavior)

LLMs generate text based on probability distributions, not by retrieving facts from a database or executing deterministic logic. They can produce different outputs for the same input, hallucinate facts or code that seems plausible but is wrong, and be influenced by carefully crafted prompts (prompt injection).

You can't rely on LLMs to always make safe decisions. Instead, you combine two approaches: **security controls** that enforce hard boundaries on what agents can do, and **steering mechanisms** that guide LLM behavior toward better outcomes.

For a deeper understanding of how LLMs work, see [How AI Models Work](https://cursor.com/learn/how-ai-models-work).

## [Two approaches to safety](https://cursor.com/docs/enterprise/llm-safety-and-controls\#two-approaches-to-safety)

Cursor provides two complementary approaches to managing AI agent behavior:

**Security controls (deterministic enforcement)**: Hard boundaries that block dangerous operations regardless of what the LLM suggests. These include terminal command restrictions, enforcement hooks that reject operations, approval workflows, and sandboxing. Security controls are your primary defense against harmful agent actions.

**LLM steering (non-deterministic guidance)**: Mechanisms that guide the LLM toward better behavior by shaping its context and available actions. These include Rules that add instructions to prompts, Commands that provide reusable workflows, and integrations that enrich the agent's knowledge. Steering improves agent quality but doesn't guarantee prevention of harmful actions.

Use both approaches together. Security controls provide the safety net. Steering reduces how often agents attempt problematic actions in the first place.

## [Security controls](https://cursor.com/docs/enterprise/llm-safety-and-controls\#security-controls)

These deterministic controls enforce hard boundaries on what agents can do. They work regardless of what the LLM suggests.

### [Terminal command restrictions](https://cursor.com/docs/enterprise/llm-safety-and-controls\#terminal-command-restrictions)

By default, Cursor requires your approval before executing any terminal command. This protects against destructive commands (deleting files, dropping databases), commands that expose sensitive data, and commands with unintended side effects.

When an agent wants to run a command, you see a prompt showing the full command. You can approve and run it, deny it, or modify it before running.

#### [Auto-approval risks](https://cursor.com/docs/enterprise/llm-safety-and-controls\#auto-approval-risks)

You can enable auto-approval for terminal commands, but understand the risks. Agents might run destructive commands without your knowledge, commands execute before you can review them, and bugs or prompt injection could cause unintended operations.

#### [Auto-run configuration](https://cursor.com/docs/enterprise/llm-safety-and-controls\#auto-run-configuration)

Enterprise teams can configure auto-run policies in the team dashboard. In Cursor 3.5 and above, end users choose between **Allowlist**, **Allowlist (with Sandbox)**, and **Run Everything** modes. You can create an allowlist of commands that don't require approval, such as `npm install`, `pip install`, `cargo build`, or `make test`.

The allowlist is best-effort, not a security boundary. Determined agents or prompt injection might bypass it. Always combine allowlists with other security controls like hooks.

See [Terminal auto-run modes](https://cursor.com/docs/agent/tools/terminal#auto-run-mode) and [Agent Security](https://cursor.com/docs/agent/security) for details.

### [Enforcement hooks](https://cursor.com/docs/enterprise/llm-safety-and-controls\#enforcement-hooks)

Hooks let you run custom logic at key points in the agent loop.

- Before prompt submission: Scan prompts for sensitive data before they're sent to LLMs. Block submissions that contain API keys or credentials, personal identifiable information (PII), or proprietary information.
- Before file reading: Scan files before agents read them. Redact or block access to configuration files with secrets, PII in databases or logs, or proprietary algorithms.
- After code generation: Scan generated code before it's written to disk. Check for security vulnerabilities (SQL injection, XSS), licensed code that might cause IP issues, or API keys and credentials in code.
- Before terminal execution: Block dangerous commands or route them through approval workflows. For example, block all `git push` commands, require approval for any `sudo` command, or block database `DROP` statements.

#### [Example: Blocking git commands](https://cursor.com/docs/enterprise/llm-safety-and-controls\#example-blocking-git-commands)

This hook intercepts shell commands and blocks raw git usage, directing users to the GitHub CLI instead:

```
#!/bin/bash
input=$(cat)
command=$(echo "$input" | jq -r '.command')

if [[ "$command" =~ git[[:space:]] ]]; then
    cat << EOF
{
  "permission": "deny",
  "userMessage": "Git command blocked. Please use gh tool instead.",
  "agentMessage": "Use 'gh' commands instead of raw git."
}
EOF
fi
```

#### [Example: Redacting secrets](https://cursor.com/docs/enterprise/llm-safety-and-controls\#example-redacting-secrets)

This hook scans file contents for GitHub API keys and blocks access if found:

```
#!/bin/bash
input=$(cat)
content=$(echo "$input" | jq -r '.content')

if echo "$content" | grep -qE 'gh[ps]_[A-Za-z0-9]{36}'; then
    cat << EOF
{
  "permission": "deny"
}
EOF
    exit 3
fi
```

See [Hooks](https://cursor.com/docs/hooks) for complete documentation and more examples.

### [Protecting sensitive files](https://cursor.com/docs/enterprise/llm-safety-and-controls\#protecting-sensitive-files)

Not all files in your repositories should be accessible to AI. Configuration files, secrets, and sensitive data need protection.

#### [.cursorignore](https://cursor.com/docs/enterprise/llm-safety-and-controls\#cursorignore)

The `.cursorignore` file works like `.gitignore` but controls what Cursor can access. Files matching patterns in `.cursorignore` are excluded from:

- [Semantic search](https://cursor.com/docs/agent/tools/search)
- Agent file reading
- Context selection
- Semantic search

`.cursorignore` is not a security boundary. It's a convenience feature to exclude files from AI processing, but:

- Users can manually read ignored files
- Agents might find ways to access ignored content
- It doesn't prevent file access, only excludes from indexing

For true security, use file system permissions or encrypt sensitive data.

See [Ignore Files](https://cursor.com/docs/reference/ignore-file) for detailed syntax.

#### [.cursor directory protection](https://cursor.com/docs/enterprise/llm-safety-and-controls\#cursor-directory-protection)

The `.cursor` directory in repositories contains project-specific settings, rules, and cache files. Enterprise teams can prevent agents from modifying this directory.

When enabled, agents cannot:

- Modify files in `.cursor/`
- Delete the `.cursor/` directory
- Change cursor rules or settings files

Users can still manually edit these files, but agents require approval.

Configure in the [team dashboard](https://cursor.com/docs/account/teams/dashboard) under ".cursor Directory Protection" (Enterprise only).

#### [Browser origin controls](https://cursor.com/docs/enterprise/llm-safety-and-controls\#browser-origin-controls)

Enterprise teams can restrict which websites agents can navigate to when using the [browser tool](https://cursor.com/docs/agent/tools/browser). Define an allowlist of approved domains—agents attempting to visit other origins are blocked.

Configure in the [team dashboard](https://cursor.com/docs/account/teams/dashboard) under "Browser Controls" (Enterprise only).

### [Integration with DLP tools](https://cursor.com/docs/enterprise/llm-safety-and-controls\#integration-with-dlp-tools)

Many enterprises have existing Data Loss Prevention (DLP) tools that scan for sensitive data. You can integrate Cursor with your DLP tools in three ways.

#### [Endpoint DLP agents](https://cursor.com/docs/enterprise/llm-safety-and-controls\#endpoint-dlp-agents)

Most endpoint DLP software can inspect Cursor's network traffic. Configure your DLP to monitor traffic to `*.cursor.sh` domains, scan for sensitive patterns in outbound requests, and block or alert on policy violations.

Network DLP may impact performance. See [Network Configuration](https://cursor.com/docs/enterprise/network-configuration) for proxy considerations.

#### [Hooks-based DLP](https://cursor.com/docs/enterprise/llm-safety-and-controls\#hooks-based-dlp)

Use Cursor's hooks feature to implement custom DLP logic:

**Before prompt submission:**
Scan prompts for sensitive patterns before sending to LLMs:

```
#!/bin/bash
input=$(cat)
prompt=$(echo "$input" | jq -r '.prompt')

# Check for API keys
if echo "$prompt" | grep -qE 'api[_-]?key.*[A-Za-z0-9]{32}'; then
    cat << EOF
{
  "continue": false,
  "userMessage": "Prompt contains what looks like an API key. Remove it and try again."
}
EOF
    exit 1
fi

# Allow if no sensitive data found
cat << EOF
{
  "continue": true
}
EOF
```

**After code generation:**
Scan generated code before it's written to disk:

```
#!/bin/bash
input=$(cat)
file_path=$(echo "$input" | jq -r '.file_path')
edits=$(echo "$input" | jq -r '.edits[].new_string')

# Check for hardcoded credentials
if echo "$edits" | grep -qE 'password.*=.*["\047][^"\047]+["\047]'; then
    # Send to your DLP API for analysis
    curl -X POST "https://dlp.yourcompany.com/scan" \
      -H "Content-Type: application/json" \
      -d "{\"content\":\"$edits\",\"file\":\"$file_path\"}"

    # Check API response and act accordingly
fi
```

#### [Third-party DLP integration](https://cursor.com/docs/enterprise/llm-safety-and-controls\#third-party-dlp-integration)

Call your existing DLP vendor's API from hooks:

```
#!/bin/bash
input=$(cat)
content=$(echo "$input" | jq -r '.content')

# Send to DLP API
response=$(curl -s -X POST "https://dlp-api.company.com/analyze" \
  -H "Authorization: Bearer $DLP_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"$content\"}")

# Parse response
is_allowed=$(echo "$response" | jq -r '.allowed')

if [ "$is_allowed" = "true" ]; then
    cat << EOF
{
  "permission": "allow"
}
EOF
else
    violation=$(echo "$response" | jq -r '.violation_type')
    cat << EOF
{
  "permission": "deny",
  "userMessage": "Content blocked by DLP policy: $violation"
}
EOF
fi
```

This approach gives you centralized DLP policy management across all development tools.

### [Approval workflows](https://cursor.com/docs/enterprise/llm-safety-and-controls\#approval-workflows)

You can configure Cursor to ask for approval on every agent action. Users can set their agent to always ask before reading files, editing files, running terminal commands, or making network requests.

However, this approach significantly slows down the development experience. Agents need multiple actions to complete tasks, and requiring approval for each action makes the workflow tedious. Most teams instead choose to use hooks to block dangerous operations automatically.

### [Model provider safety](https://cursor.com/docs/enterprise/llm-safety-and-controls\#model-provider-safety)

All model providers (OpenAI, Anthropic, Google, xAI) implement safety systems that filter harmful content. These systems reject prompts requesting harmful information, refuse to generate dangerous code, and filter outputs for safety.

Cursor works with providers to ensure models meet safety standards before deployment to users. Providers continuously evaluate models for safety issues. However, these are not security boundaries. Safety systems can be bypassed or tricked. Always implement your own controls through hooks and access policies.

### [Sandboxing considerations](https://cursor.com/docs/enterprise/llm-safety-and-controls\#sandboxing-considerations)

Cursor agents run on your local machine by default. They can read files you can read, write files you can write, execute commands you can execute, and access network resources you can access.

There is no security boundary between agents and your user account. If your account can delete files, agents can delete files (with approval by default).

#### [Sandboxing options](https://cursor.com/docs/enterprise/llm-safety-and-controls\#sandboxing-options)

If you need stronger isolation, run Cursor in a separate VM using Cloud Agents, use file system permissions to limit what the Cursor process can access, or run Cursor on a dedicated development machine with limited access to production systems.

For most enterprises, the built-in approval requirements and hooks provide sufficient control.

### [File system permissions](https://cursor.com/docs/enterprise/llm-safety-and-controls\#file-system-permissions)

For further defense, use file system permissions to protect sensitive files:

**Restrict access to secret files:**

```
# Make secrets readable only by specific users
chmod 600 .env
chown app-user:app-user .env

# Or use separate directories with restricted access
chmod 700 /etc/app/secrets
```

**Separate sensitive repos:**
Keep highly sensitive code in separate repositories with restricted access. Don't clone these repositories to machines where Cursor runs.

**Encrypted filesystems:**
For very sensitive data, use encrypted filesystems that require explicit mounting. Don't mount these filesystems in directories where Cursor has access.

## [LLM steering](https://cursor.com/docs/enterprise/llm-safety-and-controls\#llm-steering)

Security controls block harmful actions after the LLM suggests them. Steering mechanisms guide the LLM to make better suggestions in the first place. These are non-deterministic. They improve outcomes but don't guarantee prevention.

### [Rules](https://cursor.com/docs/enterprise/llm-safety-and-controls\#rules)

Rules add instructions to the LLM's context window before every request. Use rules to establish coding standards, enforce architectural patterns, set security requirements, or define project-specific conventions.

Rules work at three scopes:

**User rules**: Apply to all projects for a specific user. Use these for personal preferences like code style or preferred libraries.

**Project rules**: Apply to everyone working on a project. Use these for project-specific standards like naming conventions or framework usage.

**Team rules**: Apply to all projects in your organization. Use these for company-wide standards like security requirements or compliance rules.

The LLM sees all applicable rules when generating responses. It will attempt to follow them, but rules are suggestions, not guarantees. Combine rules with enforcement hooks for requirements that must be followed.

See [Rules](https://cursor.com/docs/rules) for configuration and examples.

### [Commands and workflows](https://cursor.com/docs/enterprise/llm-safety-and-controls\#commands-and-workflows)

Commands package reusable prompts that agents can invoke with slash commands like `/test` or `/deploy`. Commands help standardize common workflows across your team.

**Workflows**: Create multi-step processes that guide agents through complex tasks. For example, a `/security-review` command might instruct the agent to scan for SQL injection, check for exposed secrets, validate input sanitization, and generate a security report.

**Prompt libraries**: Build a collection of tested prompts for common tasks. This reduces variation in agent behavior and captures institutional knowledge.

Commands are scoped to teams, projects, or users. Team admins can create organization-wide commands that appear for all developers.

See [Commands](https://cursor.com/help/customization/rules) for configuration and examples.

### [Context enrichment with MCPs](https://cursor.com/docs/enterprise/llm-safety-and-controls\#context-enrichment-with-mcps)

Model Context Protocol (MCP) servers let agents access external data sources. Use MCPs to pull in company documentation, query internal APIs, access knowledge bases, or integrate with development tools.

MCPs enrich the agent's context with information it wouldn't otherwise have. For example, an MCP might provide access to your API specifications, so agents can generate code that correctly calls your internal services.

MCPs are scoped to teams or users. Unlike hooks, MCPs don't enforce policies—they provide information that helps agents make better decisions.

See [MCP Integration](https://cursor.com/docs/mcp) for configuration and examples.

Advanced safety controls for Enterprise

Contact our team to learn about org-wide enforcement and security policies.

[Contact Sales](https://cursor.com/contact-sales?source=docs-llm-safety)

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