import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { fetchFondPayouts, postFondPayoutInvoice } from '../src/lib/api';

/** The api stub, for reading what the app sent it. */
const MOCK_API = 'http://127.0.0.1:3001';

/** The fixture payout row the stub api lists. */
const ROW_ID = '11111111-1111-4111-8111-111111111111';

/** The BOLT11 the fixture invoice returns. */
const BOLT11 = 'lnbc1e2efondpayout';

/** The fee-free Spark invoice the fixture returns unless a session asks for null. */
const SPARK_INVOICE = 'spark1e2efondpayout';

/** The fixture invoice's payment hash, as the api identifies the send. */
const PAYMENT_HASH = 'ab'.repeat(32);

/**
 * Runs `work` with relative `fetch` resolved against the running Next server,
 * so the imported client function talks to the same-origin proxy.
 *
 * @param work - Work that calls a same-origin `fetch`.
 * @returns The work's result.
 */
async function withSameOriginFetch<T>(work: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    original(
      typeof input === 'string' && input.startsWith('/')
        ? new URL(input, 'http://localhost:3000')
        : input,
      init,
    )) as typeof fetch;
  try {
    return await work();
  } finally {
    globalThis.fetch = original;
  }
}

/**
 * Mints a fixture session through the mock api. Every test gets its own Fond
 * row state, so parallel tests cannot share an invoice or settlement.
 *
 * @param request - Playwright request context.
 * @param role - Account role.
 * @param sparkInvoice - The Spark invoice the fixture returns, or null to cover the BOLT11 path.
 * @returns The session token.
 */
async function fondSession(
  request: APIRequestContext,
  role: 'fond' | 'moderator' = 'fond',
  sparkInvoice: string | null = SPARK_INVOICE,
): Promise<string> {
  const name = role === 'fond' ? 'Fond' : 'Mod';
  const created = await request.post(`${MOCK_API}/e2e/role-session`, {
    data: { role, name, sparkInvoice },
  });
  expect(created.status()).toBe(200);
  return ((await created.json()) as { token: string }).token;
}

/**
 * Signs in an account through the mock api and puts its session in the tab.
 *
 * @param page - The page.
 * @param request - Playwright request context against the running app.
 * @param role - Account role.
 * @param sparkInvoice - The Spark invoice the fixture returns, or null to cover the BOLT11 path.
 * @returns The session token.
 */
async function seedFondPage(
  page: Page,
  request: APIRequestContext,
  role: 'fond' | 'moderator',
  sparkInvoice: string | null = SPARK_INVOICE,
): Promise<string> {
  const token = await fondSession(request, role, sparkInvoice);
  await page.addInitScript((session: string) => {
    localStorage.setItem('21gifts.session', session);
  }, token);
  return token;
}

/**
 * Pauses the page clock just after the pinned instant, so every loop interval
 * waits for an explicit fast-forward.
 *
 * @param page - The page.
 * @returns Nothing.
 */
async function pauseFondClock(page: Page): Promise<void> {
  const at = new Date('2026-01-07T12:00:00.000Z');
  await page.clock.install({ time: at });
  await page.clock.pauseAt(new Date(at.getTime() + 1_000));
}

/** What the mock's Fond debug endpoint recorded for one session. */
interface FondDebug {
  lists: number;
  invoices: number;
  invoiceRequests: number;
  invoice: {
    id: string;
    bolt11: string;
    paymentHash: string;
    sparkInvoice: string | null;
  } | null;
  paid: boolean;
}

/**
 * Reads the mock's Fond fixture log for one session.
 *
 * @param request - Playwright request context.
 * @param session - Fixture session token.
 * @returns The list count, issued invoices and requests, recorded invoice, and paid flag.
 */
async function fondDebug(request: APIRequestContext, session: string): Promise<FondDebug> {
  const res = await request.get(`${MOCK_API}/e2e/fond-payouts`, {
    headers: { authorization: `Bearer ${session}` },
  });
  expect(res.status()).toBe(200);
  return (await res.json()) as FondDebug;
}

/**
 * Marks the fixture row paid as the api worker would, so the list stops returning it.
 *
 * @param request - Playwright request context.
 * @param session - Fixture session token.
 * @returns Nothing.
 */
async function settleFondPayout(request: APIRequestContext, session: string): Promise<void> {
  const res = await request.post(`${MOCK_API}/e2e/fond-payouts/settle`, {
    headers: { authorization: `Bearer ${session}` },
  });
  expect(res.status()).toBe(200);
}

/**
 * Advances the paused page clock in steps until the mock has issued the fixture invoice.
 *
 * @param page - The page.
 * @param request - Playwright request context.
 * @param session - Fixture session token.
 * @returns The recorded invoice.
 */
async function invoiceIssued(
  page: Page,
  request: APIRequestContext,
  session: string,
): Promise<NonNullable<FondDebug['invoice']>> {
  await expect
    .poll(
      async () => {
        await page.clock.runFor(2_000);
        return (await fondDebug(request, session)).invoice;
      },
      { timeout: 20_000 },
    )
    .not.toBeNull();
  const invoice = (await fondDebug(request, session)).invoice;
  expect(invoice).not.toBeNull();
  return invoice as NonNullable<FondDebug['invoice']>;
}

/**
 * Advances the paused page clock in steps until the loop lists the row again.
 *
 * @param page - The page.
 * @param request - Playwright request context.
 * @param session - Fixture session token.
 * @param after - Current list count.
 * @returns Nothing.
 */
async function nextTick(
  page: Page,
  request: APIRequestContext,
  session: string,
  after: number,
): Promise<void> {
  await expect
    .poll(
      async () => {
        await page.clock.runFor(15_000);
        return (await fondDebug(request, session)).lists;
      },
      { timeout: 30_000 },
    )
    .toBeGreaterThan(after);
}

/**
 * Opens `/welcome` for a seeded session and stubs the forum feed.
 *
 * @param page - The page.
 * @param name - Greeting the fixture account shows.
 * @returns Nothing.
 */
async function openWelcome(page: Page, name: string): Promise<void> {
  await page.route(/\/forum\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: `Welcome, ${name}` })).toBeVisible();
}

test('Function: proxyFondPayoutsGet — no bearer is 401', async ({ request }) => {
  expect((await request.get('/fond/payouts')).status()).toBe(401);
});

test('Function: fetchFondPayouts — the Fond fixture session lists the open row', async ({
  request,
}) => {
  const session = await fondSession(request);
  const listed = await request.get('/fond/payouts', {
    headers: { authorization: `Bearer ${session}` },
  });
  expect(listed.status()).toBe(200);
  expect(await listed.json()).toEqual({
    payouts: [
      { id: ROW_ID, kind: 'daily', status: 'owed', utcDay: '2026-01-07', paymentHash: null },
    ],
  });
  const fetched = await withSameOriginFetch(() => fetchFondPayouts(session));
  expect(fetched).toEqual({
    ok: true,
    payouts: [
      { id: ROW_ID, kind: 'daily', status: 'owed', utcDay: '2026-01-07', paymentHash: null },
    ],
  });
  const refused = await withSameOriginFetch(() => fetchFondPayouts('not-fond'));
  expect(refused).toEqual({ ok: false, status: 403, error: 'Fond only' });
});

test('Function: proxyFondPayoutInvoicePost — no bearer is 401', async ({ request }) => {
  expect((await request.post('/fond/payouts/[id]/invoice')).status()).toBe(401);
});

test('Function: postFondPayoutInvoice — the fixture row returns its BOLT11 and Spark invoice', async ({
  request,
}) => {
  const session = await fondSession(request);
  const issued = await request.post(`/fond/payouts/${ROW_ID}/invoice`, {
    headers: { authorization: `Bearer ${session}` },
  });
  expect(issued.status()).toBe(200);
  expect(await issued.json()).toEqual({
    id: ROW_ID,
    bolt11: BOLT11,
    paymentHash: PAYMENT_HASH,
    sparkInvoice: SPARK_INVOICE,
  });
  const fetched = await withSameOriginFetch(() => postFondPayoutInvoice(session, ROW_ID));
  expect(fetched).toEqual({
    ok: true,
    invoice: {
      id: ROW_ID,
      bolt11: BOLT11,
      paymentHash: PAYMENT_HASH,
      sparkInvoice: SPARK_INVOICE,
    },
  });
  const missing = await withSameOriginFetch(() =>
    postFondPayoutInvoice(session, '22222222-2222-4222-8222-222222222222'),
  );
  expect(missing).toEqual({ ok: false, status: 404, error: 'Not found' });
});

test('Function: FondPayoutSync — a moderator never calls /fond/payouts', async ({
  page,
  request,
}) => {
  await seedFondPage(page, request, 'moderator');
  let requests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/fond/payouts') {
      requests += 1;
    }
  });
  await openWelcome(page, 'Mod');
  await page.waitForTimeout(250);
  expect(requests).toBe(0);
});

test('Function: fondE2eWallet — the Playwright wallet pays the fixture without a Breez key', async ({
  page,
  request,
}) => {
  await pauseFondClock(page);
  const session = await seedFondPage(page, request, 'fond');
  await openWelcome(page, 'Fond');
  const invoice = await invoiceIssued(page, request, session);
  expect(invoice).toEqual({
    id: ROW_ID,
    bolt11: BOLT11,
    paymentHash: PAYMENT_HASH,
    sparkInvoice: SPARK_INVOICE,
  });
  const first = await fondDebug(request, session);
  await nextTick(page, request, session, first.lists);
  expect(await fondDebug(request, session)).toMatchObject({ invoices: 1, paid: false });
});

test('Function: runFondPayoutTick — the loop invoices and pays the Spark invoice once, then nothing after settle', async ({
  page,
  request,
}) => {
  await pauseFondClock(page);
  const session = await seedFondPage(page, request, 'fond');
  await openWelcome(page, 'Fond');
  const invoice = await invoiceIssued(page, request, session);
  expect(invoice.sparkInvoice).toBe(SPARK_INVOICE);
  const invoiced = await fondDebug(request, session);
  // The next tick finds the completed Spark send in history and issues no second invoice.
  await nextTick(page, request, session, invoiced.lists);
  expect(await fondDebug(request, session)).toMatchObject({ invoices: 1, paid: false });
  await settleFondPayout(request, session);
  // Once the api worker marks the row paid, the list is empty and no invoice is requested again.
  const settled = await fondDebug(request, session);
  await nextTick(page, request, session, settled.lists);
  const second = await fondDebug(request, session);
  expect(second.invoices).toBe(1);
  expect(second.invoiceRequests).toBe(settled.invoiceRequests);
  expect(second.paid).toBe(true);
});

test('Function: runFondPayoutTick — the loop pays the BOLT11 when the api returns no Spark invoice', async ({
  page,
  request,
}) => {
  await pauseFondClock(page);
  const session = await seedFondPage(page, request, 'fond', null);
  await openWelcome(page, 'Fond');
  const invoice = await invoiceIssued(page, request, session);
  expect(invoice).toMatchObject({ bolt11: BOLT11, sparkInvoice: null });
  const invoiced = await fondDebug(request, session);
  // The next tick finds the completed BOLT11 send in history and issues no second invoice.
  await nextTick(page, request, session, invoiced.lists);
  expect(await fondDebug(request, session)).toMatchObject({ invoices: 1, paid: false });
});

test('Function: runFondPayoutTickOnce — the single-flight loop pays the fixture row once', async ({
  page,
  request,
}) => {
  await pauseFondClock(page);
  const session = await seedFondPage(page, request, 'fond');
  await openWelcome(page, 'Fond');
  const invoice = await invoiceIssued(page, request, session);
  expect(invoice).toMatchObject({ id: ROW_ID, paymentHash: PAYMENT_HASH });
  const invoiced = await fondDebug(request, session);
  // A second interval is another tick through the single-flight wrapper; the send is in history.
  await nextTick(page, request, session, invoiced.lists);
  expect(await fondDebug(request, session)).toMatchObject({ invoices: 1, paid: false });
});
