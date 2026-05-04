import { describe, it, expect } from 'vitest';
import { renderLayer1 } from './prompt-builder';

describe('renderLayer1', () => {
  it('returns the system framing as a non-empty string', () => {
    const out = renderLayer1();
    expect(out.length).toBeGreaterThan(500);
  });

  it('opens with the role definition from ai-brief-analysis.md §3.1', () => {
    const out = renderLayer1();
    expect(out).toMatch(/^You are a senior content strategist at a Lagos-based SMB content agency\./);
  });

  it('encodes the three rules in order', () => {
    const out = renderLayer1();
    const r1 = out.indexOf('RULE 1 — NO FABRICATION.');
    const r2 = out.indexOf('RULE 2 — FRAMEWORKS BY NAME OF FRAMEWORK, NOT BY NAME OF MARKETER.');
    const r3 = out.indexOf('RULE 3 — DETERMINISTIC SELECTION.');
    expect(r1).toBeGreaterThan(0);
    expect(r2).toBeGreaterThan(r1);
    expect(r3).toBeGreaterThan(r2);
  });

  it('forbids prose preamble around the JSON', () => {
    const out = renderLayer1();
    expect(out).toContain('No prose outside the JSON');
    expect(out).toContain('No preamble');
    expect(out).toContain('Just the JSON object.');
  });

  it('is stable across calls (pure function)', () => {
    expect(renderLayer1()).toEqual(renderLayer1());
  });
});
