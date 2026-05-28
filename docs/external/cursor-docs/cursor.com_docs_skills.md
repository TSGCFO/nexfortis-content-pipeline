<!-- Source: https://cursor.com/docs/skills -->
<!-- Title: Agent Skills | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/skills#main-content)

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

Customizing

# Agent Skills

Agent Skills is an open standard for extending AI agents with specialized capabilities. Skills package domain-specific knowledge and workflows that agents can use to perform specific tasks.

## [What are skills?](https://cursor.com/docs/skills\#what-are-skills)

A skill is a portable, version-controlled package that teaches agents how to perform domain-specific tasks. Skills can include scripts, templates, and references that agents may act on using their tools.

Portable

Skills work across any agent that supports the Agent Skills standard.

Version-controlled

Skills are stored as files and can be tracked in your repository, or installed via GitHub repository links.

Actionable

Skills can include scripts, templates, and references that agents act on using their tools.

Progressive

Skills load resources on demand, keeping context usage efficient.

## [How skills work](https://cursor.com/docs/skills\#how-skills-work)

When Cursor starts, it automatically discovers skills from skill directories and makes them available to Agent. The agent is presented with available skills and decides when they are relevant based on context.

Skills can also be manually invoked by typing `/` in Agent chat and searching for the skill name.

## [Skill directories](https://cursor.com/docs/skills\#skill-directories)

Skills are automatically loaded from these locations:

| Location | Scope |
| --- | --- |
| `.agents/skills/` | Project-level |
| `.cursor/skills/` | Project-level |
| `~/.agents/skills/` | User-level (global) |
| `~/.cursor/skills/` | User-level (global) |

For compatibility, Cursor also loads skills from Claude and Codex directories: `.claude/skills/`, `.codex/skills/`, `~/.claude/skills/`, and `~/.codex/skills/`.

Each skill should be a folder containing a `SKILL.md` file:

```
.agents/
└── skills/
    └── my-skill/
        └── SKILL.md
```

Skills can also include optional directories for scripts, references, and assets:

```
.agents/
└── skills/
    └── deploy-app/
        ├── SKILL.md
        ├── scripts/
        │   ├── deploy.sh
        │   └── validate.py
        ├── references/
        │   └── REFERENCE.md
        └── assets/
            └── config-template.json
```

### [Nested skill directories](https://cursor.com/docs/skills\#nested-skill-directories)

Skill directories can be organized into subdirectories. This is useful for grouping related skills by category, team, or domain. Cursor walks the skills root recursively and picks up any `SKILL.md` it finds:

```
.cursor/
└── skills/
    ├── shipping/
    │   ├── land-it/
    │   │   └── SKILL.md
    │   └── careful-merge-conflicts/
    │       └── SKILL.md
    ├── debugging/
    │   └── using-datadog-mcp/
    │       └── SKILL.md
    └── workflow/
        └── tdd/
            └── SKILL.md
```

The category folder is purely organizational. The skill's identity comes from the folder containing `SKILL.md` (here `land-it`, `tdd`, etc.), not the parent category.

Cursor also discovers skills inside nested project subdirectories. A `.cursor/skills/` (or `.agents/skills/`) folder anywhere inside your repository is picked up, so monorepos can colocate skills with the package they apply to:

```
my-monorepo/
├── .cursor/skills/         # repo-wide skills
│   └── land-it/SKILL.md
└── apps/
    └── web/
        └── .cursor/skills/  # app-specific skills
            └── deploy-web/SKILL.md
```

Skills in nested project directories are automatically scoped to files inside that directory. In the example above, `deploy-web` is only surfaced when the agent works with files under `apps/web/`, while skills in the repo-wide `.cursor/skills/` are available everywhere. This is similar to the [`paths` frontmatter field](https://cursor.com/docs/skills#scoping-a-skill-to-specific-files) — you don't need to set `paths` on a nested skill to scope it to its directory.

## [SKILL.md file format](https://cursor.com/docs/skills\#skillmd-file-format)

Each skill is defined in a `SKILL.md` file with YAML frontmatter:

```
---
name: my-skill
description: Short description of what this skill does and when to use it.
---

# My Skill

Detailed instructions for the agent.

## When to Use

- Use this skill when...
- This skill is helpful for...

## Instructions

- Step-by-step guidance for the agent
- Domain-specific conventions
- Best practices and patterns
- Use the ask questions tool if you need to clarify requirements with the user
```

### [Frontmatter fields](https://cursor.com/docs/skills\#frontmatter-fields)

| Field | Required | Description |
| --- | --- | --- |
| `name` | Yes | Skill identifier. Lowercase letters, numbers, and hyphens only. Must match the parent folder name. |
| `description` | Yes | Describes what the skill does and when to use it. Used by the agent to determine relevance. |
| `paths` | No | Glob patterns that scope the skill to matching files. Accepts a comma-separated string or a list. When set, the skill is only surfaced when the agent works with files that match. |
| `disable-model-invocation` | No | When `true`, the skill is only included when explicitly invoked via `/skill-name`. The agent will not automatically apply it based on context. |
| `metadata` | No | Arbitrary key-value mapping for additional metadata. |

## [Scoping a skill to specific files](https://cursor.com/docs/skills\#scoping-a-skill-to-specific-files)

Use the `paths` field to limit a skill to files that match one or more glob patterns. The skill is then only surfaced to the agent when it is reading or editing matching files. This keeps file-specific guidance out of context for unrelated work.

```
---
name: react-component-patterns
description: Conventions for writing React components in this codebase.
paths:
  - "**/*.tsx"
  - "packages/ui/**/*.ts"
---

# React component patterns

...
```

You can also pass a single comma-separated string:

```
---
name: python-style
description: Style rules for Python files.
paths: "**/*.py, scripts/**/*.py"
---
```

Patterns follow standard glob syntax. Leave `paths` unset for a skill that should be available regardless of which files are open.

The legacy `globs` field is still accepted as a fallback for older skills, but new skills should use `paths`.

## [Disabling automatic invocation](https://cursor.com/docs/skills\#disabling-automatic-invocation)

By default, skills are automatically applied when the agent determines they are relevant. Set `disable-model-invocation: true` to make a skill behave like a traditional slash command, where it is only included in context when you explicitly type `/skill-name` in chat.

## [Including scripts in skills](https://cursor.com/docs/skills\#including-scripts-in-skills)

Skills can include a `scripts/` directory containing executable code that agents can run. Reference scripts in your `SKILL.md` using relative paths from the skill root.

```
---
name: deploy-app
description: Deploy the application to staging or production environments. Use when deploying code or when the user mentions deployment, releases, or environments.
---

# Deploy App

Deploy the application using the provided scripts.

## Usage

Run the deployment script: `scripts/deploy.sh <environment>`

Where `<environment>` is either `staging` or `production`.

## Pre-deployment Validation

Before deploying, run the validation script: `python scripts/validate.py`
```

The agent reads these instructions and executes the referenced scripts when the skill is invoked. Scripts can be written in any language—Bash, Python, JavaScript, or any other executable format supported by the agent implementation.

Scripts should be self-contained, include helpful error messages, and handle edge cases gracefully.

## [Optional directories](https://cursor.com/docs/skills\#optional-directories)

Skills support these optional directories:

| Directory | Purpose |
| --- | --- |
| `scripts/` | Executable code that agents can run |
| `references/` | Additional documentation loaded on demand |
| `assets/` | Static resources like templates, images, or data files |

Keep your main `SKILL.md` focused and move detailed reference material to separate files. This keeps context usage efficient since agents load resources progressively—only when needed.

## [Viewing skills](https://cursor.com/docs/skills\#viewing-skills)

To view discovered skills:

1. Open **Cursor Settings** (Cmd+Shift+J on Mac, Ctrl+Shift+J on Windows/Linux)
2. Navigate to **Rules**
3. Skills appear in the **Agent Decides** section

## [Installing skills from GitHub](https://cursor.com/docs/skills\#installing-skills-from-github)

You can import skills from GitHub repositories:

1. Open **Cursor Settings → Rules**
2. In the **Project Rules** section, click **Add Rule**
3. Select **Remote Rule (Github)**
4. Enter the GitHub repository URL

## [Migrating rules and commands to skills](https://cursor.com/docs/skills\#migrating-rules-and-commands-to-skills)

Cursor includes a built-in `/migrate-to-skills` skill in 2.4 that helps you convert existing dynamic rules and slash commands to skills.

The migration skill converts:

- **Dynamic rules**: Rules that use the "Apply Intelligently" configuration—rules with `alwaysApply: false` (or undefined) and no `globs` patterns defined. These are converted to standard skills.
- **Slash commands**: Both user-level and workspace-level commands are converted to skills with `disable-model-invocation: true`, preserving their explicit invocation behavior.

To migrate:

1. Type `/migrate-to-skills` in Agent chat
2. The agent will identify eligible rules and commands and convert them to skills
3. Review the generated skills in `.cursor/skills/`

Rules with `alwaysApply: true` or specific `globs` patterns are not migrated, as they have explicit triggering conditions that differ from skill behavior. User rules are also not migrated since they are not stored on the file system.

## [Learn more](https://cursor.com/docs/skills\#learn-more)

Agent Skills is an open standard. Learn more at [agentskills.io](https://agentskills.io/).

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