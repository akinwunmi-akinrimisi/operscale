'use client';

// ReviewMode — three-column CRM view for pending_founder_review orders.
// Spec: docs/specs/founder-review-flow.md "Review Mode — Three Columns".
//
// Left:  form responses (read-only)
// Mid:   AI output (editable inline → /v1/brief/edit-field on blur)
// Right: action panel (Approve / Re-analyze / Discard)

interface ReviewModeProps {
  orderId: string;
}

export function ReviewMode({ orderId }: ReviewModeProps) {
  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_2fr_280px]">
      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">Form responses</h2>
        <p className="mt-2 text-xs text-muted-foreground">Read-only summary of brief.form_payload + photos.</p>
        {/* TODO(Operscale): render brief.form_payload + photo lightbox via /v1/admin/photo-signed-url */}
      </section>
      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">AI output (editable)</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Click any field to edit. Saves on blur. Order: {orderId}.
        </p>
        {/* TODO(Operscale): render analysis_runs.ai_output sections; inline-edit → /v1/brief/edit-field */}
      </section>
      <aside className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">Actions</h2>
        <div className="mt-3 flex flex-col gap-2">
          <button type="button" className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">
            Approve and send
          </button>
          <button type="button" className="rounded-md border px-3 py-2 text-sm">
            Re-analyze with note
          </button>
          <button type="button" className="rounded-md border px-3 py-2 text-sm text-destructive">
            Discard
          </button>
        </div>
        {/* TODO(Operscale): wire to /v1/brief/{approve,reanalyze,discard} */}
      </aside>
    </div>
  );
}
