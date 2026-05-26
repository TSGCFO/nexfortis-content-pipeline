/**
 * Tests for the pure `/status` reply formatter.
 *
 * Covers:
 *   1. All fields populated → message contains each
 *   2. No active session → "No session in progress"
 *   3. No recent signals → reports 0
 *   4. HTML-injection regression on candidate title
 *   5. Determinism
 */

import { describe, expect, it } from 'vitest';

import { buildStatusMessage } from '../../../../artifacts/telegram-bot/src/bot/handlers/status-builder.js';
import type { StatusSnapshot } from '../../../../artifacts/telegram-bot/src/jobs/interview-session/types.js';

const FIXED_TS = new Date('2026-05-25T12:00:00Z');

const FULL_SNAPSHOT: StatusSnapshot = {
  signalsLast7Days: 17,
  lastSynthesisAt: FIXED_TS,
  activeCandidate: {
    proposedTitle: 'Conditional Access for iOS',
    status: 'awaiting_interview',
  },
  activeSessionStatus: 'confirming',
  questionsSentThisSession: 3,
};

describe('buildStatusMessage', () => {
  it('renders every populated field', () => {
    const out = buildStatusMessage(FULL_SNAPSHOT);
    expect(out).toContain('17');
    expect(out).toContain(FIXED_TS.toISOString());
    expect(out).toContain('Conditional Access for iOS');
    expect(out).toContain('awaiting_interview');
    expect(out).toContain('confirming');
    expect(out).toContain('3');
  });

  it('returns "No session in progress" when activeSessionStatus is null', () => {
    const out = buildStatusMessage({
      ...FULL_SNAPSHOT,
      activeSessionStatus: null,
      questionsSentThisSession: 0,
    });
    expect(out).toContain('No session in progress.');
  });

  it('returns "No active candidate" when activeCandidate is null', () => {
    const out = buildStatusMessage({
      ...FULL_SNAPSHOT,
      activeCandidate: null,
    });
    expect(out).toContain('No active candidate.');
  });

  it('renders signalsLast7Days = 0 cleanly', () => {
    const out = buildStatusMessage({
      ...FULL_SNAPSHOT,
      signalsLast7Days: 0,
    });
    expect(out).toMatch(/last 7 days\)?:\s*0/);
  });

  it('renders lastSynthesisAt = null as "never"', () => {
    const out = buildStatusMessage({
      ...FULL_SNAPSHOT,
      lastSynthesisAt: null,
    });
    expect(out).toContain('Last synthesis run: never');
  });

  it('HTML-escapes candidate title containing <script>', () => {
    const out = buildStatusMessage({
      ...FULL_SNAPSHOT,
      activeCandidate: {
        proposedTitle: '<script>alert(1)</script>',
        status: 'pending',
      },
    });
    expect(out).toContain('&lt;script&gt;');
    expect(out).not.toContain('<script>alert(1)</script>');
  });

  it('is deterministic: same input → same output', () => {
    const a = buildStatusMessage(FULL_SNAPSHOT);
    const b = buildStatusMessage(FULL_SNAPSHOT);
    expect(a).toBe(b);
  });
});
