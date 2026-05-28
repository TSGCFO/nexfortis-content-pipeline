<!-- Source: https://cursor.com/docs/configuration/worktrees -->
<!-- Title: Worktrees | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/configuration/worktrees#main-content)

## Command Palette

Search for a command to run...

## Get Started

[Welcome](https://cursor.com/docs) [Quickstart](https://cursor.com/docs/get-started/quickstart)
Models & Pricing
[Changelog](https://cursor.com/changelog)

## Agent

[Overview](https://cursor.com/docs/agent/overview) [Agents Window](https://cursor.com/docs/agent/agents-window) [Agent Review](https://cursor.com/docs/agent/agent-review) [Planning](https://cursor.com/docs/agent/plan-mode) [Prompting](https://cursor.com/docs/agent/prompting) [Debugging](https://cursor.com/docs/agent/debug-mode)
Tools

[Terminal](https://cursor.com/docs/agent/tools/terminal)

[Browser](https://cursor.com/docs/agent/tools/browser)

[Search](https://cursor.com/docs/agent/tools/search)

[Canvases](https://cursor.com/docs/agent/tools/canvas)

[Worktrees](https://cursor.com/docs/configuration/worktrees)

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

Agent

# Worktrees

The UI-native worktrees feature described on this page is only available in the Agents Window. In the Editor Window, use the Worktree Skills commands below.

Worktrees let Agent work in isolated Git checkouts. Each task gets its own files, dependencies, and changes while your main checkout stays untouched.

Use worktrees when you want to start several agents on the same repo without conflicts.

## [Create a worktree in the Agents Window](https://cursor.com/docs/configuration/worktrees\#create-a-worktree-in-the-agents-window)

When you start or move an agent into a worktree from the Agents Window, Cursor creates a separate checkout for that agent. The agent continues the task inside the worktree, so changes stay isolated from your main checkout.

After the agent finishes, review the result in the Agents Window. You can keep working in the worktree, create a commit or PR from that checkout, or bring the result back into your main workspace.

## [How does worktree setup work?](https://cursor.com/docs/configuration/worktrees\#how-does-worktree-setup-work)

You can customize worktree setup with `.cursor/worktrees.json`. Cursor checks this file when it creates a worktree in the Agents Window, the Editor Window, or the [Cursor CLI](https://cursor.com/docs/cli/using#cli-worktrees).

Cursor looks for `.cursor/worktrees.json` in this order:

1. In the worktree path
2. In the root path of your project

### [Configuration options](https://cursor.com/docs/configuration/worktrees\#configuration-options)

The `worktrees.json` file supports three setup keys:

- **`setup-worktree-unix`**: Commands or a script path for macOS and Linux. This takes precedence over `setup-worktree` on Unix systems.
- **`setup-worktree-windows`**: Commands or a script path for Windows. This takes precedence over `setup-worktree` on Windows.
- **`setup-worktree`**: Generic fallback for all operating systems.

Each key accepts either:

- **An array of shell commands**: executed sequentially in the worktree
- **A string filepath**: path to a script file relative to `.cursor/worktrees.json`

## [Example setup configurations](https://cursor.com/docs/configuration/worktrees\#example-setup-configurations)

### [Using command arrays](https://cursor.com/docs/configuration/worktrees\#using-command-arrays)

#### [Node.js project](https://cursor.com/docs/configuration/worktrees\#nodejs-project)

```
{
  "setup-worktree": [\
    "npm ci",\
    "cp $ROOT_WORKTREE_PATH/.env .env"\
  ]
}
```

We do not recommend symlinking dependencies into the worktree. This can cause issues in the main worktree. Use a fast package manager such as `bun`, `pnpm`, or `uv` instead.

#### [Python project with virtual environment](https://cursor.com/docs/configuration/worktrees\#python-project-with-virtual-environment)

```
{
  "setup-worktree": [\
    "python -m venv venv",\
    "source venv/bin/activate && pip install -r requirements.txt",\
    "cp $ROOT_WORKTREE_PATH/.env .env"\
  ]
}
```

#### [Project with database migrations](https://cursor.com/docs/configuration/worktrees\#project-with-database-migrations)

```
{
  "setup-worktree": [\
    "npm ci",\
    "cp $ROOT_WORKTREE_PATH/.env .env",\
    "npm run db:migrate"\
  ]
}
```

#### [Build and link dependencies](https://cursor.com/docs/configuration/worktrees\#build-and-link-dependencies)

```
{
  "setup-worktree": [\
    "pnpm install",\
    "pnpm run build",\
    "cp $ROOT_WORKTREE_PATH/.env.local .env.local"\
  ]
}
```

### [Using script files](https://cursor.com/docs/configuration/worktrees\#using-script-files)

For more complex setups, reference script files instead of inline commands:

```
{
  "setup-worktree-unix": "setup-worktree-unix.sh",
  "setup-worktree-windows": "setup-worktree-windows.ps1",
  "setup-worktree": [\
    "echo 'Using generic fallback. For better support, define OS-specific scripts.'"\
  ]
}
```

Place your scripts in the `.cursor/` directory next to `worktrees.json`.

**setup-worktree-unix.sh** (Unix and macOS):

```
#!/bin/bash
set -e

# Install dependencies
npm ci

# Copy environment file
cp "$ROOT_WORKTREE_PATH/.env" .env

# Run database migrations
npm run db:migrate

echo "Worktree setup complete!"
```

**setup-worktree-windows.ps1** (Windows):

```
$ErrorActionPreference = 'Stop'

# Install dependencies
npm ci

# Copy environment file
Copy-Item "$env:ROOT_WORKTREE_PATH\.env" .env

# Run database migrations
npm run db:migrate

Write-Host "Worktree setup complete!"
```

### [OS-specific configurations](https://cursor.com/docs/configuration/worktrees\#os-specific-configurations)

You can provide different setup commands for different operating systems:

```
{
  "setup-worktree-unix": [\
    "npm ci",\
    "cp $ROOT_WORKTREE_PATH/.env .env",\
    "chmod +x scripts/*.sh"\
  ],
  "setup-worktree-windows": [\
    "npm ci",\
    "copy %ROOT_WORKTREE_PATH%\\.env .env"\
  ]
}
```

### [Debugging](https://cursor.com/docs/configuration/worktrees\#debugging)

If you want to debug worktree setup, open the Output panel in the editor and select `Worktrees Setup`.

## [How does Cursor discover existing worktrees?](https://cursor.com/docs/configuration/worktrees\#how-does-cursor-discover-existing-worktrees)

Cursor 3.5 keeps a modified time checkpoint for the machine worktree root and for each workspace subdirectory. On startup, Cursor re-scans the filesystem unless those timestamps prove nothing changed since the last discovery. This avoids skipping new worktrees that were created while Cursor was closed and eliminates the older `worktree.discoveryComplete` flag.

## [Worktrees cleanup](https://cursor.com/docs/configuration/worktrees\#worktrees-cleanup)

The cleanup behavior in this section reflects Cursor 3.5 and later.

Cursor can clean up older worktrees automatically to limit disk usage. Cleanup runs on an interval and keeps the newest worktrees up to the configured machine-wide maximum count across every workspace on the device.

```
{
  "cursor.worktreeCleanupIntervalHours": 6,
  "cursor.worktreeMaxCount": 25
}
```

Use these machine-scoped settings to control cleanup:

- **`cursor.worktreeCleanupIntervalHours`**: how often Cursor checks for old worktrees. Cursor 3.5 catches up after restarts by scheduling a delayed cleanup if the last successful run is older than this interval.
- **`cursor.worktreeMaxCount`**: the maximum number of worktrees Cursor keeps before cleaning up older ones. The default cap is 25 worktrees per machine, and all workspaces contribute toward the same limit.

Cursor re-discovers the worktree root on every cleanup pass, so worktrees created outside the manager (for example, worktrees created by `/worktree` skills or `git worktree add`) are eligible for deletion. When creating a worktree would exceed the cap, Cursor debounces bursts of events and starts an immediate cleanup instead of waiting for the next interval.

## [Worktree Skills in Editor Window](https://cursor.com/docs/configuration/worktrees\#worktree-skills-in-editor-window)

In the editor window, you can use the `/worktree` and `/best-of-n` commands to run tasks in isolated worktrees.

### [Use `/worktree` for one isolated run](https://cursor.com/docs/configuration/worktrees\#use-worktree-for-one-isolated-run)

Start a task with `/worktree` when you want Cursor to do the rest of that chat in a separate checkout.

- Keep experimental edits away from your main checkout
- Run installs, builds, and tests without disturbing your current branch
- Work on risky refactors with a simple cleanup path

```
/worktree fix the failing auth tests and update the login copy
```

In many cases, you can commit and push directly from the worktree. Ask the agent:

```
Commit and push these changes, then open a PR
```

If you want to bring the changes into your main checkout to test them, use `/apply-worktree`. When you are done with the isolated checkout, use `/delete-worktree`.

If you want to see all worktrees in your repository, run:

```
git worktree list
```

### [Use `/best-of-n` to compare multiple models](https://cursor.com/docs/configuration/worktrees\#use-best-of-n-to-compare-multiple-models)

`/best-of-n` runs the same task across multiple models at once. Each run gets its own worktree, so the candidates stay isolated from each other and from your main checkout.

```
/best-of-n sonnet,gpt,composer fix the flaky logout test
```

Use it when you want to:

- Compare different models on the same prompt
- Try multiple approaches for a hard change
- Pick the strongest result before applying anything

`/best-of-n` compares runs only. It does not merge changes back into your main checkout for you. After you pick a winner, you can commit and push directly from the worktree or use `/apply-worktree` to bring the changes into your main checkout.

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