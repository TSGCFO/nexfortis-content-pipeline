/**
 * Resolves which model to use for a launch, calling `Cursor.models.list()`
 * once when needed.
 *
 * Behaviour:
 *  - If the caller passed an explicit `--model <id>` and `--model-param ...`
 *    flags, we use those verbatim (no API roundtrip). The user said they
 *    want it. Cursor will surface a `ConfigurationError` if the id or
 *    params are wrong; we let that propagate.
 *  - If no `--model` was passed, we call `Cursor.models.list()`, pick the
 *    first ID from `modelPreferenceOrder` that exists, and attach
 *    `defaultModelParamsByCapability` filtered to params the model actually
 *    declares it accepts.
 */

import type { ModelSelection } from '@cursor/sdk';

import { CURSOR_LAUNCH_CONFIG } from './config.js';

import type { LaunchLogger } from './launch.js';

export interface ResolveModelInput {
  /** Explicit override from --model. */
  modelId?: string;
  /** Explicit overrides from --model-param id=value (repeatable). */
  modelParams?: Array<{ id: string; value: string }>;
  /** API key used to talk to Cursor when discovering models. */
  apiKey: string;
}

export interface ResolveModelOutput {
  selection: ModelSelection;
  /** Human-readable explanation of how we got here, for logging. */
  rationale: string;
}

export async function resolveModel(
  input: ResolveModelInput,
  logger: LaunchLogger,
): Promise<ResolveModelOutput> {
  // Lazy import so this file is safe to load in environments without
  // the @cursor/sdk native deps available (matches launch.ts pattern).
  const { Cursor } = await import('@cursor/sdk');

  if (input.modelId) {
    const params = input.modelParams && input.modelParams.length > 0 ? input.modelParams : undefined;
    const selection: ModelSelection = params ? { id: input.modelId, params } : { id: input.modelId };
    return {
      selection,
      rationale:
        `user-specified via --model${params ? ` with ${params.length} param(s)` : ' (no params)'}`,
    };
  }

  // Default path: discover models and apply preference order
  logger.info('Discovering available models via Cursor.models.list()...');
  const models = await Cursor.models.list({ apiKey: input.apiKey });
  const availableIds = new Set(models.map((m) => m.id));

  const chosenId = CURSOR_LAUNCH_CONFIG.modelPreferenceOrder.find((id) => availableIds.has(id));
  if (!chosenId) {
    throw new Error(
      `None of the preferred models (${CURSOR_LAUNCH_CONFIG.modelPreferenceOrder.join(', ')}) ` +
        `are available on this account. Available: ${[...availableIds].join(', ')}. ` +
        `Pass an explicit --model <id> to override.`,
    );
  }

  const modelMeta = models.find((m) => m.id === chosenId);
  const acceptedParamIds = new Set((modelMeta?.parameters ?? []).map((p) => p.id));
  const applicableDefaults = CURSOR_LAUNCH_CONFIG.defaultModelParamsByCapability.filter((p) =>
    acceptedParamIds.has(p.id),
  );

  // CLI params override config defaults param-by-param
  const cliParamIds = new Set((input.modelParams ?? []).map((p) => p.id));
  const mergedParams = [
    ...applicableDefaults.filter((p) => !cliParamIds.has(p.id)),
    ...(input.modelParams ?? []),
  ];

  const selection: ModelSelection =
    mergedParams.length > 0 ? { id: chosenId, params: mergedParams } : { id: chosenId };

  return {
    selection,
    rationale:
      `auto-resolved from preference order (${CURSOR_LAUNCH_CONFIG.modelPreferenceOrder.join(' > ')})` +
      (mergedParams.length > 0
        ? ` with ${mergedParams.length} param(s): ${mergedParams.map((p) => `${p.id}=${p.value}`).join(', ')}`
        : ''),
  };
}
