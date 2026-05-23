/**
 * Per-session pipeline: flatten → compose-text → redact → chunk → embed →
 * insert.
 *
 * One validated `SessionDocument` in, one `ProcessResult` out. The
 * dependency-injection shape mirrors `ingest-msgraph-email/process.ts` so
 * the same testing approach applies (spy on the insert chain, swap in
 * deterministic chunk/embed/redact functions).
 *
 * Privacy invariants enforced here:
 *   - The composed text is built ONLY from per-event `text` and `summary`
 *     fields. Tool call payloads, raw transcripts, and exporter metadata
 *     are never embedded.
 *   - The redactor sees the composed text via `body`. Its output replaces
 *     the input before chunking.
 *   - Blocked sessions emit a single structured log line containing only
 *     `{ source, action, reason, sessionId }`. Body text, redacted text,
 *     and chunk samples are NEVER logged.
 *
 * Idempotency: `source_id` is `claude_cowork:<sessionId>:chunk-NNNN` where
 * `<sessionId>` is the value of the JSON file's top-level `sessionId`
 * (i.e. the transcript id). Re-runs of the exporter against the same
 * data produce the same chunk source-ids, and the database's
 * `UNIQUE (source_id)` constraint plus `.onConflictDoNothing()` makes
 * re-inserts silently dedup.
 */

import { captureSignals, type Database } from '@ncp/db';
import { chunk as chunkText, embed as embedTexts } from '@ncp/embeddings';
import type { createLogger } from '@ncp/logger';
import { redact } from '@ncp/redaction';

import { flattenEvents } from './flatten-events.js';
import type {
  FlatEvent,
  ProcessResult,
  SessionDocument,
} from './types.js';

type Logger = ReturnType<typeof createLogger>;

const SOURCE = 'claude_cowork' as const;

export interface ProcessDeps {
  db: Pick<Database, 'insert'>;
  redactFn: typeof redact;
  chunkFn: typeof chunkText;
  embedFn: typeof embedTexts;
  logger: Pick<Logger, 'info' | 'debug' | 'warn' | 'error'>;
  anthropicApiKey: string;
  openaiApiKey: string;
  openaiOrgId?: string;
}

function formatSourceId(sessionId: string, chunkIndex: number): string {
  return `${SOURCE}:${sessionId}:chunk-${String(chunkIndex).padStart(4, '0')}`;
}

/**
 * Compose one continuous block of text from the flattened events. Each
 * event becomes one paragraph (separator `\n\n`) so the chunker can pick
 * semantic boundaries.
 *
 * Role prefixes preserve speaker context inside the embedded text:
 *   - `user_text`      → `USER: <text>`
 *   - `assistant_text` → `ASSISTANT: <text>`
 *   - `tool_call`      → `TOOL[<tool>]: <summary>`  (skipped if no summary)
 *
 * Returns an empty string when no flat event carries embeddable text.
 */
export function composeText(flat: readonly FlatEvent[]): string {
  const parts: string[] = [];
  for (const e of flat) {
    switch (e.kind) {
      case 'user_text':
        parts.push(`USER: ${e.text}`);
        break;
      case 'assistant_text':
        parts.push(`ASSISTANT: ${e.text}`);
        break;
      case 'tool_call': {
        if (typeof e.summary === 'string' && e.summary.length > 0) {
          parts.push(`TOOL[${e.tool}]: ${e.summary}`);
        }
        // tool_call without a summary contributes no text.
        break;
      }
      default: {
        const _never: never = e;
        throw new Error(
          `composeText: unexpected event kind: ${JSON.stringify(_never)}`,
        );
      }
    }
  }
  return parts.join('\n\n');
}

export async function processSession(
  doc: SessionDocument,
  deps: ProcessDeps,
): Promise<ProcessResult> {
  const sessionId = doc.sessionId;
  try {
    if (doc.events.length === 0) {
      deps.logger.warn(
        {
          source: 'capture-worker',
          action: 'skip_empty_events',
          sessionId,
        },
        'cowork session has zero events; skipping',
      );
      return { status: 'skipped_empty_events' };
    }

    const flat = flattenEvents(doc.events);
    const composed = composeText(flat);

    if (composed.trim().length === 0) {
      deps.logger.info(
        {
          source: 'capture-worker',
          action: 'skip_no_embeddable_text',
          sessionId,
        },
        'cowork session has no embeddable text; skipping',
      );
      return { status: 'skipped_no_embeddable' };
    }

    const redaction = await deps.redactFn({
      source: SOURCE,
      body: composed,
      anthropicApiKey: deps.anthropicApiKey,
    });

    if (redaction.status === 'blocked') {
      // Drop-on-block: log only the metadata. Redaction-pass body text
      // NEVER appears in the log.
      deps.logger.info(
        {
          source: 'capture-worker',
          action: 'block_cowork',
          reason: redaction.reason,
          sessionId,
        },
        '',
      );
      return { status: 'blocked', reason: redaction.reason };
    }

    const chunks = deps.chunkFn(redaction.redactedText);
    if (chunks.length === 0) {
      deps.logger.debug(
        {
          source: 'capture-worker',
          action: 'skip_empty_after_chunk',
          sessionId,
        },
        'no chunks produced for cowork session',
      );
      return { status: 'skipped_no_embeddable' };
    }

    const capturedAt = new Date(doc.createdAt);
    if (Number.isNaN(capturedAt.getTime())) {
      return {
        status: 'failed',
        error: `session ${sessionId} has invalid createdAt: ${doc.createdAt}`,
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
      const sourceId = formatSourceId(sessionId, i);

      const inserted = await deps.db
        .insert(captureSignals)
        .values({
          source: SOURCE,
          sourceId,
          sourceUrl: null,
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
    // Structured error: name the session id for triage. Body text NEVER
    // logged here.
    deps.logger.error(
      {
        source: 'capture-worker',
        action: 'process_session_failed',
        sessionId,
      },
      `processSession threw: ${message}`,
    );
    return { status: 'failed', error: message };
  }
}
