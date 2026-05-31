/**
 * Resolves which model + variant to use for a launch.
 *
 * Cursor's `/v1/models` exposes both `parameters` (individual axes) and
 * `variants` (declared valid combinations of those axes). You can only POST
 * a variant that exists; arbitrary param combos are rejected with 400
 * invalid_model.
 *
 * Algorithm:
 *  1. If --model is passed: use it. If --model-param is also passed, send
 *     those params directly (the user is taking responsibility for matching
 *     a real variant). Otherwise, pick the model's `isDefault` variant.
 *  2. Otherwise: pick the first model from `modelPreferenceOrder` that
 *     exists in /v1/models. Then pick the variant whose params best match
 *     `defaultModelParamPreferences` (scored: each matching param = 1).
 *     CLI --model-param values override the matched variant on those axes.
 */

import { CURSOR_LAUNCH_CONFIG } from './config.js';
import { listModels } from './cursor-api.js';

import type { LaunchLogger } from './launch.js';
import type { Model, ModelVariant } from './types.js';

export interface ResolveModelInput {
  modelId?: string;
  modelParams?: Array<{ id: string; value: string }>;
}

export interface ResolvedModelSelection {
  id: string;
  params?: Array<{ id: string; value: string }>;
}

export interface ResolveModelOutput {
  selection: ResolvedModelSelection;
  rationale: string;
}

function scoreVariant(
  variant: ModelVariant,
  prefs: ReadonlyArray<{ id: string; value: string }>,
): number {
  const prefMap = new Map(prefs.map((p) => [p.id, p.value] as const));
  let score = 0;
  for (const p of variant.params) {
    if (prefMap.get(p.id) === p.value) score += 1;
  }
  return score;
}

function pickVariant(model: Model, prefs: ReadonlyArray<{ id: string; value: string }>): ModelVariant | undefined {
  if (!model.variants || model.variants.length === 0) return undefined;
  let best: ModelVariant | undefined;
  let bestScore = -1;
  for (const v of model.variants) {
    const s = scoreVariant(v, prefs);
    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  }
  return best;
}

function applyCliOverrides(
  baseParams: Array<{ id: string; value: string }>,
  overrides: Array<{ id: string; value: string }>,
): Array<{ id: string; value: string }> {
  const ovIds = new Set(overrides.map((p) => p.id));
  return [...baseParams.filter((p) => !ovIds.has(p.id)), ...overrides];
}

export async function resolveModel(
  input: ResolveModelInput,
  logger: LaunchLogger,
): Promise<ResolveModelOutput> {
  logger.info('Discovering available models via GET /v1/models...');
  const { items: models } = await listModels();
  const byId = new Map(models.map((m) => [m.id, m] as const));

  // Resolve which model to use
  let modelMeta: Model | undefined;
  let chosenId: string;
  if (input.modelId) {
    modelMeta = byId.get(input.modelId);
    if (!modelMeta) {
      throw new Error(
        `Model '${input.modelId}' is not available on this account. ` +
          `Available: ${[...byId.keys()].join(', ')}.`,
      );
    }
    chosenId = input.modelId;
  } else {
    const found = CURSOR_LAUNCH_CONFIG.modelPreferenceOrder.find((id) => byId.has(id));
    if (!found) {
      throw new Error(
        `None of the preferred models (${CURSOR_LAUNCH_CONFIG.modelPreferenceOrder.join(', ')}) ` +
          `are available. Available: ${[...byId.keys()].join(', ')}. ` +
          `Pass --model <id> to override.`,
      );
    }
    chosenId = found;
    modelMeta = byId.get(found);
  }

  // Pick variant: explicit --model-param means user-controlled; otherwise
  // snap to best-matching variant from preferences.
  const hasCliParams = (input.modelParams ?? []).length > 0;
  let baseParams: Array<{ id: string; value: string }> = [];
  let variantNote = '';

  if (modelMeta?.variants && modelMeta.variants.length > 0) {
    const preferred = hasCliParams && input.modelId
      ? undefined  // user is taking control of params on an explicit model
      : pickVariant(modelMeta, CURSOR_LAUNCH_CONFIG.defaultModelParamPreferences);
    if (preferred) {
      baseParams = preferred.params.map((p) => ({ id: p.id, value: p.value }));
      const score = scoreVariant(preferred, CURSOR_LAUNCH_CONFIG.defaultModelParamPreferences);
      variantNote = ` (matched variant with ${score}/${CURSOR_LAUNCH_CONFIG.defaultModelParamPreferences.length} preferred params)`;
    }
  }

  const finalParams = applyCliOverrides(baseParams, input.modelParams ?? []);

  const selection: ResolvedModelSelection =
    finalParams.length > 0 ? { id: chosenId, params: finalParams } : { id: chosenId };

  const rationaleParts: string[] = [];
  if (input.modelId) {
    rationaleParts.push(`user-specified via --model`);
  } else {
    rationaleParts.push(`auto-resolved from preference order (${CURSOR_LAUNCH_CONFIG.modelPreferenceOrder.join(' > ')})`);
  }
  rationaleParts.push(variantNote.trim());
  if (hasCliParams) {
    const cliList = (input.modelParams ?? []).map((p) => `${p.id}=${p.value}`).join(', ');
    rationaleParts.push(`with CLI overrides: ${cliList}`);
  }
  if (finalParams.length > 0) {
    const allList = finalParams.map((p) => `${p.id}=${p.value}`).join(', ');
    rationaleParts.push(`-> params: ${allList}`);
  }

  return {
    selection,
    rationale: rationaleParts.filter(Boolean).join(' '),
  };
}
