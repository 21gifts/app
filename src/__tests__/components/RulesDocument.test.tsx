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
  it('renders the lead, three rules, and Our house', () => {
    render(<RulesDocument messages={getCatalog('en')} />);
    expect(
      screen.getByText(/You are a guest in a living room with the windows open/i),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Only free donations' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Donors come first' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Contact stays in the app' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Our house' })).toBeTruthy();
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

  it('lists welcome, allowed, better-not, and forbidden items', () => {
    render(<RulesDocument messages={getCatalog('en')} />);
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Allowed' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Better not' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Forbidden' })).toBeTruthy();
    expect(
      screen.getByText('A thank-you: short, specific, and without the next request attached.'),
    ).toBeTruthy();
    expect(screen.getByText(/Money for a task — “for ₿5,000 I will draw you.”/)).toBeTruthy();
  });

  it('omits the public Contact and forum nav when showNav is false', () => {
    render(<RulesDocument messages={getCatalog('en')} showNav={false} />);
    expect(screen.queryByRole('link', { name: 'Contact 21.gifts' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Back to the forum' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Only free donations' })).toBeTruthy();
  });

  it('renders only law 1 when chapter is law1', () => {
    render(<RulesDocument messages={getCatalog('en')} chapter="law1" />);
    expect(screen.getByRole('heading', { name: 'Only free donations' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Donors come first' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Welcome' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Our house' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Contact 21.gifts' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Back to the forum' })).toBeNull();
  });

  it('renders only the lead when chapter is lead', () => {
    render(<RulesDocument messages={getCatalog('en')} chapter="lead" />);
    expect(
      screen.getByText(/You are a guest in a living room with the windows open/i),
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Only free donations' })).toBeNull();
  });

  it('styles The test kickers with tracking-widest and TestCallout border accent', () => {
    render(<RulesDocument messages={getCatalog('en')} />);
    const kickers = screen.getAllByText('The test');
    expect(kickers.length).toBeGreaterThan(0);
    for (const kicker of kickers) {
      expect(kicker.className).toContain('font-medium');
      expect(kicker.className).toContain('tracking-widest');
      expect(kicker.className).not.toContain('tracking-[0.2em]');
    }
    const calloutKicker = kickers.find((node) =>
      node.parentElement?.className.includes('border-l-2'),
    );
    expect(calloutKicker).toBeTruthy();
    expect(calloutKicker?.parentElement?.className).toContain('border-app-accent');
  });

  it('renders all three forbidden groups when chapter is forbidden', () => {
    render(<RulesDocument messages={getCatalog('en')} chapter="forbidden" />);
    expect(screen.getByRole('heading', { name: 'Forbidden' })).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Asking for something in return (rule 1)' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Driving donors away (rule 2)' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Also banned' })).toBeTruthy();
  });
});
