import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreditLedger } from '@/components/CreditLedger';
import { ForumGoalBar } from '@/components/ForumGoalBar';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function ledger(body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })),
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
  it('lists givers and each Lightning repayment', async () => {
    ledger(btc);
    renderWithLocale(<CreditLedger messageId="m1" />);
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
    expect(document.body.textContent).toContain('Lightning');
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
    renderWithLocale(<CreditLedger messageId="m1" />);
    expect(await screen.findByText(/Day 1/)).toBeTruthy();
    expect(screen.getByText(/The days are fixed/)).toBeTruthy();
    expect(screen.getByText(/rate on the day/)).toBeTruthy();
    expect(screen.queryByText('No one has given yet.')).toBeNull();
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

  it('says when nobody has given', async () => {
    ledger({ ...btc, unassignedSats: 0, givers: [], repayments: [] });
    renderWithLocale(<CreditLedger messageId="m1" />);
    expect(await screen.findByText('No one has given yet.')).toBeTruthy();
  });
});
