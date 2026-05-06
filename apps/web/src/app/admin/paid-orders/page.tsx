import { getSupabaseServer } from '@/lib/supabase-server';
import { PaidOrdersTable } from './PaidOrdersTable';

export const metadata = { title: 'Paid orders — Operscale CRM' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

export interface PaidOrderRow {
  order_id: string;
  brief_id: string;
  brand_name: string | null;
  customer_name: string | null;
  tier: 'starter' | 'standard' | 'calendar';
  paid_at: string;
  amount_ngn: number;
  paystack_reference: string | null;
}

interface JoinedRow {
  id: string;
  tier: string;
  paid_at: string | null;
  amount_ngn: number | null;
  paystack_authorization: { reference?: string } | null;
  briefs: { id: string; form_payload: { brand_name?: string } | null } | { id: string; form_payload: { brand_name?: string } | null }[] | null;
  customers: { id: string; name: string | null } | { id: string; name: string | null }[] | null;
}

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (value === null || value === undefined) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function fetchPaid(): Promise<PaidOrderRow[]> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from('orders')
    .select(
      `id, tier, paid_at, amount_ngn, paystack_authorization, briefs!inner(id, form_payload), customers!inner(id, name:full_name)`,
    )
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })
    .limit(PAGE_SIZE);
  if (error) throw new Error(`paid_orders_query_failed: ${error.message}`);
  return ((data ?? []) as unknown as JoinedRow[]).map((o) => {
    const brief = firstOrNull(o.briefs);
    const customer = firstOrNull(o.customers);
    return {
      order_id: o.id,
      brief_id: brief?.id ?? '',
      brand_name: brief?.form_payload?.brand_name ?? null,
      customer_name: customer?.name ?? null,
      tier: o.tier as PaidOrderRow['tier'],
      paid_at: o.paid_at ?? '',
      amount_ngn: o.amount_ngn ?? 0,
      paystack_reference: o.paystack_authorization?.reference ?? null,
    };
  });
}

export default async function PaidOrdersPage() {
  const initial = await fetchPaid();
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-semibold">Paid orders</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Last {initial.length} paid orders. Live updates via Realtime.
      </p>
      <div className="mt-6">
        <PaidOrdersTable initialRows={initial} pageSize={PAGE_SIZE} />
      </div>
    </div>
  );
}
