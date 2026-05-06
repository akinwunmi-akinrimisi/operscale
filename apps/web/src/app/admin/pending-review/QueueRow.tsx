import Link from 'next/link';

export interface QueueRowData {
  order_id: string;
  brief_id: string;
  brand_name: string | null;
  customer_name: string | null;
  niche: string | null;
  tier: 'starter' | 'standard' | 'calendar';
  submitted_at: string;
  has_photos: boolean;
}

function badgeClass(submittedAt: string, now: number): { className: string; label: string } {
  const ageMs = now - new Date(submittedAt).getTime();
  const ageMin = Math.max(0, Math.floor(ageMs / 60_000));
  let label: string;
  if (ageMin < 60) label = `${ageMin}m`;
  else if (ageMin < 1440) label = `${Math.floor(ageMin / 60)}h`;
  else label = `${Math.floor(ageMin / 1440)}d`;
  if (ageMin <= 30) {
    return { className: 'bg-green-100 text-green-900', label };
  }
  if (ageMin <= 120) {
    return { className: 'bg-amber-100 text-amber-900', label };
  }
  return { className: 'bg-red-100 text-red-900', label };
}

export function QueueRow({ row, now = Date.now() }: { row: QueueRowData; now?: number }) {
  const badge = badgeClass(row.submitted_at, now);
  return (
    <Link
      href={`/admin/orders/${row.order_id}`}
      className="grid grid-cols-[2fr_1.5fr_0.8fr_1fr_0.8fr_0.4fr] items-center gap-3 border-b px-3 py-2 text-sm hover:bg-muted/40"
    >
      <span className="font-medium">{row.brand_name ?? '—'}</span>
      <span className="text-muted-foreground">{row.customer_name ?? 'Unknown'}</span>
      <span>
        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs uppercase">
          {row.tier}
        </span>
      </span>
      <span className="text-muted-foreground">{row.niche ?? '—'}</span>
      <span>
        <span className={`rounded px-2 py-0.5 text-xs ${badge.className}`}>{badge.label}</span>
      </span>
      <span className="text-right text-xs text-muted-foreground">
        {row.has_photos ? '\u{1F4F7}' : ''}
      </span>
    </Link>
  );
}
