'use client';

import { useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import type { PaidOrderRow } from './page';

interface LoadMoreButtonProps {
  currentCount: number;
  pageSize: number;
  onLoaded: (rows: PaidOrderRow[]) => void;
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

export function LoadMoreButton({ currentCount, pageSize, onLoaded }: LoadMoreButtonProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  if (done) return null;

  async function load() {
    if (loading) return;
    setLoading(true);
    const supabase = getSupabaseBrowser();
    const { data, error } = await supabase
      .from('orders')
      .select(
        `id, tier, paid_at, amount_ngn, paystack_authorization, briefs!inner(id, form_payload), customers!inner(id, name:full_name)`,
      )
      .eq('status', 'paid')
      .order('paid_at', { ascending: false })
      .range(currentCount, currentCount + pageSize - 1);
    setLoading(false);
    if (error) {
      console.error('[LoadMore] failed', error);
      return;
    }
    const more: PaidOrderRow[] = ((data ?? []) as unknown as JoinedRow[]).map((o) => {
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
    onLoaded(more);
    if (more.length < pageSize) setDone(true);
  }

  return (
    <div className="flex justify-center p-3">
      <button type="button" onClick={load} disabled={loading} className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50">
        {loading ? 'Loading…' : 'Load more'}
      </button>
    </div>
  );
}
