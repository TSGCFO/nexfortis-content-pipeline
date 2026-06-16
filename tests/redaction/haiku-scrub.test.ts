/**
 * Tests for the Claude entity scrub (pass 2 of redaction).
 *
 * Two concerns are covered without any network call:
 *   1. `splitIntoWindows` — the pure windowing helper that bounds each scrub
 *      response so long captures no longer truncate the model's JSON and
 *      fail-close. The key invariant is that windows concatenate back to
 *      exactly the input.
 *   2. `haikuScrub` driven by an injected fake client — multi-window
 *      stitching, global offset mapping for the audit log, and fail-closed
 *      behaviour on a window error or a safety refusal.
 *
 * A real Anthropic client is never constructed: every test passes
 * `opts.client`.
 */

import { describe, expect, it } from 'vitest';

import {
  haikuScrub,
  splitIntoWindows,
  type ScrubAnthropicLike,
} from '../../lib/redaction/src/haiku-scrub.js';

/** Fake client that replays a fixed list of JSON responses, one per call. */
function fakeClient(
  responses: Array<{ stop_reason?: string; redacted?: string; entities?: unknown } | Error>,
): { client: ScrubAnthropicLike; calls: () => number } {
  let i = 0;
  const client: ScrubAnthropicLike = {
    messages: {
      create: (_args) => {
        const next = responses[i];
        i += 1;
        if (next instanceof Error) return Promise.reject(next);
        if (next === undefined) {
          return Promise.reject(new Error('fake client: no response queued'));
        }
        if (next.stop_reason === 'refusal') {
          return Promise.resolve({ stop_reason: 'refusal', content: [] });
        }
        const body = JSON.stringify({
          redacted: next.redacted ?? '',
          entities: next.entities ?? [],
        });
        return Promise.resolve({ content: [{ type: 'text', text: body }] });
      },
    },
  };
  return { client, calls: () => i };
}

describe('splitIntoWindows', () => {
  it('returns [] for empty input and a single window when within the cap', () => {
    expect(splitIntoWindows('', 100)).toEqual([]);
    expect(splitIntoWindows('short', 100)).toEqual(['short']);
  });

  it('reconstructs the input exactly and never exceeds maxChars', () => {
    const text = Array.from({ length: 50 }, (_, i) => `paragraph ${i} `.repeat(20)).join(
      '\n\n',
    );
    const windows = splitIntoWindows(text, 500);
    expect(windows.join('')).toBe(text);
    for (const w of windows) expect(w.length).toBeLessThanOrEqual(500);
    expect(windows.length).toBeGreaterThan(1);
  });

  it('prefers cutting on a paragraph boundary', () => {
    const p1 = 'A'.repeat(70);
    const p2 = 'B'.repeat(70);
    const text = `${p1}\n\n${p2}`;
    const windows = splitIntoWindows(text, 100);
    // First window ends right after the "\n\n" rather than mid-paragraph.
    expect(windows[0]).toBe(`${p1}\n\n`);
    expect(windows[1]).toBe(p2);
    expect(windows.join('')).toBe(text);
  });

  it('falls back to a line boundary, then a hard split', () => {
    const lineBreaks = `${'A'.repeat(60)}\n${'B'.repeat(60)}`;
    const lw = splitIntoWindows(lineBreaks, 100);
    expect(lw[0]).toBe(`${'A'.repeat(60)}\n`);
    expect(lw.join('')).toBe(lineBreaks);

    const noBreaks = 'C'.repeat(250);
    const hw = splitIntoWindows(noBreaks, 100);
    expect(hw).toEqual(['C'.repeat(100), 'C'.repeat(100), 'C'.repeat(50)]);
  });
});

describe('haikuScrub', () => {
  it('scrubs a single window and returns its redacted text + log', async () => {
    const { client, calls } = fakeClient([
      {
        redacted: 'clean text',
        entities: [{ type: 'person', offset: 0, length: 4, replacement: '[REDACTED_PERSON]' }],
      },
    ]);
    const res = await haikuScrub('Jane lives here', { anthropicApiKey: 'k', client });
    expect(calls()).toBe(1);
    expect(res.redacted).toBe('clean text');
    expect(res.log).toEqual([
      { type: 'person', offset: 0, replacement: '[REDACTED_PERSON]' },
    ]);
  });

  it('stitches multiple windows and shifts entity offsets by the window base', async () => {
    const p1 = 'A'.repeat(7000);
    const p2 = 'B'.repeat(3000);
    const text = `${p1}\n\n${p2}`; // 10_002 chars → splits at the "\n\n" (7002)

    const { client, calls } = fakeClient([
      { redacted: 'X1', entities: [] },
      {
        redacted: 'X2',
        // offset is window-local (within p2); expect it shifted by 7002.
        entities: [{ type: 'company', offset: 5, length: 4, replacement: '[REDACTED_COMPANY]' }],
      },
    ]);

    const res = await haikuScrub(text, { anthropicApiKey: 'k', client });
    expect(calls()).toBe(2);
    expect(res.redacted).toBe('X1X2');
    expect(res.log).toEqual([
      { type: 'company', offset: 7002 + 5, replacement: '[REDACTED_COMPANY]' },
    ]);
  });

  it('fails closed (throws) when any window errors', async () => {
    const p1 = 'A'.repeat(7000);
    const p2 = 'B'.repeat(3000);
    const text = `${p1}\n\n${p2}`;
    const { client } = fakeClient([
      { redacted: 'X1', entities: [] },
      new Error('boom on window 2'),
    ]);
    await expect(haikuScrub(text, { anthropicApiKey: 'k', client })).rejects.toThrow();
  });

  it('fails closed on a safety refusal', async () => {
    const { client } = fakeClient([{ stop_reason: 'refusal' }]);
    await expect(haikuScrub('anything', { anthropicApiKey: 'k', client })).rejects.toThrow(
      /refused/,
    );
  });

  it('still requires an api key even when a client is injected', async () => {
    const { client } = fakeClient([{ redacted: 'x', entities: [] }]);
    await expect(haikuScrub('t', { anthropicApiKey: '', client })).rejects.toThrow(
      /anthropicApiKey is required/,
    );
  });

  it('does NOT fail closed on an out-of-range offset (offsets are audit-only)', async () => {
    // The model miscounts a character offset — common on long windows. The
    // redaction must still succeed; the offset is clamped into range for the log.
    const { client } = fakeClient([
      {
        redacted: 'clean',
        entities: [
          { type: 'person', offset: 9999, length: 5, replacement: '[REDACTED_PERSON]' },
        ],
      },
    ]);
    const res = await haikuScrub('short text', { anthropicApiKey: 'k', client });
    expect(res.redacted).toBe('clean');
    expect(res.log).toHaveLength(1);
    // Clamped to the window length (10) with length collapsed to 0.
    expect(res.log[0]).toEqual({ type: 'person', offset: 10, replacement: '[REDACTED_PERSON]' });
  });

  it('drops an entity with an unusable type but keeps the redaction', async () => {
    const { client } = fakeClient([
      {
        redacted: 'kept',
        entities: [
          { type: 'not-a-type', offset: 0, length: 1, replacement: 'x' },
          { type: 'address', offset: 0, length: 2, replacement: '[REDACTED_ADDRESS]' },
        ],
      },
    ]);
    const res = await haikuScrub('a building', { anthropicApiKey: 'k', client });
    expect(res.redacted).toBe('kept');
    expect(res.log).toEqual([
      { type: 'address', offset: 0, replacement: '[REDACTED_ADDRESS]' },
    ]);
  });
});
