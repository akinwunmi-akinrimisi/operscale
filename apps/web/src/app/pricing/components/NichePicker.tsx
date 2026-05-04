'use client';

// Niche selector for the calendar preview.
// Available niches: beauty, real-estate, fashion-ecom, fintech, health, food, education.
// Restricted niches are listed in niche-briefs/restricted.md and not pickable here.

const NICHES = [
  { id: 'beauty', label: 'Beauty' },
  { id: 'real-estate', label: 'Real estate' },
  { id: 'fashion-ecom', label: 'Fashion / e-commerce' },
  { id: 'fintech', label: 'Fintech' },
  { id: 'health', label: 'Health' },
  { id: 'food', label: 'Food' },
  { id: 'education', label: 'Education' },
] as const;

export function NichePicker() {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Niche</h3>
      <select className="w-full rounded-md border bg-background px-3 py-2 text-sm">
        {NICHES.map((n) => (
          <option key={n.id} value={n.id}>
            {n.label}
          </option>
        ))}
      </select>
      {/* TODO(Operscale): wire up state + thumbnail loading */}
    </div>
  );
}
