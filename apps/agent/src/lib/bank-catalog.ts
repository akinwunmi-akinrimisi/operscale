import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export class NicheBriefMissingError extends Error {
  constructor(public readonly nicheSlug: string, cause?: unknown) {
    super(`Niche brief file not found for slug: ${nicheSlug}`);
    this.name = 'NicheBriefMissingError';
    if (cause !== undefined) (this as Error & { cause?: unknown }).cause = cause;
  }
}

/**
 * Read a niche brief markdown file from disk by slug.
 *
 * @param nicheSlug - the niche slug (e.g. "beauty", "real_estate")
 * @param dir - directory containing the .md files (default: <repo>/niche-briefs)
 * @returns the full file body as a UTF-8 string
 * @throws NicheBriefMissingError if the file does not exist
 */
export async function loadNicheBrief(nicheSlug: string, dir: string): Promise<string> {
  const path = join(dir, `${nicheSlug}.md`);
  try {
    return await readFile(path, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new NicheBriefMissingError(nicheSlug, err);
    }
    throw err;
  }
}
