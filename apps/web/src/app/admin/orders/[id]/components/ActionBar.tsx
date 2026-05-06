// Stub — implementation in Task 7.
'use client';
interface ActionBarProps {
  orderId: string;
  briefId: string;
  priorRunId: string | null;
  runIndex: number;
  submittedAt: string;
  customerEmail: string | null;
  analysisReady: boolean;
}
export function ActionBar(_props: ActionBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 border-t bg-background p-3 text-center text-xs text-muted-foreground">
      Action bar (approve / re-analyze / discard) — wired in Task 7.
    </div>
  );
}
