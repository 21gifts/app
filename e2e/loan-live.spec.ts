import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';

/**
 * Live credit on the staging screens. The default Playwright run ignores this
 * file. The harness asks the repayment-due route for Spark invoices and pays
 * each one through the local control service.
 */

const CONTROL = 'http://127.0.0.1:3997';
const APP = 'http://127.0.0.1:3010';
const GAP_MS = 11_000;
const INVOICE_BATCH = 18;
const CLOCK = '2026-01-07T12:00:00.000Z';

type Member = {
  role: string;
  username: string;
  token: string;
};

type Giver = Member & {
  php: string;
  sats: number;
};

type LoanUi = {
  controlToken: string;
  goalAmount: string;
  termDays: number;
  text: string;
  borrower: Member;
  givers: Giver[];
};

type LedgerNext = {
  dayIndex: number;
  recipientAccountId: string;
  sats: number;
} | null;

type Ledger = {
  daysPaid: number;
  termDays: number;
  next: LedgerNext;
  givers: { username: string | null; givenSats: number; givenAmount: string | null }[];
  repayments: {
    dayIndex: number;
    accountId: string;
    username: string | null;
    status: string;
    sats: number | null;
  }[];
};

const TERM_DAYS = 4;
const GOAL_PHP = '0.30';
const GOAL_SATS = 30;
const SHARE_COUNT = TERM_DAYS * 3;

const GIVER_PAIRS = [
  { php: '0.20', sats: 20 },
  { php: '0.08', sats: 8 },
  { php: '0.04', sats: 4 },
];

function readUi(): LoanUi {
  const dir = process.env['LOAN_E2E_DIR'] ?? '';
  if (dir === '') {
    throw new Error('LOAN_E2E_DIR is required');
  }
  const parsed = JSON.parse(fs.readFileSync(path.join(dir, 'ui.json'), 'utf8')) as LoanUi;
  const names = new Set(parsed.givers.map((giver) => giver.username));
  const pairs = parsed.givers
    .map((giver) => `${giver.php}/${giver.sats}`)
    .sort()
    .join(',');
  const expected = GIVER_PAIRS.map((giver) => `${giver.php}/${giver.sats}`)
    .sort()
    .join(',');
  if (
    parsed.goalAmount !== GOAL_PHP ||
    parsed.termDays !== TERM_DAYS ||
    parsed.givers.length !== 3 ||
    names.size !== 3 ||
    names.has(parsed.borrower.username) ||
    pairs !== expected
  ) {
    throw new Error('loan ui file has the wrong shape');
  }
  return parsed;
}

function bearer(ui: LoanUi): { authorization: string } {
  return { authorization: `Bearer ${ui.controlToken}` };
}

async function control(
  request: APIRequestContext,
  ui: LoanUi,
  pathname: '/health' | '/message' | '/pay' | '/backdate' | '/restart',
  data?: Record<string, unknown>,
): Promise<void> {
  const response = await request.fetch(`${CONTROL}${pathname}`, {
    method: pathname === '/health' ? 'GET' : 'POST',
    headers: bearer(ui),
    ...(data === undefined ? {} : { data }),
    timeout:
      pathname === '/pay' || pathname === '/restart'
        ? 300_000
        : pathname === '/message'
          ? 60_000
          : 30_000,
  });
  if (response.status() !== 204 && !(pathname === '/health' && response.status() === 200)) {
    throw new Error(`${pathname} returned ${response.status()}`);
  }
}

async function openMember(browser: Browser, member: Member, pathname: string): Promise<Page> {
  const context = await browser.newContext({
    baseURL: APP,
    locale: 'en-US',
    timezoneId: 'UTC',
    extraHTTPHeaders: { 'Accept-Language': 'en' },
  });
  await context.addCookies([{ name: 'fiat', value: 'PHP', url: APP }]);
  await context.addInitScript(
    ({ token, clock }) => {
      localStorage.setItem('21gifts.session', token);
      sessionStorage.setItem('e2e-now', clock);
      document.cookie = 'fiat=PHP; Path=/; Max-Age=31536000; SameSite=Lax';
    },
    { token: member.token, clock: CLOCK },
  );
  const page = await context.newPage();
  const spot = page
    .waitForResponse((response) => response.url().includes('/fx/spot') && response.ok(), {
      timeout: 30_000,
    })
    .catch(() => undefined);
  await page.goto(pathname);
  await spot;
  const introduce = page.getByRole('dialog', { name: 'Introduce yourself' });
  if (await introduce.isVisible().catch(() => false)) {
    await introduce.getByRole('button', { name: 'Close' }).click();
  }
  return page;
}

async function choosePhp(page: Page): Promise<void> {
  const php = page
    .getByRole('group', { name: 'Bitcoin or fiat' })
    .getByRole('button', { name: 'PHP' });
  await expect(php).toBeEnabled();
  await php.click();
  await expect(php).toHaveAttribute('aria-pressed', 'true');
}

async function readLedger(page: Page, messageId: string): Promise<Ledger> {
  const response = await page.request.get(`/messages/${messageId}/repayment`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Ledger;
}

async function waitGap(since: number): Promise<void> {
  const wait = GAP_MS - (Date.now() - since);
  if (wait > 0) {
    await new Promise((resolve) => {
      setTimeout(resolve, wait);
    });
  }
}

async function createCredit(page: Page, ui: LoanUi): Promise<string> {
  await page.getByRole('button', { name: 'Write a post' }).click();
  await expect(page.locator('[data-writing-composer]')).toBeVisible();
  await page.getByRole('button', { name: 'Ask for money' }).click();
  await page.getByRole('button', { name: 'Credit' }).click();
  await choosePhp(page);
  await page.getByLabel('Ask').fill(ui.goalAmount);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Custom' }).click();
  await page.getByLabel('Number of days').fill(String(ui.termDays));
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'I want to take this credit.' }).click();
  await page.getByRole('button', { name: 'I can repay this.' }).click();
  await expect(page.getByText('Add photos', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Write a message', { exact: true })).toBeVisible();
  await page.getByLabel('Your message').fill(ui.text);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible();
  const posted = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().includes('/forum/messages'),
  );
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  const response = await posted;
  expect(response.ok()).toBeTruthy();
  const sent = response.request().postDataJSON() as {
    goalCurrency?: string;
    goalAmount?: string;
    goalRepayable?: boolean;
    goalTermDays?: number;
  };
  expect(sent.goalCurrency).toBe('PHP');
  expect(sent.goalAmount).toBe(GOAL_PHP);
  expect(sent.goalRepayable).toBe(true);
  expect(sent.goalTermDays).toBe(TERM_DAYS);
  const created = (await response.json()) as { id?: string; goalSats?: number };
  if (typeof created.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(created.id)) {
    throw new Error('credit response has no id');
  }
  if (created.goalSats !== GOAL_SATS) {
    throw new Error(`credit goal is not ${GOAL_SATS} sats`);
  }
  return created.id;
}

async function give(page: Page, giver: Giver, messageId: string, ui: LoanUi): Promise<void> {
  // A gift posted before the note has a signed event is refused. The composer
  // still accepts the click, so wait for the public note before posting.
  await expect
    .poll(
      async () => {
        const note = await page.request.get(`/public-messages/${messageId}`);
        if (!note.ok()) {
          return false;
        }
        const body = (await note.json()) as { payable?: boolean };
        return body.payable === true;
      },
      { timeout: 30_000, intervals: [500] },
    )
    .toBe(true);
  const amount = page.locator('#forum-reply-amount');
  await expect(amount).toBeEnabled();
  await choosePhp(page);
  await amount.fill(giver.php);
  const form = page.locator('form').filter({ has: amount });
  const minted = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/invoice'),
  );
  await form.getByRole('button', { name: 'Post' }).click();
  const response = await minted;
  expect(response.ok()).toBeTruthy();
  const sent = response.request().postDataJSON() as { sats?: number };
  const body = (await response.json()) as { amountSats?: number; sparkInvoice?: string | null };
  if (sent.sats !== giver.sats || body.amountSats !== giver.sats) {
    throw new Error(`gift for ${giver.username} minted ${body.amountSats ?? 0} sats`);
  }
  if (typeof body.sparkInvoice !== 'string' || body.sparkInvoice === '') {
    throw new Error(`gift for ${giver.username} has no spark invoice`);
  }
  await control(page.request, ui, '/pay', { invoice: body.sparkInvoice, role: giver.role });
  await expect
    .poll(
      async () => {
        const ledger = await readLedger(page, messageId);
        return ledger.givers.find((row) => row.username === giver.username)?.givenSats ?? 0;
      },
      { timeout: 180_000, intervals: [2_000] },
    )
    .toBeGreaterThanOrEqual(giver.sats);
}

async function repayAll(page: Page, messageId: string, ui: LoanUi): Promise<void> {
  let posts = 0;
  let since = 0;
  let stalled = 0;
  for (;;) {
    const ledger = await readLedger(page, messageId);
    if (ledger.next === null && ledger.daysPaid === TERM_DAYS) {
      return;
    }
    if (ledger.next === null) {
      stalled += 1;
      if (stalled > 5) {
        throw new Error(`repayment stopped at ${ledger.daysPaid} of ${TERM_DAYS} days`);
      }
      await page.waitForTimeout(2_000);
      continue;
    }
    await waitGap(since);
    if (posts >= INVOICE_BATCH) {
      await control(page.request, ui, '/restart');
      posts = 0;
      await page.reload();
    }
    const response = await page.request.post(`/messages/${messageId}/repayment/due`, {
      headers: { Authorization: `Bearer ${ui.borrower.token}` },
      timeout: 60_000,
    });
    since = Date.now();
    if (response.status() === 429) {
      await control(page.request, ui, '/restart');
      posts = 0;
      await page.reload();
      continue;
    }
    if (!response.ok()) {
      throw new Error(`repayment returned ${response.status()}`);
    }
    const body = (await response.json()) as {
      bills?: {
        dayIndex: number;
        recipientAccountId: string;
        sparkInvoice?: string | null;
      }[];
    };
    const bills = body.bills ?? [];
    if (bills.length === 0) {
      stalled += 1;
      if (stalled > 5) {
        throw new Error(`repayment returned no bills at day ${ledger.next.dayIndex}`);
      }
      continue;
    }
    stalled = 0;
    for (const bill of bills) {
      if (typeof bill.sparkInvoice !== 'string' || bill.sparkInvoice === '') {
        throw new Error('repayment bill has no spark invoice');
      }
      await control(page.request, ui, '/pay', {
        invoice: bill.sparkInvoice,
        role: 'borrower',
        mode: 'repay',
        recipientAccountId: bill.recipientAccountId,
      });
    }
    await expect
      .poll(
        async () => {
          const updated = await readLedger(page, messageId);
          return bills.every((bill) =>
            updated.repayments.some(
              (row) =>
                row.dayIndex === bill.dayIndex &&
                row.accountId === bill.recipientAccountId &&
                row.status === 'paid',
            ),
          );
        },
        { timeout: 180_000, intervals: [2_000] },
      )
      .toBe(true);
    posts += bills.length;
    process.stdout.write(`day ${bills[0]?.dayIndex ?? ledger.next.dayIndex} paid\n`);
  }
}

test('a borrower takes a credit, three people give, and every share is paid back', async ({
  browser,
  request,
}) => {
  const ui = readUi();
  await control(request, ui, '/health');
  const borrower = await openMember(browser, ui.borrower, '/welcome');
  const messageId = await createCredit(borrower, ui);
  await control(request, ui, '/message', { id: messageId });
  await borrower.context().close();

  for (const giver of ui.givers) {
    const page = await openMember(browser, giver, `/messages/${messageId}`);
    await give(page, giver, messageId, ui);
    await page.context().close();
  }
  await control(request, ui, '/backdate');
  await control(request, ui, '/restart');

  const home = await openMember(browser, ui.borrower, '/welcome');
  await repayAll(home, messageId, ui);
  await home.getByRole('button', { name: 'Who gave and who is paid back' }).click();
  const paidBack = home.getByRole('region', { name: 'Paid back' });
  await expect(paidBack.getByText('Paid', { exact: true })).toHaveCount(SHARE_COUNT);
  const ledger = await readLedger(home, messageId);
  expect(ledger.daysPaid).toBe(TERM_DAYS);
  expect(ledger.termDays).toBe(TERM_DAYS);
  const given = home.getByRole('region', { name: 'Given' });
  for (const giver of ui.givers) {
    await expect(given.getByText(`@${giver.username}`)).toBeVisible();
    const row = ledger.givers.find((item) => item.username === giver.username);
    expect(row?.givenSats).toBe(giver.sats);
    expect(row?.givenAmount).toBe(giver.php);
    const paid = ledger.repayments.filter(
      (line) =>
        line.username === giver.username &&
        line.status === 'paid' &&
        line.sats === giver.sats / TERM_DAYS,
    );
    expect(paid).toHaveLength(TERM_DAYS);
  }
  await expect(home.getByRole('link', { name: 'Repay your loan' })).toBeVisible();
  await home.goto('/loans/repay');
  const nothingDue = home.getByText('Nothing due today');
  const heading = home.getByRole('heading', { name: 'Loan repayment' });
  if (await nothingDue.isVisible().catch(() => false)) {
    await expect(nothingDue).toBeVisible();
  } else {
    await expect(heading).toBeAttached();
  }
});
