// apps/agent/src/worker/photos.test.ts
//
// Schema check result: briefs table does NOT have logo_storage_path / logo_mime_type columns.
// The step-4 logo upload UI is a TODO. Decision: path (a) — skip logo fetching entirely.
// Test 3 ("downloads the logo…") is dropped; production code never queries briefs for logo.

import { describe, it, expect, vi } from 'vitest';
import { fetchBriefPhotos } from './photos.js';

function blobOf(bytes: number[]): Blob {
  return new Blob([new Uint8Array(bytes)]);
}

function makeFakeSupabase(opts: {
  briefPhotos: Array<{ storage_path: string; mime_type: string }>;
  blobsByPath: Record<string, Blob>;
}) {
  const supabase: any = {
    from: vi.fn((table: string) => {
      if (table === 'brief_photos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: opts.briefPhotos, error: null }),
          }),
        };
      }
      return { select: vi.fn() };
    }),
    storage: {
      from: vi.fn((bucket: string) => ({
        download: vi.fn().mockImplementation(async (path: string) => {
          const blob = opts.blobsByPath[`${bucket}/${path}`];
          if (!blob) return { data: null, error: { message: `not found: ${bucket}/${path}` } };
          return { data: blob, error: null };
        }),
      })),
    },
  };
  return supabase;
}

describe('fetchBriefPhotos', () => {
  it('returns photos: [] and logo: undefined when brief has no photos', async () => {
    const sb = makeFakeSupabase({
      briefPhotos: [],
      blobsByPath: {},
    });
    const result = await fetchBriefPhotos(sb, 'brief1');
    expect(result.photos).toEqual([]);
    expect(result.logo).toBeUndefined();
  });

  it('downloads each brief photo and base64-encodes the bytes', async () => {
    const sb = makeFakeSupabase({
      briefPhotos: [
        { storage_path: 'brief1/photo-a.jpg', mime_type: 'image/jpeg' },
        { storage_path: 'brief1/photo-b.png', mime_type: 'image/png' },
      ],
      blobsByPath: {
        'customer-photos/brief1/photo-a.jpg': blobOf([0xff, 0xd8, 0xff]),
        'customer-photos/brief1/photo-b.png': blobOf([0x89, 0x50, 0x4e]),
      },
    });
    const result = await fetchBriefPhotos(sb, 'brief1');
    expect(result.photos).toHaveLength(2);
    const first = result.photos[0]!;
    expect(first.role).toBe('reference');
    expect(first.mediaType).toBe('image/jpeg');
    expect(first.base64.length).toBeGreaterThan(0);
    expect(first.base64).toMatch(/^\/9j\//);
  });

  it('throws when a photo blob fails to download', async () => {
    const sb = makeFakeSupabase({
      briefPhotos: [{ storage_path: 'brief1/missing.jpg', mime_type: 'image/jpeg' }],
      blobsByPath: {},
    });
    await expect(fetchBriefPhotos(sb, 'brief1')).rejects.toThrow(/not found|download.*failed/i);
  });
});
