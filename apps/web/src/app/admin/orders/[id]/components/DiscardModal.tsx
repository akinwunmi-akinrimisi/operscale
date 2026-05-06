'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

interface DiscardModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
}

const AGENT_BASE_URL = process.env.NEXT_PUBLIC_AGENT_BASE_URL ?? 'https://api.operscale.cloud';

export function DiscardModal({ open, onClose, orderId }: DiscardModalProps) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function onSubmit() {
    if (submitting) return;
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

    const trimmed = reason.trim();
    const body: { order_id: string; reason?: string } = { order_id: orderId };
    if (trimmed.length > 0) body.reason = trimmed;

    const res = await fetch(`${AGENT_BASE_URL}/v1/brief/discard`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (res.status === 200) {
      router.push('/admin/pending-review');
      router.refresh();
      return;
    }
    if (res.status === 409) {
      const detail = await res.json().catch(() => ({}));
      setError(`This order is already ${detail.current_status ?? 'actioned'}. Refreshing.`);
      setSubmitting(false);
      setTimeout(() => router.refresh(), 1500);
      return;
    }
    const errBody = await res.json().catch(() => ({ error: 'unknown' }));
    setError(`Discard failed: ${errBody.error ?? res.status}`);
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-background p-5 shadow-xl">
        <h3 className="text-lg font-semibold">Discard this order?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          The customer's auto-acknowledgement email already went out. No further emails will fire.
          You can re-open this order later via Supabase Studio if needed.
        </p>
        <label className="mt-4 block">
          <span className="text-xs text-muted-foreground">Reason (optional, max 500 chars)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            className="mt-1 block w-full rounded-md border px-2 py-1 text-sm"
            rows={3}
            disabled={submitting}
            placeholder="e.g. spam, fake submission, off-niche"
          />
        </label>
        {error && (
          <p role="alert" className="mt-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-900">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-md border px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button type="button" onClick={onSubmit} disabled={submitting} className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50">
            {submitting ? 'Discarding…' : 'Discard'}
          </button>
        </div>
      </div>
    </div>
  );
}
