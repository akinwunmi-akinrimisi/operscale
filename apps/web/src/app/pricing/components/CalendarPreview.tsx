'use client';

// Interactive calendar preview.
// Spec: docs/specs/calendar-preview-on-pricing-page.md.
//
// Reads JSON content from src/content/calendar-preview/<niche>.json and renders
// a deterministic rhythm grid (UGC / T2V / Carousel) for the chosen tier.

import { DayCell } from './DayCell';

export function CalendarPreview() {
  // TODO(Operscale): wire up tier + niche selection, deterministic rhythm pattern
  // per docs/specs/calendar-preview-on-pricing-page.md "Rhythm Pattern" section.
  return (
    <div className="rounded-lg border bg-card p-6">
      <p className="text-sm text-muted-foreground">
        Calendar preview — implementation pending. Day 2 of docs/implementation.md.
      </p>
      <div className="mt-4 grid grid-cols-7 gap-2">
        {Array.from({ length: 30 }, (_, i) => (
          <DayCell key={i} day={i + 1} type={null} topic={null} />
        ))}
      </div>
    </div>
  );
}
