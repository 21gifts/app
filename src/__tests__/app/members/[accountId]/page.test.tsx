import { cleanup, screen } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MemberProfilePage from '@/app/members/[accountId]/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/MemberProfileLoader', () => ({
  MemberProfileLoader: ({ accountId }: { accountId: string }): ReactElement => (
    <div data-testid={`member-${accountId}`} />
  ),
}));
vi.mock('@/components/ProfileChromeLeft', () => ({
  ProfileChromeLeft: (): ReactElement => <div data-testid="profile-chrome-left" />,
}));
vi.mock('@/components/OnboardingGate', () => ({
  OnboardingGate: ({ children }: { children: ReactNode }): ReactNode => children,
}));
vi.mock('@/components/SignedInChrome', () => ({
  SignedInChrome: (): ReactElement => <div data-testid="signed-in-chrome" />,
}));

afterEach(cleanup);

describe('MemberProfilePage', () => {
  it('renders the member loader behind signed-in chrome', async () => {
    const page = await MemberProfilePage({
      params: Promise.resolve({ accountId: '22222222-2222-4222-8222-222222222222' }),
    });
    renderWithLocale(page);
    expect(screen.getByTestId('member-22222222-2222-4222-8222-222222222222')).toBeTruthy();
    expect(screen.getByTestId('profile-chrome-left')).toBeTruthy();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
  });
});
