import fs from 'node:fs';
import path from 'node:path';
import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
  type Browser,
  type Page,
} from '@playwright/test';

/**
 * Live credit on the staging screens. The default Playwright run ignores this
 * file. The harness pays each Spark invoice the screen mints; the pay slot
 * itself only sends from an in-app wallet, which these accounts do not use.
 * The term and invoice pacing come from the harness's ui.json.
 */

const CONTROL = 'http://127.0.0.1:3997';
const APP = 'http://127.0.0.1:3010';
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
  invoiceGapMs: number;
  restartEvery: number | null;
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
  repayments: { username: string | null; status: string; sats: number | null }[];
};

const GIVER_PAIRS = [
  { php: '5.50', sats: 550 },
  { php: '2.20', sats: 220 },
  { php: '1.10', sats: 110 },
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
    parsed.goalAmount !== '8.68' ||
    !Number.isInteger(parsed.termDays) ||
    parsed.termDays <= 0 ||
    parsed.givers.length !== 3 ||
    names.size !== 3 ||
    names.has(parsed.borrower.username) ||
    pairs !== expected ||
    !parsed.givers.every((giver) => giver.sats % parsed.termDays === 0) ||
    !Number.isInteger(parsed.invoiceGapMs) ||
    parsed.invoiceGapMs < 0 ||
    parsed.invoiceGapMs > 60_000 ||
    (parsed.restartEvery !== null &&
      (!Number.isInteger(parsed.restartEvery) || parsed.restartEvery <= 0)) ||
    parsed.text !== `Loan of 8.68 PHP over ${parsed.termDays} days`
  ) {
    throw new Error('loan ui file has the wrong shape');
  }
  return parsed;
}

function bearer(ui: LoanUi): { authorization: string } {
  return { authorization: `Bearer ${ui.controlToken}` };
}

async function readControlCause(response: APIResponse): Promise<string> {
  const raw = await response.text();
  try {
    const parsed = JSON.parse(raw) as { error?: unknown };
    if (typeof parsed === 'object' && parsed !== null && typeof parsed.error === 'string') {
      return parsed.error.slice(0, 2000);
    }
  } catch {
    // Use the raw body when it is not JSON with an error string.
  }
  return raw.slice(0, 2000);
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
    const status = response.status();
    const cause = await readControlCause(response);
    process.stderr.write(`control ${pathname} failed ${status}: ${cause}\n`);
    throw new Error(`${pathname} returned ${status}: ${cause}`);
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

async function waitGap(since: number, gapMs: number): Promise<void> {
  const wait = gapMs - (Date.now() - since);
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
  expect(sent.goalAmount).toBe('8.68');
  expect(sent.goalRepayable).toBe(true);
  expect(sent.goalTermDays).toBe(ui.termDays);
  const created = (await response.json()) as { id?: string; goalSats?: number };
  if (typeof created.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(created.id)) {
    throw new Error('credit response has no id');
  }
  if (created.goalSats !== 868) {
    throw new Error('credit goal is not 868 sats');
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
  const repay = page.getByRole('button', { name: "Pay today's repayment" });
  await expect(repay).toBeVisible();
  let posts = 0;
  let since = 0;
  let stalled = 0;
  for (;;) {
    const ledger = await readLedger(page, messageId);
    if (ledger.next === null && ledger.daysPaid === ui.termDays) {
      return;
    }
    if (ledger.next === null) {
      stalled += 1;
      if (stalled > 5) {
        throw new Error(`repayment stopped at ${ledger.daysPaid} of ${ui.termDays} days`);
      }
      await page.waitForTimeout(2_000);
      continue;
    }
    stalled = 0;
    const key = `${ledger.next.dayIndex}:${ledger.next.recipientAccountId}`;
    await waitGap(since, ui.invoiceGapMs);
    if (ui.restartEvery !== null && posts >= ui.restartEvery) {
      await control(page.request, ui, '/restart');
      posts = 0;
      await page.reload();
      await expect(repay).toBeVisible();
    }
    const minted = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().includes('/repayment'),
      { timeout: 60_000 },
    );
    await expect(repay).toBeEnabled();
    await repay.click();
    const response = await minted;
    since = Date.now();
    if (response.status() === 429) {
      await control(page.request, ui, '/restart');
      posts = 0;
      await page.reload();
      await expect(repay).toBeVisible();
      continue;
    }
    if (!response.ok()) {
      throw new Error(`repayment returned ${response.status()}`);
    }
    const body = (await response.json()) as { sparkInvoice?: string | null };
    if (typeof body.sparkInvoice !== 'string' || body.sparkInvoice === '') {
      throw new Error('repayment has no spark invoice');
    }
    await control(page.request, ui, '/pay', {
      invoice: body.sparkInvoice,
      role: 'borrower',
      mode: 'repay',
      recipientAccountId: ledger.next.recipientAccountId,
    });
    await expect
      .poll(
        async () => {
          const updated = await readLedger(page, messageId);
          if (updated.next === null) {
            return 'done';
          }
          return `${updated.next.dayIndex}:${updated.next.recipientAccountId}`;
        },
        { timeout: 180_000, intervals: [2_000] },
      )
      .not.toBe(key);
    const sheet = page.locator('[data-pay-sheet]');
    if ((await sheet.count()) > 0) {
      await sheet.getByRole('button', { name: 'Close' }).click();
    }
    posts += 1;
    process.stdout.write(`share ${ledger.next.dayIndex} paid\n`);
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
  await expect(paidBack.getByText('Paid', { exact: true })).toHaveCount(
    ui.givers.length * ui.termDays,
  );
  const ledger = await readLedger(home, messageId);
  expect(ledger.daysPaid).toBe(ui.termDays);
  expect(ledger.termDays).toBe(ui.termDays);
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
        line.sats === giver.sats / ui.termDays,
    );
    expect(paid).toHaveLength(ui.termDays);
  }
  await expect(home.getByRole('button', { name: "Pay today's repayment" })).toBeVisible();
});
