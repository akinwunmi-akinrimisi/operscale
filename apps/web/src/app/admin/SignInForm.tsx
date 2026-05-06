'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

type FormState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string };

const REASON_COPY: Record<string, string> = {
  not_authenticated: 'Sign in to access the CRM.',
  not_authorized: 'That account isn’t allowlisted for the CRM.',
  expired: 'That sign-in link has expired. Send a new one.',
  session: 'Your session ended. Sign in again.',
};

export function SignInForm() {
  const params = useSearchParams();
  const reason = params.get('reason');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>({ kind: 'idle' });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind === 'sending') return;
    setState({ kind: 'sending' });

    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setState({ kind: 'error', message: error.message ?? 'Couldn’t send sign-in email.' });
      return;
    }
    setState({ kind: 'sent', email: email.trim().toLowerCase() });
  }

  if (state.kind === 'sent') {
    return (
      <div className="mx-auto mt-12 max-w-sm rounded-lg border bg-card p-6 text-sm">
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="mt-2 text-muted-foreground">
          We sent a sign-in link to <strong>{state.email}</strong>. Open the email on this device
          and click the link to continue. The link expires in 60 minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto mt-12 max-w-sm space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Operscale CRM</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in with your magic link.
        </p>
      </div>

      {reason && REASON_COPY[reason] && (
        <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          {REASON_COPY[reason]}
        </p>
      )}

      {state.kind === 'error' && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-900">
          {state.message}
        </p>
      )}

      <label htmlFor="signin-email" className="sr-only">Email address</label>
      <input
        id="signin-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@operscale.cloud"
        className="w-full rounded-md border px-3 py-2 text-sm"
        disabled={state.kind === 'sending'}
      />

      <button
        type="submit"
        disabled={state.kind === 'sending' || email.trim().length === 0}
        className="w-full rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
      >
        {state.kind === 'sending' ? 'Sending…' : 'Send sign-in link'}
      </button>
    </form>
  );
}
