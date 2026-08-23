import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Home from '@/app/(marketing)/page';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(cleanup);

describe('Home', () => {
  it('renders the product headline', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { name: /Direct human-to-human gifts/i })).toBeTruthy();
  });

  it('states what the product is', () => {
    render(<Home />);
    expect(
      screen.getByText(/Ask for help, or send help, without an organization in the middle/i),
    ).toBeTruthy();
  });

  it('does not say the product is coming soon', () => {
    render(<Home />);
    expect(screen.queryByText('Coming soon')).toBeNull();
  });

  it('does not use Lightning or LNURL jargon', () => {
    render(<Home />);
    expect(document.body.textContent).not.toMatch(/Lightning/i);
    expect(document.body.textContent).not.toMatch(/LNURL/i);
  });

  it('links Ask for help to login', () => {
    render(<Home />);
    const link = screen.getByRole('link', { name: 'Ask for help' });
    expect(link.getAttribute('href')).toBe('/login');
  });

  it('links Send help to donate', () => {
    render(<Home />);
    const link = screen.getByRole('link', { name: 'Send help' });
    expect(link.getAttribute('href')).toBe('/donate');
  });
});
