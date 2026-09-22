import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PosScreen } from '@/components/PosScreen';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

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
  it('shows the amount form when nothing is open', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] })),
    );
    renderWithLocale(<PosScreen />);
    expect(await screen.findByRole('heading', { name: 'Point of sale' })).toBeTruthy();
    expect(screen.getByText('alice@21.gifts')).toBeTruthy();
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
    expect(screen.getAllByText('21 sats').length).toBeGreaterThan(0);
    fetchMock.mockImplementation(async () => jsonResponse({ charge: null, history: [] }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create payment' })).toBeTruthy();
    });
  });

  it('rejects a fractional amount without calling the api', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithLocale(<PosScreen />);
    fireEvent.change(await screen.findByLabelText('Amount'), { target: { value: '1.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create payment' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Enter a whole number of sats.');
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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] })),
    );
    renderWithLocale(<PosScreen />);
    expect(
      await screen.findByRole('link', { name: 'Set a Wallet of Satoshi address first.' }),
    ).toBeTruthy();
  });

  it('lists cancelled and expired history', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          charge: null,
          history: [
            {
              id: 'c2',
              amountSats: 5,
              status: 'cancelled',
              createdAt: new Date().toISOString(),
              expiresAt: new Date().toISOString(),
            },
            {
              id: 'c3',
              amountSats: 8,
              status: 'expired',
              createdAt: new Date().toISOString(),
              expiresAt: new Date().toISOString(),
            },
          ],
        }),
      ),
    );
    renderWithLocale(<PosScreen />);
    expect(await screen.findByText('Cancelled')).toBeTruthy();
    expect(screen.getByText('Expired')).toBeTruthy();
  });

  it('hides the QR on a phone', async () => {
    const original = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] })),
    );
    renderWithLocale(<PosScreen />);
    expect(await screen.findByRole('button', { name: 'Create payment' })).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Open CryptoPay QR code' })).toBeNull();
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: original });
  });

  it('shows an error when the till cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'nope' }, 500)));
    renderWithLocale(<PosScreen />);
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('asks for a username when the account has none', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...ACCOUNT, username: null },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ charge: null, history: [] })),
    );
    renderWithLocale(<PosScreen />);
    expect(await screen.findByRole('link', { name: 'Set a username first.' })).toBeTruthy();
  });
});
