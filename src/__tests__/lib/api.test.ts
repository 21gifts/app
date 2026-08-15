// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import {
  confirmLightningAddressVerification,
  fetchMe,
  pollSession,
  setLightningAddress,
  startLightningAddressVerification,
  resolveLightningAddress,
  startLnurlAuth,
  unlinkLightningAddress,
} from '@/lib/api';

const API = 'https://api.test';

const account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis' as const,
  lightningAddress: null,
  lightningAddressVerified: false,
  createdAt: 1_700_000_000,
};

const challenge = { lnurl: 'ln', k1: 'k1', pollToken: 'ptok', expiresInSeconds: 90 };

/** The subset of `Response` the api client touches. */
interface FakeResponse {
  ok: boolean;
  status: number;
  body: unknown;
}

/** Installs a `fetch` mock resolving to a minimal Response-like value. */
function stubFetch(response: FakeResponse): Mock {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: () => Promise.resolve(response.body),
  } as unknown as Response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = API;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('startLnurlAuth', () => {
  it('returns the validated challenge', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: challenge });

    await expect(startLnurlAuth()).resolves.toEqual(challenge);
    expect(fetchMock).toHaveBeenCalledWith(`${API}/auth/lnurl`);
  });

  it('throws on a non-ok response', async () => {
    stubFetch({ ok: false, status: 503, body: {} });
    await expect(startLnurlAuth()).rejects.toThrow('Failed to start LNURL auth: 503');
  });

  it('throws when the body fails validation', async () => {
    stubFetch({ ok: true, status: 200, body: { lnurl: 'x' } });
    await expect(startLnurlAuth()).rejects.toThrow();
  });
});

describe('pollSession', () => {
  it('returns the validated result and sends the poll-token header', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: { status: 'pending' } });

    await expect(pollSession('ptok')).resolves.toEqual({ status: 'pending' });
    expect(fetchMock).toHaveBeenCalledWith(`${API}/auth/session`, {
      headers: { 'X-Poll-Token': 'ptok' },
    });
  });

  it('returns an authenticated result with token and account', async () => {
    const body = { status: 'authenticated', token: 'sess', account };
    stubFetch({ ok: true, status: 200, body });
    await expect(pollSession('ptok')).resolves.toEqual(body);
  });

  it('throws on a non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(pollSession('ptok')).rejects.toThrow('Failed to poll session: 500');
  });

  it('throws when the body fails validation', async () => {
    stubFetch({ ok: true, status: 200, body: { status: 'authenticated' } });
    await expect(pollSession('ptok')).rejects.toThrow();
  });
});

describe('fetchMe', () => {
  it('returns the validated account and sends the bearer header', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: account });

    await expect(fetchMe('sess')).resolves.toEqual(account);
    expect(fetchMock).toHaveBeenCalledWith(`${API}/me`, {
      headers: { Authorization: 'Bearer sess' },
    });
  });

  it('returns null on 401', async () => {
    stubFetch({ ok: false, status: 401, body: {} });
    await expect(fetchMe('sess')).resolves.toBeNull();
  });

  it('throws on a non-401 non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(fetchMe('sess')).rejects.toThrow('Failed to fetch account: 500');
  });

  it('throws when the body fails validation', async () => {
    stubFetch({ ok: true, status: 200, body: { id: 'acc_1' } });
    await expect(fetchMe('sess')).rejects.toThrow();
  });
});

describe('setLightningAddress', () => {
  it('posts the address and returns the validated account', async () => {
    const linked = { ...account, lightningAddress: 'me@walletofsatoshi.com' };
    const fetchMock = stubFetch({ ok: true, status: 200, body: linked });

    await expect(setLightningAddress('sess', 'me@walletofsatoshi.com')).resolves.toEqual(linked);
    expect(fetchMock).toHaveBeenCalledWith(`${API}/me/lightning-address`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer sess',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address: 'me@walletofsatoshi.com' }),
    });
  });

  it('throws the api error message on a 400', async () => {
    stubFetch({ ok: false, status: 400, body: { error: 'Invalid Lightning Address' } });
    await expect(setLightningAddress('sess', 'nope')).rejects.toThrow('Invalid Lightning Address');
  });

  it('throws on a non-400 non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(setLightningAddress('sess', 'x')).rejects.toThrow(
      'Failed to set Lightning Address: 500',
    );
  });

  it('throws when the body fails validation', async () => {
    stubFetch({ ok: true, status: 200, body: { id: 'acc_1' } });
    await expect(setLightningAddress('sess', 'x')).rejects.toThrow();
  });
});

describe('unlinkLightningAddress', () => {
  it('deletes the address and returns the validated account', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: account });

    await expect(unlinkLightningAddress('sess')).resolves.toEqual(account);
    expect(fetchMock).toHaveBeenCalledWith(`${API}/me/lightning-address`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer sess' },
    });
  });

  it('throws on a non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(unlinkLightningAddress('sess')).rejects.toThrow(
      'Failed to unlink Lightning Address: 500',
    );
  });

  it('throws when the body fails validation', async () => {
    stubFetch({ ok: true, status: 200, body: { id: 'acc_1' } });
    await expect(unlinkLightningAddress('sess')).rejects.toThrow();
  });
});

describe('startLightningAddressVerification', () => {
  const sent = { status: 'sent' as const, expiresInSeconds: 120, sats: 1 };

  it('posts and returns the validated sent payload', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: sent });

    await expect(startLightningAddressVerification('sess')).resolves.toEqual(sent);
    expect(fetchMock).toHaveBeenCalledWith(`${API}/me/lightning-address/verification`, {
      method: 'POST',
      headers: { Authorization: 'Bearer sess' },
    });
  });

  it('throws the api error message on a 503', async () => {
    stubFetch({
      ok: false,
      status: 503,
      body: { error: 'Verification payments are not configured' },
    });
    await expect(startLightningAddressVerification('sess')).rejects.toThrow(
      'Verification payments are not configured',
    );
  });

  it('throws the api error message on a 502', async () => {
    stubFetch({ ok: false, status: 502, body: { error: 'Wallet unreachable' } });
    await expect(startLightningAddressVerification('sess')).rejects.toThrow('Wallet unreachable');
  });

  it('throws the api error message on a 409', async () => {
    stubFetch({ ok: false, status: 409, body: { error: 'Verification already in flight' } });
    await expect(startLightningAddressVerification('sess')).rejects.toThrow(
      'Verification already in flight',
    );
  });

  it('throws the api error message on a 400', async () => {
    stubFetch({ ok: false, status: 400, body: { error: 'No Lightning Address linked' } });
    await expect(startLightningAddressVerification('sess')).rejects.toThrow(
      'No Lightning Address linked',
    );
  });

  it('throws on a non-api-message non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(startLightningAddressVerification('sess')).rejects.toThrow(
      'Failed to start Lightning Address verification: 500',
    );
  });

  it('throws when the body fails validation', async () => {
    stubFetch({ ok: true, status: 200, body: { status: 'sent' } });
    await expect(startLightningAddressVerification('sess')).rejects.toThrow();
  });
});

describe('confirmLightningAddressVerification', () => {
  const verified = {
    ...account,
    lightningAddress: 'me@walletofsatoshi.com',
    lightningAddressVerified: true,
  };

  it('posts the nonce with the bearer header and returns the verified account', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: verified });

    await expect(confirmLightningAddressVerification('sess', 'nonce-1')).resolves.toEqual(verified);
    expect(fetchMock).toHaveBeenCalledWith(`${API}/me/lightning-address/verification/confirm`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer sess',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nonce: 'nonce-1' }),
    });
  });

  it('throws the api error message on a 400', async () => {
    stubFetch({ ok: false, status: 400, body: { error: 'Incorrect verification code' } });
    await expect(confirmLightningAddressVerification('sess', 'bad')).rejects.toThrow(
      'Incorrect verification code',
    );
  });

  it('throws on a non-api-message non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(confirmLightningAddressVerification('sess', 'n')).rejects.toThrow(
      'Failed to confirm Lightning Address verification: 500',
    );
  });

  it('throws when the body fails validation', async () => {
    stubFetch({ ok: true, status: 200, body: { id: 'acc_1' } });
    await expect(confirmLightningAddressVerification('sess', 'n')).rejects.toThrow();
  });
});

describe('resolveLightningAddress', () => {
  const resolved = {
    address: 'me@walletofsatoshi.com',
    callback: 'https://walletofsatoshi.com/lnurlp/callback',
    minSendable: 1000,
    maxSendable: 100_000_000,
  };

  it('returns the validated metadata and encodes the address', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: resolved });
    await expect(resolveLightningAddress('me@walletofsatoshi.com')).resolves.toEqual(resolved);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API}/lightning-address?address=${encodeURIComponent('me@walletofsatoshi.com')}`,
    );
  });

  it('throws the api error message on a 400', async () => {
    stubFetch({
      ok: false,
      status: 400,
      body: { error: 'Not a valid Lightning Address (expected name@domain)' },
    });
    await expect(resolveLightningAddress('nope')).rejects.toThrow(
      'Not a valid Lightning Address (expected name@domain)',
    );
  });

  it('throws the api error message on a 502', async () => {
    stubFetch({
      ok: false,
      status: 502,
      body: { error: 'Lightning Address could not be resolved' },
    });
    await expect(resolveLightningAddress('me@walletofsatoshi.com')).rejects.toThrow(
      'Lightning Address could not be resolved',
    );
  });

  it('throws on a non-api-message non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(resolveLightningAddress('me@walletofsatoshi.com')).rejects.toThrow(
      'Failed to resolve Lightning Address: 500',
    );
  });

  it('throws when the body fails validation', async () => {
    stubFetch({ ok: true, status: 200, body: { address: 'x' } });
    await expect(resolveLightningAddress('me@walletofsatoshi.com')).rejects.toThrow();
  });
});
