import { getSupabaseServer } from '@/lib/supabase-server';
import { EventCard } from './timeline/EventCard';
import { RealtimeOrderDetail } from './RealtimeOrderDetail';

interface OrderRow {
  id: string;
  brief_id: string;
  status: string;
  tier: string;
  amount_ngn: number | null;
  founder_approved_at: string | null;
  paid_at: string | null;
  paystack_authorization: { authorizationUrl?: string; reference?: string } | null;
  briefs: { id: string; submitted_at: string } | { id: string; submitted_at: string }[] | null;
  customers: { id: string; name: string | null; email: string | null } | { id: string; name: string | null; email: string | null }[] | null;
}

interface TimelineModeProps {
  orderId: string;
  order: OrderRow;
}

interface ActivityRow {
  occurred_at: string;
  event_type: string;
  payload: Record<string, unknown> | null;
}

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (value === null || value === undefined) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function TimelineMode({ orderId, order }: TimelineModeProps) {
  const supabase = await getSupabaseServer();
  const briefId = order.brief_id;

  const { data: events } = await supabase
    .from('activity_log')
    .select('occurred_at, event_type, payload')
    .or(`order_id.eq.${orderId},brief_id.eq.${briefId}`)
    .order('occurred_at', { ascending: false });

  const rows = (events ?? []) as ActivityRow[];
  const customer = firstOrNull(order.customers);

  return (
    <div className="container py-6">
      <p className="text-xs text-muted-foreground">
        Order {orderId.slice(0, 8)} · status: {order.status}
      </p>
      <h1 className="mt-1 text-2xl font-semibold">
        {customer?.name ?? 'Unknown customer'} · {order.tier}
      </h1>

      <dl className="mt-4 grid gap-2 rounded-lg border bg-card p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Customer</dt>
          <dd>{customer?.email ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Approved at</dt>
          <dd>{order.founder_approved_at ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Paid at</dt>
          <dd>{order.paid_at ?? '—'}</dd>
        </div>
        {order.paystack_authorization?.authorizationUrl && (
          <div className="sm:col-span-3">
            <dt className="text-xs text-muted-foreground">Paystack URL</dt>
            <dd className="break-all">
              <a
                href={order.paystack_authorization.authorizationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 hover:underline"
              >
                {order.paystack_authorization.authorizationUrl}
              </a>
            </dd>
          </div>
        )}
      </dl>

      <h2 className="mt-6 text-lg font-semibold">Activity</h2>
      <div className="mt-2 space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
            No activity yet.
          </p>
        ) : (
          rows.map((e, i) => (
            <EventCard key={i} occurred_at={e.occurred_at} event_type={e.event_type} payload={e.payload} />
          ))
        )}
      </div>

      <RealtimeOrderDetail orderId={orderId} briefId={briefId} />
    </div>
  );
}
