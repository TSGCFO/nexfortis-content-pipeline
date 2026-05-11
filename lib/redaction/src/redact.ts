import { createLogger } from '@ncp/logger';
import {
  type BlocklistInput,
  checkBlocklist,
} from './blocklist.js';
import { haikuScrub } from './haiku-scrub.js';
import {
  mapPostOffsetToOriginal,
  regexPassInternal,
  type PassReplacement,
} from './regex-pass.js';
import type {
  RedactionInput,
  RedactionLogEntry,
  RedactionResult,
} from './types.js';

const logger = createLogger({ source: 'redaction' });

function buildBlocklistInput(input: RedactionInput): BlocklistInput {
  const base: BlocklistInput = {
    source: input.source,
    body: input.body,
  };
  if (input.senderEmail !== undefined) {
    base.senderEmail = input.senderEmail;
  }
  if (input.recipientEmails !== undefined) {
    base.recipientEmails = input.recipientEmails;
  }
  if (input.subject !== undefined) {
    base.subject = input.subject;
  }
  return base;
}

function remapHaikuLog(
  haikuLog: readonly RedactionLogEntry[],
  replacements: readonly PassReplacement[],
): RedactionLogEntry[] {
  return haikuLog.map((entry) => ({
    type: entry.type,
    offset: mapPostOffsetToOriginal(entry.offset, replacements),
    replacement: entry.replacement,
  }));
}

/**
 * Run the full two-pass redaction pipeline:
 *   1. Hard family-law blocklist (fail-closed, runs BEFORE redaction).
 *   2. Regex pass.
 *   3. Claude Haiku named-entity scrub (unless `skipHaiku: true`).
 *
 * Any failure in steps 2 or 3 returns `{ status: 'blocked', reason:
 * 'redaction_failed' }`. The caller MUST treat `status: 'blocked'` as "do not
 * ingest".
 */
export async function redact(input: RedactionInput): Promise<RedactionResult> {
  const blocklistInput = buildBlocklistInput(input);

  let blocklistResult;
  try {
    blocklistResult = checkBlocklist(blocklistInput);
  } catch (err) {
    logger.error(
      {
        source: 'redaction',
        action: 'blocklist',
        err: (err as Error).message,
      },
      'Blocklist check threw — failing closed',
    );
    return {
      status: 'blocked',
      reason: 'redaction_failed',
      redactedText: '',
      log: [],
    };
  }

  if (blocklistResult.blocked) {
    logger.info(
      {
        source: 'redaction',
        action: 'blocklist',
        reason: blocklistResult.reason,
        capture_source: input.source,
      },
      'Input blocked by family-law blocklist',
    );
    return {
      status: 'blocked',
      reason: blocklistResult.reason,
      redactedText: '',
      log: [],
    };
  }

  let regexResult;
  try {
    regexResult = regexPassInternal(input.body);
  } catch (err) {
    logger.error(
      {
        source: 'redaction',
        action: 'regex_pass',
        err: (err as Error).message,
      },
      'Regex pass threw — failing closed',
    );
    return {
      status: 'blocked',
      reason: 'redaction_failed',
      redactedText: '',
      log: [],
    };
  }

  const combinedLog: RedactionLogEntry[] = [...regexResult.log];

  if (input.skipHaiku === true) {
    return {
      status: 'redacted',
      redactedText: regexResult.redacted,
      log: combinedLog,
    };
  }

  try {
    const haikuResult = await haikuScrub(regexResult.redacted, {
      anthropicApiKey: input.anthropicApiKey,
    });
    const remappedHaikuLog = remapHaikuLog(haikuResult.log, regexResult.replacements);
    combinedLog.push(...remappedHaikuLog);
    return {
      status: 'redacted',
      redactedText: haikuResult.redacted,
      log: combinedLog,
    };
  } catch (err) {
    logger.error(
      {
        source: 'redaction',
        action: 'haiku_scrub',
        err: (err as Error).message,
      },
      'Haiku scrub failed — failing closed',
    );
    return {
      status: 'blocked',
      reason: 'redaction_failed',
      redactedText: '',
      log: combinedLog,
    };
  }
}
