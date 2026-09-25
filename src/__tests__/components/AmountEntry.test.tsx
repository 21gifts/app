import { useState, type ReactElement } from 'react';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
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

function TypingAmount({
  initial,
  rateDay,
  onValueChange,
  onUnitChange,
}: {
  initial: string;
  rateDay: FiatRateDay | null;
  onValueChange: (value: string) => void;
  onUnitChange?: (unit: 'btc' | 'fiat') => void;
}): ReactElement {
  const [value, setValue] = useState(initial);
  return (
    <AmountEntry
      label="Amount"
      value={value}
      rateDay={rateDay}
      {...(onUnitChange === undefined ? {} : { onUnitChange })}
      onValueChange={(next) => {
        setValue(next);
        onValueChange(next);
      }}
    />
  );
}

function amountSwitch(index: number): HTMLElement {
  const group = screen.getAllByRole('group', { name: 'Bitcoin or fiat' })[index];
  if (group === undefined) {
    throw new Error('missing amount switch');
  }
  return group;
}

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
    expect(screen.getByRole('group', { name: 'Bitcoin or fiat' })).toBeTruthy();
  });

  it('puts the switch beside the input in a composer and hides the label', () => {
    renderWithLocale(
      <AmountEntry
        layout="composer"
        label="Amount"
        value="21"
        onValueChange={() => undefined}
        rateDay={DAY}
      />,
      'en',
      'ch',
      'USD',
    );
    const input = screen.getByLabelText('Amount');
    const switchGroup = screen.getByRole('group', { name: 'Bitcoin or fiat' });
    const row = input.parentElement;
    expect(input).toHaveProperty('value', '21');
    expect(row).toBe(switchGroup.parentElement?.parentElement);
    expect(row?.className).toContain('items-center');
    expect(screen.getByText('Amount').className).toContain('sr-only');
    expect(screen.getByText('$0.02').className).toContain('ps-24');
  });

  it('omits the composer counter when the draft is empty', () => {
    renderWithLocale(
      <AmountEntry
        layout="composer"
        label="Amount"
        value=""
        onValueChange={() => undefined}
        rateDay={DAY}
      />,
      'en',
      'ch',
      'USD',
    );
    expect(screen.queryByText('$0.02')).toBeNull();
    expect(screen.getByText('Amount').className).toContain('sr-only');
  });

  it('puts the amount before the unit switch on a reply line', () => {
    renderWithLocale(
      <AmountEntry
        layout="inline"
        label="Amount"
        value="21"
        onValueChange={() => undefined}
        rateDay={DAY}
      />,
      'en',
      'ch',
      'USD',
    );
    const input = screen.getByLabelText('Amount');
    const group = screen.getByRole('group', { name: 'Bitcoin or fiat' });
    const row = input.parentElement;
    expect(row).toBe(group.parentElement?.parentElement);
    expect(row?.className).toContain('items-center');
    expect(input.className).toContain('h-12');
    expect(screen.getByText('Amount').className).toContain('sr-only');
    expect(screen.getByText('$0.02')).toBeTruthy();
    const children = Array.from(row?.children ?? []);
    const amountIndex = children.indexOf(input);
    const switchIndex = children.indexOf(group.parentElement as HTMLElement);
    expect(amountIndex >= 0 && switchIndex > amountIndex).toBe(true);
  });

  it('omits the reply counter when the draft is empty', () => {
    renderWithLocale(
      <AmountEntry
        layout="inline"
        label="Amount"
        value=""
        onValueChange={() => undefined}
        rateDay={DAY}
      />,
      'en',
      'ch',
      'USD',
    );
    expect(screen.queryByText('$0.02')).toBeNull();
    expect(screen.getByText('Amount').className).toContain('sr-only');
  });

  it('converts to fiat locally when nobody is signed in', () => {
    const onValueChange = vi.fn();
    const onUnitChange = vi.fn();
    renderWithLocale(
      <AmountEntry
        label="Amount"
        value="21"
        onValueChange={onValueChange}
        onUnitChange={onUnitChange}
        rateDay={DAY}
      />,
      'en',
      'ch',
      'USD',
    );
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    expect(onUnitChange).toHaveBeenCalledWith('fiat');
    expect(onValueChange).toHaveBeenCalledWith('0.021');
    expect(setAmountUnit).not.toHaveBeenCalled();
  });

  it('does not save a unit when the session has no account', () => {
    useAuthStore.setState({ session: 'sess', account: null, wrongAccount: false });
    const onUnitChange = vi.fn();
    renderWithLocale(
      <AmountEntry
        label="Amount"
        value=""
        onValueChange={() => undefined}
        onUnitChange={onUnitChange}
        rateDay={null}
      />,
      'en',
      'ch',
      'USD',
    );
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    expect(setAmountUnit).not.toHaveBeenCalled();
    expect(onUnitChange).toHaveBeenCalledWith('fiat');
  });

  it('shows bitcoin under a fiat draft and the missing-rate line', () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, amountUnit: 'fiat' },
      wrongAccount: false,
    });
    const { rerender } = renderWithLocale(
      <AmountEntry label="Amount" value="1.00" onValueChange={() => undefined} rateDay={DAY} />,
      'en',
      'ch',
      'USD',
    );
    expect(screen.getByText("₿1'000")).toBeTruthy();
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
    expect(onValueChange).toHaveBeenCalledWith('0.021');
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

  it('does not switch when the draft is not a whole sat amount', () => {
    const onValueChange = vi.fn();
    renderWithLocale(
      <AmountEntry label="Amount" value="1.00" onValueChange={onValueChange} rateDay={DAY} />,
      'en',
      'ch',
      'USD',
    );
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    fireEvent.click(screen.getByRole('button', { name: '₿' }));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '₿' })).toHaveProperty('ariaPressed', 'true');
  });

  it('ignores a press of the unit that is already selected', () => {
    const onValueChange = vi.fn();
    renderWithLocale(
      <AmountEntry
        label="Amount"
        value="21"
        onValueChange={onValueChange}
        rateDay={DAY}
        disabled
      />,
      'en',
      'ch',
      'USD',
    );
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('reports the unit and shows a class on the wrapper', () => {
    const onUnitChange = vi.fn();
    const { container, rerender } = renderWithLocale(
      <AmountEntry
        label="Amount"
        value="21"
        onValueChange={() => undefined}
        rateDay={DAY}
        onUnitChange={onUnitChange}
        className="mt-1"
      />,
      'en',
      'ch',
      'USD',
    );
    expect(onUnitChange).toHaveBeenCalledWith('btc');
    expect(container.firstChild).toHaveProperty('className', expect.stringContaining('mt-1'));
    rerender(
      <AmountEntry
        label="Amount"
        value="21"
        onValueChange={() => undefined}
        onUnitChange={onUnitChange}
        rateDay={null}
        lockedSats={21}
        className=""
      />,
    );
    expect(screen.getByText('No exchange rate yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    expect(screen.getByLabelText('Amount')).toHaveProperty('value', '21');
  });

  it('uses the requested unit when the saved account omits it', async () => {
    vi.mocked(setAmountUnit).mockImplementation(async () => {
      const updated = { ...account };
      delete updated.amountUnit;
      return updated;
    });
    useAuthStore.setState({ session: 'sess', account, wrongAccount: false });
    renderWithLocale(
      <AmountEntry label="Amount" value="" onValueChange={() => undefined} rateDay={DAY} />,
      'en',
      'ch',
      'USD',
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    });
    expect(useAuthStore.getState().account?.amountUnit).toBe('fiat');
  });

  it('waits for a rate before converting a filled draft from outside', () => {
    useAuthStore.setState({ session: 'sess', account, wrongAccount: false });
    const onValueChange = vi.fn();
    const onUnitChange = vi.fn();
    const { rerender } = renderWithLocale(
      <AmountEntry
        label="Amount"
        value="21"
        onValueChange={onValueChange}
        onUnitChange={onUnitChange}
        rateDay={null}
      />,
      'en',
      'ch',
      'USD',
    );
    act(() => {
      useAuthStore.setState({
        session: 'sess',
        account: { ...account, amountUnit: 'fiat' },
        wrongAccount: false,
      });
    });
    expect(onValueChange).not.toHaveBeenCalled();
    rerender(
      <AmountEntry
        label="Amount"
        value="21"
        onValueChange={onValueChange}
        onUnitChange={onUnitChange}
        rateDay={DAY}
      />,
    );
    expect(onValueChange).toHaveBeenCalledWith('0.021');
    expect(onUnitChange).toHaveBeenCalledWith('fiat');
  });

  it('ignores a slower unit save after a later field chooses', async () => {
    let resolveFirst: (value: Account) => void = () => undefined;
    let calls = 0;
    vi.mocked(setAmountUnit).mockImplementation((_token, unit) => {
      calls += 1;
      if (calls === 1) {
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve({ ...account, amountUnit: unit });
    });
    useAuthStore.setState({ session: 'sess', account, wrongAccount: false });
    renderWithLocale(
      <>
        <AmountEntry label="Pay" value="" onValueChange={() => undefined} rateDay={DAY} />
        <AmountEntry label="Reply" value="" onValueChange={() => undefined} rateDay={DAY} />
      </>,
      'en',
      'ch',
      'USD',
    );
    fireEvent.click(within(amountSwitch(0)).getByRole('button', { name: 'USD' }));
    await waitFor(() => {
      expect(within(amountSwitch(1)).getByRole('button', { name: 'USD' })).toHaveProperty(
        'ariaPressed',
        'true',
      );
    });
    fireEvent.click(within(amountSwitch(1)).getByRole('button', { name: '₿' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(useAuthStore.getState().account?.amountUnit).toBe('btc');
    await act(async () => {
      resolveFirst({ ...account, amountUnit: 'fiat' });
    });
    expect(useAuthStore.getState().account?.amountUnit).toBe('btc');
  });

  it('keeps an earlier successful save when the later save fails', async () => {
    let resolveFirst: (value: Account) => void = () => undefined;
    let rejectSecond: (reason: Error) => void = () => undefined;
    let calls = 0;
    vi.mocked(setAmountUnit).mockImplementation(() => {
      calls += 1;
      if (calls === 1) {
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      }
      return new Promise((_, reject) => {
        rejectSecond = reject;
      });
    });
    useAuthStore.setState({ session: 'sess', account, wrongAccount: false });
    renderWithLocale(
      <>
        <AmountEntry label="Pay" value="" onValueChange={() => undefined} rateDay={DAY} />
        <AmountEntry label="Reply" value="" onValueChange={() => undefined} rateDay={DAY} />
      </>,
      'en',
      'ch',
      'USD',
    );
    fireEvent.click(within(amountSwitch(0)).getByRole('button', { name: 'USD' }));
    await waitFor(() => {
      expect(within(amountSwitch(1)).getByRole('button', { name: 'USD' })).toHaveProperty(
        'ariaPressed',
        'true',
      );
    });
    fireEvent.click(within(amountSwitch(1)).getByRole('button', { name: '₿' }));
    await act(async () => {
      resolveFirst({ ...account, amountUnit: 'fiat' });
    });
    expect(useAuthStore.getState().account?.amountUnit).toBe('btc');
    await act(async () => {
      rejectSecond(new Error('nope'));
    });
    expect(useAuthStore.getState().account?.amountUnit).toBe('fiat');
  });

  it('applies an earlier success that arrives after the later save failed', async () => {
    let resolveFirst: (value: Account) => void = () => undefined;
    let rejectSecond: (reason: Error) => void = () => undefined;
    let calls = 0;
    vi.mocked(setAmountUnit).mockImplementation(() => {
      calls += 1;
      if (calls === 1) {
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      }
      return new Promise((_, reject) => {
        rejectSecond = reject;
      });
    });
    useAuthStore.setState({ session: 'sess', account, wrongAccount: false });
    renderWithLocale(
      <>
        <AmountEntry label="Pay" value="" onValueChange={() => undefined} rateDay={DAY} />
        <AmountEntry label="Reply" value="" onValueChange={() => undefined} rateDay={DAY} />
      </>,
      'en',
      'ch',
      'USD',
    );
    fireEvent.click(within(amountSwitch(0)).getByRole('button', { name: 'USD' }));
    await waitFor(() => {
      expect(within(amountSwitch(1)).getByRole('button', { name: 'USD' })).toHaveProperty(
        'ariaPressed',
        'true',
      );
    });
    fireEvent.click(within(amountSwitch(1)).getByRole('button', { name: '₿' }));
    await act(async () => {
      rejectSecond(new Error('nope'));
    });
    expect(useAuthStore.getState().account?.amountUnit).toBe('btc');
    await act(async () => {
      resolveFirst({ ...account, amountUnit: 'fiat' });
    });
    expect(useAuthStore.getState().account?.amountUnit).toBe('fiat');
  });

  it('ignores an earlier failure after a later save started', async () => {
    let rejectFirst: (reason: Error) => void = () => undefined;
    let calls = 0;
    vi.mocked(setAmountUnit).mockImplementation(() => {
      calls += 1;
      if (calls === 1) {
        return new Promise((_, reject) => {
          rejectFirst = reject;
        });
      }
      return new Promise(() => undefined);
    });
    useAuthStore.setState({ session: 'sess', account, wrongAccount: false });
    renderWithLocale(
      <>
        <AmountEntry label="Pay" value="" onValueChange={() => undefined} rateDay={DAY} />
        <AmountEntry label="Reply" value="" onValueChange={() => undefined} rateDay={DAY} />
      </>,
      'en',
      'ch',
      'USD',
    );
    fireEvent.click(within(amountSwitch(0)).getByRole('button', { name: 'USD' }));
    await waitFor(() => {
      expect(within(amountSwitch(1)).getByRole('button', { name: 'USD' })).toHaveProperty(
        'ariaPressed',
        'true',
      );
    });
    fireEvent.click(within(amountSwitch(1)).getByRole('button', { name: '₿' }));
    await act(async () => {
      rejectFirst(new Error('nope'));
    });
    expect(useAuthStore.getState().account?.amountUnit).toBe('btc');
  });

  it('does not roll a new session back to the previous session unit', async () => {
    let rejectSecond: (reason: Error) => void = () => undefined;
    let calls = 0;
    vi.mocked(setAmountUnit).mockImplementation(() => {
      calls += 1;
      if (calls === 1) {
        return new Promise(() => undefined);
      }
      return new Promise((_, reject) => {
        rejectSecond = reject;
      });
    });
    useAuthStore.setState({ session: 'sess', account, wrongAccount: false });
    renderWithLocale(
      <>
        <AmountEntry label="Pay" value="" onValueChange={() => undefined} rateDay={DAY} />
        <AmountEntry label="Reply" value="" onValueChange={() => undefined} rateDay={DAY} />
      </>,
      'en',
      'ch',
      'USD',
    );
    fireEvent.click(within(amountSwitch(0)).getByRole('button', { name: 'USD' }));
    const nextAccount = { ...account, amountUnit: 'fiat' as const };
    useAuthStore.setState({ session: 'other', account: nextAccount, wrongAccount: false });
    await waitFor(() => {
      expect(within(amountSwitch(1)).getByRole('button', { name: 'USD' })).toHaveProperty(
        'ariaPressed',
        'true',
      );
    });
    fireEvent.click(within(amountSwitch(1)).getByRole('button', { name: '₿' }));
    await act(async () => {
      rejectSecond(new Error('nope'));
    });
    expect(useAuthStore.getState().account?.amountUnit).toBe('fiat');
  });

  it('restores the stored unit when a later save fails', async () => {
    let rejectSecond: (reason: Error) => void = () => undefined;
    let calls = 0;
    vi.mocked(setAmountUnit).mockImplementation(() => {
      calls += 1;
      if (calls === 1) {
        return new Promise(() => undefined);
      }
      return new Promise((_, reject) => {
        rejectSecond = reject;
      });
    });
    useAuthStore.setState({ session: 'sess', account, wrongAccount: false });
    renderWithLocale(
      <>
        <AmountEntry label="Pay" value="" onValueChange={() => undefined} rateDay={DAY} />
        <AmountEntry label="Reply" value="" onValueChange={() => undefined} rateDay={DAY} />
      </>,
      'en',
      'ch',
      'USD',
    );
    fireEvent.click(within(amountSwitch(0)).getByRole('button', { name: 'USD' }));
    await waitFor(() => {
      expect(within(amountSwitch(1)).getByRole('button', { name: 'USD' })).toHaveProperty(
        'ariaPressed',
        'true',
      );
    });
    fireEvent.click(within(amountSwitch(1)).getByRole('button', { name: '₿' }));
    await act(async () => {
      rejectSecond(new Error('nope'));
    });
    expect(useAuthStore.getState().account?.amountUnit).toBe('btc');
  });

  it('treats a missing stored unit as bitcoin when a save starts', async () => {
    const bare = { ...account };
    delete bare.amountUnit;
    vi.mocked(setAmountUnit).mockResolvedValue({ ...account, amountUnit: 'fiat' });
    useAuthStore.setState({ session: 'sess', account: bare, wrongAccount: false });
    renderWithLocale(
      <AmountEntry label="Amount" value="" onValueChange={() => undefined} rateDay={DAY} />,
      'en',
      'ch',
      'USD',
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    });
    expect(useAuthStore.getState().account?.amountUnit).toBe('fiat');
  });

  it('keeps the unit when a filled draft has no rate', () => {
    useAuthStore.setState({ session: 'sess', account, wrongAccount: false });
    const onValueChange = vi.fn();
    renderWithLocale(
      <AmountEntry label="Amount" value="21" onValueChange={onValueChange} rateDay={null} />,
      'en',
      'ch',
      'USD',
    );
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    expect(setAmountUnit).not.toHaveBeenCalled();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(useAuthStore.getState().account?.amountUnit).toBe('btc');
  });

  it('ignores a saved unit after the session changed', async () => {
    let resolveSave: (value: Account) => void = () => undefined;
    vi.mocked(setAmountUnit).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    useAuthStore.setState({ session: 'sess', account, wrongAccount: false });
    renderWithLocale(
      <AmountEntry label="Amount" value="21" onValueChange={() => undefined} rateDay={DAY} />,
      'en',
      'ch',
      'USD',
    );
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    useAuthStore.setState({
      session: 'other',
      account: { ...account, amountUnit: 'fiat' },
      wrongAccount: false,
    });
    await act(async () => {
      resolveSave({ ...account, amountUnit: 'btc' });
    });
    expect(useAuthStore.getState().account?.amountUnit).toBe('fiat');
  });

  it('leaves a missing account alone after the save succeeds', async () => {
    let resolveSave: (value: Account) => void = () => undefined;
    vi.mocked(setAmountUnit).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    useAuthStore.setState({ session: 'sess', account, wrongAccount: false });
    renderWithLocale(
      <AmountEntry label="Amount" value="21" onValueChange={() => undefined} rateDay={DAY} />,
      'en',
      'ch',
      'USD',
    );
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    useAuthStore.setState({ session: 'sess', account: null, wrongAccount: false });
    await act(async () => {
      resolveSave({ ...account, amountUnit: 'btc' });
    });
    expect(useAuthStore.getState().account).toBeNull();
  });

  it('does not revert the unit when the session changed before the save failed', async () => {
    let rejectSave: (reason: Error) => void = () => undefined;
    vi.mocked(setAmountUnit).mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectSave = reject;
        }),
    );
    useAuthStore.setState({ session: 'sess', account, wrongAccount: false });
    renderWithLocale(
      <AmountEntry label="Amount" value="21" onValueChange={() => undefined} rateDay={DAY} />,
      'en',
      'ch',
      'USD',
    );
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    useAuthStore.setState({
      session: 'other',
      account: { ...account, amountUnit: 'fiat' },
      wrongAccount: false,
    });
    await act(async () => {
      rejectSave(new Error('nope'));
    });
    expect(useAuthStore.getState().account?.amountUnit).toBe('fiat');
  });

  it('keeps a fiat draft typed during a failed save until a rate exists', async () => {
    let rejectSave: (reason: Error) => void = () => undefined;
    vi.mocked(setAmountUnit).mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectSave = reject;
        }),
    );
    useAuthStore.setState({ session: 'sess', account, wrongAccount: false });
    const onValueChange = vi.fn();
    const onUnitChange = vi.fn();
    const { rerender } = renderWithLocale(
      <TypingAmount
        initial=""
        rateDay={null}
        onValueChange={onValueChange}
        onUnitChange={onUnitChange}
      />,
      'en',
      'ch',
      'USD',
    );
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '10.00' } });
    await act(async () => {
      rejectSave(new Error('nope'));
    });
    expect(useAuthStore.getState().account?.amountUnit).toBe('btc');
    expect(screen.getByRole('button', { name: 'USD' })).toHaveProperty('ariaPressed', 'true');
    expect(onUnitChange).toHaveBeenCalledWith('fiat');
    expect(screen.getByLabelText('Amount')).toHaveProperty('value', '10.00');
    rerender(
      <TypingAmount
        initial=""
        rateDay={DAY}
        onValueChange={onValueChange}
        onUnitChange={onUnitChange}
      />,
    );
    expect(onValueChange).toHaveBeenLastCalledWith('10000');
  });

  it('keeps unreadable keystrokes when a save fails', async () => {
    let rejectSave: (reason: Error) => void = () => undefined;
    vi.mocked(setAmountUnit).mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectSave = reject;
        }),
    );
    useAuthStore.setState({ session: 'sess', account, wrongAccount: false });
    const onValueChange = vi.fn();
    renderWithLocale(
      <TypingAmount initial="21" rateDay={DAY} onValueChange={onValueChange} />,
      'en',
      'ch',
      'USD',
    );
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: 'abc' } });
    await act(async () => {
      rejectSave(new Error('nope'));
    });
    expect(onValueChange).toHaveBeenLastCalledWith('abc');
    expect(useAuthStore.getState().account?.amountUnit).toBe('btc');
  });

  it('converts keystrokes typed during a failed save back to the previous unit', async () => {
    let rejectSave: (reason: Error) => void = () => undefined;
    vi.mocked(setAmountUnit).mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectSave = reject;
        }),
    );
    useAuthStore.setState({ session: 'sess', account, wrongAccount: false });
    const onValueChange = vi.fn();
    const onUnitChange = vi.fn();
    renderWithLocale(
      <AmountEntry
        label="Amount"
        value="21"
        onValueChange={onValueChange}
        onUnitChange={onUnitChange}
        rateDay={DAY}
      />,
      'en',
      'ch',
      'USD',
    );
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '0.05' } });
    await act(async () => {
      rejectSave(new Error('nope'));
    });
    expect(onValueChange).toHaveBeenLastCalledWith('50');
    expect(onUnitChange).toHaveBeenCalledWith('btc');
    expect(useAuthStore.getState().account?.amountUnit).toBe('btc');
  });

  it('keeps a numeric placeholder unchanged while fiat is the typing unit', () => {
    useAuthStore.setState({
      session: 'sess',
      account: { ...account, amountUnit: 'fiat' },
      wrongAccount: false,
    });
    const { rerender } = renderWithLocale(
      <AmountEntry
        label="Amount"
        value=""
        placeholder="21"
        onValueChange={() => undefined}
        rateDay={DAY}
      />,
      'en',
      'ch',
      'USD',
    );
    const input = screen.getByLabelText('Amount');
    expect(input).toHaveProperty('placeholder', '21');
    expect(input.className).toContain('bg-app-card');
    expect(input.className).toContain('tabular-nums');
    expect(input.previousElementSibling?.getAttribute('aria-hidden')).not.toBe('true');
    expect(input.nextElementSibling?.getAttribute('aria-hidden')).not.toBe('true');
    rerender(
      <AmountEntry
        label="Amount"
        value=""
        placeholder="21"
        onValueChange={() => undefined}
        rateDay={null}
      />,
    );
    expect(screen.getByLabelText('Amount')).toHaveProperty('placeholder', '21');
    rerender(
      <AmountEntry
        label="Amount"
        value=""
        placeholder="soon"
        onValueChange={() => undefined}
        rateDay={DAY}
      />,
    );
    expect(screen.getByLabelText('Amount')).toHaveProperty('placeholder', 'soon');
    rerender(
      <AmountEntry
        label="Amount"
        value=""
        placeholder="0"
        onValueChange={() => undefined}
        rateDay={DAY}
      />,
    );
    expect(screen.getByLabelText('Amount')).toHaveProperty('placeholder', '0');
  });
});
