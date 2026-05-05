// apps/agent/src/worker/photos.ts
//
// Worker fetches the brief's reference photos from the customer-photos bucket
// and base64-encodes them in memory (design §3.1, §6.1 step 3b).
//
// Logo handling (customer-logos bucket) is deferred: briefs.logo_storage_path /
// briefs.logo_mime_type columns do not exist yet — the step-4 logo upload UI is
// a TODO. When those columns land, restore the briefs query and the logo PhotoBlock
// below. See schema check in photos.test.ts for the decision record.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PhotoBlock } from '../lib/types/v2.js';

const BUCKET_PHOTOS = 'customer-photos';

type AcceptedMime = PhotoBlock['mediaType'];
const ACCEPTED_MIMES: readonly AcceptedMime[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function normaliseMime(raw: string | null | undefined): AcceptedMime {
  if (raw && (ACCEPTED_MIMES as readonly string[]).includes(raw)) return raw as AcceptedMime;
  return 'image/jpeg';
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = Buffer.from(await blob.arrayBuffer());
  return buf.toString('base64');
}

export async function fetchBriefPhotos(
  supabase: SupabaseClient,
  briefId: string,
): Promise<{ photos: PhotoBlock[]; logo?: PhotoBlock }> {
  const { data: photoRows, error: photoErr } = await supabase
    .from('brief_photos')
    .select('storage_path, mime_type')
    .eq('brief_id', briefId);
  if (photoErr) throw new Error(`fetchBriefPhotos: brief_photos query failed: ${photoErr.message}`);

  const photos: PhotoBlock[] = [];
  for (const row of photoRows ?? []) {
    const { data: blob, error: dlErr } = await supabase.storage
      .from(BUCKET_PHOTOS)
      .download(row.storage_path);
    if (dlErr || !blob) {
      throw new Error(
        `fetchBriefPhotos: download ${BUCKET_PHOTOS}/${row.storage_path} failed: ${dlErr?.message ?? 'no blob'}`,
      );
    }
    photos.push({
      role: 'reference',
      mediaType: normaliseMime(row.mime_type),
      base64: await blobToBase64(blob),
    });
  }

  // logo: undefined — logo_storage_path column does not exist in briefs table yet.
  // Restore when step-4 logo upload is implemented and migration 0007 adds the columns.
  return { photos };
}
