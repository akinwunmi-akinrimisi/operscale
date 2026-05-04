import { readFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { ArchetypeEntry, ArchetypeSlot, BankCatalog, FrameworkEntry, FrameworkSlot, NicheSlug, AffinityLevel } from './types/v2';
import { FRAMEWORK_SLOTS, ARCHETYPE_SLOTS, NICHE_SLUGS } from './types/v2';

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
 * Read a file and normalize line endings to LF.
 * The real spec files are committed with CRLF on Windows; the regex anchors
 * (^ and $) in extractSections / parseAffinityMatrix require clean LF lines.
 */
async function readNormalized(path: string): Promise<string> {
  const raw = await readFile(path, 'utf-8');
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Look up affinity for a section name, trying progressively shorter forms:
 * 1. Exact name (e.g. "DR Formula")
 * 2. Name with dashes replaced by spaces (e.g. "Quick-Win" → "Quick Win")
 * 3. Name stripped of any parenthetical suffix (e.g. "PAS (Problem–Agitation–Solution)" → "PAS")
 * 4. Stripped name with dashes replaced by spaces
 *
 * Headings like "### 3.2 PAS (Problem–Agitation–Solution)" produce the full
 * parenthetical name, but the affinity matrix row only has "PAS".
 */
function lookupAffinity(
  affinityByName: Record<string, Record<NicheSlug, AffinityLevel>>,
  name: string,
): Record<NicheSlug, AffinityLevel> | undefined {
  const baseName = name.replace(/\s*\(.*\)$/, '').trim();
  return (
    affinityByName[name] ??
    affinityByName[name.replace(/-/g, ' ')] ??
    affinityByName[baseName] ??
    affinityByName[baseName.replace(/-/g, ' ')]
  );
}

/**
 * Parse a script-frameworks markdown file and return a map of slot ID →
 * FrameworkEntry. Permissive: sections without a matching affinity row are
 * silently dropped. The completeness validator (Task 8) catches gaps.
 */
export async function parseFrameworksFile(
  path: string,
): Promise<Record<FrameworkSlot, FrameworkEntry>> {
  const text = await readNormalized(path);
  const sections = extractSections(text);
  const affinityByName = parseAffinityMatrix(text);
  const entries: Partial<Record<FrameworkSlot, FrameworkEntry>> = {};

  for (const sec of sections) {
    const affinity = lookupAffinity(affinityByName, sec.name);
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
  const text = await readNormalized(path);
  const sections = extractSections(text);
  const affinityByName = parseAffinityMatrix(text);
  const entries: Partial<Record<ArchetypeSlot, ArchetypeEntry>> = {};

  for (const sec of sections) {
    const affinity = lookupAffinity(affinityByName, sec.name);
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

// ─── Top-level loader + completeness validator ────────────────────────────────

/**
 * Maps NICHE_SLUGS values to their on-disk filename stems (without .md).
 * When a niche file was named differently from the slug (e.g. real-estate.md
 * for the "real_estate" slug), the mapping entry overrides the default.
 */
const NICHE_FILENAME_MAP: Partial<Record<NicheSlug, string>> = {
  real_estate: 'real-estate',
  fashion: 'fashion-ecom',
};

export class BankCatalogIncompleteError extends Error {
  constructor(public readonly missing: { kind: string; slug: string }[]) {
    super(
      `BankCatalog is incomplete. Missing entries: ${missing
        .map((m) => `${m.kind}=${m.slug}`)
        .join(', ')}`,
    );
    this.name = 'BankCatalogIncompleteError';
  }
}

export interface LoadBankCatalogOptions {
  /** Repo root (defaults to process.cwd() ascended until pnpm-workspace.yaml is found). */
  repoRoot?: string;
}

async function findRepoRoot(start: string): Promise<string> {
  let cur = start;
  for (let i = 0; i < 8; i++) {
    try {
      await stat(join(cur, 'pnpm-workspace.yaml'));
      return cur;
    } catch {
      // continue ascending
    }
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return start;
}

export async function loadBankCatalog(opts: LoadBankCatalogOptions = {}): Promise<BankCatalog> {
  const repoRoot = opts.repoRoot ?? (await findRepoRoot(process.cwd()));
  const frameworksPath = join(repoRoot, 'docs/specs/script-frameworks.md');
  const archetypesPath = join(repoRoot, 'docs/specs/angle-archetypes.md');
  const nichesDir = join(repoRoot, 'niche-briefs');

  const [frameworks, archetypes] = await Promise.all([
    parseFrameworksFile(frameworksPath),
    parseArchetypesFile(archetypesPath),
  ]);

  const niches: Partial<Record<(typeof NICHE_SLUGS)[number], string>> = {};
  for (const slug of NICHE_SLUGS) {
    const filenameStem = NICHE_FILENAME_MAP[slug] ?? slug;
    try {
      niches[slug] = await loadNicheBrief(filenameStem, nichesDir);
    } catch (err) {
      if (err instanceof NicheBriefMissingError) continue;
      throw err;
    }
  }

  const missing: { kind: string; slug: string }[] = [];
  for (const slot of FRAMEWORK_SLOTS) {
    if (!frameworks[slot]) missing.push({ kind: 'framework', slug: slot });
  }
  for (const slot of ARCHETYPE_SLOTS) {
    if (!archetypes[slot]) missing.push({ kind: 'archetype', slug: slot });
  }
  for (const slug of NICHE_SLUGS) {
    if (!niches[slug]) missing.push({ kind: 'niche', slug });
  }
  if (missing.length > 0) {
    throw new BankCatalogIncompleteError(missing);
  }

  return {
    frameworks,
    archetypes,
    niches: niches as Record<(typeof NICHE_SLUGS)[number], string>,
  };
}
