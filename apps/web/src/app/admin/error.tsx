'use client';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container py-12">
      <h1 className="text-xl font-semibold">Couldn’t load the CRM.</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md border px-3 py-1.5 text-sm"
      >
        Try again
      </button>
    </div>
  );
}
