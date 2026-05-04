// Step 1 — Tier intent.
// Customer picks Starter / Standard / Calendar.
// Spec: docs/customer-journey.md, docs/pricing-and-packages.md.

export const metadata = { title: 'Step 1 — Pick your tier — Operscale' };

export default function Step1Page() {
  return (
    <main className="container max-w-xl py-12">
      <p className="text-sm text-muted-foreground">Step 1 of 7</p>
      <h1 className="mt-2 text-2xl font-semibold">Pick your tier</h1>
      {/* TODO(Operscale): tier picker per docs/customer-journey.md */}
    </main>
  );
}
