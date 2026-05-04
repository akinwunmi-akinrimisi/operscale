// Step 7 — Review + submit.
// Submit fires POST /v1/brief/submit (agent), which creates customer/brief/order,
// sends auto-ack email, queues AI analysis. AGENT.md state: SUBMITTED.

export const metadata = { title: 'Step 7 — Review and submit — Operscale' };

export default function Step7Page() {
  return (
    <main className="container max-w-xl py-12">
      <p className="text-sm text-muted-foreground">Step 7 of 7</p>
      <h1 className="mt-2 text-2xl font-semibold">Review and submit</h1>
      <p className="mt-2 text-muted-foreground">
        We'll email a personalised brief within 1 hour during business hours, then a payment link.
      </p>
      {/* TODO(Operscale): review summary + submit → POST /v1/brief/submit */}
    </main>
  );
}
