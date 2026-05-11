import type { RedactionLogEntry } from './types.js';

/**
 * Tracks each regex-pass replacement so the orchestrator can remap
 * post-pass-1 offsets (used by the Haiku scrub) back to offsets in the
 * original pre-redaction text.
 */
export interface RegexReplacement {
  type: string;
  originalStart: number;
  originalEnd: number;
  replacement: string;
  replacementLength: number;
}

export interface RegexPassResult {
  redacted: string;
  log: RedactionLogEntry[];
  replacements: RegexReplacement[];
}

interface PatternDef {
  type: string;
  replacement: string;
  regex: RegExp;
  validate?: (matchText: string) => boolean;
}

function luhn(digits: string): boolean {
  if (digits.length === 0 || !/^\d+$/.test(digits)) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    const ch = digits.charAt(i);
    let n = Number.parseInt(ch, 10);
    if (Number.isNaN(n)) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

const PATTERNS: readonly PatternDef[] = Object.freeze([
  {
    type: 'email',
    replacement: '[REDACTED_EMAIL]',
    regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  },
  {
    type: 'phone',
    replacement: '[REDACTED_PHONE]',
    regex: /(?<![\w.])\+[1-9]\d{6,14}(?!\d)/g,
  },
  {
    type: 'phone',
    replacement: '[REDACTED_PHONE]',
    regex: /(?<![\w.])(?:\(\d{3}\)\s?\d{3}[-. ]\d{4}|\d{3}[-. ]\d{3}[-. ]\d{4})(?!\d)/g,
  },
  {
    type: 'phone',
    replacement: '[REDACTED_PHONE]',
    regex: /(?<![\w.])\d{10}(?!\d)/g,
  },
  {
    type: 'sin',
    replacement: '[REDACTED_SIN]',
    regex: /\b\d{3}-\d{3}-\d{3}\b/g,
    validate: (m) => luhn(m.replace(/\D/g, '')),
  },
  {
    type: 'cc',
    replacement: '[REDACTED_CC]',
    regex: /(?<!\d)(?:\d[ -]?){13,19}(?!\d)/g,
    validate: (m) => {
      const digits = m.replace(/\D/g, '');
      return digits.length >= 13 && digits.length <= 19 && luhn(digits);
    },
  },
  {
    type: 'ipv4',
    replacement: '[REDACTED_IP]',
    regex:
      /(?<![\w.])(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?![\w.])/g,
  },
  {
    type: 'ipv6',
    replacement: '[REDACTED_IP]',
    regex: /(?<![\w:])(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}(?![\w:])/g,
  },
]);

interface CandidateMatch {
  start: number;
  end: number;
  type: string;
  replacement: string;
  priority: number;
}

function collectCandidates(text: string): CandidateMatch[] {
  const candidates: CandidateMatch[] = [];
  PATTERNS.forEach((pattern, priority) => {
    const re = new RegExp(pattern.regex.source, pattern.regex.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const matched = m[0];
      if (matched.length === 0) {
        re.lastIndex += 1;
        continue;
      }
      if (pattern.validate && !pattern.validate(matched)) continue;
      candidates.push({
        start: m.index,
        end: m.index + matched.length,
        type: pattern.type,
        replacement: pattern.replacement,
        priority,
      });
    }
  });
  return candidates;
}

function dedupeOverlaps(candidates: CandidateMatch[]): CandidateMatch[] {
  // Earliest start wins. For ties: longer match wins; then earlier-listed pattern.
  const sorted = candidates.slice().sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    const aLen = a.end - a.start;
    const bLen = b.end - b.start;
    if (aLen !== bLen) return bLen - aLen;
    return a.priority - b.priority;
  });
  const accepted: CandidateMatch[] = [];
  let lastEnd = -1;
  for (const c of sorted) {
    if (c.start >= lastEnd) {
      accepted.push(c);
      lastEnd = c.end;
    }
  }
  return accepted;
}

export function regexPass(text: string): RegexPassResult {
  const candidates = collectCandidates(text);
  const accepted = dedupeOverlaps(candidates).sort((a, b) => a.start - b.start);

  const replacements: RegexReplacement[] = accepted.map((c) => ({
    type: c.type,
    originalStart: c.start,
    originalEnd: c.end,
    replacement: c.replacement,
    replacementLength: c.replacement.length,
  }));

  // Replace right-to-left to keep earlier offsets stable.
  let redacted = text;
  for (let i = accepted.length - 1; i >= 0; i--) {
    const m = accepted[i];
    if (!m) continue;
    redacted = redacted.slice(0, m.start) + m.replacement + redacted.slice(m.end);
  }

  const log: RedactionLogEntry[] = accepted.map((c) => ({
    type: c.type,
    offset: c.start,
    replacement: c.replacement,
  }));

  return { redacted, log, replacements };
}
