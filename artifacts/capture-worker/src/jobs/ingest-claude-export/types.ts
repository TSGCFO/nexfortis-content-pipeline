/**
 * Types for the Claude (claude.ai web) data-export ingester.
 *
 * The parser narrows the raw export JSON (typed `unknown`) into these
 * structures; the job (`index.ts`) and per-turn pipeline (`process.ts`)
 * consume them. Keeping the parsed shape minimal — only what we embed —
 * is deliberate: tool payloads, attachments, and account metadata in the
 * raw export are never carried forward.
 */

/** Who produced a turn. Anything not clearly the assistant is treated as the human. */
export type TurnRole = 'human' | 'assistant';

/** One message turn extracted from a conversation. */
export interface ParsedTurn {
  /**
   * Position of this message in the conversation's original message array
   * (NOT a re-counted index over embeddable turns). Used to build a stable
   * `source_id` so re-exports of the same data dedup cleanly.
   */
  index: number;
  role: TurnRole;
  /** Extracted text (from structured `content[].text` or flat `text`). */
  text: string;
  /** ISO timestamp; falls back to the conversation's createdAt when absent. */
  createdAt: string;
}

/** One conversation with its embeddable turns. */
export interface ParsedConversation {
  conversationId: string;
  title: string;
  createdAt: string;
  turns: ParsedTurn[];
}
