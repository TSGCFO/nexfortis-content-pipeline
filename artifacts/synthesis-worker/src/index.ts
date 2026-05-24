import { Inngest } from 'inngest';
import { createLogger } from '@ncp/logger';

import { createSynthesizeWeeklyCron } from './jobs/synthesize-weekly/index.js';

const logger = createLogger({ source: 'synthesis_worker' });

export const inngest = new Inngest({ id: 'synthesis-worker' });

export const synthesizeWeeklyCron = createSynthesizeWeeklyCron(inngest);

export const inngestFunctions = [synthesizeWeeklyCron];

logger.debug(
  { source: 'synthesis_worker', action: 'module_loaded' },
  'synthesis-worker module loaded',
);
