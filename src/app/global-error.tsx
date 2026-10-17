'use client';

import { captureException } from '@sentry/nextjs';
import NextError from 'next/error';
import { useEffect, type ReactElement } from 'react';

/**
 * Last-resort error boundary for errors no other boundary catches, including
 * errors in the root layout. Reports the error (a no-op while error reporting
 * is off) and shows the Next.js error page. It replaces the root layout, so it
 * renders its own `<html>` and `<body>`.
 *
 * @param props - The caught error.
 * @returns The fallback document.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}): ReactElement {
  useEffect(() => {
    captureException(error);
  }, [error]);
  return (
    <html lang="en">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
