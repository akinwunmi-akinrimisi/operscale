// /admin layout — gated by founder JWT claim.
// Spec: docs/specs/founder-review-flow.md.
// ADR 0008: CRM lives in-app at apps/web/src/app/admin/*.
//
// Auth flow:
//   1. Anonymous request → middleware redirects to /admin (sign-in form)
//   2. Customer enters email → POST to Supabase Auth signInWithOtp
//   3. Supabase auth.send_email_hook (0004 migration) blocks non-allowlisted addresses
//   4. Magic link → callback → JWT issued
//   5. Supabase auth.custom_access_token_hook (0004 migration) stamps role='founder'
//   6. RLS policies in 0001 honour the role claim

import type { ReactNode } from 'react';

export const metadata = {
  title: 'CRM — Operscale',
  robots: 'noindex, nofollow',
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  // TODO(Operscale): server-side guard — read session, redirect to /admin if no founder claim.
  // For now, just renders children. Day 8 of docs/implementation.md adds the auth gate.
  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="container flex h-14 items-center justify-between">
          <a href="/admin" className="font-medium">
            Operscale CRM
          </a>
          <nav className="flex gap-4 text-sm">
            <a href="/admin/pending-review" className="hover:underline">
              Pending review
            </a>
            <a href="/admin/paid-orders" className="hover:underline">
              Paid orders
            </a>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
