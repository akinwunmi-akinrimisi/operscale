// Minimal root layout. The agent service is API-only — no rendered UI.
// This file exists to satisfy Next.js App Router requirements.

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Operscale Calendar Agent',
  description: 'Internal API service. Not for browser use.',
  robots: 'noindex, nofollow',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
