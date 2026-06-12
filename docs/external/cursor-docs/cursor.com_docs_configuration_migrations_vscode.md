<!-- Source: https://cursor.com/docs/configuration/migrations/vscode -->
<!-- Title: VS Code Migration | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/configuration/migrations/vscode#main-content)

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

# VS Code Migration

Cursor is based upon the VS Code codebase, allowing us to focus on making the best AI-powered coding experience while maintaining a familiar editing environment. This makes it easy to migrate your existing VS Code settings to Cursor.

## [Profile Migration](https://cursor.com/docs/configuration/migrations/vscode\#profile-migration)

### [One-click Import](https://cursor.com/docs/configuration/migrations/vscode\#one-click-import)

Here's how to get your entire VS Code setup in one click:

1. Open the Cursor Settings ( `⌘`/ `Ctrl` \+ `Shift` \+ `J`)
2. Navigate to General > Account
3. Under "VS Code Import", click the Import button

![VS Code Import](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Fget-started%2Fvscode-import.png&w=1920&q=75&dpl=dpl_GncwoURS8Y1xqd6VWLEyZJaQzLkP)

This will transfer your:

- Extensions
- Themes
- Settings
- Keybindings

### [Manual Profile Migration](https://cursor.com/docs/configuration/migrations/vscode\#manual-profile-migration)

If you are moving between machines, or want more control over your settings, you can manually migrate your profile.

#### [Exporting a Profile](https://cursor.com/docs/configuration/migrations/vscode\#exporting-a-profile)

1. On your VS Code instance, open the Command Palette ( `⌘`/ `Ctrl` \+ `Shift` \+ `P`)
2. Search for "Preferences: Open Profiles (UI)"
3. Find the profile you want to export on the left sidebar
4. Click the 3-dot menu and select "Export Profile"
5. Choose to export it either to your local machine or to a GitHub Gist

#### [Importing a Profile](https://cursor.com/docs/configuration/migrations/vscode\#importing-a-profile)

1. On your Cursor instance, open the Command Palette ( `⌘`/ `Ctrl` \+ `Shift` \+ `P`)
2. Search for "Preferences: Open Profiles (UI)"
3. Click the dropdown menu next to 'New Profile' and click 'Import Profile'
4. Either paste in the URL of the GitHub Gist or choose 'Select File' to upload a local file
5. Click 'Import' at the bottom of the dialog to save the profile
6. Finally, in the sidebar, choose the new profile and click the tick icon to active it

## [Settings and Interface](https://cursor.com/docs/configuration/migrations/vscode\#settings-and-interface)

### [Settings Menus](https://cursor.com/docs/configuration/migrations/vscode\#settings-menus)

- **Cursor Settings:** ( `⌘`/ `Ctrl` \+ `Shift` \+ `P`), then type "Cursor Settings"
- **VS Code Settings:** ( `⌘`/ `Ctrl` \+ `Shift` \+ `P`), then type "Preferences: Open Settings (UI)"

### [Version Updates](https://cursor.com/docs/configuration/migrations/vscode\#version-updates)

We regularly rebase Cursor onto the latest VS Code version to stay current with features and fixes. To ensure stability, Cursor often uses slightly older VS Code versions.

### [Activity Bar Orientation](https://cursor.com/docs/configuration/migrations/vscode\#activity-bar-orientation)

We made the activity bar horizontal to optimize space for the AI chat interface. If you prefer vertical:

1. Open the Command Palette ( `⌘`/ `Ctrl` \+ `Shift` \+ `P`)
2. Search for "Preferences: Open Settings (UI)"
3. Search for `workbench.activityBar.orientation`
4. Set the value to `vertical`
5. Restart Cursor

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