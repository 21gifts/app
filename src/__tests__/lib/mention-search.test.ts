// @vitest-environment node
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { logInteraction } from '@/lib/interaction-log';
import { searchMentionAccounts } from '@/lib/mention-search';

vi.mock('@/lib/interaction-log', () => ({ logInteraction: vi.fn() }));

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
    expect(logInteraction).not.toHaveBeenCalled();
    const prefix = stubFetch({
      ok: true,
      status: 200,
      body: { accounts: [] },
    });
    await expect(searchMentionAccounts('sess', 'a b')).resolves.toEqual([]);
    expect(logInteraction).toHaveBeenCalledWith('search', { query: 'a b', results: 0 });
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
