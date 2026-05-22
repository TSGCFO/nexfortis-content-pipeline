import { describe, expect, it } from 'vitest';

import { stripHtml } from '../../../artifacts/capture-worker/src/jobs/ingest-msgraph-email/html-strip.js';

describe('stripHtml', () => {
  it('passes plain text through unchanged', () => {
    expect(stripHtml('Hello, world.')).toBe('Hello, world.');
  });

  it('strips a simple paragraph tag wrapper', () => {
    expect(stripHtml('<p>Hello</p>')).toBe('Hello');
  });

  it('drops <script> block contents entirely', () => {
    expect(stripHtml('<script>alert(1)</script>visible')).toBe('visible');
  });

  it('drops <style> block contents entirely', () => {
    expect(stripHtml('<style>p { color: red; }</style>visible')).toBe('visible');
  });

  it('decodes common HTML entities', () => {
    expect(stripHtml('Hi &amp; bye')).toBe('Hi & bye');
    expect(stripHtml('a &lt; b')).toBe('a < b');
    expect(stripHtml('c &gt; d')).toBe('c > d');
    expect(stripHtml('she said &quot;hi&quot;')).toBe('she said "hi"');
    expect(stripHtml("it&#39;s here")).toBe("it's here");
  });

  it('collapses runs of whitespace (including &nbsp;) to a single space', () => {
    expect(stripHtml('foo&nbsp;&nbsp;bar')).toBe('foo bar');
    expect(stripHtml('foo\n\n\nbar\t\tbaz')).toBe('foo bar baz');
  });

  it('returns the empty string for empty / non-string input', () => {
    expect(stripHtml('')).toBe('');
    expect(stripHtml('   ')).toBe('');
    expect(stripHtml('<p></p>')).toBe('');
  });

  it('handles realistic multi-tag HTML email body shape', () => {
    const html =
      '<html><head><meta charset="utf-8"></head><body><p>Hello there.</p><p>How are you?</p></body></html>';
    const result = stripHtml(html);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).toBe('Hello there. How are you?');
  });
});
