import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Home, { generateMetadata } from '@/app/(marketing)/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import { getRequestLocale } from '@/lib/request-locale';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/request-locale', () => ({
  getRequestLocale: vi.fn(async () => 'en' as const),
}));

vi.mock('@/lib/push', () => ({
  isIosSafari: vi.fn().mockReturnValue(false),
  isStandaloneDisplay: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/in-app-browser', () => ({
  isInAppBrowser: vi.fn().mockReturnValue(false),
}));

afterEach(cleanup);

describe('Home', () => {
  it('renders the product headline', async () => {
    renderWithLocale(await Home());
    expect(screen.getByRole('heading', { name: /Help people.*with Bitcoin/i })).toBeTruthy();
  });

  it('explains the direct gift and shows an honest non-interactive preview', async () => {
    renderWithLocale(await Home());
    expect(screen.getByText(/Sign in and read their posts/i)).toBeTruthy();
    expect(screen.getByText('How it works')).toBeTruthy();
    expect(screen.getByText('Where the Bitcoin goes')).toBeTruthy();
    expect(screen.getByText('Your wallet')).toBeTruthy();
    expect(screen.getByText('Their wallet')).toBeTruthy();
    expect(screen.getByText('React and donate')).toBeTruthy();
    expect(document.querySelectorAll('img[src="/bitcoin-symbol.svg"]')).toHaveLength(5);
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.queryByRole('button', { name: /pay with/i })).toBeNull();
  });

  it('publishes an accurate, localized search preview with one canonical', async () => {
    expect(await generateMetadata()).toMatchObject({
      title: 'Help people with Bitcoin | 21.gifts',
      alternates: { canonical: '/en' },
      openGraph: { url: '/en', title: 'Help people with Bitcoin | 21.gifts' },
    });
    vi.mocked(getRequestLocale).mockResolvedValueOnce('de');
    expect(await generateMetadata()).toMatchObject({
      title: 'Hilf Menschen mit Bitcoin | 21.gifts',
      alternates: { canonical: '/de' },
      openGraph: { title: 'Hilf Menschen mit Bitcoin | 21.gifts' },
    });
  });

  it('does not say the product is coming soon', async () => {
    renderWithLocale(await Home());
    expect(screen.queryByText('Coming soon')).toBeNull();
  });

  it('does not use Lightning or LNURL jargon', async () => {
    renderWithLocale(await Home());
    expect(document.body.textContent).not.toMatch(/Lightning/i);
    expect(document.body.textContent).not.toMatch(/LNURL/i);
  });

  it('does not use passkey jargon', async () => {
    renderWithLocale(await Home());
    expect(document.body.textContent).not.toMatch(/passkey/i);
  });

  it('links Ask for help to login', async () => {
    renderWithLocale(await Home());
    const links = screen.getAllByRole('link', { name: 'Ask for help' });
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) expect(link.getAttribute('href')).toBe('/login');
  });

  it('links Give Bitcoin to donate', async () => {
    renderWithLocale(await Home());
    const link = screen.getByRole('link', { name: 'Give Bitcoin' });
    expect(link.getAttribute('href')).toBe('/en/donate');
  });

  it('renders a donate-to-project heading', async () => {
    renderWithLocale(await Home());
    expect(screen.getByRole('heading', { name: 'Want to support 21.gifts?' })).toBeTruthy();
  });

  it('exposes the project Wallet of Satoshi address as a lightning link', async () => {
    renderWithLocale(await Home());
    const link = screen.getByRole('link', { name: '21gifts@walletofsatoshi.com' });
    expect(link.getAttribute('href')).toBe('lightning:21gifts@walletofsatoshi.com');
  });

  it('links the discovery cards to the corresponding sections', async () => {
    renderWithLocale(await Home());
    expect(screen.getByRole('link', { name: /Happyland · Tondo/ }).getAttribute('href')).toBe(
      '#happyland',
    );
    expect(screen.getByRole('link', { name: /Why Bitcoin/i }).getAttribute('href')).toBe('#why');
    expect(screen.getByRole('link', { name: /Where does the gift go/i }).getAttribute('href')).toBe(
      '#faq',
    );
  });
});
