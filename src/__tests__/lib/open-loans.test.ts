import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchOpenLoans } from '@/lib/open-loans';

const LOAD_ERROR = 'Could not load open loans. Please try again.';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status });
}

const rows = [
  {
    messageId: 'loan-ben',
    accountId: 'acc/ben',
    name: '',
    currency: 'BTC',
    outstanding: 0,
    overdue: false,
  },
  {
    messageId: 'loan-ada',
    accountId: 'acc_ada',
    name: 'Ada',
    currency: 'CHF',
    outstanding: '12.50',
    overdue: true,
  },
  {
    messageId: 'loan-cara',
    accountId: 'acc_cara',
    name: 'Cara',
    currency: 'PHP',
    outstanding: '10.00',
    overdue: false,
  },
];

function loan(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    messageId: 'loan-ada',
    accountId: 'acc_ada',
    name: 'Ada',
    currency: 'BTC',
    outstanding: 1,
    overdue: false,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchOpenLoans', () => {
  it('keeps api order and sends no authorization header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(rows, 200));
    vi.stubGlobal('fetch', fetchMock);
    const loans = await fetchOpenLoans();
    expect(loans.map((loanRow) => loanRow.messageId)).toEqual([
      'loan-ben',
      'loan-ada',
      'loan-cara',
    ]);
    expect(loans[0]).toMatchObject({ name: '', currency: 'BTC', outstanding: 0, overdue: false });
    expect(loans[1]).toMatchObject({ currency: 'CHF', outstanding: '12.50', overdue: true });
    expect(loans[2]).toMatchObject({ currency: 'PHP', outstanding: '10.00' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/loans/open');
    expect(fetchMock.mock.calls[0]?.[1]).toBeUndefined();
  });

  it('rejects fetch errors, bad status, and a body outside the contract', async () => {
    const offline = new Error('offline');
    const badBodies: unknown[] = [
      [loan({ outstanding: '1500' })],
      [loan({ currency: 'USD', outstanding: 12.5 })],
      [loan({ currency: 'GBP', outstanding: '12.50' })],
      [loan({ outstanding: -1 })],
      { loans: rows },
    ];
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(offline)
      .mockResolvedValueOnce(new Response('nope', { status: 200 }))
      .mockResolvedValueOnce(json({ error: 'Ask amount is unavailable' }, 503));
    for (const body of badBodies) {
      fetchMock.mockResolvedValueOnce(json(body, 200));
    }
    vi.stubGlobal('fetch', fetchMock);

    const thrown = await fetchOpenLoans().catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(Error);
    if (!(thrown instanceof Error)) {
      throw new Error('expected a thrown fetch to reject with Error');
    }
    expect(thrown.message).toBe(LOAD_ERROR);
    expect(thrown.cause).toBe(offline);

    const badJson = await fetchOpenLoans().catch((error: unknown) => error);
    expect(badJson).toBeInstanceOf(Error);
    if (!(badJson instanceof Error)) {
      throw new Error('expected bad json to reject with Error');
    }
    expect(badJson.message).toBe(LOAD_ERROR);
    expect(badJson.cause).toBeInstanceOf(SyntaxError);

    await expect(fetchOpenLoans()).rejects.toThrow(LOAD_ERROR);
    await expect(fetchOpenLoans()).rejects.toThrow(LOAD_ERROR);
    await expect(fetchOpenLoans()).rejects.toThrow(LOAD_ERROR);
    await expect(fetchOpenLoans()).rejects.toThrow(LOAD_ERROR);
    await expect(fetchOpenLoans()).rejects.toThrow(LOAD_ERROR);
    await expect(fetchOpenLoans()).rejects.toThrow(LOAD_ERROR);
  });
});
