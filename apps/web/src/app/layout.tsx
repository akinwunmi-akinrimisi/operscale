import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Operscale — Done-for-you content calendars',
  description: 'A monthly content calendar of UGC, T2V, and carousels — built for Nigerian SMBs.',
  // Brand placeholder — replaced at Day 15 lock per CLAUDE.md "Brand placeholder rules".
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  );
}
