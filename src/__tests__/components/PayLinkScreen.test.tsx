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
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Enter a whole number.');
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a whole number.');
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '101' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create invoice' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a whole number.');
    expect(fetch).toHaveBeenCalledTimes(1);
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

  it('hides the QR on a phone and opens the Android wallet intent', async () => {
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
});
