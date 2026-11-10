import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { fetchFondPayouts, postFondPayoutInvoice, postFondPayoutProof } from '../src/lib/api';

/** The fixture session the stub api accepts on the three `/fond/payouts` routes. */
const FOND_SESSION = 'e2e-fond-session';

/** The fixture payout row the stub api lists. */
const ROW_ID = '11111111-1111-4111-8111-111111111111';

/** A 64-hex preimage for the fixture proof. */
const PREIMAGE = '11'.repeat(32);

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
 * Signs in an account through the mock api and puts its session in the tab.
 *
 * @param page - The page.
 * @param request - Playwright request context against the running app.
 * @param role - Account role.
 * @returns Nothing.
 */
async function seedFondPage(
  page: Page,
  request: APIRequestContext,
  role: 'fond' | 'moderator',
): Promise<void> {
  const name = role === 'fond' ? 'Fond' : 'Mod';
  const created = await request.post('http://127.0.0.1:3001/e2e/role-session', {
    data: { role, name },
  });
  expect(created.status()).toBe(200);
  const { token } = (await created.json()) as { token: string };
  await page.addInitScript((session: string) => {
    localStorage.setItem('21gifts.session', session);
  }, token);
}

test('Function: proxyFondPayoutsGet — no bearer is 401', async ({ request }) => {
  expect((await request.get('/fond/payouts')).status()).toBe(401);
});

test('Function: fetchFondPayouts — the Fond fixture session lists the open row', async ({
  request,
}) => {
  const listed = await request.get('/fond/payouts', {
    headers: { authorization: `Bearer ${FOND_SESSION}` },
  });
  expect(listed.status()).toBe(200);
  expect(await listed.json()).toEqual({
    payouts: [
      { id: ROW_ID, kind: 'daily', status: 'owed', utcDay: '2026-01-07', paymentHash: null },
    ],
  });
  const fetched = await withSameOriginFetch(() => fetchFondPayouts(FOND_SESSION));
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
  const issued = await request.post(`/fond/payouts/${ROW_ID}/invoice`, {
    headers: { authorization: `Bearer ${FOND_SESSION}` },
  });
  expect(issued.status()).toBe(200);
  expect(await issued.json()).toEqual({
    id: ROW_ID,
    bolt11: 'lnbc1e2efondpayout',
    paymentHash: 'ab'.repeat(32),
  });
  const fetched = await withSameOriginFetch(() => postFondPayoutInvoice(FOND_SESSION, ROW_ID));
  expect(fetched).toEqual({
    ok: true,
    invoice: {
      id: ROW_ID,
      bolt11: 'lnbc1e2efondpayout',
      paymentHash: 'ab'.repeat(32),
    },
  });
  const missing = await withSameOriginFetch(() =>
    postFondPayoutInvoice(FOND_SESSION, '22222222-2222-4222-8222-222222222222'),
  );
  expect(missing).toEqual({ ok: false, status: 404, error: 'Not found' });
});

test('Function: proxyFondPayoutProofPost — no bearer is 401', async ({ request }) => {
  expect((await request.post('/fond/payouts/[id]/proof')).status()).toBe(401);
});

test('Function: postFondPayoutProof — the fixture accepts a preimage as proof', async ({
  request,
}) => {
  const proved = await request.post(`/fond/payouts/${ROW_ID}/proof`, {
    headers: { authorization: `Bearer ${FOND_SESSION}` },
    data: { preimage: PREIMAGE },
  });
  expect(proved.status()).toBe(200);
  expect(await proved.json()).toEqual({ status: 'paid', id: ROW_ID });
  const posted = await withSameOriginFetch(() =>
    postFondPayoutProof(FOND_SESSION, ROW_ID, PREIMAGE),
  );
  expect(posted).toEqual({ ok: true });
  const refused = await withSameOriginFetch(() => postFondPayoutProof(FOND_SESSION, ROW_ID, ''));
  expect(refused).toEqual({
    ok: false,
    status: 400,
    error: 'Expected a JSON body with preimage',
  });
});

test('Function: FondPayoutSync — a locked wallet sends no payout request', async ({
  page,
  request,
}) => {
  await seedFondPage(page, request, 'fond');
  let requests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/fond/payouts') {
      requests += 1;
    }
  });
  await page.route(/\/forum\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Welcome, Fond' })).toBeVisible();
  await page.waitForTimeout(250);
  expect(requests).toBe(0);
});

test('Function: runFondPayoutTick — a Fond account without a ready wallet sends no payout request', async ({
  page,
  request,
}) => {
  await seedFondPage(page, request, 'fond');
  let requests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/fond/payouts') {
      requests += 1;
    }
  });
  await page.route(/\/forum\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Welcome, Fond' })).toBeVisible();
  await page.waitForTimeout(250);
  expect(requests).toBe(0);
});

test('Function: runFondPayoutTickOnce — a moderator without a ready wallet sends no payout request', async ({
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
  await page.route(/\/forum\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Welcome, Mod' })).toBeVisible();
  await page.waitForTimeout(250);
  expect(requests).toBe(0);
});

test('Function: waitForFondPayoutRead — the Fond session reads the fixture row through the proxy', async ({
  request,
}) => {
  const listed = await request.get('/fond/payouts', {
    headers: { authorization: `Bearer ${FOND_SESSION}` },
  });
  expect(listed.status()).toBe(200);
  const body = (await listed.json()) as { payouts: { id: string; paymentHash: string | null }[] };
  expect(body.payouts[0]?.id).toBe(ROW_ID);
  expect(body.payouts[0]?.paymentHash).toBeNull();
});
