import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GrantGoalsScreen } from '@/components/GrantGoalsScreen';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis',
  name: 'Ada',
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
};

afterEach(cleanup);

describe('GrantGoalsScreen', () => {
  it('renders nothing without a session', () => {
    useAuthStore.setState({ session: null, account });
    const { container } = renderWithLocale(<GrantGoalsScreen />);
    expect(container.firstChild).toBeNull();
  });

  it('explains the ten-shop continuation goal', () => {
    useAuthStore.setState({ session: 'sess', account });
    renderWithLocale(<GrantGoalsScreen />);
    expect(screen.getByRole('heading', { name: 'Goals' })).toBeTruthy();
    expect(
      screen.getByText('The grant program continues when we reach 10 active shops.'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'A shop is active when it has registered at least one transaction on 5 of 7 days.',
      ),
    ).toBeTruthy();
  });
});
