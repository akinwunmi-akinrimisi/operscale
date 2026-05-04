// /brief — entry point. Redirects to step 1 (or to a resumed draft via ?token=...).
// Spec: docs/customer-journey.md (STARTED_FORM state) + docs/specs/email-templates.md (save-token).

import { redirect } from 'next/navigation';

export default function BriefIndexPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  // TODO(Operscale): if token present, look up brief via /v1/brief/resume,
  // restore form_payload + current_step, redirect to that step.
  if (searchParams.token) {
    // Resume flow (Day 4 of docs/implementation.md).
  }
  redirect('/brief/step-1');
}
