<!-- Source: https://cursor.com/docs/agent/tools/browser -->
<!-- Title: Browser | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/agent/tools/browser#main-content)

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

# Browser

Agent can control a web browser to test applications, visually edit layouts and styles, audit accessibility, convert designs into code, and more. With full access to console logs and network traffic, Agent can debug issues and automate comprehensive testing workflows.

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

Enter fullscreen modeExit fullscreen mode![](https://image.mux.com/SUtXsaFq4FV5xh5014P5wAU163tGojX4zoHQH009jWAbI/thumbnail.webp)

For enterprise customers, browser controls are governed by MCP allowlist or denylist.

## [Native integration](https://cursor.com/docs/agent/tools/browser\#native-integration)

Agent displays browser actions like screenshots and actions in the chat, as well as the browser window itself either in a separate window or an inline pane.

We've optimized the browser tools to be more efficient and reduce token usage, as well as:

- **Efficient log handling**: Browser logs are written to files that Agent can grep and selectively read. Instead of summarizing verbose output after every action, Agent reads only the relevant lines it needs. This preserves full context while minimizing token usage.
- **Visual feedback with images**: Screenshots are integrated directly with the file reading tool, so Agent actually sees the browser state as images rather than relying on text descriptions. This enables better understanding of visual layouts and UI elements.
- **Smart prompting**: Agent receives additional context about browser logs, including total line counts and preview snippets, helping it make informed decisions about what to inspect.
- **Development server awareness**: Agent is prompted to detect running development servers and use the correct ports instead of starting duplicate servers or guessing port numbers.

You can use Browser without installing or configuring any external tools.

## [Browser capabilities](https://cursor.com/docs/agent/tools/browser\#browser-capabilities)

Agent has access to the following browser tools:

### Navigate

Visit URLs and browse web pages. Agent can navigate anywhere on the web by visiting URLs, following links, going back and forward in history, and refreshing pages.

### Click

Interact with buttons, links, and form elements. Agent can identify and interact with page elements, performing click, double-click, right-click, and hover actions on any visible element.

### Type

Enter text into input fields and forms. Agent can fill out forms, submit data, and interact with form fields, search boxes, and text areas.

### Scroll

Navigate through long pages and content. Agent can scroll to reveal additional content, find specific elements, and explore lengthy documents.

### Screenshot

Capture visual representations of web pages. Screenshots help Agent understand page layout, verify visual elements, and provide you with confirmation of browser actions.

### Console Output

Read browser console messages, errors, and logs. Agent can monitor JavaScript errors, debugging output, and network warnings to troubleshoot issues and verify page behavior.

### Network Traffic

Monitor HTTP requests and responses made by the page. Agent can track API calls, analyze request payloads, check response status codes, and diagnose network-related issues. This is currently only available in the Agent panel, coming soon to the layout.

## [Design sidebar](https://cursor.com/docs/agent/tools/browser\#design-sidebar)

The browser includes a design sidebar for modifying your site directly in Cursor. Design and code simultaneously with real-time visual adjustments.

![Browser design sidebar showing layout controls, positioning, and CSS properties for a selected element.](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Fagent%2Fbrowser-design-sidebar.png&w=1920&q=75&dpl=dpl_7DxwHyd7UKW9KS4SeE5G689Xzgui)

### [Visual editing capabilities](https://cursor.com/docs/agent/tools/browser\#visual-editing-capabilities)

The sidebar provides powerful visual editing controls:

- **Position and layout**: Move and rearrange elements on the page. Change flex direction, alignment, and grid layouts.
- **Dimensions**: Adjust width, height, padding, and margins with precise pixel values.
- **Colors**: Update colors from your design system or add new gradients. Access color tokens through a visual picker.
- **Appearance**: Experiment with shadows, opacity, and border radius using visual sliders.
- **Theme testing**: Test your designs across light and dark themes instantly.

### [Applying changes](https://cursor.com/docs/agent/tools/browser\#applying-changes)

When your visual adjustments match your vision, click the apply button to trigger an agent that updates your codebase. The agent translates your visual changes into the appropriate code modifications.

You can also select multiple elements across your site and describe changes in text. Agents kick off in parallel, and your changes appear live on the page after hot-reload.

## [Session persistence](https://cursor.com/docs/agent/tools/browser\#session-persistence)

Browser state persists between Agent sessions based on your workspace. This means:

- **Cookies**: Authentication cookies and session data remain available across browser sessions
- **Local Storage**: Data stored in `localStorage` and `sessionStorage` persists
- **IndexedDB**: Database content is retained between sessions

The browser context is isolated per workspace, ensuring that different projects maintain separate storage and cookie states.

## [Use cases](https://cursor.com/docs/agent/tools/browser\#use-cases)

### [Web development workflow](https://cursor.com/docs/agent/tools/browser\#web-development-workflow)

Browser integrates into web development workflows alongside tools like Figma and Linear. See the [Web Development cookbook](https://cursor.com/for/web-development) for a complete guide on using Browser with design systems, project management tools, and component libraries.

### [Accessibility improvements](https://cursor.com/docs/agent/tools/browser\#accessibility-improvements)

Agent can audit and improve web accessibility to meet WCAG compliance standards.

@browser Check color contrast ratios, verify semantic HTML and ARIA labels, test keyboard navigation, and identify missing alt text

[Cursor LogoTry in Cursor](cursor://anysphere.cursor-deeplink/prompt?text=%40browser%20Check%20color%20contrast%20ratios%2C%20verify%20semantic%20HTML%20and%20ARIA%20labels%2C%20test%20keyboard%20navigation%2C%20and%20identify%20missing%20alt%20text)

### [Automated testing](https://cursor.com/docs/agent/tools/browser\#automated-testing)

Agent can execute comprehensive test suites and capture screenshots for visual regression testing.

@browser Fill out forms with test data, click through workflows, test responsive designs, validate error messages, and monitor console for JavaScript errors

[Cursor LogoTry in Cursor](cursor://anysphere.cursor-deeplink/prompt?text=%40browser%20Fill%20out%20forms%20with%20test%20data%2C%20click%20through%20workflows%2C%20test%20responsive%20designs%2C%20validate%20error%20messages%2C%20and%20monitor%20console%20for%20JavaScript%20errors)

### [Design to code](https://cursor.com/docs/agent/tools/browser\#design-to-code)

Agent can convert designs into working code with responsive layouts.

@browser Analyze this design mockup, extract colors and typography, and generate pixel-perfect HTML and CSS code

[Cursor LogoTry in Cursor](cursor://anysphere.cursor-deeplink/prompt?text=%40browser%20Analyze%20this%20design%20mockup%2C%20extract%20colors%20and%20typography%2C%20and%20generate%20pixel-perfect%20HTML%20and%20CSS%20code)

### [Adjusting UI design from screenshots](https://cursor.com/docs/agent/tools/browser\#adjusting-ui-design-from-screenshots)

Agent can refine existing interfaces by identifying visual discrepancies and updating component styles.

@browser Compare current UI against this design screenshot and adjust spacing, colors, and typography to match

[Cursor LogoTry in Cursor](cursor://anysphere.cursor-deeplink/prompt?text=%40browser%20Compare%20current%20UI%20against%20this%20design%20screenshot%20and%20adjust%20spacing%2C%20colors%2C%20and%20typography%20to%20match)

## [Security](https://cursor.com/docs/agent/tools/browser\#security)

Browser runs as a secure web view and is controlled using an MCP server running as an extension. Multiple layers protect you from unauthorized access and malicious actions.
Cursor's Browser integrations have also been reviewed by multiple external security auditors.

### [Authentication and isolation](https://cursor.com/docs/agent/tools/browser\#authentication-and-isolation)

The browser implements several security measures:

- **Token authentication**: Agent layout generates a random authentication token before each browser session starts
- **Tab isolation**: Each browser tab receives a unique random ID to prevent cross-tab interference
- **Session-based security**: Tokens regenerate for each new browser session

### [Tool approval](https://cursor.com/docs/agent/tools/browser\#tool-approval)

Browser tools require your approval by default. Review each action before Agent executes it. This prevents unexpected navigation, data submission, or script execution.

You can configure approval settings in Agent Settings. Available modes:

| Mode | Description |
| --- | --- |
| **Manual approval** | Review and approve each browser action individually (recommended) |
| **Allow-listed actions** | Actions matching your allow list run automatically; others require approval |
| **Auto-run** | All browser actions execute immediately without approval (use with caution) |

### [Allow and block lists](https://cursor.com/docs/agent/tools/browser\#allow-and-block-lists)

Browser tools integrate with Cursor's [security guardrails](https://cursor.com/docs/agent/security). Configure which browser actions run automatically:

- **Allow list**: Specify trusted actions that skip approval prompts
- **Block list**: Define actions that should always be blocked
- Access settings through: **Cursor Settings > Agents > Auto-Run**

The allow/block list system provides best-effort protection. AI behavior can be unpredictable due to prompt injection and other issues. Review auto-approved actions regularly.

Never use auto-run mode with untrusted code or unfamiliar websites. Agent could execute malicious scripts or submit sensitive data without your knowledge.

### [Browser context](https://cursor.com/docs/agent/tools/browser\#browser-context)

The browser opens as a pane within Cursor, giving Agent full control through MCP tools.

## [Recommended models](https://cursor.com/docs/agent/tools/browser\#recommended-models)

We recommend using Sonnet 4.5, GPT-5, and Auto for the best performance.

## [Enterprise usage](https://cursor.com/docs/agent/tools/browser\#enterprise-usage)

For enterprise customers, browser functionality is managed through toggling availability under MCP controls. Admins have granular controls over each MCP server, as well as over browser access.

### [Enabling browser for enterprise](https://cursor.com/docs/agent/tools/browser\#enabling-browser-for-enterprise)

To enable browser capabilities for your enterprise team:

1. Navigate to your [Settings Dashboard](https://cursor.com/dashboard/settings)
2. Go to **MCP Configuration**
3. Toggle "browser features"

Once configured, users in your organization will have access to browser tools based on your MCP allowlist or denylist settings.

### [Origin allowlist](https://cursor.com/docs/agent/tools/browser\#origin-allowlist)

Enterprise administrators can configure an origin allowlist that restricts which sites the agent can automatically navigate to and where MCP tools can run. This provides granular control over browser access for security and compliance.

The Browser Origin Allowlist feature must be enabled for your organization before it appears in your dashboard. Contact your Cursor account team to request access.

#### [Configuration](https://cursor.com/docs/agent/tools/browser\#configuration)

To configure the origin allowlist:

1. Navigate to your [Admin Dashboard](https://cursor.com/dashboard/settings)
2. Go to **MCP Configuration**
3. Ensure **Enable Browser Automation Features (v2.0+)** is enabled
4. Under **Browser Origin Allowlist (v2.1+)**, click **Add Origin**
5. Enter the origins you want to allow (e.g., `*`, `http://localhost:3000`, `https://internal.example.com`)

Leave the allowlist empty to allow all origins. Each origin should be added separately using the Add Origin button.

![MCP Configuration showing Browser Origin Allowlist settings with Add Origin button](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Fagent%2Fbrowser-origin-allowlist.png&w=1920&q=75&dpl=dpl_7DxwHyd7UKW9KS4SeE5G689Xzgui)

#### [Behavior](https://cursor.com/docs/agent/tools/browser\#behavior)

When an origin allowlist is configured:

- **Automatic navigation**: The agent can only use the `browser_navigate` tool to visit URLs matching origins in the allowlist
- **MCP tool execution**: MCP tools can only run on origins that are in the allowlist
- **Manual navigation**: Users can still manually navigate the browser to any URL, including origins outside the allowlist (useful for viewing documentation or inspecting external sites)
- **Tool restrictions**: Once the browser is on an origin not in the allowlist, browser tools (click, type, navigate) are blocked, even if the user navigated there manually

#### [Edge cases](https://cursor.com/docs/agent/tools/browser\#edge-cases)

The origin allowlist provides best-effort protection. Be aware of these behaviors:

- **Link navigation**: If the agent clicks a link on an allowed domain that navigates to a non-allowed origin, the navigation will succeed
- **Redirects**: If the agent navigates to an allowed origin that subsequently redirects to a non-allowed origin, the redirect will be permitted
- **JavaScript navigation**: Client-side navigation (via `window.location` or similar) from an allowed origin to a non-allowed origin will succeed

The origin allowlist restricts automatic agent navigation but cannot prevent all navigation paths. Review your allowlist regularly and consider the security implications of allowing access to domains that may redirect or link to external sites.

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