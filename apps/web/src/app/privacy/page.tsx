// Privacy policy page.
// Source of truth: docs/specs/ndpc-compliance.md "Privacy Policy Sections".
// Final copy lands during Day 3 (NDPC registration prep).

export const metadata = {
  title: 'Privacy policy — Operscale',
};

export default function PrivacyPage() {
  return (
    <main className="container max-w-2xl py-16 prose">
      <h1>Privacy policy</h1>
      <p className="text-muted-foreground">
        Stub. Final content per docs/specs/ndpc-compliance.md sections covering: who we are
        (NDPC registration), what data, why we collect, who we share with, retention,
        your rights, cookies, cross-border transfers, children, updates, contact.
      </p>
      <p>
        Privacy questions: <a href="mailto:privacy@operscale.cloud">privacy@operscale.cloud</a>
      </p>
      {/* TODO(Operscale): full privacy copy per docs/specs/ndpc-compliance.md */}
    </main>
  );
}
