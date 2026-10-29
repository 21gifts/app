import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OldWordsInputProps } from '@/components/OldWordsInput';
import { RemainingBalanceScreen } from '@/components/RemainingBalanceScreen';
import {
  useRemainingBalance,
  type RemainingBalanceState,
  type UseRemainingBalanceResult,
} from '@/hooks/useRemainingBalance';
import { useSpotRate } from '@/hooks/useSpotRate';
import type { Account } from '@/lib/api-types';
import { spotRateDay } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const input = vi.hoisted(() => ({ props: null as OldWordsInputProps | null }));
const backResults = vi.hoisted(() => ({ list: [] as boolean[] }));

vi.mock('@/hooks/useRemainingBalance', () => ({ useRemainingBalance: vi.fn() }));
vi.mock('@/hooks/useSpotRate', () => ({ useSpotRate: vi.fn() }));
vi.mock('@/components/OldWordsInput', () => ({
  OldWordsInput: (props: OldWordsInputProps) => {
    input.props = props;
    return <p>Words input {props.mode}</p>;
  },
}));
vi.mock('@/components/ProfileChromeLeft', () => ({
  ProfileChromeLeft: ({ onBackClick }: { onBackClick?: () => boolean }) => (
    <button
      type="button"
      onClick={() => {
        backResults.list.push(onBackClick?.() ?? false);
      }}
    >
      Back
    </button>
  ),
}));

const KEY = `02${'c'.repeat(64)}`;

let wallet: UseRemainingBalanceResult;

/**
 * Renders the screen in a state.
 *
 * @param state - Step, balance, and removal.
 */
function show(state: Partial<RemainingBalanceState> & Pick<RemainingBalanceState, 'step'>): void {
  const full: RemainingBalanceState = { balanceSats: null, removal: 'idle', ...state };
  wallet = {
    ...full,
    removable: (full.step === 'balance' && full.balanceSats === 0) || full.step === 'done',
    reload: vi.fn(),
    scan: vi.fn(),
    type: vi.fn(),
    onWords: vi.fn(),
    retryOpen: vi.fn(),
    transfer: vi.fn(),
    askRemove: vi.fn(),
    cancelRemove: vi.fn(),
    confirmRemove: vi.fn(),
    leave: vi.fn(),
    back: vi.fn(() => true),
  };
  vi.mocked(useRemainingBalance).mockReturnValue(wallet);
  renderWithLocale(<RemainingBalanceScreen sparkPubkey={KEY} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  input.props = null;
  backResults.list = [];
  vi.mocked(useSpotRate).mockReturnValue(spotRateDay({ USD: '100000.00' }));
  useAuthStore.setState({ account: { id: 'acc_ada' } as Account });
});

afterEach(cleanup);

describe('RemainingBalanceScreen', () => {
  it('reads the spot rate only while a balance is shown', () => {
    show({ step: 'start' });
    expect(useSpotRate).toHaveBeenCalledWith(false);
  });

  it('shows nothing before the account or the list has loaded', () => {
    useAuthStore.setState({ account: null });
    show({ step: 'start' });
    expect(screen.queryByRole('heading')).toBeNull();
    cleanup();
    useAuthStore.setState({ account: { id: 'acc_ada' } as Account });
    show({ step: 'checking' });
    expect(screen.queryByRole('heading')).toBeNull();
    expect(useRemainingBalance).toHaveBeenCalledWith(KEY);
  });

  it('a list that cannot be read offers Try again', () => {
    show({ step: 'loadError' });
    expect(screen.getByRole('alert').textContent).toBe('Previous wallets could not be loaded.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(wallet.reload).toHaveBeenCalled();
  });

  it('a wallet that is not listed says so, and Done returns', () => {
    show({ step: 'notFound' });
    expect(screen.getByRole('alert').textContent).toBe(
      'This previous wallet is not on your account.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(wallet.leave).toHaveBeenCalled();
  });

  it('starts with the title, what opens the wallet, and the two ways in', () => {
    show({ step: 'start' });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Transfer remaining balance' }),
    ).toBeTruthy();
    expect(
      screen.getByText('Scan the two codes of this wallet or type its 12 words.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Scan two codes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Type my 12 words' }));
    expect(wallet.scan).toHaveBeenCalled();
    expect(wallet.type).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(backResults.list).toEqual([true]);
  });

  it('scans codes of the signed-in account only, under a hidden title', () => {
    show({ step: 'scan' });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Transfer remaining balance' }).className,
    ).toBe('sr-only');
    expect(input.props?.mode).toBe('scan');
    expect(input.props?.expectedOwnerAccountId).toBe('acc_ada');
    expect(input.props?.onWords).toBe(wallet.onWords);
  });

  it('types the words', () => {
    show({ step: 'type' });
    expect(screen.getByText('Words input type')).toBeTruthy();
    expect(input.props?.onWords).toBe(wallet.onWords);
  });

  it('says the wallet opens', () => {
    show({ step: 'opening' });
    expect(screen.getByRole('status').textContent).toBe('Opening the old wallet…');
  });

  it.each([
    ['mismatch', 'These words do not open this previous wallet.'],
    ['walletError', 'Your wallet could not be opened. Please try again.'],
  ] as const)('%s says so and offers Try again', (step, text) => {
    show({ step });
    expect(screen.getByRole('alert').textContent).toBe(text);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(wallet.retryOpen).toHaveBeenCalled();
  });

  it('a balance shows ₿ with the current fiat and Transfer, and no removal', () => {
    show({ step: 'balance', balanceSats: 21_000 });
    expect(screen.getByText('In this wallet')).toBeTruthy();
    expect(screen.getByText("₿21'000 · $21.00")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove previous wallet' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Transfer' }));
    expect(wallet.transfer).toHaveBeenCalled();
    expect(useSpotRate).toHaveBeenCalledWith(true);
  });

  it('shows ₿ alone while the spot rate is missing', () => {
    vi.mocked(useSpotRate).mockReturnValue(null);
    show({ step: 'balance', balanceSats: 21_000 });
    expect(screen.getByText("₿21'000")).toBeTruthy();
  });

  it('a move in progress disables Transfer with a spinner', () => {
    show({ step: 'sending', balanceSats: 21_000 });
    const button = screen.getByRole('button', { name: 'Transfer' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.querySelector('.animate-spin')).not.toBeNull();
  });

  it('a failed move shows the balance, the alert, and Try again', () => {
    show({ step: 'error', balanceSats: 21_000 });
    expect(screen.getByRole('alert').textContent).toBe(
      'The balance could not be moved. Try again.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(wallet.transfer).toHaveBeenCalled();
  });

  it('an empty wallet offers its removal and Done', () => {
    show({ step: 'balance', balanceSats: 0 });
    expect(screen.getByText('₿0 · $0.00')).toBeTruthy();
    expect(
      screen.getByText('This wallet is empty. You can remove it from your account.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Transfer' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove previous wallet' }));
    expect(wallet.askRemove).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(wallet.leave).toHaveBeenCalled();
  });

  it('after the move says so and offers the removal', () => {
    show({ step: 'done', balanceSats: 0 });
    expect(screen.getByRole('status').textContent).toBe('Moved to your wallet.');
    expect(screen.getByRole('button', { name: 'Remove previous wallet' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
  });

  it('the removal asks to confirm with icon buttons', () => {
    show({ step: 'done', balanceSats: 0, removal: 'confirm' });
    const confirm = screen.getByRole('group', {
      name: 'Remove this previous wallet from your account?',
    });
    expect(screen.queryByRole('button', { name: 'Remove previous wallet' })).toBeNull();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Remove' }));
    fireEvent.click(within(confirm).getByRole('button', { name: 'Keep' }));
    expect(wallet.confirmRemove).toHaveBeenCalled();
    expect(wallet.cancelRemove).toHaveBeenCalled();
    expect(within(confirm).queryByText('Remove')).toBeNull();
  });

  it('a removal in progress is busy, and a failed one says so', () => {
    show({ step: 'balance', balanceSats: 0, removal: 'busy' });
    const busy = screen.getByRole('group', {
      name: 'Remove this previous wallet from your account?',
    });
    expect(
      (within(busy).getByRole('button', { name: 'Remove' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    cleanup();
    show({ step: 'balance', balanceSats: 0, removal: 'error' });
    expect(screen.getByRole('alert').textContent).toBe(
      'The wallet could not be removed. Try again.',
    );
  });
});
