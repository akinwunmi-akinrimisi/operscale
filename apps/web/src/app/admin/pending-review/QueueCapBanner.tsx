export function QueueCapBanner() {
  return (
    <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <strong>Queue cap reached.</strong> 100+ pending reviews — clear queue or check
      whether AI analysis is stuck. (Worker sweep reclaims orphaned jobs every 5 min.)
    </div>
  );
}
