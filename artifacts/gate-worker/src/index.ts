import { Inngest } from 'inngest';

import { createLogger } from '@ncp/logger';

import { createDraftGeneratorJob } from './jobs/draft-generator/index.js';

const logger = createLogger({ source: 'gate_worker' });

export const inngest = new Inngest({ id: 'gate-worker' });

export const draftGeneratorJob = createDraftGeneratorJob(inngest);

export const inngestFunctions = [draftGeneratorJob];

export * from './gates/stage-a.js';
export * from './integrations/brief-assembler.js';
export * from './integrations/insights-assembler.js';
export * from './jobs/draft-generator/index.js';

logger.debug(
  { source: 'gate_worker', action: 'module_loaded' },
  'gate-worker module loaded',
);
