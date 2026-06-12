<!-- Source: https://cursor.com/docs/agent/tools/canvas -->
<!-- Title: Canvases | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/agent/tools/canvas#main-content)

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

# Canvases

Canvases let Cursor create interactive artifacts that render next to the chat. Instead of scrolling through a long markdown table or code block, you get a standalone view, laid out with sections, stats, and tables, that you can reopen, edit, and iterate on.

Ask agents for a dashboard, analysis, audit, or report, and Cursor opens the result in a canvas when that is a better fit.

## [How it works](https://cursor.com/docs/agent/tools/canvas\#how-it-works)

1. Cursor decides that your task benefits from a visual or interactive view, or you ask for one directly.
2. Cursor builds the canvas and inserts a reference to it in your chat.
3. You review the rendered view, switch to the source to tweak it, or ask Cursor to change it.
4. Cursor saves the canvas so you can reopen and rerun it later with fresh data.

Each canvas appears in your workspace's canvas list, so you can jump back to past ones without rerunning them.

## [Opening a canvas](https://cursor.com/docs/agent/tools/canvas\#opening-a-canvas)

- **From Cursor**: when Cursor creates a canvas, a card appears at the end of the response. Click it to open.
- **Command Palette**: run **Open Canvas** from the palette, listed under View.
- **Agents Window**: open a canvas tab directly from the new tab menu in the [Agents Window](https://cursor.com/docs/agent/agents-window).

## [Sharing canvases](https://cursor.com/docs/agent/tools/canvas\#sharing-canvases)

Shared canvases turn an interactive artifact into something your whole team can open, not just you. When you share a canvas, Cursor uploads a live snapshot of the view and gives you a link teammates can open in the browser — same layout, charts, and tables, without rerunning the agent or digging through chat history. Use **Publish** from the canvas toolbar to publish or refresh a share; browse everything your team has published from **Shared Canvases** on the [dashboard](https://cursor.com/dashboard).

Shared canvases are available on paid plans (Pro, Teams, and Enterprise). Free accounts cannot create shares. Because each share is team-visible, you need to be on a team — Pro users on a team can share too. Sharing also requires a privacy mode that allows data storage (Legacy Privacy Mode blocks it).

Team admins can turn shared canvases off for the organization from [team settings](https://cursor.com/dashboard/settings#shared-canvases) under **Shared Canvases**.

## [Iterating on a canvas](https://cursor.com/docs/agent/tools/canvas\#iterating-on-a-canvas)

Canvases are designed to be easy to refine.

- If the layout isn't right, tell Cursor what to change instead of editing by hand.
- If the numbers look stale or off, ask Cursor to rerun the underlying query or show its work.
- For larger reworks, revert and prompt Cursor again with more details. This is usually faster than nudging through small follow-ups.
- For small tweaks, you can also manually edit the source code.

## [Packaging in skills](https://cursor.com/docs/agent/tools/canvas\#packaging-in-skills)

Common canvas workflows can be packaged as [skills](https://cursor.com/docs/skills) so Cursor produces a consistent layout every time you ask.

A canvas skill typically includes:

- **A trigger description** so Cursor knows when to reach for it, like "quarterly revenue report" or "dependency audit".
- **Layout instructions** that define the sections, stats, and tables the canvas should contain.
- **Data sources and queries** Cursor should run to populate the view, such as a SQL query, API call, or shell command.
- **Formatting rules** like units, date ranges, or sort order.

Once the skill is in place, a short prompt is enough to regenerate the canvas with fresh data, and every teammate using the skill gets the same output shape.

## [Related](https://cursor.com/docs/agent/tools/canvas\#related)

- [Agents Window](https://cursor.com/docs/agent/agents-window)
- [Skills](https://cursor.com/docs/skills)
- [Prompting](https://cursor.com/docs/agent/prompting)

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