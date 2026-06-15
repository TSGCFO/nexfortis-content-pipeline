/**
 * Parser for the Claude (claude.ai web) data export.
 *
 * Anthropic's account data export delivers a `conversations.json` whose
 * top level is an ARRAY of conversations, each with a `chat_messages`
 * array. (The repo's original spec assumed an object with a `conversations`
 * key — that predates anyone having a real export. We accept BOTH shapes so
 * the parser is robust to either, and to a future format tweak.)
 *
 * The parser is pure and total over its input: it narrows from `unknown`,
 * ignores unknown fields, skips entries it can't make sense of (per the
 * PRD's "unknown field is handled gracefully" requirement), and throws
 * `ClaudeExportFormatError` ONLY when the top-level shape is unrecognisable.
 * Per-conversation problems are skipped, never fatal.
 */

import { ClaudeExportFormatError } from './errors.js';
import type { ParsedConversation, ParsedTurn, TurnRole } from './types.js';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return null;
}

/**
 * Locate the conversations array, accepting either a top-level array (the
 * real export shape) or an object with a `conversations` array (the spec's
 * assumed shape). Throws `ClaudeExportFormatError` otherwise.
 */
export function extractConversationsArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  const rec = asRecord(parsed);
  if (rec && Array.isArray(rec['conversations'])) {
    return rec['conversations'] as unknown[];
  }
  throw new ClaudeExportFormatError(
    'expected a top-level array of conversations, or an object with a "conversations" array',
  );
}

/**
 * Extract a turn's text. Prefers structured `content[].text` blocks (the
 * current export shape), falling back to a flat `text` field (older shape).
 */
function extractTurnText(message: Record<string, unknown>): string {
  const content = message['content'];
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      const b = asRecord(block);
      if (b && typeof b['text'] === 'string') parts.push(b['text']);
    }
    if (parts.length > 0) return parts.join('\n').trim();
  }
  const text = message['text'];
  return typeof text === 'string' ? text.trim() : '';
}

function normalizeRole(value: unknown): TurnRole {
  return value === 'assistant' ? 'assistant' : 'human';
}

/**
 * Narrow one raw conversation. Returns `null` (skip) when it's not an object,
 * lacks an id, has no message array, or yields no embeddable turns.
 */
function parseConversation(raw: unknown): ParsedConversation | null {
  const c = asRecord(raw);
  if (!c) return null;

  const conversationId = firstNonEmptyString(
    c['uuid'],
    c['conversation_id'],
    c['id'],
  );
  if (conversationId === null) return null;

  const createdAt =
    firstNonEmptyString(c['created_at'], c['createdAt']) ??
    new Date(0).toISOString();
  const title = firstNonEmptyString(c['name'], c['title']) ?? '';

  const messages = c['chat_messages'] ?? c['messages'];
  if (!Array.isArray(messages)) return null;

  const turns: ParsedTurn[] = [];
  for (let i = 0; i < messages.length; i += 1) {
    const message = asRecord(messages[i]);
    if (!message) continue;
    const text = extractTurnText(message);
    if (text.length === 0) continue;
    turns.push({
      index: i,
      role: normalizeRole(message['sender'] ?? message['role']),
      text,
      createdAt:
        firstNonEmptyString(message['created_at'], message['createdAt']) ??
        createdAt,
    });
  }

  if (turns.length === 0) return null;
  return { conversationId, title, createdAt, turns };
}

/**
 * Parse a Claude export (already `JSON.parse`d) into conversations with
 * embeddable turns. Throws `ClaudeExportFormatError` only on top-level shape
 * mismatch; unparseable individual conversations are skipped.
 */
export function parseClaudeExport(parsed: unknown): ParsedConversation[] {
  const rawConversations = extractConversationsArray(parsed);
  const result: ParsedConversation[] = [];
  for (const raw of rawConversations) {
    const conversation = parseConversation(raw);
    if (conversation !== null) result.push(conversation);
  }
  return result;
}
