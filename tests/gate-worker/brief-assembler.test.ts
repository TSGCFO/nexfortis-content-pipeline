/**
 * Tests for the SEOwind brief assembler (F3 PRD §6).
 *
 * Covers default field mapping, overrides, the always-on Company Details flag,
 * and the hard guarantee (AC-F3-11 / AC-F3-12) that no brand-voice id or API
 * key ever appears in the payload.
 */

import { describe, expect, it } from 'vitest';

import {
  assembleBrief,
  DEFAULT_LANGUAGE,
  DEFAULT_LOCATION,
  type BriefAssemblyInput,
} from '../../artifacts/gate-worker/src/integrations/brief-assembler.js';

function makeInput(
  overrides: Partial<BriefAssemblyInput> = {},
): BriefAssemblyInput {
  return {
    primaryKeyword: 'conditional access for ios',
    projectId: 'proj_123',
    insightsText: 'In my experience, the Authenticator app fixes AADSTS50158.',
    ...overrides,
  };
}

describe('assembleBrief', () => {
  it('maps the focus keyword, project id, and insights through', () => {
    const brief = assembleBrief(makeInput());
    expect(brief.focusKeyword).toBe('conditional access for ios');
    expect(brief.projectId).toBe('proj_123');
    expect(brief.insightsText).toMatch(/Authenticator/);
  });

  it('applies the default location and language', () => {
    const brief = assembleBrief(makeInput());
    expect(brief.location).toBe(DEFAULT_LOCATION);
    expect(brief.language).toBe(DEFAULT_LANGUAGE);
  });

  it('honours explicit location and language overrides', () => {
    const brief = assembleBrief(
      makeInput({ location: 'Canada', language: 'French' }),
    );
    expect(brief.location).toBe('Canada');
    expect(brief.language).toBe('French');
  });

  it('falls back to defaults when overrides are blank', () => {
    const brief = assembleBrief(makeInput({ location: '  ', language: '' }));
    expect(brief.location).toBe(DEFAULT_LOCATION);
    expect(brief.language).toBe(DEFAULT_LANGUAGE);
  });

  it('always enables company details', () => {
    expect(assembleBrief(makeInput()).enableCompanyDetails).toBe(true);
  });

  it('omits usState unless explicitly provided', () => {
    expect('usState' in assembleBrief(makeInput())).toBe(false);
    const withState = assembleBrief(makeInput({ usState: 'NY' }));
    expect(withState.usState).toBe('NY');
  });

  it('carries correction instructions only on rewrite attempts', () => {
    expect('correctionInstructions' in assembleBrief(makeInput())).toBe(false);
    const rewrite = assembleBrief(
      makeInput({ correctionInstructions: 'Fix GA-02 in paragraph 3.' }),
    );
    expect(rewrite.correctionInstructions).toMatch(/GA-02/);
  });

  it('never includes a brand-voice id or API key (AC-F3-11 / AC-F3-12)', () => {
    const serialised = JSON.stringify(
      assembleBrief(makeInput({ usState: 'NY' })),
    ).toLowerCase();
    expect(serialised).not.toContain('brandvoice');
    expect(serialised).not.toContain('apikey');
    expect(serialised).not.toContain('api_key');
  });
});
