import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ArchetypeEntry, ArchetypeSlot, FrameworkEntry, FrameworkSlot, NicheSlug, AffinityLevel } from './types/v2';

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

// ─── Framework section + affinity matrix parser ───────────────────────────────

const SLOT_COMMENT_RE = /^<!-- slot: ([A-Z_]+) -->$/;
// Captures the name after an optional "N.M " prefix on ### headings
const H3_HEADING_RE = /^### [0-9]+\.[0-9]+\s+(.+)$/;
// Captures the text after an optional "N. " section number on ## headings
const H2_HEADING_RE = /^## (?:[0-9]+\.\s+)?(.+)$/;

interface SectionMatch {
  slot: string;
  name: string;
  family: string;
  markdown: string;
}

/**
 * Walk the file line-by-line. For each <!-- slot: ID --> comment, the
 * heading on the previous line gives the human-readable name, the most
 * recent ## heading gives the family, and the body runs from the comment
 * line until the next <!-- slot --> comment or the next ## heading.
 */
function extractSections(text: string): SectionMatch[] {
  const lines = text.split('\n');
  const sections: SectionMatch[] = [];
  let currentFamily = '';
  let i = 0;

  while (i < lines.length) {
    const currentLine = lines[i] ?? '';

    const h2 = H2_HEADING_RE.exec(currentLine);
    if (h2) {
      currentFamily = (h2[1] ?? '').trim();
      i++;
      continue;
    }

    const slotMatch = SLOT_COMMENT_RE.exec(currentLine);
    if (slotMatch) {
      const slot = slotMatch[1] ?? '';
      const headingLine = i > 0 ? (lines[i - 1] ?? '') : '';
      const headingMatch = H3_HEADING_RE.exec(headingLine);
      const name = headingMatch ? (headingMatch[1] ?? '').trim() : slot;

      // Capture body from this line until next slot or next ##
      const bodyStart = i;
      let bodyEnd = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        const jLine = lines[j] ?? '';
        if (SLOT_COMMENT_RE.test(jLine) || H2_HEADING_RE.test(jLine)) {
          bodyEnd = j;
          break;
        }
      }

      sections.push({
        slot,
        name,
        family: currentFamily,
        markdown: lines.slice(bodyStart, bodyEnd).join('\n').trim(),
      });
      i = bodyEnd;
      continue;
    }

    i++;
  }

  return sections;
}

// Maps the abbreviated column header labels used in the affinity table to NicheSlug values.
const NICHE_COLUMN_MAP: Record<string, NicheSlug> = {
  Beauty: 'beauty',
  'Real Est': 'real_estate',
  Fashion: 'fashion',
  Fintech: 'fintech',
  Health: 'health',
  Food: 'food',
  Education: 'education',
};

/**
 * Parse the niche × framework (or × archetype) affinity table.
 * Expected header row: | Framework | Beauty | Real Est | Fashion | Fintech | Health | Food | Education |
 * (or | Archetype | ... | for archetypes — first column heading varies but is ignored).
 *
 * Returns a map from row-name (e.g. "DR Formula") to per-niche affinity level.
 */
function parseAffinityMatrix(text: string): Record<string, Record<NicheSlug, AffinityLevel>> {
  const lines = text.split('\n');

  // Find a markdown table whose header includes both 'Beauty' and 'Education'
  const headerIdx = lines.findIndex(
    (l) => l.includes('|') && l.includes('Beauty') && l.includes('Education'),
  );
  if (headerIdx < 0) return {};

  const headerLine = lines[headerIdx] ?? '';
  // Split header by |, trim, drop empty strings; first col is the axis label
  const headerCols = headerLine
    .split('|')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  // Build the ordered niche list from columns after the first (axis label) column
  const nicheOrder: NicheSlug[] = [];
  for (let ci = 1; ci < headerCols.length; ci++) {
    const label = headerCols[ci] ?? '';
    const niche = NICHE_COLUMN_MAP[label];
    if (niche === undefined) {
      throw new Error(`Unknown niche column header in affinity matrix: ${label}`);
    }
    nicheOrder.push(niche);
  }

  const result: Record<string, Record<NicheSlug, AffinityLevel>> = {};

  // Data rows start two lines after the header (skip the separator row)
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!line.includes('|')) break;

    const cols = line
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (cols.length === 0) continue;

    const rowName = cols[0] ?? '';
    const cells = cols.slice(1);
    if (cells.length !== nicheOrder.length) continue;

    const affinityEntries: [NicheSlug, AffinityLevel][] = [];
    for (let ci = 0; ci < nicheOrder.length; ci++) {
      const niche = nicheOrder[ci];
      const cell = cells[ci];
      if (niche === undefined || cell === undefined) continue;
      affinityEntries.push([niche, cell as AffinityLevel]);
    }

    result[rowName] = Object.fromEntries(affinityEntries) as Record<NicheSlug, AffinityLevel>;
  }

  return result;
}

/**
 * Parse a script-frameworks markdown file and return a map of slot ID →
 * FrameworkEntry. Permissive: sections without a matching affinity row are
 * silently dropped. The completeness validator (Task 8) catches gaps.
 */
export async function parseFrameworksFile(
  path: string,
): Promise<Record<FrameworkSlot, FrameworkEntry>> {
  const text = await readFile(path, 'utf-8');
  const sections = extractSections(text);
  const affinityByName = parseAffinityMatrix(text);
  const entries: Partial<Record<FrameworkSlot, FrameworkEntry>> = {};

  for (const sec of sections) {
    const affinity =
      affinityByName[sec.name] ?? affinityByName[sec.name.replace(/-/g, ' ')];
    if (affinity === undefined) {
      // Permissive: parser doesn't fail here. Completeness validator (Task 8) will catch.
      continue;
    }
    entries[sec.slot as FrameworkSlot] = {
      slot: sec.slot as FrameworkSlot,
      name: sec.name,
      family: sec.family,
      markdown: sec.markdown,
      affinity,
    };
  }

  return entries as Record<FrameworkSlot, FrameworkEntry>;
}

/**
 * Parse an angle-archetypes markdown file and return a map of slot ID →
 * ArchetypeEntry. Permissive: sections without a matching affinity row are
 * silently dropped. The completeness validator (Task 8) catches gaps.
 *
 * Structurally identical to parseFrameworksFile — reuses the same private
 * extractSections and parseAffinityMatrix helpers. The affinity table header
 * reads "| Archetype | ..." instead of "| Framework | ..." but parseAffinityMatrix
 * ignores the first-column label, so no change is needed there.
 */
export async function parseArchetypesFile(
  path: string,
): Promise<Record<ArchetypeSlot, ArchetypeEntry>> {
  const text = await readFile(path, 'utf-8');
  const sections = extractSections(text);
  const affinityByName = parseAffinityMatrix(text);
  const entries: Partial<Record<ArchetypeSlot, ArchetypeEntry>> = {};

  for (const sec of sections) {
    const affinity =
      affinityByName[sec.name] ?? affinityByName[sec.name.replace(/-/g, ' ')];
    if (affinity === undefined) {
      // Permissive: parser doesn't fail here. Completeness validator (Task 8) will catch.
      continue;
    }
    entries[sec.slot as ArchetypeSlot] = {
      slot: sec.slot as ArchetypeSlot,
      name: sec.name,
      family: sec.family,
      markdown: sec.markdown,
      affinity,
    };
  }

  return entries as Record<ArchetypeSlot, ArchetypeEntry>;
}
