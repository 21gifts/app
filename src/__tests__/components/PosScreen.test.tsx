import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PosAmount, PosScreen, resetPosTillWriteForTests } from '@/components/PosScreen';
import { fetchGiftStats } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: (): { push: typeof push; replace: typeof replace } => ({ push, replace }),
}));

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
  lightningAddress: null,
  lightningAddressVerified: false,
  sparkWalletVerified: true,
  forumLawsDismissed: false,
  createdAt: 1,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
};

async function pressAmount(draft: string): Promise<void> {
  await screen.findByLabelText('Amount');
  for (const ch of draft) {
    fireEvent.click(
      screen.getByRole('button', { name: ch === '.' ? /^\.$/ : new RegExp(`^${ch}$`) }),
    );
  }
}

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
  resetPosTillWriteForTests();
  push.mockClear();
  replace.mockClear();
  useAuthStore.setState({ session: null, account: null });
  vi.mocked(fetchGiftStats).mockReset();
  vi.mocked(fetchGiftStats).mockResolvedValue({ spendOverTime: [] } as never);
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
    expect(screen.getByRole('link', { name: 'Set an amount' }).getAttribute('href')).toBe(
      '/pos/amount',
    );
    expect(screen.queryByRole('button', { name: 'Create payment' })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('alice@21.gifts').className).toContain('text-center');
    expect(screen.queryByRole('button', { name: /^1$/ })).toBeNull();
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
    renderWithLocale(<PosAmount />);
    await pressAmount('21');
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/pos');
    });
    expect(screen.queryByRole('img', { name: 'Open CryptoPay QR code' })).toBeNull();
  });

  it('cancels an open charge and returns to set an amount', async () => {
    const charge = {
      id: 'c1',
      amountSats: 21,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return jsonResponse({ charge: null });
      }
      return jsonResponse({ charge, history: [charge] });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosScreen />);
    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
    fetchMock.mockImplementation(async () => jsonResponse({ charge: null, history: [] }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
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
    renderWithLocale(<PosAmount />);
    await pressAmount('21');
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
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/pos');
    });
  });

  it('rejects an empty amount without calling the api', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosAmount />);
    expect(await screen.findByRole('button', { name: 'Create payment' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '.' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Enter a whole number.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('says the exchange rate is still loading instead of claiming there is none', async () => {
    vi.mocked(fetchGiftStats).mockReturnValue(new Promise(() => undefined));
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      if (String(input).includes('/me/amount-unit')) {
        return jsonResponse({ ...ACCOUNT, amountUnit: 'fiat' });
      }
      return jsonResponse({ charge: null, history: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosAmount />, 'en', 'ch', 'PHP');
    expect(await screen.findByRole('button', { name: 'Create payment' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'PHP' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'PHP' }).getAttribute('aria-pressed')).toBe('true');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Enter a whole number.');
    await pressAmount('100');
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'The PHP exchange rate is still loading.',
    );
    expect(screen.queryByText('No PHP exchange rate yet.')).toBeNull();
    expect(
      fetchMock.mock.calls.some(
        (call) =>
          (call[1] as RequestInit | undefined)?.method === 'POST' &&
          String(call[0]).includes('/pos'),
      ),
    ).toBe(false);
  });

  it('replaces the loading alert with no rate when the gift day settles', async () => {
    let resolveStats: (value: { spendOverTime: unknown[] }) => void = () => undefined;
    vi.mocked(fetchGiftStats).mockReturnValue(
      new Promise((resolve) => {
        resolveStats = resolve;
      }) as never,
    );
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      if (String(input).includes('/me/amount-unit')) {
        return jsonResponse({ ...ACCOUNT, amountUnit: 'fiat' });
      }
      return jsonResponse({ charge: null, history: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosAmount />, 'en', 'ch', 'PHP');
    expect(await screen.findByRole('button', { name: 'Create payment' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'PHP' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'PHP' }).getAttribute('aria-pressed')).toBe('true');
    });
    await pressAmount('100');
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'The PHP exchange rate is still loading.',
    );
    await act(async () => {
      resolveStats({ spendOverTime: [] });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('No PHP exchange rate yet.');
    });
    expect(
      fetchMock.mock.calls.some(
        (call) =>
          (call[1] as RequestInit | undefined)?.method === 'POST' &&
          String(call[0]).includes('/pos'),
      ),
    ).toBe(false);
  });

  it('clears the loading alert when the gift day prices a whole sat amount', async () => {
    let resolveStats: (value: { spendOverTime: unknown[] }) => void = () => undefined;
    vi.mocked(fetchGiftStats).mockReturnValue(
      new Promise((resolve) => {
        resolveStats = resolve;
      }) as never,
    );
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      if (String(input).includes('/me/amount-unit')) {
        return jsonResponse({ ...ACCOUNT, amountUnit: 'fiat' });
      }
      return jsonResponse({ charge: null, history: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosAmount />, 'en', 'ch', 'PHP');
    expect(await screen.findByRole('button', { name: 'Create payment' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'PHP' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'PHP' }).getAttribute('aria-pressed')).toBe('true');
    });
    await pressAmount('100');
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'The PHP exchange rate is still loading.',
    );
    await act(async () => {
      resolveStats({
        spendOverTime: [
          {
            day: '2026-10-07',
            sats: 100_000_000,
            usd: '100000.00',
            chf: '80000.00',
            eur: '90000.00',
            php: '5600000.00',
          },
        ],
      });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.queryByText('The PHP exchange rate is still loading.')).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'Create payment' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      fetchMock.mock.calls.some(
        (call) =>
          (call[1] as RequestInit | undefined)?.method === 'POST' &&
          String(call[0]).includes('/pos'),
      ),
    ).toBe(false);
  });

  it('keeps a whole-number alert when the settled amount is zero', async () => {
    let resolveStats: (value: { spendOverTime: unknown[] }) => void = () => undefined;
    vi.mocked(fetchGiftStats).mockReturnValue(
      new Promise((resolve) => {
        resolveStats = resolve;
      }) as never,
    );
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      if (String(input).includes('/me/amount-unit')) {
        return jsonResponse({ ...ACCOUNT, amountUnit: 'fiat' });
      }
      return jsonResponse({ charge: null, history: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosAmount />, 'en', 'ch', 'PHP');
    expect(await screen.findByRole('button', { name: 'Create payment' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'PHP' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'PHP' }).getAttribute('aria-pressed')).toBe('true');
    });
    await pressAmount('1');
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'The PHP exchange rate is still loading.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await pressAmount('0');
    await act(async () => {
      resolveStats({
        spendOverTime: [
          {
            day: '2026-10-07',
            sats: 100_000_000,
            usd: '100000.00',
            chf: '80000.00',
            eur: '90000.00',
            php: '5600000.00',
          },
        ],
      });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Enter a whole number.');
    });
    expect(
      fetchMock.mock.calls.some(
        (call) =>
          (call[1] as RequestInit | undefined)?.method === 'POST' &&
          String(call[0]).includes('/pos'),
      ),
    ).toBe(false);
  });

  it('replaces the loading alert with a whole number when the settled amount is not a safe sat count', async () => {
    let resolveStats: (value: { spendOverTime: unknown[] }) => void = () => undefined;
    vi.mocked(fetchGiftStats).mockReturnValue(
      new Promise((resolve) => {
        resolveStats = resolve;
      }) as never,
    );
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      if (String(input).includes('/me/amount-unit')) {
        return jsonResponse({ ...ACCOUNT, amountUnit: 'fiat' });
      }
      return jsonResponse({ charge: null, history: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosAmount />, 'en', 'ch', 'PHP');
    expect(await screen.findByRole('button', { name: 'Create payment' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'PHP' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'PHP' }).getAttribute('aria-pressed')).toBe('true');
    });
    await pressAmount('504403158265496');
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'The PHP exchange rate is still loading.',
    );
    await act(async () => {
      resolveStats({
        spendOverTime: [
          {
            day: '2026-10-07',
            sats: 100_000_000,
            usd: '100000.00',
            chf: '80000.00',
            eur: '90000.00',
            php: '5600000.00',
          },
        ],
      });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Enter a whole number.');
    });
    expect(
      fetchMock.mock.calls.some(
        (call) =>
          (call[1] as RequestInit | undefined)?.method === 'POST' &&
          String(call[0]).includes('/pos'),
      ),
    ).toBe(false);
  });

  it('names the currency when no gift day can price it', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      if (String(input).includes('/me/amount-unit')) {
        return jsonResponse({ ...ACCOUNT, amountUnit: 'fiat' });
      }
      return jsonResponse({ charge: null, history: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosAmount />, 'en', 'ch', 'PHP');
    expect(await screen.findByRole('button', { name: 'Create payment' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'PHP' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'PHP' }).getAttribute('aria-pressed')).toBe('true');
    });
    await pressAmount('100');
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    expect((await screen.findByRole('alert')).textContent).toBe('No PHP exchange rate yet.');
    expect(
      fetchMock.mock.calls.some(
        (call) =>
          (call[1] as RequestInit | undefined)?.method === 'POST' &&
          String(call[0]).includes('/pos'),
      ),
    ).toBe(false);
  });

  it('prices PHP from the last gift day that has a peso total', async () => {
    vi.mocked(fetchGiftStats).mockResolvedValue({
      spendOverTime: [
        {
          day: '2026-10-07',
          sats: 100_000_000,
          usd: '100000.00',
          chf: '80000.00',
          eur: '90000.00',
          php: '5600000.00',
        },
        {
          day: '2026-10-08',
          sats: 1000,
          usd: '10.00',
          chf: null,
          eur: null,
          php: null,
        },
      ],
    } as never);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/me/amount-unit')) {
        return jsonResponse({ ...ACCOUNT, amountUnit: 'fiat' });
      }
      if (init?.method === 'POST') {
        return jsonResponse({
          charge: {
            id: 'c-php',
            amountSats: 1786,
            status: 'pending',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        });
      }
      return jsonResponse({ charge: null, history: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosAmount />, 'en', 'ch', 'PHP');
    expect(await screen.findByRole('button', { name: 'Create payment' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'PHP' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'PHP' }).getAttribute('aria-pressed')).toBe('true');
    });
    await pressAmount('100');
    expect(await screen.findByText("\u20BF1'786")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    await waitFor(() => {
      const posted = fetchMock.mock.calls.find(
        (call) =>
          (call[1] as RequestInit | undefined)?.method === 'POST' &&
          String(call[0]).includes('/pos'),
      );
      expect(posted?.[1]?.body).toBe(JSON.stringify({ amountSats: 1786 }));
    });
    expect(screen.queryByText('Enter a whole number.')).toBeNull();
  });

  it('shows an API range error and a load error', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return jsonResponse({ error: 'Amount is outside the wallet range' }, 400);
      }
      return jsonResponse({ charge: null, history: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosAmount />);
    await pressAmount('21');
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('outside the wallet range');
  });

  it('links to the wallet setup when the wallet is not verified', async () => {
    for (const sparkWalletVerified of [false, undefined]) {
      cleanup();
      useAuthStore.setState({
        session: 'tok',
        account: { ...ACCOUNT, sparkWalletVerified },
      });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] })),
      );
      renderWithLocale(<PosScreen />);
      const link = await screen.findByRole('link', { name: 'Set up your wallet first.' });
      expect(link.getAttribute('href')).toBe('/wallet');
      expect(screen.queryByRole('link', { name: 'Set a username first.' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Set an amount' })).toBeNull();
    }
  });

  it('does not ask for the wallet when the account has no username', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...ACCOUNT, username: null, sparkWalletVerified: false },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] })));
    renderWithLocale(<PosScreen />);
    expect(await screen.findByRole('link', { name: 'Set a username first.' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Set up your wallet first.' })).toBeNull();
  });

  it('can charge with a verified wallet and a username', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] })));
    renderWithLocale(<PosAmount />);
    expect(await screen.findByRole('button', { name: 'Create payment' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Set up your wallet first.' })).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('maps the wallet-required and cannot-receive create answers', async () => {
    const answers = [
      ['wallet_required', 'Set up your wallet first.'],
      [
        'cannot_receive',
        'Your wallet cannot receive this payment right now. Please try again later.',
      ],
    ] as const;
    for (const [code, copy] of answers) {
      cleanup();
      useAuthStore.setState({ session: 'tok', account: ACCOUNT });
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'POST') {
            return jsonResponse({ error: 'nope', code }, 400);
          }
          return jsonResponse({ charge: null, history: [] });
        }),
      );
      renderWithLocale(<PosAmount />);
      await pressAmount('21');
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      expect((await screen.findByRole('alert')).textContent).toBe(copy);
    }
  });

  it('shows the QR on a phone', async () => {
    const original = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] })));
    renderWithLocale(<PosScreen />);
    expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
    expect(await screen.findByRole('img', { name: 'Open CryptoPay QR code' })).toBeTruthy();
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: original });
  });

  it('loads the amount page again after Try again', async () => {
    let charges = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/pos/charge')) {
          charges += 1;
          if (charges === 1) {
            return jsonResponse({ error: 'nope' }, 500);
          }
          return jsonResponse({ charge: null, history: [] });
        }
        return jsonResponse({ error: 'nope' }, 500);
      }),
    );
    renderWithLocale(<PosAmount />);
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Create payment' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('shows an error when the till cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'nope' }, 500)));
    renderWithLocale(<PosScreen />);
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('maps already-open, username, and unknown create errors', async () => {
    const errors = [
      ['A payment is already open', 'already open'],
      ['Set a username first', 'username first'],
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
      renderWithLocale(<PosAmount />);
      await pressAmount('21');
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
    expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
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
    expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
    await act(async () => {
      releaseRefresh?.(jsonResponse({ charge: expired, history: [expired] }));
      await Promise.resolve();
    });
    expect(screen.getByRole('link', { name: 'Set an amount' })).toBeTruthy();
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
    expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('does not create a payment after the session disappears', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosAmount />);
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
    expect(screen.queryByRole('link', { name: 'Set an amount' })).toBeNull();
  });

  it('leaves the amount page when a charge is already open', async () => {
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
    renderWithLocale(<PosAmount />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/pos');
    });
    expect(screen.queryByRole('img', { name: 'Open CryptoPay QR code' })).toBeNull();
  });

  it('ignores a second cancel while the first is still running', async () => {
    let deletes = 0;
    const charge = {
      id: 'c1',
      amountSats: 21,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          deletes += 1;
          return new Promise<Response>(() => undefined);
        }
        return jsonResponse({ charge, history: [charge] });
      }),
    );
    renderWithLocale(<PosScreen />);
    const cancel = await screen.findByRole('button', { name: 'Cancel' });
    fireEvent.click(cancel);
    fireEvent.click(cancel);
    await waitFor(() => {
      expect(deletes).toBe(1);
    });
  });

  it('ignores a second create while the first is still running', async () => {
    let posts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          posts += 1;
          return new Promise<Response>(() => undefined);
        }
        return jsonResponse({ charge: null, history: [] });
      }),
    );
    renderWithLocale(<PosAmount />);
    await pressAmount('21');
    const create = screen.getByRole('button', { name: 'Create payment' });
    fireEvent.click(create);
    fireEvent.click(create);
    await waitFor(() => {
      expect(posts).toBe(1);
    });
  });

  it('waits for an in-flight create before showing an empty till', async () => {
    let releasePost: ((value: Response) => void) | undefined;
    let posted = false;
    const charge = {
      id: 'c1',
      amountSats: 21,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return new Promise<Response>((resolve) => {
            releasePost = resolve;
          });
        }
        if (!posted) {
          return jsonResponse({ charge: null, history: [] });
        }
        return jsonResponse({ charge, history: [charge] });
      }),
    );
    const amount = renderWithLocale(<PosAmount />);
    await pressAmount('21');
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    await waitFor(() => {
      expect(releasePost).toEqual(expect.any(Function));
    });
    amount.unmount();
    renderWithLocale(<PosScreen />);
    expect(screen.queryByRole('link', { name: 'Set an amount' })).toBeNull();
    posted = true;
    await act(async () => {
      releasePost?.(jsonResponse({ charge }));
      await Promise.resolve();
    });
    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('drops a till load that unmounts while create is still running', async () => {
    let releasePost: ((value: Response) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return new Promise<Response>((resolve) => {
            releasePost = resolve;
          });
        }
        return jsonResponse({ charge: null, history: [] });
      }),
    );
    const amount = renderWithLocale(<PosAmount />);
    await pressAmount('21');
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    await waitFor(() => {
      expect(releasePost).toEqual(expect.any(Function));
    });
    amount.unmount();
    const till = renderWithLocale(<PosScreen />);
    till.unmount();
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
  });

  it('sends a member who cannot charge back to the QR page', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...ACCOUNT, username: null },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] })));
    renderWithLocale(<PosAmount />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/pos');
    });
  });

  it('sends a member without a verified wallet back to the QR page', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...ACCOUNT, sparkWalletVerified: false },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] })));
    renderWithLocale(<PosAmount />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/pos');
    });
    expect(screen.queryByRole('button', { name: 'Create payment' })).toBeNull();
  });

  describe('paid charge', () => {
    const GIFT_DAY = {
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
    };
    const OPEN = {
      id: 'c1',
      amountSats: 21,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
      paidAt: null,
    };
    const PAID = { ...OPEN, status: 'paid', paidAt: new Date().toISOString() };

    afterEach(() => {
      vi.useRealTimers();
    });

    /** Lets pending effects start the poll, then moves the clock one poll ahead. */
    async function poll(): Promise<void> {
      await act(async () => undefined);
      await act(async () => {
        vi.advanceTimersByTime(3_000);
      });
    }

    it('shows Paid, bitcoin, fiat, and New payment for a paid charge', async () => {
      vi.mocked(fetchGiftStats).mockResolvedValueOnce(GIFT_DAY as never);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ charge: PAID, history: [PAID] })),
      );
      renderWithLocale(<PosScreen />);
      expect((await screen.findByRole('status')).textContent).toBe('Paid ✓');
      expect(screen.getByText('₿21')).toBeTruthy();
      expect(await screen.findByText('$0.02')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'New payment' }).getAttribute('href')).toBe(
        '/pos/amount',
      );
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Set an amount' })).toBeNull();
      expect(screen.queryByText(/left$/)).toBeNull();
    });

    it('shows a paid charge without fiat when no gift day exists', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ charge: PAID, history: [] })),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'New payment' })).toBeTruthy();
      expect(screen.queryByText(/\$/)).toBeNull();
    });

    it('asks every three seconds while a charge is open and stops once it is paid', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ charge: OPEN, history: [OPEN] }))
        .mockResolvedValueOnce(jsonResponse({ charge: OPEN, history: [OPEN] }))
        .mockResolvedValue(jsonResponse({ charge: PAID, history: [PAID] }));
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await poll();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
      await poll();
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(screen.getByRole('status').textContent).toBe('Paid ✓');
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
      await poll();
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('keeps the open charge when a poll fails', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ charge: OPEN, history: [OPEN] }))
        .mockResolvedValueOnce(jsonResponse({ error: 'down' }, 502));
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      await poll();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('drops a poll answer that arrives after the till unmounts', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      let answer: (response: Response) => void = () => undefined;
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ charge: OPEN, history: [OPEN] }))
        .mockReturnValueOnce(
          new Promise<Response>((resolve) => {
            answer = resolve;
          }),
        );
      vi.stubGlobal('fetch', fetchMock);
      const { unmount } = renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      await poll();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      unmount();
      await act(async () => {
        answer(jsonResponse({ charge: PAID, history: [PAID] }));
      });
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('still shows Paid when the payment is confirmed after the charge ran out', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ charge: ended, history: [ended] }))
        .mockResolvedValueOnce(jsonResponse({ charge: null, history: [ended] }))
        .mockResolvedValue(jsonResponse({ charge: PAID, history: [PAID] }));
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await poll();
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(screen.getByRole('status').textContent).toBe('Paid ✓');
      await poll();
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('keeps Paid when an older till read answers after it', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      let answerRefresh: (response: Response) => void = () => undefined;
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ charge: ended, history: [ended] }))
        .mockReturnValueOnce(
          new Promise<Response>((resolve) => {
            answerRefresh = resolve;
          }),
        )
        .mockResolvedValue(jsonResponse({ charge: PAID, history: [PAID] }));
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      expect(await screen.findByText('0:00 left')).toBeTruthy();
      await poll();
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(screen.getByRole('status').textContent).toBe('Paid ✓');
      await act(async () => {
        answerRefresh(jsonResponse({ charge: null, history: [ended] }));
      });
      expect(screen.getByRole('status').textContent).toBe('Paid ✓');
      expect(screen.queryByRole('link', { name: 'Set an amount' })).toBeNull();
    });

    it('stops asking a minute after the charge ran out', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      const old = { ...OPEN, expiresAt: new Date(Date.now() - 61_000).toISOString() };
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ charge: old, history: [old] }))
        .mockResolvedValue(jsonResponse({ charge: null, history: [old] }));
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await poll();
      await poll();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('stops asking once the charge is cancelled', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          return jsonResponse({ charge: null });
        }
        return fetchMock.mock.calls.length === 1
          ? jsonResponse({ charge: OPEN, history: [OPEN] })
          : jsonResponse({ charge: null, history: [] });
      });
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      const calls = fetchMock.mock.calls.length;
      await poll();
      expect(fetchMock).toHaveBeenCalledTimes(calls);
    });

    it('lets the amount page open a new payment after a paid charge', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ charge: PAID, history: [PAID] })),
      );
      renderWithLocale(<PosAmount />);
      expect(await screen.findByRole('button', { name: 'Create payment' })).toBeTruthy();
      expect(replace).not.toHaveBeenCalled();
    });
  });
});
