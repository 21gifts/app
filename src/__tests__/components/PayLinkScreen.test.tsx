import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
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
 * answers 503 `stablecoin_unavailable`, so an entered amount mints as before.
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

  it('shows the viewer fiat under an open till when a spot rate exists', async () => {
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
        charge: { amountSats: 238093, expiresAt: new Date(fixed + 300_000).toISOString() },
      });
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByText('$200.00')).toBeTruthy();
    const spotCalls = vi
      .mocked(fetch)
      .mock.calls.filter(([input]) => String(input).includes('/fx/spot'));
    expect(spotCalls).toHaveLength(1);
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

/** An OpenCryptoPay pay request for one shop payment. */
function shopPayLink(
  options: {
    payment?: string;
    quote?: string;
    expiresInMs?: number;
    method?: string;
    standard?: string;
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
        assets: [{ asset: 'BTC', amount: '0.00000021' }],
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

  it('hides the invoice on its way and stops polling once paid', async () => {
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
        return waits === 1
          ? Response.json({ status: 'Pending', paymentStatus: 'accepted' })
          : Response.json({ status: 'Completed', paymentStatus: 'paid' });
      }
      return Response.json(chargeProfile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByText('On its way')).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Bitcoin invoice' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pay with a Bitcoin wallet app' })).toBeNull();
    expect(screen.queryByText('0.2 USDT')).toBeNull();
    expect(screen.queryByText('5:00 left')).toBeNull();
    expect(await screen.findByText('Paid ✓', undefined, { timeout: 4000 })).toBeTruthy();
    expect(fetchedUrls().filter((url) => url.startsWith('/lnurlp/wait/'))).toEqual([
      '/lnurlp/wait/p1',
      '/lnurlp/wait/p1?since=accepted',
    ]);
    await new Promise((resolve) => {
      setTimeout(resolve, 2500);
    });
    expect(waits).toBe(2);
  }, 10_000);

  it('shows an ended payment as expired, keeps reading until it is closed, and keeps it on screen', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let profiles = 0;
    let waits = 0;
    let releaseClosed: (response: Response) => void = () => undefined;
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
    expect(await screen.findByText('Expired', undefined, { timeout: 4000 })).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Bitcoin invoice' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pay with a Bitcoin wallet app' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    await waitFor(
      () => {
        expect(waits).toBe(3);
      },
      { timeout: 4000 },
    );
    await act(async () => {
      releaseClosed(Response.json({ status: 'Expired', paymentStatus: 'ended' }));
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 2_300);
    });
    expect(screen.getByText('Expired')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    expect(profiles).toBe(1);
    expect(fetchedUrls().filter((url) => url.startsWith('/lnurlp/wait/'))).toEqual([
      '/lnurlp/wait/p1',
      '/lnurlp/wait/p1',
      '/lnurlp/wait/p1?since=ended',
    ]);
  }, 15_000);

  it('starts again from the pay link when the api does not know the payment', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let profiles = 0;
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/.well-known/lnurlp/ada') {
        return Response.json(shopPayLink());
      }
      if (url === DETAIL) {
        return Response.json({ pr: 'lnbc210n1shop' });
      }
      if (url.startsWith('/lnurlp/wait/')) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
      if (url === '/pay/ada') {
        profiles += 1;
      }
      return Response.json(profiles === 1 ? chargeProfile : profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(profiles).toBe(2);
  });

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
    expect(screen.queryByText('Expired')).toBeNull();
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

  it('keeps the lines and reads again when a quote refetch fails', async () => {
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
    await waitFor(() => {
      expect(links).toBe(2);
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    expect(screen.getByText('Polygon')).toBeTruthy();
    expect(await screen.findByText('Arbitrum', undefined, { timeout: 4000 })).toBeTruthy();
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
        return Response.json(shopPayLink({ payment: 'p2', quote: 'q3' }));
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
    await waitFor(
      () => {
        expect(screen.queryByText('Arbitrum')).toBeNull();
      },
      { timeout: 3000 },
    );
    expect(links).toBe(3);
    expect(screen.getByRole('button', { name: 'Pay with a Bitcoin wallet app' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
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

  it('asks again when another payer replaced the amount', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    const answers: object[] = [shopPayLink({ payment: 'p2' }), { tag: 'payRequest' }];
    for (const answer of answers) {
      mockShopFetch(async (input) => {
        const url = String(input);
        if (url === '/pay/ada/payment') {
          return Response.json({
            payment: 'p1',
            expiresAt: new Date(FIXED + 300_000).toISOString(),
          });
        }
        if (url === '/.well-known/lnurlp/ada') {
          return Response.json(answer);
        }
        if (url.endsWith('/invoice') || url.startsWith(CALLBACK) || url.startsWith('/lnurlp/')) {
          throw new Error(`unexpected ${url}`);
        }
        return Response.json(profile);
      });
      const view = renderWithLocale(<PayLinkScreen lightning={ADA} />);
      await enterAmount();
      expect((await screen.findByRole('alert')).textContent).toBe(
        'Another payer entered an amount first. Enter yours again.',
      );
      expect(screen.getByLabelText('Amount')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
      view.unmount();
    }
  });

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
    for (const answer of [shopPayLink({ payment: 'p2' }), { tag: 'payRequest' }]) {
      let links = 0;
      mockShopFetch(async (input) => {
        const url = String(input);
        if (url === '/pay/ada/payment') {
          return Response.json({ payment: 'p1' });
        }
        if (url === '/.well-known/lnurlp/ada') {
          links += 1;
          return links === 1 ? new Response('busy', { status: 503 }) : Response.json(answer);
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
      expect((await screen.findByRole('alert', undefined, { timeout: 4000 })).textContent).toBe(
        'Another payer entered an amount first. Enter yours again.',
      );
      expect(screen.getByLabelText('Amount')).toBeTruthy();
      expect(screen.queryByText('Waiting for payment…')).toBeNull();
      view.unmount();
    }
  }, 15_000);

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
        return Response.json({ tag: 'payRequest' });
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
    mockShopFetch(async (input) => {
      const url = String(input);
      if (url === '/pay/ada/payment' || url === '/.well-known/lnurlp/ada') {
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
    view.rerender(<PayLinkScreen lightning={bob} />);
    expect(await screen.findByRole('heading', { name: 'Bob' })).toBeTruthy();
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

  it('stops polling when the page leaves the payment', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED);
    let waits = 0;
    let releaseWait: (response: Response) => void = () => undefined;
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
          return Response.json({ status: 'Pending', paymentStatus: 'open' });
        }
        return new Promise((resolve) => {
          releaseWait = resolve;
        });
      }
      return Response.json(chargeProfile);
    });
    const first = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByText('Waiting for payment…')).toBeTruthy();
    first.unmount();
    await new Promise((resolve) => {
      setTimeout(resolve, 2_300);
    });
    expect(waits).toBe(1);

    waits = 0;
    const second = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await waitFor(
      () => {
        expect(waits).toBe(2);
      },
      { timeout: 4000 },
    );
    second.unmount();
    releaseWait(Response.json({ status: 'Pending', paymentStatus: 'accepted' }));
    await new Promise((resolve) => {
      setTimeout(resolve, 2_300);
    });
    expect(waits).toBe(2);
  }, 15_000);

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
});
