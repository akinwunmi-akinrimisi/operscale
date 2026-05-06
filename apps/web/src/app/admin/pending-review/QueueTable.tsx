'use client';

import { useState } from 'react';
import { QueueRow, type QueueRowData } from './QueueRow';
import { RealtimeQueue } from './RealtimeQueue';

interface QueueTableProps {
  initialRows: QueueRowData[];
}

export function QueueTable({ initialRows }: QueueTableProps) {
  const [rows, setRows] = useState<QueueRowData[]>(initialRows);

  return (
    <div className="rounded-lg border bg-card">
      <div className="grid grid-cols-[2fr_1.5fr_0.8fr_1fr_0.8fr_0.4fr] items-center gap-3 border-b bg-muted/30 px-3 py-2 text-xs uppercase text-muted-foreground">
        <span>Brand</span>
        <span>Customer</span>
        <span>Tier</span>
        <span>Niche</span>
        <span>Submitted</span>
        <span></span>
      </div>
      {rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">No pending reviews.</p>
      ) : (
        rows.map((row) => <QueueRow key={row.order_id} row={row} />)
      )}
      <RealtimeQueue onUpdate={setRows} />
    </div>
  );
}
