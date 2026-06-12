<!-- Source: https://cursor.com/docs/account/teams/analytics -->
<!-- Title: Analytics | Cursor Docs -->

[Skip to main content](https://cursor.com/docs/account/teams/analytics#main-content)

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

[Get Started](https://cursor.com/docs/account/teams/setup)

[Pricing](https://cursor.com/docs/account/teams/pricing)

[Members & Roles](https://cursor.com/docs/account/teams/members)

[SSO](https://cursor.com/docs/account/teams/sso)

[Dashboard](https://cursor.com/docs/account/teams/dashboard)

[Analytics](https://cursor.com/docs/account/teams/analytics)

Enterprise

Teams & Enterprise

# Usage Analytics

Usage Analytics are available for Team and Enterprise customers.

The Cursor [Web Dashboard](https://cursor.com/dashboard/analytics) provides usage analytics so you can understand how your team is using Cursor.

## [Data Access and Visibility](https://cursor.com/docs/account/teams/analytics\#data-access-and-visibility)

Team admins have access to data for themselves and all other users in the team. Team members without admin privileges can see data for themselves and in some cases (like the Usage Leaderboard) for select other users on the team.

Analytics data is collected only from users running client version 1.5 or higher.

### [CSV Download](https://cursor.com/docs/account/teams/analytics\#csv-download)

Each chart has a button on the bottom-right corner which allows for CSV download of visible data. Additionally, users can download data for all charts by clicking the download icon in the page header.

### [API Access](https://cursor.com/docs/account/teams/analytics\#api-access)

See our [Admin API documentation](https://cursor.com/docs/account/teams/analytics-api) to access analytics data programmatically. Available only for Enterprise customers.

## [Filtering Data](https://cursor.com/docs/account/teams/analytics\#filtering-data)

Dashboard users can filter usage shown for specific users, [active directory groups](https://cursor.com/docs/account/teams/scim#managing-users-and-groups), and dates via the header. Filtering supports up to 10 users and 90 continuous days of data.

Clicking on the gear icon in the header allows users to select timezone as well as whether weekends are shown.

## [Tracking AI Code in Git Commits](https://cursor.com/docs/account/teams/analytics\#tracking-ai-code-in-git-commits)

Cursor keeps a log of the signature of every AI line (Tab or Agent) that is suggested to the user during their chat session.

These lines are stored and later compared to the signatures of each line in subsequent git commits that were written by the same author. Cursor will detect all the line changes (additions or deletions) written by the Cursor Agent or Tab, and attribute the line as being written by AI.

All the AI detection is done on device, and never leaves the user's computer. We store the line counts as metadata and make them available via API or in the Analytics Dashboard.

#### [Known Limitations:](https://cursor.com/docs/account/teams/analytics\#known-limitations)

- Diff signatures may be invalidated if automated code formatting is modifying lines.

- AI Code Tracking has not been implemented for Background Agents, or the Cursor CLI yet.

- All code signatures are stored on-device. The git commit must be scored on the same machine as the AI code was authored.


## [AI Output](https://cursor.com/docs/account/teams/analytics\#ai-output)

### [AI Share of Committed Code](https://cursor.com/docs/account/teams/analytics\#ai-share-of-committed-code)

![AI Share of Committed Code chart](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Faccount%2Fteam%2Fanalytics%2Fai-share-committed-code.png&w=1920&q=75&dpl=dpl_GncwoURS8Y1xqd6VWLEyZJaQzLkP)

AI Share of Committed Code shows the lines of code changed in commits to your repositories, and what % of that code was generated by Cursor. Users can filter for production branch, which will use:

- The optional default branch set to the git repo

- Fallback to common default branch names such as: `main`, `master`, `production`, `prod`.


We use the following definitions:

- **Cursor AI**: Any line that can be attributed to Cursor Agent or Tab based on diff signatures.

- **Other**: Any line of code that can't be detected as being written by Cursor


### [Agent Edits](https://cursor.com/docs/account/teams/analytics\#agent-edits)

![Agent Edits chart](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Faccount%2Fteam%2Fanalytics%2Fagent-edits.png&w=1920&q=75&dpl=dpl_GncwoURS8Y1xqd6VWLEyZJaQzLkP)

Agent Edits shows the amount of code edited by the Agent, and Cmd+K, and whether those changes were accepted by the user. Viewers can group the data by suggested / accepted or by file extension.

### [Tab Completions](https://cursor.com/docs/account/teams/analytics\#tab-completions)

![Tab Completions chart](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Faccount%2Fteam%2Fanalytics%2Ftab-completions.png&w=1920&q=75&dpl=dpl_GncwoURS8Y1xqd6VWLEyZJaQzLkP)

Tab Completions shows the number of times Tab code has been suggested (and accepted) by users. The unit is Tab suggestions, regardless of lines of code changed in that suggestion.

You can access the number of lines of code suggested by Tab through the [Analytics API](https://cursor.com/docs/account/teams/analytics-api).

### [Messages Sent](https://cursor.com/docs/account/teams/analytics\#messages-sent)

![Messages Sent chart](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Faccount%2Fteam%2Fanalytics%2Fmessages-sent.png&w=1920&q=75&dpl=dpl_GncwoURS8Y1xqd6VWLEyZJaQzLkP)

Messages Sent shows the number of messages sent by users to Cursor. Users can filter this data by the mode (e.g., Agent, Ask, Cmd+K) or by models used.

## [Active Users](https://cursor.com/docs/account/teams/analytics\#active-users)

![Active Users chart](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Faccount%2Fteam%2Fanalytics%2Factive-users.png&w=1920&q=75&dpl=dpl_GncwoURS8Y1xqd6VWLEyZJaQzLkP)

The Active Users chart shows the number of unique active Cursor users in your team across different products. A user is defined as active in a period if they use at least one AI feature (Tab, Agent, Background Agent, CLI). Bugbot users are synced to Github accounts (not Cursor) and therefore not included in the `All` active user rollup.

## [Daily Usage](https://cursor.com/docs/account/teams/analytics\#daily-usage)

![Daily Usage chart](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Faccount%2Fteam%2Fanalytics%2Fdaily-usage.png&w=1920&q=75&dpl=dpl_GncwoURS8Y1xqd6VWLEyZJaQzLkP)

The Daily Usage chart visualizes Cursor activity over the preceding 365 days.

Users can toggle to see this view by:

- **All**: shows lines of code edits suggested by AI in Cursor (Tab and Agent).

- **Tab:** shows the number of suggestions made by Tab.

- **Agent:** shows lines of code suggested by Agent.

- **DAU**: shows daily active users across all Cursor products.


Data collection for this chart starts in early September for customers on the 1.5+ desktop release.

## [Usage Leaderboard](https://cursor.com/docs/account/teams/analytics\#usage-leaderboard)

![Usage Leaderboard chart](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Faccount%2Fteam%2Fanalytics%2Fusage-leaderboard.png&w=1920&q=75&dpl=dpl_GncwoURS8Y1xqd6VWLEyZJaQzLkP)

The Usage Leaderboard shows top Cursor users across your team alongside their favorite model and select usage stats for the selected time period.

We provide the following metrics:

- **Chats**: number of messages sent by the user in the chat interface (Agent, Plan Mode, Ask Mode, etc).

- **Tab Completions**: number of Tab suggestions accepted by the user.

- **Agent Lines of Code:** Lines of code written by the Agent and accepted by the user.


The top ten users and any filtered users are always shown. All users in the team are able to view the leaderboard.

## [Repository Insights](https://cursor.com/docs/account/teams/analytics\#repository-insights)

![Repository Insights chart](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Faccount%2Fteam%2Fanalytics%2Frepository-insights.png&w=1920&q=75&dpl=dpl_GncwoURS8Y1xqd6VWLEyZJaQzLkP)

Repository Insights allow you to see how Cursor is used across different repositories. We report on:

- **AI Lines of Code Committed**: Code written by Cursor (Tab and Agent) that was committed by a user.

- **Total Lines of Code Committed**: All code committed by users.

- **Code Committed by AI %**: The % of lines of code committed that were edited by Cursor (Tab and Agent).


Some commits will be associated with `Unknown` repository if the user makes commits to a local git repository that doesn't contain a remote origin, or a remote that couldn't be resolved by Cursor

## [Conversation Insights](https://cursor.com/docs/account/teams/analytics\#conversation-insights)

Conversation Insights is enabled by default for Enterprise customers. You can disable it via **Disable Conversation Insights** in team settings.

Cursor analyzes the code and context in each agent session to understand what kind of work is occurring. This makes Cursor the first self-aware software engineering platform, synthesizing the type of work happening across your team.

Teams no longer need high-toil, lossy analysis of tickets or low-response surveys to understand engineering work. Conversation Insights lets you deeply understand the type of work being done with Cursor.

![Conversation Insights dashboard showing categories and work type charts](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Faccount%2Fteam%2Fanalytics%2Fconversation-insights-dashboard.png&w=1920&q=75&dpl=dpl_GncwoURS8Y1xqd6VWLEyZJaQzLkP)

### [Classification Dimensions](https://cursor.com/docs/account/teams/analytics\#classification-dimensions)

Conversation Insights classifies work across these dimensions:

- **Category**: Bug Fixing & Debugging, Code Refactoring, Code Explanation, Configuration, New Features, UI/Styling, Architecture, Data/Database, Documentation, DevOps/Deployment, Learning, Testing

- **Work Type**: Maintenance (KTLO), Bug Fixing, New Features

- **Complexity**: Distinguishes between the complexity of tasks teams assign to agents

- **Specificity**: Measures how specific the prompts developers use with agents are


Enterprise customers can extend these default categories or define their own across the organization or within specific teams.

### [Compare](https://cursor.com/docs/account/teams/analytics\#compare)

Compare allows you to select and compare usage across teams and individual developers within your organization. Use this to identify adoption patterns, find power users, and understand how different groups use Cursor.

### [Privacy and Data Handling](https://cursor.com/docs/account/teams/analytics\#privacy-and-data-handling)

All classification runs on-device. Default classifiers ensure no PII or sensitive data leaves the machine. The model outputs are validated against expected values. Any responses that don't match are discarded.

### [Pricing](https://cursor.com/docs/account/teams/analytics\#pricing)

Conversation Insights is free during the preview period. Starting January 1st, 2026, customers will be charged for inference plus the Cursor Token Rate.

## [Cloud Agent Usage](https://cursor.com/docs/account/teams/analytics\#cloud-agent-usage)

### [Agents Created](https://cursor.com/docs/account/teams/analytics\#agents-created)

![Agents Created chart](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Faccount%2Fteam%2Fanalytics%2Fagents-created.png&w=1920&q=75&dpl=dpl_GncwoURS8Y1xqd6VWLEyZJaQzLkP)

Agents Created shows Cloud Agent usage by the originating source. Each time a Cloud Agent starts up counts as one Agent.

### [Pull Requests](https://cursor.com/docs/account/teams/analytics\#pull-requests)

![Pull Requests chart](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Faccount%2Fteam%2Fanalytics%2Fpull-requests.png&w=1920&q=75&dpl=dpl_GncwoURS8Y1xqd6VWLEyZJaQzLkP)

Pull Requests shows Pull Requests Opened and Merged that originate from Cloud Agents.

### [Lines of Code](https://cursor.com/docs/account/teams/analytics\#lines-of-code)

![Lines of Code chart](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Faccount%2Fteam%2Fanalytics%2Flines-of-code.png&w=1920&q=75&dpl=dpl_GncwoURS8Y1xqd6VWLEyZJaQzLkP)

Lines of Code shows code written and merged by Cloud Agents.

## [Cloud Agent Top Repositories](https://cursor.com/docs/account/teams/analytics\#cloud-agent-top-repositories)

![Cloud Agent Top Repositories chart](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Faccount%2Fteam%2Fanalytics%2Fcloud-agent-top-repositories.png&w=1920&q=75&dpl=dpl_GncwoURS8Y1xqd6VWLEyZJaQzLkP)

Cloud Agent Top Repositories shows repositories by number of Pull Requests opened and merged.

## [Top Cloud Agent Users](https://cursor.com/docs/account/teams/analytics\#top-cloud-agent-users)

![Top Cloud Agent Users chart](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Faccount%2Fteam%2Fanalytics%2Ftop-cloud-agent-users.png&w=1920&q=75&dpl=dpl_GncwoURS8Y1xqd6VWLEyZJaQzLkP)

Top Cloud Agent Users shows top users by number of Agents Created. Viewers can also view data by Pull Requests opened and merged.

## [Client Versions](https://cursor.com/docs/account/teams/analytics\#client-versions)

![Client Versions chart](https://cursor.com/docs-static/_next/image?url=%2Fdocs-static%2Fimages%2Faccount%2Fteam%2Fanalytics%2Fclient-versions.png&w=1920&q=75&dpl=dpl_GncwoURS8Y1xqd6VWLEyZJaQzLkP)

Client Versions shows which versions of the Cursor editor your team is using. Each user's version is the Cursor version they last opened during that day.

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