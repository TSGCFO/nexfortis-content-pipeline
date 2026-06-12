<!-- Source: https://cursor.com/docs/reference/keyboard-shortcuts -->
<!-- Title: Keyboard Shortcuts | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/reference/keyboard-shortcuts#main-content)

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

Get Started

# Keyboard Shortcuts

Overview of keyboard shortcuts in Cursor. See all keyboard shortcuts by pressing `Cmd RCtrl R` then `Cmd SCtrl S` or by opening command palette `Cmd Shift PCtrl Shift P` and searching for `Keyboard Shortcuts`.

Learn more about Keyboard Shortcuts in Cursor with [Key Bindings for VS Code](https://code.visualstudio.com/docs/getstarted/keybindings) as a baseline for Cursor's keybindings.

All Cursor keybindings, including Cursor-specific features, can be remapped in Keyboard Shortcuts settings.

## [General](https://cursor.com/docs/reference/keyboard-shortcuts\#general)

| Shortcut | Action |
| --- | --- |
| `Cmd ICtrl I` | Toggle Sidepanel (unless bound to mode) |
| `Cmd LCtrl L` | Toggle Sidepanel (unless bound to mode) |
| `Cmd ECtrl E` | Toggle Agent layout |
| `Cmd .Ctrl .` | Mode Menu |
| `Cmd /Ctrl /` | Loop between AI models |
| `Cmd Shift JCtrl Shift J` | Cursor settings |
| `Cmd Shift SpaceCtrl Shift Space` | Toggle Voice Mode |
| `Cmd ,Ctrl ,` | General settings |
| `Cmd Shift PCtrl Shift P` | Command palette |

## [Chat](https://cursor.com/docs/reference/keyboard-shortcuts\#chat)

Shortcuts for the chat input box.

| Shortcut | Action |
| --- | --- |
| `ReturnEnter` | Nudge (default) |
| `Ctrl ReturnCtrl Enter` | Queue message |
| `Cmd ReturnCtrl Enter` when typing | Force send message |
| `Cmd Shift BackspaceCtrl Shift Backspace` | Cancel generation |
| `Cmd Shift LCtrl Shift L` with code selected | Add selected code as context |
| `Cmd VCtrl V` with code or log in clipboard | Add clipboard as context |
| `Cmd Shift VCtrl Shift V` with code or log in clipboard | Add clipboard to input box |
| `Cmd ReturnCtrl Enter` with suggested changes | Accept all changes |
| `Cmd BackspaceCtrl Backspace` | Reject all changes |
| `Tab` | Cycle to next message |
| `Shift Tab` | Rotate between Agent modes |
| `Cmd Opt /Ctrl Alt /` | Model toggle |
| `Cmd NCtrl N` / `Cmd RCtrl R` | New chat |
| `Cmd TCtrl T` | New chat tab |
| `Cmd [Ctrl [` | Previous chat |\
| `Cmd ]Ctrl ]` | Next chat |
| `Cmd WCtrl W` | Close chat |
| `EscapeEsc` | Unfocus field |

## [Inline Edit](https://cursor.com/docs/reference/keyboard-shortcuts\#inline-edit)

| Shortcut | Action |
| --- | --- |
| `Cmd KCtrl K` | Open |
| `Cmd Shift KCtrl Shift K` | Toggle input focus |
| `ReturnEnter` | Submit |
| `Cmd Shift BackspaceCtrl Shift Backspace` | Cancel |
| `Opt ReturnAlt Enter` | Ask quick question |

## [Code Selection & Context](https://cursor.com/docs/reference/keyboard-shortcuts\#code-selection-context)

| Shortcut | Action |
| --- | --- |
| `@` | [@-mentions](https://cursor.com/docs/agent/prompting) |
| `/` | Shortcut Commands |
| `Cmd Shift LCtrl Shift L` | Add selection to Chat |
| `Cmd Shift KCtrl Shift K` | Add selection to Edit |
| `Cmd LCtrl L` | Add selection to new chat |
| `Cmd MCtrl M` | Toggle file reading strategies |
| `Cmd →Ctrl Arrow Right` | Accept next word of suggestion |
| `Cmd ReturnCtrl Enter` | Search codebase in chat |
| Select code, `Cmd CCtrl C`, `Cmd VCtrl V` | Add copied reference code as context |
| Select code, `Cmd CCtrl C`, `Cmd Shift VCtrl Shift V` | Add copied code as text context |

## [Tab](https://cursor.com/docs/reference/keyboard-shortcuts\#tab)

| Shortcut | Action |
| --- | --- |
| `Tab` | Accept suggestion |
| `Cmd →Ctrl Arrow Right` | Accept next word |

## [Terminal](https://cursor.com/docs/reference/keyboard-shortcuts\#terminal)

| Shortcut | Action |
| --- | --- |
| `Cmd KCtrl K` | Open terminal prompt bar |
| `Cmd ReturnCtrl Enter` | Run generated command |
| `EscapeEsc` | Accept command |

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