import { createLogger } from '@ncp/logger';

import { checkBlocklist, type BlocklistInput } from './blocklist.js';
import { haikuScrub } from './haiku-scrub.js';
import { regexPass, type RegexReplacement } from './regex-pass.js';
import type { RedactionInput, RedactionLogEntry, RedactionResult } from './types.js';

const logger = createLogger({ source: 'redaction' });

/**
 * Map an offset measured in the post-regex-pass text back to the offset of the
 * same character in the original (pre-redaction) text.
 *
 * `replacements` must be sorted by `originalStart` ascending.
 */
function mapPostRegexOffsetToOriginal(
  postOffset: number,
  replacements: readonly RegexReplacement[],
): number {
  let delta = 0; // delta = (original index) - (post index) at the current cursor
  for (const r of replacements) {
    const postStart = r.originalStart - delta;
    if (postOffset < postStart) {
      return postOffset + delta;
    }
    if (postOffset < postStart + r.replacementLength) {
      // Inside the replacement region — collapse to start of original match.
      return r.originalStart;
    }
    delta += r.originalEnd - r.originalStart - r.replacementLength;
  }
  return postOffset + delta;
}

function toBlocklistInput(input: RedactionInput): BlocklistInput {
  const out: BlocklistInput = { source: input.source, body: input.body };
  if (typeof input.senderEmail === 'string') out.senderEmail = input.senderEmail;
  if (Array.isArray(input.recipientEmails)) out.recipientEmails = input.recipientEmails;
  if (typeof input.subject === 'string') out.subject = input.subject;
  return out;
}

/**
 * Two-pass PII redaction with hard blocklist short-circuit.
 *
 * Order of operations is intentional and must not be reordered:
 *   1. Hard blocklist check (synchronous, family-law / legal counsel rules).
 *      If matched, return immediately with `{ status: 'blocked' }`. Reordering
 *      this after redaction would leak personal-content patterns into the
 *      regex-pass log.
 *   2. Regex pass — emails, phones, SINs, credit cards, IPs.
 *   3. (optional) Claude Haiku named-entity scrub — person names, company
 *      names (excluding NexFortis / qbportal / Talencor), addresses.
 *
 * Fail-closed: any pass failure returns `{ status: 'blocked',
 * reason: 'redaction_failed' }` rather than partially-redacted text.
 */
export async function redact(input: RedactionInput): Promise<RedactionResult> {
  // Step 1 — hard blocklist. Must run before regex pass.
  let blocklistResult: ReturnType<typeof checkBlocklist>;
  try {
    blocklistResult = checkBlocklist(toBlocklistInput(input));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      { source: 'redaction', action: 'blocklist', captureSource: input.source },
      `blocklist check threw: ${message}`,
    );
    return { status: 'blocked', reason: 'redaction_failed', redactedText: '', log: [] };
  }
  if (blocklistResult.blocked) {
    logger.info(
      {
        source: 'redaction',
        action: 'blocklist',
        captureSource: input.source,
        reason: blocklistResult.reason,
      },
      'capture blocked by hard blocklist',
    );
    return {
      status: 'blocked',
      reason: blocklistResult.reason,
      redactedText: '',
      log: [],
    };
  }

  // Step 2 — regex pass.
  let pass1: ReturnType<typeof regexPass>;
  try {
    pass1 = regexPass(input.body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      { source: 'redaction', action: 'regex_pass', captureSource: input.source },
      `regex_pass threw: ${message}`,
    );
    return { status: 'blocked', reason: 'redaction_failed', redactedText: '', log: [] };
  }

  if (input.skipHaiku === true) {
    return {
      status: 'redacted',
      redactedText: pass1.redacted,
      log: pass1.log.slice(),
    };
  }

  // Step 3 — Haiku scrub.
  try {
    const haikuOut = await haikuScrub(pass1.redacted, {
      anthropicApiKey: input.anthropicApiKey,
    });
    const remappedHaikuLog: RedactionLogEntry[] = haikuOut.log.map((e) => ({
      type: e.type,
      offset: mapPostRegexOffsetToOriginal(e.offset, pass1.replacements),
      replacement: e.replacement,
    }));
    const combined: RedactionLogEntry[] = [...pass1.log, ...remappedHaikuLog].sort(
      (a, b) => a.offset - b.offset,
    );
    return {
      status: 'redacted',
      redactedText: haikuOut.redacted,
      log: combined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      { source: 'redaction', action: 'haiku_scrub', captureSource: input.source },
      `haiku_scrub failed; failing closed: ${message}`,
    );
    return {
      status: 'blocked',
      reason: 'redaction_failed',
      redactedText: '',
      log: pass1.log.slice(),
    };
  }
}
