import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

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
  const begin = await request.post('/auth/passkey/register/begin');
  expect(begin.status()).toBe(200);
  const started = (await begin.json()) as { challengeId: string };
  const finish = await request.post('/auth/passkey/register/finish', {
    headers: { origin: 'http://localhost:3000' },
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
});
