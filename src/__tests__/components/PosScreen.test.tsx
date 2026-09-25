import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PosScreen } from '@/components/PosScreen';
import { fetchGiftStats } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    fetchGiftStats: vi.fn().mockResolvedValue({ spendOverTime: [] }),
  };
});

const ACCOUNT = {
  id: 'acc_1',
  linkingKey: null,
  role: 'basis' as const,
  name: 'Ada',
  username: 'alice',
  location: null,
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  useAuthStore.setState({ session: 'tok', account: ACCOUNT });
});

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null });
  vi.unstubAllGlobals();
});

describe('PosScreen', () => {
  it('shows the default fiat under an open charge when a gift day exists', async () => {
    vi.mocked(fetchGiftStats).mockResolvedValueOnce({
      spendOverTime: [
        {
          day: '2026-06-01',
          sats: 100_000_000,
          usd: '100000.00',
          chf: '80000.00',
          eur: '90000.00',
          php: '5600000.00',
        },
      ],
    } as never);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          charge: {
            id: 'c1',
            amountSats: 21,
            status: 'pending',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
          history: [],
        }),
      ),
    );
    renderWithLocale(<PosScreen />);
    expect(await screen.findByText('$0.02')).toBeTruthy();
    expect(screen.getByText('₿21')).toBeTruthy();
  });

  it('shows the amount form when nothing is open', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] })));
    renderWithLocale(<PosScreen />);
    expect(await screen.findByRole('heading', { name: 'Point of sale' })).toBeTruthy();
    expect(screen.getByText('alice@21.gifts')).toBeTruthy();
    expect(await screen.findByRole('img', { name: 'Open CryptoPay QR code' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create payment' })).toBeTruthy();
  });

  it('creates a charge and then cancels it', async () => {
    const charge = {
      id: 'c1',
      amountSats: 21,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return jsonResponse({ charge });
      }
      if (init?.method === 'DELETE') {
        return jsonResponse({ charge: null });
      }
      return jsonResponse({ charge: null, history: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosScreen />);
    fireEvent.change(await screen.findByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.getAllByText('₿21').length).toBeGreaterThan(0);
    expect(screen.queryByText('$0.02')).toBeNull();
    fetchMock.mockImplementation(async () => jsonResponse({ charge: null, history: [] }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create payment' })).toBeTruthy();
    });
  });

  it('does not reload the till over an in-flight payment', async () => {
    let releasePost: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Promise<Response>((resolve) => {
          releasePost = resolve;
        });
      }
      return jsonResponse({ charge: null, history: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosScreen />);
    fireEvent.change(await screen.findByLabelText('Amount'), { target: { value: '21' } });
    const callsAtForm = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBe(callsAtForm + 1);
    });
    act(() => {
      useAuthStore.setState({ session: 'other', account: ACCOUNT });
    });
    expect(fetchMock.mock.calls.length).toBe(callsAtForm + 1);
    await act(async () => {
      releasePost?.(
        jsonResponse({
          charge: {
            id: 'c1',
            amountSats: 21,
            status: 'pending',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        }),
      );
      await Promise.resolve();
    });
    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('rejects a fractional amount without calling the api', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosScreen />);
    fireEvent.change(await screen.findByLabelText('Amount'), { target: { value: '1.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Enter a whole number.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows an API range error and a load error', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return jsonResponse({ error: 'Amount is outside the wallet range' }, 400);
      }
      return jsonResponse({ charge: null, history: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosScreen />);
    fireEvent.change(await screen.findByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('outside the wallet range');
  });

  it('asks for an address when the wallet is missing', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...ACCOUNT, lightningAddress: null },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] })));
    renderWithLocale(<PosScreen />);
    expect(
      await screen.findByRole('link', { name: 'Set a Wallet of Satoshi address first.' }),
    ).toBeTruthy();
  });

  it('shows the QR on a phone', async () => {
    const original = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] })));
    renderWithLocale(<PosScreen />);
    expect(await screen.findByRole('button', { name: 'Create payment' })).toBeTruthy();
    expect(await screen.findByRole('img', { name: 'Open CryptoPay QR code' })).toBeTruthy();
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: original });
  });

  it('shows an error when the till cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'nope' }, 500)));
    renderWithLocale(<PosScreen />);
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('maps already-open, username, address, and unknown create errors', async () => {
    const errors = [
      ['A payment is already open', 'already open'],
      ['Set a username first', 'username first'],
      ['Set a Wallet of Satoshi address first', 'Wallet of Satoshi'],
      ['nope', 'unavailable'],
    ] as const;
    for (const [apiError, needle] of errors) {
      cleanup();
      useAuthStore.setState({ session: 'tok', account: ACCOUNT });
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'POST') {
            return jsonResponse({ error: apiError }, 400);
          }
          return jsonResponse({ charge: null, history: [] });
        }),
      );
      renderWithLocale(<PosScreen />);
      fireEvent.change(await screen.findByLabelText('Amount'), { target: { value: '21' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      expect((await screen.findByRole('alert')).textContent?.toLowerCase()).toContain(
        needle.toLowerCase(),
      );
    }
  });

  it('keeps the open charge and shows an error when cancel fails', async () => {
    const charge = {
      id: 'c1',
      amountSats: 21,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          return jsonResponse({ error: 'nope' }, 500);
        }
        return jsonResponse({ charge, history: [charge] });
      }),
    );
    renderWithLocale(<PosScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'History' })).toBeNull();
  });

  it('refetches once when the open charge is already expired', async () => {
    const expired = {
      id: 'old',
      amountSats: 5,
      status: 'pending' as const,
      createdAt: new Date(Date.now() - 120_000).toISOString(),
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
    };
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) {
          return jsonResponse({ charge: expired, history: [expired] });
        }
        return jsonResponse({
          charge: null,
          history: [{ ...expired, status: 'expired' }],
        });
      }),
    );
    renderWithLocale(<PosScreen />);
    expect(await screen.findByRole('button', { name: 'Create payment' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'History' })).toBeNull();
    expect(calls).toBe(2);
  });

  it('does not load the till without a session', async () => {
    useAuthStore.setState({ session: null, account: ACCOUNT });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosScreen />);
    expect(screen.getByRole('heading', { name: 'Point of sale' })).toBeTruthy();
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores create and cancel after the session disappears', async () => {
    const charge = {
      id: 'c1',
      amountSats: 21,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    const fetchMock = vi.fn(async () => jsonResponse({ charge, history: [charge] }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosScreen />);
    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
    const before = fetchMock.mock.calls.length;
    act(() => {
      useAuthStore.setState({ session: null, account: ACCOUNT });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(fetchMock.mock.calls.length).toBe(before);
  });

  it('updates the countdown while a charge is open', async () => {
    const charge = {
      id: 'c1',
      amountSats: 21,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 65_000).toISOString(),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ charge, history: [charge] })));
    renderWithLocale(<PosScreen />);
    const first = (await screen.findByText(/\d+:\d+ left/)).textContent;
    await new Promise((resolve) => {
      setTimeout(resolve, 1_100);
    });
    expect(screen.getByText(/\d+:\d+ left/).textContent).not.toBe(first);
  });

  it('shows an error when the expiry refresh fails', async () => {
    const expired = {
      id: 'old',
      amountSats: 5,
      status: 'pending' as const,
      createdAt: new Date(Date.now() - 120_000).toISOString(),
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
    };
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) {
          return jsonResponse({ charge: expired, history: [expired] });
        }
        throw new Error('offline');
      }),
    );
    renderWithLocale(<PosScreen />);
    expect((await screen.findByRole('alert')).textContent).toContain('unavailable');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create payment' })).toBeNull();
  });

  it('drops a late expiry refresh after cancel starts', async () => {
    const expired = {
      id: 'old',
      amountSats: 5,
      status: 'pending' as const,
      createdAt: new Date(Date.now() - 120_000).toISOString(),
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
    };
    let releaseRefresh: ((value: Response) => void) | undefined;
    let calls = 0;
    let cancelled = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          cancelled = true;
          return jsonResponse({ charge: null });
        }
        calls += 1;
        if (calls === 1) {
          return jsonResponse({ charge: expired, history: [expired] });
        }
        if (!cancelled && releaseRefresh === undefined) {
          return new Promise<Response>((resolve) => {
            releaseRefresh = resolve;
          });
        }
        return jsonResponse({
          charge: null,
          history: [{ ...expired, status: 'expired' }],
        });
      }),
    );
    renderWithLocale(<PosScreen />);
    expect(await screen.findByText('0:00 left')).toBeTruthy();
    await waitFor(() => {
      expect(releaseRefresh).toEqual(expect.any(Function));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('button', { name: 'Create payment' })).toBeTruthy();
    await act(async () => {
      releaseRefresh?.(jsonResponse({ charge: expired, history: [expired] }));
      await Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'Create payment' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('finishes cancel when the countdown ends while cancel is in flight', async () => {
    const charge = {
      id: 'c1',
      amountSats: 21,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 400).toISOString(),
    };
    let releaseDelete: ((value: Response) => void) | undefined;
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        calls += 1;
        if (calls === 1) {
          return jsonResponse({ charge, history: [charge] });
        }
        if (init?.method === 'DELETE') {
          return new Promise<Response>((resolve) => {
            releaseDelete = resolve;
          });
        }
        return jsonResponse({ charge: null, history: [] });
      }),
    );
    renderWithLocale(<PosScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await new Promise((resolve) => {
      setTimeout(resolve, 1_200);
    });
    await act(async () => {
      releaseDelete?.(jsonResponse({ charge: null }));
      await Promise.resolve();
    });
    const create = await screen.findByRole('button', { name: 'Create payment' });
    expect(create.hasAttribute('disabled')).toBe(false);
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('does not create a payment after the session disappears', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosScreen />);
    expect(await screen.findByRole('button', { name: 'Create payment' })).toBeTruthy();
    const before = fetchMock.mock.calls.length;
    act(() => {
      useAuthStore.setState({ session: null, account: ACCOUNT });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    expect(fetchMock.mock.calls.length).toBe(before);
  });

  it('drops a late till load after the screen unmounts', async () => {
    let release: ((value: Response) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      ),
    );
    const view = renderWithLocale(<PosScreen />);
    view.unmount();
    await act(async () => {
      release?.(jsonResponse({ charge: null, history: [] }));
      await Promise.resolve();
    });
  });

  it('drops a late till error after the screen unmounts', async () => {
    let rejectLoad: ((error: Error) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((_resolve, reject) => {
            rejectLoad = reject;
          }),
      ),
    );
    const view = renderWithLocale(<PosScreen />);
    view.unmount();
    await act(async () => {
      rejectLoad?.(new Error('late'));
      await Promise.resolve();
    });
  });

  it('asks for a username when the account has none', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...ACCOUNT, username: null },
    });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosScreen />);
    expect(await screen.findByRole('link', { name: 'Set a username first.' })).toBeTruthy();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    await act(async () => {
      await fetchMock.mock.results[0]?.value;
    });
    expect(screen.queryByRole('button', { name: 'Create payment' })).toBeNull();
  });
});
