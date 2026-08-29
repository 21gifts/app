// @vitest-environment node
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import {
  fetchGiftDay,
  fetchGiftStats,
  fetchMe,
  fetchMessages,
  finishPasskeyAuthentication,
  finishPasskeyRegistration,
  postContact,
  postMessage,
  postMessageInvoice,
  setLightningAddress,
  setName,
  resolveLightningAddress,
  startPasskeyAuthentication,
  startPasskeyRegistration,
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

describe('fetchGiftDay', () => {
  const day = {
    day: '2026-06-01',
    giftCount: 1,
    totalSats: 500,
    totalBtc: '0.00000500',
    totalUsd: '0.48',
    gifts: [
      {
        paidAt: '2026-06-01T12:00:00.000Z',
        amountSats: 500,
        amountBtc: '0.00000500',
        amountUsd: '0.48',
        recipient: 'alice',
      },
    ],
    fx: {
      quote: 'BTC-USD',
      dayBasis: 'utc',
      source: 'coinbase-exchange-daily-close',
    },
  };

  it('returns the validated payload', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: day });
    await expect(fetchGiftDay('2026-06-01')).resolves.toEqual(day);
    expect(fetchMock).toHaveBeenCalledWith('/gifts?day=2026-06-01');
  });

  it('throws visitor copy on a non-ok response', async () => {
    stubFetch({ ok: false, status: 503, body: { error: 'Gift stats are unavailable' } });
    await expect(fetchGiftDay('2026-06-01')).rejects.toThrow(
      'Could not load gift stats. Please try again.',
    );
  });
});

describe('fetchGiftStats', () => {
  const stats = {
    totalSats: 10,
    totalBtc: '0.00000010',
    totalUsd: '0.01',
    giftCount: 1,
    recipientCount: 1,
    firstPaidAt: '2026-06-01T00:00:00.000Z',
    lastPaidAt: '2026-06-01T00:00:00.000Z',
    spendOverTime: [
      {
        day: '2026-06-01',
        sats: 10,
        cumulativeSats: 10,
        btc: '0.00000010',
        cumulativeBtc: '0.00000010',
        usd: '0.01',
        cumulativeUsd: '0.01',
      },
    ],
    byRecipient: [{ recipient: 'alice', giftCount: 1, sats: 10, btc: '0.00000010', usd: '0.01' }],
    byMonth: [{ month: '2026-06', giftCount: 1, sats: 10, btc: '0.00000010', usd: '0.01' }],
    fx: {
      quote: 'BTC-USD',
      dayBasis: 'utc',
      source: 'coinbase-exchange-daily-close',
    },
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

const forumMessage = {
  id: 'm1',
  name: 'Ada',
  text: 'Hello from Ada',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 0,
  payable: false,
};

describe('fetchMessages', () => {
  it('returns the validated messages and sends the bearer header', async () => {
    const fetchMock = stubFetch({
      ok: true,
      status: 200,
      body: { messages: [forumMessage] },
    });
    await expect(fetchMessages('sess')).resolves.toEqual([forumMessage]);
    expect(fetchMock).toHaveBeenCalledWith('/messages', {
      headers: { Authorization: 'Bearer sess' },
    });
  });

  it('throws visitor copy on a non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(fetchMessages('sess')).rejects.toThrow(
      'Could not load messages. Please try again.',
    );
  });

  it('throws visitor copy when fetch itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(fetchMessages('sess')).rejects.toThrow(
      'Could not load messages. Please try again.',
    );
  });

  it('throws visitor copy when the body fails validation', async () => {
    stubFetch({ ok: true, status: 200, body: { messages: [{ id: 'm1' }] } });
    await expect(fetchMessages('sess')).rejects.toThrow(
      'Could not load messages. Please try again.',
    );
  });
});

describe('postMessageInvoice', () => {
  it('returns pr and amountSats', async () => {
    stubFetch({ ok: true, status: 200, body: { pr: 'lnbc21n1test', amountSats: 21 } });
    await expect(postMessageInvoice('sess', 'm1', 21)).resolves.toEqual({
      pr: 'lnbc21n1test',
      amountSats: 21,
    });
  });

  it('throws on 429', async () => {
    stubFetch({ ok: false, status: 429, body: { error: 'Too many payments' } });
    await expect(postMessageInvoice('sess', 'm1', 21)).rejects.toThrow('Too many payments');
  });

  it('falls back when a 429 body is not an error envelope', async () => {
    stubFetch({ ok: false, status: 429, body: {} });
    await expect(postMessageInvoice('sess', 'm1', 21)).rejects.toThrow(
      'Could not start the Bitcoin payment',
    );
  });

  it('throws on 400', async () => {
    stubFetch({ ok: false, status: 400, body: { error: 'This message cannot be paid yet' } });
    await expect(postMessageInvoice('sess', 'm1', 21)).rejects.toThrow(
      'This message cannot be paid yet',
    );
  });

  it('throws on 404', async () => {
    stubFetch({ ok: false, status: 404, body: {} });
    await expect(postMessageInvoice('sess', 'm1', 21)).rejects.toThrow(
      'Could not start the Bitcoin payment',
    );
  });

  it('throws on 503', async () => {
    stubFetch({ ok: false, status: 503, body: {} });
    await expect(postMessageInvoice('sess', 'm1', 21)).rejects.toThrow(
      'Could not start the Bitcoin payment',
    );
  });

  it('throws on other non-ok statuses', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(postMessageInvoice('sess', 'm1', 21)).rejects.toThrow(
      'Could not start the Bitcoin payment',
    );
  });
});

describe('postMessage', () => {
  it('posts the text and returns the validated message', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: forumMessage });
    await expect(postMessage('sess', 'Hello from Ada')).resolves.toEqual(forumMessage);
    expect(fetchMock).toHaveBeenCalledWith('/messages', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer sess',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: 'Hello from Ada' }),
    });
  });

  it('throws the api error message on a 400', async () => {
    stubFetch({ ok: false, status: 400, body: { error: 'Message too long' } });
    await expect(postMessage('sess', 'x')).rejects.toThrow('Message too long');
  });

  it('falls back when a 400 body is not an error envelope', async () => {
    stubFetch({ ok: false, status: 400, body: {} });
    await expect(postMessage('sess', 'x')).rejects.toThrow('Could not post your message');
  });

  it('throws on a non-400 non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(postMessage('sess', 'x')).rejects.toThrow('Could not post your message');
  });
});

const contactMessage = {
  id: 'c1',
  name: 'Ada',
  text: 'Hello from Ada',
  createdAt: '2026-08-28T12:00:00.000Z',
};

describe('postContact', () => {
  it('posts the text and returns the validated message', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: contactMessage });
    await expect(postContact('sess', 'Hello from Ada')).resolves.toEqual(contactMessage);
    expect(fetchMock).toHaveBeenCalledWith('/contact/submit', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer sess',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: 'Hello from Ada' }),
    });
  });

  it('throws the api error message on a 400', async () => {
    stubFetch({ ok: false, status: 400, body: { error: 'Message too long' } });
    await expect(postContact('sess', 'x')).rejects.toThrow('Message too long');
  });

  it('falls back when a 400 body is not an error envelope', async () => {
    stubFetch({ ok: false, status: 400, body: {} });
    await expect(postContact('sess', 'x')).rejects.toThrow('Could not send your message');
  });

  it('throws on a non-400 non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(postContact('sess', 'x')).rejects.toThrow('Could not send your message');
  });
});

const passkeyAccount = { ...account, linkingKey: null };
const passkeyBegin = { challengeId: 'ch'.repeat(16), options: { challenge: 'aa' } };
const passkeySession = { token: 'tok', account: passkeyAccount };

describe('startPasskeyRegistration', () => {
  it('returns the validated begin payload', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: passkeyBegin });
    await expect(startPasskeyRegistration()).resolves.toEqual(passkeyBegin);
    expect(fetchMock).toHaveBeenCalledWith('/auth/passkey/register/begin', { method: 'POST' });
  });

  it('throws on a non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(startPasskeyRegistration()).rejects.toThrow(
      'Failed to start passkey registration: 500',
    );
  });
});

describe('finishPasskeyRegistration', () => {
  it('posts the credential and returns a session', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: passkeySession });
    await expect(finishPasskeyRegistration('ch', { id: 'cred' })).resolves.toEqual(passkeySession);
    expect(fetchMock).toHaveBeenCalledWith('/auth/passkey/register/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: 'ch', credential: { id: 'cred' } }),
    });
  });

  it('throws on a non-ok response', async () => {
    stubFetch({ ok: false, status: 400, body: {} });
    await expect(finishPasskeyRegistration('ch', {})).rejects.toThrow(
      'Failed to finish passkey registration: 400',
    );
  });
});

describe('startPasskeyAuthentication', () => {
  it('returns the validated begin payload', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: passkeyBegin });
    await expect(startPasskeyAuthentication()).resolves.toEqual(passkeyBegin);
    expect(fetchMock).toHaveBeenCalledWith('/auth/passkey/authenticate/begin', { method: 'POST' });
  });

  it('throws on a non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(startPasskeyAuthentication()).rejects.toThrow(
      'Failed to start passkey authentication: 500',
    );
  });
});

describe('finishPasskeyAuthentication', () => {
  it('posts the credential and returns a session', async () => {
    stubFetch({ ok: true, status: 200, body: passkeySession });
    await expect(finishPasskeyAuthentication('ch', { id: 'cred' })).resolves.toEqual(
      passkeySession,
    );
  });

  it('throws on a non-ok response', async () => {
    stubFetch({ ok: false, status: 400, body: {} });
    await expect(finishPasskeyAuthentication('ch', {})).rejects.toThrow(
      'Failed to finish passkey authentication: 400',
    );
  });
});
