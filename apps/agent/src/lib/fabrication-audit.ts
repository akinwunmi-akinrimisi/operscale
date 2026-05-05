// App-side fabrication-risk regex sweep per ai-brief-analysis.md §8.
// Pure: takes AiOutput + customer_backstory_verbatim, returns Violation[].
// Caller (Phase 3 orchestrator) merges these into
// fabrication_audit.violations_found post-hoc.

import type { AiOutput, Violation } from './types/v2.js';

const FORBIDDEN_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /my (mum|grandmother|mother|grandma)/i, label: 'family heritage claim' },
  { regex: /i started this (business|brand|company) because/i, label: 'founder origin claim' },
  { regex: /customer transformation/i, label: 'invented customer testimonial framing' },
  { regex: /in the style of [A-Z][a-z]+ [A-Z][a-z]+/, label: 'marketer-name attribution' },
];

const BACKSTORY_VERB_PATTERN = /\b(started|learned from|taught me|inherited)\b/i;

function lineFlaggedByForbiddenPatterns(line: string): string | null {
  for (const { regex, label } of FORBIDDEN_PATTERNS) {
    if (regex.test(line)) return label;
  }
  return null;
}

function isLineInBackstory(line: string, backstory: string): boolean {
  if (!backstory.trim()) return false;
  return backstory.toLowerCase().includes(line.toLowerCase());
}

export function auditFabrication(aiOutput: AiOutput, customerBackstory: string): Violation[] {
  const violations: Violation[] = [];

  for (const slot of aiOutput.calendar_plan) {
    const lines = [
      slot.hook,
      ...slot.core_beats,
      slot.cta,
    ].filter((s) => typeof s === 'string' && s.length > 0);

    for (const line of lines) {
      const inBackstory = isLineInBackstory(line, customerBackstory);

      // Forbidden patterns: bypassed only when the EXACT line is present in backstory.
      const forbiddenLabel = lineFlaggedByForbiddenPatterns(line);
      if (forbiddenLabel && !inBackstory) {
        violations.push({
          slot_index: slot.slot_index,
          line,
          violation: forbiddenLabel,
        });
        continue;
      }

      // Backstory-verb backstop: flag when verb is present and line not in backstory.
      if (BACKSTORY_VERB_PATTERN.test(line) && !inBackstory && !forbiddenLabel) {
        violations.push({
          slot_index: slot.slot_index,
          line,
          violation: 'first-person backstory verb without grounding in customer_backstory_verbatim',
        });
      }
    }
  }

  return violations;
}
