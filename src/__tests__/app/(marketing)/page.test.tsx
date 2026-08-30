import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Home from '@/app/(marketing)/page';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/request-locale', () => ({
  getRequestLocale: vi.fn(async () => 'en' as const),
}));

afterEach(cleanup);

describe('Home', () => {
  it('renders the product headline', async () => {
    render(await Home());
    expect(screen.getByRole('heading', { name: /Direct human-to-human gifts/i })).toBeTruthy();
  });

  it('states what the product is', async () => {
    render(await Home());
    expect(
      screen.getByText(/Ask for help or send help, with no organization in the middle/i),
    ).toBeTruthy();
  });

  it('does not say the product is coming soon', async () => {
    render(await Home());
    expect(screen.queryByText('Coming soon')).toBeNull();
  });

  it('does not use Lightning or LNURL jargon', async () => {
    render(await Home());
    expect(document.body.textContent).not.toMatch(/Lightning/i);
    expect(document.body.textContent).not.toMatch(/LNURL/i);
  });

  it('does not use passkey jargon', async () => {
    render(await Home());
    expect(document.body.textContent).not.toMatch(/passkey/i);
  });

  it('links Ask for help to login', async () => {
    render(await Home());
    const link = screen.getByRole('link', { name: 'Ask for help' });
    expect(link.getAttribute('href')).toBe('/login');
  });

  it('links Send help to donate', async () => {
    render(await Home());
    const link = screen.getByRole('link', { name: 'Send help' });
    expect(link.getAttribute('href')).toBe('/donate');
  });
});
