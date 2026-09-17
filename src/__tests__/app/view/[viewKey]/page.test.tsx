import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import ViewProfilePage, { metadata } from '@/app/view/[viewKey]/page';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/ViewProfileLoader', () => ({
  ViewProfileLoader: ({ viewKey }: { viewKey: string }) => (
    <div data-testid="view-profile-loader">{viewKey}</div>
  ),
}));

vi.mock('@/components/LanguageSwitcher', () => ({
  LanguageSwitcher: ({ tone }: { tone?: string }) => (
    <div data-testid="language-switcher">{tone}</div>
  ),
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

describe('ViewProfilePage', () => {
  it('exports metadata.referrer as no-referrer', () => {
    expect(metadata.referrer).toBe('no-referrer');
  });

  it('renders the language switcher and passes viewKey to the loader', async () => {
    const viewKey = 'a'.repeat(64);
    renderWithLocale(await ViewProfilePage({ params: Promise.resolve({ viewKey }) }));
    expect(screen.getByTestId('language-switcher').textContent).toBe('light');
    expect(screen.getByTestId('view-profile-loader').textContent).toBe(viewKey);
  });

  it('links the unsigned wordmark home', async () => {
    const viewKey = 'a'.repeat(64);
    renderWithLocale(await ViewProfilePage({ params: Promise.resolve({ viewKey }) }));
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/');
  });
});
