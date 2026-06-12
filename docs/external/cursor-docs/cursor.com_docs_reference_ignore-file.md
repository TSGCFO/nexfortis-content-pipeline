<!-- Source: https://cursor.com/docs/reference/ignore-file -->
<!-- Title: Ignore File | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/reference/ignore-file#main-content)

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

# Ignore file

Cursor reads and indexes your project's codebase to power its features. Control which directories and files Cursor can access using a `.cursorignore` file in your root directory.

Cursor blocks access to files listed in `.cursorignore` from:

- Semantic search
- Code accessible by Tab, [Agent](https://cursor.com/docs/agent/overview), and Inline Edit
- Code accessible via [@ mention references](https://cursor.com/docs/agent/prompting)

The terminal and MCP server tools used by Agent cannot block access to code
governed by `.cursorignore`

## [Why ignore files?](https://cursor.com/docs/reference/ignore-file\#why-ignore-files)

**Security**: Restrict access to API keys, credentials, and secrets. While Cursor blocks ignored files, complete protection isn't guaranteed due to LLM unpredictability.

**Performance**: In large codebases or monorepos, exclude irrelevant portions for faster indexing and more accurate file discovery.

## [Configuring `.cursorignore`](https://cursor.com/docs/reference/ignore-file\#configuring-cursorignore)

Create a `.cursorignore` file in your root directory using `.gitignore` syntax.

### [Pattern syntax](https://cursor.com/docs/reference/ignore-file\#pattern-syntax)

- `*` matches any characters except `/`
- `**` matches any characters including `/`
- `?` matches a single character
- `!` negates a pattern (un-ignores a previously ignored path)
- Lines starting with `#` are comments
- Trailing spaces are ignored unless escaped with `\`

### [Pattern examples](https://cursor.com/docs/reference/ignore-file\#pattern-examples)

```
config.json      # Specific filedist/           # Directory*.log           # File extension**/logs         # Nested directories!app/           # Exclude from ignore (negate)
```

### [Hierarchical ignore](https://cursor.com/docs/reference/ignore-file\#hierarchical-ignore)

Enable `Cursor Settings` \> `Features` \> `Editor` \> `Hierarchical Cursor Ignore` to search parent directories for `.cursorignore` files.

## [Global ignore files](https://cursor.com/docs/reference/ignore-file\#global-ignore-files)

Set ignore patterns for all projects in user settings to exclude sensitive files without per-project configuration. The global ignore list is empty by default.

Common patterns to add:

- Environment files: `**/.env`, `**/.env.*`
- Credentials: `**/credentials.json`, `**/secrets.json`
- Keys: `**/*.key`, `**/*.pem`, `**/id_rsa`

## [`.cursorindexingignore`](https://cursor.com/docs/reference/ignore-file\#cursorindexingignore)

Use `.cursorindexingignore` to exclude files from indexing only. These files remain accessible to AI features but won't appear in codebase searches. Use this for large generated files or vendored dependencies that shouldn't appear in search results.

## [Files ignored by default](https://cursor.com/docs/reference/ignore-file\#files-ignored-by-default)

Cursor automatically ignores files in `.gitignore` and the default ignore list below. Override with `!` prefix in `.cursorignore`.

### Default ignore list

For indexing only, these files are ignored in addition to files in your `.gitignore`, `.cursorignore` and `.cursorindexingignore`:

```
package-lock.jsonpnpm-lock.yamlyarn.lockcomposer.lockGemfile.lockbun.lockb.env*.git/.svn/.hg/*.lock*.bak*.tmp*.bin*.exe*.dll*.so*.lockb*.qwoff*.isl*.csv*.pdf*.doc*.doc*.xls*.xlsx*.ppt*.pptx*.odt*.ods*.odp*.odg*.odf*.sxw*.sxc*.sxi*.sxd*.sdc*.jpg*.jpeg*.png*.gif*.bmp*.tif*.mp3*.wav*.wma*.ogg*.flac*.aac*.mp4*.mov*.wmv*.flv*.avi*.zip*.tar*.gz*.7z*.rar*.tgz*.dmg*.iso*.cue*.mdf*.mds*.vcd*.toast*.img*.apk*.msi*.cab*.tar.gz*.tar.xz*.tar.bz2*.tar.lzma*.tar.Z*.tar.sz*.lzma*.ttf*.otf*.pak*.woff*.woff2*.eot*.webp*.vsix*.rmeta*.rlib*.parquet*.svg.egg-info/.venv/node_modules/__pycache__/.next/.nuxt/.cache/.sass-cache/.gradle/.DS_Store/.ipynb_checkpoints/.pytest_cache/.mypy_cache/.tox/.git/.hg/.svn/.bzr/.lock-wscript/.Python/.jupyter/.history/.yarn/.yarn-cache/.eslintcache/.parcel-cache/.cache-loader/.nyc_output/.node_repl_history/.pnp.js/.pnp/
```

### [Negation pattern limitations](https://cursor.com/docs/reference/ignore-file\#negation-pattern-limitations)

When using negation patterns (prefixed with `!`), you cannot re-include a file if a parent directory is excluded via \*.

```
# Ignore all files in public folderpublic/*# This works, as the file exists at the top level!public/index.html# This doesn't work - cannot re-include files from nested directories!public/assets/style.css
```

**Workaround**: Explicitly exclude nested directories:

```
public/assets/*!public/assets/style.css # This file is now accessible
```

Excluded directories are not traversed for performance, so patterns on contained files have no effect.
This matches the .gitignore implementation for negation patterns in nested directories. For more details, see the [official Git documentation on gitignore patterns](https://git-scm.com/docs/gitignore).

## [Troubleshooting](https://cursor.com/docs/reference/ignore-file\#troubleshooting)

Test patterns with `git check-ignore -v [file]`.

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