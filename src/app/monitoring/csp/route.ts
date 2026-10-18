import { forwardCspReport } from '@/lib/sentry';

/**
 * App Router POST for `/monitoring/csp`: the same-origin Content-Security-Policy
 * report endpoint.
 *
 * @param request - Incoming violation report.
 * @returns The forwarder response.
 */
export const POST = forwardCspReport;
