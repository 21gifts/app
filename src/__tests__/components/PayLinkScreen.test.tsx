import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import { PayLinkScreen } from '@/components/PayLinkScreen';
import { encodeLnurl } from '@/lib/lnurl';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: (): { push: (href: string) => void } => ({ push: vi.fn() }),
}));

const ADA = 'LNURL1DP68GURN8GHJ7V339ENKJEN5WVHJUAM9D3KZ66MWDAMKUTMVDE6HYMRS9ASKGCGMXDMGQ';
const originalUserAgent = navigator.userAgent;

function setUserAgent(userAgent: string): void {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: userAgent });
}

const profile = {
  name: 'Ada Lovelace',
  username: 'ada',
  minSats: 1,
  maxSats: 100,
};

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(handler));
}

afterEach(() => {
  cleanup();
  setUserAgent(originalUserAgent);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PayLinkScreen', () => {
  it('shows the invalid link without fetching', async () => {
    mockFetch(async () => {
      throw new Error('should not fetch');
    });
    renderWithLocale(<PayLinkScreen lightning="" />);
    expect((await screen.findByRole('alert')).textContent).toBe('This payment link is not valid.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the name and rejects an amount outside the window', async () => {
    mockFetch(async () => Response.json(profile));
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByRole('heading', { name: 'Ada Lovelace' })).toBeTruthy();
    expect(document.querySelector('path[d^="M12 32v24"]')).not.toBeNull();
    expect(document.querySelector('path[d^="M199.3 516.4"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Enter a whole number.');
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a whole number.');
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '101' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a whole number.');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('shows the invoice QR after a successful mint', async () => {
    mockFetch(async (input, init) => {
      if (String(input).endsWith('/invoice')) {
        expect(init?.method).toBe('POST');
        expect(init?.body).toBe(JSON.stringify({ amountSats: 21 }));
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 });
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await screen.findByRole('heading', { name: 'Ada Lovelace' });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    const pay = screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' });
    const hrefs: string[] = [];
    const previous = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get href(): string {
          return 'http://localhost/';
        },
        set href(value: string) {
          hrefs.push(value);
        },
      },
    });
    fireEvent.click(pay);
    Object.defineProperty(window, 'location', { configurable: true, value: previous });
    expect(hrefs).toEqual(['walletofsatoshi:lightning:LNBC210N1PAYLINK']);
    expect(screen.queryByRole('button', { name: 'Create invoice' })).toBeNull();
    expect((screen.getByLabelText('Amount') as HTMLInputElement).disabled).toBe(true);
  });

  it('keeps the form when the invoice request fails', async () => {
    mockFetch(async (input) => {
      if (String(input).endsWith('/invoice')) {
        return new Response('no', { status: 502 });
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await screen.findByRole('heading', { name: 'Ada Lovelace' });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Could not create the invoice.');
    expect(
      (screen.getByRole('button', { name: 'Create invoice' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('treats a profile error and a thrown invoice request as failures', async () => {
    mockFetch(async () => new Response('missing', { status: 404 }));
    const { unmount } = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect((await screen.findByRole('alert')).textContent).toBe('This payment link is not valid.');
    unmount();

    mockFetch(async (input) => {
      if (String(input).endsWith('/invoice')) {
        throw new Error('offline');
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await screen.findByRole('heading', { name: 'Ada Lovelace' });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Could not create the invoice.');
  });

  it('ignores a profile response that arrives after unmount', async () => {
    let resolveGet: (response: Response) => void = () => undefined;
    mockFetch(
      () =>
        new Promise((resolve) => {
          resolveGet = resolve;
        }),
    );
    const { unmount } = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    unmount();
    resolveGet(Response.json(profile));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
  });

  it('ignores an error status that arrives after unmount', async () => {
    let resolveGet: (response: Response) => void = () => undefined;
    mockFetch(
      () =>
        new Promise((resolve) => {
          resolveGet = resolve;
        }),
    );
    const { unmount } = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    unmount();
    resolveGet(new Response('missing', { status: 404 }));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
  });

  it('ignores a profile failure that arrives after unmount', async () => {
    let rejectGet: (error: Error) => void = () => undefined;
    mockFetch(
      () =>
        new Promise((_resolve, reject) => {
          rejectGet = reject;
        }),
    );
    const { unmount } = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    unmount();
    rejectGet(new Error('offline'));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
  });

  it('opens the Android wallet intent without an invoice QR', async () => {
    setUserAgent(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    );
    mockFetch(async (input) => {
      if (String(input).endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 });
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await screen.findByRole('heading', { name: 'Ada Lovelace' });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    const pay = await screen.findByRole('button', { name: 'Pay with Wallet of Satoshi' });
    expect(screen.queryByRole('img', { name: 'Bitcoin invoice' })).toBeNull();
    const hrefs: string[] = [];
    const previous = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get href(): string {
          return 'http://localhost/';
        },
        set href(value: string) {
          hrefs.push(value);
        },
      },
    });
    fireEvent.click(pay);
    Object.defineProperty(window, 'location', { configurable: true, value: previous });
    expect(hrefs[0]?.startsWith('intent:lightning:LNBC210N1PAYLINK#Intent;')).toBe(true);
  });

  it('does not apply an in-flight invoice after the link changes', async () => {
    const bob = encodeLnurl('https://21.gifts/.well-known/lnurlp/bob');
    let releaseInvoice: (response: Response) => void = () => undefined;
    mockFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        return new Promise((resolve) => {
          releaseInvoice = resolve;
        });
      }
      if (url.endsWith('/pay/bob')) {
        return Response.json({ name: 'Bob', username: 'bob', minSats: 1, maxSats: 100 });
      }
      return Response.json(profile);
    });
    const view = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByRole('heading', { name: 'Ada Lovelace' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    view.rerender(<PayLinkScreen lightning={bob} />);
    expect(await screen.findByRole('heading', { name: 'Bob' })).toBeTruthy();
    releaseInvoice(Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 }));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Ada Lovelace' })).toBeNull();
    });
    expect(screen.queryByRole('img', { name: 'Bitcoin invoice' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Create invoice' })).toBeTruthy();
  });

  it('drops an invoice body that arrives after the link changes', async () => {
    const bob = encodeLnurl('https://21.gifts/.well-known/lnurlp/bob');
    let releaseJson: (() => void) | undefined;
    mockFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        return {
          ok: true,
          json: () =>
            new Promise((resolve) => {
              releaseJson = () => resolve({ pr: 'lnbc210n1paylink', amountSats: 21 });
            }),
        } as Response;
      }
      if (url.endsWith('/pay/bob')) {
        return Response.json({ name: 'Bob', username: 'bob', minSats: 1, maxSats: 100 });
      }
      return Response.json(profile);
    });
    const view = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByRole('heading', { name: 'Ada Lovelace' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    await waitFor(() => {
      expect(releaseJson).toBeTypeOf('function');
    });
    view.rerender(<PayLinkScreen lightning={bob} />);
    expect(await screen.findByRole('heading', { name: 'Bob' })).toBeTruthy();
    releaseJson?.();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create invoice' })).toBeTruthy();
    });
    expect(screen.queryByRole('img', { name: 'Bitcoin invoice' })).toBeNull();
  });

  it('does not show a stale invoice failure after the link changes', async () => {
    const bob = encodeLnurl('https://21.gifts/.well-known/lnurlp/bob');
    let rejectInvoice: (error: Error) => void = () => undefined;
    mockFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        return new Promise((_resolve, reject) => {
          rejectInvoice = reject;
        });
      }
      if (url.endsWith('/pay/bob')) {
        return Response.json({ name: 'Bob', username: 'bob', minSats: 1, maxSats: 100 });
      }
      return Response.json(profile);
    });
    const view = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByRole('heading', { name: 'Ada Lovelace' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    view.rerender(<PayLinkScreen lightning={bob} />);
    expect(await screen.findByRole('heading', { name: 'Bob' })).toBeTruthy();
    rejectInvoice(new Error('offline'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create invoice' })).toBeTruthy();
    });
    expect(screen.queryByText('Could not create the invoice.')).toBeNull();
  });

  it('drops the previous person when the link changes', async () => {
    mockFetch(async () => Response.json(profile));
    const view = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByRole('heading', { name: 'Ada Lovelace' })).toBeTruthy();
    view.rerender(<PayLinkScreen lightning="" />);
    expect((await screen.findByRole('alert')).textContent).toBe('This payment link is not valid.');
    expect(screen.queryByRole('heading', { name: 'Ada Lovelace' })).toBeNull();
    expect(screen.queryByLabelText('Amount')).toBeNull();
  });

  it('mints only once when submit fires twice before the response', async () => {
    let release: (response: Response) => void = () => undefined;
    mockFetch(async (input) => {
      if (String(input).endsWith('/invoice')) {
        return new Promise((resolve) => {
          release = resolve;
        });
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await screen.findByRole('heading', { name: 'Ada Lovelace' });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    const button = screen.getByRole('button', { name: 'Create invoice' });
    fireEvent.click(button);
    fireEvent.click(button);
    const invoiceCalls = vi
      .mocked(fetch)
      .mock.calls.filter((call) => String(call[0]).endsWith('/invoice')).length;
    expect(invoiceCalls).toBe(1);
    release(Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 }));
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    expect(
      vi.mocked(fetch).mock.calls.filter((call) => String(call[0]).endsWith('/invoice')).length,
    ).toBe(1);
  });

  it('treats a profile body that cannot be parsed as an invalid link', async () => {
    mockFetch(async () => new Response('not-json', { status: 200 }));
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect((await screen.findByRole('alert')).textContent).toBe('This payment link is not valid.');
  });

  it('keeps Pay and omits the invoice QR on a smartphone till', async () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    const fixed = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(fixed);
    mockFetch(async (input) => {
      if (String(input).endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 238093 });
      }
      return Response.json({
        ...profile,
        minSats: 238093,
        maxSats: 238093,
        charge: { amountSats: 238093, expiresAt: new Date(fixed + 300_000).toISOString() },
      });
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Bitcoin invoice' })).toBeNull();
  });

  it('shows an open till instead of creating another invoice', async () => {
    const fixed = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(fixed);
    const bodies: string[] = [];
    mockFetch(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        bodies.push(String(init?.body));
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 238093 });
      }
      return Response.json({
        ...profile,
        minSats: 238093,
        maxSats: 238093,
        charge: { amountSats: 238093, expiresAt: new Date(fixed + 300_000).toISOString() },
      });
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByText('5:00 left')).toBeTruthy();
    expect(document.querySelector('path[d^="M199.3 516.4"]')).not.toBeNull();
    expect(document.querySelector('path[d^="M12 32v24"]')).toBeNull();
    expect(screen.getByText("₿238'093")).toBeTruthy();
    expect(screen.queryByLabelText('Amount')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create invoice' })).toBeNull();
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(bodies).toEqual([JSON.stringify({ amountSats: 238093 })]);
    const hrefs: string[] = [];
    const previous = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get href(): string {
          return 'http://localhost/';
        },
        set href(value: string) {
          hrefs.push(value);
        },
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' }));
    Object.defineProperty(window, 'location', { configurable: true, value: previous });
    expect(hrefs).toEqual(['walletofsatoshi:lightning:LNBC210N1PAYLINK']);
  });

  it('retries a failed till invoice without showing the amount field', async () => {
    const fixed = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(fixed);
    let invoices = 0;
    mockFetch(async (input) => {
      if (String(input).endsWith('/invoice')) {
        invoices += 1;
        if (invoices === 1) {
          return new Response('no', { status: 502 });
        }
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 238093 });
      }
      return Response.json({
        ...profile,
        charge: { amountSats: 238093, expiresAt: new Date(fixed + 300_000).toISOString() },
      });
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect((await screen.findByRole('alert')).textContent).toBe('Could not create the invoice.');
    expect(screen.queryByLabelText('Amount')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' }));
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(invoices).toBe(2);
  });

  it('keeps the amount form when the till charge is missing or not payable', async () => {
    const fixed = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(fixed);
    const charges: unknown[] = [
      null,
      { amountSats: 0, expiresAt: new Date(fixed + 300_000).toISOString() },
      { amountSats: 1.5, expiresAt: new Date(fixed + 300_000).toISOString() },
      { amountSats: 21, expiresAt: fixed },
      { amountSats: 21, expiresAt: 'not-a-date' },
      { amountSats: 21, expiresAt: new Date(fixed - 1_000).toISOString() },
    ];
    for (const charge of charges) {
      mockFetch(async (input) => {
        if (String(input).endsWith('/invoice')) {
          throw new Error('should not mint');
        }
        return Response.json({ ...profile, charge });
      });
      const view = renderWithLocale(<PayLinkScreen lightning={ADA} />);
      expect(await screen.findByRole('button', { name: 'Create invoice' })).toBeTruthy();
      view.unmount();
    }
  });

  it('shows the viewer fiat under an open till when a gift day exists', async () => {
    const fixed = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(fixed);
    const day = {
      day: '2026-09-24',
      sats: 100_000_000,
      cumulativeSats: 100_000_000,
      btc: '1.00000000',
      cumulativeBtc: '1.00000000',
      usd: '84000.00',
      cumulativeUsd: '84000.00',
      chf: null,
      eur: null,
      php: null,
      cumulativeChf: null,
      cumulativeEur: null,
      cumulativePhp: null,
    };
    mockFetch(async (input) => {
      const url = String(input);
      if (url.includes('/gifts/stats')) {
        return Response.json({
          totalSats: 100_000_000,
          totalBtc: '1.00000000',
          totalUsd: '84000.00',
          totalChf: null,
          totalEur: null,
          totalPhp: null,
          giftCount: 1,
          recipientCount: 1,
          firstPaidAt: null,
          lastPaidAt: null,
          spendOverTime: [day],
          byRecipient: [],
          byMonth: [],
          fx: {
            quote: 'BTC-USD',
            dayBasis: 'utc',
            source: 'coinbase-exchange-daily-close',
            quotes: [],
          },
        });
      }
      if (url.endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 238093 });
      }
      return Response.json({
        ...profile,
        charge: { amountSats: 238093, expiresAt: new Date(fixed + 300_000).toISOString() },
      });
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByText('$200.00')).toBeTruthy();
  });

  it('returns to the amount form when the till runs out', async () => {
    mockFetch(async (input) => {
      if (String(input).endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 });
      }
      return Response.json({
        ...profile,
        charge: { amountSats: 21, expiresAt: new Date(Date.now() + 1_200).toISOString() },
      });
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByText(/left/)).toBeTruthy();
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: 'Create invoice' })).toBeTruthy();
      },
      { timeout: 4000 },
    );
    expect(screen.queryByRole('img', { name: 'Bitcoin invoice' })).toBeNull();
  });

  it('shows a till error when minting throws', async () => {
    const fixed = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(fixed);
    mockFetch(async (input) => {
      if (String(input).endsWith('/invoice')) {
        throw new Error('offline');
      }
      return Response.json({
        ...profile,
        charge: { amountSats: 21, expiresAt: new Date(fixed + 300_000).toISOString() },
      });
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect((await screen.findByRole('alert')).textContent).toBe('Could not create the invoice.');
  });

  it('ignores a till invoice that arrives after unmount', async () => {
    const fixed = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(fixed);
    let release: (response: Response) => void = () => undefined;
    mockFetch(async (input) => {
      if (String(input).endsWith('/invoice')) {
        return new Promise((resolve) => {
          release = resolve;
        });
      }
      return Response.json({
        ...profile,
        charge: { amountSats: 238093, expiresAt: new Date(fixed + 300_000).toISOString() },
      });
    });
    const view = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByText('5:00 left')).toBeTruthy();
    view.unmount();
    release(Response.json({ pr: 'lnbc210n1paylink', amountSats: 238093 }));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
  });
});
