'use client';

// TimelineMode — post-approval single-column timeline of activity_log events.
// Spec: docs/specs/founder-review-flow.md "Timeline Mode (post-approval)".
// Subscribes to Realtime channel order-detail-{order_id}.

interface TimelineModeProps {
  orderId: string;
}

export function TimelineMode({ orderId }: TimelineModeProps) {
  return (
    <div className="mt-4 max-w-2xl rounded-lg border bg-card p-4">
      <h2 className="text-sm font-medium">Timeline</h2>
      <p className="mt-2 text-xs text-muted-foreground">
        Realtime activity log for order {orderId}.
      </p>
      {/* TODO(Operscale): activity_log feed + action buttons (resend email, manual whatsapp, refund, etc.) */}
    </div>
  );
}
