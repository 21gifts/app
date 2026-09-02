// @vitest-environment node
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import {
  deletePushSubscription,
  dismissForumLaws,
  fetchConversation,
  fetchConversations,
  fetchGiftDay,
  fetchGiftStats,
  fetchMe,
  fetchMember,
  fetchMessagePhoto,
  fetchMessages,
  fetchPublicMessage,
  fetchPublicMessagePhoto,
  fetchReplies,
  fetchVapidPublicKey,
  fetchViewProfile,
  finishPasskeyAuthentication,
  finishPasskeyRegistration,
  LIGHTNING_ADDRESS_NOT_ZAP_ERROR,
  openConversation,
  postContact,
  postConversationMessage,
  postMessage,
  postMessageInvoice,
  postMessageVideo,
  postPushSubscription,
  agreeToRules,
  setLightningAddress,
  setName,
  skipSetup,
  resolveLightningAddress,
  startPasskeyAuthentication,
  startPasskeyRegistration,
  unlinkLightningAddress,
} from '@/lib/api';
import { MissingRequirementsError } from '@/lib/missing-requirements';

const account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis' as const,
  name: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: null,
  viewKey: 'a'.repeat(64),
  setup: 'name' as const,
  missing: ['name', 'lightning-address', 'rules'] as const,
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

describe('fetchViewProfile', () => {
  const viewKey = 'a'.repeat(64);
  const profile = {
    name: 'Ada',
    lightningAddress: 'alice@walletofsatoshi.com',
    lightningAddressVerified: false,
    createdAt: 1,
    hasPasskey: false,
  };

  it('returns the validated profile and hits the same-origin proxy path', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: profile });
    await expect(fetchViewProfile(viewKey)).resolves.toEqual(profile);
    expect(fetchMock).toHaveBeenCalledWith(`/view-key/${encodeURIComponent(viewKey)}`);
  });

  it('returns null on 404', async () => {
    stubFetch({ ok: false, status: 404, body: { error: 'Not found' } });
    await expect(fetchViewProfile(viewKey)).resolves.toBeNull();
  });

  it('throws on a non-404 non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(fetchViewProfile(viewKey)).rejects.toThrow('Failed to fetch view profile: 500');
  });

  it('throws when the body fails validation', async () => {
    stubFetch({ ok: true, status: 200, body: { name: '' } });
    await expect(fetchViewProfile(viewKey)).rejects.toThrow();
  });
});

describe('skipSetup', () => {
  it('posts the step and returns the validated account', async () => {
    const updated = {
      ...account,
      setup: 'lightning-address' as const,
      missing: ['name', 'lightning-address', 'rules'] as const,
    };
    const fetchMock = stubFetch({ ok: true, status: 200, body: updated });
    await expect(skipSetup('sess', 'name')).resolves.toEqual(updated);
    expect(fetchMock).toHaveBeenCalledWith('/me/setup/skip', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer sess',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ step: 'name' }),
    });
  });

  it('throws on a non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(skipSetup('sess', 'name')).rejects.toThrow('Could not skip this step');
  });
});

describe('fetchMember', () => {
  const member = {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Carol',
    role: 'verified' as const,
    lightningAddress: 'carol@walletofsatoshi.com',
    createdAt: '2026-01-15T12:00:00.000Z',
    profileMessage: null,
  };

  it('returns the validated member profile', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: member });
    await expect(fetchMember('sess', member.id)).resolves.toEqual(member);
    expect(fetchMock).toHaveBeenCalledWith(`/forum/members/${encodeURIComponent(member.id)}`, {
      headers: { Authorization: 'Bearer sess' },
    });
  });

  it('returns null on 401 and 404', async () => {
    stubFetch({ ok: false, status: 401, body: {} });
    await expect(fetchMember('sess', member.id)).resolves.toBeNull();
    stubFetch({ ok: false, status: 404, body: {} });
    await expect(fetchMember('sess', member.id)).resolves.toBeNull();
  });

  it('throws visitor copy on a non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(fetchMember('sess', member.id)).rejects.toThrow(
      'Could not load this profile. Please try again.',
    );
  });

  it('throws MissingRequirementsError on 409', async () => {
    stubFetch({
      ok: false,
      status: 409,
      body: { error: 'missing_requirements', missing: ['rules'] },
    });
    await expect(fetchMember('sess', member.id)).rejects.toBeInstanceOf(MissingRequirementsError);
  });

  it('falls back when a 409 body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.reject(new SyntaxError('not json')),
      } as unknown as Response),
    );
    await expect(fetchMember('sess', member.id)).rejects.toThrow(
      'Could not load this profile. Please try again.',
    );
  });

  it('falls back when a 409 body is not missing_requirements', async () => {
    stubFetch({ ok: false, status: 409, body: { error: 'conflict' } });
    await expect(fetchMember('sess', member.id)).rejects.toThrow(
      'Could not load this profile. Please try again.',
    );
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

  it('throws the not-found message when the address could not be resolved', async () => {
    stubFetch({
      ok: false,
      status: 400,
      body: { error: 'Lightning Address could not be resolved' },
    });
    await expect(setLightningAddress('sess', 'you@walletofsatoshi.com')).rejects.toThrow(
      'That Wallet of Satoshi address could not be found',
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

  it('throws the exact not-zap English string without rewriting', async () => {
    stubFetch({
      ok: false,
      status: 400,
      body: { error: LIGHTNING_ADDRESS_NOT_ZAP_ERROR },
    });
    await expect(setLightningAddress('sess', 'nozap@walletofsatoshi.com')).rejects.toThrow(
      LIGHTNING_ADDRESS_NOT_ZAP_ERROR,
    );
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

describe('dismissForumLaws', () => {
  it('posts and returns the validated account', async () => {
    const dismissed = { ...account, forumLawsDismissed: true };
    const fetchMock = stubFetch({ ok: true, status: 200, body: dismissed });

    await expect(dismissForumLaws('sess')).resolves.toEqual(dismissed);
    expect(fetchMock).toHaveBeenCalledWith(`/me/forum-laws-dismissed`, {
      method: 'POST',
      headers: { Authorization: 'Bearer sess' },
    });
  });

  it('throws on a non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(dismissForumLaws('sess')).rejects.toThrow(
      'Could not dismiss the living-room hint',
    );
  });

  it('throws when the body fails validation', async () => {
    stubFetch({ ok: true, status: 200, body: { id: 'acc_1' } });
    await expect(dismissForumLaws('sess')).rejects.toThrow();
  });
});

describe('agreeToRules', () => {
  it('posts agreement and returns the validated account', async () => {
    const agreed = { ...account, rulesAgreedAt: 1_700_000_001 };
    const fetchMock = stubFetch({ ok: true, status: 200, body: agreed });

    await expect(agreeToRules('sess')).resolves.toEqual(agreed);
    expect(fetchMock).toHaveBeenCalledWith(`/me/rules-agreement`, {
      method: 'POST',
      headers: { Authorization: 'Bearer sess' },
    });
  });

  it('throws on a non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(agreeToRules('sess')).rejects.toThrow('Could not save your agreement');
  });

  it('throws when the body fails validation', async () => {
    stubFetch({ ok: true, status: 200, body: { id: 'acc_1' } });
    await expect(agreeToRules('sess')).rejects.toThrow();
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

  it('appends recipient when the handle is non-empty after trim', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: stats });
    await expect(fetchGiftStats('alice')).resolves.toEqual(stats);
    expect(fetchMock).toHaveBeenCalledWith('/gifts/stats?recipient=alice');
  });

  it('trims recipient spaces before appending', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: stats });
    await expect(fetchGiftStats('  alice  ')).resolves.toEqual(stats);
    expect(fetchMock).toHaveBeenCalledWith('/gifts/stats?recipient=alice');
  });

  it('URL-encodes special characters in recipient', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: stats });
    await expect(fetchGiftStats('a b/c')).resolves.toEqual(stats);
    expect(fetchMock).toHaveBeenCalledWith(`/gifts/stats?recipient=${encodeURIComponent('a b/c')}`);
  });

  it('omits recipient when blank after trim', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: stats });
    await expect(fetchGiftStats('   ')).resolves.toEqual(stats);
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
  hasPhoto: false,
  hasVideo: false,
  videoContentType: null,
  role: 'basis' as const,
  replyCount: 0,
};

describe('fetchMessages', () => {
  it('returns the validated messages and sends the bearer header', async () => {
    const forumMessageWithoutRole = {
      id: forumMessage.id,
      name: forumMessage.name,
      text: forumMessage.text,
      createdAt: forumMessage.createdAt,
      sats: forumMessage.sats,
      payable: forumMessage.payable,
      hasPhoto: forumMessage.hasPhoto,
    };
    const fetchMock = stubFetch({
      ok: true,
      status: 200,
      body: { messages: [forumMessageWithoutRole] },
    });
    await expect(fetchMessages('sess')).resolves.toEqual([
      {
        ...forumMessageWithoutRole,
        role: 'basis',
        hasVideo: false,
        videoContentType: null,
        replyCount: 0,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith('/forum/messages', {
      headers: { Authorization: 'Bearer sess' },
    });
  });

  it('throws visitor copy on a non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(fetchMessages('sess')).rejects.toThrow(
      'Could not load messages. Please try again.',
    );
  });

  it('throws MissingRequirementsError on 409', async () => {
    stubFetch({
      ok: false,
      status: 409,
      body: { error: 'missing_requirements', missing: ['name', 'rules'] },
    });
    await expect(fetchMessages('sess')).rejects.toBeInstanceOf(MissingRequirementsError);
  });

  it('falls back when a 409 body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.reject(new SyntaxError('not json')),
      } as unknown as Response),
    );
    await expect(fetchMessages('sess')).rejects.toThrow(
      'Could not load messages. Please try again.',
    );
  });

  it('falls back when a 409 body is not missing_requirements', async () => {
    stubFetch({ ok: false, status: 409, body: { error: 'conflict' } });
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

const parsedForumMessage = {
  ...forumMessage,
  hasVideo: false,
  videoContentType: null,
};

describe('postMessage', () => {
  it('posts the text and returns the validated message', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: forumMessage });
    await expect(postMessage('sess', { text: 'Hello from Ada' })).resolves.toEqual(
      parsedForumMessage,
    );
    expect(fetchMock).toHaveBeenCalledWith('/forum/messages', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer sess',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: 'Hello from Ada' }),
    });
  });

  it('includes inReplyTo when provided', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: forumMessage });
    await postMessage('sess', { text: 'Hello from Ada', inReplyTo: 'parent' });
    expect(fetchMock).toHaveBeenCalledWith('/forum/messages', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer sess',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: 'Hello from Ada', inReplyTo: 'parent' }),
    });
  });

  it('omits inReplyTo when absent', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: forumMessage });
    await postMessage('sess', { text: 'Hello from Ada' });
    expect(JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string)).toEqual({
      text: 'Hello from Ada',
    });
  });

  it('includes a photo payload when provided', async () => {
    const withPhoto = { ...forumMessage, text: '', hasPhoto: true };
    const fetchMock = stubFetch({ ok: true, status: 200, body: withPhoto });
    const photo = { contentType: 'image/jpeg', data: 'abc' };
    await expect(postMessage('sess', { text: '', photo })).resolves.toEqual({
      ...withPhoto,
      hasVideo: false,
      videoContentType: null,
    });
    expect(fetchMock).toHaveBeenCalledWith('/forum/messages', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer sess',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: '', photo }),
    });
  });

  it('posts text together with a photo payload', async () => {
    const withBoth = { ...forumMessage, hasPhoto: true };
    const fetchMock = stubFetch({ ok: true, status: 200, body: withBoth });
    const photo = { contentType: 'image/jpeg', data: 'abc' };
    await expect(postMessage('sess', { text: 'Hello from Ada', photo })).resolves.toEqual({
      ...withBoth,
      hasVideo: false,
      videoContentType: null,
    });
    expect(fetchMock).toHaveBeenCalledWith('/forum/messages', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer sess',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: 'Hello from Ada', photo }),
    });
  });

  it('throws the api error message on a 400', async () => {
    stubFetch({ ok: false, status: 400, body: { error: 'Message too long' } });
    await expect(postMessage('sess', { text: 'x' })).rejects.toThrow('Message too long');
  });

  it('falls back when a 400 body is not an error envelope', async () => {
    stubFetch({ ok: false, status: 400, body: {} });
    await expect(postMessage('sess', { text: 'x' })).rejects.toThrow('Could not post your message');
  });

  it('throws on a non-400 non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(postMessage('sess', { text: 'x' })).rejects.toThrow('Could not post your message');
  });

  it('throws MissingRequirementsError on 409', async () => {
    stubFetch({
      ok: false,
      status: 409,
      body: { error: 'missing_requirements', missing: ['name'] },
    });
    await expect(postMessage('sess', { text: 'x' })).rejects.toBeInstanceOf(
      MissingRequirementsError,
    );
  });

  it('falls back when a 409 body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.reject(new SyntaxError('not json')),
      } as unknown as Response),
    );
    await expect(postMessage('sess', { text: 'x' })).rejects.toThrow('Could not post your message');
  });

  it('falls back when a 409 body is not missing_requirements', async () => {
    stubFetch({ ok: false, status: 409, body: { error: 'conflict' } });
    await expect(postMessage('sess', { text: 'x' })).rejects.toThrow('Could not post your message');
  });
});

describe('postMessageVideo', () => {
  it('posts multipart video and optional poster and returns the validated message', async () => {
    const created = {
      ...forumMessage,
      hasPhoto: true,
      hasVideo: true,
      videoContentType: 'video/mp4' as const,
    };
    const fetchMock = stubFetch({ ok: true, status: 200, body: created });
    const video = new File([new Uint8Array([1, 2, 3])], 'clip.mp4', { type: 'video/mp4' });
    const poster = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    await expect(postMessageVideo('sess', { text: 'clip', video, poster })).resolves.toEqual(
      created,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/forum/messages');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer sess');
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get('text')).toBe('clip');
    expect(form.get('video')).toBe(video);
    expect(form.get('poster')).toBeInstanceOf(Blob);
  });

  it('omits poster when not provided', async () => {
    const created = {
      ...forumMessage,
      hasVideo: true,
      videoContentType: 'video/webm' as const,
    };
    const fetchMock = stubFetch({ ok: true, status: 200, body: created });
    const video = new File([new Uint8Array([1])], 'clip.webm', { type: 'video/webm' });
    await expect(postMessageVideo('sess', { text: 'clip', video })).resolves.toEqual(created);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const form = init.body as FormData;
    expect(form.get('poster')).toBeNull();
  });

  it('throws the api error message on a 400', async () => {
    stubFetch({ ok: false, status: 400, body: { error: 'Video too large' } });
    const video = new File([new Uint8Array([1])], 'clip.mp4', { type: 'video/mp4' });
    await expect(postMessageVideo('sess', { text: 'x', video })).rejects.toThrow('Video too large');
  });

  it('throws the api error message on a 429', async () => {
    stubFetch({ ok: false, status: 429, body: { error: 'Too many messages' } });
    const video = new File([new Uint8Array([1])], 'clip.mp4', { type: 'video/mp4' });
    await expect(postMessageVideo('sess', { text: 'x', video })).rejects.toThrow(
      'Too many messages',
    );
  });

  it('falls back when a 400 body is not an error envelope', async () => {
    stubFetch({ ok: false, status: 400, body: {} });
    const video = new File([new Uint8Array([1])], 'clip.mp4', { type: 'video/mp4' });
    await expect(postMessageVideo('sess', { text: 'x', video })).rejects.toThrow(
      'Could not post your message',
    );
  });

  it('throws on a non-400 non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    const video = new File([new Uint8Array([1])], 'clip.mp4', { type: 'video/mp4' });
    await expect(postMessageVideo('sess', { text: 'x', video })).rejects.toThrow(
      'Could not post your message',
    );
  });

  it('throws MissingRequirementsError on 409', async () => {
    stubFetch({
      ok: false,
      status: 409,
      body: { error: 'missing_requirements', missing: ['rules'] },
    });
    const video = new File([new Uint8Array([1])], 'clip.mp4', { type: 'video/mp4' });
    await expect(postMessageVideo('sess', { text: 'x', video })).rejects.toBeInstanceOf(
      MissingRequirementsError,
    );
  });

  it('falls back when a 409 body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.reject(new SyntaxError('not json')),
      } as unknown as Response),
    );
    const video = new File([new Uint8Array([1])], 'clip.mp4', { type: 'video/mp4' });
    await expect(postMessageVideo('sess', { text: 'x', video })).rejects.toThrow(
      'Could not post your message',
    );
  });

  it('falls back when a 409 body is not missing_requirements', async () => {
    stubFetch({ ok: false, status: 409, body: { error: 'conflict' } });
    const video = new File([new Uint8Array([1])], 'clip.mp4', { type: 'video/mp4' });
    await expect(postMessageVideo('sess', { text: 'x', video })).rejects.toThrow(
      'Could not post your message',
    );
  });
});

describe('fetchMessagePhoto', () => {
  it('returns the blob and sends the bearer header', async () => {
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(blob),
    } as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchMessagePhoto('sess', 'm1')).resolves.toBe(blob);
    expect(fetchMock).toHaveBeenCalledWith('/messages/m1/photo', {
      headers: { Authorization: 'Bearer sess' },
    });
  });

  it('encodes the message id in the path', async () => {
    const blob = new Blob([new Uint8Array([1])], { type: 'image/jpeg' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(blob),
    } as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
    await fetchMessagePhoto('sess', 'a/b');
    expect(fetchMock).toHaveBeenCalledWith('/messages/a%2Fb/photo', {
      headers: { Authorization: 'Bearer sess' },
    });
  });

  it('throws visitor copy on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        blob: () => Promise.resolve(new Blob()),
      } as unknown as Response),
    );
    await expect(fetchMessagePhoto('sess', 'm1')).rejects.toThrow(
      'Could not load messages. Please try again.',
    );
  });

  it('throws visitor copy when the blob is empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(new Blob()),
      } as unknown as Response),
    );
    await expect(fetchMessagePhoto('sess', 'm1')).rejects.toThrow(
      'Could not load messages. Please try again.',
    );
  });

  it('throws visitor copy when fetch itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(fetchMessagePhoto('sess', 'm1')).rejects.toThrow(
      'Could not load messages. Please try again.',
    );
  });
});

describe('fetchPublicMessage', () => {
  it('GETs /public-messages/:id and returns the message', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: forumMessage });
    await expect(fetchPublicMessage('uuid')).resolves.toEqual(forumMessage);
    expect(fetchMock).toHaveBeenCalledWith('/public-messages/uuid');
  });

  it('returns null on 404', async () => {
    stubFetch({ ok: false, status: 404, body: {} });
    await expect(fetchPublicMessage('uuid')).resolves.toBeNull();
  });

  it('throws visitor copy on other non-ok responses', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(fetchPublicMessage('uuid')).rejects.toThrow(
      'Could not load messages. Please try again.',
    );
  });

  it('throws visitor copy when fetch itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(fetchPublicMessage('uuid')).rejects.toThrow(
      'Could not load messages. Please try again.',
    );
  });

  it('throws visitor copy when the body fails validation', async () => {
    stubFetch({ ok: true, status: 200, body: { id: 'm1' } });
    await expect(fetchPublicMessage('uuid')).rejects.toThrow(
      'Could not load messages. Please try again.',
    );
  });
});

describe('fetchPublicMessagePhoto', () => {
  it('returns the blob without Authorization', async () => {
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(blob),
    } as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchPublicMessagePhoto('m1')).resolves.toBe(blob);
    expect(fetchMock).toHaveBeenCalledWith('/messages/m1/photo');
  });

  it('throws visitor copy on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        blob: () => Promise.resolve(new Blob()),
      } as unknown as Response),
    );
    await expect(fetchPublicMessagePhoto('m1')).rejects.toThrow(
      'Could not load messages. Please try again.',
    );
  });

  it('throws visitor copy when the blob is empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(new Blob()),
      } as unknown as Response),
    );
    await expect(fetchPublicMessagePhoto('m1')).rejects.toThrow(
      'Could not load messages. Please try again.',
    );
  });

  it('throws visitor copy when fetch itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(fetchPublicMessagePhoto('m1')).rejects.toThrow(
      'Could not load messages. Please try again.',
    );
  });
});

describe('fetchReplies', () => {
  it('GETs /forum/messages/:id/replies with bearer and parses replies', async () => {
    const fetchMock = stubFetch({
      ok: true,
      status: 200,
      body: { messages: [forumMessage] },
    });
    await expect(fetchReplies('sess', 'parent')).resolves.toEqual([forumMessage]);
    expect(fetchMock).toHaveBeenCalledWith('/forum/messages/parent/replies', {
      headers: { Authorization: 'Bearer sess' },
    });
  });

  it('throws visitor copy on a non-ok response', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(fetchReplies('sess', 'parent')).rejects.toThrow(
      'Could not load messages. Please try again.',
    );
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

  it('throws MissingRequirementsError on 409', async () => {
    stubFetch({
      ok: false,
      status: 409,
      body: { error: 'missing_requirements', missing: ['name'] },
    });
    await expect(postContact('sess', 'x')).rejects.toBeInstanceOf(MissingRequirementsError);
  });

  it('falls back when a 409 body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.reject(new SyntaxError('not json')),
      } as unknown as Response),
    );
    await expect(postContact('sess', 'x')).rejects.toThrow('Could not send your message');
  });

  it('falls back when a 409 body is not missing_requirements', async () => {
    stubFetch({ ok: false, status: 409, body: { error: 'conflict' } });
    await expect(postContact('sess', 'x')).rejects.toThrow('Could not send your message');
  });
});

const conversation = {
  id: 'conv-1',
  name: '21.gifts',
  lastText: 'Hello',
  lastAt: '2026-08-28T12:00:00.000Z',
};

const conversationMessage = {
  id: 'cm1',
  name: 'Ada',
  text: 'Hello',
  createdAt: '2026-08-28T12:00:00.000Z',
};

describe('fetchConversations', () => {
  it('returns the list and sends the bearer header', async () => {
    const fetchMock = stubFetch({
      ok: true,
      status: 200,
      body: { conversations: [conversation] },
    });
    await expect(fetchConversations('sess')).resolves.toEqual([conversation]);
    expect(fetchMock).toHaveBeenCalledWith('/conversations', {
      headers: { Authorization: 'Bearer sess' },
    });
  });

  it('throws visitor copy on a non-ok response', async () => {
    stubFetch({ ok: false, status: 503, body: { error: 'Platform account is not configured' } });
    await expect(fetchConversations('sess')).rejects.toThrow(
      'Could not load messages. Please try again.',
    );
  });
});

describe('fetchConversation', () => {
  it('returns messages and encodes the id', async () => {
    const fetchMock = stubFetch({
      ok: true,
      status: 200,
      body: { messages: [conversationMessage] },
    });
    await expect(fetchConversation('sess', 'a/b')).resolves.toEqual([conversationMessage]);
    expect(fetchMock).toHaveBeenCalledWith('/conversations/a%2Fb', {
      headers: { Authorization: 'Bearer sess' },
    });
  });

  it('throws visitor copy on a non-ok response', async () => {
    stubFetch({ ok: false, status: 404, body: {} });
    await expect(fetchConversation('sess', 'c1')).rejects.toThrow(
      'Could not load messages. Please try again.',
    );
  });
});

describe('postConversationMessage', () => {
  it('posts the text and returns the message', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: conversationMessage });
    await expect(postConversationMessage('sess', 'conv-1', 'Hello')).resolves.toEqual(
      conversationMessage,
    );
    expect(fetchMock).toHaveBeenCalledWith('/conversations/conv-1', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer sess',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: 'Hello' }),
    });
  });

  it('throws the api error on a 400', async () => {
    stubFetch({ ok: false, status: 400, body: { error: 'Text must be 1–500 characters' } });
    await expect(postConversationMessage('sess', 'c1', '')).rejects.toThrow(
      'Text must be 1–500 characters',
    );
  });

  it('falls back when a 400 body is not an error envelope', async () => {
    stubFetch({ ok: false, status: 400, body: {} });
    await expect(postConversationMessage('sess', 'c1', 'x')).rejects.toThrow(
      'Could not send your message',
    );
  });

  it('throws on a non-400 non-ok response', async () => {
    stubFetch({ ok: false, status: 503, body: {} });
    await expect(postConversationMessage('sess', 'c1', 'x')).rejects.toThrow(
      'Could not send your message',
    );
  });
});

describe('openConversation', () => {
  it('posts forumMessageId and returns the thread', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: conversation });
    await expect(openConversation('sess', 'note-1')).resolves.toEqual(conversation);
    expect(fetchMock).toHaveBeenCalledWith('/conversations', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer sess',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ forumMessageId: 'note-1' }),
    });
  });

  it('throws the api error on a 400', async () => {
    stubFetch({ ok: false, status: 400, body: { error: 'Cannot message yourself' } });
    await expect(openConversation('sess', 'note-1')).rejects.toThrow('Cannot message yourself');
  });

  it('falls back when a 400 body is not an error envelope', async () => {
    stubFetch({ ok: false, status: 400, body: {} });
    await expect(openConversation('sess', 'note-1')).rejects.toThrow('Could not send your message');
  });

  it('throws on a non-400 non-ok response', async () => {
    stubFetch({ ok: false, status: 404, body: {} });
    await expect(openConversation('sess', 'note-1')).rejects.toThrow('Could not send your message');
  });
});

describe('fetchVapidPublicKey', () => {
  it('returns the public key and sends the bearer header', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: { publicKey: 'BAAAA' } });
    await expect(fetchVapidPublicKey('sess')).resolves.toBe('BAAAA');
    expect(fetchMock).toHaveBeenCalledWith('/push/vapid-public', {
      headers: { Authorization: 'Bearer sess' },
    });
  });

  it('throws when push is not configured', async () => {
    stubFetch({ ok: false, status: 503, body: { error: 'Push is not configured' } });
    await expect(fetchVapidPublicKey('sess')).rejects.toThrow('Push is not configured');
  });

  it('throws on other non-ok responses', async () => {
    stubFetch({ ok: false, status: 401, body: {} });
    await expect(fetchVapidPublicKey('sess')).rejects.toThrow(
      'Failed to fetch VAPID public key: 401',
    );
  });

  it('throws when the body fails validation', async () => {
    stubFetch({ ok: true, status: 200, body: { publicKey: '' } });
    await expect(fetchVapidPublicKey('sess')).rejects.toThrow();
  });
});

describe('postPushSubscription', () => {
  const sub = {
    endpoint: 'https://push.example/sub',
    keys: { p256dh: 'p256', auth: 'auth' },
  };

  it('posts the subscription and validates the response', async () => {
    const fetchMock = stubFetch({
      ok: true,
      status: 200,
      body: { endpoint: sub.endpoint, createdAt: '2026-08-30T00:00:00.000Z' },
    });
    await expect(postPushSubscription('sess', sub)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/me/push-subscriptions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer sess',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sub),
    });
  });

  it('throws when push is not configured', async () => {
    stubFetch({ ok: false, status: 503, body: { error: 'Push is not configured' } });
    await expect(postPushSubscription('sess', sub)).rejects.toThrow('Push is not configured');
  });

  it('throws the api error message on a 400', async () => {
    stubFetch({ ok: false, status: 400, body: { error: 'Invalid subscription' } });
    await expect(postPushSubscription('sess', sub)).rejects.toThrow('Invalid subscription');
  });

  it('throws a fallback when a 400 body has no error string', async () => {
    stubFetch({ ok: false, status: 400, body: { nope: true } });
    await expect(postPushSubscription('sess', sub)).rejects.toThrow('Invalid subscription');
  });

  it('throws on other non-ok responses', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(postPushSubscription('sess', sub)).rejects.toThrow(
      'Could not save push subscription',
    );
  });
});

describe('deletePushSubscription', () => {
  it('deletes the endpoint', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: { ok: true } });
    await expect(
      deletePushSubscription('sess', 'https://push.example/sub'),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/me/push-subscriptions', {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer sess',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ endpoint: 'https://push.example/sub' }),
    });
  });

  it('treats 404 as success', async () => {
    stubFetch({ ok: false, status: 404, body: { error: 'Not found' } });
    await expect(
      deletePushSubscription('sess', 'https://push.example/sub'),
    ).resolves.toBeUndefined();
  });

  it('throws when push is not configured', async () => {
    stubFetch({ ok: false, status: 503, body: { error: 'Push is not configured' } });
    await expect(deletePushSubscription('sess', 'https://push.example/sub')).rejects.toThrow(
      'Push is not configured',
    );
  });

  it('throws on other non-ok responses', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(deletePushSubscription('sess', 'https://push.example/sub')).rejects.toThrow(
      'Could not remove push subscription',
    );
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

  it('posts JSON viewKey when provided', async () => {
    const viewKey = 'a'.repeat(64);
    const fetchMock = stubFetch({ ok: true, status: 200, body: passkeyBegin });
    await expect(startPasskeyRegistration(viewKey)).resolves.toEqual(passkeyBegin);
    expect(fetchMock).toHaveBeenCalledWith('/auth/passkey/register/begin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewKey }),
    });
  });

  it('throws the body error on 409', async () => {
    stubFetch({
      ok: false,
      status: 409,
      body: { error: 'This profile already has a passkey' },
    });
    await expect(startPasskeyRegistration('a'.repeat(64))).rejects.toThrow(
      'This profile already has a passkey',
    );
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
