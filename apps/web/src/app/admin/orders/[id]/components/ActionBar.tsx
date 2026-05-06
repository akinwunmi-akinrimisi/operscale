'use client';

import { useState } from 'react';
import { ApproveModal } from './ApproveModal';
import { ReanalyzeModal } from './ReanalyzeModal';
import { DiscardModal } from './DiscardModal';

interface ActionBarProps {
  orderId: string;
  briefId: string;
  priorRunId: string | null;
  runIndex: number;
  submittedAt: string;
  customerEmail: string | null;
  analysisReady: boolean;
}

function relative(iso: string): string {
  const diffMin = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

export function ActionBar({ orderId, briefId, priorRunId, runIndex, submittedAt, customerEmail, analysisReady }: ActionBarProps) {
  const [open, setOpen] = useState<'approve' | 'reanalyze' | 'discard' | null>(null);
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur">
      <div className="container flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Run {runIndex} · Submitted {relative(submittedAt)}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen('discard')} className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700">Discard</button>
          <button type="button" onClick={() => setOpen('reanalyze')} disabled={!analysisReady || !priorRunId} className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50">Re-analyze</button>
          <button type="button" onClick={() => setOpen('approve')} disabled={!analysisReady} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50">Approve and send</button>
        </div>
      </div>
      <ApproveModal open={open === 'approve'} onClose={() => setOpen(null)} orderId={orderId} customerEmail={customerEmail} />
      <ReanalyzeModal open={open === 'reanalyze'} onClose={() => setOpen(null)} briefId={briefId} priorRunId={priorRunId ?? ''} />
      <DiscardModal open={open === 'discard'} onClose={() => setOpen(null)} orderId={orderId} />
    </div>
  );
}
