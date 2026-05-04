// Step 3 — Content direction. After this step we issue a save_token and email
// the resume link (per docs/specs/email-templates.md "save-token" template).

export const metadata = { title: 'Step 3 — Content direction — Operscale' };

export default function Step3Page() {
  return (
    <main className="container max-w-xl py-12">
      <p className="text-sm text-muted-foreground">Step 3 of 7</p>
      <h1 className="mt-2 text-2xl font-semibold">What direction do you want?</h1>
      {/* TODO(Operscale): direction questions, then issue save_token via /v1/brief/save */}
    </main>
  );
}
