// @vitest-environment node
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import {
  fetchGiftStats,
  fetchMe,
  pollSession,
  setLightningAddress,
  setName,
  resolveLightningAddress,
  startLnurlAuth,
  unlinkLightningAddress,
} from '@/lib/api';

const account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis' as const,
  name: null,
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('startLnurlAuth', () => {
  it('returns the validated challenge', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: challenge });

    await expect(startLnurlAuth()).resolves.toEqual(challenge);
    expect(fetchMock).toHaveBeenCalledWith(`/auth/lnurl`);
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
    expect(fetchMock).toHaveBeenCalledWith(`/auth/session`, {
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
    expect(fetchMock).toHaveBeenCalledWith(`/me`, {
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

describe('setName', () => {
  it('posts the name and returns the validated account', async () => {
    const named = { ...account, name: 'Ada' };
    const fetchMock = stubFetch({ ok: true, status: 200, body: named });

    await expect(setName('sess', 'Ada')).resolves.toEqual(named);
    expect(fetchMock).toHaveBeenCalledWith(`/me/name`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer sess',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Ada' }),
    });
  });

  it('throws the api error message on a 400', async () => {
    stubFetch({ ok: false, status: 400, body: { error: 'Name must be 1–80 characters' } });
    await expect(setName('sess', '')).rejects.toThrow('Name must be 1–80 characters');
  });

  it('falls back when a 400 body is not an error envelope', async () => {
    stubFetch({ ok: false, status: 400, body: {} });
    await expect(setName('sess', 'x')).rejects.toThrow('Could not save your name');
  });

  it('falls back when a 400 body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.reject(new SyntaxError('not json')),
      } as unknown as Response),
    );
    await expect(setName('sess', 'x')).rejects.toThrow('Could not save your name');
  });

  it('throws on a non-400 non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(setName('sess', 'x')).rejects.toThrow('Could not save your name');
  });

  it('throws when the body fails validation', async () => {
    stubFetch({ ok: true, status: 200, body: { id: 'acc_1' } });
    await expect(setName('sess', 'x')).rejects.toThrow();
  });
});

describe('setLightningAddress', () => {
  it('posts the address and returns the validated account', async () => {
    const linked = { ...account, lightningAddress: 'me@walletofsatoshi.com' };
    const fetchMock = stubFetch({ ok: true, status: 200, body: linked });

    await expect(setLightningAddress('sess', 'me@walletofsatoshi.com')).resolves.toEqual(linked);
    expect(fetchMock).toHaveBeenCalledWith(`/me/lightning-address`, {
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
    await expect(setLightningAddress('sess', 'nope')).rejects.toThrow(
      'That Wallet of Satoshi address is not valid',
    );
  });

  it('rewrites remaining Lightning jargon in a 400', async () => {
    stubFetch({ ok: false, status: 400, body: { error: 'Lightning Address is taken' } });
    await expect(setLightningAddress('sess', 'x')).rejects.toThrow(
      'Wallet of Satoshi address is taken',
    );
  });

  it('falls back when a 400 body is not an error envelope', async () => {
    stubFetch({ ok: false, status: 400, body: {} });
    await expect(setLightningAddress('sess', 'x')).rejects.toThrow(
      'Could not save your Wallet of Satoshi address',
    );
  });

  it('falls back when a 400 body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.reject(new SyntaxError('not json')),
      } as unknown as Response),
    );
    await expect(setLightningAddress('sess', 'x')).rejects.toThrow(
      'Could not save your Wallet of Satoshi address',
    );
  });

  it('throws on a non-400 non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(setLightningAddress('sess', 'x')).rejects.toThrow(
      'Could not save your Wallet of Satoshi address',
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
    expect(fetchMock).toHaveBeenCalledWith(`/me/lightning-address`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer sess' },
    });
  });

  it('throws on a non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(unlinkLightningAddress('sess')).rejects.toThrow(
      'Could not remove your Wallet of Satoshi address',
    );
  });

  it('throws when the body fails validation', async () => {
    stubFetch({ ok: true, status: 200, body: { id: 'acc_1' } });
    await expect(unlinkLightningAddress('sess')).rejects.toThrow();
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
      `/lightning-address?address=${encodeURIComponent('me@walletofsatoshi.com')}`,
    );
  });

  it('throws the api error message on a 400', async () => {
    stubFetch({
      ok: false,
      status: 400,
      body: { error: 'Not a valid Lightning Address (expected name@domain)' },
    });
    await expect(resolveLightningAddress('nope')).rejects.toThrow(
      'Enter an address like you@walletofsatoshi.com',
    );
  });

  it('throws the api error message on a 502', async () => {
    stubFetch({
      ok: false,
      status: 502,
      body: { error: 'Lightning Address could not be resolved' },
    });
    await expect(resolveLightningAddress('me@walletofsatoshi.com')).rejects.toThrow(
      'That Wallet of Satoshi address could not be found',
    );
  });

  it('rewrites an upstream-unreachable 502', async () => {
    stubFetch({
      ok: false,
      status: 502,
      body: { error: 'Upstream api unreachable' },
    });
    await expect(resolveLightningAddress('me@walletofsatoshi.com')).rejects.toThrow(
      'Something went wrong. Please try again.',
    );
  });

  it('falls back when a 502 body is not an error envelope', async () => {
    stubFetch({ ok: false, status: 502, body: { error: 123 } });
    await expect(resolveLightningAddress('me@walletofsatoshi.com')).rejects.toThrow(
      'Could not find that Wallet of Satoshi address',
    );
  });

  it('throws on a non-api-message non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(resolveLightningAddress('me@walletofsatoshi.com')).rejects.toThrow(
      'Could not find that Wallet of Satoshi address',
    );
  });

  it('throws when the body fails validation', async () => {
    stubFetch({ ok: true, status: 200, body: { address: 'x' } });
    await expect(resolveLightningAddress('me@walletofsatoshi.com')).rejects.toThrow();
  });
});

describe('fetchGiftStats', () => {
  const stats = {
    totalSats: 10,
    giftCount: 1,
    recipientCount: 1,
    firstPaidAt: '2026-06-01T00:00:00.000Z',
    lastPaidAt: '2026-06-01T00:00:00.000Z',
    spendOverTime: [{ day: '2026-06-01', sats: 10, cumulativeSats: 10 }],
    byRecipient: [{ recipient: 'alice', giftCount: 1, sats: 10 }],
    byMonth: [{ month: '2026-06', giftCount: 1, sats: 10 }],
  };

  it('returns the validated payload', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: stats });
    await expect(fetchGiftStats()).resolves.toEqual(stats);
    expect(fetchMock).toHaveBeenCalledWith('/gifts/stats');
  });

  it('throws visitor copy on a non-ok response', async () => {
    stubFetch({ ok: false, status: 503, body: { error: 'Gift stats are unavailable' } });
    await expect(fetchGiftStats()).rejects.toThrow('Could not load gift stats. Please try again.');
  });

  it('throws visitor copy when fetch itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(fetchGiftStats()).rejects.toThrow('Could not load gift stats. Please try again.');
  });

  it('throws when the body fails validation', async () => {
    stubFetch({ ok: true, status: 200, body: { giftCount: 1 } });
    await expect(fetchGiftStats()).rejects.toThrow('Could not load gift stats. Please try again.');
  });
});
