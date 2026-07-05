import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: '21.gifts',
  description:
    'Direct human-to-human giving over Bitcoin Lightning. People helping people — no middleman, no cut.',
};

/**
 * Root layout: the `<html>`/`<body>` shell shared by every page.
 */
export default function RootLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <html lang="en">
      <body className="bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
