<!-- Source: https://cursor.com/docs/get-started/quickstart -->
<!-- Title: Quickstart | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/get-started/quickstart#main-content)

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

# Quickstart

This guide gets you from install to your first useful change in Cursor. You'll sign in, ask Cursor to explain your codebase, make a small edit, and review the result.

1

### Install Cursor and sign in

Download Cursor. Open the app and sign in. Then pick a folder and start with a small task.

[Download Cursor⤓](https://cursor.com/downloads)

### macOS

- macOS 12 (Monterey) and later
- Native installer (.dmg)
- Apple Silicon and Intel support

### Windows

- Windows 10 and later
- Native installer (.exe)

### Linux

**Debian/Ubuntu (recommended)**

```
# Add Cursor's GPG key
curl -fsSL https://downloads.cursor.com/keys/anysphere.asc | gpg --dearmor | sudo tee /etc/apt/keyrings/cursor.gpg > /dev/null

# Add the Cursor repository
echo "deb [arch=amd64,arm64 signed-by=/etc/apt/keyrings/cursor.gpg] https://downloads.cursor.com/aptrepo stable main" | sudo tee /etc/apt/sources.list.d/cursor.list > /dev/null

# Update and install
sudo apt update
sudo apt install cursor
```

**RHEL/Fedora**

```
# Add Cursor's repository
sudo tee /etc/yum.repos.d/cursor.repo << 'EOF'
[cursor]
name=Cursor
baseurl=https://downloads.cursor.com/yumrepo
enabled=1
gpgcheck=1
gpgkey=https://downloads.cursor.com/keys/anysphere.asc
EOF

# Install Cursor
sudo dnf install cursor
```

**AppImage (portable)**

Download the `.AppImage` file from [cursor.com/downloads](https://cursor.com/downloads), then:

```
chmod +x Cursor-*.AppImage
./Cursor-*.AppImage
```

The apt and yum packages are preferred over AppImage. They provide desktop icons, automatic updates, and CLI tools.

2

### Ask Cursor to explain your codebase

After you pick a folder, open Agent with `Cmd ICtrl I`. Ask Cursor to explain the codebase and point out the main areas to read first.

Explain this codebase. Point me to the main entry points, key modules, and anything I should read before making changes.

[Cursor LogoTry in Cursor](cursor://anysphere.cursor-deeplink/prompt?text=Explain%20this%20codebase.%20Point%20me%20to%20the%20main%20entry%20points%2C%20key%20modules%2C%20and%20anything%20I%20should%20read%20before%20making%20changes.)

Cursor will search your repo, read relevant files, and summarize how the project fits together. This is one of the fastest ways to get oriented in an unfamiliar codebase.

Want a deeper walkthrough? See [Understand your codebase](https://cursor.com/learn/understanding-your-codebase).

3

### Make one small change

Once you understand the project, ask Cursor to suggest a few safe improvements. Pick one and ask it to make the change.

Suggest three small, safe improvements in this codebase. Explain the tradeoffs and wait for me to choose one.

[Cursor LogoTry in Cursor](cursor://anysphere.cursor-deeplink/prompt?text=Suggest%20three%20small%2C%20safe%20improvements%20in%20this%20codebase.%20Explain%20the%20tradeoffs%20and%20wait%20for%20me%20to%20choose%20one.)

Good first tasks are low risk, like improving some copywriting or fixing small UI issues.

If you already know what you want to change, ask for it directly and describe the result you want.

4

### Review the diff and verify the result

Now you can watch Cursor work. The diff view shows changes made by the agent.

When it finishes, review the diff and ask Cursor to run the checks your project already uses. That can mean tests, the type checker, linting, or a local build.

Want a stronger review workflow? See [Reviewing and testing code](https://cursor.com/learn/reviewing-testing).

5

### Use Plan Mode for bigger changes

Now that you know the basics, use Plan Mode for bigger changes. It works well when the task spans multiple files, needs research, or needs approval before coding.

Press `Shift+Tab` in the agent input to toggle **Plan Mode**. Instead of writing code right away, Cursor will:

1. Research your codebase to find relevant files
2. Ask clarifying questions about your requirements
3. Create a detailed implementation plan
4. Wait for your approval before building

For a deeper walkthrough, see [Build new features](https://cursor.com/learn/creating-features).

## [Next steps](https://cursor.com/docs/get-started/quickstart\#next-steps)

[Agent Overview\\
\\
Learn about Agent's tools and capabilities](https://cursor.com/docs/agent/overview) [Rules\\
\\
Create persistent instructions for your project](https://cursor.com/docs/rules) [Understand your code\\
\\
Learn how to get oriented in an unfamiliar repo](https://cursor.com/learn/understanding-your-codebase) [Build new features\\
\\
See a full workflow for shipping larger changes](https://cursor.com/learn/creating-features)

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