import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { PosAmount, PosScreen, resetPosTillWriteForTests } from '@/components/PosScreen';
import { fetchFxSpot } from '@/lib/api';
import { logInteraction } from '@/lib/interaction-log';
import { previousViewPath, recordCurrentView, resetViewHistory } from '@/lib/view-history';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const setup = vi.hoisted(() => ({ failed: false, retry: vi.fn() }));
const ORIGINAL_BREEZ = process.env.NEXT_PUBLIC_BREEZ_API_KEY;

// A member on the till has the wallet open, so the account's amount unit applies.
vi.mock('@/hooks/useWalletOpen', () => ({ useWalletOpen: () => true }));

vi.mock('@/hooks/useWalletSetup', async () => {
  const { needsWalletSetup } = await import('@/lib/wallet/wallet-setup');
  // `due` follows the signed-in account, as the real hook does.
  return {
    useWalletSetup: () => ({ ...setup, due: needsWalletSetup(useAuthStore.getState().account) }),
  };
});

const push = vi.fn();
const replace = vi.fn();
const back = vi.fn();
vi.mock('@/lib/interaction-log', () => ({ logInteraction: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: (): { push: typeof push; replace: typeof replace; back: typeof back } => ({
    push,
    replace,
    back,
  }),
}));

// The till hears this tab's wallet through onPaymentReceived; the tests play the wallet.
const received = vi.hoisted(() => ({
  listeners: new Set<
    (payment: {
      amountSats: number;
      feesSats: number;
      timestamp: number;
      info: { chargeId?: string };
    }) => void
  >(),
}));
vi.mock('@/lib/wallet/wallet-service', async () => {
  const actual = await vi.importActual<typeof import('@/lib/wallet/wallet-service')>(
    '@/lib/wallet/wallet-service',
  );
  return {
    ...actual,
    onPaymentReceived: (
      listener: (payment: {
        amountSats: number;
        feesSats: number;
        timestamp: number;
        info: { chargeId?: string };
      }) => void,
    ) => {
      received.listeners.add(listener);
      return () => {
        received.listeners.delete(listener);
      };
    },
    // The real one checks the Playwright build itself (wallet-service tests); here it reaches the
    // same listeners the mocked onPaymentReceived keeps.
    announceReceivedForE2e: (payment: {
      amountSats: number;
      feesSats: number;
      timestamp: number;
      info: { chargeId?: string };
    }) => {
      for (const listener of [...received.listeners]) {
        listener(payment);
      }
    },
  };
});

/**
 * This tab's wallet reports a completed payment of `amountSats` (after `feesSats`) made at
 * `timestamp`; `chargeId` when it paid the api's Spark invoice of that charge (memo `pos:<id>`).
 */
function receive(
  amountSats: number,
  feesSats = 0,
  timestamp = Date.now(),
  chargeId?: string,
): void {
  act(() => {
    for (const listener of [...received.listeners]) {
      listener({
        amountSats,
        feesSats,
        timestamp,
        info: chargeId === undefined ? {} : { chargeId },
      });
    }
  });
}

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    fetchFxSpot: vi
      .fn()
      .mockResolvedValue({ asOf: '2026-10-07T00:00:00.000Z', source: 'test', rates: {} }),
  };
});

const SPOT = {
  asOf: '2026-10-07T00:00:00.000Z',
  source: 'test',
  rates: { USD: '100000.00', CHF: '80000.00', EUR: '90000.00', PHP: '5600000.00' },
};

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
  walletRequired: true,
  passkeyCredentialId: 'credential',
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

/** Switches the preferred fiat to PHP, as a change on another screen would. */
function PreferPhp(): ReactElement {
  const { setFiat } = useFiatPreference();
  return (
    <button type="button" onClick={() => setFiat('PHP')}>
      Prefer PHP
    </button>
  );
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_BREEZ_API_KEY = 'test-key';
  setup.failed = false;
  setup.retry.mockReset();
  useAuthStore.setState({ session: 'tok', account: ACCOUNT });
});

afterEach(() => {
  cleanup();
  resetPosTillWriteForTests();
  push.mockClear();
  replace.mockClear();
  back.mockClear();
  resetViewHistory();
  useAuthStore.setState({ session: null, account: null });
  if (ORIGINAL_BREEZ === undefined) delete process.env.NEXT_PUBLIC_BREEZ_API_KEY;
  else process.env.NEXT_PUBLIC_BREEZ_API_KEY = ORIGINAL_BREEZ;
  vi.unstubAllGlobals();
  document.cookie = 'fiat=; Max-Age=0; Path=/';
});

describe('PosScreen', () => {
  it('shows the current spot beside an open charge without a stored figure', async () => {
    vi.mocked(fetchFxSpot).mockResolvedValueOnce(SPOT);
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
    expect(await screen.findByText('₿21')).toBeTruthy();
    // No stored figure: the current spot in the viewer's currency, not written onto the charge.
    expect(await screen.findByText('$0.02')).toBeTruthy();
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

  it('steps back to the till it was opened from, so the till keeps its own back', async () => {
    const charge = {
      id: 'c1',
      amountSats: 21,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'POST'
          ? jsonResponse({ charge })
          : jsonResponse({ charge: null, history: [] }),
      ),
    );
    recordCurrentView('/welcome');
    recordCurrentView('/pos');
    recordCurrentView('/pos/amount');
    renderWithLocale(<PosAmount />);
    await pressAmount('21');
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    await waitFor(() => {
      expect(back).toHaveBeenCalledTimes(1);
    });
    act(() => {
      useAuthStore.setState({ session: 'tok', account: { ...ACCOUNT } });
    });
    expect(back).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
    expect(previousViewPath()).toBe('/pos');
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
    expect(screen.getByText('No payments yet.')).toBeTruthy();
    fetchMock.mockImplementation(async () =>
      jsonResponse({ charge: null, history: [{ ...charge, status: 'cancelled' }] }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
    const history = screen.getByRole('region', { name: 'History' });
    expect(within(history).getByText('Cancelled')).toBeTruthy();
    expect(within(history).getByText('₿21')).toBeTruthy();
    expect(screen.queryByText('No payments yet.')).toBeNull();
  });

  it('loads the till of the new session only once a create in flight ends, never the old one', async () => {
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
      expect(fetchMock.mock.calls.length).toBe(callsAtForm + 2);
    });
    act(() => {
      useAuthStore.setState({ session: 'other', account: ACCOUNT });
    });
    // No load over the in-flight create, and the other session's till is not shown meanwhile.
    expect(fetchMock.mock.calls.length).toBe(callsAtForm + 2);
    expect(screen.queryByRole('button', { name: 'Create payment' })).toBeNull();
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
    // The skipped load runs for the new session; the first session's charge never shows for it.
    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBe(callsAtForm + 3);
    });
    const last = fetchMock.mock.calls.at(-1)?.[1] as RequestInit | undefined;
    expect(new Headers(last?.headers).get('authorization')).toBe('Bearer other');
    expect(await screen.findByRole('button', { name: 'Create payment' })).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
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

  it('names the currency when the spot rate cannot price a kept fiat amount', async () => {
    vi.mocked(fetchFxSpot).mockResolvedValueOnce({ ...SPOT, rates: { CHF: '80000.00' } });
    useAuthStore.setState({ session: 'tok', account: { ...ACCOUNT, amountUnit: 'fiat' } });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(
      <>
        <PreferPhp />
        <PosAmount />
      </>,
      'en',
      'ch',
      'CHF',
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'CHF' })).toHaveProperty('ariaPressed', 'true');
    });
    await pressAmount('100');
    fireEvent.click(screen.getByRole('button', { name: 'Prefer PHP' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'PHP' })).toHaveProperty('disabled', true);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    expect((await screen.findByRole('alert')).textContent).toBe('No PHP exchange rate yet.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('charges in bitcoin when the chosen fiat has no rate', async () => {
    useAuthStore.setState({ session: 'tok', account: { ...ACCOUNT, amountUnit: 'fiat' } });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return jsonResponse({ error: 'stop here' }, 400);
      }
      return jsonResponse({ charge: null, history: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosAmount />, 'en', 'ch', 'CHF');
    expect(await screen.findByRole('button', { name: 'CHF' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: '₿' })).toHaveProperty('ariaPressed', 'true');
    await pressAmount('68');
    expect(screen.getByText('No exchange rate yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(true);
    });
    const post = fetchMock.mock.calls.find((call) => call[1]?.method === 'POST');
    const body = JSON.parse(String(post?.[1]?.body)) as { amountSats: number };
    expect(body.amountSats).toBe(68);
    expect(screen.queryByText('Enter a whole number.')).toBeNull();
  });

  it('charges the sats of a fiat amount at the spot rate', async () => {
    vi.mocked(fetchFxSpot).mockResolvedValueOnce(SPOT);
    useAuthStore.setState({ session: 'tok', account: { ...ACCOUNT, amountUnit: 'fiat' } });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return jsonResponse({ error: 'stop here' }, 400);
      }
      return jsonResponse({ charge: null, history: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosAmount />, 'en', 'ch', 'CHF');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'CHF' })).toHaveProperty('ariaPressed', 'true');
    });
    await pressAmount('68');
    expect(screen.getByText("₿85'000")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(true);
    });
    const post = fetchMock.mock.calls.find((call) => call[1]?.method === 'POST');
    const body = JSON.parse(String(post?.[1]?.body)) as { amountSats: number };
    expect(body.amountSats).toBe(85_000);
  });

  it('asks for at least ₿1 when a fiat amount is empty or zero', async () => {
    vi.mocked(fetchFxSpot).mockResolvedValueOnce(SPOT);
    useAuthStore.setState({ session: 'tok', account: { ...ACCOUNT, amountUnit: 'fiat' } });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosAmount />, 'en', 'ch', 'CHF');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'CHF' })).toHaveProperty('ariaPressed', 'true');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Enter an amount of at least ₿1.',
    );
    await pressAmount('0');
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    expect(screen.getByRole('alert').textContent).toContain('Enter an amount of at least ₿1.');
    expect(screen.queryByText('Enter a whole number.')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('says so when a fiat amount cannot be converted to bitcoin', async () => {
    vi.mocked(fetchFxSpot).mockResolvedValueOnce(SPOT);
    useAuthStore.setState({ session: 'tok', account: { ...ACCOUNT, amountUnit: 'fiat' } });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosAmount />, 'en', 'ch', 'CHF');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'CHF' })).toHaveProperty('ariaPressed', 'true');
    });
    await pressAmount('9999999999999');
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'This amount cannot be converted to bitcoin. Enter it in ₿.',
    );
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
      if (sparkWalletVerified === false) {
        expect(screen.queryByText('alice@21.gifts')).toBeNull();
        expect(screen.queryByRole('img', { name: 'Open CryptoPay QR code' })).toBeNull();
      } else {
        expect(screen.getByText('alice@21.gifts')).toBeTruthy();
        expect(screen.getByRole('img', { name: 'Open CryptoPay QR code' })).toBeTruthy();
      }
    }
  });

  it('shows the inline setup note instead of the wallet link after setup failed', async () => {
    setup.failed = true;
    useAuthStore.setState({
      session: 'tok',
      account: { ...ACCOUNT, sparkWalletVerified: false },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] })));
    renderWithLocale(<PosScreen />);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Your wallet could not be set up yet.',
    );
    expect(screen.queryByRole('link', { name: 'Set up your wallet first.' })).toBeNull();
    expect(screen.queryByText('alice@21.gifts')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Open CryptoPay QR code' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(setup.retry).toHaveBeenCalledTimes(1);
  });

  it('hides the address and QR whenever setup reports failure', async () => {
    setup.failed = true;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] })));
    renderWithLocale(<PosScreen />);
    await screen.findByRole('heading', { name: 'Point of sale' });
    expect(screen.queryByText('alice@21.gifts')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Open CryptoPay QR code' })).toBeNull();
  });

  it('does not ask for the wallet when the account has no username', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...ACCOUNT, username: null, sparkWalletVerified: false },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] })));
    renderWithLocale(<PosScreen />);
    expect(
      (await screen.findByRole('link', { name: 'Set a username first.' })).getAttribute('href'),
    ).toBe('/settings#address');
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
    const history = screen.getByRole('region', { name: 'History' });
    expect(within(history).getByText('No payments yet.')).toBeTruthy();
    expect(within(history).queryByText('₿21')).toBeNull();
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
    const history = screen.getByRole('region', { name: 'History' });
    expect(within(history).getByText('Expired')).toBeTruthy();
    expect(within(history).getByText('₿5')).toBeTruthy();
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

  it('hides the open charge and its Cancel once the session disappears', async () => {
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
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
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

  it('hides the amount form once the session disappears', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosAmount />);
    expect(await screen.findByRole('button', { name: 'Create payment' })).toBeTruthy();
    const before = fetchMock.mock.calls.length;
    act(() => {
      useAuthStore.setState({ session: null, account: ACCOUNT });
    });
    expect(screen.queryByRole('button', { name: 'Create payment' })).toBeNull();
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
    const OPEN = {
      id: 'c1',
      amountSats: 21,
      status: 'pending',
      createdAt: new Date().toISOString(),
      // Far enough out that a slow run never reaches its end before the last test.
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      paidAt: null,
    };
    const PAID = { ...OPEN, status: 'paid', paidAt: new Date().toISOString() };
    const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;

    afterEach(() => {
      vi.useRealTimers();
      received.listeners.clear();
      window.history.replaceState({}, '', '/');
      if (ORIGINAL_E2E_NOW === undefined) delete process.env.NEXT_PUBLIC_E2E_NOW;
      else process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
    });

    /** The tab becomes visible again. */
    function showTab(): void {
      const state = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      state.mockRestore();
    }

    /** The full-screen confirmation, once it is on screen. */
    async function confirmation(): Promise<HTMLElement> {
      return screen.findByRole('alertdialog', { name: 'Paid' });
    }

    it('fills the screen with Paid, bitcoin, fiat, and New payment for a paid charge', async () => {
      // The till and its History each read the spot.
      vi.mocked(fetchFxSpot).mockResolvedValue(SPOT);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge: PAID, history: [PAID] })),
      );
      vi.mocked(logInteraction).mockClear();
      renderWithLocale(<PosScreen />);
      const dialog = await confirmation();
      // Recorded by an effect, which may run after the confirmation is in the DOM.
      await waitFor(() => {
        expect(logInteraction).toHaveBeenCalledTimes(1);
      });
      expect(logInteraction).toHaveBeenCalledWith(
        'pos_charge_paid_seen',
        { chargeId: 'c1', amountSats: 21 },
        'tok',
      );
      expect(within(dialog).getByText('₿21')).toBeTruthy();
      expect(within(dialog).getByText('The amount has arrived in your wallet.')).toBeTruthy();
      const history = screen.getByRole('region', { name: 'History' });
      expect(within(history).getByText(/^Paid ✓ /)).toBeTruthy();
      // No figure is stored with this charge: the current spot stands beside the bitcoin.
      expect(await within(dialog).findByText('$0.02')).toBeTruthy();
      expect(await within(history).findByText('$0.02')).toBeTruthy();
      expect(within(dialog).getByRole('link', { name: 'New payment' }).getAttribute('href')).toBe(
        '/pos/amount',
      );
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Set an amount' })).toBeNull();
      expect(screen.queryByText(/left$/)).toBeNull();
      vi.mocked(fetchFxSpot).mockResolvedValue({ asOf: SPOT.asOf, source: 'test', rates: {} });
    });

    it('records a paid charge only for the session that read the till', async () => {
      const answers: ((value: Response) => void)[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(
          () =>
            new Promise<Response>((resolve) => {
              answers.push(resolve);
            }),
        ),
      );
      vi.mocked(logInteraction).mockClear();
      renderWithLocale(<PosScreen />);
      await act(async () => undefined);
      act(() => {
        useAuthStore.setState({ session: 'other' });
      });
      await act(async () => {
        answers[0]?.(jsonResponse({ charge: PAID, history: [PAID] }));
        await Promise.resolve();
      });
      expect(logInteraction).not.toHaveBeenCalled();
      await act(async () => {
        answers[1]?.(jsonResponse({ charge: PAID, history: [PAID] }));
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(logInteraction).toHaveBeenCalledWith(
          'pos_charge_paid_seen',
          { chargeId: 'c1', amountSats: 21 },
          'other',
        );
      });
      expect(logInteraction).toHaveBeenCalledTimes(1);
    });

    it('records a paid charge once per tab, and never from the amount page', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge: PAID, history: [PAID] })),
      );
      vi.mocked(logInteraction).mockClear();
      const amountPage = renderWithLocale(<PosAmount />);
      await act(async () => undefined);
      expect(logInteraction).not.toHaveBeenCalled();
      amountPage.unmount();
      const first = renderWithLocale(<PosScreen />);
      await confirmation();
      first.unmount();
      renderWithLocale(<PosScreen />);
      await confirmation();
      expect(logInteraction).toHaveBeenCalledTimes(1);
    });

    it('shows a paid charge without fiat when there is no spot rate', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge: PAID, history: [] })),
      );
      renderWithLocale(<PosScreen />);
      expect(within(await confirmation()).getByRole('link', { name: 'New payment' })).toBeTruthy();
      expect(screen.queryByText(/\$/)).toBeNull();
    });

    it('turns Paid the moment the wallet receives the open amount, before asking the api, then reads once', async () => {
      const fetchMock = vi
        .fn()
        .mockImplementation(async () => jsonResponse({ charge: OPEN, history: [OPEN] }));
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      expect(screen.getByText('No payments yet.')).toBeTruthy();
      receive(21);
      // On screen in the same update as the wallet's report, before any read.
      const dialog = screen.getByRole('alertdialog', { name: 'Paid' });
      expect(within(dialog).getByText('₿21')).toBeTruthy();
      // Then one read checks it, and no more.
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(2);
      });
      await act(async () => undefined);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
      const history = screen.getByRole('region', { name: 'History' });
      expect(within(history).getByText(/^Paid ✓ /)).toBeTruthy();
      expect(screen.queryByText('No payments yet.')).toBeNull();
    });

    it('also counts the open amount the wallet receives after its fee', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge: OPEN, history: [OPEN] })),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(20, 1);
      expect(await confirmation()).toBeTruthy();
    });

    it('ignores another amount, and any payment while no charge was open', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge: null, history: [] })),
      );
      const empty = renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      // Made well before the next charge exists.
      receive(21, 0, Date.now() - 5_000);
      expect(screen.queryByRole('alertdialog')).toBeNull();
      empty.unmount();
      // The next charge is created after that payment, so the payment is not its.
      const next = { ...OPEN, createdAt: new Date(Date.now() + 1_000).toISOString() };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge: next, history: [next] })),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      expect(screen.queryByRole('alertdialog')).toBeNull();
      receive(22);
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    });

    it('does not listen to the wallet before a signed-in till page opens', async () => {
      useAuthStore.setState({ session: null });
      renderWithLocale(<PosScreen />);
      await act(async () => undefined);
      expect(received.listeners.size).toBe(0);
    });

    it('keeps listening after the till unmounts, so a payment made meanwhile counts', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge: OPEN, history: [OPEN] })),
      );
      const { unmount } = renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      unmount();
      expect(received.listeners.size).toBe(1);
      // The member is on another page when the payment lands; the api still has it open.
      receive(21);
      renderWithLocale(<PosScreen />);
      expect(await confirmation()).toBeTruthy();
      expect(received.listeners.size).toBe(1);
    });

    it('ignores a payment reported after sign-out', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge: OPEN, history: [OPEN] })),
      );
      const first = renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      first.unmount();
      act(() => {
        useAuthStore.setState({ session: null });
      });
      receive(21);
      act(() => {
        useAuthStore.setState({ session: 'tok' });
      });
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('shows the till error when the read after Done fails before the first answer', async () => {
      let answer: (response: Response) => void = () => undefined;
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockImplementationOnce(async () => jsonResponse({ charge: OPEN, history: [OPEN] }))
          .mockImplementationOnce(
            () =>
              new Promise<Response>((resolve) => {
                answer = resolve;
              }),
          )
          .mockImplementation(async () => {
            throw new TypeError('Failed to fetch');
          }),
      );
      // The wallet pays the charge while the amount page is up; the till opens before its read.
      const amountPage = renderWithLocale(<PosAmount />);
      await waitFor(() => {
        expect(received.listeners.size).toBe(1);
      });
      await act(async () => undefined);
      receive(21);
      amountPage.unmount();
      renderWithLocale(<PosScreen />);
      fireEvent.click(within(await confirmation()).getByRole('button', { name: 'Done' }));
      expect(await screen.findByRole('alert')).toBeTruthy();
      answer(jsonResponse({ charge: OPEN, history: [OPEN] }));
    });

    it('counts a payment that lands within a minute after the charge ran out', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ charge: ended, history: [ended] }))
        .mockImplementation(async () => jsonResponse({ charge: null, history: [ended] }));
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      receive(21);
      expect(await confirmation()).toBeTruthy();
      const history = screen.getByRole('region', { name: 'History' });
      expect(within(history).getByText(/^Paid ✓ /)).toBeTruthy();
      expect(within(history).queryByText('Expired')).toBeNull();
    });

    it('counts a payment made in the second the charge was created, not one of the second before', async () => {
      // The wallet states payment times in whole seconds: they are compared with the creation second.
      const created = Math.floor(Date.now() / 1_000) * 1_000 - 4_500;
      const charge = {
        ...OPEN,
        createdAt: new Date(created).toISOString(),
        expiresAt: new Date(created + 60_000).toISOString(),
      };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge, history: [charge] })),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      // The second before: a late report of the charge before, however close, pays nothing.
      receive(21, 0, created - 501);
      await act(async () => undefined);
      expect(screen.queryByRole('alertdialog')).toBeNull();
      receive(21, 0, created - 400);
      expect(await confirmation()).toBeTruthy();
    });

    it('clears a failed expiry read once a later read answers', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          if (reads === 2) {
            throw new TypeError('Failed to fetch');
          }
          return jsonResponse({ charge: reads === 1 ? ended : null, history: [ended] });
        }),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('alert')).toBeTruthy();
      showTab();
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('clears a failed read once the expiry read that started before it answers', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      let answerExpiry: ((value: Response) => void) | undefined;
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          if (reads === 2) {
            return new Promise<Response>((resolve) => {
              answerExpiry = resolve;
            });
          }
          if (reads === 3) {
            throw new TypeError('Failed to fetch');
          }
          return jsonResponse({ charge: ended, history: [ended] });
        }),
      );
      renderWithLocale(<PosScreen />);
      await waitFor(() => {
        expect(answerExpiry).toBeDefined();
      });
      showTab();
      expect(await screen.findByRole('alert')).toBeTruthy();
      await act(async () => {
        answerExpiry?.(jsonResponse({ charge: null, history: [ended] }));
        await Promise.resolve();
      });
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('ignores a failed read that a newer read already answered', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      let failExpiry: ((reason: unknown) => void) | undefined;
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          if (reads === 2) {
            return new Promise<Response>((_resolve, reject) => {
              failExpiry = reject;
            });
          }
          return jsonResponse({ charge: reads === 1 ? ended : null, history: [ended] });
        }),
      );
      renderWithLocale(<PosScreen />);
      await waitFor(() => {
        expect(failExpiry).toBeDefined();
      });
      showTab();
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      await act(async () => {
        failExpiry?.(new TypeError('Failed to fetch'));
        await Promise.resolve();
      });
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('does not count a payment more than a minute after the charge ran out', async () => {
      const old = { ...OPEN, expiresAt: new Date(Date.now() - 61_000).toISOString() };
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(jsonResponse({ charge: old, history: [old] }))
          .mockImplementation(async () => jsonResponse({ charge: null, history: [old] })),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      receive(21);
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('does not count a payment once the charge is cancelled', async () => {
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
      receive(21);
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('sends the amount page back to the till while a wallet-paid charge is not closed', async () => {
      // The api has not seen the payment yet and keeps returning the charge open.
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge: OPEN, history: [OPEN] })),
      );
      const till = renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21);
      expect(await confirmation()).toBeTruthy();
      till.unmount();
      const amountPage = renderWithLocale(<PosAmount />);
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/pos');
      });
      amountPage.unmount();
      renderWithLocale(<PosScreen />);
      expect(await confirmation()).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    });

    it('keeps a closed confirmation closed on the next till', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge: PAID, history: [PAID] })),
      );
      const first = renderWithLocale(<PosScreen />);
      fireEvent.click(within(await confirmation()).getByRole('button', { name: 'Done' }));
      expect(screen.queryByRole('alertdialog')).toBeNull();
      first.unmount();
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('starts over for another session', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge: OPEN, history: [OPEN] })),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21);
      expect(await confirmation()).toBeTruthy();
      act(() => {
        useAuthStore.setState({ session: 'other' });
      });
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
    });

    it('still counts a payment when Cancel failed', async () => {
      const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'DELETE'
          ? jsonResponse({ error: 'down' }, 502)
          : jsonResponse({ charge: OPEN, history: [OPEN] }),
      );
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
      expect(await screen.findByRole('alert')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21);
      expect(await confirmation()).toBeTruthy();
    });

    it('New payment closes the confirmation, so the next till does not show it again', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge: PAID, history: [PAID] })),
      );
      const first = renderWithLocale(<PosScreen />);
      fireEvent.click(within(await confirmation()).getByRole('link', { name: 'New payment' }));
      first.unmount();
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('hides an older paid charge behind a newer open one', async () => {
      const next = {
        ...OPEN,
        id: 'c2',
        amountSats: 42,
        createdAt: new Date(Date.now() + 60_000).toISOString(),
      };
      const fetchMock = vi
        .fn()
        .mockImplementationOnce(async () => jsonResponse({ charge: OPEN, history: [OPEN] }))
        .mockImplementation(async () => jsonResponse({ charge: next, history: [next, OPEN] }));
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21);
      expect(await confirmation()).toBeTruthy();
      showTab();
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).toBeNull();
      });
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
      expect(screen.getByText('₿42')).toBeTruthy();
    });

    it('does not take the charge of the session before as the open charge of the next', async () => {
      const fetchMock = vi
        .fn()
        .mockImplementationOnce(async () => jsonResponse({ charge: OPEN, history: [OPEN] }))
        // The next session's till has not answered yet.
        .mockImplementation(() => new Promise<Response>(() => undefined));
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      act(() => {
        useAuthStore.setState({ session: 'other' });
      });
      await act(async () => undefined);
      receive(21);
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('records a wallet-paid charge as seen at once, under the session the wallet memory is for', async () => {
      let answer: (response: Response) => void = () => undefined;
      const fetchMock = vi
        .fn()
        .mockImplementationOnce(async () => jsonResponse({ charge: OPEN, history: [OPEN] }))
        .mockImplementationOnce(
          () =>
            new Promise<Response>((resolve) => {
              answer = resolve;
            }),
        );
      vi.stubGlobal('fetch', fetchMock);
      vi.mocked(logInteraction).mockClear();
      // The amount page hears the payment; it never records a paid charge itself.
      const amountPage = renderWithLocale(<PosAmount />);
      await waitFor(() => {
        expect(received.listeners.size).toBe(1);
      });
      await act(async () => undefined);
      receive(21);
      amountPage.unmount();
      renderWithLocale(<PosScreen />);
      expect(await confirmation()).toBeTruthy();
      // Before the till read is in, recorded under the signed-in session.
      await waitFor(() => {
        expect(logInteraction).toHaveBeenCalledWith(
          'pos_charge_paid_seen',
          { chargeId: 'c1', amountSats: 21 },
          'tok',
        );
      });
      await act(async () => {
        answer(jsonResponse({ charge: OPEN, history: [OPEN] }));
      });
      expect(logInteraction).toHaveBeenCalledTimes(1);
    });

    it('confirms on the till a late payment that lands while the amount page is up', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockImplementationOnce(async () => jsonResponse({ charge: ended, history: [ended] }))
          .mockImplementation(async () => jsonResponse({ charge: null, history: [ended] })),
      );
      const till = renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      till.unmount();
      renderWithLocale(<PosAmount />);
      expect(await screen.findByRole('button', { name: 'Create payment' })).toBeTruthy();
      expect(replace).not.toHaveBeenCalled();
      receive(21);
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/pos');
      });
      // Leaving to show the payment, the page no longer takes a new charge.
      expect(screen.queryByRole('button', { name: 'Create payment' })).toBeNull();
    });

    it('does not count a payment for a charge a read no longer has before its end', async () => {
      const fetchMock = vi
        .fn()
        .mockImplementationOnce(async () => jsonResponse({ charge: OPEN, history: [OPEN] }))
        // Cancelled on another device.
        .mockImplementation(async () => jsonResponse({ charge: null, history: [] }));
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      showTab();
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      receive(21);
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('counts a payment that lands while the till is still reading the open charge', async () => {
      let answer: (response: Response) => void = () => undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(
          () =>
            new Promise<Response>((resolve) => {
              answer = resolve;
            }),
        ),
      );
      renderWithLocale(<PosScreen />);
      await waitFor(() => {
        expect(received.listeners.size).toBe(1);
      });
      receive(21);
      await act(async () => {
        answer(jsonResponse({ charge: OPEN, history: [OPEN] }));
      });
      expect(await confirmation()).toBeTruthy();
    });

    it('does not count a payment heard before the charge was created', async () => {
      const later = { ...OPEN, createdAt: new Date(Date.now() + 60_000).toISOString() };
      let answer: (response: Response) => void = () => undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(
          () =>
            new Promise<Response>((resolve) => {
              answer = resolve;
            }),
        ),
      );
      renderWithLocale(<PosScreen />);
      await waitFor(() => {
        expect(received.listeners.size).toBe(1);
      });
      receive(21);
      await act(async () => {
        answer(jsonResponse({ charge: later, history: [later] }));
      });
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('counts a payment for the next charge heard while the last one is still known', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      let next: typeof OPEN | null = null;
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockImplementationOnce(async () => jsonResponse({ charge: ended, history: [ended] }))
          .mockImplementation(async () =>
            jsonResponse({ charge: next, history: next === null ? [ended] : [next, ended] }),
          ),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      // A new charge of ₿42 was created elsewhere and paid before this till read it.
      next = { ...OPEN, id: 'c2', amountSats: 42, createdAt: new Date().toISOString() };
      receive(42);
      expect(screen.queryByRole('alertdialog')).toBeNull();
      showTab();
      const dialog = await confirmation();
      expect(within(dialog).getByText('₿42')).toBeTruthy();
    });

    it('does not count a kept payment for a charge created after the wallet made it', async () => {
      const heard = Date.now();
      // Read in between: created before the payment, another amount, so the payment stays parked.
      const between = {
        ...OPEN,
        id: 'c2',
        amountSats: 30,
        createdAt: new Date(heard - 1_000).toISOString(),
      };
      // Created after the payment was made: the payment is not its.
      const later = {
        ...OPEN,
        id: 'c3',
        amountSats: 42,
        createdAt: new Date(heard + 2_000).toISOString(),
      };
      let charge: typeof OPEN = OPEN;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge, history: [charge] })),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(42, 0, heard);
      charge = between;
      showTab();
      expect(await screen.findByText('₿30')).toBeTruthy();
      charge = later;
      showTab();
      expect(await screen.findByText('₿42')).toBeTruthy();
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    });

    it('counts a payment heard while a new charge of the same amount is created for the new one', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      const fresh = { ...OPEN, id: 'c2', createdAt: new Date(Date.now() - 1).toISOString() };
      let releasePost: ((value: Response) => void) | undefined;
      let serverCharge: typeof OPEN | null = ended;
      vi.stubGlobal(
        'fetch',
        vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'POST') {
            return new Promise<Response>((resolve) => {
              releasePost = resolve;
            });
          }
          const charge = serverCharge;
          serverCharge = charge === ended ? null : charge;
          return Promise.resolve(
            jsonResponse({ charge, history: charge === null ? [] : [charge] }),
          );
        }),
      );
      const till = renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      till.unmount();
      const amountPage = renderWithLocale(<PosAmount />);
      await pressAmount('21');
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      await waitFor(() => {
        expect(releasePost).toBeDefined();
      });
      // The payer pays the new pin before the create answer is in.
      receive(21);
      await act(async () => {
        releasePost?.(jsonResponse({ charge: fresh }, 201));
      });
      amountPage.unmount();
      serverCharge = fresh;
      renderWithLocale(<PosScreen />);
      const dialog = await confirmation();
      expect(within(dialog).getByText('₿21')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    });

    it('gives the late minute back when creating a new charge fails', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      let first = true;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'POST') {
            return jsonResponse({ error: 'down' }, 502);
          }
          const charge = first ? ended : null;
          first = false;
          return jsonResponse({ charge, history: [ended] });
        }),
      );
      const till = renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      till.unmount();
      renderWithLocale(<PosAmount />);
      await pressAmount('5');
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      expect(await screen.findByRole('alert')).toBeTruthy();
      expect(replace).not.toHaveBeenCalled();
      receive(21);
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/pos');
      });
    });

    it('judges the late minute of a kept payment by the time the wallet made it', async () => {
      const heard = Date.now();
      const open = { ...OPEN, expiresAt: new Date(heard + 1_000).toISOString() };
      let answer: (response: Response) => void = () => undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(
          () =>
            new Promise<Response>((resolve) => {
              answer = resolve;
            }),
        ),
      );
      renderWithLocale(<PosScreen />);
      await waitFor(() => {
        expect(received.listeners.size).toBe(1);
      });
      receive(21);
      // The read that names the charge is applied long after its late minute.
      const clock = vi.spyOn(Date, 'now').mockReturnValue(heard + 120_000);
      await act(async () => {
        answer(jsonResponse({ charge: open, history: [open] }));
      });
      expect(await confirmation()).toBeTruthy();
      clock.mockRestore();
    });

    it('counts a payment heard while a failing create was on its way for the charge before', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      let failPost: ((value: Response) => void) | undefined;
      let first = true;
      vi.stubGlobal(
        'fetch',
        vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'POST') {
            return new Promise<Response>((resolve) => {
              failPost = resolve;
            });
          }
          const charge = first ? ended : null;
          first = false;
          return Promise.resolve(jsonResponse({ charge, history: [ended] }));
        }),
      );
      const till = renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      till.unmount();
      renderWithLocale(<PosAmount />);
      await pressAmount('5');
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      await waitFor(() => {
        expect(failPost).toBeDefined();
      });
      receive(21);
      expect(replace).not.toHaveBeenCalled();
      await act(async () => {
        failPost?.(jsonResponse({ error: 'down' }, 502));
      });
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/pos');
      });
    });

    it('lets the late wallet report of a charge before pay nothing on the next one', async () => {
      const next = { ...OPEN, id: 'c2', createdAt: new Date().toISOString() };
      let charge: Record<string, unknown> = OPEN;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge, history: [charge] })),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      const paidAt = Date.now();
      // The api saw the payment first, while this tab was in the background.
      charge = PAID;
      showTab();
      fireEvent.click(within(await confirmation()).getByRole('button', { name: 'Done' }));
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      // A new charge of the same amount is open when the wallet finally reports the first payment.
      charge = next;
      showTab();
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      // Made before the new charge was created: the report of the first payment.
      receive(21, 0, Math.min(paidAt, Date.parse(next.createdAt)) - 5_000);
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
      // The next payment of that amount is the new charge's.
      receive(21);
      expect(await confirmation()).toBeTruthy();
    });

    it('counts the payment of a new charge reported before the late report of the one before', async () => {
      const next = { ...OPEN, id: 'c2', createdAt: new Date().toISOString() };
      let charge: Record<string, unknown> = PAID;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge, history: [charge] })),
      );
      renderWithLocale(<PosScreen />);
      fireEvent.click(within(await confirmation()).getByRole('button', { name: 'Done' }));
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      charge = next;
      showTab();
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21);
      expect(await confirmation()).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      // The first charge's own report, made before the new charge, arrives last and pays nothing.
      receive(21, 0, Date.parse(next.createdAt) - 5_000);
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('keeps a payment the charge before does not take when a create fails', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      let failPost: ((value: Response) => void) | undefined;
      let serverCharge: Record<string, unknown> | null = ended;
      vi.stubGlobal(
        'fetch',
        vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'POST') {
            return new Promise<Response>((resolve) => {
              failPost = resolve;
            });
          }
          const charge = serverCharge;
          serverCharge = charge === ended ? null : charge;
          return Promise.resolve(
            jsonResponse({ charge, history: charge === null ? [] : [charge] }),
          );
        }),
      );
      const till = renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      till.unmount();
      const amountPage = renderWithLocale(<PosAmount />);
      await pressAmount('42');
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      await waitFor(() => {
        expect(failPost).toBeDefined();
      });
      // The api did create the ₿42 charge, and it was paid, but its answer is lost.
      const lost = { ...OPEN, id: 'c2', amountSats: 42, createdAt: new Date().toISOString() };
      receive(42);
      await act(async () => {
        failPost?.(jsonResponse({ error: 'down' }, 502));
      });
      amountPage.unmount();
      serverCharge = lost;
      renderWithLocale(<PosScreen />);
      const dialog = await confirmation();
      expect(within(dialog).getByText('₿42')).toBeTruthy();
    });

    it('leaves the next session alone when a create of the session before fails', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      const theirs = { ...OPEN, id: 'c9', amountSats: 42 };
      let failPost: ((value: Response) => void) | undefined;
      let first = true;
      vi.stubGlobal(
        'fetch',
        vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'POST') {
            return new Promise<Response>((resolve) => {
              failPost = resolve;
            });
          }
          const auth = new Headers(init?.headers).get('authorization') ?? '';
          const charge = auth.endsWith('other') ? theirs : first ? ended : null;
          first = false;
          return Promise.resolve(
            jsonResponse({ charge, history: charge === null ? [] : [charge] }),
          );
        }),
      );
      const till = renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      till.unmount();
      const amountPage = renderWithLocale(<PosAmount />);
      await pressAmount('5');
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      await waitFor(() => {
        expect(failPost).toBeDefined();
      });
      amountPage.unmount();
      act(() => {
        useAuthStore.setState({ session: 'other' });
      });
      // The next session's till waits for that create; its wallet reports a payment meanwhile.
      renderWithLocale(<PosScreen />);
      await waitFor(() => {
        expect(received.listeners.size).toBe(1);
      });
      receive(42);
      // The create of the session before fails only now.
      await act(async () => {
        failPost?.(jsonResponse({ error: 'down' }, 502));
      });
      const dialog = await confirmation();
      expect(within(dialog).getByText('₿42')).toBeTruthy();
    });

    it('takes over a charge whose create answer was lost, with the payment made meanwhile', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      const made = { ...OPEN, id: 'c2', createdAt: new Date().toISOString() };
      let failPost: ((value: Response) => void) | undefined;
      let serverCharge: Record<string, unknown> | null = ended;
      vi.stubGlobal(
        'fetch',
        vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'POST') {
            return new Promise<Response>((resolve) => {
              failPost = resolve;
            });
          }
          const charge = serverCharge;
          serverCharge = charge === ended ? null : charge;
          return Promise.resolve(
            jsonResponse({ charge, history: charge === null ? [] : [charge] }),
          );
        }),
      );
      const till = renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      till.unmount();
      const amountPage = renderWithLocale(<PosAmount />);
      await pressAmount('21');
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      await waitFor(() => {
        expect(failPost).toBeDefined();
      });
      // The api made the ₿21 charge and it was paid, but the answer to the create is lost.
      serverCharge = made;
      receive(21);
      await act(async () => {
        failPost?.(jsonResponse({ error: 'Bad gateway' }, 502));
      });
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/pos');
      });
      expect(screen.queryByRole('alert')).toBeNull();
      amountPage.unmount();
      renderWithLocale(<PosScreen />);
      const dialog = await confirmation();
      expect(within(dialog).getByText('₿21')).toBeTruthy();
      // The charge before keeps its own status: the payment was the new charge's.
      const history = screen.getByRole('region', { name: 'History' });
      expect(within(history).getAllByText(/^Paid ✓ /)).toHaveLength(1);
    });

    it('gives the charge before no payment when the read after a lost create shows a newer charge open', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      const newer = { ...OPEN, id: 'c-new', createdAt: new Date().toISOString() };
      let reads = 0;
      let failPost: ((value: Response) => void) | undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'POST') {
            return new Promise<Response>((resolve) => {
              failPost = resolve;
            });
          }
          reads += 1;
          if (reads === 1) {
            return jsonResponse({ charge: ended, history: [ended] });
          }
          if (reads <= 3) {
            return jsonResponse({ charge: null, history: [ended] });
          }
          if (reads === 4) {
            // The read right before the create fails.
            throw new TypeError('Failed to fetch');
          }
          return jsonResponse({ charge: newer, history: [newer, ended] });
        }),
      );
      const till = renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      till.unmount();
      const amountPage = renderWithLocale(<PosAmount />);
      await pressAmount('21');
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      await waitFor(() => {
        expect(failPost).toBeDefined();
      });
      // The payer pays the new charge while the create's answer is on its way, within the late
      // minute of the charge before.
      receive(21);
      await act(async () => {
        failPost?.(jsonResponse({ error: 'Bad gateway' }, 502));
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/pos');
      });
      amountPage.unmount();
      renderWithLocale(<PosScreen />);
      // The payment counts for the open charge, not for the charge before.
      expect(await confirmation()).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    });

    it('gives the charge before no payment when the read after a lost create shows a newer charge paid', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      const newerPaid = {
        ...PAID,
        id: 'c-paid',
        createdAt: new Date().toISOString(),
        paidAt: new Date().toISOString(),
      };
      let reads = 0;
      let failPost: ((value: Response) => void) | undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'POST') {
            return new Promise<Response>((resolve) => {
              failPost = resolve;
            });
          }
          reads += 1;
          if (reads === 1) {
            return jsonResponse({ charge: ended, history: [ended] });
          }
          if (reads <= 3) {
            return jsonResponse({ charge: null, history: [ended] });
          }
          if (reads === 4) {
            throw new TypeError('Failed to fetch');
          }
          return jsonResponse({ charge: newerPaid, history: [newerPaid, ended] });
        }),
      );
      const till = renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      till.unmount();
      const amountPage = renderWithLocale(<PosAmount />);
      await pressAmount('21');
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      await waitFor(() => {
        expect(failPost).toBeDefined();
      });
      receive(21);
      await act(async () => {
        failPost?.(jsonResponse({ error: 'Bad gateway' }, 502));
        await Promise.resolve();
      });
      expect(await screen.findByRole('alert')).toBeTruthy();
      amountPage.unmount();
      renderWithLocale(<PosScreen />);
      fireEvent.click(within(await confirmation()).getByRole('button', { name: 'Done' }));
      // One payment, one paid sale: the charge before stays expired.
      const history = screen.getByRole('region', { name: 'History' });
      expect(await within(history).findByText('Expired')).toBeTruthy();
      expect(within(history).getAllByText(/^Paid ✓/)).toHaveLength(1);
    });

    it('gives the charge before its payment when the read after a lost create shows an older charge', async () => {
      const ended = {
        ...OPEN,
        createdAt: new Date(Date.now() - 120_000).toISOString(),
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
      };
      // Paid within the last minute but created before the charge before: not a newer charge.
      const older = {
        ...PAID,
        id: 'c-old',
        createdAt: new Date(Date.now() - 300_000).toISOString(),
        paidAt: new Date(Date.now() - 30_000).toISOString(),
      };
      let reads = 0;
      let failPost: ((value: Response) => void) | undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'POST') {
            return new Promise<Response>((resolve) => {
              failPost = resolve;
            });
          }
          reads += 1;
          if (reads === 1) {
            return jsonResponse({ charge: ended, history: [ended, older] });
          }
          if (reads <= 3) {
            return jsonResponse({ charge: null, history: [ended, older] });
          }
          if (reads === 4) {
            throw new TypeError('Failed to fetch');
          }
          return jsonResponse({ charge: older, history: [ended, older] });
        }),
      );
      const till = renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      till.unmount();
      const amountPage = renderWithLocale(<PosAmount />);
      await pressAmount('21');
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      await waitFor(() => {
        expect(failPost).toBeDefined();
      });
      // The payment of the charge before, in its late minute, reported while the create is on its way.
      receive(21);
      await act(async () => {
        failPost?.(jsonResponse({ error: 'Bad gateway' }, 502));
        await Promise.resolve();
      });
      expect(await screen.findByRole('alert')).toBeTruthy();
      amountPage.unmount();
      renderWithLocale(<PosScreen />);
      fireEvent.click(within(await confirmation()).getByRole('button', { name: 'Done' }));
      // The charge before took its own payment: both charges are paid, none expired.
      const history = screen.getByRole('region', { name: 'History' });
      await waitFor(() => {
        expect(within(history).getAllByText(/^Paid ✓/)).toHaveLength(2);
      });
      expect(within(history).queryByText('Expired')).toBeNull();
    });

    it('keeps the error of a new session when the expiry read of the session before answers late', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      let answerExpiry: ((value: Response) => void) | undefined;
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          if (reads === 1) {
            return jsonResponse({ charge: ended, history: [ended] });
          }
          if (reads === 2) {
            return new Promise<Response>((resolve) => {
              answerExpiry = resolve;
            });
          }
          throw new TypeError('Failed to fetch');
        }),
      );
      renderWithLocale(<PosScreen />);
      await waitFor(() => {
        expect(answerExpiry).toBeDefined();
      });
      act(() => {
        useAuthStore.setState({ session: 'other', account: ACCOUNT });
      });
      expect(await screen.findByRole('alert')).toBeTruthy();
      await act(async () => {
        answerExpiry?.(jsonResponse({ charge: null, history: [ended] }));
        await Promise.resolve();
      });
      expect(screen.getByRole('alert')).toBeTruthy();
    });

    it('falls back to the charge before when the read after a lost create answer fails', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'POST') {
            return jsonResponse({ error: 'Bad gateway' }, 502);
          }
          reads += 1;
          if (reads === 1) {
            return jsonResponse({ charge: ended, history: [ended] });
          }
          // The till's read at 0:00, the amount page's read, and the read right before the create find
          // no charge open.
          if (reads <= 4) {
            return jsonResponse({ charge: null, history: [ended] });
          }
          throw new TypeError('Failed to fetch');
        }),
      );
      const till = renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      till.unmount();
      renderWithLocale(<PosAmount />);
      await pressAmount('5');
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      expect(await screen.findByRole('alert')).toBeTruthy();
      expect(reads).toBe(5);
      // The charge before is payable again for its late minute.
      receive(21);
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/pos');
      });
    });

    it('does not read the till again when the api refuses a create', async () => {
      const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'POST'
          ? jsonResponse({ error: 'A payment is already open' }, 409)
          : jsonResponse({ charge: null, history: [] }),
      );
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosAmount />);
      await pressAmount('5');
      const before = fetchMock.mock.calls.length;
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      expect(await screen.findByText('A payment is already open.')).toBeTruthy();
      // The read right before the create and the create; no read after the refusal.
      expect(fetchMock.mock.calls.length).toBe(before + 2);
    });

    it('does not count a payment reported while a cancel that goes through is on its way', async () => {
      let releaseDelete: ((value: Response) => void) | undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'DELETE') {
            return new Promise<Response>((resolve) => {
              releaseDelete = resolve;
            });
          }
          return Promise.resolve(
            releaseDelete === undefined
              ? jsonResponse({ charge: OPEN, history: [OPEN] })
              : jsonResponse({ charge: null, history: [{ ...OPEN, status: 'cancelled' }] }),
          );
        }),
      );
      renderWithLocale(<PosScreen />);
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
      await waitFor(() => {
        expect(releaseDelete).toBeDefined();
      });
      receive(21);
      await act(async () => {
        releaseDelete?.(jsonResponse({ charge: null }));
      });
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('counts a payment reported while a cancel that fails is on its way', async () => {
      let failDelete: ((value: Response) => void) | undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'DELETE') {
            return new Promise<Response>((resolve) => {
              failDelete = resolve;
            });
          }
          return Promise.resolve(jsonResponse({ charge: OPEN, history: [OPEN] }));
        }),
      );
      renderWithLocale(<PosScreen />);
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
      await waitFor(() => {
        expect(failDelete).toBeDefined();
      });
      receive(21);
      expect(screen.queryByRole('alertdialog')).toBeNull();
      await act(async () => {
        failDelete?.(jsonResponse({ error: 'down' }, 502));
      });
      expect(await confirmation()).toBeTruthy();
    });

    it('shows the till error when the read after a cancel that went through fails', async () => {
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'DELETE') {
            return jsonResponse({ charge: null });
          }
          reads += 1;
          if (reads === 1) {
            return jsonResponse({ charge: OPEN, history: [OPEN] });
          }
          throw new TypeError('Failed to fetch');
        }),
      );
      renderWithLocale(<PosScreen />);
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
      expect(await screen.findByRole('alert')).toBeTruthy();
      // The api cancelled: the till drops the charge without waiting for the next read.
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
      expect(screen.getByRole('link', { name: 'Set an amount' })).toBeTruthy();
      expect(screen.getByText('Cancelled')).toBeTruthy();
      receive(21);
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('clears an earlier error on Done and keeps a failed read after it quiet', async () => {
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'DELETE') {
            return jsonResponse({ error: 'down' }, 502);
          }
          reads += 1;
          if (reads === 1) {
            return jsonResponse({ charge: OPEN, history: [OPEN] });
          }
          throw new TypeError('Failed to fetch');
        }),
      );
      renderWithLocale(<PosScreen />);
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
      expect(await screen.findByRole('alert')).toBeTruthy();
      receive(21);
      fireEvent.click(within(await confirmation()).getByRole('button', { name: 'Done' }));
      await waitFor(() => {
        // The read after the failed cancel, the one that checks the payment, then the read after Done.
        expect(reads).toBe(4);
      });
      await act(async () => undefined);
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByRole('link', { name: 'Set an amount' })).toBeTruthy();
    });

    /**
     * Creates a charge of `draft` on the amount page; the api answers with `created`.
     * Resolves the body the till posted.
     */
    async function createOnAmountPage(
      draft: string,
      created: Record<string, unknown>,
    ): Promise<unknown> {
      let posted: unknown = null;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'POST') {
            posted = JSON.parse(String(init.body));
            return jsonResponse({ charge: created }, 201);
          }
          return jsonResponse({ charge: null, history: [] });
        }),
      );
      const amountPage = renderWithLocale(<PosAmount />, 'en', 'ch', 'CHF');
      await pressAmount(draft);
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/pos');
      });
      amountPage.unmount();
      return posted;
    }

    it('sends the typed figure with the create and shows the stored one, not a spot price', async () => {
      vi.mocked(fetchFxSpot).mockResolvedValue(SPOT);
      useAuthStore.setState({ session: 'tok', account: { ...ACCOUNT, amountUnit: 'fiat' } });
      // The api stores the typed figure with the charge and returns it; it pinned another sat
      // amount than the spot gives for CHF 68, and the figure stays 68.00.
      const created = {
        ...OPEN,
        id: 'c7',
        createdAt: new Date().toISOString(),
        amountCurrency: 'CHF',
        amount: '68',
      };
      const posted = await createOnAmountPage('68', created);
      expect(posted).toEqual({ amountSats: 85_000, amountCurrency: 'CHF', amount: '68' });
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockImplementation(async () => jsonResponse({ charge: created, history: [created] })),
      );
      renderWithLocale(<PosScreen />, 'en', 'ch', 'CHF');
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      // The countdown shows the typed figure too.
      expect(screen.getByText('CHF 68.00')).toBeTruthy();
      receive(21);
      const dialog = await confirmation();
      expect(within(dialog).getByText('CHF 68.00')).toBeTruthy();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
      const history = screen.getByRole('region', { name: 'History' });
      expect(await within(history).findByText('CHF 68.00')).toBeTruthy();
      vi.mocked(fetchFxSpot).mockResolvedValue({ asOf: SPOT.asOf, source: 'test', rates: {} });
    });

    it('shows the current spot, not a stored figure, for a charge typed in bitcoin', async () => {
      vi.mocked(fetchFxSpot).mockResolvedValueOnce(SPOT).mockResolvedValueOnce(SPOT);
      const created = { ...OPEN, id: 'c8', amountSats: 2_100, createdAt: new Date().toISOString() };
      // Bitcoin typed sends no figure.
      expect(await createOnAmountPage('2100', created)).toEqual({ amountSats: 2_100 });
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockImplementation(async () => jsonResponse({ charge: created, history: [created] })),
      );
      renderWithLocale(<PosScreen />, 'en', 'ch', 'CHF');
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      await waitFor(() => {
        expect(fetchFxSpot).toHaveBeenCalled();
      });
      // No currency was typed: the current spot in the viewer's currency stands beside it.
      expect(await screen.findByText('CHF 1.68')).toBeTruthy();
      receive(2_100);
      const dialog = await confirmation();
      expect(within(dialog).getByText("₿2'100")).toBeTruthy();
      expect(within(dialog).getByText('CHF 1.68')).toBeTruthy();
    });

    it('takes over the charge a lost create made, with the figure stored on it and no error', async () => {
      const alerted = await loseCreateAnswer({
        ...OPEN,
        id: 'c5',
        amountSats: 85_000,
        createdAt: new Date().toISOString(),
        amountCurrency: 'CHF',
        amount: '68',
      });
      expect(alerted).toBe(false);
      const dialog = await confirmation();
      expect(within(dialog).getByText("₿85'000")).toBeTruthy();
      // The figure comes from the charge the api stored, not from this tab.
      expect(within(dialog).getByText('CHF 68.00')).toBeTruthy();
    });

    /**
     * Types CHF 68 on the amount page; the create's answer is lost and the till then reads `found`.
     * Resolves whether the amount page showed an error, that is, whether `found` was not taken over.
     */
    async function loseCreateAnswer(found: Record<string, unknown>): Promise<boolean> {
      vi.mocked(fetchFxSpot).mockResolvedValue(SPOT);
      useAuthStore.setState({ session: 'tok', account: { ...ACCOUNT, amountUnit: 'fiat' } });
      let lost = false;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'POST') {
            lost = true;
            return jsonResponse({ error: 'Bad gateway' }, 502);
          }
          return lost
            ? jsonResponse({ charge: found, history: [found] })
            : jsonResponse({ charge: null, history: [] });
        }),
      );
      const amountPage = renderWithLocale(<PosAmount />, 'en', 'ch', 'CHF');
      await pressAmount('68');
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/pos');
      });
      const alerted = screen.queryByRole('alert') !== null;
      amountPage.unmount();
      renderWithLocale(<PosScreen />, 'en', 'ch', 'CHF');
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(Number(found['amountSats']));
      vi.mocked(fetchFxSpot).mockResolvedValue({ asOf: SPOT.asOf, source: 'test', rates: {} });
      return alerted;
    }

    it('confirms at once a charge the lost create made that is already paid', async () => {
      vi.mocked(fetchFxSpot).mockResolvedValue(SPOT);
      useAuthStore.setState({ session: 'tok', account: { ...ACCOUNT, amountUnit: 'fiat' } });
      const paidMeanwhile = {
        ...OPEN,
        id: 'c11',
        amountSats: 85_000,
        status: 'paid',
        createdAt: new Date().toISOString(),
        paidAt: new Date().toISOString(),
        amountCurrency: 'CHF',
        amount: '68',
      };
      let lost = false;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'POST') {
            lost = true;
            return jsonResponse({ error: 'Bad gateway' }, 502);
          }
          return lost
            ? jsonResponse({ charge: paidMeanwhile, history: [paidMeanwhile] })
            : jsonResponse({ charge: null, history: [] });
        }),
      );
      const amountPage = renderWithLocale(<PosAmount />, 'en', 'ch', 'CHF');
      await pressAmount('68');
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/pos');
      });
      expect(screen.queryByRole('alert')).toBeNull();
      amountPage.unmount();
      renderWithLocale(<PosScreen />, 'en', 'ch', 'CHF');
      const dialog = await confirmation();
      expect(within(dialog).getByText("₿85'000")).toBeTruthy();
      expect(within(dialog).getByText('CHF 68.00')).toBeTruthy();
      vi.mocked(fetchFxSpot).mockResolvedValue({ asOf: SPOT.asOf, source: 'test', rates: {} });
    });

    it('does not take over another amount found after a lost create answer', async () => {
      const alerted = await loseCreateAnswer({
        ...OPEN,
        id: 'c6',
        createdAt: new Date().toISOString(),
      });
      expect(alerted).toBe(true);
      expect(await confirmation()).toBeTruthy();
    });

    it('does not take over a charge made well before a lost create', async () => {
      const alerted = await loseCreateAnswer({
        ...OPEN,
        id: 'c10',
        amountSats: 85_000,
        createdAt: new Date(Date.now() - 60_000).toISOString(),
      });
      expect(alerted).toBe(true);
      expect(await confirmation()).toBeTruthy();
    });

    it('does not take a charge the till already knows for a create whose answer was lost', async () => {
      const paidJustNow = {
        ...PAID,
        createdAt: new Date().toISOString(),
        paidAt: new Date().toISOString(),
      };
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
          init?.method === 'POST'
            ? jsonResponse({ error: 'Bad gateway' }, 502)
            : jsonResponse({ charge: paidJustNow, history: [paidJustNow] }),
        ),
      );
      renderWithLocale(<PosAmount />);
      await pressAmount('21');
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      expect(await screen.findByRole('alert')).toBeTruthy();
      expect(replace).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Create payment' })).toBeTruthy();
    });

    it('keeps a charge cancelled when the cancel answer is lost but the api cancelled it', async () => {
      let cancelledOnApi = false;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'DELETE') {
            cancelledOnApi = true;
            throw new TypeError('Failed to fetch');
          }
          return cancelledOnApi
            ? jsonResponse({ charge: null, history: [{ ...OPEN, status: 'cancelled' }] })
            : jsonResponse({ charge: OPEN, history: [OPEN] });
        }),
      );
      renderWithLocale(<PosScreen />);
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
      receive(21);
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('stops a charge read as paid after its end from taking another payment', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockImplementationOnce(async () => jsonResponse({ charge: ended, history: [ended] }))
          // The read at 0:00 finds it paid (over a minute ago, so no longer the till's charge).
          .mockImplementation(async () =>
            jsonResponse({
              charge: null,
              history: [{ ...ended, status: 'paid', paidAt: new Date().toISOString() }],
            }),
          ),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      await act(async () => undefined);
      receive(21);
      await act(async () => undefined);
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('does not take for a lost create a charge another device made before the click', async () => {
      // Paid within the last minute, so the api still returns it as the till's charge.
      const theirs = {
        ...PAID,
        id: 'c12',
        createdAt: new Date().toISOString(),
        paidAt: new Date().toISOString(),
      };
      let page = true;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'POST') {
            return jsonResponse({ error: 'Bad gateway' }, 502);
          }
          // The amount page read before the other device made its charge; every later read shows it.
          const charge = page ? null : theirs;
          page = false;
          return jsonResponse({ charge, history: charge === null ? [] : [charge] });
        }),
      );
      renderWithLocale(<PosAmount />);
      await pressAmount('21');
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      expect(await screen.findByText('Point of sale is unavailable.')).toBeTruthy();
    });

    it('shows a charge another tab opened instead of creating a second one', async () => {
      const theirs = { ...OPEN, id: 'c-theirs', createdAt: new Date().toISOString() };
      let page = true;
      const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return jsonResponse({ error: 'A payment is already open' }, 409);
        }
        // The amount page read before the other tab made its charge; the read before the create shows it.
        const charge = page ? null : theirs;
        page = false;
        return jsonResponse({ charge, history: charge === null ? [] : [charge] });
      });
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosAmount />);
      await pressAmount('5');
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/pos');
      });
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('takes over no charge after a lost create when the read right before it failed', async () => {
      let reads = 0;
      // Paid within the last minute, possibly by another tab: without the read before the create it
      // cannot be told from this create's charge, so it is not confirmed as this create.
      const made = {
        ...PAID,
        id: 'c13',
        createdAt: new Date().toISOString(),
        paidAt: new Date().toISOString(),
      };
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'POST') {
            return jsonResponse({ error: 'Bad gateway' }, 502);
          }
          reads += 1;
          if (reads === 2) {
            throw new TypeError('Failed to fetch');
          }
          const charge = reads === 1 ? null : made;
          return jsonResponse({ charge, history: charge === null ? [] : [charge] });
        }),
      );
      renderWithLocale(<PosAmount />);
      await pressAmount('21');
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      expect(await screen.findByRole('alert')).toBeTruthy();
      expect(replace).not.toHaveBeenCalled();
      expect(reads).toBe(3);
    });

    it('never asks the api on a timer while a charge is open', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
      const fetchMock = vi
        .fn()
        .mockImplementation(async () => jsonResponse({ charge: OPEN, history: [OPEN] }));
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('gives a payment in the late minute to a newer charge another tab made of the same amount', async () => {
      const ended = {
        ...OPEN,
        createdAt: new Date(Date.now() - 120_000).toISOString(),
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
      };
      const paidAt = Date.now();
      // Another tab made this charge before the payment: the receiving address went to it.
      const newer = {
        ...OPEN,
        id: 'c-newer',
        createdAt: new Date(Math.floor(paidAt / 1_000) * 1_000).toISOString(),
        expiresAt: new Date(paidAt + 300_000).toISOString(),
      };
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          if (reads === 1) {
            return jsonResponse({ charge: ended, history: [ended] });
          }
          if (reads === 2) {
            return jsonResponse({ charge: null, history: [ended] });
          }
          return jsonResponse({
            charge: newer,
            history: [newer, { ...ended, status: 'expired' }],
          });
        }),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      await waitFor(() => {
        expect(reads).toBe(2);
      });
      receive(21, 0, paidAt);
      // Made in the late minute: the till asks the api once which charge it paid.
      await waitFor(() => {
        expect(reads).toBe(3);
      });
      // The payment is the newer charge's: it is paid, and the charge before stays expired.
      fireEvent.click(within(await confirmation()).getByRole('button', { name: 'Done' }));
      const history = screen.getByRole('region', { name: 'History' });
      expect(await within(history).findByText('Expired')).toBeTruthy();
      expect(within(history).getAllByText(/^Paid ✓/)).toHaveLength(1);
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    });

    it('confirms a late-minute payment for its charge after one read shows no newer charge', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          return jsonResponse({ charge: reads === 1 ? ended : null, history: [ended] });
        }),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      await waitFor(() => {
        expect(reads).toBe(2);
      });
      receive(21);
      // Held until the till has read once more; then it is the charge's.
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(await confirmation()).toBeTruthy();
      expect(reads).toBe(3);
    });

    it('confirms a late-minute payment for its charge when the read after it fails', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          if (reads === 3) {
            throw new TypeError('Failed to fetch');
          }
          return jsonResponse({ charge: reads === 1 ? ended : null, history: [ended] });
        }),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      await waitFor(() => {
        expect(reads).toBe(2);
      });
      receive(21);
      expect(await confirmation()).toBeTruthy();
      expect(reads).toBe(3);
    });

    it('shows a create error only to the session that made the create', async () => {
      let refuse: ((value: Response) => void) | undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'POST') {
            return new Promise<Response>((resolve) => {
              refuse = resolve;
            });
          }
          return jsonResponse({ charge: null, history: [] });
        }),
      );
      renderWithLocale(<PosAmount />);
      await pressAmount('21');
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      await waitFor(() => {
        expect(refuse).toBeDefined();
      });
      act(() => {
        useAuthStore.setState({ session: 'other', account: ACCOUNT });
      });
      await act(async () => {
        refuse?.(jsonResponse({ error: 'A payment is already open' }, 409));
        await Promise.resolve();
      });
      // The next session's till loads, and the first session's refusal is not its message.
      expect(await screen.findByRole('button', { name: 'Create payment' })).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('confirms nothing on this till when the read shows a newer charge already paid', async () => {
      const ended = {
        ...OPEN,
        createdAt: new Date(Date.now() - 120_000).toISOString(),
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
      };
      const paidAt = Date.now();
      const newerPaid = {
        ...PAID,
        id: 'c-newer-paid',
        createdAt: new Date(Math.floor(paidAt / 1_000) * 1_000).toISOString(),
        paidAt: new Date(paidAt).toISOString(),
      };
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          if (reads <= 2) {
            return jsonResponse({ charge: reads === 1 ? ended : null, history: [ended] });
          }
          return jsonResponse({
            charge: newerPaid,
            history: [newerPaid, { ...ended, status: 'expired' }],
          });
        }),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      await waitFor(() => {
        expect(reads).toBe(2);
      });
      receive(21, 0, paidAt);
      // The api already shows the newer charge paid: that is the confirmation, not the charge before.
      fireEvent.click(within(await confirmation()).getByRole('button', { name: 'Done' }));
      const history = screen.getByRole('region', { name: 'History' });
      expect(await within(history).findByText('Expired')).toBeTruthy();
      expect(within(history).getAllByText(/^Paid ✓/)).toHaveLength(1);
    });

    it('moves a late-minute payment to a newer charge a later read shows, after the read for it failed', async () => {
      const ended = {
        ...OPEN,
        createdAt: new Date(Date.now() - 120_000).toISOString(),
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
      };
      const paidAt = Date.now();
      const newer = {
        ...OPEN,
        id: 'c-later-read',
        createdAt: new Date(Math.floor(paidAt / 1_000) * 1_000).toISOString(),
        expiresAt: new Date(paidAt + 300_000).toISOString(),
      };
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          if (reads <= 2) {
            return jsonResponse({ charge: reads === 1 ? ended : null, history: [ended] });
          }
          if (reads === 3) {
            throw new TypeError('Failed to fetch');
          }
          return jsonResponse({
            charge: newer,
            history: [newer, { ...ended, status: 'expired' }],
          });
        }),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      await waitFor(() => {
        expect(reads).toBe(2);
      });
      receive(21, 0, paidAt);
      // Without the read the charge before takes it; the next read gives it to the newer charge.
      expect(await confirmation()).toBeTruthy();
      showTab();
      await waitFor(() => {
        expect(reads).toBe(4);
      });
      fireEvent.click(within(await confirmation()).getByRole('button', { name: 'Done' }));
      const history = screen.getByRole('region', { name: 'History' });
      expect(await within(history).findByText('Expired')).toBeTruthy();
      expect(within(history).getAllByText(/^Paid ✓/)).toHaveLength(1);
    });

    it('creates the next charge when the read before it still shows the one the wallet just paid', async () => {
      const posted: unknown[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'POST') {
            posted.push(JSON.parse(String(init.body)));
            return jsonResponse(
              { charge: { ...OPEN, id: 'c-next', createdAt: new Date().toISOString() } },
              201,
            );
          }
          // The api's paid worker has not run yet: the paid charge is still open there.
          return jsonResponse({ charge: OPEN, history: [OPEN] });
        }),
      );
      const till = renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21);
      fireEvent.click(within(await confirmation()).getByRole('link', { name: 'New payment' }));
      till.unmount();
      renderWithLocale(<PosAmount />);
      await pressAmount('42');
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      await waitFor(() => {
        expect(posted).toEqual([{ amountSats: 42 }]);
      });
    });

    it('arms no charge the wallet already paid, so a later payment of that amount is not held for it', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          // The api still shows the charge open after the wallet paid it.
          return jsonResponse({ charge: reads === 2 ? null : ended, history: [ended] });
        }),
      );
      renderWithLocale(<PosScreen />);
      await waitFor(() => {
        expect(reads).toBe(2);
      });
      receive(21);
      fireEvent.click(within(await confirmation()).getByRole('button', { name: 'Done' }));
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).toBeNull();
      });
      const before = reads;
      // Another payment of that amount in the same late minute: the paid charge does not take it.
      receive(21);
      await act(async () => undefined);
      expect(reads).toBe(before);
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('keeps a late-minute payment held before Cancel for the charge it paid', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      let reads = 0;
      let answerLateRead: ((value: Response) => void) | undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'DELETE') {
            return jsonResponse({ charge: null });
          }
          reads += 1;
          if (reads === 3) {
            return new Promise<Response>((resolve) => {
              answerLateRead = resolve;
            });
          }
          return jsonResponse(
            reads === 1
              ? { charge: ended, history: [ended] }
              : reads === 2
                ? { charge: ended, history: [ended] }
                : { charge: null, history: [{ ...ended, status: 'cancelled' }] },
          );
        }),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      await waitFor(() => {
        expect(reads).toBe(2);
      });
      receive(21);
      await waitFor(() => {
        expect(answerLateRead).toBeDefined();
      });
      // Cancel before the read for the held payment answers; the cancel goes through.
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await act(async () => {
        answerLateRead?.(jsonResponse({ charge: ended, history: [ended] }));
        await Promise.resolve();
      });
      // The payment was made before the cancel: it pays the charge.
      expect(await confirmation()).toBeTruthy();
    });

    it('settles two late-minute payments held for one read, each for the charge it paid', async () => {
      const now = Date.now();
      const ended = {
        ...OPEN,
        createdAt: new Date(now - 120_000).toISOString(),
        expiresAt: new Date(now - 5_000).toISOString(),
      };
      // Both in the late minute, in two whole seconds after the charge ran out.
      const firstPaid = Math.floor(now / 1_000) * 1_000 - 2_000;
      const secondPaid = firstPaid + 1_000;
      // Another tab made this charge between the two payments.
      const newer = {
        ...OPEN,
        id: 'c-between',
        createdAt: new Date(secondPaid).toISOString(),
        expiresAt: new Date(secondPaid + 300_000).toISOString(),
      };
      let reads = 0;
      let answerLateRead: ((value: Response) => void) | undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          if (reads <= 2) {
            return jsonResponse({ charge: reads === 1 ? ended : null, history: [ended] });
          }
          if (reads === 3) {
            return new Promise<Response>((resolve) => {
              answerLateRead = resolve;
            });
          }
          return jsonResponse({ charge: newer, history: [newer, { ...ended, status: 'expired' }] });
        }),
      );
      renderWithLocale(<PosScreen />);
      await waitFor(() => {
        expect(reads).toBe(2);
      });
      receive(21, 0, firstPaid);
      await waitFor(() => {
        expect(answerLateRead).toBeDefined();
      });
      receive(21, 0, secondPaid);
      await act(async () => {
        answerLateRead?.(
          jsonResponse({ charge: newer, history: [newer, { ...ended, status: 'expired' }] }),
        );
        await Promise.resolve();
      });
      // One read, two payments: the charge before took the first, the newer charge the second.
      fireEvent.click(within(await confirmation()).getByRole('button', { name: 'Done' }));
      const history = screen.getByRole('region', { name: 'History' });
      await waitFor(() => {
        expect(within(history).getAllByText(/^Paid ✓/)).toHaveLength(2);
      });
      expect(within(history).queryByText('Expired')).toBeNull();
      expect(reads).toBe(4);
    });

    it('confirms the newest of two charges paid at once first, then the other', async () => {
      const now = Date.now();
      const ended = {
        ...OPEN,
        createdAt: new Date(now - 120_000).toISOString(),
        expiresAt: new Date(now - 5_000).toISOString(),
        amountCurrency: 'USD',
        amount: '5',
      };
      const createdNewer = Math.floor(now / 1_000) * 1_000 - 3_000;
      const newer = {
        ...OPEN,
        id: 'c-newer-figure',
        createdAt: new Date(createdNewer).toISOString(),
        expiresAt: new Date(createdNewer + 300_000).toISOString(),
        amountCurrency: 'USD',
        amount: '8',
      };
      let reads = 0;
      let answerLateRead: ((value: Response) => void) | undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          if (reads <= 2) {
            return jsonResponse({ charge: reads === 1 ? ended : null, history: [ended] });
          }
          if (reads === 3) {
            return new Promise<Response>((resolve) => {
              answerLateRead = resolve;
            });
          }
          return jsonResponse({ charge: newer, history: [newer, ended] });
        }),
      );
      const vibrate = vi.fn(() => true);
      vi.stubGlobal('navigator', { ...navigator, vibrate });
      renderWithLocale(<PosScreen />);
      await waitFor(() => {
        expect(reads).toBe(2);
      });
      // Two payments after the newer charge was made: the first goes to it, the second to the one before.
      receive(21, 0, createdNewer + 1_000);
      await waitFor(() => {
        expect(answerLateRead).toBeDefined();
      });
      receive(21, 0, createdNewer + 2_000);
      await act(async () => {
        answerLateRead?.(jsonResponse({ charge: newer, history: [newer, ended] }));
        await Promise.resolve();
      });
      const first = await confirmation();
      expect(within(first).getByText('$8.00')).toBeTruthy();
      fireEvent.click(within(first).getByRole('button', { name: 'Done' }));
      const second = await confirmation();
      expect(within(second).getByText('$5.00')).toBeTruthy();
      // A fresh confirmation for that charge: the phone vibrates again.
      expect(vibrate).toHaveBeenCalledTimes(2);
      fireEvent.click(within(second).getByRole('button', { name: 'Done' }));
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).toBeNull();
      });
    });

    it('keeps a second late-minute payment that only the already paid charge before would take', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      let reads = 0;
      let answerLateRead: ((value: Response) => void) | undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          if (reads === 3) {
            return new Promise<Response>((resolve) => {
              answerLateRead = resolve;
            });
          }
          return jsonResponse({ charge: reads === 1 ? ended : null, history: [ended] });
        }),
      );
      renderWithLocale(<PosScreen />);
      await waitFor(() => {
        expect(reads).toBe(2);
      });
      receive(21);
      await waitFor(() => {
        expect(answerLateRead).toBeDefined();
      });
      receive(21);
      await act(async () => {
        answerLateRead?.(jsonResponse({ charge: null, history: [ended] }));
        await Promise.resolve();
      });
      // The charge is paid once; the second payment is kept, not counted twice.
      fireEvent.click(within(await confirmation()).getByRole('button', { name: 'Done' }));
      const history = screen.getByRole('region', { name: 'History' });
      await waitFor(() => {
        expect(within(history).getAllByText(/^Paid ✓/)).toHaveLength(1);
      });
    });

    it('pays the charge a Spark payment names at once, even in its late minute, without a read', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          return jsonResponse({ charge: reads === 1 ? ended : null, history: [ended] });
        }),
      );
      renderWithLocale(<PosScreen />);
      await waitFor(() => {
        expect(reads).toBe(2);
      });
      receive(21, 0, Date.now(), ended.id);
      expect(await confirmation()).toBeTruthy();
      expect(reads).toBe(2);
    });

    it('does not let a Spark payment that names another charge pay the open one', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge: OPEN, history: [OPEN] })),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21, 0, Date.now(), 'c-other');
      await act(async () => undefined);
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    });

    it('pays an older charge a Spark payment names at once while a newer charge is open', async () => {
      const older = {
        ...OPEN,
        id: 'c0',
        createdAt: new Date(Date.now() - 300_000).toISOString(),
        expiresAt: new Date(Date.now() - 180_000).toISOString(),
        status: 'expired',
      };
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          return jsonResponse({ charge: OPEN, history: [OPEN, older] });
        }),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      const before = reads;
      receive(21, 0, Date.now(), older.id);
      const history = screen.getByRole('region', { name: 'History' });
      expect(await within(history).findByText(/^Paid ✓ /)).toBeTruthy();
      // The newer open charge stays open, and its confirmation is not shown for the older one.
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
      expect(screen.queryByRole('alertdialog')).toBeNull();
      // A second payment naming the paid charge pays nothing more.
      receive(21, 0, Date.now(), older.id);
      await act(async () => undefined);
      expect(within(history).getAllByText(/^Paid ✓ /)).toHaveLength(1);
      expect(reads).toBe(before);
    });

    it('lists a charge the wallet paid with the time the wallet made the payment', async () => {
      const madeAt = Date.now() - 3 * 3_600_000;
      const open = {
        ...OPEN,
        createdAt: new Date(madeAt - 1_000).toISOString(),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      };
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => jsonResponse({ charge: open, history: [open] })),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21, 0, madeAt);
      expect(await confirmation()).toBeTruthy();
      const history = screen.getByRole('region', { name: 'History' });
      const time = new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(new Date(madeAt));
      expect(within(history).getByText(`Paid ✓ ${time}`)).toBeTruthy();
    });

    it('reads once after a payment from another wallet and moves it to the newer charge another device made', async () => {
      const newer = { ...OPEN, id: 'c2', createdAt: new Date(Date.now() - 1_000).toISOString() };
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          // Another device cancelled this charge and made one of the same amount.
          return jsonResponse(
            reads === 1
              ? { charge: OPEN, history: [OPEN] }
              : { charge: newer, history: [newer, { ...OPEN, status: 'cancelled' }] },
          );
        }),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21);
      // Confirmed at once, then checked by one read.
      expect(await confirmation()).toBeTruthy();
      await waitFor(() => {
        expect(reads).toBe(2);
      });
      const history = screen.getByRole('region', { name: 'History' });
      expect(await within(history).findByText('Cancelled')).toBeTruthy();
      expect(within(history).getAllByText(/^Paid ✓ /)).toHaveLength(1);
      expect(await confirmation()).toBeTruthy();
      await act(async () => undefined);
      expect(reads).toBe(2);
    });

    it('confirms a run-out charge a Spark payment names when no charge is open', async () => {
      const ended = {
        ...OPEN,
        createdAt: new Date(Date.now() - 300_000).toISOString(),
        expiresAt: new Date(Date.now() - 180_000).toISOString(),
      };
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => jsonResponse({ charge: null, history: [ended] })),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      receive(21, 0, Date.now(), ended.id);
      expect(await confirmation()).toBeTruthy();
    });

    it('does not let a Spark payment pay a charge the api shows cancelled', async () => {
      const cancelled = { ...OPEN, status: 'cancelled' };
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => jsonResponse({ charge: null, history: [cancelled] })),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      receive(21, 0, Date.now(), cancelled.id);
      await act(async () => undefined);
      expect(screen.queryByRole('alertdialog')).toBeNull();
      const history = screen.getByRole('region', { name: 'History' });
      expect(within(history).getByText('Cancelled')).toBeTruthy();
    });

    it('does not count a Spark payment for the charge on screen while its cancel goes through', async () => {
      let reads = 0;
      let answerCancel: ((value: Response) => void) | undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'DELETE') {
            return new Promise<Response>((resolve) => {
              answerCancel = resolve;
            });
          }
          reads += 1;
          return jsonResponse(
            answerCancel === undefined
              ? { charge: OPEN, history: [OPEN] }
              : { charge: null, history: [{ ...OPEN, status: 'cancelled' }] },
          );
        }),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => {
        expect(answerCancel).toBeDefined();
      });
      receive(21, 0, Date.now(), OPEN.id);
      await act(async () => undefined);
      expect(screen.queryByRole('alertdialog')).toBeNull();
      await act(async () => {
        answerCancel?.(jsonResponse({ charge: null }));
      });
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(reads).toBeGreaterThan(0);
    });

    it('settles a late-minute payment by the read a failing cancel overtook', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      let reads = 0;
      let answerLateRead: ((value: Response) => void) | undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'DELETE') {
            throw new Error('offline');
          }
          reads += 1;
          if (reads === 3) {
            return new Promise<Response>((resolve) => {
              answerLateRead = resolve;
            });
          }
          if (reads > 3) {
            // The read after the failed cancel fails too.
            throw new Error('offline');
          }
          return jsonResponse({ charge: ended, history: [ended] });
        }),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      await waitFor(() => {
        expect(reads).toBe(2);
      });
      receive(21);
      await waitFor(() => {
        expect(answerLateRead).toBeDefined();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => {
        expect(reads).toBe(4);
      });
      await act(async () => {
        answerLateRead?.(jsonResponse({ charge: ended, history: [ended] }));
        await Promise.resolve();
      });
      expect(await confirmation()).toBeTruthy();
    });

    it('asks again for a late-minute payment of the next session while the read for the session before is open', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      const theirs = { ...ended, id: 'c9', amountSats: 42 };
      let reads = 0;
      let theirReads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
          const auth = new Headers(init?.headers).get('authorization') ?? '';
          if (auth.endsWith('other')) {
            theirReads += 1;
            return Promise.resolve(jsonResponse({ charge: theirs, history: [theirs] }));
          }
          reads += 1;
          if (reads === 3) {
            // The read for the held payment of this session never answers.
            return new Promise<Response>(() => undefined);
          }
          return Promise.resolve(jsonResponse({ charge: ended, history: [ended] }));
        }),
      );
      renderWithLocale(<PosScreen />);
      await waitFor(() => {
        expect(reads).toBe(2);
      });
      receive(21);
      await waitFor(() => {
        expect(reads).toBe(3);
      });
      act(() => {
        useAuthStore.setState({ session: 'other' });
      });
      await waitFor(() => {
        expect(theirReads).toBeGreaterThan(0);
      });
      expect(await screen.findByText('₿42')).toBeTruthy();
      const before = theirReads;
      receive(42);
      await waitFor(() => {
        expect(theirReads).toBe(before + 1);
      });
      const dialog = await confirmation();
      expect(within(dialog).getByText('₿42')).toBeTruthy();
    });

    it('keeps a late-minute payment paid on the newer charge another tab cancelled meanwhile', async () => {
      const ended = {
        ...OPEN,
        createdAt: new Date(Date.now() - 120_000).toISOString(),
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
      };
      const paidAt = Date.now();
      const newerCancelled = {
        ...OPEN,
        id: 'c-cancelled-elsewhere',
        status: 'cancelled',
        createdAt: new Date(Math.floor(paidAt / 1_000) * 1_000).toISOString(),
        expiresAt: new Date(paidAt + 300_000).toISOString(),
      };
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          if (reads <= 2) {
            return jsonResponse({ charge: reads === 1 ? ended : null, history: [ended] });
          }
          return jsonResponse({
            charge: null,
            history: [newerCancelled, { ...ended, status: 'expired' }],
          });
        }),
      );
      renderWithLocale(<PosScreen />);
      await waitFor(() => {
        expect(reads).toBe(2);
      });
      receive(21, 0, paidAt);
      // The money arrived for the newer charge: it is paid on this till, not the charge before.
      fireEvent.click(within(await confirmation()).getByRole('button', { name: 'Done' }));
      const history = screen.getByRole('region', { name: 'History' });
      expect(await within(history).findByText('Expired')).toBeTruthy();
      expect(within(history).getAllByText(/^Paid ✓/)).toHaveLength(1);
    });

    it('does not bring back a confirmation a newer open charge hid once that charge ends', async () => {
      const first = { ...OPEN, createdAt: new Date().toISOString() };
      const later = {
        ...OPEN,
        id: 'c-later',
        createdAt: new Date(Date.now() + 5_000).toISOString(),
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      };
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          if (reads === 1) {
            return jsonResponse({ charge: first, history: [first] });
          }
          if (reads === 2) {
            return jsonResponse({ charge: later, history: [later, first] });
          }
          return jsonResponse({
            charge: null,
            history: [{ ...later, status: 'cancelled' }, first],
          });
        }),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21);
      expect(await confirmation()).toBeTruthy();
      // Another tab opens a newer charge: the confirmation gives way to it.
      showTab();
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).toBeNull();
      });
      // That charge is cancelled elsewhere: the old confirmation does not come back.
      showTab();
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('Done closes the confirmation, reads the till once, and offers a new amount', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ charge: OPEN, history: [OPEN] }))
        // The api has not seen the payment yet, at the read that checks it and the one after Done:
        // the charge stays paid on this till.
        .mockResolvedValueOnce(jsonResponse({ charge: OPEN, history: [OPEN] }))
        .mockResolvedValueOnce(jsonResponse({ charge: OPEN, history: [OPEN] }))
        .mockImplementation(async () => jsonResponse({ charge: PAID, history: [PAID] }));
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21);
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(2);
      });
      fireEvent.click(
        within(await confirmation()).getByRole('button', {
          name: 'Done',
        }),
      );
      expect(screen.queryByRole('alertdialog')).toBeNull();
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(3);
      });
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
      expect(screen.queryByText(/left$/)).toBeNull();
      const history = screen.getByRole('region', { name: 'History' });
      expect(within(history).getByText(/^Paid ✓ /)).toBeTruthy();
      showTab();
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(4);
      });
      // The api's own paid answer for the closed charge does not open it again.
      await act(async () => undefined);
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('opens a newer charge the api returns paid after an older one was closed', async () => {
      const newer = {
        ...PAID,
        id: 'c2',
        amountSats: 42,
        createdAt: new Date(Date.now() + 60_000).toISOString(),
      };
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ charge: OPEN, history: [OPEN] }))
        .mockResolvedValueOnce(jsonResponse({ charge: null, history: [OPEN] }))
        .mockImplementation(async () => jsonResponse({ charge: newer, history: [newer, OPEN] }));
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21);
      fireEvent.click(within(await confirmation()).getByRole('button', { name: 'Done' }));
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      showTab();
      const dialog = await confirmation();
      expect(within(dialog).getByText('₿42')).toBeTruthy();
    });

    it('keeps the confirmation of the newer wallet payment over an older paid charge of the api', async () => {
      const older = {
        ...PAID,
        id: 'c0',
        amountSats: 42,
        createdAt: new Date(Date.now() - 60_000).toISOString(),
      };
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ charge: OPEN, history: [OPEN] }))
        .mockImplementation(async () => jsonResponse({ charge: older, history: [older] }));
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21);
      showTab();
      await waitFor(() => {
        // The read that checks the payment and the one when the tab shows.
        expect(fetchMock).toHaveBeenCalledTimes(3);
      });
      await act(async () => undefined);
      const dialog = await confirmation();
      expect(within(dialog).getByText('₿21')).toBeTruthy();
    });

    it('reads the till again only when the tab becomes visible, not when it is hidden', async () => {
      const fetchMock = vi
        .fn()
        .mockImplementation(async () => jsonResponse({ charge: OPEN, history: [OPEN] }));
      vi.stubGlobal('fetch', fetchMock);
      const state = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await act(async () => undefined);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      state.mockRestore();
      showTab();
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(2);
      });
    });

    it('pays the open charge on sight under the pos-received pin in a Playwright build', async () => {
      process.env.NEXT_PUBLIC_E2E_NOW = '2026-09-20T12:00:00.000Z';
      window.history.replaceState({}, '', '/pos?visual=pos-received');
      const fetchMock = vi
        .fn()
        .mockImplementation(async () => jsonResponse({ charge: OPEN, history: [OPEN] }));
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      expect(within(await confirmation()).getByText('₿21')).toBeTruthy();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('ignores the pos-received pin in a production build', async () => {
      delete process.env.NEXT_PUBLIC_E2E_NOW;
      window.history.replaceState({}, '', '/pos?visual=pos-received');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge: OPEN, history: [OPEN] })),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      await act(async () => undefined);
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('lets the amount page open a new payment after a paid charge', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge: PAID, history: [PAID] })),
      );
      renderWithLocale(<PosAmount />);
      expect(await screen.findByRole('button', { name: 'Create payment' })).toBeTruthy();
      expect(replace).not.toHaveBeenCalled();
    });
  });
});
