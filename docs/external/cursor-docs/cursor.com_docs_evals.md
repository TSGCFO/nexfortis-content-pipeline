<!-- Source: https://cursor.com/docs/evals -->
<!-- Title: Run Cursor in your evals | Cursor Documentation -->

[Skip to main content](https://cursor.com/docs/evals#main-content)

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

# Run Cursor in your evals

Use the [Cursor SDK](https://cursor.com/docs/sdk/typescript) to run Cursor's agent loop inside your own eval harness. The same agent that powers the Cursor IDE, CLI, and web app is scriptable from TypeScript, so you can score Cursor Composer (and other models we support) on your benchmarks.

For example, benchmark authors like [Artificial Analysis](https://x.com/ArtificialAnlys/status/2057277363789197561), [SWE-rebench](https://swe-rebench.com/), and [Next.js Evals](https://nextjs.org/evals).

## [Why the SDK](https://cursor.com/docs/evals\#why-the-sdk)

Eval harnesses need a stable, programmatic interface to an agent: pass a task, get a transcript and final state, score the result. The SDK gives you that without shelling out to the CLI:

- **Real agent loop.** Tool calls, file edits, terminal commands, and reasoning run through the same code path as the product.
- **Composer-first, multi-model.** Composer 2 is the default to evaluate, but any model in Cursor's catalog works through the same API.
- **Local or sandboxed cloud runtime.** Run against a working tree on disk for fast iteration, or use Cursor's hosted VMs for isolated, parallel runs.
- **Structured streams and results.** Typed `SDKMessage` events, per-step deltas, and a final `RunResult` with model, duration, and git info.

For the full API surface, see the [Cursor SDK reference](https://cursor.com/docs/sdk/typescript).

## [Setup](https://cursor.com/docs/evals\#setup)

1

### Install the SDK

```
npm install @cursor/sdk
```

2

### Get an API key

Generate a key from [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations). Service account keys from [Team settings](https://cursor.com/dashboard/team-settings) also work.

```
export CURSOR_API_KEY="your-key"
```

3

### Pick a runtime

| Runtime | What it does | When to use |
| --- | --- | --- |
| **Local** | Runs the agent against a working tree on disk. | Reproducible repo-based tasks where you control the checkout. |
| **Cloud** | Runs in an isolated Cursor-hosted VM with the repo cloned in. | Parallel runs, untrusted code execution, or harnesses that don't have the repo locally. |

## [Evaluating Composer 2](https://cursor.com/docs/evals\#evaluating-composer-2)

A single-task eval against Composer 2 on a local working tree:

```
import { Agent } from "@cursor/sdk";const result = await Agent.prompt(  "Implement the failing tests in tests/string_utils.test.ts. Do not modify the tests.",  {    apiKey: process.env.CURSOR_API_KEY!,    model: { id: "composer-2" },    local: { cwd: "/path/to/task/checkout" },  },);console.log(result.status);     // "finished" | "error" | "cancelled"console.log(result.result);     // final assistant textconsole.log(result.durationMs); // wall-clock duration
```

`Agent.prompt()` creates an agent, sends one prompt, waits for the run to finish, and disposes. It's the right primitive for stateless eval tasks.

After the run completes, score the working tree with whatever your harness already uses (test runner, judge model, exact-match checker, etc.).

### [Streaming events for transcripts](https://cursor.com/docs/evals\#streaming-events-for-transcripts)

Most harnesses want the full transcript, not the final text. Open a long-lived agent and stream `SDKMessage` events:

```
import { Agent, type SDKMessage } from "@cursor/sdk";await using agent = await Agent.create({  apiKey: process.env.CURSOR_API_KEY!,  model: { id: "composer-2" },  local: { cwd: taskCwd },});const run = await agent.send(taskPrompt);const transcript: SDKMessage[] = [];for await (const event of run.stream()) {  transcript.push(event);  if (event.type === "assistant") {    for (const block of event.message.content) {      if (block.type === "text") process.stdout.write(block.text);    }  }  if (event.type === "tool_call" && event.status === "completed") {    console.log(`[tool] ${event.name}`);  }}const final = await run.wait();saveTranscript(transcript, final);
```

`run.stream()` yields typed events for assistant text, thinking, tool calls (start and completion), and lifecycle status. Final metadata (model, duration, git info) reads off the `Run` after the stream ends. See [Stream events](https://cursor.com/docs/sdk/typescript#stream-events) for the full event schema.

## [Evaluating other models](https://cursor.com/docs/evals\#evaluating-other-models)

The same harness code evaluates any model in Cursor's catalog. Swap the `id`:

```
const models = ["composer-2", "gpt-5.5", "claude-opus-4-8", "gemini-3.1-pro"];for (const id of models) {  const result = await Agent.prompt(taskPrompt, {    apiKey: process.env.CURSOR_API_KEY!,    model: { id },    local: { cwd: taskCwd },  });  recordScore(id, scoreTask(result));}
```

The agent loop, tool schema, prompts, and stream shape stay constant across models, so you measure model-level differences instead of harness drift. List supported ids with [`Cursor.models.list()`](https://cursor.com/docs/sdk/typescript#cursormodelslist).

## [Running tasks in parallel (cloud)](https://cursor.com/docs/evals\#running-tasks-in-parallel-cloud)

For large eval sets, run each task in an isolated cloud VM. The VM clones the repo, runs the agent, and surfaces git results back to your harness.

```
import { Agent } from "@cursor/sdk";async function runTask(task: EvalTask) {  await using agent = await Agent.create({    apiKey: process.env.CURSOR_API_KEY!,    model: { id: "composer-2" },    cloud: {      repos: [{ url: task.repoUrl, startingRef: task.baseRef }],    },  });  const run = await agent.send(task.prompt);  const result = await run.wait();  return {    taskId: task.id,    status: result.status,    branch: result.git?.branches[0]?.branch,    durationMs: result.durationMs,  };}const results = await Promise.all(tasks.map(runTask));
```

Each agent runs in its own VM, so you can parallelize as wide as your rate limits and request pools allow. See [Cloud agents](https://cursor.com/docs/cloud-agent) for VM behavior, lifecycle, and artifact handling.

## [Per-task configuration](https://cursor.com/docs/evals\#per-task-configuration)

The SDK gives you the knobs eval harnesses usually need:

- **Custom tool sets.** Restrict or extend tools via [MCP servers](https://cursor.com/docs/sdk/typescript#mcp-servers) inline on `Agent.create()`.
- **Subagents.** Define named [subagents](https://cursor.com/docs/sdk/typescript#subagents) the main agent can spawn during a task.
- **Cancellation and timeouts.** Call `run.cancel()` to enforce wall-clock limits. Status becomes `"cancelled"` and partial output stays readable.
- **Per-step callbacks.** Use the `onStep` and `onDelta` options on `agent.send()` for finer-grained logging.

## [Privacy and billing](https://cursor.com/docs/evals\#privacy-and-billing)

SDK runs follow the same pricing, request pools, and Privacy Mode rules as runs from the IDE and Cloud Agents. Eval traffic is tagged so it shows up under the SDK label in your team's [usage dashboard](https://cursor.com/dashboard/usage). To keep eval data out of model training, turn on [Privacy Mode](https://cursor.com/help/security-and-privacy/privacy) for the account or team running the harness.

## [Higher rate limits](https://cursor.com/docs/evals\#higher-rate-limits)

Running a benchmark at scale?

Default API rate limits are tuned for development workloads, not full eval sweeps. If you're benchmarking Cursor on a public leaderboard or running a large internal eval, email [leerob@cursor.com](mailto:leerob@cursor.com) and we'll get you set up with higher limits.

## [Next steps](https://cursor.com/docs/evals\#next-steps)

- Browse the full [Cursor SDK reference](https://cursor.com/docs/sdk/typescript) for every option, event type, and error class.
- Read about [Composer 2](https://cursor.com/docs/models/cursor-composer-2) and the rest of Cursor's [models](https://cursor.com/docs/models-and-pricing).
- Explore [Cloud agents](https://cursor.com/docs/cloud-agent) for sandboxed, parallel runs.

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