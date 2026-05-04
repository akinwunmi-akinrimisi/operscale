'use client';

// Tier selector. Prices per docs/pricing-and-packages.md.

const TIERS = [
  { id: 'starter',  label: 'Starter',  priceNgn: 150_000, days: 7,  videos: 7,  carousels: 3 },
  { id: 'standard', label: 'Standard', priceNgn: 275_000, days: 14, videos: 14, carousels: 7 },
  { id: 'calendar', label: 'Calendar', priceNgn: 525_000, days: 30, videos: 30, carousels: 14 },
] as const;

export function TierPicker() {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Tier</h3>
      <div className="space-y-2">
        {TIERS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="block w-full rounded-md border bg-card px-3 py-3 text-left hover:bg-accent"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{t.label}</span>
              <span className="text-sm text-muted-foreground">
                ₦{t.priceNgn.toLocaleString('en-NG')}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t.videos} videos + {t.carousels} carousels • {t.days}-day calendar
            </p>
          </button>
        ))}
      </div>
      {/* TODO(Operscale): wire up selected state */}
    </div>
  );
}
