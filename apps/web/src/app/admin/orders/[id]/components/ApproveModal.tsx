'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

interface ApproveModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  customerEmail: string | null;
}

const AGENT_BASE_URL = process.env.NEXT_PUBLIC_AGENT_BASE_URL ?? 'https://api.operscale.cloud';

export function ApproveModal({ open, onClose, orderId, customerEmail }: ApproveModalProps) {
  const router = useRouter();
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

    const res = await fetch(`${AGENT_BASE_URL}/v1/brief/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ order_id: orderId }),
    });

    if (res.status === 200) {
      onClose();
      router.refresh();
      return;
    }
    if (res.status === 502) {
      onClose();
      router.refresh();
      return;
    }
    const errBody = await res.json().catch(() => ({ error: 'unknown' }));
    setError(`Approval failed: ${errBody.error ?? res.status}`);
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-background p-5 shadow-xl">
        <h3 className="text-lg font-semibold">Approve and send brief</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          We'll email the brief + Paystack payment link to <strong>{customerEmail ?? 'the customer'}</strong>. This is irreversible from the UI.
        </p>
        {error && (
          <p role="alert" className="mt-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-900">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-md border px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button type="button" onClick={onSubmit} disabled={submitting} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50">
            {submitting ? 'Sending…' : 'Approve and send'}
          </button>
        </div>
      </div>
    </div>
  );
}
