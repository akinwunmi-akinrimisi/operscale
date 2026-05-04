// Step 5 — Optional photo upload for AI avatar.
// Spec: docs/specs/photo-upload-and-retention.md.
// Quality check (advisory) via @tensorflow-models/blazeface in PhotoUploader.

import { PhotoUploader } from '../components/PhotoUploader';
import { ConsentCheckbox } from '../components/ConsentCheckbox';

export const metadata = { title: 'Step 5 — Photos (optional) — Operscale' };

export default function Step5Page() {
  return (
    <main className="container max-w-xl py-12">
      <p className="text-sm text-muted-foreground">Step 5 of 7</p>
      <h1 className="mt-2 text-2xl font-semibold">Want your face in your videos?</h1>
      <p className="mt-2 text-muted-foreground">
        Optional. Skip and we'll use a stock AI presenter that fits your brand.
      </p>
      <div className="mt-6 space-y-6">
        <PhotoUploader />
        <ConsentCheckbox />
      </div>
      {/* TODO(Operscale): wire upload → /v1/brief/upload-photo */}
    </main>
  );
}
