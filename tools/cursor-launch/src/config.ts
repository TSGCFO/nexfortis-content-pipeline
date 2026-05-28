/**
 * Hardcoded defaults for the NexFortis content-pipeline Cursor launcher.
 *
 * Things that NEVER vary for this workflow are constants here.
 * Things that might vary per launch are CLI flags (see cli.ts), and the
 * defaults they fall back to also live here.
 *
 * Verified against docs in `docs/external/cursor-docs/` on 2026-05-28:
 *  - Model preference:  cursor.com_docs_models_claude-opus-4-{7,8}.md
 *  - Cloud agent shape: cursor.com_docs_sdk_typescript.md
 *  - Status lifecycle:  cursor.com_docs_sdk_typescript.md (SDKStatusMessage)
 *  - Model discovery:   cursor.com_docs_sdk_typescript.md (Cursor.models.list)
 *  - PR attach mode:    cursor.com_docs_cloud-agent_api_endpoints.md (repos[].prUrl)
 */

export const CURSOR_LAUNCH_CONFIG = {
  /**
   * Preference list for picking the model when `--model` is not passed.
   * The launcher calls `Cursor.models.list()` once and picks the first ID
   * from this array that exists in the response. When Anthropic ships a
   * newer Opus, prepend its ID here.
   *
   * The launcher will also accept any other model ID via `--model`, so this
   * is purely a "what should default mean" decision.
   */
  modelPreferenceOrder: ['claude-opus-4-8', 'claude-opus-4-7'] as const,

  /**
   * Default model params applied when the resolved default model accepts a
   * `thinking` parameter. We try `high` (best results per Cursor's own
   * recommendation for Opus 4.7/4.8). If the model doesn't expose
   * `thinking`, we drop the param silently rather than fail.
   *
   * Override with one or more `--model-param id=value` flags.
   */
  defaultModelParamsByCapability: [
    { id: 'thinking', value: 'high' },
  ] as Array<{ id: string; value: string }>,

  /** Repo URL the cloud agent clones. Always the same for this pipeline. */
  repoUrl: 'https://github.com/TSGCFO/nexfortis-content-pipeline' as const,

  /** Default starting ref when no --pr-url is passed. */
  startingRef: 'main' as const,

  /** Cursor opens a PR automatically. Core to our review workflow. */
  autoCreatePR: true as const,

  /**
   * Verification: wait until cloud agent reaches RUNNING. Just getting an
   * agent ID back from Agent.create is not proof that the VM provisioned.
   */
  verifyTimeoutMs: 5 * 60 * 1000, // 5 minutes

  /** Where Cursor Web hosts the agent view. */
  cursorWebUrlBase: 'https://cursor.com/agents' as const,
} as const;

export const REQUIRED_ENV = {
  cursorApiKey: 'CURSOR_API_KEY',
} as const;
