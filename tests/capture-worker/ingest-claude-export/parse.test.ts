/**
 * Tests for the Claude (claude.ai web) export parser.
 *
 * Covers both accepted top-level shapes (array + `{conversations:[]}`),
 * structured vs flat message text, graceful skipping of junk, stable
 * original-position turn indices, role mapping, and the top-level
 * format-error. All fixtures are synthetic and mirror Anthropic's
 * conversations.json shape.
 */

import { describe, expect, it } from 'vitest';

import { ClaudeExportFormatError } from '../../../artifacts/capture-worker/src/jobs/ingest-claude-export/errors.js';
import {
  extractConversationsArray,
  parseClaudeExport,
} from '../../../artifacts/capture-worker/src/jobs/ingest-claude-export/parse.js';

// A conversation in the real export shape: top-level array, `chat_messages`
// with structured `content[]` blocks and `sender`.
function convo(uuid: string, name: string) {
  return {
    uuid,
    name,
    created_at: '2026-05-20T12:00:00Z',
    account: { uuid: 'acct-1' }, // unknown-to-us field — must be ignored
    chat_messages: [
      {
        uuid: `${uuid}-m0`,
        sender: 'human',
        created_at: '2026-05-20T12:00:01Z',
        content: [{ type: 'text', text: 'How do I fix AADSTS50158 on iOS?' }],
      },
      {
        uuid: `${uuid}-m1`,
        sender: 'assistant',
        created_at: '2026-05-20T12:00:05Z',
        content: [{ type: 'text', text: 'Add a device-compliance grant.' }],
      },
    ],
  };
}

describe('parseClaudeExport', () => {
  it('parses a top-level array of conversations (real export shape)', () => {
    const parsed = parseClaudeExport([convo('c1', 'A'), convo('c2', 'B'), convo('c3', 'C')]);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]!.conversationId).toBe('c1');
    expect(parsed[0]!.title).toBe('A');
    expect(parsed[0]!.turns).toHaveLength(2);
    expect(parsed[0]!.turns[0]!.role).toBe('human');
    expect(parsed[0]!.turns[1]!.role).toBe('assistant');
    expect(parsed[0]!.turns[0]!.text).toContain('AADSTS50158');
  });

  it('also accepts an object with a `conversations` array (spec shape)', () => {
    const parsed = parseClaudeExport({ conversations: [convo('c1', 'A')] });
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.conversationId).toBe('c1');
  });

  it('falls back to a flat `text` field when there are no content blocks', () => {
    const parsed = parseClaudeExport([
      {
        uuid: 'c1',
        created_at: '2026-05-20T12:00:00Z',
        chat_messages: [{ uuid: 'm0', sender: 'human', text: 'flat text turn' }],
      },
    ]);
    expect(parsed[0]!.turns[0]!.text).toBe('flat text turn');
  });

  it('uses the original message position as the turn index (stable across re-export)', () => {
    // First message has empty text and is dropped, but the kept turn keeps
    // its original index (1), so source_ids stay stable.
    const parsed = parseClaudeExport([
      {
        uuid: 'c1',
        created_at: '2026-05-20T12:00:00Z',
        chat_messages: [
          { uuid: 'm0', sender: 'human', content: [] }, // empty → skipped
          { uuid: 'm1', sender: 'assistant', text: 'real answer' },
        ],
      },
    ]);
    expect(parsed[0]!.turns).toHaveLength(1);
    expect(parsed[0]!.turns[0]!.index).toBe(1);
  });

  it('skips junk entries and conversations with no embeddable turns', () => {
    const parsed = parseClaudeExport([
      convo('c1', 'A'),
      null,
      42,
      { uuid: 'c2', chat_messages: [] }, // no turns
      { name: 'no id', chat_messages: [{ sender: 'human', text: 'hi' }] }, // no id
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.conversationId).toBe('c1');
  });

  it('inherits the conversation createdAt when a turn lacks its own', () => {
    const parsed = parseClaudeExport([
      {
        uuid: 'c1',
        created_at: '2026-05-20T12:00:00Z',
        chat_messages: [{ uuid: 'm0', sender: 'human', text: 'no per-turn ts' }],
      },
    ]);
    expect(parsed[0]!.turns[0]!.createdAt).toBe('2026-05-20T12:00:00Z');
  });

  it('throws ClaudeExportFormatError on an unrecognisable top-level shape', () => {
    expect(() => parseClaudeExport({ notConversations: [] })).toThrow(
      ClaudeExportFormatError,
    );
    expect(() => parseClaudeExport('a string')).toThrow(ClaudeExportFormatError);
    expect(() => parseClaudeExport(null)).toThrow(ClaudeExportFormatError);
  });
});

describe('extractConversationsArray', () => {
  it('returns the array for both accepted shapes and throws otherwise', () => {
    expect(extractConversationsArray([{ a: 1 }])).toHaveLength(1);
    expect(extractConversationsArray({ conversations: [{ a: 1 }] })).toHaveLength(1);
    expect(() => extractConversationsArray(123)).toThrow(ClaudeExportFormatError);
  });
});
