// One day in the calendar preview grid.
// Colour-coded per docs/specs/calendar-preview-on-pricing-page.md:
//   ugc      → coral  (#FF6B5B, theme: content-ugc)
//   t2v      → blue   (#3B82F6, theme: content-t2v)
//   carousel → purple (#A855F7, theme: content-carousel)

import { cn } from '@/lib/utils';

type ContentType = 'ugc' | 't2v' | 'carousel' | null;

interface DayCellProps {
  day: number;
  type: ContentType;
  topic: string | null;
}

const TYPE_CLASS: Record<Exclude<ContentType, null>, string> = {
  ugc: 'bg-content-ugc/10 border-content-ugc/40',
  t2v: 'bg-content-t2v/10 border-content-t2v/40',
  carousel: 'bg-content-carousel/10 border-content-carousel/40',
};

export function DayCell({ day, type, topic }: DayCellProps) {
  return (
    <div
      className={cn(
        'aspect-square rounded-md border p-1.5 text-xs',
        type ? TYPE_CLASS[type] : 'bg-muted/30 border-border',
      )}
      title={topic ?? `Day ${day}`}
    >
      <div className="font-medium">{day}</div>
      {type ? <div className="mt-1 truncate text-[10px] uppercase">{type}</div> : null}
    </div>
  );
}
