import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FundingApplyScreen } from '@/components/FundingApplyScreen';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

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
});
