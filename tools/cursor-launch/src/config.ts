/**
 * Hardcoded defaults for the NexFortis content-pipeline Cursor launcher.
 *
 * Verified against docs/external/cursor-docs/ (snapshot 2026-05-28) AND the
 * live /v1/models response at docs/external/cursor-models.json (captured
 * 2026-05-29).
 */

export const CURSOR_LAUNCH_CONFIG = {
  /**
   * Preference order for picking the default model. The launcher calls
   * `GET /v1/models` once and picks the first ID from this array that
   * exists in the response. When Anthropic ships a newer Opus, prepend
   * its ID here.
   *
   * Always overridable via `--model <id>`.
   */
  modelPreferenceOrder: ['claude-opus-4-8', 'claude-opus-4-7'] as const,

  /**
   * Default per-model parameter PREFERENCES. The launcher applies these to
   * a complete variant lookup: for the chosen model, it walks `variants[]`
   * and picks the variant whose params best match these preferences.
   *
   * IMPORTANT: Cursor's /v1/models exposes `parameters` (individual axes)
   * AND `variants` (only valid combinations of those axes). You cannot
   * send arbitrary param combos — only declared variants are accepted.
   * That's why we treat these as preferences and snap to a real variant.
   *
   * The defaults below ask for the strongest setting you can normally use:
   *   thinking=true, context=1m (largest), effort=max, fast=false.
   * For Opus 4.7/4.8 today, that's a real variant. If a future model omits
   * one of these axes entirely, the resolver still picks the closest match
   * by other axes.
   *
   * Override per-launch with `--model-param id=value`.
   */
  defaultModelParamPreferences: [
    { id: 'thinking', value: 'true' },
    { id: 'context', value: '1m' },
    { id: 'effort', value: 'max' },
    { id: 'fast', value: 'false' },
  ] as ReadonlyArray<{ id: string; value: string }>,

  /** Repo URL the cloud agent clones. Always the same for this pipeline. */
  repoUrl: 'https://github.com/TSGCFO/nexfortis-content-pipeline' as const,

  /** Default starting ref when no --pr-url is passed. */
  startingRef: 'main' as const,

  /** Cursor opens a PR automatically. Core to our review workflow. */
  autoCreatePR: true as const,

  /**
   * Verification: wait until cloud agent reaches RUNNING. Just getting an
   * agent ID back from POST /v1/agents is not proof that the VM provisioned.
   */
  verifyTimeoutMs: 5 * 60 * 1000, // 5 minutes

  /** Where Cursor Web hosts the agent view. */
  cursorWebUrlBase: 'https://cursor.com/agents' as const,
} as const;

export const REQUIRED_ENV = {
  cursorApiKey: 'CURSOR_API_KEY',
} as const;
