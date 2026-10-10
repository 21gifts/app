import { captureRouterTransitionStart, init, webVitalsIntegration } from '@sentry/nextjs';
import { sentryOptions } from '@/lib/sentry';

/**
 * Browser start-up: starts error reporting and sampled performance traces
 * when `NEXT_PUBLIC_SENTRY_DSN` is a DSN. Reports go through the same-origin
 * tunnel. Without a DSN nothing starts.
 *
 * Web vitals keep LCP and CLS on the page-load transaction. INP is left out:
 * the SDK sends it as a standalone span, which neither the transaction
 * scrubber nor the tunnel lets through.
 */
const options = sentryOptions('browser');
if (options !== null) {
  init({
    ...options,
    integrations: (defaults) => [
      ...options.integrations(defaults),
      webVitalsIntegration({ ignore: ['inp'] }),
    ],
  });
}

/**
 * Next.js hook called when an App Router navigation starts. Starts the
 * navigation transaction while tracing is on, and does nothing otherwise.
 *
 * @param href - Target of the navigation.
 * @param navigationType - `push`, `replace`, or `traverse`.
 * @returns Nothing.
 */
export const onRouterTransitionStart = captureRouterTransitionStart;
