<!-- Source: https://cursor.com/docs/bugbot -->
<!-- Title: Bugbot | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/bugbot#main-content)

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

Cloud Agents

# Bugbot

Bugbot reviews pull requests and identifies bugs, security issues, and code quality problems.

## [How it works](https://cursor.com/docs/bugbot\#how-it-works)

Bugbot analyzes PR diffs and leaves comments with explanations and fix suggestions. It runs automatically on each PR update or manually when triggered.

- Runs **automatic reviews** on every PR update
- **Manual trigger** by commenting `cursor review` or `bugbot run` on any PR
- **Uses existing PR comments as context**: reads GitHub PR comments (top‑level and inline) to avoid duplicate suggestions and build on prior feedback
- **Fix in Cursor** links open issues directly in Cursor
- **Fix in Web** links open issues directly in [cursor.com/agents](https://cursor.com/agents)

## [Setup](https://cursor.com/docs/bugbot\#setup)

Connect your repositories through the Cursor dashboard to start using Bugbot.

- **GitHub** (including GitHub Enterprise Server): See the [GitHub integration page](https://cursor.com/docs/integrations/github)
- **GitLab** (including GitLab Self-Hosted): See the [GitLab integration page](https://cursor.com/docs/integrations/gitlab)

After connecting, return to the [Bugbot dashboard](https://cursor.com/dashboard/bugbot) to enable Bugbot on specific repositories.

## [CI check statuses](https://cursor.com/docs/bugbot\#ci-check-statuses)

Bugbot publishes a GitHub check named `Cursor Bugbot` for each review run. The check uses these conclusions:

- `success`: Bugbot found no issues, and there are no unresolved Bugbot comments from earlier runs.
- `neutral`: Bugbot found issues, the run was cancelled by a newer commit, or Bugbot hit an internal error. This is the default conclusion when Bugbot reports findings.
- `failure`: Bugbot found issues and the check is configured to fail on unresolved issues.

If you use branch protection, require the `Cursor Bugbot` check to make sure Bugbot runs before merge. Requiring the check alone does not block merges on findings because findings default to `neutral`. If fail-on-unresolved-issues behavior is available for your organization, enable it to make unresolved findings produce a failing check. Bugbot does not emit a `skipped` conclusion.

When Bugbot Autofix is enabled, GitHub may also show a separate `Cursor Bugbot Autofix` check. That check only uses `success` or `neutral`.

## [Configuration](https://cursor.com/docs/bugbot\#configuration)

IndividualTeam

### [Repository settings](https://cursor.com/docs/bugbot\#repository-settings-1)

Team admins can enable Bugbot per repository, configure allow/deny lists for reviewers, and set:

- Run **only once** per PR per installation, skipping subsequent commits

Bugbot runs for all contributors to enabled repositories, regardless of team membership.

### [Personal settings](https://cursor.com/docs/bugbot\#personal-settings-1)

Team members can override settings for their own PRs:

- Run **only when mentioned** by commenting `cursor review` or `bugbot run`
- Run **only once** per PR, skipping subsequent commits
- **Enable reviews on draft PRs** to include draft pull requests in automatic reviews

## [Analytics](https://cursor.com/docs/bugbot\#analytics)

![Bugbot dashboard](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Fbugbot%2Fbugbot-dashboard.png&w=1920&q=75&dpl=dpl_7UAjkDundnDt84UyVxZXdo4fDHt5)

## [Effort Levels](https://cursor.com/docs/bugbot\#effort-levels)

Effort levels control how much time Bugbot spends reasoning during a review. Higher effort levels can find more bugs, but each review may take longer and take more up usage.

Choose from these effort levels:

- **Default**: Optimizes for efficiency and speed. Reviews are less expensive, but Bugbot may find fewer bugs.
- **High**: Spends more time reasoning. Reviews are more expensive and take longer, but Bugbot may find more bugs.
- **Custom**: Lets you describe when Bugbot should use longer and deeper reviews. Cursor dynamically sets effort levels based on your instructions.

Effort levels are available only for usage-based Bugbot plans.

## [Team rules](https://cursor.com/docs/bugbot\#team-rules)

Team admins can create rules from the [Bugbot dashboard](https://cursor.com/dashboard/bugbot) that apply to all repositories in the team. These rules are available to every enabled repository, making it easy to enforce organization-wide standards.

When Team Rules, repository rules, and project rule files all apply, Bugbot merges them. Order of application: **Team Rules → repository rules (learned and manual) → project BUGBOT.md (including nested files) → User Rules**.

## [Repository rules](https://cursor.com/docs/bugbot\#repository-rules)

### [Project rules](https://cursor.com/docs/bugbot\#project-rules)

Create `.cursor/BUGBOT.md` files to provide project-specific context for reviews. Bugbot always includes the root `.cursor/BUGBOT.md` file and any additional files found while traversing upward from changed files.

```
project/
  .cursor/BUGBOT.md          # Always included (project-wide rules)
  backend/
    .cursor/BUGBOT.md        # Included when reviewing backend files
    api/
      .cursor/BUGBOT.md      # Included when reviewing API files
  frontend/
    .cursor/BUGBOT.md        # Included when reviewing frontend files
```

### [Learned rules](https://cursor.com/docs/bugbot\#learned-rules)

In the [Bugbot dashboard](https://cursor.com/dashboard/bugbot/repository-rules), enable learning for your organizations and repositories.

Rules are generated automatically from your team's activity on GitHub for that repository or by manually backfilling from the history of the repository.

You can also teach Bugbot new rules inline by commenting `@cursor remember [fact]` on any PR. Bugbot saves the fact as a learned rule and applies it to future reviews.

Cursor will automatically enable or disable rules as it learns more about your team's activity over time.

| Field | Description |
| --- | --- |
| **Name** | Short title for the rule. |
| **Rule content** | The instructions Bugbot should follow (i.e. style gates, paths, or review expectations). |
| **Scoped paths** | Optional glob patterns such as `src/components/**`. Leave empty to apply the rule across the whole repository. |

### [Manual rules](https://cursor.com/docs/bugbot\#manual-rules)

In the [Bugbot dashboard](https://cursor.com/dashboard/bugbot/repository-rules), you can create manual rules for individual repositories.

| Field | Description |
| --- | --- |
| **Name** | Short title for the rule. |
| **Rule content** | The instructions Bugbot should follow (i.e. style gates, paths, or review expectations). |
| **Scoped paths** | Optional glob patterns such as `src/components/**`. Leave empty to apply the rule across the whole repository. |

### [Rule analytics](https://cursor.com/docs/bugbot\#rule-analytics)

**Analytics** on a Bugbot rule show how it performs on real PRs:

| Metric | Meaning |
| --- | --- |
| **Issues found** | Number of findings Bugbot reported that involve this rule. |
| **PRs reviewed** | Number of pull requests where those findings appeared. |
| **Accepted issues** | Number of findings your team accepted. |
| **Acceptance rate** | Percentage of findings that were accepted. |

### [Examples](https://cursor.com/docs/bugbot\#examples)

### Security: Flag any use of eval() or exec()

```
If any changed file contains the string pattern /\beval\s*\(|\bexec\s*\(/i, then:
- Add a blocking Bug with title "Dangerous dynamic execution" and body:
  "Usage of eval/exec was found. Replace with safe alternatives or justify with a detailed comment and tests."
- Assign the Bug to the PR author.
- Apply label "security".
```

### OSS licenses: Prevent importing disallowed licenses

```
If the PR modifies dependency files (package.json, pnpm-lock.yaml, yarn.lock, requirements.txt, go.mod, Cargo.toml), then:
- Run the built-in License Scan.
- If any new or upgraded dependency has license in {GPL-2.0, GPL-3.0, AGPL-3.0}, then:
  - Add a blocking Bug titled "Disallowed license detected"
  - Include the offending package names, versions, and licenses in the Bug body
  - Apply labels "compliance" and "security"
```

### Language standards: Flag React componentWillMount usage

```
For files matching **/*.{js,jsx,ts,tsx} in React projects:
If a changed file contains /componentWillMount\s*\(/, then:
- Add a blocking Bug titled "Deprecated React lifecycle method"
- Body: "Replace componentWillMount with constructor or useEffect. See React docs."
- Suggest an autofix snippet that migrates side effects to useEffect.
```

### Standards: Require tests for backend changes

```
If the PR modifies files in {server/**, api/**, backend/**} and there are no changes in {**/*.test.*, **/__tests__/**, tests/**}, then:
- Add a blocking Bug titled "Missing tests for backend changes"
- Body: "This PR modifies backend code but includes no accompanying tests. Please add or update tests."
- Apply label "quality"
```

### Style: Disallow TODO comments

```
If any changed file contains /(?:^|\s)(TODO|FIXME)(?:\s*:|\s+)/, then:
- Add a non-blocking Bug titled "TODO/FIXME comment found"
- Body: "Replace TODO/FIXME with a tracked issue reference, e.g., `TODO(#1234): ...`, or remove it."
- If the TODO already references an issue pattern /#\d+|[A-Z]+-\d+/, mark the Bug as resolved automatically.
```

## [Autofix](https://cursor.com/docs/bugbot\#autofix)

Bugbot Autofix automatically spawns a [Cloud Agent](https://cursor.com/docs/cloud-agent#overview) to fix bugs found during PR reviews.

### [How it works](https://cursor.com/docs/bugbot\#how-it-works-1)

When Bugbot finds bugs during a PR review, it can automatically:

1. Spawn a Cloud Agent to analyze and fix the reported issues
2. Push fixes to the existing branch or a new branch (depending on your settings)
3. Post a comment on the original PR with the results

![Bugbot Autofix comment on a PR](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Fbugbot%2Fbugbot-autofix-comment.png&w=1920&q=75&dpl=dpl_7UAjkDundnDt84UyVxZXdo4fDHt5)

### [Configuration](https://cursor.com/docs/bugbot\#configuration-1)

Configure autofix behavior from the [Bugbot dashboard](https://cursor.com/dashboard/bugbot).

IndividualTeam

Team admins can set a default autofix mode for all team members in a GitHub organization:

- **Off** — autofix is disabled by default
- **Create New Branch** (Recommended) — Push fixes to a new branch for team members
- **Commit to Existing Branch** — Push fixes directly to the PR branch (max 3 attempts per PR to prevent loops)

Individual team members can override these defaults in their personal settings.

Autofix uses your **Default agent model** from [Settings → Models](https://cursor.com/dashboard/settings). If you haven't set a personal model preference, autofix falls back to your team's default model (if you're on a team) or the system default.

### [Requirements](https://cursor.com/docs/bugbot\#requirements)

Autofix requires:

- [On-demand usage](https://cursor.com/docs/models-and-pricing) pricing enabled
- Storage enabled (not in Legacy Privacy Mode)

### [Billing](https://cursor.com/docs/bugbot\#billing)

Autofix uses Cloud Agent credits and is billed at your plan rates. Cloud Agent billing follows your existing [pricing plan](https://cursor.com/docs/models-and-pricing).

## [MCP support](https://cursor.com/docs/bugbot\#mcp-support)

Bugbot is integrated with your [MCP servers](https://cursor.com/docs/mcp) so your AI tools can interact with Bugbot directly. Use the MCP server to provide additional tools to guide Bugbot's review process.

To get started:

1. Follow the [MCP documentation](https://cursor.com/docs/mcp) for MCP server setup instructions.
2. Add the tools to Bugbot in the [Bugbot dashboard](https://cursor.com/dashboard/bugbot).

MCP support is available on Team and Enterprise plans only.

## [Admin Configuration API](https://cursor.com/docs/bugbot\#admin-configuration-api)

Team admins can use the Bugbot Admin API to manage repositories and control which users can use Bugbot. Use it to automate repository management, enable Bugbot across multiple repositories, or integrate user provisioning with internal tools.

### [Authentication](https://cursor.com/docs/bugbot\#authentication)

All endpoints require a team Admin API Key passed as a Bearer token:

```
Authorization: Bearer $API_KEY
```

To create an API key:

1. Visit the [Settings tab in the Cursor dashboard](https://cursor.com/dashboard/settings)
2. Under **Advanced**, click **New Admin API Key**
3. Save the API key

All endpoints are rate-limited to 60 requests per minute per team.

### [Enabling or disabling repositories](https://cursor.com/docs/bugbot\#enabling-or-disabling-repositories)

Use the `/bugbot/repo/update` endpoint to toggle Bugbot on or off for a repository:

```
curl -X POST https://api.cursor.com/bugbot/repo/update \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "repoUrl": "https://github.com/your-org/your-repo",
    "enabled": true
  }'
```

**Parameters:**

- `repoUrl` (string, required): The full URL of the repository
- `enabled` (boolean, required): `true` to enable Bugbot, `false` to disable it

The dashboard UI may take a moment to reflect changes made through the API due to caching. The API response shows the current state in the database.

### [Listing repositories](https://cursor.com/docs/bugbot\#listing-repositories)

Use the `/bugbot/repos` endpoint to list all repositories with their Bugbot settings for your team:

```
curl https://api.cursor.com/bugbot/repos \
  -H "Authorization: Bearer $API_KEY"
```

The response includes each repository's enabled status, manual-only setting, and timestamps.

### [Managing user access](https://cursor.com/docs/bugbot\#managing-user-access)

Use the `/bugbot/user/update` endpoint to control which GitHub or GitLab users can use your team's Bugbot licenses. Enterprises use this to integrate Bugbot provisioning with internal access-request tools.

#### [Prerequisites](https://cursor.com/docs/bugbot\#prerequisites)

Before calling this endpoint, enable an allowlist or blocklist mode in your [team Bugbot settings](https://cursor.com/dashboard/bugbot):

- **Allowlist mode ("Only...")**: Only users on the list can use Bugbot
- **Blocklist mode ("Everyone but...")**: All users can use Bugbot except those on the list

If neither mode is enabled, the API returns an error.

#### [Adding or removing a user](https://cursor.com/docs/bugbot\#adding-or-removing-a-user)

```
curl -X POST https://api.cursor.com/bugbot/user/update \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "octocat",
    "allow": true
  }'
```

**Parameters:**

- `username` (string, required): The GitHub or GitLab username (case-insensitive)
- `allow` (boolean, required): Whether to grant or revoke access

How `allow` behaves depends on the active mode:

| Mode | `allow: true` | `allow: false` |
| --- | --- | --- |
| Allowlist | Adds user to list (can use Bugbot) | Removes user from list (cannot use Bugbot) |
| Blocklist | Removes user from blocklist (can use Bugbot) | Adds user to blocklist (cannot use Bugbot) |

**Response:**

```
{
  "outcome": "success",
  "message": "Updated team-level allowlist for @octocat",
  "updatedTeamSettings": true,
  "updatedInstallations": 0
}
```

The allowlist is stored at the team level and applies across all GitHub and GitLab installations owned by that team. Usernames are normalized to lowercase.

#### [Example: provisioning users through an internal tool](https://cursor.com/docs/bugbot\#example-provisioning-users-through-an-internal-tool)

Connect this API to an internal access-request portal. When an employee requests Bugbot access, the portal calls the API to add them. When they leave or lose access, it calls the API to remove them.

**Grant access:**

```
curl -X POST https://api.cursor.com/bugbot/user/update \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"username": "employee-github-name", "allow": true}'
```

**Revoke access:**

```
curl -X POST https://api.cursor.com/bugbot/user/update \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"username": "employee-github-name", "allow": false}'
```

## [Pricing](https://cursor.com/docs/bugbot\#pricing)

Bugbot uses usage-based billing.

Bugbot pricing changed with the May 2026 pricing update. See the [announcement blog post](https://cursor.com/blog/may-2026-bugbot-changes) for background. If you're still on the old seat-based plan, see [legacy Bugbot pricing](https://cursor.com/docs/bugbot/legacy-pricing).

### [Billing](https://cursor.com/docs/bugbot\#billing-1)

IndividualsTeams

### [Usage-based billing](https://cursor.com/docs/bugbot\#usage-based-billing-1)

Bugbot Teams includes:

- Code reviews on all PRs
- Analytics and reporting dashboard
- The ability to set the effort level Bugbot uses for reviews
- Advanced rules and settings

Bugbot Teams bills from on-demand spend. See the [pricing page](https://cursor.com/pricing#bugbot) for current rates.

### [Getting started](https://cursor.com/docs/bugbot\#getting-started-1)

Subscribe through your team dashboard to enable billing.

## [Troubleshooting](https://cursor.com/docs/bugbot\#troubleshooting)

If Bugbot isn't working:

1. **Enable verbose mode** by commenting `cursor review verbose=true` or `bugbot run verbose=true` for detailed logs and request ID
2. **Check permissions** to verify Bugbot has repository access
3. **Verify installation** to confirm the GitHub app is installed and enabled

Include the request ID from verbose mode when reporting issues.

## [FAQ](https://cursor.com/docs/bugbot\#faq)

### Does Bugbot read GitHub PR comments?

Yes. Bugbot reads both top‑level and inline GitHub pull request comments and includes them as context during reviews. This helps avoid duplicate suggestions and allows Bugbot to build on prior feedback from reviewers.

### Is Bugbot privacy-mode compliant?

Yes, Bugbot follows the same privacy compliance as Cursor and processes data identically to other Cursor requests.

### What happens when I use all included Bugbot usage?

When you use all included Bugbot usage, additional Bugbot reviews bill from on-demand spend.

### How do I give Bugbot access to my GitLab or GitHub Enterprise Server instance?

See the setup and networking guides on the respective integration pages:

- [GitHub Enterprise Server](https://cursor.com/docs/integrations/github#setup)
- [GitLab Self-Hosted](https://cursor.com/docs/integrations/gitlab#setup)

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