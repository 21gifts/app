import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ViewProfilePage, { metadata } from '@/app/view/[viewKey]/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

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
});
