// @vitest-environment node
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { lookupAccountByUsername, searchMentionAccounts } from '@/lib/mention-search';

interface FakeResponse {
  ok: boolean;
  status: number;
  body: unknown;
}

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

describe('searchMentionAccounts', () => {
  it('omits q for the first page and sends a prefix', async () => {
    const fetchMock = stubFetch({
      ok: true,
      status: 200,
      body: { accounts: [{ id: 'acc-ada', username: 'ada', name: 'Ada' }] },
    });
    await expect(searchMentionAccounts('sess', '')).resolves.toEqual([
      { id: 'acc-ada', username: 'ada', name: 'Ada' },
    ]);
    expect(fetchMock).toHaveBeenCalledWith('/forum/mentions', {
      headers: { Authorization: 'Bearer sess' },
    });
    const prefix = stubFetch({
      ok: true,
      status: 200,
      body: { accounts: [] },
    });
    await expect(searchMentionAccounts('sess', 'a b')).resolves.toEqual([]);
    expect(prefix).toHaveBeenCalledWith('/forum/mentions?q=a%20b', {
      headers: { Authorization: 'Bearer sess' },
    });
  });

  it('throws when the search fails or the body is not a list', async () => {
    stubFetch({ ok: false, status: 401, body: {} });
    await expect(searchMentionAccounts('sess', '')).rejects.toThrow(
      'Failed to search mentions: 401',
    );
    stubFetch({ ok: true, status: 200, body: {} });
    await expect(searchMentionAccounts('sess', 'ada')).rejects.toThrow();
  });
});

describe('lookupAccountByUsername', () => {
  it('returns found for a 200 account and encodes the username', async () => {
    const fetchMock = stubFetch({
      ok: true,
      status: 200,
      body: { id: 'acc-ada', username: 'Ada', name: 'Ada', extra: true },
    });
    await expect(lookupAccountByUsername('sess', 'a/b')).resolves.toBe('found');
    expect(fetchMock).toHaveBeenCalledWith('/forum/accounts/by-username/a%2Fb', {
      headers: { Authorization: 'Bearer sess' },
    });
  });

  it('returns missing on 404 without reading the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.reject(new Error('should not parse')),
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(lookupAccountByUsername('sess', 'missing')).resolves.toBe('missing');
  });

  it('throws on 500, on a 200 body without name, and when fetch rejects', async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    await expect(lookupAccountByUsername('sess', 'ada')).rejects.toThrow(
      'Failed to look up account: 500',
    );
    stubFetch({ ok: true, status: 200, body: { id: 'acc-ada', username: 'ada' } });
    await expect(lookupAccountByUsername('sess', 'ada')).rejects.toThrow();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(lookupAccountByUsername('sess', 'ada')).rejects.toThrow('offline');
  });
});
