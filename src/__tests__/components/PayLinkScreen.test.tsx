import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { PayLinkScreen } from '@/components/PayLinkScreen';
import { encodeLnurl } from '@/lib/lnurl';
import { formatBitcoin } from '@/lib/stats-money';

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

/** Switches the preferred fiat to PHP, as a change on another screen would. */
function PreferPhp(): ReactElement {
  const { setFiat } = useFiatPreference();
  return (
    <button type="button" onClick={() => setFiat('PHP')}>
      Prefer PHP
    </button>
  );
}

function postedInvoice(): boolean {
  return vi
    .mocked(fetch)
    .mock.calls.some(
      (call) =>
        String(call[0]).includes('/invoice') &&
        (call[1] as RequestInit | undefined)?.method === 'POST',
    );
}

type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Stubs `fetch` for the Lightning-only path: `POST /pay/:username/payment`
 * answers 503 `stablecoin_unavailable`, so an entered amount mints as before,
 * and the pay link is the plain Lightning request, so an open till mints too.
 */
function mockFetch(handler: FetchHandler) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/payment')) {
        return Response.json(
          { error: 'Stablecoin payment is unavailable', code: 'stablecoin_unavailable' },
          { status: 503 },
        );
      }
      if (String(input).startsWith('/.well-known/lnurlp/')) {
        return Response.json(plainPayLink());
      }
      return handler(input, init);
    }),
  );
}

/** Stubs `fetch` with `handler` alone, for the shop payment paths. */
function mockShopFetch(handler: FetchHandler) {
  vi.stubGlobal('fetch', vi.fn(handler));
}

afterEach(() => {
  cleanup();
  setUserAgent(originalUserAgent);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.cookie = 'fiat=; Max-Age=0; Path=/';
});

describe('PayLinkScreen', () => {
  it('shows the invalid link without fetching', async () => {
    mockFetch(async () => {
      throw new Error('should not fetch');
    });
    renderWithLocale(<PayLinkScreen lightning="" />);
    expect((await screen.findByRole('alert')).textContent).toBe('This payment link is not valid.');
    expect(document.querySelector('path[d^="M12 32v24"]')).not.toBeNull();
    expect(document.querySelector('path[d^="M199.3 516.4"]')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the name and rejects an amount outside the window', async () => {
    mockFetch(async () => Response.json(profile));
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByRole('heading', { name: 'Ada Lovelace' })).toBeTruthy();
    expect(document.querySelector('path[d^="M199.3 516.4"]')).not.toBeNull();
    expect(document.querySelector('path[d^="M12 32v24"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Enter a whole number.');
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a whole number.');
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '101' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a whole number.');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('names the currency when the spot rate cannot price a kept fiat amount', async () => {
    mockFetch(async (input) => {
      if (String(input).includes('/fx/spot')) {
        return Response.json({
          asOf: '2026-09-24T00:00:00.000Z',
          source: 'test',
          rates: { USD: '84000.00' },
        });
      }
      return Response.json(profile);
    });
    renderWithLocale(
      <>
        <PreferPhp />
        <PayLinkScreen lightning={ADA} />
      </>,
      'en',
      'ch',
      'USD',
    );
    expect(await screen.findByRole('heading', { name: 'Ada Lovelace' })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'USD' })).toHaveProperty('disabled', false);
    });
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '0.05' } });
    fireEvent.click(screen.getByRole('button', { name: 'Prefer PHP' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'PHP' })).toHaveProperty('disabled', true);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect((await screen.findByRole('alert')).textContent).toBe('No PHP exchange rate yet.');
    expect(postedInvoice()).toBe(false);
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
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    const pay = screen.getByRole('button', { name: 'Pay with a Bitcoin wallet app' });
    expect(pay.textContent).toBe('Pay');
    expect(pay.querySelector('img')).toBeNull();
    expect(pay.parentElement?.className).toContain('w-[16.625rem]');
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
    expect(hrefs).toEqual(['lightning:lnbc210n1paylink']);
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    expect(screen.queryByLabelText('Amount')).toBeNull();
    expect(screen.getByText('₿21')).toBeTruthy();
    expect(screen.getByText(/left/)).toBeTruthy();
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
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Could not create the invoice.');
    expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
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
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
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

  it('opens the generic lightning link without an invoice QR on an Android phone', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const pay = await screen.findByRole('button', { name: 'Pay with a Bitcoin wallet app' });
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
    expect(hrefs).toEqual(['lightning:lnbc210n1paylink']);
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
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(postedInvoice()).toBe(true);
    });
    view.rerender(<PayLinkScreen lightning={bob} />);
    expect(await screen.findByRole('heading', { name: 'Bob' })).toBeTruthy();
    releaseInvoice(Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 }));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Ada Lovelace' })).toBeNull();
    });
    expect(screen.queryByRole('img', { name: 'Bitcoin invoice' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pay with a Bitcoin wallet app' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
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
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(releaseJson).toBeTypeOf('function');
    });
    view.rerender(<PayLinkScreen lightning={bob} />);
    expect(await screen.findByRole('heading', { name: 'Bob' })).toBeTruthy();
    releaseJson?.();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
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
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(postedInvoice()).toBe(true);
    });
    view.rerender(<PayLinkScreen lightning={bob} />);
    expect(await screen.findByRole('heading', { name: 'Bob' })).toBeTruthy();
    rejectInvoice(new Error('offline'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
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
    const form = document.querySelector('form');
    if (form === null) {
      throw new Error('amount form missing');
    }
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => {
      expect(
        vi.mocked(fetch).mock.calls.filter((call) => String(call[0]).endsWith('/invoice')).length,
      ).toBe(1);
    });
    expect(
      vi.mocked(fetch).mock.calls.filter((call) => String(call[0]).endsWith('/payment')).length,
    ).toBe(1);
    release(Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 }));
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(document.querySelector('form')).toBeNull();
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
    expect(
      await screen.findByRole('button', { name: 'Pay with a Bitcoin wallet app' }),
    ).toBeTruthy();
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
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
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
    fireEvent.click(screen.getByRole('button', { name: 'Pay with a Bitcoin wallet app' }));
    Object.defineProperty(window, 'location', { configurable: true, value: previous });
    expect(hrefs).toEqual(['lightning:lnbc210n1paylink']);
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
    fireEvent.click(screen.getByRole('button', { name: 'Pay with a Bitcoin wallet app' }));
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
      expect(await screen.findByRole('button', { name: 'Continue' })).toBeTruthy();
      view.unmount();
    }
  });

  it('shows an open till when the charge id is not a string', async () => {
    const fixed = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(fixed);
    mockFetch(async (input) => {
      if (String(input).endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 });
      }
      return Response.json({
        ...profile,
        charge: {
          id: 12,
          amountSats: 21,
          expiresAt: new Date(fixed + 300_000).toISOString(),
        },
      });
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByText('₿21')).toBeTruthy();
    expect(screen.queryByLabelText('Amount')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('shows an open till when the charge id is a string', async () => {
    const fixed = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(fixed);
    mockFetch(async (input) => {
      if (String(input).endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 });
      }
      return Response.json({
        ...profile,
        charge: {
          id: 'chg_1',
          amountSats: 21,
          expiresAt: new Date(fixed + 300_000).toISOString(),
        },
      });
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByText('₿21')).toBeTruthy();
    expect(screen.queryByLabelText('Amount')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('shows bitcoin under an open till whose fiat fields are null, even with a rate', async () => {
    const fixed = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(fixed);
    mockFetch(async (input) => {
      const url = String(input);
      if (url.includes('/fx/spot')) {
        return Response.json({
          asOf: '2026-09-24T00:00:00.000Z',
          source: 'test',
          rates: { USD: '84000.00' },
        });
      }
      if (url.endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 238093 });
      }
      return Response.json({
        ...profile,
        charge: {
          amountSats: 238093,
          expiresAt: new Date(fixed + 300_000).toISOString(),
          amountCurrency: null,
          amount: null,
          amountUsd: null,
          amountChf: null,
          amountEur: null,
          amountPhp: null,
        },
      });
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />, 'en', 'ch', 'USD');
    expect(await screen.findByText("₿238'093")).toBeTruthy();
    await waitFor(() => {
      const spotCalls = vi
        .mocked(fetch)
        .mock.calls.filter(([input]) => String(input).includes('/fx/spot'));
      expect(spotCalls).toHaveLength(1);
    });
    expect(screen.queryByText('$200.00')).toBeNull();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('shows 12.00 PHP on a pending charge to a viewer whose currency is USD', async () => {
    const fixed = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(fixed);
    mockFetch(async (input) => {
      const url = String(input);
      if (url.includes('/fx/spot')) {
        return Response.json({
          asOf: '2026-09-24T00:00:00.000Z',
          source: 'test',
          rates: { USD: '100000.00' },
        });
      }
      if (url.endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 });
      }
      return Response.json({
        ...profile,
        charge: {
          amountSats: 21,
          expiresAt: new Date(fixed + 300_000).toISOString(),
          amountCurrency: 'PHP',
          amount: '12.00',
          amountUsd: null,
          amountChf: null,
          amountEur: null,
          amountPhp: null,
        },
      });
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />, 'en', 'ch', 'USD');
    expect(await screen.findByText('₱12.00')).toBeTruthy();
    expect(screen.getByText('₿21')).toBeTruthy();
    expect(screen.queryByText('$0.02')).toBeNull();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('stays on bitcoin when a profile has no charge and a rate is loaded', async () => {
    mockFetch(async (input) => {
      if (String(input).includes('/fx/spot')) {
        return Response.json({
          asOf: '2026-09-24T00:00:00.000Z',
          source: 'test',
          rates: { USD: '84000.00' },
        });
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />, 'en', 'ch', 'USD');
    expect(await screen.findByRole('heading', { name: 'Ada Lovelace' })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'USD' })).toHaveProperty('disabled', false);
    });
    expect(screen.getByRole('button', { name: '₿' })).toHaveProperty('ariaPressed', 'true');
    expect(screen.queryByText(/\$/)).toBeNull();
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
        expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
      },
      { timeout: 4000 },
    );
    expect(screen.queryByRole('img', { name: 'Bitcoin invoice' })).toBeNull();
  });

  it('returns to the amount form when a confirmed payment runs out', async () => {
    const start = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(start);
    mockFetch(async (input) => {
      if (String(input).endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 });
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await screen.findByRole('heading', { name: 'Ada Lovelace' });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('5:00 left')).toBeTruthy();
    vi.spyOn(Date, 'now').mockReturnValue(start + 5 * 60 * 1000 + 1);
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
      },
      { timeout: 4000 },
    );
    expect(screen.queryByText(/left/)).toBeNull();
  });

  it('enables Continue when the till expires while minting', async () => {
    mockFetch(async (input) => {
      if (String(input).endsWith('/invoice')) {
        return new Promise(() => undefined);
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
        const button = screen.getByRole('button', { name: 'Continue' });
        expect(button.hasAttribute('disabled')).toBe(false);
      },
      { timeout: 4000 },
    );
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

const FIXED = 1_700_000_000_000;
const CALLBACK = 'https://21.gifts/lnurlp/cb/ada';
const DETAIL = `${CALLBACK}?quote=q1&method=Lightning&asset=BTC`;

/** The api's 404 body of `GET /lnurlp/wait/:payment` for a payment it does not know. */
const API_NOT_FOUND = {
  statusCode: 404,
  message: 'Not found',
  error: 'Not found',
  status: 'ERROR',
  reason: 'Not found',
};

/** A whole-sat amount below one bitcoin as the pay link writes it in BTC (`21` → `0.00000021`). */
function btcText(sats: number): string {
  return `0.${String(sats).padStart(8, '0')}`;
}

/** An OpenCryptoPay pay request for one shop payment (21 sats unless `sats` says otherwise). */
function shopPayLink(
  options: {
    payment?: string;
    quote?: string;
    expiresInMs?: number;
    method?: string;
    standard?: string;
    sats?: number;
  } = {},
): object {
  return {
    tag: 'payRequest',
    callback: CALLBACK,
    standard: options.standard ?? 'OpenCryptoPay',
    possibleStandards: ['OpenCryptoPay'],
    quote: {
      id: options.quote ?? 'q1',
      expiration: new Date(FIXED + (options.expiresInMs ?? 90_000)).toISOString(),
      payment: options.payment ?? 'p1',
    },
    transferAmounts: [
      {
        method: 'Lightning',
        minFee: 0,
        assets: [{ asset: 'BTC', amount: btcText(options.sats ?? 21) }],
        available: true,
      },
      {
        method: options.method ?? 'Polygon',
        minFee: 36,
        assets: [{ asset: 'USDT', amount: '0.2' }],
        available: true,
      },
    ],
  };
}

/** The plain Lightning pay request (LUD-06): the pay link without an open amount. */
function plainPayLink(): object {
  return {
    tag: 'payRequest',
    callback: 'https://21.gifts/lnurlp/ada/invoice',
    minSendable: 1_000,
    maxSendable: 100_000_000_000,
    metadata: '[["text/plain","Ada Lovelace"]]',
  };
}

const chargeProfile = {
  ...profile,
  minSats: 21,
  maxSats: 21,
  charge: { amountSats: 21, expiresAt: new Date(FIXED + 300_000).toISOString() },
};

function fetchedUrls(): string[] {
  return vi.mocked(fetch).mock.calls.map((call) => String(call[0]));
}

function captureHrefs(click: () => void): string[] {
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
  click();
  Object.defineProperty(window, 'location', { configurable: true, value: previous });
  return hrefs;
}

/** Waits forever, as an open long poll does. */
function pending(): Promise<Response> {
  return new Promise(() => undefined);
}

async function enterAmount(value = '21'): Promise<void> {
  await screen.findByRole('heading', { name: 'Ada Lovelace' });
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
}

describe('PayLinkScreen shop payment', () => {
  it("shows the till's shop payment from the pay link and never mints", async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return pending();
      }
      return Response.json(chargeProfile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(screen.getByText('5:00 left')).toBeTruthy();
    expect(screen.getByText('₿21')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Waiting for payment…');
    expect(screen.getByText('Polygon')).toBeTruthy();
    expect(screen.getByText('0.2 USDT')).toBeTruthy();
    expect(screen.queryByText('Lightning')).toBeNull();
    expect(screen.getByText('1:30 left')).toBeTruthy();
    expect(
      screen.getByText('To pay with USDT or USDC, scan the sticker with an OpenCryptoPay wallet.'),
    ).toBeTruthy();
    expect(fetchedUrls().filter((url) => url.startsWith('/lnurlp/wait/'))).toEqual([
      '/lnurlp/wait/p1',
    ]);
    const hrefs = captureHrefs(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Pay with a Bitcoin wallet app' }));
    });
    expect(hrefs).toEqual(['lightning:lnbc210n1shop']);
  });

  it('shows no stablecoin line, wallet hint, or phone invoice QR for a Lightning-only quote', async () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json({
          ...shopPayLink(),
          transferAmounts: [
            {
              method: 'Lightning',
              minFee: 0,
              assets: [{ asset: 'BTC', amount: '0.00000021' }],
              available: true,
            },
          ],
        });
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return pending();
      }
      return Response.json(chargeProfile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await waitFor(() => {
      expect(
        (
          screen.getByRole('button', {
            name: 'Pay with a Bitcoin wallet app',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false);
    });
    expect(screen.queryByRole('img', { name: 'Bitcoin invoice' })).toBeNull();
    expect(screen.queryByText(/OpenCryptoPay|USDT|USDC/)).toBeNull();
    expect(screen.getByText('Waiting for payment…')).toBeTruthy();
    expect(postedInvoice()).toBe(false);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getAllByText(/left/)).toHaveLength(1);
  });

  it('loads the pay profile again when the till replaced its charge before the pay link was read', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let profiles = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      if (url === '/.well-known/lnurlp/ada') {
        // The till already replaced the 21-sat charge with a 50-sat one and its payment p2.
        return Response.json(shopPayLink({ payment: 'p2', sats: 50 }));
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc500n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return pending();
      }
      if (url !== '/pay/ada') {
        return Response.json(chargeProfile);
      }
      profiles += 1;
      return Response.json(
        profiles === 1
          ? chargeProfile
          : {
              ...chargeProfile,
              minSats: 50,
              maxSats: 50,
              charge: { amountSats: 50, expiresAt: new Date(FIXED + 300_000).toISOString() },
            },
      );
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(profiles).toBe(2);
    expect(screen.getByText('₿50')).toBeTruthy();
    expect(screen.queryByText('₿21')).toBeNull();
    expect(fetchedUrls().filter((url) => url === DETAIL)).toHaveLength(1);
    expect(fetchedUrls().filter((url) => url.startsWith('/lnurlp/wait/'))).toEqual([
      '/lnurlp/wait/p2',
    ]);
    const hrefs = captureHrefs(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Pay with a Bitcoin wallet app' }));
    });
    expect(hrefs).toEqual(['lightning:lnbc500n1shop']);
  });

  it('never shows a charge beside a pay request for other sats, and reloads only once per payment', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let profiles = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice') || url.startsWith(CALLBACK) || url.startsWith('/lnurlp/')) {
        throw new Error(`unexpected ${url}`);
      }
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json(shopPayLink({ payment: 'p2', sats: 50 }));
      }
      if (url === '/pay/ada') {
        profiles += 1;
      }
      return Response.json(chargeProfile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect((await screen.findByRole('alert')).textContent).toBe('Could not create the invoice.');
    expect(profiles).toBe(2);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Bitcoin invoice' })).toBeNull();
    const pay = screen.getByRole('button', {
      name: 'Pay with a Bitcoin wallet app',
    }) as HTMLButtonElement;
    expect(pay.disabled).toBe(false);
    fireEvent.click(pay);
    await waitFor(() => {
      expect(fetchedUrls().filter((url) => url === '/.well-known/lnurlp/ada')).toHaveLength(3);
    });
    expect((await screen.findByRole('alert')).textContent).toBe('Could not create the invoice.');
    expect(profiles).toBe(2);
    expect(postedInvoice()).toBe(false);
  });

  it('hides the invoice on its way and stops polling once paid', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let waits = 0;
    let releasePaid: (response: Response) => void = () => undefined;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        waits += 1;
        if (waits === 1) {
          return Response.json({ status: 'Pending', paymentStatus: 'accepted' });
        }
        // The api holds the read with `since=accepted` until the payment is paid.
        return new Promise((resolve) => {
          releasePaid = resolve;
        });
      }
      return Response.json(chargeProfile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByText('On its way')).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Bitcoin invoice' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pay with a Bitcoin wallet app' })).toBeNull();
    expect(screen.queryByText('0.2 USDT')).toBeNull();
    expect(screen.queryByText('5:00 left')).toBeNull();
    await waitFor(() => {
      expect(waits).toBe(2);
    });
    await act(async () => {
      releasePaid(Response.json({ status: 'Completed', paymentStatus: 'paid' }));
    });
    expect(await screen.findByText('Paid ✓')).toBeTruthy();
    expect(fetchedUrls().filter((url) => url.startsWith('/lnurlp/wait/'))).toEqual([
      '/lnurlp/wait/p1',
      '/lnurlp/wait/p1?since=accepted',
    ]);
    await new Promise((resolve) => {
      setTimeout(resolve, 2500);
    });
    expect(waits).toBe(2);
  }, 10_000);

  it('shows an ended payment as Ended, keeps reading until it is closed, then mints a live till by Lightning', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let profiles = 0;
    let links = 0;
    let waits = 0;
    let releaseClosed: (response: Response) => void = () => undefined;
    const mints: string[] = [];
    mockShopFetch(async (input, init) => {
      const url = String(input);
      if (url === '/.well-known/lnurlp/ada') {
        links += 1;
        // Once the payment closed, the pending charge is today's plain Lightning request.
        return Response.json(links === 1 ? shopPayLink() : plainPayLink());
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url === '/pay/ada/invoice') {
        mints.push(String(init?.body));
        return Response.json({ pr: 'lnbc210n1mint', amountSats: 21 });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        waits += 1;
        if (waits === 1) {
          return new Response('slow down', { status: 429 });
        }
        if (waits === 2) {
          return Response.json({ status: 'Pending', paymentStatus: 'ended' });
        }
        return new Promise((resolve) => {
          releaseClosed = resolve;
        });
      }
      if (url === '/pay/ada') {
        profiles += 1;
      }
      return Response.json(chargeProfile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByText('Waiting for payment…')).toBeTruthy();
    expect(await screen.findByText('Ended', undefined, { timeout: 4000 })).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Bitcoin invoice' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pay with a Bitcoin wallet app' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    await waitFor(
      () => {
        expect(waits).toBe(3);
      },
      { timeout: 4000 },
    );
    expect(links).toBe(1);
    await act(async () => {
      releaseClosed(Response.json({ status: 'Expired', paymentStatus: 'ended' }));
    });
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(screen.queryByText('Ended')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    expect(screen.getByText('5:00 left')).toBeTruthy();
    expect(links).toBe(2);
    expect(mints).toEqual([JSON.stringify({ amountSats: 21 })]);
    const hrefs = captureHrefs(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Pay with a Bitcoin wallet app' }));
    });
    expect(hrefs).toEqual(['lightning:lnbc210n1mint']);
    await new Promise((resolve) => {
      setTimeout(resolve, 2_300);
    });
    expect(profiles).toBe(1);
    expect(fetchedUrls().filter((url) => url.startsWith('/lnurlp/wait/'))).toEqual([
      '/lnurlp/wait/p1',
      '/lnurlp/wait/p1',
      '/lnurlp/wait/p1?since=ended',
    ]);
  }, 15_000);

  it('never shows a closed payment again and lets Pay read the pay link of a live till', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let links = 0;
    let waits = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      if (url === '/.well-known/lnurlp/ada') {
        links += 1;
        return Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        waits += 1;
        return Response.json({ status: 'Cancelled', paymentStatus: 'ended' });
      }
      return Response.json(chargeProfile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect((await screen.findByRole('alert')).textContent).toBe('Could not create the invoice.');
    expect(links).toBe(2);
    expect(waits).toBe(1);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('5:00 left')).toBeTruthy();
    const pay = screen.getByRole('button', {
      name: 'Pay with a Bitcoin wallet app',
    }) as HTMLButtonElement;
    expect(pay.disabled).toBe(false);
    fireEvent.click(pay);
    await waitFor(() => {
      expect(links).toBe(3);
    });
    expect((await screen.findByRole('alert')).textContent).toBe('Could not create the invoice.');
    expect(waits).toBe(1);
    expect(postedInvoice()).toBe(false);
  });

  it('shows the amount form once the payment of a till that ran out is closed', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let links = 0;
    let releaseClosed: (response: Response) => void = () => undefined;
    let waits = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      if (url === '/.well-known/lnurlp/ada') {
        links += 1;
        return Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        waits += 1;
        if (waits === 1) {
          return Response.json({ status: 'Pending', paymentStatus: 'ended' });
        }
        return new Promise((resolve) => {
          releaseClosed = resolve;
        });
      }
      return Response.json(chargeProfile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByText('Ended')).toBeTruthy();
    now.mockReturnValue(FIXED + 300_001);
    await waitFor(
      () => {
        expect(waits).toBe(2);
      },
      { timeout: 4000 },
    );
    // The read with `since` is asked at once; let the page's clock see the till run out.
    await new Promise((resolve) => {
      setTimeout(resolve, 1_200);
    });
    expect(screen.getByText('Ended')).toBeTruthy();
    await act(async () => {
      releaseClosed(Response.json({ status: 'Expired', paymentStatus: 'ended' }));
    });
    expect(await screen.findByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.getByLabelText('Amount')).toBeTruthy();
    expect(screen.queryByText('Ended')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/left/)).toBeNull();
    expect(links).toBe(1);
  }, 10_000);

  it('returns an entered amount whose payment closed unpaid to the amount form', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let opens = 0;
    let waits = 0;
    let releaseClosed: (response: Response) => void = () => undefined;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      if (url === '/pay/ada/payment') {
        opens += 1;
        return Response.json({
          payment: 'p1',
          expiresAt: new Date(FIXED + 300_000).toISOString(),
        });
      }
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        waits += 1;
        if (waits === 1) {
          return Response.json({ status: 'Pending', paymentStatus: 'ended' });
        }
        return new Promise((resolve) => {
          releaseClosed = resolve;
        });
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    expect(await screen.findByText('Ended')).toBeTruthy();
    expect(screen.queryByLabelText('Amount')).toBeNull();
    await waitFor(() => {
      expect(waits).toBe(2);
    });
    await act(async () => {
      releaseClosed(Response.json({ status: 'Cancelled', paymentStatus: 'ended' }));
    });
    const continueButton = (await screen.findByRole(
      'button',
      { name: 'Continue' },
      { timeout: 4000 },
    )) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(false);
    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('21');
    expect(screen.queryByText('Ended')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/left/)).toBeNull();
    expect(opens).toBe(1);
    expect(waits).toBe(2);
    expect(postedInvoice()).toBe(false);
  }, 10_000);

  it("starts a till's payment again from the pay link once when the api does not know it", async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let profiles = 0;
    let links = 0;
    const waitUrls: string[] = [];
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/.well-known/lnurlp/ada') {
        links += 1;
        return Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        waitUrls.push(url);
        return Response.json(API_NOT_FOUND, { status: 404 });
      }
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      if (url === '/pay/ada') {
        profiles += 1;
      }
      return Response.json(chargeProfile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByText('Waiting for payment…')).toBeTruthy();
    await waitFor(
      () => {
        expect(waitUrls).toHaveLength(3);
      },
      { timeout: 4000 },
    );
    // The pay link still names the payment for the charge's sats: the view stays, the status is
    // followed from the start, and the profile is not loaded again.
    expect(waitUrls.slice(0, 2)).toEqual(['/lnurlp/wait/p1', '/lnurlp/wait/p1']);
    expect(links).toBe(2);
    expect(profiles).toBe(1);
    expect(screen.getByText('Waiting for payment…')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(postedInvoice()).toBe(false);
  }, 10_000);

  it.each([
    ["a till's payment", true],
    ["a payer's payment", false],
  ])("drops the restart's pay link read when the page left %s meanwhile", async (_name, till) => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    const bob = encodeLnurl('https://21.gifts/.well-known/lnurlp/bob');
    let links = 0;
    let waits = 0;
    let releaseRestart: (response: Response) => void = () => undefined;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/pay/ada/payment') {
        return Response.json({ payment: 'p1' });
      }
      if (url === '/.well-known/lnurlp/ada') {
        links += 1;
        if (links === 2) {
          return new Promise((resolve) => {
            releaseRestart = resolve;
          });
        }
        return Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        waits += 1;
        return Response.json(API_NOT_FOUND, { status: 404 });
      }
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      if (url === '/pay/bob') {
        return Response.json({ name: 'Bob', username: 'bob', minSats: 1, maxSats: 100 });
      }
      return Response.json(till ? chargeProfile : profile);
    });
    const view = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    if (!till) {
      await enterAmount();
    }
    await waitFor(() => {
      expect(links).toBe(2);
    });
    // The page leaves the payment while the restart's read is held: another pay link is shown.
    view.rerender(<PayLinkScreen lightning={bob} />);
    expect(await screen.findByRole('heading', { name: 'Bob' })).toBeTruthy();
    await act(async () => {
      releaseRestart(Response.json(shopPayLink({ payment: 'p2' })));
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });
    });
    // The late answer neither loads a profile again nor asks Bob's payer for an amount again.
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Bob' })).toBeTruthy();
    expect(fetchedUrls().filter((url) => url === '/pay/ada')).toHaveLength(1);
    expect(fetchedUrls().filter((url) => url === '/pay/bob')).toHaveLength(1);
    expect(waits).toBe(1);
    expect(links).toBe(2);
    expect(postedInvoice()).toBe(false);
  });

  it("loads a till's profile again when the restart's pay link names another payment", async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let profiles = 0;
    let links = 0;
    let waits = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/.well-known/lnurlp/ada') {
        links += 1;
        return Response.json(shopPayLink({ payment: links === 1 ? 'p1' : 'p2' }));
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        waits += 1;
        return waits === 1 ? Response.json(API_NOT_FOUND, { status: 404 }) : pending();
      }
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      if (url === '/pay/ada') {
        profiles += 1;
      }
      return Response.json(chargeProfile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await waitFor(() => {
      expect(profiles).toBe(2);
    });
    expect(await screen.findByText('Waiting for payment…')).toBeTruthy();
    await waitFor(() => {
      expect(fetchedUrls()).toContain('/lnurlp/wait/p2');
    });
    expect(links).toBe(3);
    expect(postedInvoice()).toBe(false);
  });

  it("restores a payer's payment when the pay link still names it after the api did not know it", async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let links = 0;
    const waitUrls: string[] = [];
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/pay/ada/payment') {
        return Response.json({ payment: 'p1', expiresAt: new Date(FIXED + 300_000).toISOString() });
      }
      if (url === '/.well-known/lnurlp/ada') {
        links += 1;
        // The first read after opening fails, so the restart's read brings the pay request.
        return links === 1 ? new Response('busy', { status: 503 }) : Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        waitUrls.push(url);
        if (waitUrls.length === 1) {
          return Response.json(API_NOT_FOUND, { status: 404 });
        }
        return url.includes('since=')
          ? pending()
          : Response.json({ status: 'Pending', paymentStatus: 'open' });
      }
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    await waitFor(() => {
      expect(waitUrls).toEqual([
        '/lnurlp/wait/p1',
        '/lnurlp/wait/p1',
        '/lnurlp/wait/p1?since=open',
      ]);
    });
    expect(links).toBe(2);
    expect(screen.getByText('Waiting for payment…')).toBeTruthy();
    expect(screen.getByText('5:00 left')).toBeTruthy();
    expect(screen.queryByLabelText('Amount')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(fetchedUrls().filter((url) => url === '/pay/ada')).toHaveLength(1);
    expect(fetchedUrls().filter((url) => url === '/pay/ada/payment')).toHaveLength(1);
    expect(postedInvoice()).toBe(false);
  });

  it.each([
    ['another payment', () => Response.json(shopPayLink({ payment: 'p2' }))],
    ['other sats', () => Response.json(shopPayLink({ sats: 22 }))],
    ['the plain request', () => Response.json(plainPayLink())],
  ])(
    "asks for a payer's amount again when the api did not know it and the pay link shows %s",
    async (_name, restartLink) => {
      vi.spyOn(Date, 'now').mockReturnValue(FIXED);
      let links = 0;
      let waits = 0;
      mockShopFetch(async (input) => {
        const url = String(input);
        if (url === '/pay/ada/payment') {
          return Response.json({ payment: 'p1' });
        }
        if (url === '/.well-known/lnurlp/ada') {
          links += 1;
          return links === 1 ? Response.json(shopPayLink()) : restartLink();
        }
        if (url === DETAIL) {
          return Response.json({ pr: 'lnbc210n1shop' });
        }
        if (url.startsWith('/lnurlp/wait/')) {
          waits += 1;
          return waits === 1 ? Response.json(API_NOT_FOUND, { status: 404 }) : pending();
        }
        if (url.endsWith('/invoice')) {
          throw new Error('should not mint');
        }
        return Response.json(profile);
      });
      renderWithLocale(<PayLinkScreen lightning={ADA} />);
      await enterAmount();
      expect((await screen.findByRole('alert')).textContent).toBe(
        'Another payer entered an amount first. Enter yours again.',
      );
      expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('21');
      expect(screen.queryByText('Waiting for payment…')).toBeNull();
      expect(links).toBe(2);
      expect(waits).toBe(1);
      expect(fetchedUrls().filter((url) => url === '/pay/ada')).toHaveLength(1);
      expect(postedInvoice()).toBe(false);
    },
  );

  it("asks for a payer's amount again after a till charge ran out on the page", async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let links = 0;
    let waits = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/pay/ada/payment') {
        return Response.json({ payment: 'p1' });
      }
      if (url === '/.well-known/lnurlp/ada') {
        links += 1;
        if (links === 1) {
          // The till's read fails; its charge then runs out on the page.
          return new Response('busy', { status: 503 });
        }
        return Response.json(shopPayLink({ payment: links === 2 ? 'p1' : 'p2' }));
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        waits += 1;
        return waits === 1 ? Response.json(API_NOT_FOUND, { status: 404 }) : pending();
      }
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      return Response.json({
        ...profile,
        charge: { amountSats: 21, expiresAt: new Date(FIXED + 1_000).toISOString() },
      });
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect((await screen.findByRole('alert')).textContent).toBe('Could not create the invoice.');
    now.mockReturnValue(FIXED + 1_001);
    expect(await screen.findByRole('button', { name: 'Continue' }, { timeout: 4000 })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    // The charge stays in the profile; the payment this payer opens is still the payer's.
    await enterAmount();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Another payer entered an amount first. Enter yours again.',
    );
    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('21');
    expect(screen.queryByText('Waiting for payment…')).toBeNull();
    expect(links).toBe(3);
    expect(waits).toBe(1);
    expect(fetchedUrls().filter((url) => url === '/pay/ada')).toHaveLength(1);
    expect(fetchedUrls().filter((url) => url === '/pay/ada/payment')).toHaveLength(1);
    expect(postedInvoice()).toBe(false);
  }, 10_000);

  it.each([
    ['another payment', () => Response.json(shopPayLink({ payment: 'p2' }))],
    ['the plain request', () => Response.json(plainPayLink())],
  ])(
    "loads a till's profile again when its charge ran out on the page and the restart's pay link shows %s",
    async (_name, restartLink) => {
      const now = vi.spyOn(Date, 'now').mockReturnValue(FIXED);
      let profiles = 0;
      let links = 0;
      let waits = 0;
      let releaseWait: (response: Response) => void = () => undefined;
      mockShopFetch(async (input) => {
        const url = String(input);
        if (url === '/.well-known/lnurlp/ada') {
          links += 1;
          if (links === 1) {
            return Response.json(shopPayLink());
          }
          return links === 2 ? restartLink() : Response.json(shopPayLink({ payment: 'p2' }));
        }
        if (url === DETAIL) {
          return Response.json({ pr: 'lnbc210n1shop' });
        }
        if (url.startsWith('/lnurlp/wait/')) {
          waits += 1;
          if (waits === 1) {
            return new Promise((resolve) => {
              releaseWait = resolve;
            });
          }
          // A later read of p1 would come only from a restarted follow of the same payment.
          return url.startsWith('/lnurlp/wait/p1')
            ? Response.json(API_NOT_FOUND, { status: 404 })
            : pending();
        }
        if (url.endsWith('/invoice') || url === '/pay/ada/payment') {
          throw new Error('should not mint');
        }
        if (url === '/pay/ada') {
          profiles += 1;
        }
        // The first charge runs out 1 s after the page loaded; the reloaded one is live.
        const expiresAt = profiles <= 1 ? FIXED + 1_000 : FIXED + 301_001;
        return Response.json({
          ...chargeProfile,
          charge: { amountSats: 21, expiresAt: new Date(expiresAt).toISOString() },
        });
      });
      renderWithLocale(<PayLinkScreen lightning={ADA} />);
      expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
      expect(waits).toBe(1);
      // The till's own payment p1 is shown with its charge's window; the charge then runs out
      // on the page, while the quote (90 s) stays live.
      expect(screen.getByText('0:01 left')).toBeTruthy();
      now.mockReturnValue(FIXED + 1_001);
      await waitFor(
        () => {
          expect(screen.getAllByText(/left/).map((node) => node.textContent)).toEqual([
            '1:29 left',
          ]);
        },
        { timeout: 3000 },
      );
      expect(screen.getByText('Waiting for payment…')).toBeTruthy();
      // Only now does the first wait answer that the api does not know p1.
      await act(async () => {
        releaseWait(Response.json(API_NOT_FOUND, { status: 404 }));
      });
      // The payment was shown for the till's charge: the till's flow starts again from its
      // profile, and the payer is never asked for an amount.
      await waitFor(() => {
        expect(profiles).toBe(2);
      });
      await waitFor(() => {
        expect(fetchedUrls()).toContain('/lnurlp/wait/p2');
      });
      expect(fetchedUrls().filter((url) => url === '/pay/ada')).toHaveLength(2);
      expect(links).toBe(3);
      expect(fetchedUrls().filter((url) => url.startsWith('/lnurlp/wait/p1'))).toHaveLength(1);
      expect(screen.getByText('Waiting for payment…')).toBeTruthy();
      expect(
        screen.queryByText('Another payer entered an amount first. Enter yours again.'),
      ).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.queryByLabelText('Amount')).toBeNull();
      expect(postedInvoice()).toBe(false);
    },
    10_000,
  );

  it("keeps a payer's payment when the restart's pay link cannot be read, and reads it again", async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let links = 0;
    let waits = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/pay/ada/payment') {
        return Response.json({ payment: 'p1' });
      }
      if (url === '/.well-known/lnurlp/ada') {
        links += 1;
        return links === 2 ? new Response('busy', { status: 503 }) : Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        waits += 1;
        return waits <= 2 ? Response.json(API_NOT_FOUND, { status: 404 }) : pending();
      }
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    await waitFor(
      () => {
        expect(waits).toBe(3);
      },
      { timeout: 4000 },
    );
    // The failed read used up nothing: the second `missing` read the pay link again.
    expect(links).toBe(3);
    expect(screen.getByText('Waiting for payment…')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(postedInvoice()).toBe(false);
  }, 10_000);

  it('reads the wait route again after a 404 that is not the api answer', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let profiles = 0;
    let waits = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        waits += 1;
        return new Response('<!doctype html><h1>404</h1>', { status: 404 });
      }
      if (url === '/pay/ada') {
        profiles += 1;
      }
      return Response.json(chargeProfile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    await waitFor(
      () => {
        expect(waits).toBe(2);
      },
      { timeout: 4000 },
    );
    expect(profiles).toBe(1);
    expect(screen.getByText('Waiting for payment…')).toBeTruthy();
  }, 10_000);

  it('stops reading the pay link of an opened payment once it is on its way', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let links = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/pay/ada/payment') {
        return Response.json({ payment: 'p1' });
      }
      if (url === '/.well-known/lnurlp/ada') {
        links += 1;
        return links === 1 ? new Response('busy', { status: 503 }) : Response.json(plainPayLink());
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return url.includes('since=')
          ? pending()
          : Response.json({ status: 'Pending', paymentStatus: 'accepted' });
      }
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    expect(await screen.findByText('On its way')).toBeTruthy();
    await new Promise((resolve) => {
      setTimeout(resolve, 2_500);
    });
    expect(screen.getByText('On its way')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByLabelText('Amount')).toBeNull();
    expect(links).toBe(1);
  }, 10_000);
  it('keeps an open payment payable after its window ends', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return pending();
      }
      return Response.json(chargeProfile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    vi.spyOn(Date, 'now').mockReturnValue(FIXED + 300_001);
    await waitFor(
      () => {
        expect(screen.queryByText(/left/)).toBeNull();
      },
      { timeout: 3000 },
    );
    expect(screen.getByText('Waiting for payment…')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pay with a Bitcoin wallet app' })).toBeTruthy();
    expect(screen.queryByText('Ended')).toBeNull();
  });

  it('keeps a newer Lightning detail when an older load fails later', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let details = 0;
    let waits = 0;
    let releaseOlder: (response: Response) => void = () => undefined;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        details += 1;
        if (details === 1) {
          return new Promise((resolve) => {
            releaseOlder = resolve;
          });
        }
        return Response.json({ pr: 'lnbc210n1new' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        waits += 1;
        return waits === 1 ? Response.json(API_NOT_FOUND, { status: 404 }) : pending();
      }
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      return Response.json(chargeProfile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(details).toBe(2);
    await act(async () => {
      releaseOlder(new Response('expired', { status: 404 }));
    });
    expect(screen.getByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    const pay = screen.getByRole('button', { name: 'Pay with a Bitcoin wallet app' });
    expect((pay as HTMLButtonElement).disabled).toBe(false);
    expect(captureHrefs(() => fireEvent.click(pay))).toEqual(['lightning:lnbc210n1new']);
  });

  it('keeps a newer Lightning-detail failure when an older load succeeds later', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let details = 0;
    let waits = 0;
    let releaseOlder: (response: Response) => void = () => undefined;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        details += 1;
        if (details === 1) {
          return new Promise((resolve) => {
            releaseOlder = resolve;
          });
        }
        return new Response('expired', { status: 404 });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        waits += 1;
        return waits === 1 ? Response.json(API_NOT_FOUND, { status: 404 }) : pending();
      }
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      return Response.json(chargeProfile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect((await screen.findByRole('alert')).textContent).toBe('Could not create the invoice.');
    expect(details).toBe(2);
    await act(async () => {
      releaseOlder(Response.json({ pr: 'lnbc210n1old' }));
    });
    expect(screen.getByRole('alert').textContent).toBe('Could not create the invoice.');
    expect(screen.queryByRole('img', { name: 'Bitcoin invoice' })).toBeNull();
    expect(
      (
        screen.getByRole('button', {
          name: 'Pay with a Bitcoin wallet app',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it('retries a failed Lightning detail from Pay without minting', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let details = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        details += 1;
        return details === 1
          ? new Response('expired', { status: 404 })
          : Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return pending();
      }
      return Response.json(chargeProfile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect((await screen.findByRole('alert')).textContent).toBe('Could not create the invoice.');
    const pay = screen.getByRole('button', { name: 'Pay with a Bitcoin wallet app' });
    expect((pay as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(pay);
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(details).toBe(2);
  });

  it('hides the run-out quote lines while a refetch fails and shows the new quote', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let links = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/.well-known/lnurlp/ada') {
        links += 1;
        if (links === 1) {
          return Response.json(shopPayLink({ expiresInMs: 300 }));
        }
        if (links === 2) {
          return new Response('busy', { status: 503 });
        }
        return Response.json(shopPayLink({ quote: 'q2', method: 'Arbitrum' }));
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return pending();
      }
      return Response.json(chargeProfile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByText('Polygon')).toBeTruthy();
    vi.spyOn(Date, 'now').mockReturnValue(FIXED + 301);
    await waitFor(() => {
      expect(links).toBe(2);
    });
    await waitFor(
      () => {
        expect(screen.queryByText('Polygon')).toBeNull();
      },
      { timeout: 2000 },
    );
    expect(links).toBe(2);
    expect(screen.getByText('Waiting for payment…')).toBeTruthy();
    expect(await screen.findByText('Arbitrum', undefined, { timeout: 4000 })).toBeTruthy();
    expect(screen.queryByText('Polygon')).toBeNull();
    expect(links).toBe(3);
  }, 10_000);

  it('shows the till error without minting when the pay link cannot be read', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let links = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      if (url === '/.well-known/lnurlp/ada') {
        links += 1;
        return links === 1 ? new Response('busy', { status: 503 }) : Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return pending();
      }
      return Response.json(chargeProfile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect((await screen.findByRole('alert')).textContent).toBe('Could not create the invoice.');
    expect(screen.queryByRole('img', { name: 'Bitcoin invoice' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pay with a Bitcoin wallet app' }));
    expect(await screen.findByText('Waiting for payment…')).toBeTruthy();
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(links).toBe(2);
    expect(postedInvoice()).toBe(false);
  });

  it('refetches the pay link when the quote expires', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let links = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      if (url === '/.well-known/lnurlp/ada') {
        links += 1;
        if (links === 1) {
          return Response.json(shopPayLink({ expiresInMs: 600 }));
        }
        if (links === 2) {
          return Response.json(
            shopPayLink({ quote: 'q2', method: 'Arbitrum', expiresInMs: 1_200 }),
          );
        }
        return Response.json(shopPayLink({ quote: 'q3', method: 'Ethereum' }));
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return pending();
      }
      return Response.json(chargeProfile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByText('Polygon')).toBeTruthy();
    expect(await screen.findByText('Arbitrum', undefined, { timeout: 3000 })).toBeTruthy();
    expect(screen.queryByText('Polygon')).toBeNull();
    expect(await screen.findByText('Ethereum', undefined, { timeout: 3000 })).toBeTruthy();
    expect(screen.queryByText('Arbitrum')).toBeNull();
    expect(links).toBe(3);
    expect(screen.getByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(fetchedUrls().filter((url) => url.startsWith(CALLBACK))).toEqual([DETAIL]);
    expect(new Set(fetchedUrls().filter((url) => url.startsWith('/lnurlp/wait/')))).toEqual(
      new Set(['/lnurlp/wait/p1']),
    );
    expect(postedInvoice()).toBe(false);
  });

  it('hides the lines but keeps its own invoice when the pay link names another payment', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let links = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      if (url === '/.well-known/lnurlp/ada') {
        links += 1;
        return Response.json(
          links === 1
            ? shopPayLink({ expiresInMs: 600 })
            : shopPayLink({ payment: 'p2', quote: 'q2' }),
        );
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return pending();
      }
      return Response.json(chargeProfile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByText('Polygon')).toBeTruthy();
    await waitFor(
      () => {
        expect(screen.queryByText('Polygon')).toBeNull();
      },
      { timeout: 3000 },
    );
    expect(links).toBe(2);
    expect(screen.getByText('Waiting for payment…')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(fetchedUrls().filter((url) => url.startsWith(CALLBACK))).toEqual([DETAIL]);
    expect(fetchedUrls().some((url) => url.includes('/lnurlp/wait/p2'))).toBe(false);
    expect(postedInvoice()).toBe(false);
  });
  it('ignores a quote refetch that arrives after unmount', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let links = 0;
    let release: (response: Response) => void = () => undefined;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/.well-known/lnurlp/ada') {
        links += 1;
        if (links === 1) {
          return Response.json(shopPayLink({ expiresInMs: 300 }));
        }
        return new Promise((resolve) => {
          release = resolve;
        });
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return pending();
      }
      return Response.json(chargeProfile);
    });
    const view = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByText('Polygon')).toBeTruthy();
    await waitFor(() => {
      expect(links).toBe(2);
    });
    vi.spyOn(Date, 'now').mockReturnValue(FIXED + 1_000);
    await waitFor(() => {
      expect(screen.queryByText('Polygon')).toBeNull();
    });
    expect(screen.getByText('Waiting for payment…')).toBeTruthy();
    view.unmount();
    await act(async () => {
      release(Response.json(shopPayLink({ quote: 'q2', expiresInMs: 1_300 })));
    });
    expect(links).toBe(2);
    await new Promise((resolve) => {
      setTimeout(resolve, 2_500);
    });
    expect(links).toBe(2);
  }, 10_000);

  it('opens a payer payment and checks that the pay link carries it', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    const bodies: string[] = [];
    mockShopFetch(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      if (url === '/pay/ada/payment') {
        bodies.push(String(init?.body));
        return Response.json({
          payment: 'p1',
          expiresAt: new Date(FIXED + 300_000).toISOString(),
        });
      }
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return pending();
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(bodies).toEqual([JSON.stringify({ amountSats: 21 })]);
    expect(screen.getByText('5:00 left')).toBeTruthy();
    expect(screen.getByText('0.2 USDT')).toBeTruthy();
    expect(screen.queryByLabelText('Amount')).toBeNull();
  });

  /**
   * A shop payment of the pay link with a USD spot rate; `starts` holds each start body, and
   * `linkSats` is the payment's sats on the pay link (by default the sats of the last start, as
   * the api names the payer's amount, or 21 before any start).
   */
  function mockPricedShop(
    starts: string[],
    profileBody: object = profile,
    linkSats?: number,
  ): void {
    mockShopFetch(async (input, init) => {
      const url = String(input);
      if (url.includes('/fx/spot')) {
        return Response.json({
          asOf: '2026-09-24T00:00:00.000Z',
          source: 'test',
          rates: { USD: '84000.00' },
        });
      }
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      if (url === '/pay/ada/payment') {
        starts.push(String(init?.body));
        return Response.json({ payment: 'p1', expiresAt: new Date(FIXED + 300_000).toISOString() });
      }
      if (url === '/.well-known/lnurlp/ada') {
        const last = starts.at(-1);
        const started =
          last === undefined ? 21 : (JSON.parse(last) as { amountSats: number }).amountSats;
        return Response.json(shopPayLink({ sats: linkSats ?? started }));
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return pending();
      }
      return Response.json(profileBody);
    });
  }

  it('shows a fiat amount exactly as the payer typed it beside the bitcoin', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    const starts: string[] = [];
    mockPricedShop(starts, { ...profile, maxSats: 100_000_000 });
    renderWithLocale(<PayLinkScreen lightning={ADA} />, 'en', 'ch', 'USD');
    await screen.findByRole('heading', { name: 'Ada Lovelace' });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'USD' })).toHaveProperty('disabled', false);
    });
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1234,125' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(starts).toHaveLength(1);
    const sats = (JSON.parse(starts[0] as string) as { amountSats: number }).amountSats;
    // The typed digits, every one of them, not the sats converted back through the spot.
    expect(screen.getByText("$1'234.125")).toBeTruthy();
    expect(screen.getByText(formatBitcoin(sats, 'ch'))).toBeTruthy();
    expect(screen.queryByText("$1'234.13")).toBeNull();
    expect(screen.queryByText("$1'234.12")).toBeNull();
  });

  it('pads a typed fiat amount to two decimals without rounding it', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    const starts: string[] = [];
    mockPricedShop(starts, { ...profile, maxSats: 100_000_000 });
    renderWithLocale(<PayLinkScreen lightning={ADA} />, 'en', 'ch', 'USD');
    await screen.findByRole('heading', { name: 'Ada Lovelace' });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'USD' })).toHaveProperty('disabled', false);
    });
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: ' 5 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(screen.getByText('$5.00')).toBeTruthy();
  });

  it('shows only bitcoin for an amount typed in bitcoin, even with a spot rate', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    const starts: string[] = [];
    mockPricedShop(starts, { ...profile, maxSats: 300_000 });
    renderWithLocale(<PayLinkScreen lightning={ADA} />, 'en', 'ch', 'USD');
    await screen.findByRole('heading', { name: 'Ada Lovelace' });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'USD' })).toHaveProperty('disabled', false);
    });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '238093' } });
    // The live counter under the field may use the spot while bitcoin is still typed.
    expect(screen.getByText(/\$200\.00/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(starts).toEqual([JSON.stringify({ amountSats: 238093 })]);
    expect(screen.getByText("₿238'093")).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it("shows only bitcoin for a till's shop payment, even with a spot rate", async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    mockPricedShop(
      [],
      {
        ...profile,
        charge: { amountSats: 238093, expiresAt: new Date(FIXED + 300_000).toISOString() },
      },
      238093,
    );
    renderWithLocale(<PayLinkScreen lightning={ADA} />, 'en', 'ch', 'USD');
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    await waitFor(() => {
      expect(fetchedUrls().some((url) => url.includes('/fx/spot'))).toBe(true);
    });
    // Give the spot answer time to land: it would have priced the bitcoin if anything did.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.getByText("₿238'093")).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('asks again when another payer replaced the amount', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/pay/ada/payment') {
        return Response.json({
          payment: 'p1',
          expiresAt: new Date(FIXED + 300_000).toISOString(),
        });
      }
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json(shopPayLink({ payment: 'p2' }));
      }
      if (url.endsWith('/invoice') || url.startsWith(CALLBACK) || url.startsWith('/lnurlp/')) {
        throw new Error(`unexpected ${url}`);
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Another payer entered an amount first. Enter yours again.',
    );
    expect(screen.getByLabelText('Amount')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
  });

  it('asks again when the pay link names the opened payment for other sats', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/pay/ada/payment') {
        return Response.json({
          payment: 'p1',
          expiresAt: new Date(FIXED + 300_000).toISOString(),
        });
      }
      if (url === '/.well-known/lnurlp/ada') {
        // The same payment id, but 50 sats instead of the 21 entered.
        return Response.json(shopPayLink({ sats: 50 }));
      }
      if (url.endsWith('/invoice') || url.startsWith(CALLBACK) || url.startsWith('/lnurlp/')) {
        throw new Error(`unexpected ${url}`);
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Another payer entered an amount first. Enter yours again.',
    );
    expect(screen.getByLabelText('Amount')).toBeTruthy();
    expect(screen.queryByText('Waiting for payment…')).toBeNull();
    expect(screen.queryByText('₿50')).toBeNull();
    expect(fetchedUrls().some((url) => url.startsWith(CALLBACK))).toBe(false);
    expect(postedInvoice()).toBe(false);
  });

  it('asks again when the pay link is already plain right after opening', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let links = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/pay/ada/payment') {
        return Response.json({
          payment: 'p1',
          expiresAt: new Date(FIXED + 300_000).toISOString(),
        });
      }
      if (url === '/.well-known/lnurlp/ada') {
        links += 1;
        return Response.json(plainPayLink());
      }
      if (url.endsWith('/invoice') || url.startsWith(CALLBACK) || url.startsWith('/lnurlp/')) {
        throw new Error(`unexpected ${url}`);
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Another payer entered an amount first. Enter yours again.',
    );
    expect(screen.getByLabelText('Amount')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.queryByText('Waiting for payment…')).toBeNull();
    expect(screen.queryByText('Ended')).toBeNull();
    expect(links).toBe(1);
    expect(postedInvoice()).toBe(false);
  });

  it('keeps an opened payment whose unreadable pay link turns plain and shows the status the wait poll reads', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    const cases = [
      { paymentStatus: 'accepted', line: 'On its way' },
      { paymentStatus: 'ended', line: 'Ended' },
    ];
    for (const { paymentStatus, line } of cases) {
      let links = 0;
      let release: (response: Response) => void = () => undefined;
      mockShopFetch(async (input) => {
        const url = String(input);
        if (url === '/pay/ada/payment') {
          return Response.json({
            payment: 'p1',
            expiresAt: new Date(FIXED + 300_000).toISOString(),
          });
        }
        if (url === '/.well-known/lnurlp/ada') {
          links += 1;
          return links === 1
            ? new Response('busy', { status: 503 })
            : Response.json(plainPayLink());
        }
        if (url === '/lnurlp/wait/p1') {
          return Response.json({ status: 'Pending', paymentStatus: 'open' });
        }
        if (url === '/lnurlp/wait/p1?since=open') {
          return new Promise((resolve) => {
            release = resolve;
          });
        }
        if (url.startsWith('/lnurlp/wait/')) {
          return pending();
        }
        if (url.endsWith('/invoice') || url.startsWith(CALLBACK)) {
          throw new Error(`unexpected ${url}`);
        }
        return Response.json(profile);
      });
      const view = renderWithLocale(<PayLinkScreen lightning={ADA} />);
      await enterAmount();
      expect(await screen.findByText('Waiting for payment…')).toBeTruthy();
      await waitFor(
        () => {
          expect(links).toBe(2);
        },
        { timeout: 4000 },
      );
      expect(screen.getByText('Waiting for payment…')).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.queryByLabelText('Amount')).toBeNull();
      expect(
        (screen.getByRole('button', { name: 'Pay with a Bitcoin wallet app' }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
      await waitFor(() => {
        expect(fetchedUrls()).toContain('/lnurlp/wait/p1?since=open');
      });
      await act(async () => {
        release(Response.json({ status: 'Pending', paymentStatus }));
      });
      expect(await screen.findByText(line)).toBeTruthy();
      await new Promise((resolve) => {
        setTimeout(resolve, 2_300);
      });
      expect(screen.getByText(line)).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.queryByLabelText('Amount')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
      expect(links).toBe(2);
      expect(postedInvoice()).toBe(false);
      view.unmount();
    }
  }, 30_000);

  it('keeps the opened payment and reads the pay link again when it cannot be read', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let links = 0;
    let starts = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      if (url === '/pay/ada/payment') {
        starts += 1;
        return Response.json({
          payment: 'p1',
          expiresAt: new Date(FIXED + 300_000).toISOString(),
        });
      }
      if (url === '/.well-known/lnurlp/ada') {
        links += 1;
        return links <= 2 ? new Response('busy', { status: 503 }) : Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return pending();
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    expect(await screen.findByText('Waiting for payment…')).toBeTruthy();
    expect(screen.queryByText('This payment could not be started. Try again.')).toBeNull();
    expect(screen.queryByLabelText('Amount')).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Pay with a Bitcoin wallet app' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(fetchedUrls()).toContain('/lnurlp/wait/p1');
    expect(
      await screen.findByRole('img', { name: 'Bitcoin invoice' }, { timeout: 6000 }),
    ).toBeTruthy();
    expect(links).toBe(3);
    expect(starts).toBe(1);
    expect(screen.getByText('0.2 USDT')).toBeTruthy();
  }, 10_000);

  it('returns to the amount field when the pay link read again names another payment', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let links = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/pay/ada/payment') {
        return Response.json({ payment: 'p1' });
      }
      if (url === '/.well-known/lnurlp/ada') {
        links += 1;
        return links === 1
          ? new Response('busy', { status: 503 })
          : Response.json(shopPayLink({ payment: 'p2' }));
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return pending();
      }
      if (url.endsWith('/invoice') || url.startsWith(CALLBACK)) {
        throw new Error(`unexpected ${url}`);
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    expect(await screen.findByText('Waiting for payment…')).toBeTruthy();
    expect((await screen.findByRole('alert', undefined, { timeout: 4000 })).textContent).toBe(
      'Another payer entered an amount first. Enter yours again.',
    );
    expect(screen.getByLabelText('Amount')).toBeTruthy();
    expect(screen.queryByText('Waiting for payment…')).toBeNull();
  }, 10_000);

  it('returns to the amount field when the pay link read again names the payment for other sats', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let links = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/pay/ada/payment') {
        return Response.json({ payment: 'p1' });
      }
      if (url === '/.well-known/lnurlp/ada') {
        links += 1;
        return links === 1
          ? new Response('busy', { status: 503 })
          : Response.json(shopPayLink({ sats: 50 }));
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return pending();
      }
      if (url.endsWith('/invoice') || url.startsWith(CALLBACK)) {
        throw new Error(`unexpected ${url}`);
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    expect(await screen.findByText('Waiting for payment…')).toBeTruthy();
    expect((await screen.findByRole('alert', undefined, { timeout: 4000 })).textContent).toBe(
      'Another payer entered an amount first. Enter yours again.',
    );
    expect(screen.getByLabelText('Amount')).toBeTruthy();
    expect(screen.queryByText('Waiting for payment…')).toBeNull();
    expect(screen.queryByText('₿50')).toBeNull();
    expect(links).toBe(2);
  }, 10_000);

  it('stops reading the pay link of an opened payment after unmount', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let links = 0;
    let release: (response: Response) => void = () => undefined;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/pay/ada/payment') {
        return Response.json({ payment: 'p1' });
      }
      if (url === '/.well-known/lnurlp/ada') {
        links += 1;
        if (links === 1) {
          return new Response('busy', { status: 503 });
        }
        return new Promise((resolve) => {
          release = resolve;
        });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return pending();
      }
      return Response.json(profile);
    });
    const view = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    await waitFor(
      () => {
        expect(links).toBe(2);
      },
      { timeout: 4000 },
    );
    view.unmount();
    await act(async () => {
      release(new Response('busy', { status: 503 }));
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 2_300);
    });
    expect(links).toBe(2);
    expect(fetchedUrls().some((url) => url.startsWith(CALLBACK))).toBe(false);
  }, 10_000);

  it('repeats an unknown start once, then offers Continue again without minting', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let starts = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      if (url === '/pay/ada/payment') {
        starts += 1;
        if (starts <= 2) {
          return new Response('bad gateway', { status: 502 });
        }
        return Response.json({
          payment: 'p1',
          expiresAt: new Date(FIXED + 300_000).toISOString(),
        });
      }
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return pending();
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'This payment could not be started. Try again.',
    );
    expect(starts).toBe(2);
    expect(postedInvoice()).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(starts).toBe(3);
  });

  it('reloads and shows the till charge on payment_open', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let profiles = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/pay/ada/payment') {
        return Response.json(
          { error: 'A payment is already open', code: 'payment_open' },
          { status: 409 },
        );
      }
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json(plainPayLink());
      }
      if (url.endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 });
      }
      if (url === '/pay/ada') {
        profiles += 1;
      }
      return Response.json(profiles === 1 ? profile : chargeProfile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    expect(await screen.findByText('5:00 left')).toBeTruthy();
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(profiles).toBe(2);
    expect(screen.queryByText('Waiting for payment…')).toBeNull();
  });

  it('counts a reloaded till charge from now, not from when the page loaded', async () => {
    let clock = FIXED - 120_000;
    vi.spyOn(Date, 'now').mockImplementation(() => clock);
    let profiles = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/pay/ada/payment') {
        return Response.json(
          { error: 'A payment is already open', code: 'payment_open' },
          { status: 409 },
        );
      }
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json(plainPayLink());
      }
      if (url.endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 });
      }
      if (url === '/pay/ada') {
        profiles += 1;
      }
      return Response.json(profiles === 1 ? profile : chargeProfile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await screen.findByRole('heading', { name: 'Ada Lovelace' });
    // Every text the page ever paints, including values replaced before an effect ran.
    const painted: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'characterData') {
          painted.push(record.oldValue ?? '', record.target.textContent ?? '');
        }
        record.addedNodes.forEach((node) => painted.push(node.textContent ?? ''));
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      characterDataOldValue: true,
    });
    clock = FIXED;
    await enterAmount();
    expect(await screen.findByText('5:00 left')).toBeTruthy();
    observer.disconnect();
    expect(profiles).toBe(2);
    expect(painted.filter((text) => /7:00 left/.test(text))).toEqual([]);
  });

  it('mints on a 4xx answer of the payment route', async () => {
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/pay/ada/payment') {
        return Response.json({ error: 'Enter a whole number of sats' }, { status: 400 });
      }
      if (url.endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 });
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(postedInvoice()).toBe(true);
  });

  it('drops a start that answers after the link changes', async () => {
    const bob = encodeLnurl('https://21.gifts/.well-known/lnurlp/bob');
    const releases: ((response: Response) => void)[] = [];
    const signals: (AbortSignal | null | undefined)[] = [];
    mockShopFetch(async (input, init) => {
      const url = String(input);
      if (url === '/pay/ada/payment' || url === '/.well-known/lnurlp/ada') {
        signals.push(init?.signal);
        return new Promise((resolve) => {
          releases.push(resolve);
        });
      }
      if (url.endsWith('/pay/bob')) {
        return Response.json({ name: 'Bob', username: 'bob', minSats: 1, maxSats: 100 });
      }
      if (url.startsWith(CALLBACK) || url.startsWith('/lnurlp/')) {
        throw new Error(`unexpected ${url}`);
      }
      return Response.json(profile);
    });
    const view = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    await waitFor(() => {
      expect(releases).toHaveLength(1);
    });
    expect(signals[0]?.aborted).toBe(false);
    view.rerender(<PayLinkScreen lightning={bob} />);
    expect(await screen.findByRole('heading', { name: 'Bob' })).toBeTruthy();
    // Leaving the pay link aborts the start, so the api sees the page disconnect.
    expect(signals[0]?.aborted).toBe(true);
    releases[0]?.(
      Response.json({ payment: 'p1', expiresAt: new Date(Date.now() + 300_000).toISOString() }),
    );
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    expect(releases).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('drops a pay-link check that answers after the link changes', async () => {
    const bob = encodeLnurl('https://21.gifts/.well-known/lnurlp/bob');
    let releaseLink: (response: Response) => void = () => undefined;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/pay/ada/payment') {
        return Response.json({
          payment: 'p1',
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
        });
      }
      if (url === '/.well-known/lnurlp/ada') {
        return new Promise((resolve) => {
          releaseLink = resolve;
        });
      }
      if (url.endsWith('/pay/bob')) {
        return Response.json({ name: 'Bob', username: 'bob', minSats: 1, maxSats: 100 });
      }
      if (url.startsWith(CALLBACK)) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return pending();
      }
      return Response.json(profile);
    });
    const view = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    await waitFor(() => {
      expect(fetchedUrls()).toContain('/.well-known/lnurlp/ada');
    });
    view.rerender(<PayLinkScreen lightning={bob} />);
    expect(await screen.findByRole('heading', { name: 'Bob' })).toBeTruthy();
    releaseLink(Response.json(shopPayLink({ expiresInMs: Date.now() - FIXED + 90_000 })));
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    expect(fetchedUrls().some((url) => url.startsWith(CALLBACK))).toBe(false);
    expect(fetchedUrls().some((url) => url.startsWith('/lnurlp/wait/'))).toBe(false);
    expect(screen.queryByRole('img', { name: 'Bitcoin invoice' })).toBeNull();
    expect(screen.queryByText('0.2 USDT')).toBeNull();
    expect(screen.queryByText('Waiting for payment…')).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
  });

  it("drops a till's pay link and invoice that answer after the link changes", async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    const bob = encodeLnurl('https://21.gifts/.well-known/lnurlp/bob');
    let releaseLink: (response: Response) => void = () => undefined;
    const releaseDetails: ((response: Response) => void)[] = [];
    let round = 0;
    let mints = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/.well-known/lnurlp/ada') {
        round += 1;
        if (round === 1) {
          return new Promise((resolve) => {
            releaseLink = resolve;
          });
        }
        return Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        return new Promise((resolve) => {
          releaseDetails.push(resolve);
        });
      }
      if (url.endsWith('/pay/bob')) {
        return Response.json({ name: 'Bob', username: 'bob', minSats: 1, maxSats: 100 });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return pending();
      }
      if (url.endsWith('/invoice')) {
        mints += 1;
        return new Response('no', { status: 500 });
      }
      return Response.json(chargeProfile);
    });
    const view = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await waitFor(() => {
      expect(round).toBe(1);
    });
    view.rerender(<PayLinkScreen lightning={bob} />);
    expect(await screen.findByRole('heading', { name: 'Bob' })).toBeTruthy();
    await act(async () => {
      releaseLink(Response.json(shopPayLink()));
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    expect(screen.getByRole('heading', { name: 'Bob' })).toBeTruthy();
    expect(screen.queryByText('Waiting for payment…')).toBeNull();
    expect(screen.queryByText('0.2 USDT')).toBeNull();
    expect(
      fetchedUrls().filter((url) => url === DETAIL || url.startsWith('/lnurlp/wait/')),
    ).toEqual([]);
    view.rerender(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByText('Waiting for payment…')).toBeTruthy();
    expect(releaseDetails).toHaveLength(1);
    view.rerender(<PayLinkScreen lightning={bob} />);
    expect(await screen.findByRole('heading', { name: 'Bob' })).toBeTruthy();
    await act(async () => {
      releaseDetails[0]?.(Response.json({ pr: 'lnbc210n1shop' }));
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    expect(screen.queryByRole('img', { name: 'Bitcoin invoice' })).toBeNull();
    expect(screen.queryByText('Waiting for payment…')).toBeNull();
    expect(mints).toBe(0);
  });

  it('asks the wait route again at once after a waiting answer and stops when the page leaves', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let waits = 0;
    let held: AbortSignal | null | undefined;
    let releaseWait: (response: Response) => void = () => undefined;
    mockShopFetch(async (input, init) => {
      const url = String(input);
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        waits += 1;
        if (waits === 1) {
          return Response.json({ status: 'Pending', paymentStatus: 'open' });
        }
        held = init?.signal;
        return new Promise((resolve) => {
          releaseWait = resolve;
        });
      }
      return Response.json(chargeProfile);
    });
    const view = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByText('Waiting for payment…')).toBeTruthy();
    // No pause after a valid answer: the api holds the next read while the status is unchanged.
    await waitFor(
      () => {
        expect(waits).toBe(2);
      },
      { timeout: 500 },
    );
    expect(fetchedUrls().filter((url) => url.startsWith('/lnurlp/wait/'))).toEqual([
      '/lnurlp/wait/p1',
      '/lnurlp/wait/p1?since=open',
    ]);
    view.unmount();
    expect(held?.aborted).toBe(true);
    releaseWait(Response.json({ status: 'Pending', paymentStatus: 'accepted' }));
    await new Promise((resolve) => {
      setTimeout(resolve, 2_300);
    });
    expect(waits).toBe(2);
  }, 10_000);

  it('pauses 2 s only after a failed wait read and ends the pause when the page leaves', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let waits = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        waits += 1;
        return new Response('slow down', { status: 429 });
      }
      return Response.json(chargeProfile);
    });
    const first = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByText('Waiting for payment…')).toBeTruthy();
    await new Promise((resolve) => {
      setTimeout(resolve, 1_000);
    });
    expect(waits).toBe(1);
    await waitFor(
      () => {
        expect(waits).toBe(2);
      },
      { timeout: 2_000 },
    );
    expect(fetchedUrls().filter((url) => url.startsWith('/lnurlp/wait/'))).toEqual([
      '/lnurlp/wait/p1',
      '/lnurlp/wait/p1',
    ]);
    first.unmount();
    await new Promise((resolve) => {
      setTimeout(resolve, 2_300);
    });
    expect(waits).toBe(2);
  }, 10_000);

  it('shows only the quote time left when the opening answer has no window end', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/pay/ada/payment') {
        return Response.json({ payment: 'p1' });
      }
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return pending();
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(screen.getAllByText(/left/).map((node) => node.textContent)).toEqual(['1:30 left']);
    expect(fetchedUrls().filter((url) => url === '/pay/ada/payment')).toHaveLength(1);
  });

  it('counts the time left from the opening, not from when the page loaded', async () => {
    let clock = FIXED - 120_000;
    vi.spyOn(Date, 'now').mockImplementation(() => clock);
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/pay/ada/payment') {
        return Response.json({
          payment: 'p1',
          expiresAt: new Date(FIXED + 300_000).toISOString(),
        });
      }
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return pending();
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await screen.findByRole('heading', { name: 'Ada Lovelace' });
    // Every text the page ever paints, including values replaced before an effect ran.
    const painted: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'characterData') {
          painted.push(record.oldValue ?? '', record.target.textContent ?? '');
        }
        record.addedNodes.forEach((node) => painted.push(node.textContent ?? ''));
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      characterDataOldValue: true,
    });
    clock = FIXED;
    await enterAmount();
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    observer.disconnect();
    expect(screen.getAllByText(/left/).map((node) => node.textContent)).toEqual([
      '5:00 left',
      '1:30 left',
    ]);
    expect(painted.filter((text) => /7:00 left|3:30 left/.test(text))).toEqual([]);
  });

  it('reads the pay link again for the same or a past quote expiry', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let links = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/.well-known/lnurlp/ada') {
        links += 1;
        if (links <= 2) {
          return Response.json(shopPayLink({ expiresInMs: 300 }));
        }
        if (links === 3) {
          return Response.json(shopPayLink({ quote: 'q2', expiresInMs: -1_000 }));
        }
        return Response.json(shopPayLink({ quote: 'q3', method: 'Arbitrum' }));
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return pending();
      }
      return Response.json(chargeProfile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByText('Polygon')).toBeTruthy();
    await waitFor(
      () => {
        expect(links).toBe(3);
      },
      { timeout: 3000 },
    );
    await waitFor(() => {
      expect(screen.queryByText('Polygon')).toBeNull();
    });
    expect(links).toBe(3);
    expect(await screen.findByText('Arbitrum', undefined, { timeout: 4000 })).toBeTruthy();
    expect(links).toBe(4);
  }, 10_000);
  it('keeps Pay disabled without an invoice QR until the Lightning detail answers', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let releaseDetail: (response: Response) => void = () => undefined;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        return new Promise((resolve) => {
          releaseDetail = resolve;
        });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return pending();
      }
      return Response.json(chargeProfile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByText('0.2 USDT')).toBeTruthy();
    await waitFor(() => {
      expect(fetchedUrls()).toContain(DETAIL);
    });
    const pay = screen.getByRole('button', {
      name: 'Pay with a Bitcoin wallet app',
    }) as HTMLButtonElement;
    expect(pay.disabled).toBe(true);
    expect(screen.queryByRole('img', { name: 'Bitcoin invoice' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Waiting for payment…')).toBeTruthy();
    await act(async () => {
      releaseDetail(Response.json({ pr: 'lnbc210n1shop' }));
    });
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(pay.disabled).toBe(false);
  });

  it('shows the till error and mints nothing when the pay link is no real pay request', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        throw new Error('should not mint');
      }
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json({ status: 'ERROR', reason: 'Busy' });
      }
      return Response.json(chargeProfile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect((await screen.findByRole('alert')).textContent).toBe('Could not create the invoice.');
    expect(screen.queryByRole('img', { name: 'Bitcoin invoice' })).toBeNull();
    expect(postedInvoice()).toBe(false);
  });
});

/** A start that never answers until its signal aborts, as a lost request does. */
function hangingStart(init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      reject(new DOMException('aborted', 'AbortError'));
    });
  });
}

function stablecoinUnavailable(): Response {
  return Response.json(
    { error: 'Stablecoin payment is unavailable', code: 'stablecoin_unavailable' },
    { status: 503 },
  );
}

function mintBodies(): string[] {
  return vi
    .mocked(fetch)
    .mock.calls.filter((call) => String(call[0]) === '/pay/ada/invoice')
    .map((call) => String((call[1] as RequestInit | undefined)?.body));
}

function linkReads(): number {
  return fetchedUrls().filter((url) => url === '/.well-known/lnurlp/ada').length;
}

describe('PayLinkScreen ambiguous start', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits 20 s after a lost start before a refused repeat reads the pay link, then mints', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: FIXED });
    let starts = 0;
    mockShopFetch(async (input, init) => {
      const url = String(input);
      if (url === '/pay/ada/payment') {
        starts += 1;
        return starts === 1 ? hangingStart(init) : stablecoinUnavailable();
      }
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json(plainPayLink());
      }
      if (url === '/pay/ada/invoice') {
        return Response.json({ pr: 'lnbc210n1mint', amountSats: 21 });
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    await waitFor(() => {
      expect(starts).toBe(2);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(18_000);
    });
    expect(linkReads()).toBe(0);
    expect(mintBodies()).toEqual([]);
    expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_500);
    });
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(linkReads()).toBe(1);
    expect(mintBodies()).toEqual([JSON.stringify({ amountSats: 21 })]);
  }, 15_000);

  it('keeps the state for every Continue and any amount until a call returns a payment', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: FIXED });
    let starts = 0;
    let links = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/pay/ada/payment') {
        starts += 1;
        return starts === 1
          ? new Response('bad gateway', { status: 502 })
          : stablecoinUnavailable();
      }
      if (url === '/.well-known/lnurlp/ada') {
        links += 1;
        // Another payer's open amount, until it is gone on the third read.
        return Response.json(links < 3 ? shopPayLink({ payment: 'p9' }) : plainPayLink());
      }
      if (url === '/pay/ada/invoice') {
        return Response.json({ pr: 'lnbc420n1mint', amountSats: 42 });
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    await waitFor(() => {
      expect(starts).toBe(2);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect((await screen.findByRole('alert')).textContent).toBe(
      'This payment could not be started. Try again.',
    );
    expect(links).toBe(1);
    expect(mintBodies()).toEqual([]);
    // Try again: 20 s have passed already, so the pay link is read at once.
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(links).toBe(2);
    });
    expect(starts).toBe(3);
    expect((await screen.findByRole('alert')).textContent).toBe(
      'This payment could not be started. Try again.',
    );
    expect(mintBodies()).toEqual([]);
    // A new amount still follows the state.
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(starts).toBe(4);
    expect(links).toBe(3);
    expect(mintBodies()).toEqual([JSON.stringify({ amountSats: 42 })]);
  }, 15_000);

  it('aborts the repeat when the page unmounts and mints nothing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: FIXED });
    const signals: (AbortSignal | null | undefined)[] = [];
    mockShopFetch(async (input, init) => {
      const url = String(input);
      if (url === '/pay/ada/payment') {
        signals.push(init?.signal);
        return signals.length === 1
          ? new Response('bad gateway', { status: 502 })
          : hangingStart(init);
      }
      if (url === '/.well-known/lnurlp/ada' || url.endsWith('/invoice')) {
        throw new Error(`unexpected ${url}`);
      }
      return Response.json(profile);
    });
    const view = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    await waitFor(() => {
      expect(signals).toHaveLength(2);
    });
    expect(signals[1]?.aborted).toBe(false);
    view.unmount();
    expect(signals[1]?.aborted).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40_000);
    });
    expect(signals).toHaveLength(2);
    expect(linkReads()).toBe(0);
    expect(mintBodies()).toEqual([]);
  }, 15_000);

  it('ends the state with a payment, so the next refusal mints at once', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: FIXED });
    let starts = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/pay/ada/payment') {
        starts += 1;
        if (starts <= 2) {
          return new Response('bad gateway', { status: 502 });
        }
        return starts === 3
          ? Response.json({ payment: 'p1', expiresAt: new Date(FIXED + 300_000).toISOString() })
          : stablecoinUnavailable();
      }
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return Response.json({ status: 'Cancelled', paymentStatus: 'ended' });
      }
      if (url === '/pay/ada/invoice') {
        return Response.json({ pr: 'lnbc210n1mint', amountSats: 21 });
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'This payment could not be started. Try again.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    // The opened payment closed unpaid: back to the amount form, the state is gone.
    await waitFor(() => {
      expect(starts).toBe(3);
    });
    const again = (await screen.findByRole('button', { name: 'Continue' })) as HTMLButtonElement;
    await waitFor(() => {
      expect(again.disabled).toBe(false);
    });
    expect(linkReads()).toBe(1);
    fireEvent.click(again);
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(starts).toBe(4);
    expect(linkReads()).toBe(1);
    expect(mintBodies()).toEqual([JSON.stringify({ amountSats: 21 })]);
  }, 15_000);

  it('keeps the state per pay link when the page switches to another and back', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: FIXED });
    const bob = encodeLnurl('https://21.gifts/.well-known/lnurlp/bob');
    let adaStarts = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/pay/ada/payment') {
        adaStarts += 1;
        return adaStarts <= 2
          ? new Response('bad gateway', { status: 502 })
          : stablecoinUnavailable();
      }
      if (url === '/pay/bob/payment') {
        return stablecoinUnavailable();
      }
      if (url === '/pay/bob/invoice') {
        return Response.json({ pr: 'lnbc210n1bob', amountSats: 21 });
      }
      if (url === '/pay/ada/invoice') {
        return Response.json({ pr: 'lnbc210n1ada', amountSats: 21 });
      }
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json(plainPayLink());
      }
      if (url.endsWith('/pay/bob')) {
        return Response.json({ name: 'Bob', username: 'bob', minSats: 1, maxSats: 100 });
      }
      if (url.startsWith('/.well-known/lnurlp/') || url.endsWith('/invoice')) {
        throw new Error(`unexpected ${url}`);
      }
      return Response.json(profile);
    });
    const view = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'This payment could not be started. Try again.',
    );
    const lostAt = Date.now();
    // Another pay link has its own state: Bob's refusal mints at once.
    view.rerender(<PayLinkScreen lightning={bob} />);
    expect(await screen.findByRole('heading', { name: 'Bob' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(fetchedUrls().some((url) => url.startsWith('/.well-known/lnurlp/'))).toBe(false);
    // Back on Ada's pay link, her lost start still holds: the refusal waits, then reads.
    view.rerender(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    await waitFor(() => {
      expect(adaStarts).toBe(3);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(Math.max(0, lostAt + 18_000 - Date.now()));
    });
    expect(linkReads()).toBe(0);
    expect(mintBodies()).toEqual([]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(linkReads()).toBe(1);
    expect(mintBodies()).toEqual([JSON.stringify({ amountSats: 21 })]);
  }, 15_000);

  it('counts a start the page left while it ran as unknown when it returns', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: FIXED });
    const bob = encodeLnurl('https://21.gifts/.well-known/lnurlp/bob');
    let adaStarts = 0;
    mockShopFetch(async (input, init) => {
      const url = String(input);
      if (url === '/pay/ada/payment') {
        adaStarts += 1;
        return adaStarts === 1 ? hangingStart(init) : stablecoinUnavailable();
      }
      if (url === '/pay/ada/invoice') {
        return Response.json({ pr: 'lnbc210n1ada', amountSats: 21 });
      }
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json(plainPayLink());
      }
      if (url.endsWith('/pay/bob')) {
        return Response.json({ name: 'Bob', username: 'bob', minSats: 1, maxSats: 100 });
      }
      if (url.startsWith('/.well-known/lnurlp/') || url.endsWith('/invoice')) {
        throw new Error(`unexpected ${url}`);
      }
      return Response.json(profile);
    });
    const view = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    await waitFor(() => {
      expect(adaStarts).toBe(1);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    // Leaving while the start runs: it may still have opened a payment.
    const leftAt = Date.now();
    view.rerender(<PayLinkScreen lightning={bob} />);
    expect(await screen.findByRole('heading', { name: 'Bob' })).toBeTruthy();
    view.rerender(<PayLinkScreen lightning={ADA} />);
    await enterAmount();
    await waitFor(() => {
      expect(adaStarts).toBe(2);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(Math.max(0, leftAt + 18_000 - Date.now()));
    });
    expect(linkReads()).toBe(0);
    expect(mintBodies()).toEqual([]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(linkReads()).toBe(1);
    expect(mintBodies()).toEqual([JSON.stringify({ amountSats: 21 })]);
  }, 15_000);
});
