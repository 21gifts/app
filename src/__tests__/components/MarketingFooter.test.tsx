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
  it('links About to /en/about', async () => {
    render(await MarketingFooter());
    expect(screen.getByRole('link', { name: 'About 21.gifts' }).getAttribute('href')).toBe(
      '/en/about',
    );
  });

  it('does not link Trust Chain', async () => {
    render(await MarketingFooter());
    expect(screen.queryByRole('link', { name: 'Trust Chain' })).toBeNull();
  });

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

  it('links Living room rules to /en/rules', async () => {
    render(await MarketingFooter());
    expect(screen.getByRole('link', { name: 'Living room rules' }).getAttribute('href')).toBe(
      '/en/rules',
    );
  });

  it('links GitHub to the org', async () => {
    render(await MarketingFooter());
    expect(screen.getByRole('link', { name: 'GitHub' }).getAttribute('href')).toBe(
      'https://github.com/21gifts',
    );
  });

  it('renders the wordmark as text, not a link', async () => {
    render(await MarketingFooter());
    expect(screen.queryByRole('link', { name: '21.gifts' })).toBeNull();
    expect(screen.getByText('21.gifts').tagName).toBe('SPAN');
  });

  it('quotes Matthew 10:8', async () => {
    render(await MarketingFooter());
    expect(screen.getByText(/Freely you have received; freely give/)).toBeTruthy();
    expect(screen.getByText('Matthew 10:8')).toBeTruthy();
  });
});
