/**
 * Small helpers shared across the exporter.
 */

const ISO_UTC_MS_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * Returns true iff the string matches the strict ISO 8601 UTC ms format used
 * everywhere in the schema. Useful at the parser boundary before constructing
 * an event.
 */
export function isValidTimestamp(s: string): boolean {
  return ISO_UTC_MS_REGEX.test(s);
}
