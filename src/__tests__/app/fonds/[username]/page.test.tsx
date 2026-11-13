import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import FondPage from '@/app/fonds/[username]/page';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

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

vi.mock('@/components/FondSummaryLoader', () => ({
  FondSummaryLoader: ({ username }: { username: string }) => (
    <div data-testid="fond-summary-loader">{username}</div>
  ),
}));

vi.mock('@/components/LanguageSwitcher', () => ({
  LanguageSwitcher: ({ tone }: { tone?: string }) => (
    <div data-testid="language-switcher">{tone}</div>
  ),
}));

vi.mock('@/hooks/useHydrateSession', () => ({
  useHydrateSession: (): { ready: boolean } => ({ ready: true }),
}));

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null });
});

describe('FondPage', () => {
  it('renders the public chrome and passes the handle to the loader', async () => {
    const { container } = renderWithLocale(
      await FondPage({ params: Promise.resolve({ username: 'tondo-fond' }) }),
    );
    expect(screen.getByTestId('language-switcher').textContent).toBe('light');
    expect(screen.getByTestId('fond-summary-loader').textContent).toBe('tondo-fond');
    expect(container.querySelector('[data-view-history-back]')).not.toBeNull();
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: 'Back to the forum' }).getAttribute('href')).toBe(
      '/welcome',
    );
  });
});
