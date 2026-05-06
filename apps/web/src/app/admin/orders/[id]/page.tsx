// /admin/orders/[id] — order detail.
// Spec: docs/specs/founder-review-flow.md.
//
// Two modes:
//   * Review mode    — when order.status = 'pending_founder_review' (read panels in Task 6)
//   * Timeline mode  — after approval (single-column activity_log timeline; Task 8)

import { notFound } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase-server';
import { ReviewMode } from './components/ReviewMode';
import { TimelineMode } from './components/TimelineMode';

export const metadata = { title: 'Order — Operscale CRM' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await getSupabaseServer();

  const { data: order, error } = await supabase
    .from('orders')
    .select(
      `id, brief_id, customer_id, status, tier, amount_ngn, submitted_at, founder_approved_at, paid_at, paystack_authorization, briefs!inner(id, form_payload, submitted_at), customers!inner(id, name:full_name, email, whatsapp:whatsapp_number)`,
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !order) {
    notFound();
  }

  if (order.status === 'pending_founder_review') {
    return <ReviewMode orderId={order.id} order={order} />;
  }
  return <TimelineMode orderId={order.id} order={order} />;
}
