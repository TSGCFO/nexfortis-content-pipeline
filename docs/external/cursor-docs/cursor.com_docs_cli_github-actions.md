<!-- Source: https://cursor.com/docs/cli/github-actions -->
<!-- Title: GitHub Actions | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/cli/github-actions#main-content)

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

Headless / CI

# GitHub Actions

Use Cursor CLI in GitHub Actions and other CI/CD systems to automate development tasks.

## [GitHub Actions integration](https://cursor.com/docs/cli/github-actions\#github-actions-integration)

Basic setup:

```
- name: Install Cursor CLI  run: |    curl https://cursor.com/install -fsS | bash    echo "$HOME/.cursor/bin" >> $GITHUB_PATH- name: Run Cursor Agent  env:    CURSOR_API_KEY: ${{ secrets.CURSOR_API_KEY }}  run: |    agent -p "Your prompt here" --model gpt-5.2
```

For Windows runners, use PowerShell: `irm 'https://cursor.com/install?win32=true' | iex`

## [Cookbook examples](https://cursor.com/docs/cli/github-actions\#cookbook-examples)

See our cookbook examples for practical workflows: [updating documentation](https://cursor.com/docs/cli/headless) and [fixing CI issues](https://cursor.com/docs/cli/headless).

## [Other CI systems](https://cursor.com/docs/cli/github-actions\#other-ci-systems)

Use Cursor CLI in any CI/CD system with:

- **Shell script execution** (bash, zsh, etc.)
- **Environment variables** for API key configuration
- **Internet connectivity** to reach Cursor's API

## [Autonomy levels](https://cursor.com/docs/cli/github-actions\#autonomy-levels)

Choose your agent's autonomy level:

### [Full autonomy approach](https://cursor.com/docs/cli/github-actions\#full-autonomy-approach)

Give the agent complete control over git operations, API calls, and external interactions. Simpler setup, requires more trust.

**Example:** In our [Update Documentation](https://cursor.com/docs/cli/headless) cookbook, the first workflow lets the agent:

- Analyze PR changes
- Create and manage git branches
- Commit and push changes
- Post comments on pull requests
- Handle all error scenarios

```
- name: Update docs (full autonomy)  run: |    agent -p "You have full access to git, GitHub CLI, and PR operations.     Handle the entire docs update workflow including commits, pushes, and PR comments."
```

### [Restricted autonomy approach](https://cursor.com/docs/cli/github-actions\#restricted-autonomy-approach)

We recommend using this approach with **permission-based restrictions** for
production CI workflows. This gives you the best of both worlds: the agent can
intelligently handle complex analysis and file modifications while critical
operations remain deterministic and auditable.

Limit agent operations while handling critical steps in separate workflow steps. Better control and predictability.

**Example:** The second workflow in the same cookbook restricts the agent to only file modifications:

```
- name: Generate docs updates (restricted)  run: |    agent -p "IMPORTANT: Do NOT create branches, commit, push, or post PR comments.     Only modify files in the working directory. A later workflow step handles publishing."- name: Publish docs branch (deterministic)  run: |    # Deterministic git operations handled by CI    git checkout -B "docs/${{ github.head_ref }}"    git add -A    git commit -m "docs: update for PR"    git push origin "docs/${{ github.head_ref }}"- name: Post PR comment (deterministic)  run: |    # Deterministic PR commenting handled by CI    gh pr comment ${{ github.event.pull_request.number }} --body "Docs updated"
```

### [Permission-based restrictions](https://cursor.com/docs/cli/github-actions\#permission-based-restrictions)

Use [permission configurations](https://cursor.com/docs/cli/reference/permissions) to enforce restrictions at the CLI level:

```
{  "permissions": {    "allow": [      "Read(**/*.md)",      "Write(docs/**/*)",      "Shell(grep)",      "Shell(find)"    ],    "deny": ["Shell(git)", "Shell(gh)", "Write(.env*)", "Write(package.json)"]  }}
```

## [Authentication](https://cursor.com/docs/cli/github-actions\#authentication)

### [Generate your API key](https://cursor.com/docs/cli/github-actions\#generate-your-api-key)

First, [generate an API key](https://cursor.com/docs/cli/reference/authentication#api-key-authentication) from your Cursor dashboard.

### [Configure repository secrets](https://cursor.com/docs/cli/github-actions\#configure-repository-secrets)

Store your Cursor API key securely in your repository using the GitHub CLI:

```
# Repository secretgh secret set CURSOR_API_KEY --repo OWNER/REPO --body "$CURSOR_API_KEY"# Organization secret (all repos)gh secret set CURSOR_API_KEY --org ORG --visibility all --body "$CURSOR_API_KEY"
```

Alternatively, use the GitHub UI: Go to your repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

### [Use in workflows](https://cursor.com/docs/cli/github-actions\#use-in-workflows)

Set your `CURSOR_API_KEY` environment variable:

```
env:  CURSOR_API_KEY: ${{ secrets.CURSOR_API_KEY }}
```

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