import { describe, expect, it } from 'vitest';

import {
  extractToolSummary,
  findExtractor,
} from '../../tools/nfx-cowork-export/src/tool-summary.js';

describe('extractToolSummary — Bash family', () => {
  it('Bash extracts the first non-empty line of a multi-line command', () => {
    const s = extractToolSummary('Bash', { command: 'echo hi\necho bye' });
    expect(s).toBe('bash (multi-line)');
  });

  it('Bash extracts a single-line command verbatim', () => {
    const s = extractToolSummary('Bash', { command: 'ls -la /tmp' });
    expect(s).toBe('ls -la /tmp');
  });

  it('Bash returns null when command is missing', () => {
    expect(extractToolSummary('Bash', { not_command: 'x' })).toBeNull();
  });

  it('mcp__workspace__bash uses the same Bash extractor', () => {
    expect(extractToolSummary('mcp__workspace__bash', { command: 'pwd' })).toBe('pwd');
  });

  it('Bash truncates output to 80 chars', () => {
    const long = 'x'.repeat(100);
    const s = extractToolSummary('Bash', { command: long });
    expect(s).not.toBeNull();
    expect(s!.length).toBeLessThanOrEqual(80);
  });
});

describe('extractToolSummary — file-path tools', () => {
  it('Edit extracts the file_path arg', () => {
    expect(extractToolSummary('Edit', { file_path: '/src/foo.ts', old_string: 'a', new_string: 'b' })).toBe('/src/foo.ts');
  });

  it('Write extracts the file_path arg', () => {
    expect(extractToolSummary('Write', { file_path: '/src/bar.ts', content: 'x' })).toBe('/src/bar.ts');
  });

  it('Read extracts the file_path arg', () => {
    expect(extractToolSummary('Read', { file_path: '/etc/hosts' })).toBe('/etc/hosts');
  });

  it('returns null when file_path missing', () => {
    expect(extractToolSummary('Edit', {})).toBeNull();
  });
});

describe('extractToolSummary — URL tools', () => {
  it('mcp__Claude_in_Chrome__navigate extracts the url', () => {
    expect(extractToolSummary('mcp__Claude_in_Chrome__navigate', { url: 'https://example.test' })).toBe('https://example.test');
  });

  it('WebFetch extracts the url', () => {
    expect(extractToolSummary('WebFetch', { url: 'https://api.example.test/data' })).toBe('https://api.example.test/data');
  });

  it('mcp__workspace__web_fetch extracts the url', () => {
    expect(extractToolSummary('mcp__workspace__web_fetch', { url: 'https://x.test' })).toBe('https://x.test');
  });
});

describe('extractToolSummary — search tools (wildcard match)', () => {
  it('WebSearch extracts the query', () => {
    expect(extractToolSummary('WebSearch', { query: 'best msp toronto' })).toBe('best msp toronto');
  });

  it('mcp__some_server__search matches the wildcard pattern', () => {
    expect(extractToolSummary('mcp__some_server__search', { query: 'find x' })).toBe('find x');
  });

  it('mcp__a__search matches the wildcard pattern', () => {
    expect(extractToolSummary('mcp__a__search', { query: 'q' })).toBe('q');
  });

  it('mcp__workspace__web_fetch does NOT match the search pattern (separate extractor)', () => {
    // It should match WebFetch's extractor (url), not search's (query)
    expect(extractToolSummary('mcp__workspace__web_fetch', { url: 'u' })).toBe('u');
    expect(extractToolSummary('mcp__workspace__web_fetch', { query: 'q' })).toBeNull();
  });
});

describe('extractToolSummary — Glob/Grep', () => {
  it('Glob extracts the pattern', () => {
    expect(extractToolSummary('Glob', { pattern: '**/*.ts' })).toBe('**/*.ts');
  });

  it('Grep extracts the pattern', () => {
    expect(extractToolSummary('Grep', { pattern: 'TODO' })).toBe('TODO');
  });
});

describe('extractToolSummary — cowork present_files', () => {
  it('joins multiple file paths with comma-space', () => {
    const s = extractToolSummary('mcp__cowork__present_files', {
      files: [{ file_path: '/a.txt' }, { file_path: '/b.txt' }],
    });
    expect(s).toBe('/a.txt, /b.txt');
  });

  it('accepts plain string entries', () => {
    const s = extractToolSummary('mcp__cowork__present_files', { files: ['/a.txt', '/b.txt'] });
    expect(s).toBe('/a.txt, /b.txt');
  });

  it('returns null when files is empty', () => {
    expect(extractToolSummary('mcp__cowork__present_files', { files: [] })).toBeNull();
  });
});

describe('extractToolSummary — TaskCreate/TaskUpdate', () => {
  it('TaskCreate extracts subject', () => {
    expect(extractToolSummary('TaskCreate', { subject: 'Map sitemap' })).toBe('Map sitemap');
  });

  it('TaskUpdate falls back to title if subject missing', () => {
    expect(extractToolSummary('TaskUpdate', { title: 'Finalize report' })).toBe('Finalize report');
  });

  it('returns null when neither subject nor title', () => {
    expect(extractToolSummary('TaskCreate', { other: 'x' })).toBeNull();
  });
});

describe('extractToolSummary — AskUserQuestion', () => {
  it('extracts the first question text', () => {
    const s = extractToolSummary('AskUserQuestion', {
      questions: [
        { question: 'What is your priority?' },
        { question: 'How urgent?' },
      ],
    });
    expect(s).toBe('What is your priority?');
  });

  it('returns null when no questions', () => {
    expect(extractToolSummary('AskUserQuestion', { questions: [] })).toBeNull();
  });
});

describe('extractToolSummary — unknown tools', () => {
  it('returns null for any tool without a registered extractor', () => {
    expect(extractToolSummary('UnknownTool', { x: 1 })).toBeNull();
    expect(extractToolSummary('mcp__Claude_in_Chrome__javascript_tool', { code: '...' })).toBeNull();
    expect(extractToolSummary('mcp__Claude_in_Chrome__computer', { action: 'screenshot' })).toBeNull();
  });

  it('findExtractor returns null for unknown tools', () => {
    expect(findExtractor('Completely-Unknown')).toBeNull();
  });
});

describe('extractToolSummary — whitespace and length handling', () => {
  it('collapses internal whitespace runs', () => {
    expect(extractToolSummary('Bash', { command: 'foo   \t  bar' })).toBe('foo bar');
  });

  it('caps every summary at 80 chars', () => {
    const long = 'a'.repeat(200);
    const s = extractToolSummary('mcp__Claude_in_Chrome__navigate', { url: long });
    expect(s).not.toBeNull();
    expect(s!.length).toBeLessThanOrEqual(80);
  });
});
