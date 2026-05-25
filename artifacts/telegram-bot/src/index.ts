import { Inngest } from 'inngest';
import { createLogger } from '@ncp/logger';

import { createInterviewSessionJob } from './jobs/interview-session/index.js';

const logger = createLogger({ source: 'telegram_bot' });

export const inngest = new Inngest({ id: 'telegram-bot' });

export const interviewSessionJob = createInterviewSessionJob(inngest);

export const inngestFunctions = [interviewSessionJob];

logger.debug(
  { source: 'telegram_bot', action: 'module_loaded' },
  'telegram-bot module loaded',
);
