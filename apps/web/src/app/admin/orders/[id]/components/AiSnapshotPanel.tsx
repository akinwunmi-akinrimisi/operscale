interface SelectedPair {
  framework: string;
  archetype: string;
}

interface AiOutput {
  brief_summary?: string;
  upsell_recommendation?: {
    should_upsell?: boolean;
    recommended_tier?: string;
    reasoning?: string;
    upsell_price_delta?: number;
  } | null;
  flags?: string[];
}

interface AiSnapshotPanelProps {
  runIndex: number;
  estimatedQualityScore: number | null;
  briefSummary: string | null;
  selectedPairs: SelectedPair[];
  upsell: AiOutput['upsell_recommendation'];
  flags: string[];
}

function qualityBadge(score: number | null): { className: string; label: string } {
  if (score === null) return { className: 'bg-muted text-muted-foreground', label: '—' };
  if (score > 0.7) return { className: 'bg-green-100 text-green-900', label: score.toFixed(2) };
  if (score >= 0.5) return { className: 'bg-amber-100 text-amber-900', label: score.toFixed(2) };
  return { className: 'bg-red-100 text-red-900', label: score.toFixed(2) };
}

export function AiSnapshotPanel({
  runIndex,
  estimatedQualityScore,
  briefSummary,
  selectedPairs,
  upsell,
  flags,
}: AiSnapshotPanelProps) {
  const badge = qualityBadge(estimatedQualityScore);
  return (
    <div className="space-y-4 rounded-lg border bg-yellow-50/30 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">AI snapshot</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Run {runIndex}</span>
          <span className={`rounded px-2 py-0.5 ${badge.className}`}>Q {badge.label}</span>
        </div>
      </div>

      <section>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground">Brief summary</h4>
        <p className="mt-1 whitespace-pre-line text-sm">
          {briefSummary ?? <span className="text-muted-foreground">—</span>}
        </p>
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground">
          Selected pairs ({selectedPairs.length})
        </h4>
        <ul className="mt-1 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
          {selectedPairs.map((p, i) => (
            <li key={i} className="rounded border bg-card px-2 py-1">
              <span className="font-medium">{p.framework}</span>{' '}
              <span className="text-muted-foreground">× {p.archetype}</span>
            </li>
          ))}
        </ul>
      </section>

      {upsell && (
        <section>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">Upsell</h4>
          <p className="mt-1 text-sm">
            {upsell.should_upsell ? (
              <>
                Recommend <strong>{upsell.recommended_tier}</strong>
                {typeof upsell.upsell_price_delta === 'number' && (
                  <> (+₦{upsell.upsell_price_delta.toLocaleString('en-NG')})</>
                )}
                : {upsell.reasoning}
              </>
            ) : (
              <span className="text-muted-foreground">No upsell recommended.</span>
            )}
          </p>
        </section>
      )}

      {flags && flags.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">Flags</h4>
          <ul className="mt-1 list-disc pl-4 text-xs text-amber-900">
            {flags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
