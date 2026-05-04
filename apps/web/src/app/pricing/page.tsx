// /pricing — interactive calendar preview page.
// Spec: docs/specs/calendar-preview-on-pricing-page.md.
// Implementation: Day 2 of docs/implementation.md.

import { CalendarPreview } from './components/CalendarPreview';
import { NichePicker } from './components/NichePicker';
import { TierPicker } from './components/TierPicker';

export const metadata = {
  title: 'Pricing — Operscale',
};

export default function PricingPage() {
  return (
    <main className="container py-16">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">
          One brief. A month of content. Start in 7 minutes.
        </h1>
        <p className="mt-3 text-muted-foreground">
          Pick a tier, pick your niche, see exactly what your calendar will look like.
        </p>
      </header>

      <section className="mt-10 grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-6">
          <TierPicker />
          <NichePicker />
        </aside>
        <CalendarPreview />
      </section>

      <section className="mt-16 flex flex-col items-start gap-3">
        <a
          href="/brief"
          className="rounded-md bg-primary px-5 py-2.5 text-primary-foreground hover:opacity-90"
        >
          Start your brief
        </a>
        <p className="text-sm text-muted-foreground">
          7 minutes. Pay only after we send your personalised plan.
        </p>
      </section>
    </main>
  );
}
