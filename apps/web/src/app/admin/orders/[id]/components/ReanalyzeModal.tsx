'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

interface ReanalyzeModalProps {
  open: boolean;
  onClose: () => void;
  briefId: string;
  priorRunId: string;
}

const AGENT_BASE_URL = process.env.NEXT_PUBLIC_AGENT_BASE_URL ?? 'https://api.operscale.cloud';

export function ReanalyzeModal({ open, onClose, briefId, priorRunId }: ReanalyzeModalProps) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const trimmed = note.trim();
  const ready = trimmed.length >= 10;

  async function onSubmit() {
    if (submitting || !ready) return;
    setSubmitting(true);
    setError(null);

    const supabase = getSupabaseBrowser();
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      setError('Session expired. Refresh and try again.');
      setSubmitting(false);
      return;
    }

    const res = await fetch(`${AGENT_BASE_URL}/v1/brief/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        brief_id: briefId,
        trigger_type: 're_analyze_same_frameworks',
        prior_run_id: priorRunId,
        founder_note: trimmed,
      }),
    });

    if (res.status === 200 || res.status === 202) {
      onClose();
      router.refresh();
      return;
    }
    const errBody = await res.json().catch(() => ({ error: 'unknown' }));
    setError(`Couldn't enqueue re-analysis: ${errBody.error ?? res.status}`);
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-background p-5 shadow-xl">
        <h3 className="text-lg font-semibold">Re-analyze with note</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Re-runs Claude with the same 8 selected pairs plus your note. Inline edits aren't supported in v0; expect ~2 minutes.
        </p>
        <label className="mt-4 block">
          <span className="text-xs text-muted-foreground">What needs to change? (min 10 chars)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            disabled={submitting}
            className="mt-1 block w-full rounded-md border px-2 py-1 text-sm"
            placeholder="e.g. focus more on the educational angle; mention the launch in 2 weeks"
          />
        </label>
        <div className="mt-1 text-right text-xs text-muted-foreground">{trimmed.length} / 10</div>
        {error && (
          <p role="alert" className="mt-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-900">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-md border px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button type="button" onClick={onSubmit} disabled={submitting || !ready} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50">
            {submitting ? 'Enqueuing…' : 'Re-analyze'}
          </button>
        </div>
      </div>
    </div>
  );
}
