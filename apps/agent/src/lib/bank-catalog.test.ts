import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadNicheBrief, NicheBriefMissingError } from './bank-catalog';

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
