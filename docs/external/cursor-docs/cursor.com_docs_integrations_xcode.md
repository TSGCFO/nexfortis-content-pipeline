<!-- Source: https://cursor.com/docs/integrations/xcode -->
<!-- Title: Xcode | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/integrations/xcode#main-content)

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

Integrations

# Xcode

Xcode 26.3+ exposes a built-in [MCP](https://cursor.com/docs/mcp) server that gives Cursor direct access to your Xcode projects. Cursor's agent can read and edit files, trigger builds, run tests, capture SwiftUI previews, and search Apple's documentation; all without leaving your editor.

This works through `xcrun mcpbridge`, a binary Apple ships with Xcode that translates MCP protocol messages into Xcode's internal XPC layer. You configure it once, and Cursor treats Xcode's 20 built-in tools like any other MCP server.

## [Prerequisites](https://cursor.com/docs/integrations/xcode\#prerequisites)

- macOS with Xcode 26.3 or later installed
- A paid [Cursor plan](https://cursor.com/docs/models-and-pricing)
- An Xcode project open in Xcode (Xcode must be running)

### [Enable MCP in Xcode](https://cursor.com/docs/integrations/xcode\#enable-mcp-in-xcode)

Before Cursor can connect, turn on Xcode's MCP bridge:

1

### Open Xcode settings

Go to **Xcode > Settings > Intelligence**.

2

### Enable MCP

Under **Model Context Protocol**, toggle **Xcode Tools** on.

## [Set up Cursor](https://cursor.com/docs/integrations/xcode\#set-up-cursor)

Pick whichever method suits your workflow.

### [Option 1: MCP settings UI](https://cursor.com/docs/integrations/xcode\#option-1-mcp-settings-ui)

1

### Open MCP settings

Go to **Cursor Settings > Features > MCP**.

2

### Add the server

Click **Add New MCP Server**. Set the transport to **stdio**, name it `xcode-tools`, and enter `xcrun mcpbridge` as the command.

### [Option 2: `mcp.json`](https://cursor.com/docs/integrations/xcode\#option-2-mcpjson)

Add an entry to your [MCP config file](https://cursor.com/docs/mcp#configuration-locations):

~/.cursor/mcp.json

```
{
  "mcpServers": {
    "xcode-tools": {
      "command": "xcrun",
      "args": ["mcpbridge"]
    }
  }
}
```

### [Option 3: Cursor CLI](https://cursor.com/docs/integrations/xcode\#option-3-cursor-cli)

If you use the [Cursor CLI](https://cursor.com/docs/cli/overview), register the server from your terminal:

```
agent mcp add xcode-tools -- xcrun mcpbridge
```

The CLI shares the same MCP config as the editor, so the server appears in both.

## [Available tools](https://cursor.com/docs/integrations/xcode\#available-tools)

Xcode exposes 20 MCP tools across five categories:

### [File operations](https://cursor.com/docs/integrations/xcode\#file-operations)

- **XcodeRead** \- Read file contents (up to 600 lines per call, with offset/limit for larger files)
- **XcodeWrite** \- Create or overwrite files
- **XcodeUpdate** \- Apply targeted edits to existing files
- **XcodeGrep** \- Search file contents with regex
- **XcodeGlob** \- Find files by pattern
- **XcodeLS** \- List directory contents
- **XcodeMakeDir** \- Create directories
- **XcodeRM** \- Remove files or directories
- **XcodeMV** \- Move or rename files

### [Build and test](https://cursor.com/docs/integrations/xcode\#build-and-test)

- **BuildProject** \- Build the active scheme
- **GetBuildLog** \- Retrieve build logs, filterable by severity, regex, or file glob
- **RunAllTests** \- Run the full test suite
- **RunSomeTests** \- Run specific test classes or methods
- **GetTestList** \- List available tests

### [Diagnostics](https://cursor.com/docs/integrations/xcode\#diagnostics)

- **XcodeListNavigatorIssues** \- Show warnings and errors from the Issue Navigator
- **XcodeRefreshCodeIssuesInFile** \- Re-check a file for code issues

### [Intelligence](https://cursor.com/docs/integrations/xcode\#intelligence)

- **RenderPreview** \- Capture a screenshot of a SwiftUI preview
- **DocumentationSearch** \- Semantic search across Apple's documentation and WWDC transcripts
- **ExecuteSnippet** \- Run a Swift code snippet

### [Workspace](https://cursor.com/docs/integrations/xcode\#workspace)

- **XcodeListWindows** \- List open Xcode windows and tabs

## [Example workflow](https://cursor.com/docs/integrations/xcode\#example-workflow)

A typical Cursor + Xcode workflow looks like this:

1. Open your project in both Cursor and Xcode
2. Ask Cursor's agent to add a feature or fix a bug
3. The agent uses **XcodeRead** and **XcodeGrep** to understand your code
4. It edits files with **XcodeWrite** or **XcodeUpdate**
5. It runs **BuildProject** to check for errors, reads results with **GetBuildLog**
6. It runs tests with **RunSomeTests** to verify the change
7. It captures a SwiftUI preview with **RenderPreview** to confirm the UI

You stay in Cursor the whole time. Xcode handles compilation, testing, and previews in the background.

## [Cursor CLI with Xcode](https://cursor.com/docs/integrations/xcode\#cursor-cli-with-xcode)

The [Cursor CLI](https://cursor.com/docs/cli/overview) also works with Xcode's MCP tools. This is useful for headless workflows, CI pipelines, or terminal-first developers.

```
# Run agent with Xcode tools available
agent "Add unit tests for the NetworkManager class"
```

The agent picks up the `xcode-tools` MCP server from your config and uses the same tools available in the editor.

## [Troubleshooting](https://cursor.com/docs/integrations/xcode\#troubleshooting)

### Cursor can't find the xcode-tools server

Make sure Xcode is running with a project open. The `xcrun mcpbridge` process needs an active Xcode session to communicate with.

### Tools show errors about missing tabIdentifier

Some Xcode MCP tools need a workspace context. Confirm you have a project or workspace open in Xcode, not an empty window.

### Build or test tools time out

Large projects take longer to build. Check Xcode's build progress directly. The MCP bridge waits for Xcode's response, so timeouts usually mean the underlying operation is still running.

### MCP toggle missing in Xcode settings

You need Xcode 26.3 or later. Check your version under **Xcode > About Xcode** and update through the Mac App Store or [Apple Developer downloads](https://developer.apple.com/download/).

### xcrun: error: unable to find utility "mcpbridge"

Your system is pointed at Command Line Tools instead of the full Xcode installation. Fix this by running:

```
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -runFirstLaunch
```

Then confirm the bridge is available:

```
xcrun --find mcpbridge
```

This should return a file path, not an error. Once it does, open Xcode with your project, go to **Settings > Intelligence > Model Context Protocol**, and enable **Allow external agents**. Then toggle the Xcode MCP server back on in Cursor settings. You should see a permission dialog in Xcode confirming the connection.

## [Related](https://cursor.com/docs/integrations/xcode\#related)

[MCP overview\\
\\
Complete MCP guide with setup, configuration, and authentication](https://cursor.com/docs/mcp) [iOS & macOS (Swift)\\
\\
Swift development workflow with Cursor, Sweetpad, and Xcode Build Server](https://cursor.com/for/ios-macos-swift) [Cursor CLI\\
\\
Use Cursor's agent from the terminal](https://cursor.com/docs/cli/overview) [CLI MCP commands\\
\\
Manage MCP servers from the command line](https://cursor.com/docs/cli/mcp)

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