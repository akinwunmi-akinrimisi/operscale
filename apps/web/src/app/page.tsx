// Marketing landing page.
// Implementation lands in Day 1–2 of docs/implementation.md. This stub gives
// the route + brand placeholder so CI's brand-grep check is green from the start.

export default function HomePage() {
  return (
    <main className="container py-24">
      <h1 className="text-4xl font-semibold tracking-tight">
        Operscale — done-for-you content calendars
      </h1>
      <p className="mt-4 text-muted-foreground">
        A monthly calendar of UGC, T2V, and carousels — for Nigerian SMBs.
      </p>
      <p className="mt-8 text-sm text-muted-foreground">
        See <a href="/pricing" className="underline">/pricing</a> or{' '}
        <a href="/brief" className="underline">start your brief</a>.
      </p>
      {/* TODO(Operscale): real marketing copy + design per Day 1–2 of docs/implementation.md */}
    </main>
  );
}
