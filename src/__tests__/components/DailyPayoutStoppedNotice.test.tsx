import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DailyPayoutStoppedNotice } from '@/components/DailyPayoutStoppedNotice';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

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

describe('DailyPayoutStoppedNotice', () => {
  it('shows the English title, paused sentence, and statistics link when the flag is true', () => {
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
    expect(screen.getByRole('heading', { name: 'Daily payout stopped' })).toBeTruthy();
    expect(
      screen.getByText(
        'Applications are currently paused. You can apply again when shop transactions have increased.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'https://21.gifts/statistics' }).getAttribute('href'),
    ).toBe('https://21.gifts/statistics');
    expect(screen.queryByRole('link', { name: 'Apply for the 21 gifts grant' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Apply for the 21 gifts grant' })).toBeNull();
  });

  it('renders nothing when the flag is false', () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        ...baseAccount,
        funding: {
          status: 'none',
          trialUtcDate: null,
          admittedAt: null,
          reviewedByName: null,
          dailyPayoutStoppedNotice: false,
        },
      },
    });
    const { container } = renderWithLocale(<DailyPayoutStoppedNotice />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Daily payout stopped' })).toBeNull();
  });

  it('renders nothing when the flag is omitted', () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        ...baseAccount,
        funding: {
          status: 'none',
          trialUtcDate: null,
          admittedAt: null,
          reviewedByName: null,
        },
      },
    });
    const { container } = renderWithLocale(<DailyPayoutStoppedNotice />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Daily payout stopped' })).toBeNull();
  });

  it('renders nothing when funding is null', () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        ...baseAccount,
        funding: null,
      },
    });
    const { container } = renderWithLocale(<DailyPayoutStoppedNotice />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Daily payout stopped' })).toBeNull();
  });
});
