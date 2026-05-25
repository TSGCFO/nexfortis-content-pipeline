/**
 * Minimal HTML escaper for the three Telegram message templates.
 *
 * Mirrors `escapeTelegramHtml` in the synthesis-worker sender (we duplicate
 * rather than reach across artifacts per the "do not consolidate" rule).
 *
 * Order matters: `&` must be replaced first so that subsequent replacements
 * of `<` / `>` (which never produce `&`) do not get double-escaped.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
