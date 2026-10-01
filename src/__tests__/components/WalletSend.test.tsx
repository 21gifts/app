import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletSend } from '@/components/WalletSend';
import { useLatestRateDay } from '@/hooks/useLatestRateDay';
import type { UseWalletSendResult, WalletSendState } from '@/hooks/useWalletSend';
import type { FiatRateDay } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/hooks/useLatestRateDay', () => ({ useLatestRateDay: vi.fn() }));

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

const LNURL_STATE: WalletSendState = {
  step: 'amount',
  target: {
    type: 'lnurl',
    request: { details: null },
    minSats: 10,
    maxSats: 1_000,
    commentMaxLength: 140,
    recipient: 'bob@pay.example',
  },
  amountError: false,
};

function sendWith(
  state: WalletSendState,
  extra: Partial<UseWalletSendResult> = {},
): UseWalletSendResult {
  return {
    state,
    busy: false,
    text: '',
    setText: vi.fn(),
    comment: '',
    setComment: vi.fn(),
    submitInput: vi.fn(),
    submitAmount: vi.fn(),
    confirm: vi.fn(),
    cancel: vi.fn(() => true),
    ...extra,
  };
}

function renderSend(send: UseWalletSendResult): void {
  renderWithLocale(<WalletSend send={send} />);
}

beforeEach(() => {
  vi.mocked(useLatestRateDay).mockReset().mockReturnValue(RATE_DAY);
  useAuthStore.setState({ session: 'token', account: null });
});

afterEach(cleanup);

describe('WalletSend input', () => {
  it('is a named region with the paste field and a disabled Continue while blank', () => {
    const send = sendWith({ step: 'input', error: null });
    renderSend(send);
    expect(screen.getByRole('region', { name: 'Send Bitcoin' })).toBeTruthy();
    const field = screen.getByLabelText('Payment request or address');
    expect(field.getAttribute('placeholder')).toBe('Paste a Bitcoin payment request or address');
    expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.change(field, { target: { value: 'lnbc1' } });
    expect(send.setText).toHaveBeenCalledWith('lnbc1');
  });

  it('submits the text', () => {
    const send = sendWith({ step: 'input', error: null }, { text: 'lnbc1' });
    renderSend(send);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(send.submitInput).toHaveBeenCalledTimes(1);
  });

  it('disables the field and Continue while busy', () => {
    renderSend(sendWith({ step: 'input', error: null }, { text: 'lnbc1', busy: true }));
    expect((screen.getByLabelText('Payment request or address') as HTMLInputElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it.each([
    ['invalid', 'This is not a Bitcoin payment request or address.'],
    ['unreachable', 'The receiver could not be reached from this browser. Please try again later.'],
    ['onchain', 'Sending to this kind of Bitcoin address is not supported yet.'],
    ['unsupported', 'This payment request cannot be paid from your wallet yet.'],
    ['insufficient', 'Your wallet does not have enough Bitcoin for this payment.'],
    ['failed', 'The payment could not be sent. Check your balance before you try again.'],
  ] as const)('shows the %s alert', (error, text) => {
    renderSend(sendWith({ step: 'input', error }));
    expect(screen.getByRole('alert').textContent).toBe(text);
  });
});

describe('WalletSend amount', () => {
  it('shows recipient, bounds, and comment for a receiver that takes one, and submits sats', () => {
    const send = sendWith(LNURL_STATE);
    renderSend(send);
    expect(screen.getByText('To bob@pay.example')).toBeTruthy();
    expect(screen.getByText("Between ₿10 and ₿1'000")).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Message (optional)'), { target: { value: 'Hi' } });
    expect(send.setComment).toHaveBeenCalledWith('Hi');
    expect(screen.getByLabelText('Message (optional)').getAttribute('maxlength')).toBe('140');
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(send.submitAmount).toHaveBeenCalledWith(100);
  });

  it('submits null for an amount that cannot be read', () => {
    const send = sendWith(LNURL_STATE);
    renderSend(send);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(send.submitAmount).toHaveBeenCalledWith(null);
  });

  it('shows the amount alert, and Cancel closes the step', () => {
    const send = sendWith({ ...LNURL_STATE, amountError: true } as WalletSendState);
    renderSend(send);
    expect(screen.getByRole('alert').textContent).toBe("Enter an amount between ₿10 and ₿1'000.");
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(send.cancel).toHaveBeenCalledTimes(1);
  });

  it('has no bounds line or comment for a request without amount', () => {
    renderSend(
      sendWith({
        step: 'amount',
        target: { type: 'request', input: 'sp1', amountSats: null, recipient: 'sp1' },
        amountError: false,
      }),
    );
    expect(screen.getByText('To sp1')).toBeTruthy();
    expect(screen.queryByText(/^Between/)).toBeNull();
    expect(screen.queryByLabelText('Message (optional)')).toBeNull();
  });

  it('has no comment when the receiver takes none, and starts in the account unit', () => {
    useAuthStore.setState({ account: { amountUnit: 'fiat' } as never });
    renderSend(
      sendWith({
        ...LNURL_STATE,
        target: {
          ...(LNURL_STATE.step === 'amount' ? LNURL_STATE.target : ({} as never)),
          commentMaxLength: 0,
        },
      } as WalletSendState),
    );
    expect(screen.queryByLabelText('Message (optional)')).toBeNull();
  });
});

describe('WalletSend confirm and sent', () => {
  it('shows recipient, amount and fee with fiat, and sends', () => {
    const send = sendWith({
      step: 'confirm',
      recipient: 'bob@pay.example',
      amountSats: 2_100,
      feeSats: 0,
    });
    renderSend(send);
    expect(screen.getByText('To bob@pay.example')).toBeTruthy();
    expect(screen.getByText(/Send ₿2'100/)).toBeTruthy();
    expect(screen.getByText(/\$2\.10/)).toBeTruthy();
    expect(screen.getByText(/Fee ₿0/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(send.confirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(send.cancel).toHaveBeenCalledTimes(1);
  });

  it('disables Send with a spinner while sending', () => {
    const { container } = renderWithLocale(
      <WalletSend
        send={sendWith(
          { step: 'confirm', recipient: 'r', amountSats: 1, feeSats: 0 },
          { busy: true },
        )}
      />,
    );
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });

  it('shows the sent amount and Done returns to input', () => {
    const send = sendWith({ step: 'sent', amountSats: 2_100 });
    renderSend(send);
    expect(screen.getByRole('status').textContent).toContain("Sent ₿2'100");
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(send.cancel).toHaveBeenCalledTimes(1);
  });
});
