/**
 * Shared types for the MS Graph email ingester.
 *
 * `GraphMessage` aliases the `Message` type from `@microsoft/microsoft-graph-types`
 * so the ingester is type-checked against the upstream schema.
 */

import type { Message } from '@microsoft/microsoft-graph-types';

export type GraphMessage = Message;

/**
 * Envelope returned by `GET /users/{upn}/messages`. The contract at
 * `docs/integration-contracts/msgraph-message.md` pins the shape: a top-level
 * `value` array of `Message` items, optionally with an `@odata.nextLink` for
 * pagination.
 */
export interface GraphMessagesPage {
  value: GraphMessage[];
  nextLink: string | undefined;
}

/**
 * Final outcome of `processMessage` for a single inbound message.
 *
 * Discriminated on `status` so callers handle each outcome explicitly. The
 * `blocked` variant carries no reason or message metadata — for email, even
 * an audit row could leak inferable PII, so the only trace of a blocked
 * message is the (PII-free) log line emitted at block time.
 */
export type ProcessResult =
  | {
      status: 'stored';
      signalsInserted: number;
      signalsSkippedDuplicate: number;
    }
  | { status: 'blocked' }
  | { status: 'skipped_empty' }
  | { status: 'skipped_draft' }
  | { status: 'failed'; error: string };

/**
 * Aggregate counters tracked across one run. Serialized into the run-summary
 * log line on completion. Spec reference: §5 NFR-07.
 */
export interface RunSummary {
  source: 'msgraph-email';
  signalsFetched: number;
  signalsNew: number;
  signalsSkippedDuplicate: number;
  signalsBlockedPii: number;
  signalsSkippedEmpty: number;
  signalsSkippedDraft: number;
  errors: number;
  cappedAt500: boolean;
}
