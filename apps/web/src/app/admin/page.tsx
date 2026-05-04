// /admin — sign-in page (magic link) + dashboard for already-signed-in founders.
// Spec: docs/specs/founder-review-flow.md.

export default function AdminHomePage() {
  return (
    <div className="container py-12">
      <h1 className="text-2xl font-semibold">CRM</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign in with your magic link to access pending reviews.
      </p>
      {/* TODO(Operscale): magic-link form via supabase.auth.signInWithOtp */}
    </div>
  );
}
