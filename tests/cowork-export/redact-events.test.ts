import { describe, expect, it } from 'vitest';

import { redactEventTree } from '../../tools/nfx-cowork-export/src/redact-events.js';
import type { Event } from '../../tools/nfx-cowork-export/src/schema.js';

const baseTs = '2026-04-08T14:23:11.000Z';
const userText = (text: string): Event => ({
  kind: 'user_text',
  ts: baseTs,
  uuid: `u-${text.slice(0, 6)}`,
  text,
});
const asstText = (text: string): Event => ({
  kind: 'assistant_text',
  ts: baseTs,
  uuid: `a-${text.slice(0, 6)}`,
  text,
});
const toolCall = (tool: string, summary?: string): Event => ({
  kind: 'tool_call',
  ts: baseTs,
  uuid: `t-${tool}`,
  tool,
  ...(summary !== undefined ? { summary } : {}),
});

describe('redactEventTree — basic PII patterns', () => {
  it('redacts email addresses in user_text events', () => {
    const r = redactEventTree([userText('contact me at hassan@example.test for details')]);
    const out = r.events[0]!;
    expect(out.kind).toBe('user_text');
    if (out.kind === 'user_text') {
      expect(out.text).not.toContain('hassan@example.test');
      expect(out.text).toContain('[REDACTED_EMAIL]');
    }
    expect(r.summary.totalReplacements).toBe(1);
    expect(r.summary.replacementsByType['email']).toBe(1);
  });

  it('redacts email addresses in assistant_text events', () => {
    const r = redactEventTree([asstText('Sending to user@example.test now.')]);
    const out = r.events[0]!;
    if (out.kind === 'assistant_text') {
      expect(out.text).not.toContain('user@example.test');
    }
    expect(r.summary.replacementsByType['email']).toBe(1);
  });

  it('redacts email addresses in tool_call summary fields', () => {
    const r = redactEventTree([toolCall('Bash', 'mail -s test hassan@example.test')]);
    const out = r.events[0]!;
    if (out.kind === 'tool_call') {
      expect(out.summary).not.toContain('hassan@example.test');
    }
  });

  it('leaves the tool name itself alone (only summary is scanned)', () => {
    const r = redactEventTree([toolCall('mcp__example.test__tool')]);
    const out = r.events[0]!;
    if (out.kind === 'tool_call') {
      expect(out.tool).toBe('mcp__example.test__tool');
    }
  });

  it('counts the scanned field even when there are no replacements', () => {
    const r = redactEventTree([userText('no PII here')]);
    expect(r.summary.scannedTextFields).toBe(1);
    expect(r.summary.totalReplacements).toBe(0);
  });
});

describe('redactEventTree — multiple events + multiple PII per event', () => {
  it('handles multiple events independently', () => {
    const r = redactEventTree([
      userText('email a@example.test'),
      asstText('phone 416-555-1234'),
    ]);
    expect(r.summary.totalReplacements).toBe(2);
  });

  it('redacts multiple PII matches inside one event', () => {
    const r = redactEventTree([userText('email a@example.test and b@example.test together')]);
    expect(r.summary.totalReplacements).toBe(2);
    expect(r.summary.replacementsByType['email']).toBe(2);
  });
});

describe('redactEventTree — subagent recursion', () => {
  it('recurses into nested subagent events', () => {
    const subagent: Event = {
      kind: 'subagent',
      ts: baseTs,
      uuid: 's-1',
      subagentSlug: 'agent-x',
      parentToolUseId: 'toolu_1',
      events: [
        userText('inside subagent: contact@example.test'),
        asstText('replying to contact@example.test'),
      ],
    };
    const r = redactEventTree([userText('parent prompt'), subagent]);
    expect(r.summary.scannedTextFields).toBe(3); // 1 parent + 2 inside subagent
    expect(r.summary.totalReplacements).toBe(2); // both subagent texts had an email
    const outSub = r.events[1]!;
    if (outSub.kind === 'subagent') {
      const inner = outSub.events[0]!;
      if (inner.kind === 'user_text') {
        expect(inner.text).not.toContain('contact@example.test');
      }
    }
  });

  it('recurses through subagent-inside-subagent', () => {
    const inner: Event = {
      kind: 'subagent',
      ts: baseTs,
      uuid: 's-inner',
      subagentSlug: 'agent-y',
      parentToolUseId: 'toolu_2',
      events: [userText('deep: deep@example.test')],
    };
    const outer: Event = {
      kind: 'subagent',
      ts: baseTs,
      uuid: 's-outer',
      subagentSlug: 'agent-x',
      parentToolUseId: 'toolu_1',
      events: [inner],
    };
    const r = redactEventTree([outer]);
    expect(r.summary.totalReplacements).toBe(1);
  });
});

describe('redactEventTree — purity', () => {
  it('does NOT mutate the input event objects', () => {
    const original = userText('contact me at hassan@example.test');
    const originalText = (original as { text: string }).text;
    const events = [original];
    redactEventTree(events);
    expect((original as { text: string }).text).toBe(originalText);
    expect(events[0]).toBe(original); // input array still has the original reference
  });

  it('returns new objects (not aliased) for every kept event', () => {
    const original = userText('hello');
    const r = redactEventTree([original]);
    expect(r.events[0]).not.toBe(original);
  });
});

describe('redactEventTree — tool_call summary post-redaction length cap', () => {
  it('re-clamps tool_call.summary to 80 chars when redaction grows it past the cap', () => {
    // Construct a tool_call summary that's exactly at the limit AND contains
    // an email — redaction will grow it past 80, triggering the re-clamp.
    const original = 'navigate to http://example.test/login as ab@example.test for ops review purposes';
    expect(original.length).toBe(80);
    const r = redactEventTree([toolCall('mcp__Claude_in_Chrome__navigate', original)]);
    const out = r.events[0]!;
    if (out.kind === 'tool_call') {
      expect(out.summary).toBeDefined();
      expect(out.summary!.length).toBeLessThanOrEqual(80);
      // Email got redacted (replaced with [REDACTED_EMAIL])
      expect(out.summary!).not.toContain('ab@example.test');
    }
  });

  it('leaves a short redacted summary at its natural length (no padding)', () => {
    const r = redactEventTree([toolCall('Bash', 'echo a@example.test')]);
    const out = r.events[0]!;
    if (out.kind === 'tool_call') {
      expect(out.summary!.length).toBeLessThanOrEqual(80);
      expect(out.summary!).not.toContain('a@example.test');
      expect(out.summary!).toContain('[REDACTED_EMAIL]');
    }
  });
});
