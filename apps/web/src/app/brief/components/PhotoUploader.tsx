'use client';

// PhotoUploader — drag-drop + camera-capture + advisory quality check.
// Spec: docs/specs/photo-upload-and-retention.md.
// Quality check uses @tensorflow-models/blazeface (face count + confidence)
// and Laplacian-variance sharpness + average-luminance brightness. All advisory.

import { useState } from 'react';

export function PhotoUploader() {
  const [files, setFiles] = useState<File[]>([]);

  return (
    <div className="space-y-3">
      <label
        htmlFor="photo-input"
        className="flex h-32 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-border bg-muted/30 text-sm text-muted-foreground hover:bg-muted/50"
      >
        Drop up to 3 photos here, or click to choose
      </label>
      <input
        id="photo-input"
        type="file"
        accept="image/jpeg,image/png"
        multiple
        className="hidden"
        onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 3))}
      />
      {files.length > 0 ? (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {files.map((f) => (
            <li key={f.name}>
              {f.name} — {(f.size / 1024 / 1024).toFixed(2)} MB
            </li>
          ))}
        </ul>
      ) : null}
      {/* TODO(Operscale): blazeface quality check + upload to /v1/brief/upload-photo */}
    </div>
  );
}
