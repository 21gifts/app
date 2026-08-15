// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import {
  fetchMe,
  pollSession,
  setLightningAddress,
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
