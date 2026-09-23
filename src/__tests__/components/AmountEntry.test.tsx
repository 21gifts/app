import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AmountEntry } from '@/components/AmountEntry';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import type { Account } from '@/lib/api-types';
import type { FiatRateDay } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/api', () => ({
  setAmountUnit: vi.fn(),
}));

import { setAmountUnit } from '@/lib/api';

const DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

const account = {
  id: 'acc_1',
  linkingKey: null,
  role: 'basis' as const,
  name: 'Ada',
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: true,
  createdAt: 1,
  rulesAgreedAt: 1,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
  amountUnit: 'btc' as const,
} as Account;

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null, wrongAccount: false });
  vi.clearAllMocks();
});

describe('AmountEntry', () => {
  it('shows the preferred fiat under a bitcoin amount', () => {
    renderWithLocale(
      <AmountEntry label="Amount" value="21" onValueChange={() => undefined} rateDay={DAY} />,
      'en',
      'ch',
      'USD',
    );
    expect(screen.getByLabelText('Amount')).toHaveProperty('value', '21');
    expect(screen.getByText('$0.02')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Amount unit' })).toBeTruthy();
  });

  it('converts to fiat locally when nobody is signed in', () => {
    const onValueChange = vi.fn();
    renderWithLocale(
      <AmountEntry label="Amount" value="21" onValueChange={onValueChange} rateDay={DAY} />,
      'en',
      'ch',
      'USD',
    );
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    expect(onValueChange).toHaveBeenCalledWith('0.02');
    expect(setAmountUnit).not.toHaveBeenCalled();
  });

  it('shows bitcoin under a fiat draft and the missing-rate line', () => {
    const { rerender } = renderWithLocale(
      <AmountEntry label="Amount" value="1.00" onValueChange={() => undefined} rateDay={null} />,
      'en',
      'ch',
      'USD',
    );
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    rerender(
      <AmountEntry label="Amount" value="1.00" onValueChange={() => undefined} rateDay={null} />,
    );
    expect(screen.getByText('No exchange rate yet')).toBeTruthy();
  });

  it('locks a minted invoice on the sat amount', () => {
    renderWithLocale(
      <AmountEntry
        label="Amount"
        value=""
        onValueChange={() => undefined}
        rateDay={DAY}
        lockedSats={21}
      />,
      'en',
      'ch',
      'USD',
    );
    expect(screen.getByLabelText('Amount')).toHaveProperty('value', '21');
    expect(screen.getByLabelText('Amount')).toHaveProperty('disabled', true);
    expect(screen.getByText('$0.02')).toBeTruthy();
  });

  it('stores the chosen unit on the signed-in account', async () => {
    vi.mocked(setAmountUnit).mockResolvedValue({ ...account, amountUnit: 'fiat' });
    useAuthStore.setState({ session: 'sess', account, wrongAccount: false });
    const onValueChange = vi.fn();
    renderWithLocale(
      <AmountEntry label="Amount" value="21" onValueChange={onValueChange} rateDay={DAY} />,
      'en',
      'ch',
      'USD',
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    });
    expect(onValueChange).toHaveBeenCalledWith('0.02');
    expect(setAmountUnit).toHaveBeenCalledWith('sess', 'fiat');
    expect(useAuthStore.getState().account?.amountUnit).toBe('fiat');
  });

  it('puts the previous unit back when the save fails', async () => {
    vi.mocked(setAmountUnit).mockRejectedValue(new Error('nope'));
    useAuthStore.setState({ session: 'sess', account, wrongAccount: false });
    const onValueChange = vi.fn();
    renderWithLocale(
      <AmountEntry label="Amount" value="21" onValueChange={onValueChange} rateDay={DAY} />,
      'en',
      'ch',
      'USD',
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    });
    expect(useAuthStore.getState().account?.amountUnit).toBe('btc');
    expect(onValueChange).toHaveBeenLastCalledWith('21');
  });
});
