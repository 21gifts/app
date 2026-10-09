import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import DonatePage, { generateMetadata } from '@/app/donate/page';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import { OG_IMAGE_ALT } from '@/lib/marketing-metadata';
import { getRequestLocale } from '@/lib/request-locale';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

vi.mock('@/lib/request-locale', () => ({
  getRequestLocale: vi.fn(async () => 'en' as const),
}));

let hydrateReady = true;

vi.mock('@/hooks/useHydrateSession', () => ({
  useHydrateSession: (): { ready: boolean } => ({ ready: hydrateReady }),
}));

beforeEach(() => {
  hydrateReady = true;
  useAuthStore.setState({ session: null, account: null });
});

afterEach(cleanup);

describe('DonatePage', () => {
  it('publishes the same English preview on every language URL', async () => {
    const title = 'Donate Bitcoin and help someone | 21.gifts';
    const description =
      'Sign in and open a post in the forum. Write a reaction under it, add an amount and pay from your wallet. The Bitcoin goes to the person who wrote the post.';
    const preview = {
      title,
      description,
      openGraph: {
        title,
        description,
        images: [{ url: '/og.png', alt: OG_IMAGE_ALT }],
      },
      twitter: {
        title,
        description,
        images: [{ url: '/og.png', alt: OG_IMAGE_ALT }],
      },
    };
    expect(await generateMetadata()).toMatchObject({
      ...preview,
      alternates: { canonical: '/en/donate', languages: { fil: '/fil/donate' } },
      openGraph: { ...preview.openGraph, url: '/en/donate' },
    });
    vi.mocked(getRequestLocale).mockResolvedValueOnce('de');
    expect(await generateMetadata()).toMatchObject({
      ...preview,
      alternates: { canonical: '/de/donate' },
      openGraph: { ...preview.openGraph, url: '/de/donate' },
    });
    vi.mocked(getRequestLocale).mockResolvedValueOnce('es');
    expect(await generateMetadata()).toMatchObject({
      ...preview,
      alternates: { canonical: '/es/donate' },
      openGraph: { ...preview.openGraph, url: '/es/donate' },
    });
  });

  it('renders the page heading', async () => {
    renderWithLocale(await DonatePage());
    expect(screen.getByRole('heading', { name: 'Help someone' })).toBeTruthy();
  });

  it('renders the explainer lead', async () => {
    renderWithLocale(await DonatePage());
    expect(screen.getByText(/Write a reaction under it, add an amount/i)).toBeTruthy();
  });

  it('links Open the forum to /welcome', async () => {
    renderWithLocale(await DonatePage());
    const link = screen.getByRole('link', { name: 'Open the forum' });
    expect(link.getAttribute('href')).toBe('/welcome');
  });

  it('renders the language switcher', async () => {
    renderWithLocale(await DonatePage());
    expect(screen.getByTestId('language-switcher')).toBeTruthy();
  });

  it('links the unsigned wordmark home', async () => {
    renderWithLocale(await DonatePage());
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/en');
    expect(screen.getByRole('link', { name: 'Back to the forum' }).getAttribute('href')).toBe(
      '/welcome',
    );
  });
});
