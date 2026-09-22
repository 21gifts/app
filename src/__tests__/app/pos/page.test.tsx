import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PosPage from '@/app/pos/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/PosScreen', () => ({
  PosScreen: () => <div data-testid="pos-screen" />,
}));
vi.mock('@/components/ProfileChromeLeft', () => ({
  ProfileChromeLeft: () => <div data-testid="profile-chrome-left" />,
}));
vi.mock('@/components/OnboardingGate', () => ({
  OnboardingGate: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/components/SignedInChrome', () => ({
  SignedInChrome: () => <div data-testid="signed-in-chrome" />,
}));

afterEach(cleanup);

describe('PosPage', () => {
  it('renders the till inside signed-in chrome', () => {
    const { container } = renderWithLocale(<PosPage />);
    expect(screen.getByTestId('pos-screen')).toBeTruthy();
    expect(screen.getByTestId('profile-chrome-left')).toBeTruthy();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
    const main = container.querySelector('main');
    expect(main?.className).toContain('h-[var(--app-height)]');
    expect(main?.className).not.toContain('overflow-hidden');
  });
});
