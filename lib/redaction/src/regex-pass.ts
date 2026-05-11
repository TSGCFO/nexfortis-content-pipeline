import type { RedactionLogEntry } from './types.js';

export interface PassReplacement {
  origStart: number;
  origEnd: number;
  postStart: number;
  postLen: number;
}

export interface RegexPassResult {
  redacted: string;
  log: RedactionLogEntry[];
}

export interface RegexPassInternalResult extends RegexPassResult {
  replacements: PassReplacement[];
}

const EMAIL_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

const E164_PHONE_REGEX = /\+[1-9]\d{7,14}\b/g;

const NANP_PHONE_REGEX =
  /(?<![\w.+-])(?:\+?1[\s.-]?)?(?:\(([2-9]\d{2})\)|([2-9]\d{2}))[\s.-]?([2-9]\d{2})[\s.-]?(\d{4})(?!\d)/g;

const SIN_REGEX = /(?<!\d)\d{3}[-\s]\d{3}[-\s]\d{3}(?!\d)/g;

const CC_CANDIDATE_REGEX = /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g;

const IPV4_REGEX =
  /(?<![\w.])(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?!\.?\d)/g;

const IPV6_REGEX = /(?<![\w:])(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}(?![\w:])/g;

const REPLACEMENTS = {
  email: '[REDACTED_EMAIL]',
  phone: '[REDACTED_PHONE]',
  sin: '[REDACTED_SIN]',
  cc: '[REDACTED_CC]',
  ip: '[REDACTED_IP]',
} as const;

interface RawMatch {
  type: keyof typeof REPLACEMENTS;
  start: number;
  end: number;
  replacement: string;
}

function luhnCheck(cleanedDigits: string): boolean {
  if (cleanedDigits.length === 0) return false;
  let sum = 0;
  let alt = false;
  for (let i = cleanedDigits.length - 1; i >= 0; i--) {
    const ch = cleanedDigits.charAt(i);
    const n = Number.parseInt(ch, 10);
    if (Number.isNaN(n)) return false;
    let v = n;
    if (alt) {
      v *= 2;
      if (v > 9) v -= 9;
    }
    sum += v;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function creditCardLuhnValid(text: string): boolean {
  const cleaned = text.replace(/[\s-]/g, '');
  if (cleaned.length < 13 || cleaned.length > 19) return false;
  return luhnCheck(cleaned);
}

function sinLuhnValid(text: string): boolean {
  const cleaned = text.replace(/[\s-]/g, '');
  if (cleaned.length !== 9) return false;
  return luhnCheck(cleaned);
}

function collectMatches(
  text: string,
  regex: RegExp,
  type: keyof typeof REPLACEMENTS,
  filter?: (match: string) => boolean,
): RawMatch[] {
  const results: RawMatch[] = [];
  for (const m of text.matchAll(regex)) {
    if (m.index === undefined) continue;
    const matched = m[0];
    if (filter && !filter(matched)) continue;
    results.push({
      type,
      start: m.index,
      end: m.index + matched.length,
      replacement: REPLACEMENTS[type],
    });
  }
  return results;
}

function dedupeOverlaps(matches: RawMatch[]): RawMatch[] {
  const sorted = [...matches].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - b.start - (a.end - a.start);
  });
  const out: RawMatch[] = [];
  let lastEnd = -1;
  for (const m of sorted) {
    if (m.start >= lastEnd) {
      out.push(m);
      lastEnd = m.end;
    }
  }
  return out;
}

export function regexPassInternal(text: string): RegexPassInternalResult {
  const all: RawMatch[] = [
    ...collectMatches(text, EMAIL_REGEX, 'email'),
    ...collectMatches(text, E164_PHONE_REGEX, 'phone'),
    ...collectMatches(text, NANP_PHONE_REGEX, 'phone'),
    ...collectMatches(text, SIN_REGEX, 'sin', sinLuhnValid),
    ...collectMatches(text, CC_CANDIDATE_REGEX, 'cc', creditCardLuhnValid),
    ...collectMatches(text, IPV4_REGEX, 'ip'),
    ...collectMatches(text, IPV6_REGEX, 'ip'),
  ];

  const filtered = dedupeOverlaps(all);

  let cursor = 0;
  const parts: string[] = [];
  const log: RedactionLogEntry[] = [];
  const replacements: PassReplacement[] = [];
  let delta = 0;

  for (const m of filtered) {
    if (m.start > cursor) {
      parts.push(text.slice(cursor, m.start));
    }
    const postStart = m.start + delta;
    parts.push(m.replacement);
    log.push({ type: m.type, offset: m.start, replacement: m.replacement });
    replacements.push({
      origStart: m.start,
      origEnd: m.end,
      postStart,
      postLen: m.replacement.length,
    });
    delta += m.replacement.length - (m.end - m.start);
    cursor = m.end;
  }
  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return { redacted: parts.join(''), log, replacements };
}

export function regexPass(text: string): RegexPassResult {
  const { redacted, log } = regexPassInternal(text);
  return { redacted, log };
}

export function mapPostOffsetToOriginal(
  postOffset: number,
  replacements: readonly PassReplacement[],
): number {
  let original = postOffset;
  for (const r of replacements) {
    const postEnd = r.postStart + r.postLen;
    if (postEnd <= postOffset) {
      const origLen = r.origEnd - r.origStart;
      original = original - r.postLen + origLen;
    } else if (r.postStart >= postOffset) {
      break;
    } else {
      return r.origStart;
    }
  }
  return original;
}
