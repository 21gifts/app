import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RecoverPage from '@/app/recover/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/RecoverScreen', () => ({
  RecoverScreen: () => <div data-testid="recover-screen" />,
}));
vi.mock('@/components/ProfileChromeLeft', () => ({
  ProfileChromeLeft: ({ wordmark }: { wordmark?: React.ReactNode }) => (
    <div data-testid="profile-chrome-left">{wordmark}</div>
  ),
}));
vi.mock('@/components/HomeWordmark', () => ({
  HomeWordmark: () => <span data-testid="home-wordmark" />,
}));
vi.mock('@/components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

afterEach(cleanup);

describe('RecoverPage', () => {
  it('renders the recovery screen in the login chrome, without the onboarding gate', () => {
    const { container } = renderWithLocale(<RecoverPage />);
    expect(screen.getByTestId('recover-screen')).toBeTruthy();
    expect(
      screen.getByTestId('profile-chrome-left').contains(screen.getByTestId('home-wordmark')),
    ).toBe(true);
    expect(screen.getByTestId('language-switcher')).toBeTruthy();
    const main = container.querySelector('main');
    expect(main?.className).toContain('h-[var(--app-height)]');
  });
});
