// /admin/orders/[id] — order detail.
// Spec: docs/specs/founder-review-flow.md.
//
// Two modes:
//   * Review mode    — when order.status = 'pending_founder_review' (3-column UI)
//   * Timeline mode  — after approval (single-column activity_log timeline)

import { ReviewMode } from './components/ReviewMode';
import { TimelineMode } from './components/TimelineMode';

export const metadata = { title: 'Order — Operscale CRM' };

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  // TODO(Operscale): fetch order, decide mode based on status.
  const inReviewMode = true;
  return (
    <div className="container py-8">
      <p className="text-xs text-muted-foreground">Order {params.id}</p>
      {inReviewMode ? <ReviewMode orderId={params.id} /> : <TimelineMode orderId={params.id} />}
    </div>
  );
}
