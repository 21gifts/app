import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { Collapse } from '@/components/Collapse';
import { PAY_SHEET_HOLD_MS, PaySheet } from '@/components/PaySheet';
import { WalletPay } from '@/components/WalletPay';
import {
  useWalletPay,
  type UseWalletPayResult,
  type WalletPayView,
  type WalletPaySent,
} from '@/hooks/useWalletPay';
import { MOTION_SWAP_FADE_MS } from '@/lib/motion';
import type { FiatRateDay } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/hooks/useWalletPay', () => ({ useWalletPay: vi.fn() }));

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

vi.mock('@/components/WalletSetupNote', () => ({
  WalletSetupNote: () => <p role="alert">setup failed</p>,
}));

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

function hookWith(
  view: WalletPayView,
  feeSats: number | null = 0,
  missingSats: number | null = null,
  sent: WalletPaySent = null,
): UseWalletPayResult {
  const result = { view, sent, feeSats, missingSats, pay: vi.fn(), retry: vi.fn() };
  vi.mocked(useWalletPay).mockReturnValue(result);
  return result;
}

function renderPay(sparkInvoice: string | null = 'spark1x'): void {
  renderWithLocale(
    <WalletPay
      sparkInvoice={sparkInvoice}
      pr="lnbc210n1x"
      amountSats={21}
      rateDay={RATE_DAY}
      flow="gift"
    />,
  );
}

beforeEach(() => {
  vi.mocked(useWalletPay).mockReset();
  push.mockReset();
  useAuthStore.setState({
    session: 'token',
    account: { username: 'ada' } as never,
  });
});

afterEach(cleanup);

describe('WalletPay', () => {
  it('passes both requests and the amount to the hook', () => {
    hookWith('preparing');
    renderPay(null);
    expect(useWalletPay).toHaveBeenCalledWith(null, 'lnbc210n1x', 21, 'gift');
  });

  it('says the wallet is not available here, without any button', () => {
    hookWith('unavailable');
    renderPay();
    expect(screen.getByRole('status').textContent).toBe(
      'Your 21.gifts wallet is not available here, so this cannot be paid.',
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('says the payment could not be prepared and Try again retries', () => {
    const hook = hookWith('failed');
    renderPay();
    expect(screen.getByRole('alert').textContent).toBe(
      'Your wallet could not prepare this payment. Please try again.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(hook.retry).toHaveBeenCalledTimes(1);
    expect(hook.pay).not.toHaveBeenCalled();
  });

  it('renders the inline setup note when background setup failed', () => {
    const hook = hookWith('setupFailed');
    renderPay();
    expect(screen.getByRole('alert').textContent).toBe('setup failed');
    expect(screen.queryByRole('status')).toBeNull();
    expect(hook.retry).not.toHaveBeenCalled();
  });

  it('shows checking and paying as status lines without buttons', () => {
    hookWith('preparing');
    renderPay();
    expect(screen.getByRole('status').textContent).toBe('Checking your wallet…');
    expect(screen.queryByRole('button')).toBeNull();
    cleanup();
    hookWith('paying');
    renderPay();
    expect(screen.getByRole('status').textContent).toBe('Paying from your wallet…');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows no fee row for a fee of ₿0, only Send', () => {
    const hook = hookWith('confirm', 0);
    renderPay();
    expect(screen.queryByText(/Fee/)).toBeNull();
    expect(screen.queryByText(/\$/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(hook.pay).toHaveBeenCalledTimes(1);
  });

  it('shows a fee above ₿0 with its fiat line before Send', () => {
    hookWith('confirm', 1_420);
    renderPay();
    expect(screen.getByText(/^Fee ₿1'420/, { selector: 'p' }).textContent).toBe(
      "Fee ₿1'420 · $1.42",
    );
    expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy();
  });

  it('says Pay and post with the amount and no fiat on the posting fee', () => {
    const hook = hookWith('confirm', 0);
    renderWithLocale(
      <WalletPay
        sparkInvoice="spark1x"
        pr="lnbc210n1x"
        amountSats={21}
        rateDay={RATE_DAY}
        postsOnPay
        flow="post_fee"
      />,
    );
    const button = screen.getByRole('button', { name: /^Pay ₿21 and post/ });
    expect(button.textContent).toBe('Pay ₿21 and post');
    expect(screen.queryByText(/Fee/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
    fireEvent.click(button);
    expect(hook.pay).toHaveBeenCalledTimes(1);
    cleanup();
    hookWith('confirm', 0);
    renderWithLocale(
      <WalletPay
        sparkInvoice="spark1x"
        pr="lnbc210n1x"
        amountSats={21}
        rateDay={null}
        postsOnPay
        flow="post_fee"
      />,
    );
    expect(screen.getByRole('button').textContent).toBe('Pay ₿21 and post');
  });

  it('uses the confirm label instead of Send when one is given', () => {
    const hook = hookWith('confirm', 0);
    renderWithLocale(
      <WalletPay
        sparkInvoice="spark1x"
        pr="lnbc210n1x"
        amountSats={21}
        rateDay={RATE_DAY}
        flow="reaction"
        confirmLabel={(amount) => `Lend ${amount}`}
      />,
    );
    const button = screen.getByRole('button', { name: 'Lend ₿21 · $0.02' });
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
    fireEvent.click(button);
    expect(hook.pay).toHaveBeenCalledTimes(1);
  });

  it('gives the confirm label the bitcoin amount alone when no rate is known', () => {
    hookWith('confirm', 0);
    renderWithLocale(
      <WalletPay
        sparkInvoice="spark1x"
        pr="lnbc210n1x"
        amountSats={21}
        rateDay={null}
        flow="reaction"
        confirmLabel={(amount) => `Send ${amount}`}
      />,
    );
    expect(screen.getByRole('button', { name: 'Send ₿21' }).textContent).toBe('Send ₿21');
  });

  it('keeps Send when no rate is known', () => {
    hookWith('confirm', 0);
    renderWithLocale(
      <WalletPay
        sparkInvoice="spark1x"
        pr="lnbc210n1x"
        amountSats={21}
        rateDay={null}
        flow="gift"
      />,
    );
    expect(screen.getByRole('button').textContent).toBe('Send');
  });

  it('says the balance is too low and offers Add Bitcoin, with no address and no QR', () => {
    hookWith('insufficient');
    renderPay();
    expect(screen.getByRole('alert').textContent).toBe(
      'Your wallet does not have enough Bitcoin for this payment.',
    );
    const add = screen.getByRole('button', { name: 'Add Bitcoin' });
    expect(add.className).toContain('w-full');
    expect(screen.queryByText('To add Bitcoin, send it to your address:')).toBeNull();
    expect(screen.queryByText(/^ada@/)).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText(/Still missing/)).toBeNull();
    fireEvent.click(add);
    expect(push).toHaveBeenCalledWith('/wallet?receive=1');
  });

  it('says how much is still missing, in ₿ and fiat, above Add Bitcoin', () => {
    hookWith('insufficient', 3, 1_234);
    renderPay();
    expect(screen.getByText(/^Still missing: ₿1'234/, { selector: 'p' }).textContent).toBe(
      "Still missing: ₿1'234 · $1.23",
    );
    expect(screen.getByRole('button', { name: 'Add Bitcoin' })).toBeTruthy();
    cleanup();
    hookWith('insufficient', 3, 1_234);
    renderWithLocale(
      <WalletPay
        sparkInvoice="spark1x"
        pr="lnbc210n1x"
        amountSats={21}
        rateDay={null}
        flow="gift"
      />,
    );
    expect(screen.getByText(/^Still missing/).textContent).toBe("Still missing: ₿1'234");
  });

  it('shows the neutral not-confirmed sentence', () => {
    hookWith('unconfirmed');
    renderPay();
    expect(screen.getByRole('status').textContent).toBe(
      'This payment is not confirmed yet. Check your balance again later.',
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  describe('in a pay sheet', () => {
    function inSheet(open: boolean): ReactElement {
      return (
        <Collapse show={open} holdMs={PAY_SHEET_HOLD_MS}>
          <PaySheet
            title="Send to Ana"
            amountSats={21}
            rateDay={RATE_DAY}
            successTitle="Sent to Ana"
            onClose={vi.fn()}
          >
            <WalletPay
              sparkInvoice="spark1x"
              pr="lnbc210n1x"
              amountSats={21}
              rateDay={RATE_DAY}
              flow="gift"
            />
          </PaySheet>
        </Collapse>
      );
    }

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each(['paying', 'unconfirmed'] as const)(
      'lets the sheet show its success step when the host closes a payment that went out (%s)',
      (view) => {
        hookWith(view, 0, null, 'paid');
        const rendered = renderWithLocale(inSheet(true));
        rendered.rerender(inSheet(false));
        act(() => {
          vi.advanceTimersByTime(MOTION_SWAP_FADE_MS);
        });
        expect(screen.getByRole('dialog').getAttribute('data-pay-sheet')).toBe('success');
      },
    );

    it('keeps the pay step while the send is pending when the host closes, and shows no success', () => {
      hookWith('paying', 0, null, 'pending');
      const rendered = renderWithLocale(inSheet(true));
      rendered.rerender(inSheet(false));
      act(() => {
        vi.advanceTimersByTime(MOTION_SWAP_FADE_MS);
      });
      expect(screen.getByRole('dialog').getAttribute('data-pay-sheet')).toBe('pay');
      expect(screen.queryByText('Sent to Ana')).toBeNull();
    });

    it('lets the sheet leave without a success step when no payment is out', () => {
      hookWith('confirm');
      const rendered = renderWithLocale(inSheet(true));
      rendered.rerender(inSheet(false));
      act(() => {
        vi.advanceTimersByTime(MOTION_SWAP_FADE_MS);
      });
      expect(screen.getByRole('dialog').getAttribute('data-pay-sheet')).toBe('pay');
      expect(screen.queryByText('Sent to Ana')).toBeNull();
    });
  });
});
