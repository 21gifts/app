import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DonateForm } from '@/components/DonateForm';
import { LocaleProvider } from '@/components/LocaleProvider';
import { resolveLightningAddress } from '@/lib/api';
import type { LnAddressResolved } from '@/lib/api-types';
import { requestDonateInvoice } from '@/lib/lnurl-pay';
import { getCatalog } from '@/lib/messages';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  resolveLightningAddress: vi.fn(),
}));

vi.mock('@/lib/lnurl-pay', async () => {
  const actual = await vi.importActual<typeof import('@/lib/lnurl-pay')>('@/lib/lnurl-pay');
  return {
    ...actual,
    requestDonateInvoice: vi.fn(),
  };
});

const resolved: LnAddressResolved = {
  address: 'me@walletofsatoshi.com',
  callback: 'https://walletofsatoshi.com/lnurlp/callback',
  minSendable: 1000,
  maxSendable: 100_000_000,
};

const ORIGINAL_UA = window.navigator.userAgent;

afterEach(() => {
  cleanup();
  Object.defineProperty(window.navigator, 'userAgent', {
    value: ORIGINAL_UA,
    configurable: true,
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});

function fillForm(address = 'me@walletofsatoshi.com', amount = '21'): void {
  fireEvent.change(screen.getByPlaceholderText('you@walletofsatoshi.com'), {
    target: { value: address },
  });
  fireEvent.change(screen.getByPlaceholderText('21'), {
    target: { value: amount },
  });
}

describe('DonateForm', () => {
  it('renders the idle form', () => {
    renderWithLocale(<DonateForm />);
    expect(screen.getByRole('heading', { name: 'Send Bitcoin' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Lightning/i);
    expect(document.body.textContent).not.toMatch(/\binvoice\b/i);
  });

  it('asks for an address when the field is empty', () => {
    renderWithLocale(<DonateForm />);
    fillForm('   ', '21');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a Wallet of Satoshi address');
  });

  it('asks for an amount when the field is empty', () => {
    renderWithLocale(<DonateForm />);
    fillForm('me@walletofsatoshi.com', '');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert').textContent).toBe(
      'Enter a whole number of sats greater than zero',
    );
  });

  it('rejects a non-integer amount', () => {
    renderWithLocale(<DonateForm />);
    fillForm('me@walletofsatoshi.com', '1.5');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert').textContent).toBe(
      'Enter a whole number of sats greater than zero',
    );
  });

  it('rejects an amount that is not a safe integer', () => {
    renderWithLocale(<DonateForm />);
    fillForm('me@walletofsatoshi.com', '9007199254740993');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert').textContent).toBe(
      'Enter a whole number of sats greater than zero',
    );
  });

  it('rejects a zero amount', () => {
    renderWithLocale(<DonateForm />);
    fillForm('me@walletofsatoshi.com', '0');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert').textContent).toBe(
      'Enter a whole number of sats greater than zero',
    );
  });

  it('shows the invoice QR after a successful resolve and invoice fetch', async () => {
    vi.mocked(resolveLightningAddress).mockResolvedValue(resolved);
    vi.mocked(requestDonateInvoice).mockResolvedValue('lnbc21u1ptest');
    renderWithLocale(<DonateForm />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText(/Pay 21 sats to me@walletofsatoshi.com/)).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Bitcoin payment QR code' })).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Open Wallet of Satoshi' });
    expect(link.getAttribute('href')).toBe('walletofsatoshi:lightning:LNBC21U1PTEST');
    expect(resolveLightningAddress).toHaveBeenCalledWith('me@walletofsatoshi.com');
    expect(requestDonateInvoice).toHaveBeenCalledWith({
      callback: resolved.callback,
      amountMsat: 21_000,
    });
  });

  it('pins Wallet of Satoshi via Android intent on the payment QR', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)',
      configurable: true,
    });
    vi.mocked(resolveLightningAddress).mockResolvedValue(resolved);
    vi.mocked(requestDonateInvoice).mockResolvedValue('lnbc21u1ptest');
    renderWithLocale(<DonateForm />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const link = await screen.findByRole('link', { name: 'Open Wallet of Satoshi' });
    expect(link.getAttribute('href')).toBe(
      'intent:lightning:LNBC21U1PTEST#Intent;scheme=walletofsatoshi;package=com.livingroomofsatoshi.wallet;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.livingroomofsatoshi.wallet;end',
    );
  });

  it('uses the singular sat label for a one-sat gift', async () => {
    vi.mocked(resolveLightningAddress).mockResolvedValue(resolved);
    vi.mocked(requestDonateInvoice).mockResolvedValue('lnbc10n1ptest');
    renderWithLocale(<DonateForm />);
    fillForm('me@walletofsatoshi.com', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText(/Pay 1 sat to me@walletofsatoshi.com/)).toBeTruthy();
  });

  it('rejects an amount outside the provider bounds', async () => {
    vi.mocked(resolveLightningAddress).mockResolvedValue({
      ...resolved,
      minSendable: 5000,
      maxSendable: 10_000,
    });
    renderWithLocale(<DonateForm />);
    fillForm('me@walletofsatoshi.com', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'This address accepts 5 sats – 10 sats.',
    );
    expect(requestDonateInvoice).not.toHaveBeenCalled();
  });

  it('rejects an amount above the provider maximum', async () => {
    vi.mocked(resolveLightningAddress).mockResolvedValue({
      ...resolved,
      minSendable: 1000,
      maxSendable: 2000,
    });
    renderWithLocale(<DonateForm />);
    fillForm('me@walletofsatoshi.com', '21');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'This address accepts 1 sat – 2 sats.',
    );
  });

  it('surfaces an invoice fetch error', async () => {
    vi.mocked(resolveLightningAddress).mockResolvedValue(resolved);
    vi.mocked(requestDonateInvoice).mockRejectedValue(
      new Error('Could not start the Bitcoin payment'),
    );
    renderWithLocale(<DonateForm />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Could not start the Bitcoin payment',
    );
  });

  it('surfaces a resolve or invoice error', async () => {
    vi.mocked(resolveLightningAddress).mockRejectedValue(
      new Error('Enter an address like you@walletofsatoshi.com'),
    );
    renderWithLocale(<DonateForm />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Could not start the Bitcoin payment',
    );
  });

  it('surfaces a non-Error throw as the request error', async () => {
    vi.mocked(resolveLightningAddress).mockRejectedValue('boom');
    renderWithLocale(<DonateForm />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Could not start the Bitcoin payment',
    );
  });

  it('retranslates a request error after the locale catalog changes', async () => {
    vi.mocked(resolveLightningAddress).mockRejectedValue(
      new Error('Could not start the Bitcoin payment'),
    );
    const { rerender } = renderWithLocale(<DonateForm />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Could not start the Bitcoin payment',
    );
    rerender(
      <LocaleProvider locale="de" messages={getCatalog('de')}>
        <DonateForm />
      </LocaleProvider>,
    );
    expect(screen.getByRole('alert')).toHaveProperty(
      'textContent',
      'Die Bitcoin-Zahlung konnte nicht gestartet werden',
    );
  });

  it('returns to the form from the paying view', async () => {
    vi.mocked(resolveLightningAddress).mockResolvedValue(resolved);
    vi.mocked(requestDonateInvoice).mockResolvedValue('lnbc21u1ptest');
    renderWithLocale(<DonateForm />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
  });

  it('ignores a second submit while a request is in flight', async () => {
    let finish!: (value: LnAddressResolved) => void;
    const resolveMock = vi.fn(
      () =>
        new Promise<LnAddressResolved>((resolve) => {
          finish = resolve;
        }),
    );
    vi.mocked(resolveLightningAddress).mockImplementation(resolveMock);
    vi.mocked(requestDonateInvoice).mockResolvedValue('lnbc21u1ptest');
    renderWithLocale(<DonateForm />);
    fillForm();
    const form = screen.getByRole('button', { name: 'Continue' }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);
    fireEvent.submit(form as HTMLFormElement);
    expect(resolveMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish(resolved);
    });
    expect(await screen.findByRole('img', { name: 'Bitcoin payment QR code' })).toBeTruthy();
  });

  it('drops a late result after cancel during resolve', async () => {
    let finish!: (value: LnAddressResolved) => void;
    vi.mocked(resolveLightningAddress).mockImplementation(
      () =>
        new Promise<LnAddressResolved>((resolve) => {
          finish = resolve;
        }),
    );
    renderWithLocale(<DonateForm />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => {
      finish(resolved);
    });
    await waitFor(() => {
      expect(screen.queryByRole('img', { name: 'Bitcoin payment QR code' })).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
  });

  it('drops a late invoice after cancel during invoice fetch', async () => {
    vi.mocked(resolveLightningAddress).mockResolvedValue(resolved);
    let finish!: (value: string) => void;
    vi.mocked(requestDonateInvoice).mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    renderWithLocale(<DonateForm />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => {
      finish('lnbc21u1ptest');
    });
    await waitFor(() => {
      expect(screen.queryByRole('img', { name: 'Bitcoin payment QR code' })).toBeNull();
    });
  });

  it('drops a late error after cancel', async () => {
    let fail!: (reason: Error) => void;
    vi.mocked(resolveLightningAddress).mockImplementation(
      () =>
        new Promise<LnAddressResolved>((_resolve, reject) => {
          fail = reject;
        }),
    );
    renderWithLocale(<DonateForm />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => {
      fail(new Error('too late'));
    });
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('drops a late bounds error after cancel', async () => {
    let finish!: (value: LnAddressResolved) => void;
    vi.mocked(resolveLightningAddress).mockImplementation(
      () =>
        new Promise<LnAddressResolved>((resolve) => {
          finish = resolve;
        }),
    );
    renderWithLocale(<DonateForm />);
    fillForm('me@walletofsatoshi.com', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => {
      finish({ ...resolved, minSendable: 5000, maxSendable: 10_000 });
    });
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
});
