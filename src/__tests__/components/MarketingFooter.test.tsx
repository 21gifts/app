import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarketingFooter } from '@/components/MarketingFooter';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/request-locale', () => ({
  getRequestLocale: vi.fn(async () => 'en' as const),
}));

afterEach(cleanup);

describe('MarketingFooter', () => {
  it('links Handbook to /handbook', async () => {
    render(await MarketingFooter());
    expect(screen.getByRole('link', { name: 'Handbook' }).getAttribute('href')).toBe('/handbook');
  });

  it('links Legal & Privacy to /legal', async () => {
    render(await MarketingFooter());
    expect(screen.getByRole('link', { name: 'Legal & Privacy' }).getAttribute('href')).toBe(
      '/legal',
    );
  });

  it('links Living room rules to /rules', async () => {
    render(await MarketingFooter());
    expect(screen.getByRole('link', { name: 'Living room rules' }).getAttribute('href')).toBe(
      '/rules',
    );
  });

  it('links GitHub to the org', async () => {
    render(await MarketingFooter());
    expect(screen.getByRole('link', { name: 'GitHub' }).getAttribute('href')).toBe(
      'https://github.com/21gifts',
    );
  });
});
