import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarketingFooter } from '@/components/MarketingFooter';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(cleanup);

describe('MarketingFooter', () => {
  it('links Legal & Privacy to /legal', () => {
    render(<MarketingFooter />);
    expect(screen.getByRole('link', { name: 'Legal & Privacy' }).getAttribute('href')).toBe(
      '/legal',
    );
  });

  it('links GitHub to the org', () => {
    render(<MarketingFooter />);
    expect(screen.getByRole('link', { name: 'GitHub' }).getAttribute('href')).toBe(
      'https://github.com/21gifts',
    );
  });
});
