import { captureRequestError, init } from '@sentry/nextjs';
import { sentryOptions } from '@/lib/sentry';

/**
 * Next.js server start hook for the Node.js and edge runtimes: starts error
 * reporting when `NEXT_PUBLIC_SENTRY_DSN` is a DSN. Without one it does
 * nothing, so no reports and no network traffic.
 */
export function register(): void {
  const options = sentryOptions('server');
  if (options !== null) {
    init(options);
  }
}

/**
 * Next.js hook for errors thrown while rendering or handling a request.
 * Reports the error when error reporting is on, and is a no-op otherwise.
 */
export const onRequestError = captureRequestError;
