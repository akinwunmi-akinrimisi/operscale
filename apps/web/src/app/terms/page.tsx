// Terms of service page.
// Final copy lands during Day 3 alongside privacy policy.

export const metadata = {
  title: 'Terms of service — Operscale',
};

export default function TermsPage() {
  return (
    <main className="container max-w-2xl py-16 prose">
      <h1>Terms of service</h1>
      <p className="text-muted-foreground">
        Stub. Final content covers: service description, payment terms (Paystack),
        delivery SLA per tier (24h / 36h / 48h), refund policy, IP ownership of generated
        content, customer data + photo retention (90 days post-delivery), termination,
        governing law (Nigeria).
      </p>
      {/* TODO(Operscale): full terms copy */}
    </main>
  );
}
