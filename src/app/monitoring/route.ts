import { forwardSentryEnvelope } from '@/lib/sentry';

/**
 * App Router POST for `/monitoring`: the same-origin error-report tunnel.
 *
 * @param request - Incoming envelope.
 * @returns The tunnel response.
 */
export const POST = forwardSentryEnvelope;
