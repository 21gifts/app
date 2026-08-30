import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MessagesPage from '@/app/messages/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/InboxLoader', () => ({
  InboxLoader: () => <div data-testid="inbox-loader" />,
}));

vi.mock('@/components/OnboardingGate', () => ({
  OnboardingGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/SignedInChrome', () => ({
  SignedInChrome: () => <div data-testid="signed-in-chrome" />,
}));

afterEach(cleanup);

describe('MessagesPage', () => {
  it('renders the inbox loader inside signed-in chrome', () => {
    renderWithLocale(<MessagesPage />);
    expect(screen.getByTestId('inbox-loader')).toBeTruthy();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
  });
});
