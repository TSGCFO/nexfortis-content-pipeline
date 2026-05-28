<!-- Source: https://cursor.com/docs/extension-api -->
<!-- Title: Extension API reference | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/extension-api#main-content)

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

# Extension API reference

Cursor exposes extension APIs under `vscode.cursor` for programmatic configuration. Use these APIs from VS Code extensions to register MCP servers and plugin paths without editing config files.

## [Type definitions](https://cursor.com/docs/extension-api\#type-definitions)

Copy this `declare module` block into your extension project for type checking:

```
declare module "vscode" {
  export namespace cursor {
    export namespace mcp {
      export interface StdioServerConfig {
        name: string;
        server: {
          command: string;
          args: string[];
          env: Record<string, string>;
        };
      }

      export interface RemoteServerConfig {
        name: string;
        server: {
          url: string;
          /**
           * Optional HTTP headers to include with every request to this server
           * (e.g. for authentication).
           */
          headers?: Record<string, string>;
        };
      }

      export type ExtMCPServerConfig = StdioServerConfig | RemoteServerConfig;

      /**
       * Register an MCP server that Cursor can communicate with.
       * Supports HTTP(S) (SSE/streamable HTTP) and local stdio processes.
       */
      export const registerServer: (config: ExtMCPServerConfig) => void;
      export const unregisterServer: (serverName: string) => void;
    }

    export namespace plugins {
      /**
       * Register a directory as a plugin source. Cursor discovers and loads
       * any valid plugins in this directory.
       */
      export const registerPath: (path: string) => void;
      export const unregisterPath: (path: string) => void;
    }
  }
}
```

## [MCP servers](https://cursor.com/docs/extension-api\#mcp-servers)

Register and manage MCP servers at runtime. This is useful for enterprise environments, onboarding tools, and automated setup workflows where editing `mcp.json` isn't practical.

### [`vscode.cursor.mcp.registerServer`](https://cursor.com/docs/extension-api\#vscodecursormcpregisterserver)

Registers an MCP server.

**Signature:**

```
vscode.cursor.mcp.registerServer(config: ExtMCPServerConfig): void
```

**Parameters:**

- `config: ExtMCPServerConfig` \- The server configuration object

### [`vscode.cursor.mcp.unregisterServer`](https://cursor.com/docs/extension-api\#vscodecursormcpunregisterserver)

Unregisters a previously registered MCP server.

**Signature:**

```
vscode.cursor.mcp.unregisterServer(serverName: string): void
```

**Parameters:**

- `serverName: string` \- The name of the server to unregister

### [Configuration types](https://cursor.com/docs/extension-api\#configuration-types)

#### [HTTP/SSE server](https://cursor.com/docs/extension-api\#httpsse-server)

For servers running on HTTP or Server-Sent Events:

```
interface RemoteServerConfig {
  name: string;
  server: {
    url: string;
    headers?: Record<string, string>;
  };
}
```

**Properties:**

- `name`: Unique identifier for the server
- `server.url`: The HTTP endpoint URL
- `server.headers` (optional): HTTP headers for authentication or other purposes

#### [Stdio server](https://cursor.com/docs/extension-api\#stdio-server)

For local servers communicating via standard input/output:

```
interface StdioServerConfig {
  name: string;
  server: {
    command: string;
    args: string[];
    env: Record<string, string>;
  };
}
```

**Properties:**

- `name`: Unique identifier for the server
- `server.command`: The executable command
- `server.args`: Command line arguments
- `server.env`: Environment variables

### [MCP examples](https://cursor.com/docs/extension-api\#mcp-examples)

#### [HTTP/SSE server](https://cursor.com/docs/extension-api\#httpsse-server-1)

Register a remote MCP server with authentication:

```
vscode.cursor.mcp.registerServer({
  name: "my-remote-server",
  server: {
    url: "https://api.example.com/mcp",
    headers: {
      Authorization: "Bearer your-token-here",
      "X-API-Key": "your-api-key",
    },
  },
});
```

#### [Stdio server](https://cursor.com/docs/extension-api\#stdio-server-1)

Register a local MCP server:

```
vscode.cursor.mcp.registerServer({
  name: "my-local-server",
  server: {
    command: "python",
    args: ["-m", "my_mcp_server"],
    env: {
      API_KEY: "your-api-key",
      DEBUG: "true",
    },
  },
});
```

#### [Node.js server](https://cursor.com/docs/extension-api\#nodejs-server)

Register a Node.js-based MCP server:

```
vscode.cursor.mcp.registerServer({
  name: "nodejs-server",
  server: {
    command: "npx",
    args: ["-y", "@company/mcp-server"],
    env: {
      NODE_ENV: "production",
      CONFIG_PATH: "/path/to/config",
    },
  },
});
```

#### [Unregister a server](https://cursor.com/docs/extension-api\#unregister-a-server)

```
vscode.cursor.mcp.unregisterServer("my-remote-server");
```

#### [Conditional registration](https://cursor.com/docs/extension-api\#conditional-registration)

```
if (!isServerRegistered("my-server")) {
  vscode.cursor.mcp.registerServer({
    name: "my-server",
    server: {
      url: "https://api.example.com/mcp",
    },
  });
}
```

## [Plugin paths](https://cursor.com/docs/extension-api\#plugin-paths)

Register additional plugin directories at runtime. Extensions can use this API to tell Cursor about plugin locations without requiring users to manually copy files to `~/.cursor/plugins/local/`.

A `.cursor-plugin/plugin.json` manifest is optional. Without one, Cursor uses [automatic folder-based discovery](https://cursor.com/docs/reference/plugins#component-discovery) and picks up components from default locations: `rules/`, `skills/`, `agents/`, `commands/`, `mcp.json`, and `hooks/hooks.json`. For example, to inject skills you can register a directory that contains a `skills/` subfolder; no manifest needed.

```
my-extension/cursor-plugins/team-tools/
├── skills/
│   └── deploy-helper/
│       └── SKILL.md
└── rules/
    └── coding-standards.mdc
```

For the full manifest schema and all component formats, see the [Plugins guide](https://cursor.com/docs/plugins#creating-plugins) and the [Plugins reference](https://cursor.com/docs/reference/plugins).

### [`vscode.cursor.plugins.registerPath`](https://cursor.com/docs/extension-api\#vscodecursorpluginsregisterpath)

Registers a directory path as a plugin source. Cursor loads any valid plugins found in the directory.

**Signature:**

```
vscode.cursor.plugins.registerPath(path: string): void
```

**Parameters:**

- `path: string` \- Absolute filesystem path to a directory containing plugins

### [`vscode.cursor.plugins.unregisterPath`](https://cursor.com/docs/extension-api\#vscodecursorpluginsunregisterpath)

Removes a previously registered plugin path.

**Signature:**

```
vscode.cursor.plugins.unregisterPath(path: string): void
```

**Parameters:**

- `path: string` \- The path to unregister

### [Plugin path examples](https://cursor.com/docs/extension-api\#plugin-path-examples)

#### [Register a bundled plugin directory](https://cursor.com/docs/extension-api\#register-a-bundled-plugin-directory)

An extension can bundle plugins and register them on activation:

```
import * as vscode from "vscode";
import * as path from "path";

export function activate(context: vscode.ExtensionContext) {
  const pluginsDir = path.join(context.extensionPath, "cursor-plugins");
  vscode.cursor.plugins.registerPath(pluginsDir);

  context.subscriptions.push({
    dispose: () => vscode.cursor.plugins.unregisterPath(pluginsDir),
  });
}
```

#### [Register a workspace-relative path](https://cursor.com/docs/extension-api\#register-a-workspace-relative-path)

Point Cursor at a shared plugin directory in a monorepo:

```
const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
if (workspaceRoot) {
  vscode.cursor.plugins.registerPath(
    path.join(workspaceRoot, ".cursor-plugins")
  );
}
```

#### [Unregister a plugin path](https://cursor.com/docs/extension-api\#unregister-a-plugin-path)

```
vscode.cursor.plugins.unregisterPath("/path/to/plugins");
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