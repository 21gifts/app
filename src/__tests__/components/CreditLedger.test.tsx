import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreditLedger } from '@/components/CreditLedger';
import { ForumGoalBar } from '@/components/ForumGoalBar';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function ledger(body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes('/gifts/stats')) {
        return new Response(JSON.stringify({ spendOverTime: [] }), { status: 200 });
      }
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

const btc = {
  currency: 'BTC',
  fundedAt: '2026-09-26T12:00:00.000Z',
  termDays: 2,
  daysDue: 1,
  daysPaid: 0,
  unassignedSats: 3,
  givers: [
    {
      accountId: '11111111-1111-4111-8111-111111111111',
      name: 'Bea',
      username: 'bea',
      givenSats: 20,
      givenAmount: null,
    },
    {
      accountId: '22222222-2222-4222-8222-222222222222',
      name: 'Ada',
      username: null,
      givenSats: 1,
      givenAmount: null,
    },
    {
      accountId: '33333333-3333-4333-8333-333333333333',
      name: '',
      username: 'cara',
      givenSats: 1,
      givenAmount: null,
    },
    {
      accountId: '44444444-4444-4444-8444-444444444444',
      name: '',
      username: null,
      givenSats: 1,
      givenAmount: null,
    },
  ],
  repayments: [
    {
      dayIndex: 0,
      dueOn: '2026-09-27',
      accountId: '11111111-1111-4111-8111-111111111111',
      name: 'Bea',
      username: 'bea',
      amount: null,
      sats: 10,
      status: 'due',
      via: 'lightning',
    },
    {
      dayIndex: 1,
      dueOn: '2026-09-28',
      accountId: '11111111-1111-4111-8111-111111111111',
      name: 'Bea',
      username: 'bea',
      amount: null,
      sats: 10,
      status: 'paid',
      via: 'lightning',
    },
    {
      dayIndex: 1,
      dueOn: '2026-09-28',
      accountId: '22222222-2222-4222-8222-222222222222',
      name: 'Ada',
      username: null,
      amount: null,
      sats: 1,
      status: 'scheduled',
      via: 'lightning',
    },
  ],
  next: null,
};

describe('CreditLedger', () => {
  it('lists givers and each bitcoin repayment', async () => {
    ledger(btc);
    renderWithLocale(<CreditLedger messageId="m1" list="page" />);
    expect((await screen.findAllByText('Bea @bea')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ada').length).toBeGreaterThan(0);
    expect(screen.getAllByText('@cara').length).toBeGreaterThan(0);
    expect(screen.getByText('44444444')).toBeTruthy();
    expect(screen.getByText('Given')).toBeTruthy();
    expect(screen.getByText('Paid back')).toBeTruthy();
    expect(document.body.textContent).toContain('Due');
    expect(document.body.textContent).toContain('Scheduled');
    expect(document.body.textContent).toContain('₿10');
    expect(document.body.textContent).toContain('has no 21.gifts account');
    expect(document.body.textContent).toContain('bitcoin payment');
    const chart = screen.getByRole('img', { name: /Sep 27/ });
    expect(chart.getAttribute('aria-label')).toContain('Sep 28');
    expect(chart.querySelectorAll('[data-testid="repayment-plan-bar"]').length).toBe(2);
    expect(chart.querySelector('[data-testid="repayment-plan-debt"]')).toBeTruthy();
    expect(screen.getByText('Per day')).toBeTruthy();
    expect(screen.getByText('Still owed')).toBeTruthy();
  });

  it('shows a repayment list link and hides the day rows', async () => {
    ledger(btc);
    renderWithLocale(<CreditLedger messageId="m1" />);
    const link = await screen.findByRole('link', { name: 'Repayment list' });
    expect(link.getAttribute('href')).toBe('/messages/m1/repayment-list');
    expect(screen.queryByText('Due')).toBeNull();
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    const stop = vi.spyOn(click, 'stopPropagation');
    fireEvent(link, click);
    expect(stop).toHaveBeenCalled();
  });

  it('reloads a due share and ignores a failed refresh', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    ledger(btc);
    renderWithLocale(<CreditLedger messageId="m1" list="page" />);
    expect((await screen.findAllByText('Bea @bea')).length).toBeGreaterThan(0);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(screen.getByText('Due')).toBeTruthy();
    ledger({
      ...btc,
      repayments: btc.repayments.map((row) =>
        row.status === 'due' ? { ...row, status: 'paid' as const } : row,
      ),
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(screen.getAllByText('Paid').length).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it('applies a due refresh and ignores one after the id changes', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      const named = (name: string, username: string) => {
        const accountId = '55555555-5555-4555-8555-555555555555';
        return {
          ...btc,
          givers: [
            {
              accountId,
              name,
              username,
              givenSats: 20,
              givenAmount: null,
            },
          ],
          repayments: [
            {
              dayIndex: 0,
              dueOn: '2026-09-27',
              accountId,
              name,
              username,
              amount: null,
              sats: 10,
              status: 'due' as const,
              via: 'lightning',
            },
          ],
        };
      };
      ledger(btc);
      const view = renderWithLocale(<CreditLedger messageId="m1" list="page" />);
      expect((await screen.findAllByText('Bea @bea')).length).toBeGreaterThan(0);
      let resolveApplied: (value: Response) => void = () => {};
      const appliedPending = new Promise<Response>((done) => {
        resolveApplied = done;
      });
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo) => {
          const url = String(input);
          if (url.includes('/gifts/stats')) {
            return new Response(JSON.stringify({ spendOverTime: [] }), { status: 200 });
          }
          return appliedPending;
        }),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4000);
      });
      await act(async () => {
        resolveApplied(new Response(JSON.stringify(named('Nia', 'nia')), { status: 200 }));
      });
      expect((await screen.findAllByText('Nia @nia')).length).toBeGreaterThan(0);
      let resolveStale: (value: Response) => void = () => {};
      const stalePending = new Promise<Response>((done) => {
        resolveStale = done;
      });
      let resolveNext: (value: Response) => void = () => {};
      const nextPending = new Promise<Response>((done) => {
        resolveNext = done;
      });
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo) => {
          const url = String(input);
          if (url.includes('/gifts/stats')) {
            return new Response(JSON.stringify({ spendOverTime: [] }), { status: 200 });
          }
          if (url.includes('/messages/m2/')) {
            return nextPending;
          }
          return stalePending;
        }),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4000);
      });
      view.rerender(<CreditLedger messageId="m2" list="page" />);
      expect(screen.queryByText('Nia @nia')).toBeNull();
      expect(screen.queryByText('Due')).toBeNull();
      await act(async () => {
        resolveStale(new Response(JSON.stringify(named('Quinn', 'quinn')), { status: 200 }));
      });
      expect(screen.queryByText('Quinn @quinn')).toBeNull();
      expect(screen.queryByText('Nia @nia')).toBeNull();
      await act(async () => {
        resolveNext(new Response(JSON.stringify(named('Milo', 'milo')), { status: 200 }));
      });
      expect((await screen.findAllByText('Milo @milo')).length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows an open fiat plan and stays blank when the read fails', async () => {
    ledger({
      ...btc,
      currency: 'USD',
      fundedAt: null,
      unassignedSats: 0,
      givers: [
        {
          accountId: '11111111-1111-4111-8111-111111111111',
          name: 'Bea',
          username: 'bea',
          givenSats: 10,
          givenAmount: '0.01',
        },
        {
          accountId: '22222222-2222-4222-8222-222222222222',
          name: 'Ada',
          username: null,
          givenSats: 1,
          givenAmount: null,
        },
      ],
      repayments: [
        {
          dayIndex: 0,
          dueOn: null,
          accountId: '11111111-1111-4111-8111-111111111111',
          name: 'Bea',
          username: 'bea',
          amount: '0.01',
          sats: null,
          status: 'scheduled',
          via: 'lightning',
        },
        {
          dayIndex: 1,
          dueOn: null,
          accountId: '11111111-1111-4111-8111-111111111111',
          name: 'Bea',
          username: 'bea',
          amount: '0.02',
          sats: 4,
          status: 'paid',
          via: 'lightning',
        },
        {
          dayIndex: 2,
          dueOn: null,
          accountId: '11111111-1111-4111-8111-111111111111',
          name: 'Bea',
          username: 'bea',
          amount: null,
          sats: null,
          status: 'scheduled',
          via: 'lightning',
        },
      ],
    });
    renderWithLocale(<CreditLedger messageId="m1" list="page" />);
    expect((await screen.findAllByText(/Day 1/)).length).toBeGreaterThan(0);
    expect(screen.getByText(/The days are fixed/)).toBeTruthy();
    expect(screen.getByText(/rate on the day/)).toBeTruthy();
    expect(screen.queryByText('No one has given yet.')).toBeNull();
    cleanup();
    ledger({
      currency: 'USD',
      fundedAt: null,
      termDays: 1,
      daysDue: 0,
      daysPaid: 0,
      unassignedSats: 0,
      givers: [],
      repayments: [
        {
          dayIndex: 0,
          dueOn: null,
          accountId: '11111111-1111-4111-8111-111111111111',
          name: 'Bea',
          username: 'bea',
          amount: '0.02',
          sats: 4,
          status: 'scheduled',
          via: 'lightning',
        },
      ],
      next: null,
    });
    renderWithLocale(<CreditLedger messageId="m1" list="page" />, 'en', 'ch', 'EUR');
    expect((await screen.findAllByText(/Day 1/)).length).toBeGreaterThan(0);
    cleanup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })));
    renderWithLocale(<ForumGoalBar sats={21000} goalSats={21000} goalRepayable messageId="m1" />);
    await waitFor(() => {
      expect(screen.queryByText('Given')).toBeNull();
    });
  });

  it('ignores a response that arrives after unmount', async () => {
    let resolve: (value: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(
        new Promise<Response>((done) => {
          resolve = done;
        }),
      ),
    );
    const view = renderWithLocale(<CreditLedger messageId="m1" />);
    view.unmount();
    await act(async () => {
      resolve(new Response(JSON.stringify(btc), { status: 200 }));
    });
    expect(screen.queryByText('Given')).toBeNull();
  });

  it('puts the year on the last axis day when the plan crosses a year', async () => {
    ledger({
      ...btc,
      repayments: [
        {
          dayIndex: 0,
          dueOn: '2026-12-31',
          accountId: '11111111-1111-4111-8111-111111111111',
          name: 'Bea',
          username: 'bea',
          amount: null,
          sats: 10,
          status: 'due',
          via: 'lightning',
        },
        {
          dayIndex: 1,
          dueOn: '2027-01-01',
          accountId: '11111111-1111-4111-8111-111111111111',
          name: 'Bea',
          username: 'bea',
          amount: null,
          sats: 11,
          status: 'scheduled',
          via: 'lightning',
        },
      ],
    });
    renderWithLocale(<CreditLedger messageId="m1" />);
    const chart = await screen.findByRole('img', { name: /Dec 31/ });
    expect(chart.textContent).toContain('2027');
  });

  it('draws no chart when every share is zero', async () => {
    ledger({
      ...btc,
      unassignedSats: 0,
      givers: [],
      repayments: [
        {
          dayIndex: 0,
          dueOn: '2026-09-27',
          accountId: '11111111-1111-4111-8111-111111111111',
          name: 'Bea',
          username: 'bea',
          amount: null,
          sats: 0,
          status: 'scheduled',
          via: 'lightning',
        },
      ],
    });
    renderWithLocale(<CreditLedger messageId="m1" />);
    expect(await screen.findByText('Paid back')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('prices the bitcoin chart total in the visitor fiat when a rate exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        if (url.includes('/fx/spot')) {
          return new Response(
            JSON.stringify({
              asOf: '2026-09-26T00:00:00.000Z',
              source: 'test',
              rates: { USD: '100000.00', CHF: '80000.00', EUR: '90000.00', PHP: '5600000.00' },
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify(btc), { status: 200 });
      }),
    );
    renderWithLocale(<CreditLedger messageId="m1" />);
    const chart = await screen.findByRole('img', { name: /Sep 27/ });
    await waitFor(() => {
      expect(chart.textContent).toContain('·');
      expect(chart.textContent).toContain('$0.02');
    });
  });

  it('keeps the feed ledger closed until the visitor asks', async () => {
    ledger(btc);
    renderWithLocale(
      <ForumGoalBar sats={21} goalSats={21} goalRepayable messageId="m1" ledgerCollapsed />,
    );
    const link = await screen.findByRole('link', { name: 'Repayment list' });
    expect(link.getAttribute('href')).toBe('/messages/m1/repayment-list');
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    const stop = vi.spyOn(click, 'stopPropagation');
    fireEvent(link, click);
    expect(stop).toHaveBeenCalled();
    expect(screen.queryByText('Given')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Who gave and who is paid back' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hide givers and repayment' })).toBeNull();
  });

  it('says when nobody has given', async () => {
    ledger({ ...btc, unassignedSats: 0, givers: [], repayments: [] });
    renderWithLocale(<CreditLedger messageId="m1" />);
    expect(await screen.findByText('No one has given yet.')).toBeTruthy();
  });

  it('numbers an open plan even when calendar days are already present', async () => {
    ledger({
      ...btc,
      fundedAt: null,
      repayments: [
        {
          dayIndex: 2,
          dueOn: '2026-09-27',
          accountId: '11111111-1111-4111-8111-111111111111',
          name: 'Bea',
          username: 'bea',
          amount: null,
          sats: 10,
          status: 'scheduled',
          via: 'lightning',
        },
        {
          dayIndex: 4,
          dueOn: '2026-09-29',
          accountId: '11111111-1111-4111-8111-111111111111',
          name: 'Bea',
          username: 'bea',
          amount: null,
          sats: 10,
          status: 'scheduled',
          via: 'lightning',
        },
      ],
    });
    renderWithLocale(<CreditLedger messageId="m1" list="page" />);
    const chart = await screen.findByRole('img', { name: /Day 3/ });
    expect(chart.getAttribute('aria-label')).toContain('Day 5');
    expect(chart.getAttribute('aria-label')).not.toMatch(/Sep/);
    expect(screen.getAllByText('Day 3').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Sep 27/)).toBeNull();
  });

  it('sums a fiat chart in the ask currency and ignores satoshis', async () => {
    ledger({
      ...btc,
      currency: 'USD',
      repayments: [
        {
          dayIndex: 0,
          dueOn: null,
          accountId: '11111111-1111-4111-8111-111111111111',
          name: 'Bea',
          username: 'bea',
          amount: null,
          sats: 50,
          status: 'scheduled',
          via: 'lightning',
        },
        {
          dayIndex: 1,
          dueOn: '2026-09-28',
          accountId: '11111111-1111-4111-8111-111111111111',
          name: 'Bea',
          username: 'bea',
          amount: 'nope',
          sats: 7,
          status: 'scheduled',
          via: 'lightning',
        },
        {
          dayIndex: 2,
          dueOn: '2026-09-29',
          accountId: '11111111-1111-4111-8111-111111111111',
          name: 'Bea',
          username: 'bea',
          amount: '1.50',
          sats: 9,
          status: 'scheduled',
          via: 'lightning',
        },
      ],
    });
    renderWithLocale(<CreditLedger messageId="m1" />);
    const chart = await screen.findByRole('img', { name: /Day 1/ });
    const label = chart.getAttribute('aria-label') ?? '';
    expect(label).toMatch(/\$1\.50 owed/);
    expect(label).toContain('2026');
    expect(label).not.toMatch(/₿|\$5/);
  });

  it('calls an open German plan a Darlehen', async () => {
    ledger({ ...btc, fundedAt: null });
    renderWithLocale(<CreditLedger messageId="m1" />, 'de');
    expect(await screen.findByText(/Darlehen voll gegeben/)).toBeTruthy();
    expect(screen.queryByText(/Kredit/)).toBeNull();
  });
});
