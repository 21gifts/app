import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AboutPage, { generateMetadata } from '@/app/(marketing)/about/page';
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
  it('publishes a German canonical and reciprocal language URLs', async () => {
    const { getRequestLocale } = await import('@/lib/request-locale');
    vi.mocked(getRequestLocale).mockResolvedValueOnce('de');
    expect(await generateMetadata()).toMatchObject({
      title: 'Wofür 21.gifts steht | 21.gifts',
      alternates: { canonical: '/de/about', languages: { es: '/es/about' } },
      openGraph: { url: '/de/about', images: [{ url: '/og-de.png' }] },
    });
  });

  it('renders the heading', async () => {
    renderWithLocale(await AboutPage());
    expect(screen.getByRole('heading', { name: 'What 21.gifts stands for' })).toBeTruthy();
  });

  it('quotes Matthew 10:8', async () => {
    renderWithLocale(await AboutPage());
    expect(screen.getByText('Freely you have received; freely give.')).toBeTruthy();
  });

  it('states three convictions', async () => {
    renderWithLocale(await AboutPage());
    expect(screen.getByRole('heading', { name: 'What 21.gifts stands for' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Giving is part of faith' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'From one person to another' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Why Bitcoin?' })).toBeTruthy();
    expect(
      screen.getByText(
        'Dear children, let us not love with words or speech but with actions and in truth.',
      ),
    ).toBeTruthy();
  });

  it('links Go to the forum to /welcome', async () => {
    renderWithLocale(await AboutPage());
    const link = screen.getByRole('link', { name: 'Go to the forum' });
    expect(link.getAttribute('href')).toBe('/welcome');
  });

  it('does not use Lightning, LNURL, or passkey', async () => {
    renderWithLocale(await AboutPage());
    expect(document.body.textContent).not.toMatch(/Lightning/i);
    expect(document.body.textContent).not.toMatch(/LNURL/i);
    expect(document.body.textContent).not.toMatch(/passkey/i);
  });
});
