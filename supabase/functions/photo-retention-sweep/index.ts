// supabase/functions/photo-retention-sweep/index.ts
//
// Daily 03:00 WAT sweep that deletes photo files whose scheduled_delete_at has passed.
// Source: docs/specs/photo-upload-and-retention.md.
//
// Phase 1 ships this as a manually-invokable function first (per CLAUDE.md
// "observability before automation"). After we watch a few real cycles in the
// activity_log, we add the cron schedule via Supabase dashboard:
//   schedule: 0 2 * * *   (02:00 UTC = 03:00 WAT)
//
// This file is a stub. Implementation lands during Day 13 of the build plan
// (docs/implementation.md). Do not implement the deletion logic until the
// retention spec is being actively tested with real photos in staging.

// deno-lint-ignore-file no-unused-vars
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

serve((_req) => {
  // TODO(Operscale): implement photo retention sweep per
  // docs/specs/photo-upload-and-retention.md "Daily Retention Sweep" section.
  //
  // Required behaviour:
  //   1. Select brief_photos WHERE scheduled_delete_at <= now() AND deleted_at IS NULL
  //   2. For each row: delete file from storage 'customer-photos' bucket
  //   3. UPDATE brief_photos SET deleted_at = now()
  //   4. INSERT into activity_log: event_type='photo_deleted_by_retention_sweep'
  //   5. Return { processed: N, errors: [...] }
  return new Response(
    JSON.stringify({ status: 'not_implemented', spec: 'docs/specs/photo-upload-and-retention.md' }),
    { status: 501, headers: { 'content-type': 'application/json' } },
  );
});
