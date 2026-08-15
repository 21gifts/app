import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DonateForm } from '@/components/DonateForm';
import { resolveLightningAddress } from '@/lib/api';
import { requestDonateInvoice } from '@/lib/lnurl-pay';
import type { LnAddressResolved } from '@/lib/api-types';

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

afterEach(cleanup);

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
    render(<DonateForm />);
    expect(screen.getByRole('heading', { name: 'Send a gift' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create invoice' })).toBeTruthy();
  });

  it('asks for an address when the field is empty', () => {
    render(<DonateForm />);
    fillForm('   ', '21');
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a Lightning Address');
  });

  it('asks for an amount when the field is empty', () => {
    render(<DonateForm />);
    fillForm('me@walletofsatoshi.com', '');
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect(screen.getByRole('alert').textContent).toBe(
      'Enter a whole number of sats greater than zero',
    );
  });

  it('rejects a non-integer amount', () => {
    render(<DonateForm />);
    fillForm('me@walletofsatoshi.com', '1.5');
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect(screen.getByRole('alert').textContent).toBe(
      'Enter a whole number of sats greater than zero',
    );
  });

  it('rejects a zero amount', () => {
    render(<DonateForm />);
    fillForm('me@walletofsatoshi.com', '0');
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect(screen.getByRole('alert').textContent).toBe(
      'Enter a whole number of sats greater than zero',
    );
  });

  it('shows the invoice QR after a successful resolve and invoice fetch', async () => {
    vi.mocked(resolveLightningAddress).mockResolvedValue(resolved);
    vi.mocked(requestDonateInvoice).mockResolvedValue('lnbc21u1ptest');
    render(<DonateForm />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));

    expect(await screen.findByText(/Pay 21 sats to me@walletofsatoshi.com/)).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Lightning invoice QR code' })).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Open in wallet' });
    expect(link.getAttribute('href')).toBe('lightning:lnbc21u1ptest');
    expect(resolveLightningAddress).toHaveBeenCalledWith('me@walletofsatoshi.com');
    expect(requestDonateInvoice).toHaveBeenCalledWith({
      callback: resolved.callback,
      amountMsat: 21_000,
    });
  });

  it('uses the singular sat label for a one-sat gift', async () => {
    vi.mocked(resolveLightningAddress).mockResolvedValue(resolved);
    vi.mocked(requestDonateInvoice).mockResolvedValue('lnbc10n1ptest');
    render(<DonateForm />);
    fillForm('me@walletofsatoshi.com', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect(await screen.findByText(/Pay 1 sat to me@walletofsatoshi.com/)).toBeTruthy();
  });

  it('rejects an amount outside the provider bounds', async () => {
    vi.mocked(resolveLightningAddress).mockResolvedValue({
      ...resolved,
      minSendable: 5000,
      maxSendable: 10_000,
    });
    render(<DonateForm />);
    fillForm('me@walletofsatoshi.com', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
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
    render(<DonateForm />);
    fillForm('me@walletofsatoshi.com', '21');
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'This address accepts 1 sat – 2 sats.',
    );
  });

  it('surfaces an invoice fetch error', async () => {
    vi.mocked(resolveLightningAddress).mockResolvedValue(resolved);
    vi.mocked(requestDonateInvoice).mockRejectedValue(
      new Error('Could not fetch the invoice from the Lightning Address'),
    );
    render(<DonateForm />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Could not fetch the invoice from the Lightning Address',
    );
  });

  it('surfaces a resolve or invoice error', async () => {
    vi.mocked(resolveLightningAddress).mockRejectedValue(
      new Error('Not a valid Lightning Address'),
    );
    render(<DonateForm />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Not a valid Lightning Address',
    );
  });

  it('surfaces a non-Error throw as a string', async () => {
    vi.mocked(resolveLightningAddress).mockRejectedValue('boom');
    render(<DonateForm />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'boom');
  });

  it('returns to the form from the paying view', async () => {
    vi.mocked(resolveLightningAddress).mockResolvedValue(resolved);
    vi.mocked(requestDonateInvoice).mockResolvedValue('lnbc21u1ptest');
    render(<DonateForm />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Create invoice' })).toBeTruthy();
  });

  it('drops a late result after cancel during resolve', async () => {
    let finish!: (value: LnAddressResolved) => void;
    vi.mocked(resolveLightningAddress).mockImplementation(
      () =>
        new Promise<LnAddressResolved>((resolve) => {
          finish = resolve;
        }),
    );
    render(<DonateForm />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => {
      finish(resolved);
    });
    await waitFor(() => {
      expect(screen.queryByRole('img', { name: 'Lightning invoice QR code' })).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'Create invoice' })).toBeTruthy();
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
    render(<DonateForm />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => {
      finish('lnbc21u1ptest');
    });
    await waitFor(() => {
      expect(screen.queryByRole('img', { name: 'Lightning invoice QR code' })).toBeNull();
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
    render(<DonateForm />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
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
    render(<DonateForm />);
    fillForm('me@walletofsatoshi.com', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
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
