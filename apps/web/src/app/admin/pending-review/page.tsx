// /admin/pending-review — Realtime queue of orders awaiting founder review.
// Spec: docs/specs/founder-review-flow.md "CRM Views" section.
//
// Realtime subscription:
//   channel name: 'pending-review'
//   filter: orders WHERE status = 'pending_founder_review'
//   payload includes activity_log + analysis_runs joined via the order_id

export const metadata = { title: 'Pending review — Operscale CRM' };

export default function PendingReviewPage() {
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-semibold">Pending review</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Live queue. Updates via Supabase Realtime.
      </p>
      {/* TODO(Operscale): Realtime subscription + queue table per docs/specs/founder-review-flow.md */}
    </div>
  );
}
