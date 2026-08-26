import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import AddressSetupPage from '@/app/setup/address/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/AddressSetup', () => ({
  AddressSetup: () => <div data-testid="address-setup" />,
}));

vi.mock('@/components/OnboardingGate', () => ({
  OnboardingGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

afterEach(cleanup);

describe('AddressSetupPage', () => {
  it('renders the address setup card', () => {
    renderWithLocale(<AddressSetupPage />);
    expect(screen.getByTestId('address-setup')).toBeTruthy();
  });
});
