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
    (payment: { amountSats: number; feesSats: number; timestamp: number }) => void
  >(),
}));
vi.mock('@/lib/wallet/wallet-service', async () => {
  const actual = await vi.importActual<typeof import('@/lib/wallet/wallet-service')>(
    '@/lib/wallet/wallet-service',
  );
  return {
    ...actual,
    onPaymentReceived: (
      listener: (payment: { amountSats: number; feesSats: number; timestamp: number }) => void,
    ) => {
      received.listeners.add(listener);
      return () => {
        received.listeners.delete(listener);
      };
    },
  };
});

/** This tab's wallet reports a completed payment of `amountSats` (after `feesSats`) made at `timestamp`. */
function receive(amountSats: number, feesSats = 0, timestamp = Date.now()): void {
  act(() => {
    for (const listener of [...received.listeners]) {
      listener({ amountSats, feesSats, timestamp });
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
  it('shows the spot beside bitcoin when an open charge stored no fiat', async () => {
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
            amountCurrency: null,
            amount: null,
            amountUsd: null,
            amountChf: null,
            amountEur: null,
            amountPhp: null,
          },
          history: [],
        }),
      ),
    );
    renderWithLocale(<PosScreen />, 'en', 'ch', 'USD');
    expect(await screen.findByText('₿21')).toBeTruthy();
    await waitFor(() => {
      expect(vi.mocked(fetchFxSpot)).toHaveBeenCalled();
    });
    expect(screen.getByText('$0.02')).toBeTruthy();
  });

  it('shows 12.00 PHP on an open charge to a viewer whose currency is USD', async () => {
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
            amountCurrency: 'PHP',
            amount: '12.00',
            amountUsd: '1.00',
            amountChf: null,
            amountEur: null,
            amountPhp: null,
          },
          history: [],
        }),
      ),
    );
    renderWithLocale(<PosScreen />, 'en', 'ch', 'USD');
    expect(await screen.findByText('₱12.00')).toBeTruthy();
    expect(screen.getByText('₿21')).toBeTruthy();
    expect(screen.queryByText('$1.00')).toBeNull();
    expect(screen.queryByText('$0.02')).toBeNull();
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
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as { amountSats: number };
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
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as { amountSats: number };
    expect(body.amountSats).toBe(85_000);
  });

  it('sends the typed fiat pair and keeps 12.00', async () => {
    vi.mocked(fetchFxSpot).mockResolvedValueOnce(SPOT);
    useAuthStore.setState({ session: 'tok', account: { ...ACCOUNT, amountUnit: 'fiat' } });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return jsonResponse({ error: 'stop here' }, 400);
      }
      return jsonResponse({ charge: null, history: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosAmount />, 'en', 'ch', 'USD');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'USD' })).toHaveProperty('ariaPressed', 'true');
    });
    await pressAmount('12.00');
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      amountSats: number;
      amountCurrency: string;
      amount: string;
    };
    expect(body).toEqual({ amountSats: 12_000, amountCurrency: 'USD', amount: '12.00' });
  });

  it('sends the typed fiat pair without a trailing dot', async () => {
    vi.mocked(fetchFxSpot).mockResolvedValueOnce(SPOT);
    useAuthStore.setState({ session: 'tok', account: { ...ACCOUNT, amountUnit: 'fiat' } });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return jsonResponse({ error: 'stop here' }, 400);
      }
      return jsonResponse({ charge: null, history: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosAmount />, 'en', 'ch', 'USD');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'USD' })).toHaveProperty('ariaPressed', 'true');
    });
    await pressAmount('12.');
    expect(screen.getByLabelText('Amount').textContent).toBe('12.');
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      amountSats: number;
      amountCurrency: string;
      amount: string;
    };
    expect(body).toEqual({ amountSats: 12_000, amountCurrency: 'USD', amount: '12' });
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
    const OPEN = {
      id: 'c1',
      amountSats: 21,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
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
      vi.mocked(fetchFxSpot).mockResolvedValueOnce(SPOT);
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
      expect(await within(history).findByText('$0.02')).toBeTruthy();
      // This till did not create the charge, so it has no fixed figure; none is priced from the spot.
      expect(within(dialog).queryByText(/\$/)).toBeNull();
      expect(within(dialog).getByRole('link', { name: 'New payment' }).getAttribute('href')).toBe(
        '/pos/amount',
      );
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Set an amount' })).toBeNull();
      expect(screen.queryByText(/left$/)).toBeNull();
    });

    it('shows 12.00 PHP under the bitcoin amount of a paid charge', async () => {
      vi.mocked(fetchFxSpot).mockResolvedValueOnce(SPOT);
      const paid = {
        ...PAID,
        amountCurrency: 'PHP',
        amount: '12.00',
        amountUsd: '1.00',
        amountChf: null,
        amountEur: null,
        amountPhp: null,
      };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ charge: paid, history: [] })),
      );
      renderWithLocale(<PosScreen />, 'en', 'ch', 'USD');
      expect(await screen.findByText('₱12.00')).toBeTruthy();
      expect(screen.getByText('₿21')).toBeTruthy();
      expect(screen.getByRole('status').textContent).toBe('Paid ✓');
      await waitFor(() => {
        expect(vi.mocked(fetchFxSpot)).toHaveBeenCalled();
      });
      expect(screen.queryByText('$0.02')).toBeNull();
      expect(screen.queryByText('$1.00')).toBeNull();
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
      vi.mocked(fetchFxSpot).mockResolvedValue({
        asOf: '2026-10-07T00:00:00.000Z',
        source: 'test',
        rates: {},
      });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge: PAID, history: [] })),
      );
      renderWithLocale(<PosScreen />);
      expect(within(await confirmation()).getByRole('link', { name: 'New payment' })).toBeTruthy();
      expect(screen.queryByText(/\$/)).toBeNull();
    });

    it('turns Paid the moment the wallet receives the open amount, without asking the api', async () => {
      const fetchMock = vi
        .fn()
        .mockImplementation(async () => jsonResponse({ charge: OPEN, history: [OPEN] }));
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      expect(screen.getByText('No payments yet.')).toBeTruthy();
      receive(21);
      const dialog = await confirmation();
      expect(within(dialog).getByText('₿21')).toBeTruthy();
      expect(fetchMock).toHaveBeenCalledTimes(1);
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

    it('does not listen to the wallet without a session or after the till unmounts', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge: OPEN, history: [OPEN] })),
      );
      const { unmount } = renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      expect(received.listeners.size).toBe(1);
      unmount();
      expect(received.listeners.size).toBe(0);
      useAuthStore.setState({ session: null });
      renderWithLocale(<PosScreen />);
      await act(async () => undefined);
      expect(received.listeners.size).toBe(0);
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
          // The till's read at 0:00 and the amount page's read find no charge open.
          if (reads <= 3) {
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
      expect(reads).toBe(4);
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
      expect(fetchMock.mock.calls.length).toBe(before + 1);
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
        // The read after the failed cancel, then the read after Done.
        expect(reads).toBe(3);
      });
      await act(async () => undefined);
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByRole('link', { name: 'Set an amount' })).toBeTruthy();
    });

    /** Creates a charge of `draft` on the amount page; the api answers with `created`. */
    async function createOnAmountPage(
      draft: string,
      created: Record<string, unknown>,
    ): Promise<void> {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
          init?.method === 'POST'
            ? jsonResponse({ charge: created }, 201)
            : jsonResponse({ charge: null, history: [] }),
        ),
      );
      const amountPage = renderWithLocale(<PosAmount />, 'en', 'ch', 'CHF');
      await pressAmount(draft);
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/pos');
      });
      amountPage.unmount();
    }

    it('shows on the confirmation the currency figure typed for the charge, not a spot price', async () => {
      vi.mocked(fetchFxSpot).mockResolvedValue(SPOT);
      useAuthStore.setState({ session: 'tok', account: { ...ACCOUNT, amountUnit: 'fiat' } });
      // The api pinned another sat amount than the spot gives for CHF 68: the figure stays 68.00.
      const created = { ...OPEN, id: 'c7', createdAt: new Date().toISOString() };
      await createOnAmountPage('68', created);
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockImplementation(async () => jsonResponse({ charge: created, history: [created] })),
      );
      renderWithLocale(<PosScreen />, 'en', 'ch', 'CHF');
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21);
      const dialog = await confirmation();
      expect(within(dialog).getByText('CHF 68.00')).toBeTruthy();
      vi.mocked(fetchFxSpot).mockResolvedValue({ asOf: SPOT.asOf, source: 'test', rates: {} });
    });

    it('shows bitcoin only for a charge typed in bitcoin, even with a spot rate', async () => {
      vi.mocked(fetchFxSpot).mockResolvedValueOnce(SPOT).mockResolvedValueOnce(SPOT);
      const created = { ...OPEN, id: 'c8', amountSats: 2_100, createdAt: new Date().toISOString() };
      await createOnAmountPage('2100', created);
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockImplementation(async () => jsonResponse({ charge: created, history: [created] })),
      );
      renderWithLocale(<PosScreen />, 'en', 'ch', 'CHF');
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(2_100);
      const dialog = await confirmation();
      expect(within(dialog).getByText("₿2'100")).toBeTruthy();
      // No currency was typed, and none is made by converting the sats.
      expect(within(dialog).queryByText(/CHF/)).toBeNull();
    });

    it('gives a charge found after a lost create answer the typed figure when it is that create', async () => {
      await loseCreateAnswer({
        ...OPEN,
        id: 'c5',
        amountSats: 85_000,
        createdAt: new Date().toISOString(),
      });
      expect(within(await confirmation()).getByText('CHF 68.00')).toBeTruthy();
    });

    /** Types CHF 68 on the amount page; the create's answer is lost and the till then reads `found`. */
    async function loseCreateAnswer(found: Record<string, unknown>): Promise<void> {
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
      amountPage.unmount();
      renderWithLocale(<PosScreen />, 'en', 'ch', 'CHF');
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(Number(found['amountSats']));
      vi.mocked(fetchFxSpot).mockResolvedValue({ asOf: SPOT.asOf, source: 'test', rates: {} });
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
      expect(within(await confirmation()).getByText('CHF 68.00')).toBeTruthy();
      vi.mocked(fetchFxSpot).mockResolvedValue({ asOf: SPOT.asOf, source: 'test', rates: {} });
    });

    it('gives no typed figure to another amount found after a lost create answer', async () => {
      await loseCreateAnswer({ ...OPEN, id: 'c6', createdAt: new Date().toISOString() });
      expect(within(await confirmation()).queryByText(/CHF/)).toBeNull();
    });

    it('gives no typed figure to a charge made well before a lost create', async () => {
      await loseCreateAnswer({
        ...OPEN,
        id: 'c10',
        amountSats: 85_000,
        createdAt: new Date(Date.now() - 60_000).toISOString(),
      });
      expect(within(await confirmation()).queryByText(/CHF/)).toBeNull();
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

    it('Done closes the confirmation, reads the till once, and offers a new amount', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ charge: OPEN, history: [OPEN] }))
        // The api has not seen the payment yet: the charge stays paid on this till.
        .mockResolvedValueOnce(jsonResponse({ charge: OPEN, history: [OPEN] }))
        .mockImplementation(async () => jsonResponse({ charge: PAID, history: [PAID] }));
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21);
      fireEvent.click(
        within(await confirmation()).getByRole('button', {
          name: 'Done',
        }),
      );
      expect(screen.queryByRole('alertdialog')).toBeNull();
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(2);
      });
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
      expect(screen.queryByText(/left$/)).toBeNull();
      const history = screen.getByRole('region', { name: 'History' });
      expect(within(history).getByText(/^Paid ✓ /)).toBeTruthy();
      showTab();
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(3);
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
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
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
        expect(fetchMock).toHaveBeenCalledTimes(2);
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
