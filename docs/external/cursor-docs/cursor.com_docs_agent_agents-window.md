<!-- Source: https://cursor.com/docs/agent/agents-window -->
<!-- Title: Agents Window | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/agent/agents-window#main-content)

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

Agent

# Agents Window

The Agents Window is Cursor's agent-first interface. It provides a unified workspace to build with agents across repos and environments, including local, cloud, remote SSH, and more. It combines the power of parallel agents with the depth and control of a development environment.

You can switch back to the editor anytime, or have both open simultaneously.

media loading

### Network Error

A network error caused the media download to fail.



PlayPause

en0:00

en0:00

PlayPause10

Seek backward
10
10

Seek forward
10
0:00 / 0:00

MuteUnmute

Quality1x

Playback rate

Audio

Captions

start airplaystop airplay

Start castingStop casting

Enter picture in picture modeExit picture in picture mode

Enter fullscreen modeExit fullscreen mode![](https://cursor.com/docs-static/images/agent/Cursor3.0-ThumbnailB.jpg)

## [Open the Agents Window](https://cursor.com/docs/agent/agents-window\#open-the-agents-window)

If you're in the editor, type `Cmd+Shift+P → Open Agents WindowCtrl+Shift+P Arrow Right Open Agents Window` to open the Agents Window.

![Command Palette showing the Open Agents Window command](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Fagent%2Fopen-agents-window-final.png&w=1920&q=75&dpl=dpl_7UAjkDundnDt84UyVxZXdo4fDHt5)

## [Switch Back to the Editor](https://cursor.com/docs/agent/agents-window\#switch-back-to-the-editor)

To return to the classic Cursor editor, type `Cmd+Shift+P → Open Editor WindowCtrl+Shift+P Arrow Right Open Editor Window`. This opens the current workspace in the editor.

![Actions menu showing the Open Editor Window command](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Fagent%2Fopen-editor-window-final.png&w=1920&q=75&dpl=dpl_7UAjkDundnDt84UyVxZXdo4fDHt5)

If you want to view or edit files without leaving the Agents Window, you can type `Cmd+PCtrl+P` to search files, or `Cmd+Shift+FCtrl+Shift+F` to search all files.

![Agents Window showing file search and file viewing](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Fagent%2Ffile-agents-window-final.png&w=1920&q=75&dpl=dpl_7UAjkDundnDt84UyVxZXdo4fDHt5)

## [Features Available Only in the Agents Window](https://cursor.com/docs/agent/agents-window\#features-available-only-in-the-agents-window)

The following features are available in the Agents Window:

- **Multi-workspace:** work with agents across all your projects from one place.
- **New diffs view:** review and commit changes, and manage PRs without leaving Cursor.
- **Parallel agents:** run many parallel agents in the cloud (and work with them from your phone, web, Slack, GitHub, and Linear).
- **Easier handoff between local and cloud:** quickly move an agent from cloud to local to iterate quickly, and move it back to the cloud so it keeps working on its own.
- **Worktrees:** [run agents in isolated Git checkouts](https://cursor.com/docs/configuration/worktrees) so each task has its own files and changes.

## [Choosing Between Agents Window and Editor](https://cursor.com/docs/agent/agents-window\#choosing-between-agents-window-and-editor)

The Agents Window works well when you want to run and manage many agents in parallel. If you are using agents to write most of your code, the Agents Window helps pull you up to a higher level of abstraction.

The editor works well when you want the classic IDE with VS Code extensions and flexible screen splitting to see many files at once.

You can move between the two interfaces, and we will continue to support and improve both experiences.

## [Enterprise access](https://cursor.com/docs/agent/agents-window\#enterprise-access)

Agents Window is generally available with Cursor 3, released on April 2, 2026. For the two weeks following launch, Enterprise Admins can control rollout within their organizations by giving access to their entire team or to specific users via Team settings. After the rollout period, all users will have access by default.

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