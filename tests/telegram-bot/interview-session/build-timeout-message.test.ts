/**
 * Unit tests for `buildTimeoutMessage`. Pure function — zero mocks.
 */

import { describe, expect, it } from 'vitest';

import { buildTimeoutMessage } from '../../../artifacts/telegram-bot/src/jobs/interview-session/build-timeout-message.js';

describe('buildTimeoutMessage', () => {
  it('contains the proposed title verbatim (after escaping)', () => {
    const msg = buildTimeoutMessage({
      proposedTitle: 'Configuring Conditional Access for iOS',
    });
    expect(msg).toContain('Configuring Conditional Access for iOS');
  });

  it("renders the apostrophe in week's as &#39;", () => {
    const msg = buildTimeoutMessage({ proposedTitle: 'Topic' });
    expect(msg).toContain('This week&#39;s interview');
    expect(msg).not.toContain("week's");
  });

  it('HTML-escapes malicious <script> in the title', () => {
    const msg = buildTimeoutMessage({
      proposedTitle: '<script>alert(1)</script>',
    });
    expect(msg).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(msg).not.toContain('<script>');
    expect(msg).not.toContain('</script>');
  });
});
