import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletPaymentDetails } from '@/components/WalletPaymentDetails';
import { useLatestRateDayState } from '@/hooks/useLatestRateDay';
import { useWallet, type UseWalletResult } from '@/hooks/useWallet';
import { useWalletPayment, type WalletPaymentState } from '@/hooks/useWalletPayment';
import { openInSystemBrowser } from '@/lib/in-app-browser';
import type { FiatRateDay } from '@/lib/stats-money';
import { WALLET_PAYMENT_FIXTURES } from '@/lib/wallet/payment-fixtures';
import { toWalletPayment, type WalletPayment } from '@/lib/wallet/wallet-sdk';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/navigation', () => ({
  useSearchParams: (): URLSearchParams => new URLSearchParams('id=p1'),
}));
vi.mock('@/hooks/useLatestRateDay', () => ({ useLatestRateDayState: vi.fn() }));
vi.mock('@/hooks/useWalletPayment', () => ({ useWalletPayment: vi.fn() }));
vi.mock('@/lib/in-app-browser', () => ({ openInSystemBrowser: vi.fn() }));
vi.mock('@/hooks/useWallet', () => ({ useWallet: vi.fn() }));
vi.mock('@/components/WalletBalance', () => ({
  WalletBalance: ({ status, onUnlock }: { status: string; onUnlock: () => void }) => (
    <button type="button" onClick={onUnlock}>
      Wallet {status}
    </button>
  ),
}));

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

/** The mapped fixture payment whose id starts with `prefix`. */
function fixture(prefix: string): WalletPayment {
  const found = WALLET_PAYMENT_FIXTURES.find((payment) => payment.id.startsWith(prefix));
  if (found === undefined) {
    throw new Error(`no fixture ${prefix}`);
  }
  return toWalletPayment(found);
}

const ZAP = 'f43f0362';
const SPARK_SEND = 'df98837c';
const ADDRESS_SEND = 'abe077a7';
const NOTE_RECEIVE = 'b6f8bc08';
const PENDING = '45c2cb5e';
const FAILED = '24c8b87e';
const DEPOSIT = '9bc2f53d';
const WITHDRAW = '71a0b382';

function walletWith(status: UseWalletResult['status']): UseWalletResult {
  return { status, balanceSats: null, unlock: vi.fn(), retry: vi.fn(), prfUnsupported: false };
}

function show(state: WalletPaymentState): void {
  vi.mocked(useWalletPayment).mockReturnValue(state);
  renderWithLocale(<WalletPaymentDetails />);
}

function showPayment(payment: WalletPayment): void {
  show({ status: 'ready', payment });
}

/** The value cell of the summary or details row named `label`. */
function row(label: string): HTMLElement {
  const term = screen.getByText(label, { selector: 'dt' });
  return term.nextElementSibling as HTMLElement;
}

beforeEach(() => {
  vi.mocked(useLatestRateDayState)
    .mockReset()
    .mockReturnValue({ rateDay: RATE_DAY, settled: true, loading: false });
  vi.mocked(openInSystemBrowser).mockReset();
  vi.mocked(useWallet).mockReturnValue(walletWith('ready'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('WalletPaymentDetails', () => {
  it('reads the id from the address and shows nothing while loading', () => {
    show({ status: 'loading' });
    expect(useWalletPayment).toHaveBeenCalledWith('p1');
    expect(screen.getByRole('heading', { level: 1, name: 'Payment' }).className).toContain(
      'sr-only',
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Date')).toBeNull();
  });

  it('shows the wallet state while the wallet is not open, and says not found without a wallet here', () => {
    const locked = walletWith('locked');
    vi.mocked(useWallet).mockReturnValue(locked);
    show({ status: 'loading' });
    fireEvent.click(screen.getByRole('button', { name: 'Wallet locked' }));
    expect(locked.unlock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
    cleanup();
    vi.mocked(useWallet).mockReturnValue(walletWith('disabled'));
    show({ status: 'loading' });
    expect(screen.getByRole('alert').textContent).toBe('This payment could not be found.');
    expect(screen.queryByRole('button', { name: /^Wallet / })).toBeNull();
  });

  it('says when the payment could not be found', () => {
    show({ status: 'missing' });
    expect(screen.getByRole('alert').textContent).toBe('This payment could not be found.');
  });

  it('shows nothing of a loaded payment until the rate read has settled', () => {
    vi.mocked(useLatestRateDayState).mockReturnValue({
      rateDay: null,
      settled: false,
      loading: true,
    });
    showPayment(fixture(ZAP));
    expect(screen.queryByText("+₿2'100")).toBeNull();
    expect(screen.queryByText('Date')).toBeNull();
  });

  it('shows a received zap as a gift on the post: signed amount with fiat and the message, without a key or note id', () => {
    showPayment(fixture(ZAP));
    expect(screen.getByText('Gift on your post')).toBeTruthy();
    expect(screen.getByText("+₿2'100")).toBeTruthy();
    expect(screen.getByText('$2.10', { selector: 'p' })).toBeTruthy();
    expect(screen.getByText('Completed').className).toContain('text-app-success');
    expect(screen.getByText('Great photo!')).toBeTruthy();
    expect(row('Type').textContent).toBe('Instant payment');
    expect(screen.queryByText('From', { selector: 'dt' })).toBeNull();
    expect(screen.queryByText('Post', { selector: 'dt' })).toBeNull();
    expect(document.body.textContent).not.toMatch(/npub1|note1|Zap/);
    expect(row('Payment request').textContent).toMatch(/^lnbc/);
    expect(row('Amount').textContent).toBe("₿2'100 · $2.10");
    // A fee-less receive has no fee row, and a received payment shows no recipient node.
    expect(screen.queryByText('Fee', { selector: 'dt' })).toBeNull();
    expect(screen.queryByText('Recipient node', { selector: 'dt' })).toBeNull();
    expect(row('Proof of payment').textContent).toContain('…');
    expect(screen.queryByText('View on mempool.space')).toBeNull();
  });

  it('shows a Lightning-address send: To, the comment, and fee and total with fiat, without the node key', () => {
    showPayment(fixture(ADDRESS_SEND));
    expect(screen.getAllByText('bob@example.com')).toHaveLength(2);
    expect(screen.getByText("−₿10'000")).toBeTruthy();
    expect(screen.getByText('Thanks for dinner')).toBeTruthy();
    expect(row('To').textContent).toBe('bob@example.com');
    expect(row('Fee').textContent).toBe('₿3 · $0.00');
    expect(row('Total').textContent).toBe("₿10'003 · $10.00");
    expect(screen.queryByText('Recipient node', { selector: 'dt' })).toBeNull();
    expect(screen.queryByText('Description', { selector: 'dt' })).toBeNull();
  });

  it('shows Free for a fee-less send and a received payment note', () => {
    showPayment(fixture(SPARK_SEND));
    expect(screen.getByText('Gift to @alice')).toBeTruthy();
    expect(row('Type').textContent).toBe('Wallet transfer');
    expect(row('Fee').textContent).toBe('Free');
    expect(screen.queryByText('Total', { selector: 'dt' })).toBeNull();
    cleanup();
    showPayment(fixture(NOTE_RECEIVE));
    expect(screen.getByText('Happy birthday!')).toBeTruthy();
    expect(screen.getByText('Received')).toBeTruthy();
  });

  it('marks a pending send with its hint', () => {
    showPayment(fixture(PENDING));
    expect(screen.getByText('Pending').className).toContain('bg-app-notice');
    expect(
      screen.getByText(
        'Still on its way. The amount stays reserved until it arrives or comes back.',
      ),
    ).toBeTruthy();
    expect(row('Total').textContent).toContain("₿1'502");
  });

  it('strikes a failed send through, hides its fee, and says nothing left the wallet', () => {
    showPayment(fixture(FAILED));
    expect(screen.getByText('Failed').className).toContain('text-app-danger');
    expect(screen.getByText("−₿50'000").className).toContain('line-through');
    expect(screen.getByText('Nothing left your wallet.')).toBeTruthy();
    expect(screen.queryByText('Fee', { selector: 'dt' })).toBeNull();
    expect(screen.queryByText('Total', { selector: 'dt' })).toBeNull();
  });

  it('shows a deposit with what arrived on-chain, the transaction, and the output, and links to mempool.space through the warning', () => {
    showPayment(fixture(DEPOSIT));
    expect(screen.getByText('On-chain deposit', { selector: 'p' })).toBeTruthy();
    expect(row('Fee').textContent).toContain('₿254');
    expect(row('Arrived on-chain').textContent).toContain("₿44'000");
    expect(row('Output').textContent).toBe('1');
    expect(screen.getByRole('button', { name: 'Copy Output' })).toBeTruthy();
    expect(row('Transaction').textContent).toContain('…');
    const link = screen.getByRole('link', { name: 'View on mempool.space' });
    const url = link.getAttribute('href') as string;
    expect(url).toMatch(/^https:\/\/mempool\.space\/tx\/[0-9a-f]{64}$/);
    fireEvent.click(link);
    const dialog = screen.getByRole('dialog', { name: 'Open external link?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(openInSystemBrowser).not.toHaveBeenCalled();
    fireEvent.click(link);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Open link' }));
    expect(openInSystemBrowser).toHaveBeenCalledWith(url);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a withdrawal with its network fee and total', () => {
    showPayment(fixture(WITHDRAW));
    expect(screen.getByText('On-chain withdrawal', { selector: 'p' })).toBeTruthy();
    expect(row('Total').textContent).toContain("₿41'840");
    expect(screen.queryByText('Output', { selector: 'dt' })).toBeNull();
  });

  it('shows the description row when the title is not the description, and the other method, without a rate', () => {
    vi.mocked(useLatestRateDayState).mockReturnValue({
      rateDay: null,
      settled: true,
      loading: false,
    });
    showPayment({
      ...fixture(DEPOSIT),
      method: 'other',
      feesSats: 0,
      info: {
        description: 'Refund',
        zap: { senderPubkey: 'ab'.repeat(32), content: '', noteId: null },
      },
    });
    expect(row('Description').textContent).toBe('Refund');
    expect(row('Type').textContent).toBe('Payment');
    expect(screen.queryByText('Post', { selector: 'dt' })).toBeNull();
    expect(screen.queryByText('Message')).toBeNull();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('keeps the description row under a Lightning address title, and drops it when the description is the title', () => {
    showPayment({
      ...fixture(SPARK_SEND),
      info: { lnAddress: 'bob@example.com', description: 'Coffee' },
    });
    expect(screen.getByText('bob@example.com', { selector: 'p' })).toBeTruthy();
    expect(row('Description').textContent).toBe('Coffee');
    cleanup();
    showPayment({ ...fixture(SPARK_SEND), info: { description: 'Coffee' } });
    expect(screen.getByText('Coffee', { selector: 'p' })).toBeTruthy();
    expect(screen.queryByText('Description', { selector: 'dt' })).toBeNull();
  });

  it('copies a value with the icon-only Copy and confirms for two seconds; a refused clipboard keeps Copy', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const payment = fixture(SPARK_SEND);
    showPayment(payment);
    const copy = screen.getByRole('button', { name: 'Copy Payment ID' });
    expect(copy.textContent).toBe('');
    await act(async () => {
      fireEvent.click(copy);
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith(payment.id);
    expect(screen.getByText('Copied')).toBeTruthy();
    expect(copy.querySelector('svg')?.getAttribute('class')).toContain('text-app-success');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(screen.queryByText('Copied')).toBeNull();
    writeText.mockRejectedValueOnce(new Error('denied'));
    await act(async () => {
      fireEvent.click(copy);
      await Promise.resolve();
    });
    expect(screen.queryByText('Copied')).toBeNull();
  });

  it('hides a loaded payment while the wallet is not open and shows the wallet state instead', () => {
    vi.mocked(useWallet).mockReturnValue(walletWith('error'));
    showPayment(fixture(ZAP));
    expect(screen.queryByText("+₿2'100")).toBeNull();
    expect(screen.getByRole('button', { name: 'Wallet error' })).toBeTruthy();
  });
});
