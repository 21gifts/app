import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { putFondDepositAddress } from '../src/lib/api';

/** The api stub, for reading what the app sent it. */
const MOCK_API = 'http://127.0.0.1:3001';

/** The Playwright Fond wallet's static deposit address. */
const ADDRESS = 'bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr';

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
 * Mints a fixture session through the mock api.
 *
 * @param request - Playwright request context.
 * @param role - Account role.
 * @returns The session token.
 */
async function roleSession(
  request: APIRequestContext,
  role: 'fond' | 'moderator' | 'founder' = 'fond',
): Promise<string> {
  const names = { fond: 'Fond', moderator: 'Mod', founder: 'Founder' };
  const created = await request.post(`${MOCK_API}/e2e/role-session`, {
    data: { role, name: names[role] },
  });
  expect(created.status()).toBe(200);
  return ((await created.json()) as { token: string }).token;
}

/** What the mock recorded for one session's deposit address. */
interface DepositDebug {
  address: string | null;
  puts: number;
}

/**
 * Reads the mock's deposit-address log for one session.
 *
 * @param request - Playwright request context.
 * @param session - Fixture session token.
 * @returns The stored address and the number of PUTs.
 */
async function depositDebug(request: APIRequestContext, session: string): Promise<DepositDebug> {
  const res = await request.get(`${MOCK_API}/e2e/fond-deposit-address`, {
    headers: { authorization: `Bearer ${session}` },
  });
  expect(res.status()).toBe(200);
  return (await res.json()) as DepositDebug;
}

/**
 * Opens `/welcome` for a seeded session with an empty forum feed, and
 * records the page's request URLs.
 *
 * @param page - The page.
 * @param session - Session token to put in the tab.
 * @param name - Greeting the fixture account shows.
 * @returns The recorded request URLs.
 */
async function openWelcome(page: Page, session: string, name: string): Promise<string[]> {
  await page.addInitScript((token: string) => {
    localStorage.setItem('21gifts.session', token);
  }, session);
  await page.route(/\/forum\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  const urls: string[] = [];
  page.on('request', (req) => {
    urls.push(req.url());
  });
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: `Welcome, ${name}` })).toBeVisible();
  return urls;
}

test('Function: proxyFondDepositAddressPut — no bearer is 401, another account 403', async ({
  request,
}) => {
  expect(
    (await request.put('/fond/deposit-address', { data: { address: ADDRESS } })).status(),
  ).toBe(401);
  const moderator = await roleSession(request, 'moderator');
  const refused = await request.put('/fond/deposit-address', {
    headers: { authorization: `Bearer ${moderator}` },
    data: { address: ADDRESS },
  });
  expect(refused.status()).toBe(403);
  const founder = await roleSession(request, 'founder');
  const founderRefused = await request.put('/fond/deposit-address', {
    headers: { authorization: `Bearer ${founder}` },
    data: { address: ADDRESS },
  });
  expect(founderRefused.status()).toBe(403);
});

test('Function: PUT — /fond/deposit-address stores the Fond address and refuses a malformed one', async ({
  request,
}) => {
  const session = await roleSession(request);
  const stored = await request.put('/fond/deposit-address', {
    headers: { authorization: `Bearer ${session}` },
    data: { address: ADDRESS },
  });
  expect(stored.status()).toBe(200);
  expect(await stored.json()).toEqual({ address: ADDRESS });
  const invalid = await request.put('/fond/deposit-address', {
    headers: { authorization: `Bearer ${session}` },
    data: { address: 'not an address' },
  });
  expect(invalid.status()).toBe(400);
});

test('Function: putFondDepositAddress — the client call returns the stored address or the status', async ({
  request,
}) => {
  const session = await roleSession(request);
  expect(await withSameOriginFetch(() => putFondDepositAddress(session, ADDRESS))).toEqual({
    ok: true,
    address: ADDRESS,
  });
  expect(await withSameOriginFetch(() => putFondDepositAddress(session, 'x'))).toEqual({
    ok: false,
    status: 400,
    error: 'Invalid address',
  });
  const moderator = await roleSession(request, 'moderator');
  expect(await withSameOriginFetch(() => putFondDepositAddress(moderator, ADDRESS))).toEqual({
    ok: false,
    status: 403,
    error: 'Fond only',
  });
});

test('Function: FondDepositSync — the signed-in Fond app registers its wallet address once', async ({
  page,
  request,
}) => {
  const session = await roleSession(request);
  await openWelcome(page, session, 'Fond');
  await expect.poll(async () => (await depositDebug(request, session)).address).toBe(ADDRESS);
  await page.waitForTimeout(500);
  expect((await depositDebug(request, session)).puts).toBe(1);
});

test('Function: registerFondDepositAddress — the address the Fond app sends is the one the api stores', async ({
  page,
  request,
}) => {
  const session = await roleSession(request);
  await openWelcome(page, session, 'Fond');
  await expect
    .poll(async () => depositDebug(request, session))
    .toEqual({ address: ADDRESS, puts: 1 });
});

test('Function: FondDepositSync — a moderator never calls /fond/deposit-address', async ({
  page,
  request,
}) => {
  const session = await roleSession(request, 'moderator');
  const urls = await openWelcome(page, session, 'Mod');
  await page.waitForTimeout(250);
  expect(urls.some((url) => new URL(url).pathname === '/fond/deposit-address')).toBe(false);
});

test('Function: claimFondDeposits — the Fond app claims through the Playwright wallet without a Breez key', async ({
  page,
  request,
}) => {
  const session = await roleSession(request);
  const urls = await openWelcome(page, session, 'Fond');
  await expect.poll(async () => (await depositDebug(request, session)).address).toBe(ADDRESS);
  await expect(page.getByRole('heading', { name: 'Welcome, Fond' })).toBeVisible();
  expect(urls.some((url) => url.endsWith('.wasm'))).toBe(false);
});

/**
 * Opens the Fond app with the Playwright wallet and waits for its address to
 * reach the api, then checks that no wallet code was downloaded.
 *
 * @param page - The page.
 * @param request - Playwright request context.
 * @returns Nothing.
 */
async function expectFakeFondWallet(page: Page, request: APIRequestContext): Promise<void> {
  const session = await roleSession(request);
  const urls = await openWelcome(page, session, 'Fond');
  await expect.poll(async () => (await depositDebug(request, session)).address).toBe(ADDRESS);
  expect(urls.some((url) => url.endsWith('.wasm'))).toBe(false);
}

test('Function: receiveWalletBitcoinAddress — the Playwright Fond wallet stands in for it, so no wallet code loads', async ({
  page,
  request,
}) => {
  await expectFakeFondWallet(page, request);
});

test('Function: listWalletUnclaimedDeposits — the Playwright Fond wallet stands in for it, so no wallet code loads', async ({
  page,
  request,
}) => {
  await expectFakeFondWallet(page, request);
});

test('Function: claimWalletDeposit — the Playwright Fond wallet stands in for it, so no wallet code loads', async ({
  page,
  request,
}) => {
  await expectFakeFondWallet(page, request);
});

test('Function: onWalletDeposits — the Playwright Fond wallet stands in for it, so no wallet code loads', async ({
  page,
  request,
}) => {
  await expectFakeFondWallet(page, request);
});
