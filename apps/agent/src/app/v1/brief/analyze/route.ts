// POST /v1/brief/analyze
// Spec: docs/specs/ai-brief-analysis.md.
// AGENT.md state: AI_ANALYSIS_RUNNING.
//
// Required behaviour:
//   1. Read brief_id from body
//   2. Load brief.form_payload + brief_photos + niche-briefs/<niche>.md
//   3. Build Claude Opus 4.7 system + user prompt per spec
//   4. Attach photos as base64 vision blocks (if any)
//   5. Call Anthropic SDK with max_tokens=4000, retry 5x w/ exp backoff on 5xx
//   6. Validate output JSON against zod schema (per spec output schema)
//   7. INSERT analysis_runs(run_index=1, trigger_type='initial', is_current=true)
//   8. INSERT llm_calls with cost + tokens + duration
//   9. UPDATE order.status (no change here; stays pending_founder_review)
//  10. INSERT activity_log: ai_analysis_completed
//
// Concurrency cap: max 5 in-flight analyses (CLAUDE.md gotcha #8).

import { NextResponse } from 'next/server';

export async function POST() {
  // TODO(Operscale): implement per docs/specs/ai-brief-analysis.md
  return NextResponse.json(
    { status: 'not_implemented', spec: 'docs/specs/ai-brief-analysis.md' },
    { status: 501 },
  );
}
