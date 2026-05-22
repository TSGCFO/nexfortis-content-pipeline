import { Inngest } from 'inngest';
import { createLogger } from '@ncp/logger';

import { createIngestMsgraphEmailCron } from './jobs/ingest-msgraph-email/index.js';

const logger = createLogger({ source: 'capture-worker' });

export const inngest = new Inngest({ id: 'capture-worker' });

export async function helloWorldHandler(): Promise<{ ok: true }> {
  try {
    logger.info({ source: 'capture-worker' }, 'capture-worker alive');
    return { ok: true };
  } catch (err) {
    logger.error({ err }, 'hello-world failed');
    throw err;
  }
}

export const helloWorld = inngest.createFunction(
  { id: 'hello-world' },
  { event: 'ping/hello' },
  helloWorldHandler,
);

export const ingestMsgraphEmailCron = createIngestMsgraphEmailCron(inngest);

export const inngestFunctions = [helloWorld, ingestMsgraphEmailCron];
