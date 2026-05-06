import { getSupabaseServer } from '@/lib/supabase-server';
import { QueueTable } from './QueueTable';
import { QueueCapBanner } from './QueueCapBanner';
import type { QueueRowData } from './QueueRow';

export const metadata = { title: 'Pending review — Operscale CRM' };
export const dynamic = 'force-dynamic';

const QUEUE_LIMIT = 100;

interface BriefPhotoRow {
  brief_id: string;
}

interface OrderJoined {
  id: string;
  tier: string;
  briefs: {
    id: string;
    submitted_at: string;
    form_payload: { brand_name?: string; niche?: string } | null;
  } | null;
  customers: { id: string; name: string | null } | null;
  brief_photos: BriefPhotoRow[] | null;
}

async function fetchPending(): Promise<{ rows: QueueRowData[]; capReached: boolean }> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from('orders')
    .select(
      `id, tier, briefs!inner(id, submitted_at, form_payload), customers!inner(id, name:full_name), brief_photos(brief_id)`,
    )
    .eq('status', 'pending_founder_review')
    .order('briefs(submitted_at)', { ascending: true })
    .limit(QUEUE_LIMIT);

  if (error) throw new Error(`pending_review_query_failed: ${error.message}`);

  const rows: QueueRowData[] = ((data ?? []) as unknown as OrderJoined[]).map((o) => ({
    order_id: o.id,
    brief_id: o.briefs?.id ?? '',
    brand_name: o.briefs?.form_payload?.brand_name ?? null,
    customer_name: o.customers?.name ?? null,
    niche: o.briefs?.form_payload?.niche ?? null,
    tier: o.tier as QueueRowData['tier'],
    submitted_at: o.briefs?.submitted_at ?? new Date().toISOString(),
    has_photos: (o.brief_photos?.length ?? 0) > 0,
  }));

  return { rows, capReached: rows.length >= QUEUE_LIMIT };
}

export default async function PendingReviewPage() {
  const { rows, capReached } = await fetchPending();
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-semibold">Pending review</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {rows.length} brief{rows.length === 1 ? '' : 's'} awaiting your review. Live updates via
        Realtime.
      </p>
      <div className="mt-6">
        {capReached && <QueueCapBanner />}
        <QueueTable initialRows={rows} />
      </div>
    </div>
  );
}
