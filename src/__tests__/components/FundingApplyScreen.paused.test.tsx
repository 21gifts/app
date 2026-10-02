import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FundingApplyScreen } from '@/components/FundingApplyScreen';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/navigation', () => ({
  useRouter: (): { push: () => void; replace: () => void } => ({
    push: (): void => {},
    replace: (): void => {},
  }),
}));

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'verified',
  name: 'Ada',
  location: null,
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
  funding: {
    status: 'none',
    trialUtcDate: null,
    admittedAt: null,
    reviewedByName: null,
  },
};

beforeEach(() => {
  useAuthStore.setState({ session: 'sess', account: null });
});

afterEach(cleanup);

describe('FundingApplyScreen while applications are paused', () => {
  it('shows the paused sentence instead of the apply walk', () => {
    renderWithLocale(<FundingApplyScreen />);
    expect(
      screen.getByText(
        'Applications are currently paused. You can apply again when shop transactions have increased.',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText('First, write a short About me so people can get to know you.'),
    ).toBeNull();
  });

  it('shows the apply walk for joey-rosima', () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, username: 'joey-rosima' },
    });
    renderWithLocale(<FundingApplyScreen />);
    expect(
      screen.queryByText(
        'Applications are currently paused. You can apply again when shop transactions have increased.',
      ),
    ).toBeNull();
    expect(
      screen.getByText('First, write a short About me so people can get to know you.'),
    ).toBeTruthy();
  });
});
