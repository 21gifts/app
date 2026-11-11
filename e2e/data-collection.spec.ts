import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { fulfillSpot } from './fx-spot';

/** The Playwright build's id, which the stub api requires on every passkey step. */
const APP_BUILD = { 'x-app-build': 'dev' };

/** The api stub, for reading what the app sent it. */
const MOCK_API = 'http://127.0.0.1:3001';

/** A member the api stub always knows. */
const MEMBER_ID = '22222222-2222-4222-8222-222222222222';

const MNEMONIC =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';

type SentEvent = { name: string; at: string; path: string; props: Record<string, unknown> };

/**
 * Opens a new account on the api stub with name, username, and agreed rules.
 *
 * @param request - Request context of the test.
 * @returns The session token.
 */
async function newMember(request: APIRequestContext): Promise<string> {
  const begin = await request.post('/auth/passkey/register/begin', { headers: APP_BUILD });
  expect(begin.status()).toBe(200);
  const started = (await begin.json()) as { challengeId: string };
  const finish = await request.post('/auth/passkey/register/finish', {
    headers: { ...APP_BUILD, origin: 'http://localhost:3000' },
    data: {
      challengeId: started.challengeId,
      credential: {
        id: `cred_${started.challengeId.slice(0, 8)}`,
        rawId: 'YQ',
        type: 'public-key',
      },
    },
  });
  expect(finish.status()).toBe(200);
  const { token } = (await finish.json()) as { token: string };
  const auth = { authorization: `Bearer ${token}` };
  expect((await request.post('/me/name', { headers: auth, data: { name: 'Ada' } })).status()).toBe(
    200,
  );
  const username = `ada${started.challengeId
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 8)
    .toLowerCase()}`;
  expect((await request.post('/me/username', { headers: auth, data: { username } })).status()).toBe(
    200,
  );
  expect((await request.post('/me/rules-agreement', { headers: auth })).status()).toBe(200);
  return token;
}

/**
 * Stores the session in the page before any script runs.
 *
 * @param page - The page.
 * @param token - Session token.
 */
async function signIn(page: Page, token: string): Promise<void> {
  await page.addInitScript((session: string) => {
    localStorage['21gifts.session'] = session;
  }, token);
}

/**
 * Events the api stub received for this session.
 *
 * @param request - Request context of the test.
 * @param token - Session token.
 * @returns The events, in order.
 */
async function receivedEvents(request: APIRequestContext, token: string): Promise<SentEvent[]> {
  const res = await request.get(`${MOCK_API}/e2e/events`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  return ((await res.json()) as { events: SentEvent[] }).events;
}

/**
 * Fires `pagehide`, which sends whatever the interaction log has queued. The
 * view is queued once the session has hydrated, so callers repeat this while
 * they poll.
 *
 * @param page - The page.
 */
async function hidePage(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(new Event('pagehide'));
  });
}

/**
 * Opens `/wallet` signed in, in a build without a wallet key, and checks that
 * the wallet never loads and no wallet report is sent.
 *
 * @param page - The page.
 * @param request - Request context of the test.
 */
async function expectNoWalletReport(page: Page, request: APIRequestContext): Promise<void> {
  const token = await newMember(request);
  await signIn(page, token);
  const urls: string[] = [];
  page.on('request', (req) => {
    urls.push(req.url());
  });
  await page.goto('/wallet');
  await expect(page.getByRole('region', { name: 'Balance' })).toHaveCount(0);
  expect(urls.some((u) => u.endsWith('.wasm'))).toBe(false);
  expect(urls.some((u) => u.includes('/me/wallet/report'))).toBe(false);
}

test.describe('POST /me/wallet/report', () => {
  test('Function: proxyMeWalletReportPost — 401 without a session, acknowledged ids with one', async ({
    request,
  }) => {
    expect((await request.post('/me/wallet/report')).status()).toBe(401);
    const token = await newMember(request);
    const res = await request.post('/me/wallet/report', {
      headers: { authorization: `Bearer ${token}` },
      data: {
        balanceSats: 2_100,
        syncedAt: '2026-10-07T00:00:00.000Z',
        payments: [{ id: 'pay-1', direction: 'in', status: 'completed', amountSats: 21 }],
      },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ acknowledgedIds: ['pay-1'] });
  });

  test('Function: postWalletReport — the proxy refuses a report over 200 payments', async ({
    request,
  }) => {
    const token = await newMember(request);
    const payments = Array.from({ length: 201 }, (_, i) => ({ id: `p${String(i)}` }));
    const res = await request.post('/me/wallet/report', {
      headers: { authorization: `Bearer ${token}` },
      data: { balanceSats: 0, syncedAt: '2026-10-07T00:00:00.000Z', payments },
    });
    expect(res.status()).toBe(400);
  });

  test('Function: reportWallet — no wallet key sends no wallet report and loads no wasm', async ({
    page,
    request,
  }) => {
    await expectNoWalletReport(page, request);
  });

  test('Function: listWalletReportPayments — no wallet key lists nothing and loads no wasm', async ({
    page,
    request,
  }) => {
    await expectNoWalletReport(page, request);
  });

  test('Function: toWalletReportPayment — no wallet key maps nothing and loads no wasm', async ({
    page,
    request,
  }) => {
    await expectNoWalletReport(page, request);
  });
});

/** Spark hash of the sent-gift row in the history-rows fixture. */
const GIFT_PAYMENT_HASH = '79d7ebca70b18b8a13cfb40e6c6055be64f9cacfcd79c706b29e80e1707b00dc';

/**
 * Signed-in wallet home that still asks the heart lookup. The heart pins
 * return before that request, so these tests stay on `history-rows`.
 *
 * @param page - The page.
 */
async function stubHeartLookupWallet(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: `02${'a'.repeat(62)}`,
        role: 'basis',
        name: 'Ada',
        username: 'ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1_700_000_000,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        walletRequired: true,
        walletBackupSeenAt: 1,
        passkeyCredentialId: 'cred-seed',
        sparkPubkey: null,
        sparkWalletVerified: true,
      }),
    });
  });
  await page.route(/\/pos\/charge$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ charge: null, history: [] }),
    });
  });
  await fulfillSpot(page);
}

/**
 * Answers the heart lookup with Sunday lunch only for the history-rows gift hash.
 *
 * @param page - The page.
 * @returns The hashes the page submitted, filled when the request arrives.
 */
async function routeGiftHeart(page: Page): Promise<{ hashes: string[] }> {
  const seen = { hashes: [] as string[] };
  await page.route('**/me/wallet/hearts', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const body = route.request().postDataJSON() as { hashes?: string[] };
    seen.hashes = body.hashes ?? [];
    const hearts = seen.hashes.includes(GIFT_PAYMENT_HASH)
      ? [
          {
            paymentHash: GIFT_PAYMENT_HASH,
            messageId: '11111111-1111-4111-8111-111111111111',
            authorName: 'Ada',
            text: 'Sunday lunch',
            deleted: false,
          },
        ]
      : [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ hearts }),
    });
  });
  return seen;
}

/** Lightning hash of the received-zap row in the history-rows fixture (no memo, so no purpose). */
const ZAP_PAYMENT_HASH = '412527ec5d814b75f8641ebd875bffbf26a11b7c180380e31e833d777cfa9d89';

/**
 * Answers the wallet lookup with two repayments on history-rows payments: the
 * received zap as a repayment to the member (giver) and the sent gift as one
 * the member paid (borrower).
 *
 * @param page - The page.
 * @returns The hashes the page submitted, filled when the request arrives.
 */
async function routeRepayments(page: Page): Promise<{ hashes: string[] }> {
  const seen = { hashes: [] as string[] };
  await page.route('**/me/wallet/hearts', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const body = route.request().postDataJSON() as { hashes?: string[] };
    seen.hashes = body.hashes ?? [];
    const row = (
      paymentHash: string,
      role: 'giver' | 'borrower',
      authorName: string,
      text: string,
    ): { paymentHash: string } & Record<string, unknown> => ({
      paymentHash,
      messageId: '22222222-2222-4222-8222-222222222222',
      dayIndex: 2,
      termDays: 7,
      role,
      authorName,
      text,
      deleted: false,
    });
    const repayments = [
      row(ZAP_PAYMENT_HASH, 'giver', 'Ben', 'New bike tyres'),
      row(GIFT_PAYMENT_HASH, 'borrower', 'Ada', 'Rent until payday'),
    ].filter((entry) => seen.hashes.includes(entry.paymentHash));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ hearts: [], repayments }),
    });
  });
  return seen;
}

test.describe('POST /me/wallet/counterparties', () => {
  test('Function: SENT_TO_MEMBER_PAYMENT — the pin shows the sent payment', async ({ page }) => {
    await stubHeartLookupWallet(page);
    await page.goto(
      '/wallet/payment?id=ab12ce00-1545-4000-8000-000000000015&visual=sent-to-member',
    );
    await expect(page.getByRole('link', { name: 'bob@21.gifts' })).toBeVisible();
  });

  test('Function: SENT_TO_MEMBER_COUNTERPARTY — the pin links to Bob', async ({ page }) => {
    await stubHeartLookupWallet(page);
    await page.goto(
      '/wallet/payment?id=ab12ce00-1545-4000-8000-000000000015&visual=sent-to-member',
    );
    await expect(page.getByRole('link', { name: 'bob@21.gifts' })).toHaveAttribute(
      'href',
      '/members/acc_bob',
    );
  });

  test('Function: isSparkPaymentRequest — hides the Spark request for a known member', async ({
    page,
  }) => {
    await stubHeartLookupWallet(page);
    await page.goto(
      '/wallet/payment?id=ab12ce00-1545-4000-8000-000000000015&visual=sent-to-member',
    );
    await page.getByRole('button', { name: 'Details' }).click();
    await expect(page.getByText('Payment ID')).toBeVisible();
    await expect(page.getByText('Payment request')).toHaveCount(0);
  });

  test('Function: RECEIVED_FROM_MEMBER_PAYMENT — the pin shows a received payment', async ({
    page,
  }) => {
    await stubHeartLookupWallet(page);
    await page.goto(
      '/wallet/payment?id=ab12ce00-1545-4000-8000-000000000014&visual=received-from-member',
    );
    await expect(page.getByRole('link', { name: 'alice@21.gifts' })).toBeVisible();
  });

  test('Function: RECEIVED_FROM_MEMBER_SENDER — the pin links to Alice', async ({ page }) => {
    await stubHeartLookupWallet(page);
    await page.goto(
      '/wallet/payment?id=ab12ce00-1545-4000-8000-000000000014&visual=received-from-member',
    );
    await expect(page.getByRole('link', { name: 'alice@21.gifts' })).toHaveAttribute(
      'href',
      '/members/acc_e2e',
    );
  });

  test('Function: proxyMeWalletCounterpartiesPost — forwards counterparty lookup', async ({
    request,
  }) => {
    expect(
      (await request.post('/me/wallet/counterparties', { data: { payments: [] } })).status(),
    ).toBe(401);
    const token = await newMember(request);
    const res = await request.post('/me/wallet/counterparties', {
      headers: { authorization: `Bearer ${token}` },
      data: {
        payments: [{ id: '6a6c3f1f-5841-415b-b8a6-f21d3e513bae', direction: 'in' }],
      },
    });
    expect(await res.json()).toEqual({
      counterparties: [
        { id: '6a6c3f1f-5841-415b-b8a6-f21d3e513bae', accountId: 'acc_e2e', username: 'alice' },
      ],
    });
  });

  test('Function: fetchPaymentCounterparties — resolves the incoming payment', async ({ page }) => {
    await stubHeartLookupWallet(page);
    await page.route('**/me/wallet/counterparties', async (route) => {
      const body = route.request().postDataJSON() as {
        payments: { id: string; direction: string }[];
      };
      await route.fulfill({
        json: {
          counterparties: body.payments
            .filter(({ direction }) => direction === 'in')
            .map(({ id }) => ({ id, accountId: 'acc_e2e', username: 'alice' })),
        },
      });
    });
    await page.goto('/wallet/payment?id=6a6c3f1f-5841-415b-b8a6-f21d3e513bae&visual=history-rows');
    await expect(page.getByRole('link', { name: 'alice@21.gifts' })).toHaveAttribute(
      'href',
      '/members/acc_e2e',
    );
  });

  test('Function: usePaymentCounterparty — shows no sender for an unmatched incoming payment', async ({
    page,
  }) => {
    await stubHeartLookupWallet(page);
    let lookupFulfilled!: () => void;
    const lookup = new Promise<void>((resolve) => {
      lookupFulfilled = resolve;
    });
    await page.route('**/me/wallet/counterparties', async (route) => {
      await route.fulfill({ json: { counterparties: [] } });
      if (route.request().method() === 'POST') lookupFulfilled();
    });
    await page.goto('/wallet/payment?id=6a6c3f1f-5841-415b-b8a6-f21d3e513bae&visual=history-rows');
    await expect(page.getByText('Coffee & croissant')).toBeVisible();
    await lookup;
    await expect(page.getByText('From', { exact: true })).toHaveCount(0);
  });
});

test.describe('POST /me/wallet/hearts', () => {
  test('Function: proxyMeWalletHeartsPost — 401 without a session', async ({ request }) => {
    expect((await request.post('/me/wallet/hearts', { data: { hashes: [] } })).status()).toBe(401);
  });

  test('a signed-in lookup of the visual heart returns its post', async ({ request }) => {
    const token = await newMember(request);
    const paymentHash = 'c0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeeaaaa';
    const res = await request.post('/me/wallet/hearts', {
      headers: { authorization: `Bearer ${token}` },
      data: { hashes: [paymentHash] },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({
      hearts: [
        {
          paymentHash,
          messageId: '11111111-1111-4111-8111-111111111111',
          authorName: 'Ada',
          text: 'Sunday lunch',
          deleted: false,
        },
      ],
      repayments: [],
    });
  });

  test('a signed-in lookup of the visual borrower repayment returns its credit note', async ({
    request,
  }) => {
    const token = await newMember(request);
    const paymentHash = 'f00dbabef00dbabef00dbabef00dbabef00dbabef00dbabef00dbabef00dbabe';
    const res = await request.post('/me/wallet/hearts', {
      headers: { authorization: `Bearer ${token}` },
      data: { hashes: [paymentHash] },
    });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({
      hearts: [],
      repayments: [
        {
          paymentHash,
          messageId: '33333333-3333-4333-8333-333333333333',
          dayIndex: 4,
          termDays: 10,
          role: 'borrower',
          authorName: 'Mia',
          text: 'Rent until payday',
          deleted: false,
        },
      ],
    });
  });

  test('Function: fetchHeartPosts — the payment screen shows the post for a gift hash', async ({
    page,
  }) => {
    const seen = await routeGiftHeart(page);
    await stubHeartLookupWallet(page);
    await page.goto('/wallet/payment?id=df98837c-6a12-4b15-94f8-375c33937a4e&visual=history-rows');
    await expect(page.getByText('Sunday lunch')).toBeVisible();
    await expect(page.getByText('Ada')).toBeVisible();
    await expect(
      page.locator('a[href="/messages/11111111-1111-4111-8111-111111111111"]'),
    ).toBeVisible();
    expect(seen.hashes).toContain(GIFT_PAYMENT_HASH);
    await expect(page.getByText('Gift', { exact: true })).toHaveCount(0);
  });

  test('Function: useHeartContext — the history list shows the post for a gift hash', async ({
    page,
  }) => {
    const seen = await routeGiftHeart(page);
    await stubHeartLookupWallet(page);
    await page.goto('/wallet?visual=history-rows');
    await expect(page.getByText('Sunday lunch')).toBeVisible();
    expect(seen.hashes).toContain(GIFT_PAYMENT_HASH);
    await expect(page.getByText('Gift', { exact: true })).toHaveCount(0);
  });

  test('Function: paymentLookupHash — the history asks about memo-less payments and names repayments', async ({
    page,
  }) => {
    const seen = await routeRepayments(page);
    await stubHeartLookupWallet(page);
    await page.goto('/wallet?visual=history-rows');
    await expect(page.getByText('Loan repayment')).toHaveCount(2);
    await expect(page.getByText('New bike tyres')).toBeVisible();
    await expect(page.getByText('Rent until payday')).toBeVisible();
    expect(seen.hashes).toContain(ZAP_PAYMENT_HASH);
    expect(seen.hashes).toContain(GIFT_PAYMENT_HASH);
    await expect(page.getByText('Gift on your post')).toHaveCount(0);
    await expect(page.getByText('Great photo!')).toHaveCount(0);
  });

  test('Function: WalletPaymentDetails — a received repayment shows its day and the repayment list', async ({
    page,
  }) => {
    await routeRepayments(page);
    await stubHeartLookupWallet(page);
    await page.goto('/wallet/payment?id=f43f0362-edf9-4387-8edb-e18af9bb4dbc&visual=history-rows');
    await expect(page.getByText('Loan repayment')).toBeVisible();
    await expect(page.getByText('3 of 7')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Repayment list' })).toHaveAttribute(
      'href',
      '/messages/22222222-2222-4222-8222-222222222222/repayment-list',
    );
    await expect(
      page.locator('a[href="/messages/22222222-2222-4222-8222-222222222222"]'),
    ).toBeVisible();
    await expect(page.getByText('Great photo!')).toHaveCount(0);
  });
});

test.describe('POST /me/events', () => {
  test('Function: proxyMeEventsPost — 401 without a session, 204 with one', async ({ request }) => {
    expect((await request.post('/me/events', { data: { events: [] } })).status()).toBe(401);
    const token = await newMember(request);
    const res = await request.post('/me/events', {
      headers: { authorization: `Bearer ${token}` },
      data: {
        events: [{ name: 'search', at: '2026-10-07T00:00:00.000Z', path: '/shops', props: {} }],
      },
    });
    expect(res.status()).toBe(204);
    expect((await receivedEvents(request, token)).map((event) => event.name)).toEqual(['search']);
  });

  test('Function: InteractionLog — a signed-in view is recorded without its query', async ({
    page,
    request,
  }) => {
    const token = await newMember(request);
    await signIn(page, token);
    await page.goto(`/members/${MEMBER_ID}?from=test#top`);
    await expect
      .poll(async () => {
        await hidePage(page);
        return (await receivedEvents(request, token)).map((event) => event.name);
      })
      .toEqual(expect.arrayContaining(['screen_view', 'profile_opened']));
    const events = await receivedEvents(request, token);
    const opened = events.find((event) => event.name === 'profile_opened');
    expect(opened?.props).toEqual({ accountId: MEMBER_ID });
    for (const event of events) {
      expect(event.path).not.toContain('?');
      expect(event.path).not.toContain('#');
      expect(Number.isNaN(Date.parse(event.at))).toBe(false);
    }
  });

  test('Function: logInteraction — a visitor without a session sends no events', async ({
    page,
  }) => {
    const urls: string[] = [];
    page.on('request', (req) => {
      urls.push(req.url());
    });
    await page.goto('/rules');
    await page.evaluate(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(urls.some((u) => u.includes('/me/events'))).toBe(false);
  });

  test('Function: flushInteractions — hiding the page sends the queue at once', async ({
    page,
    request,
  }) => {
    const token = await newMember(request);
    await signIn(page, token);
    await page.goto('/rules');
    const sent = page.waitForRequest(
      (req) => req.url().endsWith('/me/events') && req.method() === 'POST',
    );
    await page.evaluate(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    const body = (await sent).postDataJSON() as { events: SentEvent[] };
    expect(body.events.length).toBeGreaterThan(0);
  });

  test('Function: startInteractionLog — queued events go out on the ten-second timer', async ({
    page,
    request,
  }) => {
    const token = await newMember(request);
    await signIn(page, token);
    await page.clock.install();
    await page.goto('/rules');
    const sent = page.waitForRequest(
      (req) => req.url().endsWith('/me/events') && req.method() === 'POST',
    );
    await page.clock.runFor(10_000);
    await sent;
  });

  test('Function: logInteraction — no secret ever reaches the events body', async ({
    page,
    request,
  }) => {
    const token = await newMember(request);
    await signIn(page, token);
    const bodies: string[] = [];
    page.on('request', (req) => {
      if (req.url().endsWith('/me/events')) {
        bodies.push(req.postData() ?? '');
      }
    });
    await page.goto(`/rules?phrase=${encodeURIComponent(MNEMONIC)}`);
    await expect
      .poll(async () => {
        await hidePage(page);
        return bodies.length;
      })
      .toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body).not.toContain('abandon');
      expect(body).not.toContain(token);
    }
  });

  test('Function: logLogout — log out sends the logout event with the session it ends', async ({
    page,
    request,
  }) => {
    const token = await newMember(request);
    await signIn(page, token);
    await page.goto('/rules');
    await expect
      .poll(async () => {
        await hidePage(page);
        return (await receivedEvents(request, token)).map((event) => event.name);
      })
      .toContain('screen_view');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login/);
    const names = (await receivedEvents(request, token)).map((event) => event.name);
    expect(names).toContain('logout');
    expect(names.indexOf('logout')).toBe(names.lastIndexOf('logout'));
  });
});
