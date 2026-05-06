'use client';

import { useState } from 'react';

interface EventCardProps {
  occurred_at: string;
  event_type: string;
  payload: Record<string, unknown> | null;
}

function relative(iso: string): string {
  const diffMin = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

export function EventCard({ occurred_at, event_type, payload }: EventCardProps) {
  const [open, setOpen] = useState(false);
  const hasPayload = payload && Object.keys(payload).length > 0;
  return (
    <div className="rounded-md border bg-card p-3 text-sm">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-xs">{event_type}</span>
        <span className="text-xs text-muted-foreground">
          {relative(occurred_at)} · {new Date(occurred_at).toISOString()}
        </span>
      </div>
      {hasPayload && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1 text-xs text-blue-700 hover:underline"
        >
          {open ? 'Hide' : 'Show'} payload
        </button>
      )}
      {open && hasPayload && (
        <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-2 text-[11px]">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  );
}
