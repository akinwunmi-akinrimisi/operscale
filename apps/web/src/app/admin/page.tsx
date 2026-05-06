// /admin — magic-link sign-in page (always reachable per middleware).
// Already-signed-in founders can also land here; rendering the form is harmless
// because Supabase signInWithOtp simply re-issues a new link.
//
// Spec: docs/specs/v2-phase-5-design.md §4.1 + §5.1.

import { Suspense } from 'react';
import { SignInForm } from './SignInForm';

export const metadata = {
  title: 'Sign in — Operscale CRM',
  robots: 'noindex, nofollow',
};

export default function AdminSignInPage() {
  return (
    <div className="container py-12">
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </div>
  );
}
