/**
 * Tool-call summary registry.
 *
 * For a small set of tools we extract a useful short summary from the
 * `tool_use` block's `input` payload (e.g. "the URL", "the file path",
 * "the search query"). For every other tool we emit no summary at all —
 * downstream consumers treat absence as "no useful summary available."
 *
 * Per the locked spec: never emit a generic "tool: X, target: <truncated JSON>"
 * placeholder. JSON-shaped tool-use inputs aren't useful corpus signal and
 * embedding them adds noise.
 *
 * Every summary is capped at 80 characters. The schema validator rejects
 * anything longer, so this is the right ceiling.
 */

const MAX_SUMMARY_LEN = 80;

export interface ToolSummaryExtractor {
  /**
   * Returns true if this extractor handles the given tool name.
   * Either an exact name list or a regex pattern.
   */
  matches: (toolName: string) => boolean;
  /**
   * Returns a short summary string, or `null` if the input shape doesn't
   * carry the expected field (in which case no summary is emitted for the
   * tool_call event, same as having no extractor at all).
   */
  extract: (input: unknown) => string | null;
}

/** Truncate to MAX_SUMMARY_LEN and squash any internal whitespace runs. */
function clamp(s: string): string {
  const collapsed = s.replace(/\s+/g, ' ').trim();
  return collapsed.length > MAX_SUMMARY_LEN ? collapsed.slice(0, MAX_SUMMARY_LEN) : collapsed;
}

/** Helper: read a string property off an `unknown` object. */
function readString(input: unknown, key: string): string | null {
  if (typeof input !== 'object' || input === null) return null;
  const v = (input as Record<string, unknown>)[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

const REGISTRY: ToolSummaryExtractor[] = [
  // Bash + workspace bash: first line of the command, or "bash (multi-line)"
  {
    matches: (n) => n === 'Bash' || n === 'mcp__workspace__bash',
    extract: (input) => {
      const cmd = readString(input, 'command');
      if (cmd === null) return null;
      const lines = cmd.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length === 0) return null;
      if (lines.length > 1) return 'bash (multi-line)';
      return clamp(lines[0]!);
    },
  },

  // Edit / Write: file path
  {
    matches: (n) => n === 'Edit' || n === 'Write',
    extract: (input) => {
      const p = readString(input, 'file_path');
      return p === null ? null : clamp(p);
    },
  },

  // Read: file path
  {
    matches: (n) => n === 'Read',
    extract: (input) => {
      const p = readString(input, 'file_path');
      return p === null ? null : clamp(p);
    },
  },

  // Chrome MCP navigate: URL
  {
    matches: (n) => n === 'mcp__Claude_in_Chrome__navigate',
    extract: (input) => {
      const url = readString(input, 'url');
      return url === null ? null : clamp(url);
    },
  },

  // WebFetch + workspace web_fetch: URL
  {
    matches: (n) => n === 'WebFetch' || n === 'mcp__workspace__web_fetch',
    extract: (input) => {
      const url = readString(input, 'url');
      return url === null ? null : clamp(url);
    },
  },

  // WebSearch + any mcp__<server>__search: query
  // Use a regex for the mcp__*__search wildcard; exact match for WebSearch.
  {
    matches: (n) => n === 'WebSearch' || /^mcp__[^_].*__search$/.test(n),
    extract: (input) => {
      const q = readString(input, 'query');
      return q === null ? null : clamp(q);
    },
  },

  // Glob / Grep: pattern
  {
    matches: (n) => n === 'Glob' || n === 'Grep',
    extract: (input) => {
      const p = readString(input, 'pattern');
      return p === null ? null : clamp(p);
    },
  },

  // cowork present_files: joined file paths
  {
    matches: (n) => n === 'mcp__cowork__present_files',
    extract: (input) => {
      if (typeof input !== 'object' || input === null) return null;
      const files = (input as Record<string, unknown>)['files'];
      if (!Array.isArray(files) || files.length === 0) return null;
      const paths = files
        .map((f) => (typeof f === 'object' && f !== null ? (f as Record<string, unknown>)['file_path'] : f))
        .filter((p): p is string => typeof p === 'string')
        .join(', ');
      return paths.length === 0 ? null : clamp(paths);
    },
  },

  // TaskCreate / TaskUpdate: subject or title
  {
    matches: (n) => n === 'TaskCreate' || n === 'TaskUpdate',
    extract: (input) => {
      // TaskCreate uses `subject`; TaskUpdate may use either.
      const subj = readString(input, 'subject') ?? readString(input, 'title');
      return subj === null ? null : clamp(subj);
    },
  },

  // AskUserQuestion: text of the first question
  {
    matches: (n) => n === 'AskUserQuestion',
    extract: (input) => {
      if (typeof input !== 'object' || input === null) return null;
      const qs = (input as Record<string, unknown>)['questions'];
      if (!Array.isArray(qs) || qs.length === 0) return null;
      const first = qs[0];
      if (typeof first !== 'object' || first === null) return null;
      const text = (first as Record<string, unknown>)['question'];
      return typeof text === 'string' && text.length > 0 ? clamp(text) : null;
    },
  },
];

/**
 * Get the registered extractor for the named tool, or `null` if none matches.
 */
export function findExtractor(toolName: string): ToolSummaryExtractor | null {
  for (const ex of REGISTRY) {
    if (ex.matches(toolName)) return ex;
  }
  return null;
}

/**
 * Apply the registry to a `(name, input)` pair. Returns the extracted summary
 * (always ≤ 80 chars), or `null` if no extractor matched or the input shape
 * didn't carry what we expected.
 */
export function extractToolSummary(name: string, input: unknown): string | null {
  const ex = findExtractor(name);
  if (ex === null) return null;
  return ex.extract(input);
}
