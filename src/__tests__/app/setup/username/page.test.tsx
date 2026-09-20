import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import UsernameSetupPage from '@/app/setup/username/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/UsernameSetup', () => ({
  UsernameSetup: () => <div data-testid="username-setup" />,
}));

vi.mock('@/components/OnboardingGate', () => ({
  OnboardingGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/SignedInChrome', () => ({
  SignedInChrome: () => <div data-testid="signed-in-chrome" />,
}));

afterEach(cleanup);

describe('UsernameSetupPage', () => {
  it('renders the username setup card', () => {
    renderWithLocale(<UsernameSetupPage />);
    expect(screen.getByTestId('username-setup')).toBeTruthy();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
  });
});
