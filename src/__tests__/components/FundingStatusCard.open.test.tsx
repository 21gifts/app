import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FundingStatusCard } from '@/components/FundingStatusCard';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/grant-applications', () => ({
  grantApplicationsPaused: (): boolean => false,
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
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(cleanup);

describe('FundingStatusCard when applications are open', () => {
  it('offers the apply link', () => {
    renderWithLocale(<FundingStatusCard />);
    expect(
      screen.getByText(
        'Admitted members receive the daily gift. Apply so a moderator can review your posts.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'About' }).getAttribute('href')).toBe('/about');
    expect(
      screen.getByRole('link', { name: 'Apply for the 21 gifts grant' }).getAttribute('href'),
    ).toBe('/grants/apply');
  });
});
