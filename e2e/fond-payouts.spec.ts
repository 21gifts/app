import { createHash } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { fetchFondPayouts, postFondPayoutInvoice, postFondPayoutProof } from '../src/lib/api';

/** The api stub, for reading what the app sent it. */
const MOCK_API = 'http://127.0.0.1:3001';

/** The fixture payout row the stub api lists. */
const ROW_ID = '11111111-1111-4111-8111-111111111111';

/** A 64-hex preimage for the fixture proof. */
const PREIMAGE = '11'.repeat(32);

/** The fixture invoice's payment hash: SHA-256 of {@link PREIMAGE}. */
const PAYMENT_HASH = createHash('sha256').update(Buffer.from(PREIMAGE, 'hex')).digest('hex');

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
 * row state, so parallel tests cannot share an invoice or proof.
 *
 * @param request - Playwright request context.
 * @param role - Account role.
 * @returns The session token.
 */
async function fondSession(
  request: APIRequestContext,
  role: 'fond' | 'moderator' = 'fond',
): Promise<string> {
  const name = role === 'fond' ? 'Fond' : 'Mod';
  const created = await request.post(`${MOCK_API}/e2e/role-session`, {
    data: { role, name },
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
 * @returns The session token.
 */
async function seedFondPage(
  page: Page,
  request: APIRequestContext,
  role: 'fond' | 'moderator',
): Promise<string> {
  const token = await fondSession(request, role);
  await page.addInitScript((session: string) => {
    localStorage.setItem('21gifts.session', session);
  }, token);
  return token;
}

/**
 * Pauses the page clock just after the pinned instant, so the preimage poll
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
  proofs: Array<{ id: string; preimage: string; paymentHash: string }>;
  paid: boolean;
}

/**
 * Reads the mock's Fond fixture log for one session.
 *
 * @param request - Playwright request context.
 * @param session - Fixture session token.
 * @returns The list and invoice counts, proofs, and paid flag.
 */
async function fondDebug(request: APIRequestContext, session: string): Promise<FondDebug> {
  const res = await request.get(`${MOCK_API}/e2e/fond-payouts`, {
    headers: { authorization: `Bearer ${session}` },
  });
  expect(res.status()).toBe(200);
  return (await res.json()) as FondDebug;
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

test('Function: postFondPayoutInvoice — the fixture row returns its BOLT11', async ({
  request,
}) => {
  const session = await fondSession(request);
  const issued = await request.post(`/fond/payouts/${ROW_ID}/invoice`, {
    headers: { authorization: `Bearer ${session}` },
  });
  expect(issued.status()).toBe(200);
  expect(await issued.json()).toEqual({
    id: ROW_ID,
    bolt11: 'lnbc1e2efondpayout',
    paymentHash: PAYMENT_HASH,
  });
  const fetched = await withSameOriginFetch(() => postFondPayoutInvoice(session, ROW_ID));
  expect(fetched).toEqual({
    ok: true,
    invoice: {
      id: ROW_ID,
      bolt11: 'lnbc1e2efondpayout',
      paymentHash: PAYMENT_HASH,
    },
  });
  const missing = await withSameOriginFetch(() =>
    postFondPayoutInvoice(session, '22222222-2222-4222-8222-222222222222'),
  );
  expect(missing).toEqual({ ok: false, status: 404, error: 'Not found' });
});

test('Function: proxyFondPayoutProofPost — no bearer is 401', async ({ request }) => {
  expect((await request.post('/fond/payouts/[id]/proof')).status()).toBe(401);
});

test('Function: postFondPayoutProof — the fixture checks sha256(preimage) before it proves', async ({
  request,
}) => {
  const session = await fondSession(request);
  const wrong = await request.post(`/fond/payouts/${ROW_ID}/proof`, {
    headers: { authorization: `Bearer ${session}` },
    data: { preimage: '22'.repeat(32) },
  });
  expect(wrong.status()).toBe(400);
  const proved = await request.post(`/fond/payouts/${ROW_ID}/proof`, {
    headers: { authorization: `Bearer ${session}` },
    data: { preimage: PREIMAGE },
  });
  expect(proved.status()).toBe(200);
  expect(await proved.json()).toEqual({ status: 'paid', id: ROW_ID });
  const posted = await withSameOriginFetch(() =>
    postFondPayoutProof(session, ROW_ID, PREIMAGE),
  );
  expect(posted).toEqual({ ok: true });
  const refused = await withSameOriginFetch(() => postFondPayoutProof(session, ROW_ID, ''));
  expect(refused).toEqual({
    ok: false,
    status: 400,
    error: 'Expected a JSON body with preimage',
  });
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
  await expect.poll(async () => (await fondDebug(request, session)).invoices).toBe(1);
  await page.clock.runFor(4_000);
  await expect.poll(async () => (await fondDebug(request, session)).proofs.length).toBe(1);
  expect((await fondDebug(request, session)).proofs).toEqual([
    { id: ROW_ID, preimage: PREIMAGE, paymentHash: PAYMENT_HASH },
  ]);
});

test('Function: runFondPayoutTick — the loop invoices, pays, proves, and skips the paid row next time', async ({
  page,
  request,
}) => {
  await pauseFondClock(page);
  const session = await seedFondPage(page, request, 'fond');
  await openWelcome(page, 'Fond');
  await expect.poll(async () => (await fondDebug(request, session)).invoices).toBe(1);
  expect((await fondDebug(request, session)).proofs).toHaveLength(0);
  await page.clock.runFor(4_000);
  await expect.poll(async () => (await fondDebug(request, session)).proofs.length).toBe(1);
  const first = await fondDebug(request, session);
  expect(first.invoices).toBe(1);
  expect(first.proofs).toEqual([{ id: ROW_ID, preimage: PREIMAGE, paymentHash: PAYMENT_HASH }]);
  expect(first.paid).toBe(true);
  // The loop's next interval sees the paid row gone and requests no second invoice.
  await page.clock.runFor(60_000);
  await expect.poll(async () => (await fondDebug(request, session)).lists).toBeGreaterThan(
    first.lists,
  );
  const second = await fondDebug(request, session);
  expect(second.invoices).toBe(1);
  expect(second.proofs).toHaveLength(1);
});

test('Function: runFondPayoutTickOnce — the single-flight loop pays and proves the fixture row', async ({
  page,
  request,
}) => {
  await pauseFondClock(page);
  const session = await seedFondPage(page, request, 'fond');
  await openWelcome(page, 'Fond');
  await expect.poll(async () => (await fondDebug(request, session)).invoices).toBe(1);
  await page.clock.runFor(4_000);
  await expect.poll(async () => (await fondDebug(request, session)).proofs.length).toBe(1);
  const paid = await fondDebug(request, session);
  expect(paid).toMatchObject({
    invoices: 1,
    paid: true,
    proofs: [{ id: ROW_ID, preimage: PREIMAGE, paymentHash: PAYMENT_HASH }],
  });
  // A second interval is another tick through the single-flight wrapper: the row is already paid.
  const before = await fondDebug(request, session);
  await page.clock.runFor(60_000);
  await expect.poll(async () => (await fondDebug(request, session)).lists).toBeGreaterThan(
    before.lists,
  );
  expect((await fondDebug(request, session)).invoices).toBe(1);
});

test('Function: waitForFondPayoutRead — the payment stays pending through one poll, then completes', async ({
  page,
  request,
}) => {
  await pauseFondClock(page);
  const session = await seedFondPage(page, request, 'fond');
  await openWelcome(page, 'Fond');
  await expect.poll(async () => (await fondDebug(request, session)).invoices).toBe(1);
  expect((await fondDebug(request, session)).proofs).toHaveLength(0);
  // The fake wallet reports the first history read as pending; the proof can only
  // arrive after the second PAY_POLL_MS wait and a read that returns the preimage.
  await page.clock.runFor(3_999);
  expect((await fondDebug(request, session)).proofs).toHaveLength(0);
  await page.clock.runFor(1);
  await expect.poll(async () => (await fondDebug(request, session)).proofs.length).toBe(1);
  const proved = await fondDebug(request, session);
  expect(proved.proofs[0]?.preimage).toBe(PREIMAGE);
  expect(proved.proofs[0]?.paymentHash).toBe(PAYMENT_HASH);
});
