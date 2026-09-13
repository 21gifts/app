import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AboutPage from '@/app/(marketing)/about/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/request-locale', () => ({
  getRequestLocale: vi.fn(async () => 'en' as const),
}));

afterEach(cleanup);

describe('AboutPage', () => {
  it('renders the heading', async () => {
    renderWithLocale(await AboutPage());
    expect(screen.getByRole('heading', { name: 'Three convictions' })).toBeTruthy();
  });

  it('quotes Matthew 10:8', async () => {
    renderWithLocale(await AboutPage());
    expect(screen.getByText('Freely you have received; freely give.')).toBeTruthy();
  });

  it('states three convictions', async () => {
    renderWithLocale(await AboutPage());
    expect(screen.getByRole('heading', { name: 'Three convictions' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Giving is a duty' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Direct, with no middleman' })).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Bitcoin is the most effective money' }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Dear children, let us not love with words or speech but with actions and in truth.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'A Christian origin' })).toBeNull();
    expect(document.body.textContent).not.toMatch(/rooted, not restricted/i);
  });

  it('links Open the living room to /welcome', async () => {
    renderWithLocale(await AboutPage());
    const link = screen.getByRole('link', { name: 'Open the living room' });
    expect(link.getAttribute('href')).toBe('/welcome');
  });

  it('does not use Lightning, LNURL, passkey, ministry, Gospel, or Jesus', async () => {
    renderWithLocale(await AboutPage());
    expect(document.body.textContent).not.toMatch(/Lightning/i);
    expect(document.body.textContent).not.toMatch(/LNURL/i);
    expect(document.body.textContent).not.toMatch(/passkey/i);
    expect(document.body.textContent).not.toMatch(/ministry/i);
    expect(document.body.textContent).not.toMatch(/Gospel/i);
    expect(document.body.textContent).not.toMatch(/\bJesus\b/i);
  });
});
