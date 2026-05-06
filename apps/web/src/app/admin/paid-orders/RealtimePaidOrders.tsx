'use client';

import { useEffect } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import type { PaidOrderRow } from './page';

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

async function fetchJoined(orderId: string): Promise<PaidOrderRow | null> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from('orders')
    .select(
      `id, tier, paid_at, amount_ngn, paystack_authorization, briefs!inner(id, form_payload), customers!inner(id, name:full_name)`,
    )
    .eq('id', orderId)
    .eq('status', 'paid')
    .maybeSingle();
  if (error || !data) return null;
  const o = data as unknown as JoinedRow;
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
}

export function RealtimePaidOrders({ onPrepend }: { onPrepend: (row: PaidOrderRow) => void }) {
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel('paid-orders')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: 'status=eq.paid' },
        async (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const newRow = (payload as any).new;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const oldRow = (payload as any).old;
          if (newRow?.status === 'paid' && oldRow?.status !== 'paid' && newRow?.id) {
            const joined = await fetchJoined(newRow.id);
            if (joined) onPrepend(joined);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [onPrepend]);
  return null;
}
