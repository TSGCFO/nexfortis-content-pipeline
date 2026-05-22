/**
 * Regex-only HTML → plain-text reducer.
 *
 * Used by the MS Graph email ingester to convert `message.body.content` into
 * the plain text we feed to `redact()`. Pulling in `cheerio` / `jsdom` /
 * `node-html-parser` would be overkill for the narrow shape of email bodies
 * and is explicitly disallowed by the prompt's dependency policy.
 *
 * Order matters and is fixed:
 *   1. Drop `<script>…</script>` and `<style>…</style>` blocks (contents too)
 *   2. Drop all remaining tags
 *   3. Decode the handful of HTML entities commonly seen in email bodies
 *   4. Collapse runs of whitespace into single spaces
 *   5. Trim leading/trailing whitespace
 */

const SCRIPT_OR_STYLE_BLOCK_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const TAG_RE = /<[^>]+>/g;
const WHITESPACE_RUN_RE = /\s+/g;

const ENTITY_DECODE_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/&nbsp;/gi, ' '],
  [/&amp;/gi, '&'],
  [/&lt;/gi, '<'],
  [/&gt;/gi, '>'],
  [/&quot;/gi, '"'],
  [/&#39;/g, "'"],
];

export function stripHtml(html: string): string {
  if (typeof html !== 'string' || html.length === 0) {
    return '';
  }
  let out = html.replace(SCRIPT_OR_STYLE_BLOCK_RE, ' ');
  out = out.replace(TAG_RE, ' ');
  for (const [pattern, replacement] of ENTITY_DECODE_RULES) {
    out = out.replace(pattern, replacement);
  }
  out = out.replace(WHITESPACE_RUN_RE, ' ');
  return out.trim();
}
