import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DailyPayoutStoppedNotice } from '@/components/DailyPayoutStoppedNotice';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/grant-applications', () => ({
  grantApplicationsPaused: (): boolean => false,
}));

const baseAccount = {
  id: 'acc_1',
  linkingKey: null,
  role: 'verified',
  name: null,
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1,
  rulesAgreedAt: null,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
  walletRequired: true,
} as Account;

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null });
});

describe('DailyPayoutStoppedNotice when applications are open', () => {
  it('links to the apply walk', () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        ...baseAccount,
        funding: {
          status: 'none',
          trialUtcDate: null,
          admittedAt: null,
          reviewedByName: null,
          dailyPayoutStoppedNotice: true,
        },
      },
    });
    renderWithLocale(<DailyPayoutStoppedNotice />);
    expect(
      screen.getByText(
        'Your daily payout has stopped because you have not applied for the 21 gifts grant. Apply so a moderator can review your posts.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Apply for the 21 gifts grant' }).getAttribute('href'),
    ).toBe('/grants/apply');
  });
});
