import { cleanup, fireEvent, screen } from '@testing-library/react';
import { useLayoutEffect, type ReactElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WelcomePage from '@/app/welcome/page';
import { ChromeBackProvider, useChromeBack } from '@/components/ViewHistoryRoot';
import { previousViewPath, recordCurrentView, resetViewHistory } from '@/lib/view-history';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/components/WelcomeScreen', () => ({
  WelcomeScreen: () => <div data-testid="welcome-screen" />,
}));

vi.mock('@/components/OnboardingGate', () => ({
  OnboardingGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/SignedInChrome', () => ({
  SignedInChrome: () => <div data-testid="signed-in-chrome" />,
}));

afterEach(() => {
  cleanup();
  resetViewHistory();
  useAuthStore.setState({ session: null, account: null });
});

describe('WelcomePage', () => {
  it('renders the welcome card and a log in link when signed out', () => {
    useAuthStore.setState({ session: null, account: null });
    renderWithLocale(<WelcomePage />);
    expect(screen.getByTestId('welcome-screen')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe('/login');
    expect(screen.queryByTestId('signed-in-chrome')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Back to the forum' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('renders the signed-in chrome when a session exists', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    renderWithLocale(<WelcomePage />);
    expect(screen.getByTestId('welcome-screen')).toBeTruthy();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
  });

  it('shows the one chrome back button while an ask step is open', () => {
    const onClick = vi.fn();
    function Arm(): ReactElement {
      const { setOverride } = useChromeBack();
      useLayoutEffect(() => {
        setOverride({ labelKey: 'forum.askBack', onClick });
      }, [setOverride]);
      return <WelcomePage />;
    }

    renderWithLocale(
      <ChromeBackProvider>
        <Arm />
      </ChromeBackProvider>,
    );
    expect(screen.queryByRole('link', { name: 'Back to the forum' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows no back arrow when this tab has an earlier view', () => {
    recordCurrentView('/shops');
    Object.defineProperty(window.history, 'length', {
      configurable: true,
      value: window.history.length + 1,
    });
    recordCurrentView('/welcome');
    expect(previousViewPath()).toBe('/shops');
    renderWithLocale(<WelcomePage />);
    expect(screen.queryByRole('link', { name: 'Back' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Back to the forum' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });
});
