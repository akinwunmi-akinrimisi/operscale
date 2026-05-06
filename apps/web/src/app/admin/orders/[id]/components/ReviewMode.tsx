import { getSupabaseServer } from '@/lib/supabase-server';
import { HistoryAccordion, type HistoryEvent } from './HistoryAccordion';
import { FormResponsesPanel } from './FormResponsesPanel';
import { AiSnapshotPanel } from './AiSnapshotPanel';
import { ActionBar } from './ActionBar';
import { RealtimeOrderDetail } from './RealtimeOrderDetail';

// Supabase-js with PostgREST embed returns nested resources as arrays even when
// the FK is single-valued. Normalise inline.
interface OrderBriefEmbed {
  id: string;
  submitted_at: string;
  form_payload: Record<string, unknown> | null;
}
interface OrderCustomerEmbed {
  id: string;
  name: string | null;
  email: string | null;
}
interface OrderRow {
  id: string;
  brief_id: string;
  customer_id: string;
  status: string;
  tier: string;
  briefs: OrderBriefEmbed[] | OrderBriefEmbed | null;
  customers: OrderCustomerEmbed[] | OrderCustomerEmbed | null;
}

function firstOrNull<T>(value: T[] | T | null | undefined): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

interface ReviewModeProps {
  orderId: string;
  order: OrderRow;
}

interface AnalysisRun {
  id: string;
  run_index: number;
  estimated_quality_score: number | null;
  framework_seed: { selected_pairs: { framework: string; archetype: string }[] } | null;
  ai_output: {
    brief_summary?: string;
    upsell_recommendation?: {
      should_upsell?: boolean;
      recommended_tier?: string;
      reasoning?: string;
      upsell_price_delta?: number;
    } | null;
    flags?: string[];
  } | null;
}

async function fetchPanels(briefId: string): Promise<{
  run: AnalysisRun | null;
  events: HistoryEvent[];
  photoCount: number;
}> {
  const supabase = await getSupabaseServer();
  const [{ data: runRow }, { data: eventsRows }, { count: photoCount }] = await Promise.all([
    supabase
      .from('analysis_runs')
      .select('id, run_index, estimated_quality_score, framework_seed, ai_output')
      .eq('brief_id', briefId)
      .eq('is_current', true)
      .maybeSingle(),
    supabase
      .from('activity_log')
      .select('occurred_at, event_type, payload')
      .eq('brief_id', briefId)
      .order('occurred_at', { ascending: true }),
    supabase
      .from('brief_photos')
      .select('*', { count: 'exact', head: true })
      .eq('brief_id', briefId),
  ]);
  return {
    run: (runRow as AnalysisRun | null) ?? null,
    events: (eventsRows ?? []) as HistoryEvent[],
    photoCount: photoCount ?? 0,
  };
}

export async function ReviewMode({ orderId, order }: ReviewModeProps) {
  const briefId = order.brief_id;
  const brief = firstOrNull(order.briefs);
  const customer = firstOrNull(order.customers);
  const submittedAt = brief?.submitted_at ?? new Date().toISOString();
  const { run, events, photoCount } = await fetchPanels(briefId);

  const formPayload = (brief?.form_payload ?? null) as Parameters<
    typeof FormResponsesPanel
  >[0]['formPayload'];

  return (
    <div className="container py-6 pb-24">
      <p className="mb-2 text-xs text-muted-foreground">
        Order {orderId.slice(0, 8)} · status: pending_founder_review
      </p>
      <div className="mb-3">
        <HistoryAccordion events={events} submittedAt={submittedAt} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <FormResponsesPanel
          formPayload={formPayload}
          customerName={customer?.name ?? null}
          customerEmail={customer?.email ?? null}
          brandName={
            (formPayload as { brand_name?: string } | null)?.brand_name ?? null
          }
          photoCount={photoCount}
        />
        {run ? (
          <AiSnapshotPanel
            runIndex={run.run_index}
            estimatedQualityScore={run.estimated_quality_score}
            briefSummary={run.ai_output?.brief_summary ?? null}
            selectedPairs={run.framework_seed?.selected_pairs ?? []}
            upsell={run.ai_output?.upsell_recommendation ?? null}
            flags={run.ai_output?.flags ?? []}
          />
        ) : (
          <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
            AI analysis hasn’t completed yet — check back in a few minutes.
            Re-analyze and Approve are disabled until it lands.
          </div>
        )}
      </div>
      <ActionBar
        orderId={orderId}
        briefId={briefId}
        priorRunId={run?.id ?? null}
        runIndex={run?.run_index ?? 0}
        submittedAt={submittedAt}
        customerEmail={customer?.email ?? null}
        analysisReady={Boolean(run)}
      />
      <RealtimeOrderDetail orderId={orderId} briefId={briefId} />
    </div>
  );
}
