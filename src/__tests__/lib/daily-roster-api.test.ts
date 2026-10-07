// @vitest-environment node
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import {
  addDailyRosterRecipient,
  deleteDailyRosterRecipient,
  fetchDailyRoster,
  saveDailyRosterComment,
  saveDailyRosterPayments,
  updateDailyRosterRecipient,
} from '@/lib/api';

const ROSTER = {
  comment: 'Daily gift',
  paymentsEnabled: true,
  defaultAmountUsd: 4,
  recipients: [{ address: 'ada@example.com', amountUsd: 1, accountId: null, name: null }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: { ok: boolean; status: number; body: unknown }): Mock {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: () => Promise.resolve(response.body),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('fetchDailyRoster', () => {
  const loadError = 'Could not load daily payments. Please try again.';

  it('returns the roster and sends the bearer header', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: ROSTER });
    await expect(fetchDailyRoster('sess')).resolves.toEqual(ROSTER);
    expect(fetchMock).toHaveBeenCalledWith('/funding/daily-roster', {
      headers: { Authorization: 'Bearer sess' },
    });
  });

  it('throws visitor copy on 401', async () => {
    stubFetch({ ok: false, status: 401, body: { error: 'Unauthorized' } });
    await expect(fetchDailyRoster('sess')).rejects.toThrow(loadError);
  });

  it('throws the catalog key on 403 Forbidden', async () => {
    stubFetch({ ok: false, status: 403, body: { error: 'Forbidden' } });
    await expect(fetchDailyRoster('sess')).rejects.toThrow('funding.daily.forbidden');
  });

  it('throws visitor copy on 403 with another body', async () => {
    stubFetch({ ok: false, status: 403, body: { error: 'nope' } });
    await expect(fetchDailyRoster('sess')).rejects.toThrow(loadError);
  });

  it('throws visitor copy when fetch itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(fetchDailyRoster('sess')).rejects.toThrow(loadError);
  });

  it('throws visitor copy when the body fails validation', async () => {
    stubFetch({ ok: true, status: 200, body: { comment: 1 } });
    await expect(fetchDailyRoster('sess')).rejects.toThrow(loadError);
  });
});

describe('daily roster saves', () => {
  it('posts each mutation and returns the roster', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, body: ROSTER });
    await expect(saveDailyRosterComment('sess', 'Hello')).resolves.toEqual(ROSTER);
    await expect(saveDailyRosterPayments('sess', false)).resolves.toEqual(ROSTER);
    await expect(addDailyRosterRecipient('sess', 'ada@example.com', 1)).resolves.toEqual(ROSTER);
    await expect(updateDailyRosterRecipient('sess', 'ada@example.com', 2)).resolves.toEqual(ROSTER);
    await expect(deleteDailyRosterRecipient('sess', 'ada@example.com')).resolves.toEqual(ROSTER);
    const bodies = fetchMock.mock.calls.map((call) => {
      const init = call[1] as RequestInit;
      return {
        path: call[0],
        body: init.body,
      };
    });
    expect(bodies).toEqual([
      {
        path: '/funding/daily-roster/comment',
        body: JSON.stringify({ comment: 'Hello' }),
      },
      {
        path: '/funding/daily-roster/payments',
        body: JSON.stringify({ enabled: false }),
      },
      {
        path: '/funding/daily-roster/recipients',
        body: JSON.stringify({ address: 'ada@example.com', amountUsd: 1 }),
      },
      {
        path: '/funding/daily-roster/recipients/update',
        body: JSON.stringify({ address: 'ada@example.com', amountUsd: 2 }),
      },
      {
        path: '/funding/daily-roster/recipients/delete',
        body: JSON.stringify({ address: 'ada@example.com' }),
      },
    ]);
  });

  it.each([
    ['Invalid comment', 'funding.daily.invalidComment'],
    ['Invalid payments switch', 'funding.daily.invalidSwitch'],
    ['Invalid address or amount', 'funding.daily.invalidRow'],
    ['Address already listed', 'funding.daily.duplicate'],
    ['Unknown address', 'funding.daily.unknown'],
    ['Forbidden', 'funding.daily.saveError'],
    ['nope', 'funding.daily.saveError'],
  ] as const)('maps %s to %s', async (apiError, key) => {
    stubFetch({ ok: false, status: 400, body: { error: apiError } });
    await expect(saveDailyRosterComment('sess', 'Hello')).rejects.toThrow(key);
  });

  it('maps a body without an error string to the generic save error', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(saveDailyRosterComment('sess', 'Hello')).rejects.toThrow(
      'funding.daily.saveError',
    );
  });

  it('maps a network failure to the generic save error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(saveDailyRosterPayments('sess', true)).rejects.toThrow('funding.daily.saveError');
  });

  it('maps a success body that is not a roster to the generic save error', async () => {
    stubFetch({ ok: true, status: 200, body: { comment: 1 } });
    await expect(addDailyRosterRecipient('sess', 'ada@example.com', 1)).rejects.toThrow(
      'funding.daily.saveError',
    );
  });
});
