'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { PaidOrderRow } from './page';
import { LoadMoreButton } from './LoadMoreButton';
import { RealtimePaidOrders } from './RealtimePaidOrders';

function fmtAmount(ngn: number): string {
  return `₦${ngn.toLocaleString('en-NG')}`;
}

function fmtPaidAt(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toISOString().slice(0, 16)}Z`;
}

export function PaidOrdersTable({ initialRows, pageSize }: { initialRows: PaidOrderRow[]; pageSize: number }) {
  const [rows, setRows] = useState<PaidOrderRow[]>(initialRows);
  return (
    <div className="rounded-lg border bg-card">
      <div className="grid grid-cols-[2fr_1.5fr_0.8fr_1.4fr_1fr] items-center gap-3 border-b bg-muted/30 px-3 py-2 text-xs uppercase text-muted-foreground">
        <span>Brand</span>
        <span>Customer</span>
        <span>Tier</span>
        <span>Paid at</span>
        <span className="text-right">Amount</span>
      </div>
      {rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">No paid orders yet.</p>
      ) : (
        rows.map((r) => (
          <Link
            key={r.order_id}
            href={`/admin/orders/${r.order_id}`}
            className="grid grid-cols-[2fr_1.5fr_0.8fr_1.4fr_1fr] items-center gap-3 border-b px-3 py-2 text-sm hover:bg-muted/40"
          >
            <span className="font-medium">{r.brand_name ?? '—'}</span>
            <span className="text-muted-foreground">{r.customer_name ?? 'Unknown'}</span>
            <span><span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs uppercase">{r.tier}</span></span>
            <span className="text-xs text-muted-foreground">{fmtPaidAt(r.paid_at)}</span>
            <span className="text-right tabular-nums">{fmtAmount(r.amount_ngn)}</span>
          </Link>
        ))
      )}
      <RealtimePaidOrders onPrepend={(row) => setRows((prev) => [row, ...prev])} />
      <LoadMoreButton currentCount={rows.length} pageSize={pageSize} onLoaded={(more) => setRows((prev) => [...prev, ...more])} />
    </div>
  );
}
