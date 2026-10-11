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

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(handler));
}

function stubHost(): { set: (host: string) => void; restore: () => void } {
  let host = 'localhost';
  const previous = window.location;
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      get href(): string {
        return 'http://localhost/';
      },
      set href(_value: string) {},
      get host(): string {
        return host;
      },
    },
  });
  return {
    set(next: string) {
      host = next;
    },
    restore() {
      Object.defineProperty(window, 'location', { configurable: true, value: previous });
    },
  };
}

const OPENED = { payment: '8d1c1b9a-6c0e-4f1a-9c2d-111111111111' };

function usdtBody(amount: string, expiration: string | null): unknown {
  return {
    quote: expiration === null ? null : { expiration },
    transferAmounts: [{ method: 'ethereum', available: true, assets: [{ asset: 'USDT', amount }] }],
  };
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
    let releaseInvoice: ((response: Response) => void) | undefined;
    mockFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/payment')) {
        return Response.json(OPENED);
      }
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
      expect(releaseInvoice).toBeTypeOf('function');
    });
    view.rerender(<PayLinkScreen lightning={bob} />);
    expect(await screen.findByRole('heading', { name: 'Bob' })).toBeTruthy();
    releaseInvoice?.(Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 }));
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
      const url = String(input);
      if (url.endsWith('/payment')) {
        return Response.json(OPENED);
      }
      if (url.endsWith('/invoice')) {
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
    expect(
      vi.mocked(fetch).mock.calls.filter((call) => String(call[0]).endsWith('/payment')).length,
    ).toBe(1);
    await waitFor(() => {
      expect(
        vi.mocked(fetch).mock.calls.filter((call) => String(call[0]).endsWith('/invoice')).length,
      ).toBe(1);
    });
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

  it('keeps the invoice screen when the shop payment route is missing', async () => {
    mockFetch(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/payment')) {
        expect(init?.method).toBe('POST');
        return new Response(null, { status: 404 });
      }
      if (url.endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 });
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await screen.findByRole('heading', { name: 'Ada Lovelace' });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(screen.queryByText(/USDT/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pay with USDT or USDC' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Pay with a Bitcoin wallet app' })).toBeTruthy();
  });

  it('shows that a payment is already open and does not mint an invoice', async () => {
    mockFetch(async (input) => {
      if (String(input).endsWith('/payment')) {
        return new Response(JSON.stringify({ error: 'A payment is already open' }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (String(input).endsWith('/invoice')) {
        throw new Error('invoice must not be minted');
      }
      if (String(input).includes('/.well-known/lnurlp/')) {
        throw new Error('pay link must not be read');
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await screen.findByRole('heading', { name: 'Ada Lovelace' });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect((await screen.findByRole('alert')).textContent).toBe('A payment is already open.');
    expect(screen.getByLabelText('Amount')).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Bitcoin invoice' })).toBeNull();
    expect(postedInvoice()).toBe(false);
  });

  it('keeps the till invoice when another shop payment is already open', async () => {
    const fixed = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(fixed);
    mockFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 238093 });
      }
      if (url.endsWith('/payment')) {
        return new Response(null, { status: 409 });
      }
      if (url.includes('/.well-known/lnurlp/')) {
        throw new Error('pay link must not be read');
      }
      return Response.json({
        ...profile,
        charge: { amountSats: 238093, expiresAt: new Date(fixed + 300_000).toISOString() },
      });
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByText("₿238'093")).toBeTruthy();
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect((await screen.findByRole('alert')).textContent).toBe('A payment is already open.');
    expect(screen.queryByText(/USDT/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pay with USDT or USDC' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Pay with a Bitcoin wallet app' })).toBeTruthy();
  });

  it('shows offered stablecoin amounts without replacing the invoice button', async () => {
    const fixed = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(fixed);
    const hrefs: string[] = [];
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get href(): string {
          return 'http://localhost/';
        },
        set href(value: string) {
          hrefs.push(value);
        },
        host: 'localhost',
      },
    });
    mockFetch(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/payment')) {
        expect(init?.body).toBe(JSON.stringify({ amountSats: 21 }));
        return Response.json({ payment: '8d1c1b9a-6c0e-4f1a-9c2d-111111111111' });
      }
      if (url.endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 });
      }
      if (url.includes('/.well-known/lnurlp/ada')) {
        expect(url).toBe('https://21.gifts/.well-known/lnurlp/ada');
        expect(url).not.toContain('timeout');
        return Response.json({
          transferAmounts: [
            {
              method: 'Lightning',
              available: true,
              assets: [{ asset: 'BTC', amount: '0.00000021' }],
            },
            {
              method: 'ethereum',
              available: true,
              assets: [{ asset: 'USDT', amount: '1.25' }],
            },
          ],
          quote: { expiration: new Date(fixed + 90_000).toISOString() },
        });
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await screen.findByRole('heading', { name: 'Ada Lovelace' });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    expect(await screen.findByText('USDT · ethereum · 1.25')).toBeTruthy();
    expect(screen.getByText('1:30 left')).toBeTruthy();
    expect(screen.getByText('5:00 left')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pay with a Bitcoin wallet app' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pay with USDT or USDC' }));
    expect(hrefs).toEqual([`lightning:lnbc210n1paylink`, `lightning:${ADA}`]);
  });

  it('requests the next quote when the stablecoin quote has lapsed', async () => {
    const previous = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: 'http://localhost/', host: 'localhost' },
    });
    let reads = 0;
    mockFetch(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/payment')) {
        expect(init?.body).toBe(JSON.stringify({ amountSats: 21 }));
        return Response.json({ payment: '8d1c1b9a-6c0e-4f1a-9c2d-111111111111' });
      }
      if (url.endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 });
      }
      if (url.includes('/.well-known/lnurlp/ada')) {
        expect(url).toBe('https://21.gifts/.well-known/lnurlp/ada');
        expect(url).not.toContain('timeout');
        reads += 1;
        if (reads === 1) {
          return Response.json({
            quote: { expiration: '2020-01-01T00:00:00.000Z' },
            transferAmounts: [
              {
                method: 'ethereum',
                available: true,
                assets: [{ asset: 'USDT', amount: '1.25' }],
              },
            ],
          });
        }
        return Response.json({
          quote: { expiration: new Date(Date.now() + 120_000).toISOString() },
          transferAmounts: [
            {
              method: 'ethereum',
              available: true,
              assets: [{ asset: 'USDT', amount: '9.99' }],
            },
          ],
        });
      }
      return Response.json(profile);
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await screen.findByRole('heading', { name: 'Ada Lovelace' });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('USDT · ethereum · 9.99')).toBeTruthy();
    expect(screen.queryByText('USDT · ethereum · 1.25')).toBeNull();
    expect(reads).toBe(2);
    Object.defineProperty(window, 'location', { configurable: true, value: previous });
  });

  it('shows the invoice when the opened payment offers no stablecoin', async () => {
    const host = stubHost();
    mockFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/payment')) {
        return Response.json(OPENED);
      }
      if (url.endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 });
      }
      if (url.includes('/.well-known/lnurlp/')) {
        return Response.json({ transferAmounts: [] });
      }
      return Response.json(profile);
    });
    try {
      renderWithLocale(<PayLinkScreen lightning={ADA} />);
      await screen.findByRole('heading', { name: 'Ada Lovelace' });
      fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
      expect(screen.queryByText(/USDT/)).toBeNull();
      expect(screen.queryByRole('button', { name: 'Pay with USDT or USDC' })).toBeNull();
    } finally {
      host.restore();
    }
  });

  it('drops an in-flight shop payment when the link changes', async () => {
    const bob = encodeLnurl('https://21.gifts/.well-known/lnurlp/bob');
    let releasePayment: ((response: Response) => void) | undefined;
    mockFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/payment')) {
        return new Promise((resolve) => {
          releasePayment = resolve;
        });
      }
      if (url.endsWith('/invoice')) {
        throw new Error('invoice must not be minted');
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
      expect(releasePayment).toBeTypeOf('function');
      expect(vi.mocked(fetch).mock.calls.some((call) => String(call[0]).endsWith('/payment'))).toBe(
        true,
      );
    });
    view.rerender(<PayLinkScreen lightning={bob} />);
    expect(await screen.findByRole('heading', { name: 'Bob' })).toBeTruthy();
    await act(async () => {
      releasePayment?.(Response.json(OPENED));
    });
    expect(screen.queryByRole('img', { name: 'Bitcoin invoice' })).toBeNull();
    expect(screen.queryByText('A payment is already open.')).toBeNull();
    expect(postedInvoice()).toBe(false);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
  });

  it('does not read the pay link when the page host no longer accepts it', async () => {
    const host = stubHost();
    let releaseInvoice: ((response: Response) => void) | undefined;
    mockFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/payment')) {
        return Response.json(OPENED);
      }
      if (url.endsWith('/invoice')) {
        return new Promise((resolve) => {
          releaseInvoice = resolve;
        });
      }
      if (url.includes('/.well-known/lnurlp/')) {
        throw new Error('pay link must not be read');
      }
      return Response.json(profile);
    });
    try {
      renderWithLocale(<PayLinkScreen lightning={ADA} />);
      await screen.findByRole('heading', { name: 'Ada Lovelace' });
      fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      await waitFor(() => {
        expect(releaseInvoice).toBeTypeOf('function');
      });
      host.set('dev.21.gifts');
      await act(async () => {
        releaseInvoice?.(Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 }));
      });
      expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
      expect(screen.queryByText(/USDT/)).toBeNull();
      expect(screen.queryByRole('button', { name: 'Pay with USDT or USDC' })).toBeNull();
    } finally {
      host.restore();
    }
  });

  it('drops a pay-link read when the link changes', async () => {
    const bob = encodeLnurl('https://21.gifts/.well-known/lnurlp/bob');
    const host = stubHost();
    let releaseOffer: ((response: Response) => void) | undefined;
    mockFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/payment')) {
        return Response.json(OPENED);
      }
      if (url.endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 });
      }
      if (url.includes('/.well-known/lnurlp/')) {
        return new Promise((resolve) => {
          releaseOffer = resolve;
        });
      }
      if (url.endsWith('/pay/bob')) {
        return Response.json({ name: 'Bob', username: 'bob', minSats: 1, maxSats: 100 });
      }
      return Response.json(profile);
    });
    try {
      const view = renderWithLocale(<PayLinkScreen lightning={ADA} />);
      await screen.findByRole('heading', { name: 'Ada Lovelace' });
      fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      await waitFor(() => {
        expect(releaseOffer).toBeTypeOf('function');
      });
      view.rerender(<PayLinkScreen lightning={bob} />);
      expect(await screen.findByRole('heading', { name: 'Bob' })).toBeTruthy();
      await act(async () => {
        releaseOffer?.(Response.json(usdtBody('9.99', '2099-01-01T00:00:00.000Z')));
      });
      expect(screen.queryByText(/USDT/)).toBeNull();
      expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    } finally {
      host.restore();
    }
  });

  it('shows till stablecoin amounts without replacing Pay', async () => {
    const fixed = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(fixed);
    const host = stubHost();
    mockFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 238093 });
      }
      if (url.endsWith('/payment')) {
        return Response.json(OPENED);
      }
      if (url.includes('/.well-known/lnurlp/')) {
        return Response.json(usdtBody('1.25', new Date(fixed + 90_000).toISOString()));
      }
      return Response.json({
        ...profile,
        charge: { amountSats: 238093, expiresAt: new Date(fixed + 300_000).toISOString() },
      });
    });
    try {
      renderWithLocale(<PayLinkScreen lightning={ADA} />);
      expect(await screen.findByText('USDT · ethereum · 1.25')).toBeTruthy();
      expect(screen.getByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Pay with a Bitcoin wallet app' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Pay with USDT or USDC' })).toBeTruthy();
    } finally {
      host.restore();
    }
  });

  it('shows the till invoice when the pay link offers no stablecoin', async () => {
    const fixed = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(fixed);
    const host = stubHost();
    mockFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 238093 });
      }
      if (url.endsWith('/payment')) {
        return Response.json(OPENED);
      }
      if (url.includes('/.well-known/lnurlp/')) {
        return Response.json({
          transferAmounts: [
            { method: 'Lightning', available: true, assets: [{ asset: 'BTC', amount: '1' }] },
          ],
        });
      }
      return Response.json({
        ...profile,
        charge: { amountSats: 238093, expiresAt: new Date(fixed + 300_000).toISOString() },
      });
    });
    try {
      renderWithLocale(<PayLinkScreen lightning={ADA} />);
      expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
      await waitFor(() => {
        expect(
          vi
            .mocked(fetch)
            .mock.calls.some((call) => String(call[0]).includes('/.well-known/lnurlp/')),
        ).toBe(true);
      });
      expect(screen.queryByText(/USDT/)).toBeNull();
      expect(screen.queryByRole('button', { name: 'Pay with USDT or USDC' })).toBeNull();
    } finally {
      host.restore();
    }
  });

  it('leaves the till invoice unchanged when the payment route is missing', async () => {
    const fixed = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(fixed);
    mockFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 238093 });
      }
      if (url.endsWith('/payment')) {
        return new Response(null, { status: 404 });
      }
      if (url.includes('/.well-known/lnurlp/')) {
        throw new Error('pay link must not be read');
      }
      return Response.json({
        ...profile,
        charge: { amountSats: 238093, expiresAt: new Date(fixed + 300_000).toISOString() },
      });
    });
    renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    await waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.some((call) => String(call[0]).endsWith('/payment'))).toBe(
        true,
      );
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/USDT/)).toBeNull();
  });

  it('ignores a till payment that resolves after unmount', async () => {
    const fixed = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(fixed);
    let releasePayment: ((response: Response) => void) | undefined;
    mockFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 238093 });
      }
      if (url.endsWith('/payment')) {
        return new Promise((resolve) => {
          releasePayment = resolve;
        });
      }
      return Response.json({
        ...profile,
        charge: { amountSats: 238093, expiresAt: new Date(fixed + 300_000).toISOString() },
      });
    });
    const view = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
    await waitFor(() => {
      expect(releasePayment).toBeTypeOf('function');
    });
    view.unmount();
    await act(async () => {
      releasePayment?.(Response.json(OPENED));
    });
  });

  it('ignores a till pay-link read that resolves after unmount', async () => {
    const fixed = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(fixed);
    const host = stubHost();
    let releaseOffer: ((response: Response) => void) | undefined;
    mockFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 238093 });
      }
      if (url.endsWith('/payment')) {
        return Response.json(OPENED);
      }
      if (url.includes('/.well-known/lnurlp/')) {
        return new Promise((resolve) => {
          releaseOffer = resolve;
        });
      }
      return Response.json({
        ...profile,
        charge: { amountSats: 238093, expiresAt: new Date(fixed + 300_000).toISOString() },
      });
    });
    try {
      const view = renderWithLocale(<PayLinkScreen lightning={ADA} />);
      expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
      await waitFor(() => {
        expect(releaseOffer).toBeTypeOf('function');
      });
      view.unmount();
      await act(async () => {
        releaseOffer?.(Response.json(usdtBody('1.25', new Date(fixed + 90_000).toISOString())));
      });
    } finally {
      host.restore();
    }
  });

  it('does not read the till pay link when the page host no longer accepts it', async () => {
    const fixed = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(fixed);
    const host = stubHost();
    let releasePayment: ((response: Response) => void) | undefined;
    mockFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 238093 });
      }
      if (url.endsWith('/payment')) {
        return new Promise((resolve) => {
          releasePayment = resolve;
        });
      }
      if (url.includes('/.well-known/lnurlp/')) {
        throw new Error('pay link must not be read');
      }
      return Response.json({
        ...profile,
        charge: { amountSats: 238093, expiresAt: new Date(fixed + 300_000).toISOString() },
      });
    });
    try {
      renderWithLocale(<PayLinkScreen lightning={ADA} />);
      expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
      await waitFor(() => {
        expect(releasePayment).toBeTypeOf('function');
      });
      host.set('dev.21.gifts');
      await act(async () => {
        releasePayment?.(Response.json(OPENED));
      });
      expect(screen.queryByText(/USDT/)).toBeNull();
      expect(
        vi
          .mocked(fetch)
          .mock.calls.some((call) => String(call[0]).includes('/.well-known/lnurlp/')),
      ).toBe(false);
    } finally {
      host.restore();
    }
  });

  it('ignores a till mint failure that arrives after unmount', async () => {
    const fixed = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(fixed);
    let rejectInvoice: ((error: Error) => void) | undefined;
    mockFetch(async (input) => {
      if (String(input).endsWith('/invoice')) {
        return new Promise((_resolve, reject) => {
          rejectInvoice = reject;
        });
      }
      return Response.json({
        ...profile,
        charge: { amountSats: 21, expiresAt: new Date(fixed + 300_000).toISOString() },
      });
    });
    const view = renderWithLocale(<PayLinkScreen lightning={ADA} />);
    await waitFor(() => {
      expect(rejectInvoice).toBeTypeOf('function');
    });
    view.unmount();
    await act(async () => {
      rejectInvoice?.(new Error('offline'));
    });
  });

  it('drops a lapsed quote when the next offer is also expired', async () => {
    const host = stubHost();
    let reads = 0;
    mockFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/payment')) {
        return Response.json(OPENED);
      }
      if (url.endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 });
      }
      if (url.includes('/.well-known/lnurlp/')) {
        reads += 1;
        const amount = reads === 1 ? '1.25' : '9.99';
        return Response.json(usdtBody(amount, '2020-01-01T00:00:00.000Z'));
      }
      return Response.json(profile);
    });
    try {
      renderWithLocale(<PayLinkScreen lightning={ADA} />);
      await screen.findByRole('heading', { name: 'Ada Lovelace' });
      fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      expect(await screen.findByText('USDT · ethereum · 9.99')).toBeTruthy();
      expect(reads).toBe(2);
      expect(screen.queryByText('USDT · ethereum · 1.25')).toBeNull();
    } finally {
      host.restore();
    }
  });

  it('clears stablecoins when the refreshed pay link fails', async () => {
    const host = stubHost();
    let reads = 0;
    mockFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/payment')) {
        return Response.json(OPENED);
      }
      if (url.endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 });
      }
      if (url.includes('/.well-known/lnurlp/')) {
        reads += 1;
        if (reads === 1) {
          return Response.json(usdtBody('1.25', '2020-01-01T00:00:00.000Z'));
        }
        throw new Error('offline');
      }
      return Response.json(profile);
    });
    try {
      renderWithLocale(<PayLinkScreen lightning={ADA} />);
      await screen.findByRole('heading', { name: 'Ada Lovelace' });
      fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      expect(await screen.findByRole('img', { name: 'Bitcoin invoice' })).toBeTruthy();
      await waitFor(() => {
        expect(reads).toBe(2);
        expect(screen.queryByText(/USDT/)).toBeNull();
      });
    } finally {
      host.restore();
    }
  });

  it('drops a refreshed quote that has no expiry', async () => {
    const host = stubHost();
    let reads = 0;
    mockFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/payment')) {
        return Response.json(OPENED);
      }
      if (url.endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 });
      }
      if (url.includes('/.well-known/lnurlp/')) {
        reads += 1;
        if (reads === 1) {
          return Response.json(usdtBody('1.25', '2020-01-01T00:00:00.000Z'));
        }
        return Response.json(usdtBody('4.00', null));
      }
      return Response.json(profile);
    });
    try {
      renderWithLocale(<PayLinkScreen lightning={ADA} />);
      await screen.findByRole('heading', { name: 'Ada Lovelace' });
      fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      expect(await screen.findByText('USDT · ethereum · 4.00')).toBeTruthy();
      expect(reads).toBe(2);
    } finally {
      host.restore();
    }
  });

  it('ignores a quote refresh that finishes after unmount', async () => {
    const host = stubHost();
    let reads = 0;
    let releaseOffer: ((response: Response) => void) | undefined;
    mockFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/payment')) {
        return Response.json(OPENED);
      }
      if (url.endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 });
      }
      if (url.includes('/.well-known/lnurlp/')) {
        reads += 1;
        if (reads === 1) {
          return Response.json(usdtBody('1.25', '2020-01-01T00:00:00.000Z'));
        }
        return new Promise((resolve) => {
          releaseOffer = resolve;
        });
      }
      return Response.json(profile);
    });
    try {
      const view = renderWithLocale(<PayLinkScreen lightning={ADA} />);
      await screen.findByRole('heading', { name: 'Ada Lovelace' });
      fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      await waitFor(() => {
        expect(releaseOffer).toBeTypeOf('function');
      });
      view.unmount();
      await act(async () => {
        releaseOffer?.(Response.json(usdtBody('9.99', '2099-01-01T00:00:00.000Z')));
      });
    } finally {
      host.restore();
    }
  });

  it('ignores a quote refresh after the link changes', async () => {
    const bob = encodeLnurl('https://21.gifts/.well-known/lnurlp/bob');
    const host = stubHost();
    let reads = 0;
    let releaseOffer: ((response: Response) => void) | undefined;
    mockFetch(async (input) => {
      const url = String(input);
      if (url.endsWith('/payment')) {
        return Response.json(OPENED);
      }
      if (url.endsWith('/invoice')) {
        return Response.json({ pr: 'lnbc210n1paylink', amountSats: 21 });
      }
      if (url.includes('/.well-known/lnurlp/')) {
        reads += 1;
        if (reads === 1) {
          return Response.json(usdtBody('1.25', '2020-01-01T00:00:00.000Z'));
        }
        return new Promise((resolve) => {
          releaseOffer = resolve;
        });
      }
      if (url.endsWith('/pay/bob')) {
        releaseOffer?.(Response.json(usdtBody('9.99', '2099-01-01T00:00:00.000Z')));
        return Response.json({ name: 'Bob', username: 'bob', minSats: 1, maxSats: 100 });
      }
      return Response.json(profile);
    });
    try {
      const view = renderWithLocale(<PayLinkScreen lightning={ADA} />);
      await screen.findByRole('heading', { name: 'Ada Lovelace' });
      fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      await waitFor(() => {
        expect(releaseOffer).toBeTypeOf('function');
      });
      view.rerender(<PayLinkScreen lightning={bob} />);
      expect(await screen.findByRole('heading', { name: 'Bob' })).toBeTruthy();
      expect(screen.queryByText(/USDT/)).toBeNull();
    } finally {
      host.restore();
    }
  });
});
