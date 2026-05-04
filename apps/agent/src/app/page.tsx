// Root page. Anyone hitting api.operscale.cloud / directly gets a minimal note.
// The actual API surface lives under /v1/*.

export default function RootPage() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Operscale Calendar Agent</h1>
      <p>Internal API service. See /v1/health.</p>
    </main>
  );
}
