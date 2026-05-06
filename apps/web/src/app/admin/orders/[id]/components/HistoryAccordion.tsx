'use client';

import { useState } from 'react';

export interface HistoryEvent {
  occurred_at: string;
  event_type: string;
  payload: Record<string, unknown> | null;
}

interface HistoryAccordionProps {
  events: HistoryEvent[];
  submittedAt: string;
}

function summarise(events: HistoryEvent[]): string {
  const reanalyseCount = events.filter((e) => e.event_type === 'ai_analysis_enqueued').length;
  const autoAck = events.find((e) => e.event_type === 'auto_ack_email_sent');
  const parts: string[] = [];
  if (reanalyseCount > 1) parts.push(`Re-analyzed ${reanalyseCount - 1}×`);
  if (autoAck) parts.push('Auto-ack sent');
  return parts.join(' · ');
}

function relativeTime(iso: string, now: number = Date.now()): string {
  const diffMs = now - new Date(iso).getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60_000));
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

export function HistoryAccordion({ events, submittedAt }: HistoryAccordionProps) {
  const [open, setOpen] = useState(false);
  const summary = summarise(events);
  return (
    <div className="rounded-md border bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/60"
        aria-expanded={open}
      >
        <span>
          Submitted {relativeTime(submittedAt)}
          {summary ? ` · ${summary}` : ''}
        </span>
        <span aria-hidden>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <ul className="divide-y border-t text-xs">
          {events.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">No events yet.</li>
          ) : (
            events.map((e, i) => (
              <li key={i} className="grid grid-cols-[140px_1fr] gap-3 px-3 py-2">
                <span className="text-muted-foreground">{relativeTime(e.occurred_at)}</span>
                <span className="font-mono text-[11px]">{e.event_type}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
