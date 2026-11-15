import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { PosAmount, PosScreen, resetPosTillWriteForTests } from '@/components/PosScreen';
import * as spotRate from '@/hooks/useSpotRate';
import { fetchFxSpot } from '@/lib/api';
import { spotRateDay } from '@/lib/stats-money';
import { logInteraction } from '@/lib/interaction-log';
import { previousViewPath, recordCurrentView, resetViewHistory } from '@/lib/view-history';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';
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
      id: string;
      amountSats: number;
      feesSats: number;
      timestamp: number;
      method: string;
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
      id: string;
      amountSats: number;
      feesSats: number;
      timestamp: number;
      method: string;
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
 * `method` is how it arrived: Lightning, or Spark for a named one, unless given.
 */
let receivedCount = 0;

function receive(
  amountSats: number,
  feesSats = 0,
  timestamp = Date.now(),
  chargeId?: string,
  method = chargeId === undefined ? 'lightning' : 'spark',
): void {
  receivedCount += 1;
  const id = `payment-${receivedCount}`;
  act(() => {
    for (const listener of [...received.listeners]) {
      listener({
        id,
        amountSats,
        feesSats,
        timestamp,
        method,
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
    fireEvent.submit(screen.getByRole('button', { name: 'Create payment' }).closest('form')!);
    expect(screen.getByRole('alert').textContent).toBe('No PHP exchange rate yet.');
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
    fireEvent.submit(screen.getByRole('button', { name: 'Create payment' }).closest('form')!);
    expect(screen.getByRole('alert').textContent).toContain(
      'This amount cannot be converted to bitcoin. Enter it in ₿.',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a zero bitcoin amount before calling the api', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosAmount />);
    expect(await screen.findByRole('button', { name: 'Create payment' })).toBeTruthy();
    await pressAmount('0');
    expect(screen.getByRole('alert').textContent).toBe('Enter a whole number.');
    expect(
      (screen.getByRole('button', { name: 'Create payment' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('says the exchange rate is still loading, then drops that once the spot settles', async () => {
    const day = spotRateDay(SPOT.rates);
    expect(day).not.toBeNull();
    let spot: { rateDay: typeof day; loading: boolean } = { rateDay: day, loading: false };
    const spy = vi.spyOn(spotRate, 'useSpotRateState').mockImplementation(() => ({
      rateDay: spot.rateDay,
      loading: spot.loading,
    }));
    try {
      useAuthStore.setState({ session: 'tok', account: { ...ACCOUNT, amountUnit: 'fiat' } });
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] }));
      vi.stubGlobal('fetch', fetchMock);
      const view = renderWithLocale(<PosAmount />, 'en', 'ch', 'CHF');
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'CHF' })).toHaveProperty('ariaPressed', 'true');
      });
      await pressAmount('1.00');
      spot = { rateDay: null, loading: true };
      view.rerender(<PosAmount />);
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      expect(screen.getByRole('alert').textContent).toBe('The CHF exchange rate is still loading.');
      expect(
        (screen.getByRole('button', { name: 'Create payment' }) as HTMLButtonElement).disabled,
      ).toBe(true);
      fireEvent.submit(screen.getByRole('button', { name: 'Create payment' }).closest('form')!);
      expect(screen.getByRole('alert').textContent).toBe('The CHF exchange rate is still loading.');
      expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(false);
      spot = { rateDay: null, loading: false };
      view.rerender(<PosAmount />);
      expect(screen.queryByText('The CHF exchange rate is still loading.')).toBeNull();
      expect(screen.getByRole('alert').textContent).toBe('No CHF exchange rate yet.');
      fireEvent.submit(screen.getByRole('button', { name: 'Create payment' }).closest('form')!);
      expect(screen.getByRole('alert').textContent).toBe('No CHF exchange rate yet.');
      expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(false);
    } finally {
      spy.mockRestore();
    }
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

  it('reads once after an already-open refusal and shows the charge another tab opened', async () => {
    const theirs = {
      id: 'c-theirs',
      amountSats: 42,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    };
    for (const readFails of [false, true]) {
      cleanup();
      replace.mockClear();
      useAuthStore.setState({ session: 'tok', account: ACCOUNT });
      let refused = false;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'POST') {
            refused = true;
            return jsonResponse({ error: 'A payment is already open' }, 409);
          }
          if (!refused) {
            return jsonResponse({ charge: null, history: [] });
          }
          if (readFails) {
            throw new TypeError('Failed to fetch');
          }
          return jsonResponse({ charge: theirs, history: [theirs] });
        }),
      );
      renderWithLocale(<PosAmount />);
      await pressAmount('21');
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      if (readFails) {
        expect((await screen.findByRole('alert')).textContent?.toLowerCase()).toContain(
          'already open',
        );
      } else {
        // The other tab's charge is the till's open charge now: the amount page leaves for it.
        await waitFor(() => {
          expect(replace).toHaveBeenCalledWith('/pos');
        });
      }
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

    it('fills the screen with Paid, bitcoin and fiat at the same size, and Done', async () => {
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
      const bitcoin = within(dialog).getByText('₿21');
      const fiat = within(dialog).getByText('$0.02');
      expect(bitcoin.className).toBe(fiat.className);
      expect(within(dialog).queryByRole('link', { name: 'New payment' })).toBeNull();
      expect(within(dialog).getByRole('button', { name: 'Done' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Set an amount' })).toBeNull();
      expect(screen.queryByText(/left$/)).toBeNull();
      vi.mocked(fetchFxSpot).mockResolvedValue({ asOf: SPOT.asOf, source: 'test', rates: {} });
    });

    it('shows an empty stored PHP amount as ₱0.00 under a paid charge', async () => {
      vi.mocked(fetchFxSpot).mockResolvedValueOnce(SPOT);
      const paid = {
        ...PAID,
        amountCurrency: 'PHP',
        amount: '',
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
      expect(await screen.findByText('₱0.00')).toBeTruthy();
      expect(screen.getByText('₿21')).toBeTruthy();
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
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge: PAID, history: [] })),
      );
      renderWithLocale(<PosScreen />);
      expect(within(await confirmation()).getByRole('button', { name: 'Done' })).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'New payment' })).toBeNull();
      expect(screen.queryByText(/\$/)).toBeNull();
    });

    it('turns Paid the moment the wallet reports a payment that names the open charge, without asking the api', async () => {
      const fetchMock = vi
        .fn()
        .mockImplementation(async () => jsonResponse({ charge: OPEN, history: [OPEN] }));
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      expect(screen.getByText('No payments yet.')).toBeTruthy();
      receive(21, 0, Date.now(), 'c1');
      // On screen in the same update as the wallet's report, before any read.
      const dialog = screen.getByRole('alertdialog', { name: 'Paid' });
      expect(within(dialog).getByText('₿21')).toBeTruthy();
      // The payment names the charge: nothing to ask the api.
      await act(async () => undefined);
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
      receive(20, 1, Date.now(), 'c1');
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
      receive(21, 0, Date.now(), 'c1');
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
      receive(21, 0, Date.now(), 'c1');
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
      receive(21, 0, Date.now(), 'c1');
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
      receive(21, 0, Date.now(), 'c1');
      expect(await confirmation()).toBeTruthy();
      const history = screen.getByRole('region', { name: 'History' });
      expect(within(history).getByText(/^Paid ✓ /)).toBeTruthy();
      expect(within(history).queryByText('Expired')).toBeNull();
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

    it('does not let an older expiry read replace a newer till answer', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      let releaseExpiry: ((value: Response) => void) | undefined;
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
              releaseExpiry = resolve;
            });
          }
          return jsonResponse({ charge: null, history: [{ ...ended, status: 'expired' }] });
        }),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByText('0:00 left')).toBeTruthy();
      await waitFor(() => {
        expect(releaseExpiry).toEqual(expect.any(Function));
      });
      showTab();
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      await act(async () => {
        releaseExpiry?.(jsonResponse({ charge: ended, history: [ended] }));
        await Promise.resolve();
      });
      expect(screen.getByRole('link', { name: 'Set an amount' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
      expect(screen.queryByText('0:00 left')).toBeNull();
    });

    it('neither pays nor keeps asking the api for an unnamed payment more than a minute after the charge ran out', async () => {
      const old = { ...OPEN, expiresAt: new Date(Date.now() - 61_000).toISOString() };
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ charge: old, history: [old] }))
        .mockImplementation(async () => jsonResponse({ charge: null, history: [old] }));
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      // The effects of that read have run.
      await act(async () => undefined);
      const before = fetchMock.mock.calls.length;
      receive(21);
      expect(screen.queryByRole('alertdialog')).toBeNull();
      // Past the charge's late minute it cannot be its payment: the till does not ask the api.
      await new Promise((resolve) => setTimeout(resolve, 2_300));
      expect(fetchMock).toHaveBeenCalledTimes(before);
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
      // The effects of that read have run.
      await act(async () => undefined);
      receive(21, 0, Date.now(), 'c1');
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
      receive(21, 0, Date.now(), 'c1');
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
      receive(21, 0, Date.now(), 'c1');
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
      receive(21, 0, Date.now(), 'c1');
      expect(await confirmation()).toBeTruthy();
    });

    it('Done closes the confirmation, so the next till does not show it again', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge: PAID, history: [PAID] })),
      );
      const first = renderWithLocale(<PosScreen />);
      fireEvent.click(within(await confirmation()).getByRole('button', { name: 'Done' }));
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
      receive(21, 0, Date.now(), 'c1');
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
      receive(21, 0, Date.now(), 'c1');
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
      receive(21, 0, Date.now(), 'c1');
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
      receive(21, 0, Date.now(), 'c1');
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
      // The effects of that read have run (the charge is no longer the open one).
      await act(async () => undefined);
      receive(21, 0, Date.now(), 'c1');
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
      receive(21, 0, Date.now(), 'c1');
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

    it('keeps a new payment heard before the charge is read over old payments listed after it', async () => {
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
      receive(21, 0, Date.now(), 'c1');
      // A connection lists 20 older payments afterwards.
      for (let i = 0; i < 20; i += 1) {
        receive(5, 0, Date.now() - 3_600_000 - i * 1_000, `c-old-${i}`);
      }
      await act(async () => {
        answer(jsonResponse({ charge: OPEN, history: [OPEN] }));
      });
      expect(await confirmation()).toBeTruthy();
    });

    it('takes no unnamed Spark transfer or on-chain deposit of the charge amount as its payment', async () => {
      const fetchMock = vi
        .fn()
        .mockImplementation(async () => jsonResponse({ charge: OPEN, history: [OPEN] }));
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21, 0, Date.now(), undefined, 'spark');
      receive(21, 0, Date.now(), undefined, 'deposit');
      await act(async () => undefined);
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
      // Not even a read, now or after a poll pause: it is not a till payment.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await new Promise((resolve) => setTimeout(resolve, 2_300));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      // A payment of the charge's Spark invoice, which names it, pays it.
      receive(21, 0, Date.now(), 'c1');
      expect(await confirmation()).toBeTruthy();
    });

    it('reads nothing for a Lightning payment of another amount that names no charge', async () => {
      const fetchMock = vi
        .fn()
        .mockImplementation(async () => jsonResponse({ charge: OPEN, history: [OPEN] }));
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(99);
      // It cannot be the open charge's payment: the till does not ask the api.
      await act(async () => undefined);
      await act(async () => undefined);
      expect(fetchMock).toHaveBeenCalledTimes(1);
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
      // It names a charge no read listed: one read, triggered by the payment, finds that charge.
      receive(42, 0, Date.now(), 'c2');
      const dialog = await confirmation();
      expect(within(dialog).getByText('₿42')).toBeTruthy();
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
      // The payer pays the new pin before the create answer is in; the api has the new charge.
      serverCharge = fresh;
      receive(21, 0, Date.now(), fresh.id);
      await act(async () => {
        releasePost?.(jsonResponse({ charge: fresh }, 201));
      });
      amountPage.unmount();
      renderWithLocale(<PosScreen />);
      const dialog = await confirmation();
      expect(within(dialog).getByText('₿21')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    });

    {
      it('gives the charge before a payment that names it while a create is on its way', async () => {
        const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
        const fresh = { ...OPEN, id: 'c2', createdAt: new Date(Date.now() + 5_000).toISOString() };
        let releasePost: ((value: Response) => void) | undefined;
        let created = false;
        let reads = 0;
        vi.stubGlobal(
          'fetch',
          vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
            if (init?.method === 'POST') {
              return new Promise<Response>((resolve) => {
                releasePost = resolve;
              });
            }
            reads += 1;
            // The till first reads the charge before as it runs out; then the api has none open.
            return Promise.resolve(
              jsonResponse(
                created
                  ? { charge: fresh, history: [fresh, ended] }
                  : { charge: reads === 1 ? ended : null, history: [ended] },
              ),
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
        // In the late minute of the charge before, before the new charge was made.
        receive(21, 0, Date.now(), ended.id);
        created = true;
        await act(async () => {
          releasePost?.(jsonResponse({ charge: fresh }, 201));
        });
        amountPage.unmount();
        renderWithLocale(<PosScreen />);
        // The new charge stays open; the charge before is paid in History.
        expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
        const history = screen.getByRole('region', { name: 'History' });
        expect(await within(history).findByText(/^Paid ✓ /)).toBeTruthy();
      });
    }

    it('makes the charge before payable again when creating a new charge fails', async () => {
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
      receive(21, 0, Date.now(), 'c1');
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/pos');
      });
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
      // It names the charge before: that charge is paid at once, before the create fails.
      receive(21, 0, Date.now(), 'c1');
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/pos');
      });
      await act(async () => {
        failPost?.(jsonResponse({ error: 'down' }, 502));
      });
    });

    it('lets the late wallet report of a settled charge change nothing on the next one', async () => {
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
      // The report of the first payment names that settled charge: nothing changes.
      receive(21, 0, Math.min(paidAt, Date.parse(next.createdAt)) - 5_000, 'c1');
      // Neither does a payment of the same amount that names no charge.
      receive(21);
      await act(async () => undefined);
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
      const history = screen.getByRole('region', { name: 'History' });
      expect(within(history).queryByText(/^Paid ✓/)).toBeNull();
      // The payment that names the new charge pays it.
      receive(21, 0, Date.now(), 'c2');
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
      receive(21, 0, Date.now(), 'c2');
      expect(await confirmation()).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      // The first charge's own report, which names that charge, arrives last and pays nothing.
      receive(21, 0, Date.parse(next.createdAt) - 5_000, 'c1');
      await act(async () => undefined);
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
      receive(42, 0, Date.now(), lost.id);
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
      receive(42, 0, Date.now(), theirs.id);
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
      receive(21, 0, Date.now(), made.id);
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
      receive(21, 0, Date.now(), newer.id);
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
      receive(21, 0, Date.now(), newerPaid.id);
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
      receive(21, 0, Date.now(), 'c1');
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
      receive(21, 0, Date.now(), 'c1');
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith('/pos');
      });
    });

    it('reads the till again after a refused create only when a payment is already open', async () => {
      for (const [apiError, shown, after] of [
        ['A payment is already open', 'A payment is already open.', 1],
        ['Set a username first', 'Set a username first.', 0],
      ] as const) {
        cleanup();
        useAuthStore.setState({ session: 'tok', account: ACCOUNT });
        const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
          init?.method === 'POST'
            ? jsonResponse({ error: apiError }, 409)
            : jsonResponse({ charge: null, history: [] }),
        );
        vi.stubGlobal('fetch', fetchMock);
        renderWithLocale(<PosAmount />);
        await pressAmount('5');
        const before = fetchMock.mock.calls.length;
        fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
        expect(await screen.findByText(shown)).toBeTruthy();
        await act(async () => undefined);
        // The read right before the create, the create, and one read after an already-open refusal.
        expect(fetchMock.mock.calls.length).toBe(before + 2 + after);
      }
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
      receive(21, 0, Date.now(), 'c1');
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
      receive(21, 0, Date.now(), 'c1');
      expect(screen.queryByRole('alertdialog')).toBeNull();
      await act(async () => {
        failDelete?.(jsonResponse({ error: 'down' }, 502));
      });
      expect(await confirmation()).toBeTruthy();
    });

    it('drops a cancelled charge before the follow-up read returns', async () => {
      let releaseRead: ((value: Response) => void) | undefined;
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'DELETE') {
            return Promise.resolve(jsonResponse({ charge: null }));
          }
          reads += 1;
          if (reads === 1) {
            return Promise.resolve(jsonResponse({ charge: OPEN, history: [OPEN] }));
          }
          return new Promise<Response>((resolve) => {
            releaseRead = resolve;
          });
        }),
      );
      renderWithLocale(<PosScreen />);
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
      await waitFor(() => {
        expect(releaseRead).toBeDefined();
        expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
      });
      expect(screen.getByRole('link', { name: 'Set an amount' })).toBeTruthy();
      expect(screen.getByText('Cancelled')).toBeTruthy();
      await act(async () => {
        releaseRead?.(jsonResponse({ charge: null, history: [{ ...OPEN, status: 'cancelled' }] }));
      });
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('keeps a newer till read when the read after a successful cancel is late', async () => {
      let releaseRead: ((value: Response) => void) | undefined;
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'DELETE') {
            return Promise.resolve(jsonResponse({ charge: null }));
          }
          reads += 1;
          if (reads === 1) {
            return Promise.resolve(jsonResponse({ charge: OPEN, history: [OPEN] }));
          }
          if (reads === 2) {
            return new Promise<Response>((resolve) => {
              releaseRead = resolve;
            });
          }
          return Promise.resolve(
            jsonResponse({
              charge: null,
              history: [{ ...OPEN, id: 'newer', amountSats: 42, status: 'cancelled' }],
            }),
          );
        }),
      );
      renderWithLocale(<PosScreen />);
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
      await waitFor(() => {
        expect(releaseRead).toBeDefined();
      });
      showTab();
      expect(await screen.findByText('₿42')).toBeTruthy();
      await act(async () => {
        releaseRead?.(jsonResponse({ charge: OPEN, history: [OPEN] }));
      });
      expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
      expect(screen.getByText('₿42')).toBeTruthy();
    });

    it('does not let a cancel follow-up replace the next sessions failed read', async () => {
      let failFollow: ((reason: unknown) => void) | undefined;
      let failNext: ((reason: unknown) => void) | undefined;
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'DELETE') {
            return Promise.resolve(jsonResponse({ charge: null }));
          }
          reads += 1;
          if (reads === 1) {
            return Promise.resolve(jsonResponse({ charge: OPEN, history: [OPEN] }));
          }
          if (reads === 2) {
            return new Promise<Response>((_resolve, reject) => {
              failFollow = reject;
            });
          }
          return new Promise<Response>((_resolve, reject) => {
            failNext = reject;
          });
        }),
      );
      renderWithLocale(<PosScreen />);
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
      await waitFor(() => {
        expect(failFollow).toBeDefined();
      });
      act(() => {
        useAuthStore.setState({ session: 'other' });
      });
      await waitFor(() => {
        expect(failNext).toBeDefined();
      });
      await act(async () => {
        failNext?.(new TypeError('Failed to fetch'));
      });
      expect((await screen.findByRole('alert')).textContent).toBe('Point of sale is unavailable.');
      await act(async () => {
        failFollow?.(new TypeError('Failed to fetch'));
      });
      expect(screen.getByRole('alert').textContent).toBe('Point of sale is unavailable.');
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
      receive(21, 0, Date.now(), 'c1');
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
      receive(21, 0, Date.now(), 'c1');
      fireEvent.click(within(await confirmation()).getByRole('button', { name: 'Done' }));
      await waitFor(() => {
        // The read after the failed cancel, then the read after Done.
        expect(reads).toBe(3);
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
      receive(21, 0, Date.now(), 'c7');
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
      receive(2_100, 0, Date.now(), 'c8');
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
      receive(Number(found['amountSats']), 0, Date.now(), String(found['id']));
      vi.mocked(fetchFxSpot).mockResolvedValue({ asOf: SPOT.asOf, source: 'test', rates: {} });
      return alerted;
    }

    it('keeps the amount page when a lost create is already paid, and the till confirms that read after it is gone', async () => {
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
      let lostReads = 0;
      let gets = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'POST') {
            lost = true;
            return jsonResponse({ error: 'Bad gateway' }, 502);
          }
          gets += 1;
          if (!lost) {
            return jsonResponse({ charge: null, history: [] });
          }
          lostReads += 1;
          // Only the read right after the lost create returns the paid charge.
          // Every later read, including the till's own, no longer has it.
          return lostReads === 1
            ? jsonResponse({ charge: paidMeanwhile, history: [paidMeanwhile] })
            : jsonResponse({ charge: null, history: [] });
        }),
      );
      const amountPage = renderWithLocale(<PosAmount />, 'en', 'ch', 'CHF');
      await pressAmount('68');
      expect(screen.getByLabelText('Amount').textContent).toBe('68');
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      // Only the api reports this charge paid, so the keypad stays and can create the next one.
      await waitFor(() => {
        expect(screen.getByLabelText('Amount').textContent).toBe('0');
      });
      expect(replace).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Create payment' })).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
      const readsBeforeTill = gets;
      amountPage.unmount();
      renderWithLocale(<PosScreen />, 'en', 'ch', 'CHF');
      // The till's own read has answered without that charge, and the confirmation is still there.
      await waitFor(() => {
        expect(gets).toBeGreaterThan(readsBeforeTill);
        expect(screen.getByRole('alertdialog', { name: 'Paid' })).toBeTruthy();
      });
      const dialog = screen.getByRole('alertdialog', { name: 'Paid' });
      expect(within(dialog).getByText("₿85'000")).toBeTruthy();
      expect(within(dialog).getByText('CHF 68.00')).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).toBeNull();
      });
      // The later read no longer returns the charge. History still shows it paid.
      const history = screen.getByRole('region', { name: 'History' });
      expect(within(history).getByText("₿85'000")).toBeTruthy();
      expect(within(history).getByText('CHF 68.00')).toBeTruthy();
      expect(within(history).getByText(/Paid ✓/)).toBeTruthy();
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
      receive(21, 0, Date.now(), 'c1');
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
      receive(21, 0, Date.now(), 'c1');
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
      receive(21, 0, Date.now(), 'c1');
      fireEvent.click(within(await confirmation()).getByRole('button', { name: 'Done' }));
      till.unmount();
      renderWithLocale(<PosAmount />);
      await pressAmount('42');
      fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
      await waitFor(() => {
        expect(posted).toEqual([{ amountSats: 42 }]);
      });
    });

    it('arms no charge the wallet already paid, so a later payment changes nothing and the till does not keep asking', async () => {
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
      receive(21, 0, Date.now(), 'c1');
      fireEvent.click(within(await confirmation()).getByRole('button', { name: 'Done' }));
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).toBeNull();
      });
      const before = reads;
      // A second report that names the paid charge changes nothing and asks nothing.
      receive(21, 0, Date.now(), 'c1');
      await act(async () => undefined);
      expect(reads).toBe(before);
      expect(screen.queryByRole('alertdialog')).toBeNull();
      // A payment of that amount that names no charge: the paid charge is no longer the open one,
      // so the till does not ask the api.
      receive(21);
      await new Promise((resolve) => setTimeout(resolve, 2_300));
      expect(reads).toBe(before);
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('does not bring back an older confirmation once a newer open charge hid it', async () => {
      const now = Date.now();
      const ended = {
        ...OPEN,
        createdAt: new Date(now - 120_000).toISOString(),
        expiresAt: new Date(now - 5_000).toISOString(),
      };
      // Another device's charge after it, cancelled later.
      const third = { ...OPEN, id: 'c-third', createdAt: new Date(now).toISOString() };
      let reads = 0;
      let phase: 'paid' | 'third' | 'gone' = 'paid';
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          if (phase === 'third') {
            return jsonResponse({ charge: third, history: [third, ended] });
          }
          if (phase === 'gone') {
            return jsonResponse({
              charge: null,
              history: [{ ...third, status: 'cancelled' }, ended],
            });
          }
          return jsonResponse({ charge: reads === 1 ? ended : null, history: [ended] });
        }),
      );
      renderWithLocale(<PosScreen />);
      await waitFor(() => {
        expect(reads).toBe(2);
      });
      receive(21, 0, now - 2_000, 'c1');
      expect(await confirmation()).toBeTruthy();
      phase = 'third';
      showTab();
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      expect(screen.queryByRole('alertdialog')).toBeNull();
      phase = 'gone';
      showTab();
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      await act(async () => undefined);
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('confirms the newest of two charges paid at once first, then the other', async () => {
      const now = Date.now();
      const ended = {
        ...OPEN,
        status: 'expired',
        createdAt: new Date(now - 120_000).toISOString(),
        expiresAt: new Date(now - 5_000).toISOString(),
        amountCurrency: 'USD',
        amount: '5',
      };
      const createdNewer = Math.floor(now / 1_000) * 1_000 - 3_000;
      // The api already marked the newer charge paid; the wallet reports the payment that names the
      // charge before while the till is still reading.
      const newer = {
        ...PAID,
        id: 'c-newer-figure',
        createdAt: new Date(createdNewer).toISOString(),
        expiresAt: new Date(createdNewer + 300_000).toISOString(),
        amountCurrency: 'USD',
        amount: '8',
      };
      let answerFirst: ((value: Response) => void) | undefined;
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          if (reads === 1) {
            return new Promise<Response>((resolve) => {
              answerFirst = resolve;
            });
          }
          return jsonResponse({ charge: newer, history: [newer, ended] });
        }),
      );
      const vibrate = vi.fn(() => true);
      vi.stubGlobal('navigator', { ...navigator, vibrate });
      renderWithLocale(<PosScreen />);
      await waitFor(() => {
        expect(received.listeners.size).toBe(1);
      });
      receive(21, 0, createdNewer - 1_000, 'c1');
      await act(async () => {
        answerFirst?.(jsonResponse({ charge: newer, history: [newer, ended] }));
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
      // The effects of the first read have run.
      await act(async () => undefined);
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
      receive(21, 0, madeAt, 'c1');
      expect(await confirmation()).toBeTruthy();
      const history = screen.getByRole('region', { name: 'History' });
      const time = new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(new Date(madeAt));
      expect(within(history).getByText(`Paid ✓ ${time}`)).toBeTruthy();
    });

    it('reads once after a Spark payment that names a charge no read listed, and confirms it', async () => {
      const theirs = { ...OPEN, id: 'c-theirs', amountSats: 42 };
      let opened = false;
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          // Another tab opened this charge after this till read.
          return jsonResponse(
            opened ? { charge: theirs, history: [theirs] } : { charge: null, history: [] },
          );
        }),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      await act(async () => undefined);
      const before = reads;
      opened = true;
      receive(42, 0, Date.now(), theirs.id);
      const dialog = await confirmation();
      expect(within(dialog).getByText('₿42')).toBeTruthy();
      expect(reads).toBe(before + 1);
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

    it('counts a payment made before the end when a lost cancel is read back as run out', async () => {
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'DELETE') {
            throw new Error('offline');
          }
          reads += 1;
          return jsonResponse(
            reads === 1
              ? { charge: OPEN, history: [OPEN] }
              : // The read after the lost cancel: the charge ran out meanwhile, not cancelled.
                { charge: null, history: [{ ...OPEN, status: 'expired' }] },
          );
        }),
      );
      renderWithLocale(<PosScreen />);
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
      // Paid while the cancel is on its way.
      receive(21, 0, Date.now(), 'c1');
      expect(await confirmation()).toBeTruthy();
      expect(reads).toBeGreaterThan(1);
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
      receive(21, 0, Date.now(), 'c1');
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
        // The api has not seen the payment yet at the read after Done: the charge stays paid on
        // this till.
        .mockResolvedValueOnce(jsonResponse({ charge: OPEN, history: [OPEN] }))
        .mockImplementation(async () => jsonResponse({ charge: PAID, history: [PAID] }));
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21, 0, Date.now(), 'c1');
      await act(async () => undefined);
      expect(fetchMock).toHaveBeenCalledTimes(1);
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
      receive(21, 0, Date.now(), 'c1');
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
      receive(21, 0, Date.now(), 'c1');
      showTab();
      await waitFor(() => {
        // The read on open and the one when the tab shows.
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
      // The payment names the charge: the read on open, and no more.
      await act(async () => undefined);
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

    /** Waits `ms` on the real clock. */
    async function pause(ms: number): Promise<void> {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, ms));
      });
    }

    it('keeps the charge open for a payment of its amount that names no charge, another charge, or another amount', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge: OPEN, history: [OPEN] })),
      );
      const vibrate = vi.fn(() => true);
      vi.stubGlobal('navigator', { ...navigator, vibrate });
      vi.mocked(logInteraction).mockClear();
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      // The same amount in the charge's window, over Lightning, naming nothing: the sticker QR, a
      // grant, another member. Amount and time alone do not tie it to the charge.
      receive(21);
      // A payment that names another charge, and one that names this charge with another amount.
      receive(21, 0, Date.now(), 'c-other');
      receive(20, 0, Date.now(), 'c1');
      await act(async () => undefined);
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
      const history = screen.getByRole('region', { name: 'History' });
      expect(within(history).queryByText(/^Paid ✓/)).toBeNull();
      expect(vibrate).not.toHaveBeenCalled();
      expect(logInteraction).not.toHaveBeenCalledWith(
        'pos_charge_paid_seen',
        expect.anything(),
        expect.anything(),
      );
    });

    it('confirms a charge the api returns paid without any wallet payment', async () => {
      let charge: Record<string, unknown> = OPEN;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge, history: [charge] })),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      charge = PAID;
      showTab();
      const dialog = await confirmation();
      expect(within(dialog).getByText('₿21')).toBeTruthy();
    });

    it('asks the api again after each poll pause while an unnamed payment could be the charge’s, and confirms once it reports the charge paid', async () => {
      let apiPaid = false;
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          const charge = apiPaid ? PAID : OPEN;
          return jsonResponse({ charge, history: [charge] });
        }),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21);
      // One ask at once.
      await waitFor(() => {
        expect(reads).toBeGreaterThanOrEqual(2);
      });
      expect(screen.queryByRole('alertdialog')).toBeNull();
      // The api has not marked it yet: the till asks again after the poll pause, still open.
      await waitFor(
        () => {
          expect(reads).toBeGreaterThanOrEqual(3);
        },
        { timeout: 5_000 },
      );
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
      // The api marks the charge paid: the next ask confirms it.
      apiPaid = true;
      expect(
        await screen.findByRole('alertdialog', { name: 'Paid' }, { timeout: 5_000 }),
      ).toBeTruthy();
      // The effects of the paid answer have run.
      await act(async () => undefined);
      const after = reads;
      // Then it stops asking.
      await pause(2_300);
      expect(reads).toBe(after);
    }, 20_000);

    it('never cuts off a read slower than the poll pause, and confirms from its answer', async () => {
      let reads = 0;
      let inFlight = 0;
      let most = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          const mine = reads;
          inFlight += 1;
          most = Math.max(most, inFlight);
          // The read the payment asks for takes longer than the poll pause, and returns it paid.
          if (mine === 2) {
            await pause(3_000);
          }
          inFlight -= 1;
          const charge = mine >= 2 ? PAID : OPEN;
          return jsonResponse({ charge, history: [charge] });
        }),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21);
      // No second ask starts while that read is on its way, and its answer is not dropped.
      expect(
        await screen.findByRole('alertdialog', { name: 'Paid' }, { timeout: 5_000 }),
      ).toBeTruthy();
      expect(reads).toBe(2);
      expect(most).toBe(1);
    }, 10_000);

    it('does not cut off the read a payment asks for when the 0:00 read beside it answers first', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      const paid = { ...ended, status: 'paid', paidAt: new Date().toISOString() };
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          const mine = reads;
          if (mine === 2) {
            // The 0:00 read: slow, and the api still has the charge open.
            await pause(1_000);
            return jsonResponse({ charge: null, history: [ended] });
          }
          if (mine === 3) {
            // The read the payment asks for: slower than the 0:00 read plus the poll pause.
            await pause(4_000);
            return jsonResponse({ charge: paid, history: [paid] });
          }
          return jsonResponse({ charge: mine === 1 ? ended : null, history: [ended] });
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
      // Its answer is kept: no ask started while it was on its way.
      expect(
        await screen.findByRole('alertdialog', { name: 'Paid' }, { timeout: 6_000 }),
      ).toBeTruthy();
      expect(reads).toBe(3);
    }, 12_000);

    it('asks for a payment only after the read already on its way, never beside it', async () => {
      const answers: Array<(response: Response) => void> = [];
      let inFlight = 0;
      let most = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(
          () =>
            new Promise<Response>((resolve) => {
              inFlight += 1;
              most = Math.max(most, inFlight);
              answers.push((response) => {
                inFlight -= 1;
                resolve(response);
              });
            }),
        ),
      );
      renderWithLocale(<PosScreen />);
      await waitFor(() => {
        expect(answers).toHaveLength(1);
      });
      // A Lightning payment arrives while the first read is still on its way: it waits for it.
      receive(21);
      await act(async () => undefined);
      expect(answers).toHaveLength(1);
      await act(async () => {
        answers[0]?.(jsonResponse({ charge: OPEN, history: [OPEN] }));
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(answers).toHaveLength(2);
      });
      await act(async () => {
        answers[1]?.(jsonResponse({ charge: PAID, history: [PAID] }));
        await Promise.resolve();
      });
      expect(await confirmation()).toBeTruthy();
      expect(most).toBe(1);
    });

    it('lets a read of the session before that never answers hold up no read of the next session', async () => {
      let apiPaid = false;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          const auth = new Headers(init?.headers).get('Authorization');
          if (auth === 'Bearer tok') {
            // The read of the session before never answers.
            return new Promise<Response>(() => undefined);
          }
          const charge = apiPaid ? PAID : OPEN;
          return jsonResponse({ charge, history: [charge] });
        }),
      );
      renderWithLocale(<PosScreen />);
      act(() => {
        useAuthStore.setState({ session: 'other' });
      });
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21);
      apiPaid = true;
      expect(
        await screen.findByRole('alertdialog', { name: 'Paid' }, { timeout: 4_000 }),
      ).toBeTruthy();
    }, 10_000);

    it('clears a failed read once an ask for an unnamed payment answers', async () => {
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          if (reads === 2) {
            throw new TypeError('Failed to fetch');
          }
          return jsonResponse({ charge: OPEN, history: [OPEN] });
        }),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      // The read on tab focus fails and shows the error.
      showTab();
      expect(await screen.findByRole('alert')).toBeTruthy();
      // The ask for a payment that could be the charge's answers: the error goes.
      receive(21);
      await waitFor(() => {
        expect(screen.queryByRole('alert')).toBeNull();
      });
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    });

    it('confirms the paid answer of an ask that a later read overtook', async () => {
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          if (reads === 2) {
            // The ask: slow, and the api has marked the charge paid by the time it answers.
            await pause(1_000);
            const paid = { ...PAID, paidAt: new Date().toISOString() };
            return jsonResponse({ charge: paid, history: [paid] });
          }
          return jsonResponse({ charge: OPEN, history: [OPEN] });
        }),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21);
      await waitFor(() => {
        expect(reads).toBe(2);
      });
      // A read on tab focus starts later and answers first, with the charge still open.
      showTab();
      await waitFor(() => {
        expect(reads).toBe(3);
      });
      expect(await confirmation()).toBeTruthy();
    }, 10_000);

    it('counts an unnamed payment for the charge a read shows paid after Cancel cleared it', async () => {
      let cancelled = false;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'DELETE') {
            cancelled = true;
            return jsonResponse({ charge: null });
          }
          // After the cancel, the api shows that charge paid in History only, without a paid time:
          // the payment won.
          return cancelled
            ? jsonResponse({ charge: null, history: [{ ...PAID, paidAt: null }] })
            : jsonResponse({ charge: OPEN, history: [OPEN] });
        }),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      // The payment the wallet received could be that charge's, and the api has it paid.
      expect(await confirmation()).toBeTruthy();
    });

    it('lets a charge closed after the api paid it take no unnamed payment of the next one', async () => {
      const a = {
        ...OPEN,
        id: 'c-a',
        createdAt: new Date(Date.now() - 60_000).toISOString(),
        status: 'paid',
        paidAt: new Date(Date.now() - 50_000).toISOString(),
      };
      const b = { ...OPEN, id: 'c-b', createdAt: new Date(Date.now() - 5_000).toISOString() };
      let phase: 'a' | 'b' = 'a';
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          return phase === 'a'
            ? jsonResponse({ charge: a, history: [a] })
            : jsonResponse({ charge: b, history: [b, a] });
        }),
      );
      renderWithLocale(<PosScreen />);
      // The api shows the charge before paid: Done closes its confirmation.
      fireEvent.click(within(await confirmation()).getByRole('button', { name: 'Done' }));
      phase = 'b';
      showTab();
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21);
      const before = reads;
      // The closed charge does not take the payment: the till keeps asking about the open one.
      await pause(2_300);
      expect(reads).toBeGreaterThan(before);
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    }, 10_000);

    it('lets a charge the api paid before the payment was made take none of it', async () => {
      const a = {
        ...OPEN,
        id: 'c-a',
        createdAt: new Date(Date.now() - 120_000).toISOString(),
        status: 'paid',
        paidAt: new Date(Date.now() - 90_000).toISOString(),
      };
      const b = { ...OPEN, id: 'c-b', createdAt: new Date(Date.now() - 5_000).toISOString() };
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          return jsonResponse({ charge: b, history: [b, a] });
        }),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21);
      const before = reads;
      await pause(2_300);
      // The payment stays the open charge's to ask about.
      expect(reads).toBeGreaterThan(before);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    }, 10_000);

    it('keeps asking quietly after a failed read while an unnamed payment could be the charge’s', async () => {
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          if (reads === 2) {
            throw new TypeError('Failed to fetch');
          }
          return jsonResponse({ charge: reads >= 3 ? PAID : OPEN, history: [OPEN] });
        }),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21);
      await waitFor(() => {
        expect(reads).toBe(2);
      });
      await act(async () => undefined);
      // The till already shows an answer: the failure stays quiet, and the next read still comes.
      expect(screen.queryByRole('alert')).toBeNull();
      expect(
        await screen.findByRole('alertdialog', { name: 'Paid' }, { timeout: 3_000 }),
      ).toBeTruthy();
      expect(reads).toBe(3);
    }, 10_000);

    it('does not ask the api for an unnamed payment that cannot be the charge’s', async () => {
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          return jsonResponse({ charge: OPEN, history: [OPEN] });
        }),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      // Another amount, and the charge amount made before the charge was created.
      receive(22);
      receive(21, 0, Date.parse(OPEN.createdAt) - 5_000);
      // Neither could be the charge's payment: no read, also after the poll pause.
      await pause(2_300);
      expect(reads).toBe(1);
      expect(screen.queryByRole('alertdialog')).toBeNull();
    }, 10_000);

    it('keeps asking past the late minute for a payment made in its last second, and confirms it', async () => {
      // The charge ran out 59 s ago: a payment now may still be its.
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 59_000).toISOString() };
      const paid = { ...ended, status: 'paid', paidAt: new Date().toISOString() };
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          // The api marks it paid only after the read the payment asks for at once.
          const charge = reads <= 2 ? null : reads === 3 ? null : paid;
          return jsonResponse({ charge: reads === 1 ? ended : charge, history: [ended] });
        }),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      await waitFor(() => {
        expect(reads).toBe(2);
      });
      receive(21);
      await waitFor(() => {
        expect(reads).toBe(3);
      });
      // The poll pause ends after the charge's late minute: the till still asks, and confirms.
      expect(
        await screen.findByRole('alertdialog', { name: 'Paid' }, { timeout: 4_000 }),
      ).toBeTruthy();
      expect(reads).toBe(4);
    }, 10_000);

    it('stops asking the api a minute after the payment that could be the charge’s', async () => {
      // The charge ran out 150 s ago; the payment came 95 s ago, inside its late minute.
      const ended = {
        ...OPEN,
        createdAt: new Date(Date.now() - 450_000).toISOString(),
        expiresAt: new Date(Date.now() - 150_000).toISOString(),
      };
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
      receive(21, 0, Date.now() - 95_000);
      // More than a minute after that payment: the till does not ask the api.
      await pause(2_300);
      expect(reads).toBe(2);
      expect(screen.queryByRole('alertdialog')).toBeNull();
    }, 10_000);

    it('asks again at once for a newer unnamed payment after the asks for an older one stopped', async () => {
      const ended = {
        ...OPEN,
        createdAt: new Date(Date.now() - 400_000).toISOString(),
        expiresAt: new Date(Date.now() - 10_000).toISOString(),
      };
      const paid = { ...ended, status: 'paid', paidAt: new Date().toISOString() };
      let apiPaid = false;
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          const charge = reads === 1 ? ended : apiPaid ? paid : null;
          return jsonResponse({ charge, history: [charge ?? ended] });
        }),
      );
      renderWithLocale(<PosScreen />);
      await waitFor(() => {
        expect(reads).toBe(2);
      });
      // A payment whose minute ends in half a second: one ask, then the asks stop.
      receive(21, 0, Date.now() - 59_500);
      await waitFor(() => {
        expect(reads).toBe(3);
      });
      await pause(2_300);
      expect(reads).toBe(3);
      // A newer payment that could be the charge's: asked about at once, and confirmed.
      apiPaid = true;
      receive(21);
      expect(
        await screen.findByRole('alertdialog', { name: 'Paid' }, { timeout: 1_500 }),
      ).toBeTruthy();
      expect(reads).toBe(4);
    }, 10_000);

    it('asks again at once for a second unnamed payment made in the same second', async () => {
      const answers: Array<(response: Response) => void> = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(
          () =>
            new Promise<Response>((resolve) => {
              answers.push(resolve);
            }),
        ),
      );
      renderWithLocale(<PosScreen />);
      await waitFor(() => {
        expect(answers).toHaveLength(1);
      });
      await act(async () => {
        answers[0]?.(jsonResponse({ charge: OPEN, history: [OPEN] }));
        await Promise.resolve();
      });
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      const at = Date.now();
      receive(21, 0, at);
      await waitFor(() => {
        expect(answers).toHaveLength(2);
      });
      // Another payment of the same second: it starts the asks again at once.
      receive(21, 0, at);
      await waitFor(() => {
        expect(answers).toHaveLength(3);
      });
      await act(async () => {
        answers[2]?.(jsonResponse({ charge: PAID, history: [PAID] }));
        await Promise.resolve();
      });
      expect(await confirmation()).toBeTruthy();
    });

    it('counts an unnamed payment the api confirmed for one charge for no other', async () => {
      const ended = {
        ...OPEN,
        createdAt: new Date(Date.now() - 200_000).toISOString(),
        expiresAt: new Date(Date.now() - 10_000).toISOString(),
      };
      const paidA = { ...ended, status: 'paid', paidAt: new Date().toISOString() };
      // Another device's charge of the same amount, made before the payment.
      const b = { ...OPEN, id: 'c-b', createdAt: new Date(Date.now() - 5_000).toISOString() };
      let phase: 'open' | 'paid' = 'open';
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          if (reads === 1) {
            return jsonResponse({ charge: ended, history: [ended] });
          }
          return phase === 'open'
            ? jsonResponse({ charge: null, history: [ended] })
            : jsonResponse({ charge: b, history: [b, paidA] });
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
      // The api marks the first charge paid and shows the newer one open: that payment was the
      // first charge's, and the till does not ask about the newer one for it.
      phase = 'paid';
      expect(
        await screen.findByRole('button', { name: 'Cancel' }, { timeout: 4_000 }),
      ).toBeTruthy();
      const history = screen.getByRole('region', { name: 'History' });
      expect(within(history).getByText(/^Paid ✓/)).toBeTruthy();
      // The newer open charge hides the older one's confirmation.
      expect(screen.queryByRole('alertdialog')).toBeNull();
      await act(async () => undefined);
      const after = reads;
      await pause(2_300);
      expect(reads).toBe(after);
    }, 10_000);

    it('keeps asking the api after a failed Cancel for an unnamed payment that could be the charge’s', async () => {
      let apiPaid = false;
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === 'DELETE') {
            return jsonResponse({ error: 'down' }, 502);
          }
          reads += 1;
          const charge = apiPaid ? PAID : OPEN;
          return jsonResponse({ charge, history: [charge] });
        }),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      receive(21);
      await waitFor(() => {
        expect(reads).toBe(2);
      });
      // Cancel fails: the charge is open again, and the till goes on asking for that payment.
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(await screen.findByRole('alert')).toBeTruthy();
      const afterCancel = reads;
      apiPaid = true;
      expect(
        await screen.findByRole('alertdialog', { name: 'Paid' }, { timeout: 4_000 }),
      ).toBeTruthy();
      expect(reads).toBeGreaterThan(afterCancel);
    }, 10_000);

    it('sends the amount page back to the till when the api confirms an unnamed payment of the charge that ran out', async () => {
      const ended = { ...OPEN, expiresAt: new Date(Date.now() - 1_000).toISOString() };
      const paid = { ...ended, status: 'paid', paidAt: new Date().toISOString() };
      let apiPaid = false;
      let reads = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          reads += 1;
          return jsonResponse(
            reads === 1
              ? { charge: ended, history: [ended] }
              : { charge: apiPaid ? paid : null, history: [apiPaid ? paid : ended] },
          );
        }),
      );
      const till = renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
      till.unmount();
      renderWithLocale(<PosAmount />);
      expect(await screen.findByRole('button', { name: 'Create payment' })).toBeTruthy();
      // A Lightning payment of the amount, in the minute after the end, that names no charge.
      receive(21);
      expect(replace).not.toHaveBeenCalled();
      // The api ties it to the charge: the amount page returns to the till for the confirmation.
      apiPaid = true;
      await waitFor(
        () => {
          expect(replace).toHaveBeenCalledWith('/pos');
        },
        { timeout: 4_000 },
      );
      expect(screen.queryByRole('button', { name: 'Create payment' })).toBeNull();
    }, 10_000);

    it('never counts one payment for two charges', async () => {
      const next = { ...OPEN, id: 'c2', createdAt: new Date(Date.now() + 1_000).toISOString() };
      let charge: Record<string, unknown> = OPEN;
      let history: Array<Record<string, unknown>> = [OPEN];
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => jsonResponse({ charge, history })),
      );
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      const madeAt = Date.now();
      receive(21, 0, madeAt, 'c1');
      fireEvent.click(within(await confirmation()).getByRole('button', { name: 'Done' }));
      // The next charge of the same amount opens; the api shows the first one paid.
      charge = next;
      history = [next, PAID];
      showTab();
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      // The wallet reports the same payment again: it stays the first charge's.
      receive(21, 0, madeAt, 'c1');
      await act(async () => undefined);
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
      const rows = screen.getByRole('region', { name: 'History' });
      expect(within(rows).getAllByText(/^Paid ✓/)).toHaveLength(1);
    });

    it('reports an unnamed payment of the open amount under the pos-received-unnamed pin in a Playwright build, which pays nothing', async () => {
      process.env.NEXT_PUBLIC_E2E_NOW = '2026-09-20T12:00:00.000Z';
      window.history.replaceState({}, '', '/pos?visual=pos-received-unnamed');
      const fetchMock = vi
        .fn()
        .mockImplementation(async () => jsonResponse({ charge: OPEN, history: [OPEN] }));
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      // The till asks the api once, which still has the charge open; the pin reports the payment
      // once, not again for every read that returns the same charge.
      await pause(300);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    });

    it('ignores the pos-received-unnamed pin in a production build', async () => {
      delete process.env.NEXT_PUBLIC_E2E_NOW;
      window.history.replaceState({}, '', '/pos?visual=pos-received-unnamed');
      const fetchMock = vi
        .fn()
        .mockImplementation(async () => jsonResponse({ charge: OPEN, history: [OPEN] }));
      vi.stubGlobal('fetch', fetchMock);
      renderWithLocale(<PosScreen />);
      expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
      await act(async () => undefined);
      expect(fetchMock).toHaveBeenCalledTimes(1);
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

describe('PosScreen received without a charge', () => {
  const RECEIVED = {
    id: '0a1b2c3d-0000-4000-8000-000000000002',
    amountSats: 2_100,
    receivedAt: '2026-10-04T12:03:10.000Z',
    kind: 'lightning',
  };

  /** This tab's wallet read its balance again (a payment, a sync, or the five-minute refresh). */
  function walletRead(): void {
    act(() => {
      useWalletStore.setState((state) => ({ syncCount: state.syncCount + 1 }));
    });
  }

  it('reads the till again on every wallet read and lists the payment without a reload', async () => {
    vi.mocked(logInteraction).mockClear();
    const fetchMock = vi.fn(async () => jsonResponse({ charge: null, history: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const view = renderWithLocale(<PosScreen />);
    expect(await screen.findByText('No payments yet.')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // A render without a new wallet read asks nothing.
    view.rerender(<PosScreen />);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockImplementation(async () =>
      jsonResponse({ charge: null, history: [], received: [RECEIVED] }),
    );
    walletRead();
    const history = screen.getByRole('region', { name: 'History' });
    expect(await within(history).findByText('Received')).toBeTruthy();
    expect(within(history).getByText("₿2'100")).toBeTruthy();
    expect(within(history).getByText('Instant payment')).toBeTruthy();
    expect(screen.queryByText('No payments yet.')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // It is not a paid charge: no full-screen confirmation, and Set an amount stays.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Paid')).toBeNull();
    expect(screen.getByRole('link', { name: 'Set an amount' })).toBeTruthy();
    expect(logInteraction).not.toHaveBeenCalledWith(
      'pos_charge_paid_seen',
      expect.anything(),
      expect.anything(),
    );
  });

  it('keeps the till as it is, without an error, when the read after a wallet read fails', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ charge: null, history: [], received: [RECEIVED] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosScreen />);
    expect(await screen.findByText('Received')).toBeTruthy();
    fetchMock.mockImplementation(async () => jsonResponse({ error: 'down' }, 500));
    walletRead();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByText('Point of sale is unavailable.')).toBeNull();
    expect(screen.getByText('Received')).toBeTruthy();
  });

  it('shows the error when the first read fails, also when a wallet read asked for it', async () => {
    let answer: (value: Response) => void = () => undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosScreen />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    walletRead();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    await act(async () => {
      answer(jsonResponse({ error: 'down' }, 500));
    });
    expect(await screen.findByText('Point of sale is unavailable.')).toBeTruthy();
  });

  it('keeps the received payments when Cancel takes the open charge off', async () => {
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
      return jsonResponse({ charge, history: [charge], received: [RECEIVED] });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosScreen />);
    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.getByText('Received')).toBeTruthy();
    // The read after the cancel never answers: the till shows what the cancel left.
    fetchMock.mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === 'DELETE' ? jsonResponse({ charge: null }) : new Promise<Response>(() => {}),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('link', { name: 'Set an amount' })).toBeTruthy();
    const history = screen.getByRole('region', { name: 'History' });
    expect(within(history).getByText('Cancelled')).toBeTruthy();
    expect(within(history).getByText('Received')).toBeTruthy();
  });
});
