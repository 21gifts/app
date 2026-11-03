import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock('@sentry/nextjs', () => sentry);
vi.mock('next/error', () => ({
  default: ({ statusCode }: { statusCode: number }) => <p>Next error {statusCode}</p>,
}));

import GlobalError from '@/app/global-error';

afterEach(() => {
  sentry.captureException.mockReset();
});

describe('GlobalError', () => {
  it('reports the error once and shows the Next.js error page', () => {
    const error = new Error('render failed');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { getByText, rerender } = render(<GlobalError error={error} />, {
      container: document,
    });
    expect(getByText('Next error 0')).toBeTruthy();
    expect(document.documentElement.lang).toBe('en');
    rerender(<GlobalError error={error} />);
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(error);
  });
});
