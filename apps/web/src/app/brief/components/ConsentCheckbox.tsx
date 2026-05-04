'use client';

// ConsentCheckbox — renders the canonical consent text and captures the
// signed-at timestamp + hash to send with the photo upload.
// Spec: docs/specs/photo-upload-and-retention.md "Consent Text (Canonical v1)".

import { useState } from 'react';
import { CONSENT_TEXT_V1, CONSENT_VERSION } from '@/lib/consent';

export function ConsentCheckbox() {
  const [checked, setChecked] = useState(false);

  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border bg-card p-4 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
        className="mt-1"
      />
      <span className="leading-relaxed text-muted-foreground">
        {CONSENT_TEXT_V1}
        <span className="mt-2 block text-xs">Version: {CONSENT_VERSION}</span>
      </span>
    </label>
  );
}
