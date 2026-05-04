// POST /api/v1/brief/edit-field
// Spec: docs/specs/founder-review-flow.md "Inline Edits".
//
// Required behaviour:
//   1. Read analysis_run_id + field_path + value_before + value_after
//   2. Verify auth: founder JWT claim
//   3. INSERT analysis_edits (one row per edit, append-only)
//   4. INSERT activity_log: founder_edited_field with payload
//   5. Edits are NOT applied to ai_output until /approve materialises them.

import { NextResponse } from 'next/server';

export async function POST() {
  // TODO(Operscale): implement per docs/specs/founder-review-flow.md
  return NextResponse.json(
    { status: 'not_implemented', spec: 'docs/specs/founder-review-flow.md' },
    { status: 501 },
  );
}
