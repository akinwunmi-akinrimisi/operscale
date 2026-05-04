// POST /api/v1/brief/reanalyze
// Spec: docs/specs/founder-review-flow.md "Re-analyze Action".
//
// Required behaviour:
//   1. Read brief_id + founder_note (min 10 chars) from body
//   2. Verify auth: founder JWT claim (RLS enforces but check at edge too)
//   3. UPDATE analysis_runs SET is_current=false WHERE brief_id=$1 AND is_current=true
//   4. Build prompt: original form + photos + appended founder note
//   5. Call Anthropic, validate output, compute cost
//   6. INSERT analysis_runs(run_index = max+1, trigger_type='re_analyze_with_note', is_current=true)
//   7. INSERT llm_calls + activity_log: ai_reanalyze_requested
//   8. Warn if run_index > 3, red flag if > 5

import { NextResponse } from 'next/server';

export async function POST() {
  // TODO(Operscale): implement per docs/specs/founder-review-flow.md
  return NextResponse.json(
    { status: 'not_implemented', spec: 'docs/specs/founder-review-flow.md' },
    { status: 501 },
  );
}
