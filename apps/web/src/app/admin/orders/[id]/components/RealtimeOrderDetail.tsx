'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

interface RealtimeOrderDetailProps {
  orderId: string;
  briefId: string;
}

export function RealtimeOrderDetail({ orderId, briefId }: RealtimeOrderDetailProps) {
  const router = useRouter();
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel(`order-detail-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, () => router.refresh())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'analysis_runs', filter: `brief_id=eq.${briefId}` }, () => router.refresh())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `brief_id=eq.${briefId}` }, () => router.refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, briefId, router]);
  return null;
}
