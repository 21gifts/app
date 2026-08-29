import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RulesDocument } from '@/components/RulesDocument';
import { getCatalog } from '@/lib/messages';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(cleanup);

describe('RulesDocument', () => {
  it('renders the lead, three laws, and house right', () => {
    render(<RulesDocument messages={getCatalog('en')} />);
    expect(
      screen.getByText(/You are a guest in a living room with the windows open/i),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: '1. Only free donations' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '2. Donors come first' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '3. Contact stays in the app' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'House right' })).toBeTruthy();
  });

  it('links to /contact and /welcome', () => {
    render(<RulesDocument messages={getCatalog('en')} />);
    expect(screen.getByRole('link', { name: 'Contact 21.gifts' }).getAttribute('href')).toBe(
      '/contact',
    );
    expect(screen.getByRole('link', { name: 'Back to the forum' }).getAttribute('href')).toBe(
      '/welcome',
    );
  });

  it('lists wanted, allowed, rather not, and forbidden items', () => {
    render(<RulesDocument messages={getCatalog('en')} />);
    expect(screen.getByRole('heading', { name: 'Wanted' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Allowed' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Rather not' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Forbidden — hard-blocked' })).toBeTruthy();
    expect(
      screen.getByText('Thanks. Short, specific, without the next ask attached.'),
    ).toBeTruthy();
    expect(screen.getByText(/Money for doing — “for 5 000 sats I will draw you.”/)).toBeTruthy();
  });

  it('omits the public Contact and forum nav when showNav is false', () => {
    render(<RulesDocument messages={getCatalog('en')} showNav={false} />);
    expect(screen.queryByRole('link', { name: 'Contact 21.gifts' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Back to the forum' })).toBeNull();
    expect(screen.getByRole('heading', { name: '1. Only free donations' })).toBeTruthy();
  });
});
