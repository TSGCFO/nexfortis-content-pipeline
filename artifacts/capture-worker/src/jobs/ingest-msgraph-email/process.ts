/**
 * Per-message pipeline: extract → redact → block-or-chunk → embed → insert.
 *
 * One `GraphMessage` in, one `ProcessResult` out. All field extraction
 * follows the dotted-path contract documented at
 * `docs/integration-contracts/msgraph-message.md`. Tests assert the contract
 * directly — any field-path change here must update the contract first.
 *
 * Privacy invariants enforced here (read carefully before changing):
 *   - Blocked emails are dropped entirely. No DB row, no audit row. The
 *     only trace is one log line: `{ action: 'block_email', reason }`.
 *     The log line MUST NOT include id/subject/sender/recipient/body.
 *   - `source_url` (the Outlook `webLink`) is stored on the row but never
 *     logged — it can be linked back to a specific item-id by anyone with
 *     mailbox access.
 *   - Drafts are skipped before any processing. No content is read.
 */

import { captureSignals, type Database } from '@ncp/db';
import { chunk as chunkText, embed as embedTexts } from '@ncp/embeddings';
import type { createLogger } from '@ncp/logger';
import { redact } from '@ncp/redaction';

import { stripHtml } from './html-strip.js';
import type { GraphMessage, ProcessResult } from './types.js';

type Logger = ReturnType<typeof createLogger>;

export interface ProcessDeps {
  db: Pick<Database, 'insert'>;
  redactFn: typeof redact;
  chunkFn: typeof chunkText;
  embedFn: typeof embedTexts;
  logger: Pick<Logger, 'info' | 'debug' | 'error'>;
  anthropicApiKey: string;
  openaiApiKey: string;
  openaiOrgId?: string;
}

const SOURCE = 'msgraph-email' as const;

function extractRecipientAddresses(
  recipients: GraphMessage['toRecipients'] | undefined,
): string[] {
  if (!Array.isArray(recipients)) return [];
  const out: string[] = [];
  for (const r of recipients) {
    const addr = r?.emailAddress?.address;
    if (typeof addr === 'string' && addr.length > 0) {
      out.push(addr);
    }
  }
  return out;
}

function formatSourceId(messageId: string, chunkIndex: number): string {
  return `${SOURCE}:${messageId}:chunk-${String(chunkIndex).padStart(4, '0')}`;
}

export async function processMessage(
  msg: GraphMessage,
  deps: ProcessDeps,
): Promise<ProcessResult> {
  try {
    if (msg.isDraft === true) {
      deps.logger.debug({ action: 'skip_draft' }, 'skipping draft message');
      return { status: 'skipped_draft' };
    }

    const bodyContent = msg.body?.content ?? '';
    const bodyType = msg.body?.contentType ?? 'text';
    const plain =
      bodyType === 'html' ? stripHtml(bodyContent) : bodyContent.trim();
    if (plain.length === 0) {
      deps.logger.debug({ action: 'skip_empty' }, 'skipping empty message');
      return { status: 'skipped_empty' };
    }

    const senderEmail = msg.from?.emailAddress?.address ?? '';
    const recipientEmails = [
      ...extractRecipientAddresses(msg.toRecipients),
      ...extractRecipientAddresses(msg.ccRecipients),
      ...extractRecipientAddresses(msg.bccRecipients),
    ];
    const subject = msg.subject ?? '';

    const redaction = await deps.redactFn({
      source: SOURCE,
      senderEmail,
      recipientEmails,
      subject,
      body: plain,
      anthropicApiKey: deps.anthropicApiKey,
    });

    if (redaction.status === 'blocked') {
      // Drop-on-block: no DB row, no audit row. The context object MUST
      // contain only `source`, `action`, and `reason` — no message id,
      // subject, sender, recipient, body, or excerpt. The empty message
      // string is the second positional argument to the structured logger
      // and is not a field on the context object.
      deps.logger.info(
        {
          source: 'capture-worker',
          action: 'block_email',
          reason: redaction.reason,
        },
        '',
      );
      return { status: 'blocked' };
    }

    const chunks = deps.chunkFn(redaction.redactedText);
    if (chunks.length === 0) {
      deps.logger.debug(
        { action: 'skip_empty_after_chunk' },
        'no chunks produced for message',
      );
      return { status: 'skipped_empty' };
    }

    const messageId = msg.id;
    if (typeof messageId !== 'string' || messageId.length === 0) {
      return { status: 'failed', error: 'message missing required `id` field' };
    }

    const capturedAtISO = msg.sentDateTime ?? msg.receivedDateTime;
    if (typeof capturedAtISO !== 'string' || capturedAtISO.length === 0) {
      return {
        status: 'failed',
        error: 'message missing both sentDateTime and receivedDateTime',
      };
    }
    const capturedAt = new Date(capturedAtISO);
    if (Number.isNaN(capturedAt.getTime())) {
      return {
        status: 'failed',
        error: `message has invalid capturedAt timestamp: ${capturedAtISO}`,
      };
    }

    let embedded;
    try {
      embedded = await deps.embedFn({
        texts: chunks.map((c) => c.text),
        openaiApiKey: deps.openaiApiKey,
        ...(typeof deps.openaiOrgId === 'string' && deps.openaiOrgId.length > 0
          ? { orgId: deps.openaiOrgId }
          : {}),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: 'failed', error: `embed failed: ${message}` };
    }

    let signalsInserted = 0;
    let signalsSkippedDuplicate = 0;

    for (let i = 0; i < chunks.length; i += 1) {
      const c = chunks[i];
      if (!c) continue;
      const embedding = embedded.embeddings[i];
      const tokenCount = embedded.tokenCounts[i];
      if (!Array.isArray(embedding)) {
        return {
          status: 'failed',
          error: `embed result missing vector for chunk ${i}`,
        };
      }
      const sourceId = formatSourceId(messageId, i);
      const sourceUrl =
        typeof msg.webLink === 'string' ? msg.webLink : null;

      const inserted = await deps.db
        .insert(captureSignals)
        .values({
          source: SOURCE,
          sourceId,
          sourceUrl,
          capturedAt,
          redactedText: c.text,
          embedding,
          tokenCount: typeof tokenCount === 'number' ? tokenCount : c.tokenCount,
          piiStatus: 'redacted',
          redactionLog: redaction.log,
        })
        .onConflictDoNothing({ target: captureSignals.sourceId })
        .returning({ id: captureSignals.id });

      if (Array.isArray(inserted) && inserted.length > 0) {
        signalsInserted += 1;
      } else {
        signalsSkippedDuplicate += 1;
      }
    }

    return { status: 'stored', signalsInserted, signalsSkippedDuplicate };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    deps.logger.error(
      { source: 'capture-worker', action: 'process_message_failed' },
      `processMessage threw: ${message}`,
    );
    return { status: 'failed', error: message };
  }
}
