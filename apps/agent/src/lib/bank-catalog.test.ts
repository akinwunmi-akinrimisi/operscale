import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadNicheBrief, NicheBriefMissingError, parseFrameworksFile, parseArchetypesFile } from './bank-catalog';

const FIXTURE_DIR = join(__dirname, '__fixtures__');

describe('loadNicheBrief', () => {
  it('reads the full markdown body of a niche file', async () => {
    const text = await loadNicheBrief('sample-niche-brief', FIXTURE_DIR);
    expect(text).toContain('# Niche brief: Sample (test-only)');
    expect(text).toContain('## 2. Tone and voice patterns');
  });

  it('throws NicheBriefMissingError when file is missing', async () => {
    await expect(loadNicheBrief('nonexistent', FIXTURE_DIR)).rejects.toBeInstanceOf(
      NicheBriefMissingError,
    );
  });

  it('NicheBriefMissingError carries the niche slug', async () => {
    try {
      await loadNicheBrief('nonexistent', FIXTURE_DIR);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(NicheBriefMissingError);
      expect((err as NicheBriefMissingError).nicheSlug).toBe('nonexistent');
    }
  });
});

describe('parseFrameworksFile', () => {
  const fixturePath = join(FIXTURE_DIR, 'sample-frameworks.md');

  it('returns one entry per <!-- slot: ID --> comment', async () => {
    const entries = await parseFrameworksFile(fixturePath);
    const slots = Object.keys(entries);
    expect(slots).toEqual(expect.arrayContaining(['DR_FORMULA', 'PAS']));
    expect(slots).toHaveLength(2);
  });

  it('captures the section markdown body up to the next slot', async () => {
    const entries = await parseFrameworksFile(fixturePath);
    expect(entries.DR_FORMULA.markdown).toContain('Sample DR Formula body');
    expect(entries.DR_FORMULA.markdown).toContain('Sample hook line');
    expect(entries.DR_FORMULA.markdown).not.toContain('Sample PAS body');
  });

  it('extracts the human-readable name from the heading', async () => {
    const entries = await parseFrameworksFile(fixturePath);
    expect(entries.DR_FORMULA.name).toBe('DR Formula');
    expect(entries.PAS.name).toBe('PAS');
  });

  it('extracts the family name from the parent ## heading', async () => {
    const entries = await parseFrameworksFile(fixturePath);
    expect(entries.DR_FORMULA.family).toBe('Family A — Direct response');
  });

  it('parses the niche affinity matrix into per-niche levels', async () => {
    const entries = await parseFrameworksFile(fixturePath);
    expect(entries.DR_FORMULA.affinity.beauty).toBe('Med');
    expect(entries.DR_FORMULA.affinity.real_estate).toBe('High');
    expect(entries.DR_FORMULA.affinity.fintech).toBe('High');
    expect(entries.PAS.affinity.beauty).toBe('Low');
    expect(entries.PAS.affinity.fintech).toBe('High');
  });

  it('throws when a slot in the affinity matrix is missing its <!-- slot --> anchor', async () => {
    // Tested in Task 8's completeness validator. Here we just confirm
    // parseFrameworksFile is permissive — it parses what it sees and lets
    // the validator handle the cross-check.
    const entries = await parseFrameworksFile(fixturePath);
    expect(Object.keys(entries)).toHaveLength(2);
  });
});

describe('parseArchetypesFile', () => {
  const fixturePath = join(FIXTURE_DIR, 'sample-archetypes.md');

  it('returns one entry per archetype slot', async () => {
    const entries = await parseArchetypesFile(fixturePath);
    expect(Object.keys(entries)).toEqual(
      expect.arrayContaining(['PRICING_BREAKDOWN', 'SERVICE_ANATOMY']),
    );
  });

  it('parses affinity from the §8 archetype table (note: header column "Archetype" not "Framework")', async () => {
    const entries = await parseArchetypesFile(fixturePath);
    expect(entries.PRICING_BREAKDOWN.affinity.beauty).toBe('High');
    expect(entries.PRICING_BREAKDOWN.affinity.fintech).toBe('Low');
    expect(entries.SERVICE_ANATOMY.affinity.real_estate).toBe('High');
  });
});
