import { init } from '@sentry/nextjs';
import { sentryOptions } from '@/lib/sentry';

/**
 * Browser start-up: starts error reporting when `NEXT_PUBLIC_SENTRY_DSN` is a
 * DSN. Reports go through the same-origin tunnel. Without a DSN nothing starts.
 */
const options = sentryOptions('browser');
if (options !== null) {
  init(options);
}
