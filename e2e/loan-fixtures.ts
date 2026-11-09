import type { Page } from '@playwright/test';
import type { MyLoan, MyLoans, RepaymentDue, RepaymentLedger } from '../src/lib/api';

const createdAt = '2026-09-25T10:00:00.000Z';
const fundedAt = '2026-09-26T10:00:00.000Z';

/** The BTC loan used by repayment-screen and loans-card browser tests. */
export const loanA: MyLoan = {
  messageId: 'loan-a',
  text: 'I need a small loan to buy a second-hand sewing machine for my repair stall.',
  createdAt,
  goalSats: 30_000,
  sats: 30_000,
  goalCurrency: 'BTC',
  goalAmount: '30000',
  goalAmountUsd: null,
  goalAmountChf: null,
  goalAmountEur: null,
  goalAmountPhp: null,
  amountUsd: null,
  amountChf: null,
  amountEur: null,
  amountPhp: null,
  termDays: 30,
  fundedAt,
  daysDue: 12,
  daysPaid: 11,
  repaidSats: 11_000,
  totalSats: 30_000,
  due: {
    payableSats: 1_000,
    payablePeople: 3,
    waitingSats: 0,
    waitingPeople: 0,
    behindDays: 0,
    payableAmount: null,
    waitingAmount: null,
    lastPayment: false,
  },
  next: { dueOn: '2026-10-08', sats: 1_000, amount: null },
};

/** The PHP-denominated loan used by repayment-screen and loans-card browser tests. */
export const loanB: MyLoan = {
  messageId: 'loan-b',
  text: 'Small loan for school books for my daughter. Paid back daily over 10 days.',
  createdAt,
  goalSats: 12_000,
  sats: 12_000,
  goalCurrency: 'PHP',
  goalAmount: '300.00',
  goalAmountUsd: null,
  goalAmountChf: null,
  goalAmountEur: null,
  goalAmountPhp: '300.00',
  amountUsd: null,
  amountChf: null,
  amountEur: null,
  amountPhp: '300.00',
  termDays: 10,
  fundedAt,
  daysDue: 5,
  daysPaid: 4,
  repaidSats: 4_800,
  totalSats: 12_000,
  due: {
    payableSats: 1_200,
    payablePeople: 2,
    waitingSats: 0,
    waitingPeople: 0,
    behindDays: 0,
    payableAmount: '30.00',
    waitingAmount: null,
    lastPayment: false,
  },
  next: { dueOn: '2026-10-08', sats: 1_200, amount: '30.00' },
};

type LedgerRow = RepaymentLedger['repayments'][number];

function btcRow(
  dayIndex: number,
  dueOn: string,
  accountId: string,
  name: string,
  sats: number,
  status: LedgerRow['status'] = 'due',
): LedgerRow {
  return {
    dayIndex,
    dueOn,
    accountId,
    name,
    username: name.toLowerCase(),
    amount: null,
    sats,
    dueSats: status === 'due' ? sats : null,
    status,
    via: 'lightning',
  };
}

function btcDayRows(dayIndex: number, dueOn: string, status: LedgerRow['status']): LedgerRow[] {
  return [
    btcRow(dayIndex, dueOn, 'acc_bruno', 'Bruno', 500, status),
    btcRow(dayIndex, dueOn, 'acc_carla', 'Carla', 300, status),
    btcRow(dayIndex, dueOn, 'acc_diego', 'Diego', 200, status),
  ];
}

/** Public repayment ledger for {@link loanA}. */
export const ledgerA: RepaymentLedger = {
  currency: 'BTC',
  fundedAt,
  termDays: 30,
  daysDue: 12,
  daysPaid: 11,
  unassignedSats: 0,
  givers: [
    {
      accountId: 'acc_bruno',
      name: 'Bruno',
      username: 'bruno',
      givenSats: 15_000,
      givenAmount: null,
      canReceive: true,
    },
    {
      accountId: 'acc_carla',
      name: 'Carla',
      username: 'carla',
      givenSats: 9_000,
      givenAmount: null,
      canReceive: true,
    },
    {
      accountId: 'acc_diego',
      name: 'Diego',
      username: 'diego',
      givenSats: 6_000,
      givenAmount: null,
      canReceive: true,
    },
  ],
  repayments: [
    ...Array.from({ length: 11 }, (_, dayIndex) =>
      btcDayRows(
        dayIndex,
        dayIndex === 9 ? '2026-10-05' : dayIndex === 10 ? '2026-10-06' : '2026-10-01',
        'paid',
      ),
    ).flat(),
    ...btcDayRows(11, '2026-10-07', 'due'),
    ...Array.from({ length: 18 }, (_, offset) =>
      btcDayRows(12 + offset, offset === 0 ? '2026-10-08' : '2026-10-09', 'scheduled'),
    ).flat(),
  ],
  next: { dayIndex: 12, sats: 500, recipientAccountId: 'acc_bruno' },
};

/** Public repayment ledger for {@link loanB}. */
export const ledgerB: RepaymentLedger = {
  currency: 'PHP',
  fundedAt,
  termDays: 10,
  daysDue: 5,
  daysPaid: 4,
  unassignedSats: 0,
  givers: [
    {
      accountId: 'acc_elena',
      name: 'Elena',
      username: 'elena',
      givenSats: 7_200,
      givenAmount: '180.00',
      canReceive: true,
    },
    {
      accountId: 'acc_farid',
      name: 'Farid',
      username: 'farid',
      givenSats: 4_800,
      givenAmount: '120.00',
      canReceive: true,
    },
  ],
  repayments: Array.from({ length: 10 }, (_, dayIndex) => {
    const status: LedgerRow['status'] =
      dayIndex < 4 ? 'paid' : dayIndex === 4 ? 'due' : 'scheduled';
    const dueOn = dayIndex === 4 ? '2026-10-07' : dayIndex === 5 ? '2026-10-08' : '2026-10-01';
    return [
      {
        ...btcRow(dayIndex, dueOn, 'acc_elena', 'Elena', 720, status),
        amount: '18.00',
      },
      {
        ...btcRow(dayIndex, dueOn, 'acc_farid', 'Farid', 480, status),
        amount: '12.00',
      },
    ];
  }).flat(),
  next: { dayIndex: 5, sats: 720, recipientAccountId: 'acc_elena' },
};

/** POST repayment body for the payable shares of {@link loanA}. */
export const repaymentDueA: RepaymentDue = {
  bills: [
    {
      dayIndex: 11,
      recipientAccountId: 'acc_bruno',
      name: 'Bruno',
      username: 'bruno',
      amountSats: 500,
      amount: null,
      pr: 'lnbc500nbruno',
      sparkInvoice: 'spark-bruno',
    },
    {
      dayIndex: 11,
      recipientAccountId: 'acc_carla',
      name: 'Carla',
      username: 'carla',
      amountSats: 300,
      amount: null,
      pr: 'lnbc300ncarla',
      sparkInvoice: 'spark-carla',
    },
    {
      dayIndex: 11,
      recipientAccountId: 'acc_diego',
      name: 'Diego',
      username: 'diego',
      amountSats: 200,
      amount: null,
      pr: 'lnbc200ndiego',
      sparkInvoice: 'spark-diego',
    },
  ],
  waiting: [],
};

/** POST repayment body for the payable shares of {@link loanB}. */
export const repaymentDueB: RepaymentDue = {
  bills: [
    {
      dayIndex: 4,
      recipientAccountId: 'acc_elena',
      name: 'Elena',
      username: 'elena',
      amountSats: 720,
      amount: '18.00',
      pr: 'lnbc720nelena',
      sparkInvoice: 'spark-elena',
    },
    {
      dayIndex: 4,
      recipientAccountId: 'acc_farid',
      name: 'Farid',
      username: 'farid',
      amountSats: 480,
      amount: '12.00',
      pr: 'lnbc480nfarid',
      sparkInvoice: 'spark-farid',
    },
  ],
  waiting: [],
};

/** A `/me/loans` body containing the supplied loan rows. */
export function myLoans(loans: readonly MyLoan[], sundayRest = false): MyLoans {
  return { sundayRest, loans: [...loans] };
}

/** A loan copy with selected top-level and due-state changes. */
export function loanWith(
  source: MyLoan,
  changes: Omit<Partial<MyLoan>, 'due'> & { due?: Partial<MyLoan['due']> },
): MyLoan {
  return {
    ...source,
    ...changes,
    due: { ...source.due, ...changes.due },
  };
}

/** A ledger copy with selected top-level changes. */
export function ledgerWith(
  source: RepaymentLedger,
  changes: Partial<RepaymentLedger>,
): RepaymentLedger {
  return { ...source, ...changes };
}

/** Fulfils the browser's authenticated `GET /me/loans` read. */
export async function fulfillMyLoans(page: Page, body: MyLoans): Promise<void> {
  await page.route('**/me/loans', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

/** Fulfils the public `GET /messages/:id/repayment` ledger read. */
export async function fulfillLedger(page: Page, id: string, body: RepaymentLedger): Promise<void> {
  await page.route(`**/messages/${id}/repayment`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

/** Fulfils the authenticated `POST /messages/:id/repayment/due` bill read. */
export async function fulfillRepaymentDue(
  page: Page,
  id: string,
  body: RepaymentDue,
): Promise<void> {
  await page.route(`**/messages/${id}/repayment/due`, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}
