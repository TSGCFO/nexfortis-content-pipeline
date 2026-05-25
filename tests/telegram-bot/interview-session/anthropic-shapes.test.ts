/**
 * Unit tests for the hand-rolled `parseQuestionResponse` narrower.
 *
 * Structured outputs at the Anthropic layer should guarantee the shape,
 * but we still defensively post-validate because (a) the SDK type doesn't
 * surface structured-outputs at compile time and (b) we want a hard
 * boundary on malformed responses (e.g. partial buffering errors).
 */

import { describe, expect, it } from 'vitest';

import {
  QUESTION_JSON_SCHEMA,
  parseQuestionResponse,
} from '../../../artifacts/telegram-bot/src/jobs/interview-session/anthropic-shapes.js';

const VALID = {
  question_text: 'q',
  signal_id: '00000000-0000-0000-0000-000000000000',
  evidence_phrase: 'p',
  detected_specifics: ['x', 'y'],
  no_specifics: false,
};

describe('parseQuestionResponse', () => {
  it('parses a valid JSON object into a QuestionResponse', () => {
    const out = parseQuestionResponse(JSON.stringify(VALID));
    expect(out).not.toBeNull();
    expect(out?.question_text).toBe('q');
    expect(out?.signal_id).toBe('00000000-0000-0000-0000-000000000000');
    expect(out?.detected_specifics).toEqual(['x', 'y']);
    expect(out?.no_specifics).toBe(false);
  });

  it('returns null for non-JSON input', () => {
    expect(parseQuestionResponse('not json')).toBeNull();
  });

  it('returns null when a required field is missing', () => {
    const { signal_id: _omit, ...partial } = VALID;
    void _omit;
    expect(parseQuestionResponse(JSON.stringify(partial))).toBeNull();
  });

  it('returns null when detected_specifics contains a non-string entry', () => {
    const bad = { ...VALID, detected_specifics: ['x', 42] };
    expect(parseQuestionResponse(JSON.stringify(bad))).toBeNull();
  });

  it('returns null for a JSON array (must be an object)', () => {
    expect(parseQuestionResponse(JSON.stringify(['x']))).toBeNull();
  });

  it('returns null for JSON null', () => {
    expect(parseQuestionResponse('null')).toBeNull();
  });
});

describe('QUESTION_JSON_SCHEMA', () => {
  it('declares additionalProperties=false and all five required fields', () => {
    expect(QUESTION_JSON_SCHEMA.type).toBe('object');
    expect(QUESTION_JSON_SCHEMA.additionalProperties).toBe(false);
    expect([...QUESTION_JSON_SCHEMA.required].sort()).toEqual(
      [
        'detected_specifics',
        'evidence_phrase',
        'no_specifics',
        'question_text',
        'signal_id',
      ].sort(),
    );
  });

  it('declares detected_specifics as an array of strings', () => {
    const specifics = QUESTION_JSON_SCHEMA.properties.detected_specifics;
    expect(specifics.type).toBe('array');
    expect(specifics.items.type).toBe('string');
  });
});
