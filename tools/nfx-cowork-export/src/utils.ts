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

/**
 * Pulls the Cowork workspace-id (a UUID) out of a session-folder path.
 *
 * The Cowork on-disk layout has the workspace UUID a few segments up from the
 * session folder (`local_<uuid>`). Position differs between the live layout
 * and the backup layout, so we walk up from the session folder and return the
 * first ancestor segment that looks like a UUID (8-4-4-4-12 hex).
 *
 * Path normalization: replaces backslashes with forward slashes first, so
 * Windows backup paths work identically to POSIX ones.
 *
 * Returns `null` when nothing UUID-shaped is found above the session folder
 * (callers treat that as "unknown workspace" and use a placeholder string in
 * the audit / `workspaceId` field).
 */
export function workspaceIdFromPath(sessionFolder: string): string | null {
  const normalized = sessionFolder.replace(/\\/g, '/');
  const segments = normalized.split('/').filter((s) => s.length > 0);
  // Walk up from the session folder (local_<uuid>) and grab the first
  // UUID-shaped ancestor.
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (let i = segments.length - 2; i >= 0; i--) {
    const seg = segments[i]!;
    if (uuidPattern.test(seg)) return seg;
  }
  return null;
}
