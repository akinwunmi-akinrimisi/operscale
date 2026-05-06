'use client';

import { useEffect } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import type { QueueRowData } from './QueueRow';

interface RealtimeQueueProps {
  onUpdate: (updater: (prev: QueueRowData[]) => QueueRowData[]) => void;
}

// Hydrates one queue row from the orders.id by re-running the same join query.
async function fetchJoinedRow(orderId: string): Promise<QueueRowData | null> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from('orders')
    .select(
      `id, tier, status, briefs!inner(id, submitted_at, form_payload), customers!inner(id, name), brief_photos(brief_id)`,
    )
    .eq('id', orderId)
    .maybeSingle();
  if (error || !data) return null;
  // The supabase-js join shape: briefs is an array because orders→briefs is FK,
  // but FK is unique (one brief per order) so we take [0].
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const briefRow: any = Array.isArray((data as any).briefs)
    ? (data as any).briefs[0]
    : (data as any).briefs;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customerRow: any = Array.isArray((data as any).customers)
    ? (data as any).customers[0]
    : (data as any).customers;
  return {
    order_id: data.id,
    brief_id: briefRow?.id ?? '',
    brand_name: briefRow?.form_payload?.brand_name ?? null,
    customer_name: customerRow?.name ?? null,
    niche: briefRow?.form_payload?.niche ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tier: data.tier as any,
    submitted_at: briefRow?.submitted_at ?? new Date().toISOString(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    has_photos: Array.isArray((data as any).brief_photos) && (data as any).brief_photos.length > 0,
  };
}

export function RealtimeQueue({ onUpdate }: RealtimeQueueProps) {
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel('pending-review')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: 'status=eq.pending_founder_review' },
        async (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const newRow = (payload as any).new;
          if (!newRow?.id) return;
          const joined = await fetchJoinedRow(newRow.id);
          if (joined) {
            onUpdate((prev) => [joined, ...prev]);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const newRow = (payload as any).new;
          if (newRow?.status !== 'pending_founder_review') {
            onUpdate((prev) => prev.filter((r) => r.order_id !== newRow?.id));
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'orders' },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const oldRow = (payload as any).old;
          onUpdate((prev) => prev.filter((r) => r.order_id !== oldRow?.id));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [onUpdate]);

  return null;
}
