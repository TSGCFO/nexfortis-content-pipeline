/**
 * Hardcoded defaults for the NexFortis content-pipeline Cursor launcher.
 *
 * These are intentionally constants, not env vars or CLI flags. The whole
 * point of this tool is that the only thing that changes between runs is the
 * prompt. Change here only if the workflow itself changes.
 *
 * Verified against docs in `docs/external/cursor-docs/` on 2026-05-28:
 *  - Model ID:        cursor.com_docs_models_claude-opus-4-8.md
 *  - Cloud agent shape: cursor.com_docs_sdk_typescript.md (Quick start / Creating agents)
 *  - Status lifecycle:  cursor.com_docs_sdk_typescript.md (SDKStatusMessage)
 */

export const CURSOR_LAUNCH_CONFIG = {
  /**
   * Top Anthropic model on Cursor as of 2026-05-28. The user has explicitly
   * asked for Opus 4.8 (or 4.7 if 4.8 is unavailable). 4.8 is live in
   * the docs, so we use it.
   *
   * If Cursor renames / removes this model, the SDK will throw and we'll
   * see the error in the launcher output — that's the signal to bump.
   */
  modelId: 'claude-opus-4-8' as const,

  /**
   * Repo URL the cloud agent clones. Always the same repo — every prompt
   * Hassan launches is against this one. Starting ref is always `main`
   * because Cursor's cloud agent will branch off into its own `cursor/...`
   * feature branch automatically.
   */
  repoUrl: 'https://github.com/TSGCFO/nexfortis-content-pipeline' as const,
  startingRef: 'main' as const,

  /**
   * Cursor opens a PR automatically when the agent finishes. This is the
   * core review workflow: launch → agent works on cursor/<branch> →
   * auto-PR → Computer reviews → fixup prompts in same session if needed
   * → merge.
   */
  autoCreatePR: true as const,

  /**
   * Default behaviour after launch: wait until the cloud agent leaves
   * `CREATING` (VM provisioning + repo cloning) and enters `RUNNING`.
   *
   * This is the verification the user asked for — we don't print "launched
   * successfully" until Cursor has actually started a session, not just
   * accepted the API call.
   *
   * Override with `--wait` to block until the run terminates instead.
   */
  verifyTimeoutMs: 5 * 60 * 1000, // 5 minutes — VM provisioning is usually 30-60s

  /**
   * URL we print so the user can click straight to the cloud agent in
   * Cursor Web. `bc-<uuid>` is the cloud-agent ID format.
   */
  cursorWebUrlBase: 'https://cursor.com/agents' as const,
} as const;

export const REQUIRED_ENV = {
  cursorApiKey: 'CURSOR_API_KEY',
} as const;
