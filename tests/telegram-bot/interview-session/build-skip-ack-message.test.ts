/**
 * Unit tests for `buildSkipAckMessage`. Pure function — zero mocks.
 */

import { describe, expect, it } from 'vitest';

import { buildSkipAckMessage } from '../../../artifacts/telegram-bot/src/jobs/interview-session/build-skip-ack-message.js';

describe('buildSkipAckMessage', () => {
  it('contains the proposed title verbatim (after escaping)', () => {
    const msg = buildSkipAckMessage({
      proposedTitle: 'Configuring Conditional Access for iOS',
    });
    expect(msg).toContain('Configuring Conditional Access for iOS');
  });

  it("renders the apostrophe in You'll as &#39;", () => {
    const msg = buildSkipAckMessage({ proposedTitle: 'Topic' });
    expect(msg).toContain('You&#39;ll hear from me next Monday');
    expect(msg).not.toContain("You'll");
  });

  it('HTML-escapes malicious <script> in the title', () => {
    const msg = buildSkipAckMessage({
      proposedTitle: '<script>alert(1)</script>',
    });
    expect(msg).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(msg).not.toContain('<script>');
    expect(msg).not.toContain('</script>');
  });
});
