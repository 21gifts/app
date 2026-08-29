import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import ContactPage from '@/app/contact/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/ContactLoader', () => ({
  ContactLoader: () => <div data-testid="contact-loader" />,
}));

vi.mock('@/components/OnboardingGate', () => ({
  OnboardingGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/SignedInChrome', () => ({
  SignedInChrome: () => <div data-testid="signed-in-chrome" />,
}));

afterEach(cleanup);

describe('ContactPage', () => {
  it('renders the contact loader inside signed-in chrome', () => {
    renderWithLocale(<ContactPage />);
    expect(screen.getByTestId('contact-loader')).toBeTruthy();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
  });
});
