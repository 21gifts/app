import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletSend } from '@/components/WalletSend';
import { useLatestRateDay } from '@/hooks/useLatestRateDay';
import type { UseWalletSendResult, WalletSendState } from '@/hooks/useWalletSend';
import type { FiatRateDay } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/hooks/useLatestRateDay', () => ({ useLatestRateDay: vi.fn() }));

vi.mock('@/components/QrScanner', () => ({
  QrScanner: ({ onResult }: { onResult: (text: string) => void }) => (
    <button
      type="button"
      onClick={() => {
        onResult('lnbc1scanned');
      }}
    >
      Camera stub
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
    sending: false,
    text: '',
    setText: vi.fn(),
    comment: '',
    setComment: vi.fn(),
    submitInput: vi.fn(),
    submitAmount: vi.fn(),
    setSpeed: vi.fn(),
    confirm: vi.fn(),
    cancel: vi.fn(() => true),
    ...extra,
  };
}

/**
 * {@link WalletSend} with the manual-entry sheet state its page holds.
 *
 * @param props - Send flow, readiness, and whether the sheet starts open.
 * @returns The send view.
 */
function SendHarness({
  send,
  walletReady,
  manual = false,
}: {
  send: UseWalletSendResult;
  walletReady?: boolean;
  manual?: boolean;
}): ReactElement {
  const [manualEntry, setManualEntry] = useState(manual);
  return (
    <WalletSend
      send={send}
      {...(walletReady === undefined ? {} : { walletReady })}
      manualEntry={manualEntry}
      onManualEntry={setManualEntry}
    />
  );
}

function renderSend(send: UseWalletSendResult, manual = false): void {
  renderWithLocale(<SendHarness send={send} manual={manual} />);
}

/** Stubs `navigator.clipboard.readText`. */
function stubClipboard(readText: () => Promise<string>): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { readText: vi.fn(readText) },
  });
}

beforeEach(() => {
  vi.mocked(useLatestRateDay).mockReset().mockReturnValue(RATE_DAY);
  useAuthStore.setState({ session: 'token', account: null });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('WalletSend input', () => {
  it('is a full-size camera layer with Paste and Enter manually, and no field until asked', () => {
    renderSend(sendWith({ step: 'input', error: null }));
    const layer = screen.getByRole('region', { name: 'Send Bitcoin' });
    expect(layer.hasAttribute('data-port-fill')).toBe(true);
    expect(layer.className).toContain('absolute inset-0');
    expect(layer.className).toContain('bg-black');
    expect(within(layer).getByRole('button', { name: 'Camera stub' })).toBeTruthy();
    for (const name of ['Paste', 'Enter manually']) {
      const button = within(layer).getByRole('button', { name });
      expect(button.className).toContain('bg-black/55');
      expect(button.className).toContain('min-h-12');
    }
    expect(screen.queryByLabelText('Payment request or address')).toBeNull();
    expect(screen.queryByText('Send Bitcoin')).toBeNull();
  });

  it('opens the manual sheet with the field and a disabled Continue while blank, and its Close returns to the camera', () => {
    const send = sendWith({ step: 'input', error: null });
    renderSend(send);
    fireEvent.click(screen.getByRole('button', { name: 'Enter manually' }));
    const field = screen.getByLabelText('Payment request or address');
    expect(field.getAttribute('placeholder')).toBe('Paste a Bitcoin payment request or address');
    expect(document.activeElement).toBe(field);
    expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.queryByRole('button', { name: 'Camera stub' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Paste' })).toBeNull();
    fireEvent.change(field, { target: { value: 'lnbc1' } });
    expect(send.setText).toHaveBeenCalledWith('lnbc1');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Payment request or address')).toBeNull();
    expect(screen.getByRole('button', { name: 'Camera stub' })).toBeTruthy();
  });

  it('gives the focus back to Enter manually when the sheet closes', () => {
    renderSend(sendWith({ step: 'input', error: null }));
    fireEvent.click(screen.getByRole('button', { name: 'Enter manually' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Enter manually' }));
  });

  it('submits the typed text from the sheet', () => {
    const send = sendWith({ step: 'input', error: null }, { text: 'lnbc1' });
    renderSend(send, true);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(send.submitInput).toHaveBeenCalledTimes(1);
  });

  it('disables the field and Continue in the sheet while busy', () => {
    renderSend(sendWith({ step: 'input', error: null }, { text: 'lnbc1', busy: true }), true);
    expect((screen.getByLabelText('Payment request or address') as HTMLInputElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('shows a spinner over the camera area and disables the floating buttons while busy', () => {
    const { container } = renderWithLocale(
      <SendHarness send={sendWith({ step: 'input', error: null }, { busy: true })} />,
    );
    expect(container.querySelector('[data-port-fill] .animate-spin')).not.toBeNull();
    expect((screen.getByRole('button', { name: 'Paste' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByRole('button', { name: 'Enter manually' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it.each([
    ['invalid', 'This is not a Bitcoin payment request or address.'],
    ['unreachable', 'The receiver could not be reached from this browser. Please try again later.'],
    ['unsupported', 'This payment request cannot be paid from your wallet yet.'],
    ['insufficient', 'Your wallet does not have enough Bitcoin for this payment.'],
    ['failed', 'The payment could not be sent. Check your balance before you try again.'],
    ['notPayable', 'This address cannot receive a payment.'],
    ['notFound', 'This address was not found.'],
    ['relayUnreachable', "The receiver's server did not answer. Please try again later."],
    ['notReady', 'Your wallet is not ready yet. Please try again in a moment.'],
    ['unreadable', 'This could not be read. Please try again.'],
  ] as const)('shows the %s alert over the camera area with Try again', (error, text) => {
    const send = sendWith({ step: 'input', error });
    renderSend(send);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe(text);
    expect(alert.className).toContain('text-white');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(send.setText).toHaveBeenCalledWith('');
  });

  it('shows the alert under the field while the sheet is open', () => {
    renderSend(sendWith({ step: 'input', error: 'invalid' }, { text: 'nope' }), true);
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('text-app-danger');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('shows only the alert, without the camera, while the wallet is not ready', () => {
    renderWithLocale(
      <SendHarness send={sendWith({ step: 'input', error: 'notReady' })} walletReady={false} />,
    );
    expect(screen.getByRole('alert').textContent).toBe(
      'Your wallet is not ready yet. Please try again in a moment.',
    );
    expect(document.querySelector('[data-port-fill]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Paste' })).toBeNull();
    expect(screen.getByText('Send Bitcoin')).toBeTruthy();
  });
});

describe('WalletSend paste', () => {
  it('puts the clipboard text into the field and submits it once, like a scan', async () => {
    stubClipboard(() => Promise.resolve('lnbc1pasted'));
    const send = sendWith({ step: 'input', error: null });
    const view = renderWithLocale(<SendHarness send={send} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Paste' }));
    });
    expect(send.setText).toHaveBeenCalledWith('lnbc1pasted');
    expect(screen.queryByRole('button', { name: 'Camera stub' })).toBeNull();
    view.rerender(<SendHarness send={{ ...send, text: 'lnbc1pasted' }} />);
    expect(send.submitInput).toHaveBeenCalledTimes(1);
    view.rerender(<SendHarness send={{ ...send, text: 'lnbc1pasted' }} />);
    expect(send.submitInput).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'denied',
      () => Promise.reject(new Error('denied')),
      'Pasting was not allowed. Use Enter manually instead.',
    ],
    ['empty', () => Promise.resolve('  '), 'The clipboard is empty.'],
  ] as const)(
    'shows a short alert over the running camera when the clipboard is %s',
    async (_label, readText, text) => {
      vi.useFakeTimers();
      stubClipboard(readText);
      const send = sendWith({ step: 'input', error: null });
      renderSend(send);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Paste' }));
      });
      expect(screen.getByRole('alert').textContent).toBe(text);
      expect(screen.getByRole('button', { name: 'Camera stub' })).toBeTruthy();
      expect(send.setText).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(4_000);
      });
      expect(screen.queryByRole('alert')).toBeNull();
    },
  );

  it('drops a clipboard read that settles after the sheet opened or the view closed', async () => {
    let finish: (value: string) => void = () => undefined;
    let fail: (reason: Error) => void = () => undefined;
    stubClipboard(
      vi
        .fn()
        .mockReturnValueOnce(
          new Promise<string>((resolve) => {
            finish = resolve;
          }),
        )
        .mockReturnValueOnce(
          new Promise<string>((_resolve, reject) => {
            fail = reject;
          }),
        ),
    );
    const send = sendWith({ step: 'input', error: null });
    const view = renderWithLocale(<SendHarness send={send} />);
    fireEvent.click(screen.getByRole('button', { name: 'Paste' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enter manually' }));
    await act(async () => {
      finish('lnbc1late');
    });
    expect(send.setText).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Paste' }));
    view.unmount();
    await act(async () => {
      fail(new Error('denied'));
    });
    expect(send.setText).not.toHaveBeenCalled();
  });

  it('clears the clipboard alert when Enter manually opens the sheet', async () => {
    stubClipboard(() => Promise.resolve(''));
    renderSend(sendWith({ step: 'input', error: null }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Paste' }));
    });
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Enter manually' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('WalletSend camera', () => {
  it('runs the camera inside the full-size layer while the input step is idle', () => {
    renderSend(sendWith({ step: 'input', error: null }));
    const camera = screen.getByRole('button', { name: 'Camera stub' });
    expect(camera.closest('[data-port-fill]')).not.toBeNull();
  });

  it('puts the scanned text into the field as a paste and submits it once', () => {
    const send = sendWith({ step: 'input', error: null });
    const view = renderWithLocale(<SendHarness send={send} />);
    fireEvent.click(screen.getByRole('button', { name: 'Camera stub' }));
    expect(send.setText).toHaveBeenCalledWith('lnbc1scanned');
    expect(screen.queryByRole('button', { name: 'Camera stub' })).toBeNull();
    expect(send.submitInput).not.toHaveBeenCalled();
    const pasted = { ...send, text: 'lnbc1scanned' };
    view.rerender(<SendHarness send={pasted} />);
    expect(send.submitInput).toHaveBeenCalledTimes(1);
    view.rerender(<SendHarness send={{ ...pasted, busy: true }} />);
    expect(screen.queryByRole('button', { name: 'Camera stub' })).toBeNull();
    view.rerender(<SendHarness send={pasted} />);
    expect(send.submitInput).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Camera stub' })).toBeTruthy();
  });

  it('keeps the camera off after a scan until the flow moves on or the field is edited', () => {
    const send = sendWith({ step: 'input', error: null });
    const view = renderWithLocale(<SendHarness send={send} />);
    fireEvent.click(screen.getByRole('button', { name: 'Camera stub' }));
    const pasted = { ...send, text: 'lnbc1scanned' };
    view.rerender(<SendHarness send={pasted} />);
    view.rerender(<SendHarness send={{ ...pasted }} />);
    expect(send.submitInput).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Camera stub' })).toBeNull();
    view.rerender(<SendHarness send={{ ...pasted, text: 'lnbc1scanned2' }} />);
    expect(screen.getByRole('button', { name: 'Camera stub' })).toBeTruthy();
    expect(send.submitInput).toHaveBeenCalledTimes(1);
  });

  it('starts the camera again when the input step returns after a scan', () => {
    const send = sendWith({ step: 'input', error: null });
    const view = renderWithLocale(<SendHarness send={send} />);
    fireEvent.click(screen.getByRole('button', { name: 'Camera stub' }));
    view.rerender(<SendHarness send={{ ...send, text: 'lnbc1scanned' }} />);
    view.rerender(<SendHarness send={{ ...send, text: 'lnbc1scanned', state: LNURL_STATE }} />);
    view.rerender(<SendHarness send={{ ...send, text: 'lnbc1scanned' }} />);
    expect(screen.getByRole('button', { name: 'Camera stub' })).toBeTruthy();
    expect(send.submitInput).toHaveBeenCalledTimes(1);
  });

  it('waits for the field to hold the scanned text before submitting', () => {
    const send = sendWith({ step: 'input', error: null }, { text: 'typed' });
    const view = renderWithLocale(<SendHarness send={send} />);
    fireEvent.click(screen.getByRole('button', { name: 'Camera stub' }));
    view.rerender(<SendHarness send={{ ...send, text: 'other' }} />);
    expect(send.submitInput).not.toHaveBeenCalled();
  });

  it('stops the camera while busy, while an alert shows, and outside the input step', () => {
    const view = renderWithLocale(
      <SendHarness send={sendWith({ step: 'input', error: null }, { busy: true })} />,
    );
    expect(screen.queryByRole('button', { name: 'Camera stub' })).toBeNull();
    view.rerender(<SendHarness send={sendWith({ step: 'input', error: 'invalid' })} />);
    expect(screen.queryByRole('button', { name: 'Camera stub' })).toBeNull();
    for (const state of [
      LNURL_STATE,
      { step: 'confirm', recipient: 'bob@pay.example', amountSats: 21, feeSats: 0 },
      { step: 'sent', amountSats: 21, recipient: 'bob@pay.example' },
    ] as const) {
      view.rerender(<SendHarness send={sendWith(state)} />);
      expect(screen.queryByRole('button', { name: 'Camera stub' })).toBeNull();
    }
    view.rerender(<SendHarness send={sendWith({ step: 'input', error: null })} />);
    expect(screen.getByRole('button', { name: 'Camera stub' })).toBeTruthy();
  });
});

describe('WalletSend amount', () => {
  it('shows recipient, bounds, and comment for a receiver that takes one, and submits sats', () => {
    const send = sendWith(LNURL_STATE);
    renderSend(send);
    expect(screen.getByText('To bob@pay.example')).toBeTruthy();
    expect(screen.getByText("Between ₿10 · $0.01 and ₿1'000 · $1.00")).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Message (optional)'), { target: { value: 'Hi' } });
    expect(send.setComment).toHaveBeenCalledWith('Hi');
    expect(screen.getByLabelText('Message (optional)').getAttribute('maxlength')).toBe('140');
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(send.submitAmount).toHaveBeenCalledWith(100);
  });

  it('shows bounds and comment for an outside address, and the comment alert', () => {
    const send = sendWith({
      step: 'amount',
      target: {
        type: 'relay',
        target: 'bob@example.com',
        minSats: 10,
        maxSats: 1_000,
        commentMaxLength: 5,
        recipient: 'bob@example.com',
      },
      amountError: false,
      commentError: true,
    });
    renderSend(send);
    expect(screen.getByText('To bob@example.com')).toBeTruthy();
    expect(screen.getByText("Between ₿10 · $0.01 and ₿1'000 · $1.00")).toBeTruthy();
    expect(screen.getByLabelText('Message (optional)').getAttribute('maxlength')).toBe('5');
    expect(screen.getByRole('alert').textContent).toBe(
      'This message is too long for the receiver.',
    );
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
    expect(screen.getByRole('alert').textContent).toBe(
      "Enter an amount between ₿10 · $0.01 and ₿1'000 · $1.00.",
    );
    expect(screen.queryByText('Cancel')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(send.cancel).toHaveBeenCalledTimes(1);
  });

  it('shows the bounds in bitcoin only without a usable rate', () => {
    vi.mocked(useLatestRateDay).mockReturnValue(null);
    renderSend(sendWith(LNURL_STATE));
    expect(screen.getByText("Between ₿10 and ₿1'000")).toBeTruthy();
  });

  it('shows only the minimum in the amount alert for a request without receiver bounds', () => {
    renderSend(
      sendWith({
        step: 'amount',
        target: { type: 'request', input: 'sp1', amountSats: null, recipient: 'sp1' },
        amountError: true,
      }),
    );
    expect(screen.getByRole('alert').textContent).toBe('Enter an amount of at least ₿1 · $0.00.');
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
    expect(
      within(screen.getByRole('group', { name: 'Bitcoin or fiat' }))
        .getByRole('button', { name: 'USD' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });
});

const ONCHAIN_TARGET = {
  type: 'onchain' as const,
  address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
  amountSats: null,
  recipient: 'bc1qar0srr…wf5mdq',
};

function onchainState(
  extra: { speed?: 'fast' | 'medium' | 'slow'; spendableFeeSats?: number; renewed?: true } = {},
): WalletSendState {
  const fees = { fast: 2_840, medium: 1_420, slow: 710 };
  const speed = extra.speed ?? 'medium';
  return {
    step: 'confirm',
    recipient: ONCHAIN_TARGET.recipient,
    amountSats: 50_000,
    feeSats: fees[speed],
    onchain: {
      fees,
      spendableFeeSats: extra.spendableFeeSats ?? 950_000,
      speed,
      ...(extra.renewed === undefined ? {} : { renewed: extra.renewed }),
    },
  };
}

describe('WalletSend base-chain address', () => {
  it('asks for an amount without bounds or a message, and names the SDK minimum', () => {
    const { rerender } = renderWithLocale(
      <SendHarness
        send={sendWith({ step: 'amount', target: ONCHAIN_TARGET, amountError: false })}
      />,
    );
    expect(screen.getByText('To bc1qar0srr…wf5mdq')).toBeTruthy();
    expect(screen.queryByText(/^Between /)).toBeNull();
    expect(screen.queryByLabelText('Message (optional)')).toBeNull();
    rerender(
      <SendHarness
        send={sendWith({
          step: 'amount',
          target: { ...ONCHAIN_TARGET, minSats: 294 },
          amountError: true,
        })}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Enter an amount of at least ₿294 · $0.29.');
  });

  it('confirms in the large layout with one row per speed, the fee, the total, and the fee hint', () => {
    const send = sendWith(onchainState());
    renderSend(send);
    const region = screen.getByRole('region', { name: 'Send Bitcoin' });
    expect(within(region).getByText("₿50'000")).toBeTruthy();
    expect(within(region).getByText('$50.00')).toBeTruthy();
    expect(within(region).getByText('To bc1qar0srr…wf5mdq')).toBeTruthy();
    const speeds = within(region).getByRole('group', { name: 'Speed' });
    const buttons = within(speeds).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Fast₿2'840 · $2.84",
      "Medium₿1'420 · $1.42",
      'Slow₿710 · $0.71',
    ]);
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
    ]);
    expect(within(region).getByText(/^Fee ₿1'420/).textContent).toBe("Fee ₿1'420 · $1.42");
    expect(within(region).getByText(/^Total /).textContent).toBe("Total ₿51'420 · $51.42");
    expect(
      within(region).getByText(
        'A payment to a Bitcoin address pays a network fee. It is much higher than the fee of other payments.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(within(speeds).getByRole('button', { name: /^Fast/ }));
    expect(send.setSpeed).toHaveBeenCalledWith('fast');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(send.confirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(send.cancel).toHaveBeenCalledTimes(1);
  });

  it('disables a speed the balance does not cover and says why', () => {
    renderSend(sendWith(onchainState({ spendableFeeSats: 2_000 })));
    const fast = screen.getByRole('button', { name: /^Fast/ }) as HTMLButtonElement;
    expect(fast.disabled).toBe(true);
    expect(fast.textContent).toContain('Balance too low');
    expect((screen.getByRole('button', { name: /^Medium/ }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('says a renewed quote replaced an expired one', () => {
    renderSend(sendWith(onchainState({ renewed: true })));
    expect(screen.getByRole('alert').textContent).toBe(
      'The fee offer expired, so nothing was sent. Check the new fee and press Send again.',
    );
  });

  it('keeps Cancel usable while an expired quote is renewed', () => {
    const send = sendWith(onchainState({ renewed: true }), { busy: true, sending: false });
    renderSend(send);
    expect((screen.getByRole('button', { name: /^Send$/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    const cancel = screen.getByRole('button', { name: /^Cancel$/ }) as HTMLButtonElement;
    expect(cancel.disabled).toBe(false);
    fireEvent.click(cancel);
    expect(send.cancel).toHaveBeenCalledTimes(1);
  });

  it('disables the speeds, Send, and Cancel while sending', () => {
    renderSend(sendWith(onchainState({ speed: 'fast' }), { busy: true, sending: true }));
    for (const name of [/^Fast/, /^Medium/, /^Slow/, /^Send$/, /^Cancel$/]) {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect(screen.getByText(/^Total /).textContent).toBe("Total ₿52'840 · $52.84");
  });

  it('shows only bitcoin without a usable rate', () => {
    vi.mocked(useLatestRateDay).mockReturnValue(null);
    renderSend(sendWith(onchainState()));
    expect(screen.getByRole('button', { name: /^Slow/ }).textContent).toBe('Slow₿710');
    expect(screen.getByText(/^Fee /).textContent).toBe("Fee ₿1'420");
    expect(screen.getByText(/^Total /).textContent).toBe("Total ₿51'420");
  });
});

describe('WalletSend confirm and sent', () => {
  it('shows the large amount with fiat, recipient, and a fee of zero without fiat, and sends', () => {
    const send = sendWith({
      step: 'confirm',
      recipient: 'bob@pay.example',
      amountSats: 2_100,
      feeSats: 0,
    });
    renderSend(send);
    expect(screen.getByText("₿2'100").className).toContain('text-5xl');
    expect(screen.getByText('$2.10')).toBeTruthy();
    expect(screen.queryByText(/Send ₿/)).toBeNull();
    expect(screen.getByText('To bob@pay.example').className).toContain('truncate');
    expect(screen.getByText('Fee ₿0').textContent).toBe('Fee ₿0');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(send.confirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(send.cancel).toHaveBeenCalledTimes(1);
  });

  it('shows the fiat of a fee above zero', () => {
    renderSend(
      sendWith({ step: 'confirm', recipient: 'shop@21.gifts', amountSats: 7_000, feeSats: 3_000 }),
    );
    expect(screen.getByText(/Fee ₿3'000/).textContent).toContain('$3.00');
  });

  it('shows only the bitcoin figures without a usable rate', () => {
    vi.mocked(useLatestRateDay).mockReturnValue(null);
    renderSend(
      sendWith({ step: 'confirm', recipient: 'bob@pay.example', amountSats: 2_100, feeSats: 3 }),
    );
    expect(screen.getByText("₿2'100")).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('has no step Close, and disables Send with a spinner and Cancel while sending', () => {
    const send = sendWith(
      { step: 'confirm', recipient: 'r', amountSats: 1, feeSats: 0 },
      { busy: true, sending: true },
    );
    const { container } = renderWithLocale(<SendHarness send={send} />);
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('.animate-spin')).not.toBeNull();
    const cancel = screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement;
    expect(cancel.textContent).toBe('Cancel');
    expect(cancel.disabled).toBe(true);
    fireEvent.click(cancel);
    expect(send.cancel).not.toHaveBeenCalled();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('shows the check, the sent amount with fiat and recipient, and Done returns to input', () => {
    const send = sendWith({ step: 'sent', amountSats: 2_100, recipient: 'bob@pay.example' });
    const { container } = renderWithLocale(<SendHarness send={send} />);
    expect(container.querySelector('svg.text-app-success')).not.toBeNull();
    const status = screen.getByRole('status');
    expect(within(status).getByText("Sent ₿2'100").className).toContain('text-5xl');
    expect(within(status).getByText('$2.10')).toBeTruthy();
    expect(screen.getByText('To bob@pay.example')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(send.cancel).toHaveBeenCalledTimes(1);
  });
});
