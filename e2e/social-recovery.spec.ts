import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/** The Playwright build's id, which the stub api requires on every passkey step. */
const APP_BUILD = { 'x-app-build': 'dev' };

/** The build id plus the app's origin, which a passkey finish also needs. */
const FINISH_HEADERS = { ...APP_BUILD, origin: 'http://localhost:3000' };

const OLD_KEY = `02${'a'.repeat(64)}`;
const NEW_KEY = `03${'b'.repeat(64)}`;

/** Lowercase hex of a 70-byte DER signature, as the lookup carries it. */
const LOOKUP_SIGNATURE = `30440220${'ab'.repeat(32)}0220${'cd'.repeat(32)}`;

/** A well-formed recovery begin of an old wallet the stub api does not know. */
const BEGIN_BODY = {
  sparkPubkey: OLD_KEY,
  lookup: { signature: LOOKUP_SIGNATURE, timestamp: 1_761_700_000 },
};

/** A well-formed recovery finish without a begun recovery. */
const FINISH_BODY = {
  challengeId: 'c'.repeat(64),
  credential: { id: 'cred-new', rawId: 'cred-new', type: 'public-key' },
  newSparkPubkey: NEW_KEY,
  signature: { pubkey: OLD_KEY, signature: 'd'.repeat(128) },
};

/**
 * Opens a new account on the api stub.
 *
 * @param request - Request context of the test.
 * @returns The session token.
 */
async function newSession(request: APIRequestContext): Promise<string> {
  const begin = await request.post('/auth/passkey/register/begin', { headers: APP_BUILD });
  expect(begin.status()).toBe(200);
  const started = (await begin.json()) as { challengeId: string };
  const finish = await request.post('/auth/passkey/register/finish', {
    headers: FINISH_HEADERS,
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
  return ((await finish.json()) as { token: string }).token;
}

/**
 * Lets the login passkey answer, spies on `signalUnknownCredential`, and
 * answers authenticate finish with the api's `recovery_pending` refusal.
 *
 * @param page - The page.
 */
async function answerRecoveryPending(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const signals: unknown[] = [];
    Object.assign(window, { __unknownCredentialSignals: signals });
    const pk = globalThis.PublicKeyCredential as unknown as {
      parseRequestOptionsFromJSON?: unknown;
      signalUnknownCredential?: unknown;
    };
    if (typeof pk === 'function' || (typeof pk === 'object' && pk !== null)) {
      Object.defineProperty(pk, 'parseRequestOptionsFromJSON', {
        value: undefined,
        configurable: true,
      });
      Object.defineProperty(pk, 'signalUnknownCredential', {
        value: async (options: unknown) => {
          signals.push(options);
        },
        configurable: true,
      });
    }
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: {
        create: async () => {
          throw new Error('create must not run on the login path');
        },
        get: async () => ({
          id: 'cred-new',
          type: 'public-key',
          toJSON() {
            return {
              id: 'cred-new',
              rawId: 'cred-new',
              type: 'public-key',
              response: {},
              clientExtensionResults: {},
            };
          },
        }),
      },
    });
  });
  await page.route(/\/auth\/passkey\/authenticate\/begin$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        challengeId: 'ch',
        options: { challenge: 'aa', rpId: 'localhost', userVerification: 'required' },
      }),
    });
  });
  await page.route(/\/auth\/passkey\/authenticate\/finish$/, async (route) => {
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Recovery is not finished', code: 'recovery_pending' }),
    });
  });
}

test.describe('social recovery endpoints', () => {
  test('Function: proxyAuthPasskeyRecoveryBeginPost — begin is forwarded with the build id', async ({
    request,
  }) => {
    const outdated = await request.post('/auth/passkey/recovery/begin', { data: BEGIN_BODY });
    expect(outdated.status()).toBe(403);
    expect(((await outdated.json()) as { code: string }).code).toBe('app_outdated');
    const malformed = [
      { sparkPubkey: OLD_KEY },
      { ...BEGIN_BODY, words: 'extra' },
      { ...BEGIN_BODY, sparkPubkey: `04${'a'.repeat(64)}` },
      { ...BEGIN_BODY, lookup: { ...BEGIN_BODY.lookup, signature: '3044' } },
      {
        ...BEGIN_BODY,
        lookup: { ...BEGIN_BODY.lookup, signature: LOOKUP_SIGNATURE.toUpperCase() },
      },
      { ...BEGIN_BODY, lookup: { ...BEGIN_BODY.lookup, timestamp: -1 } },
      { ...BEGIN_BODY, lookup: { ...BEGIN_BODY.lookup, timestamp: 1.5 } },
      { ...BEGIN_BODY, lookup: { ...BEGIN_BODY.lookup, extra: true } },
    ];
    for (const data of malformed) {
      const response = await request.post('/auth/passkey/recovery/begin', {
        headers: APP_BUILD,
        data,
      });
      expect(response.status(), JSON.stringify(data)).toBe(400);
      expect(await response.json()).toEqual({
        error: 'Expected a JSON body with sparkPubkey and lookup',
      });
    }
  });

  test('Function: startPasskeyRecovery — an old wallet without an account is not found', async ({
    request,
  }) => {
    // The api normalizes the key, so padding and upper case still look it up.
    for (const sparkPubkey of [OLD_KEY, ` ${OLD_KEY.toUpperCase()} `]) {
      const response = await request.post('/auth/passkey/recovery/begin', {
        headers: APP_BUILD,
        data: { ...BEGIN_BODY, sparkPubkey },
      });
      expect(response.status(), sparkPubkey).toBe(404);
      expect(await response.json()).toEqual({ error: 'Not found' });
    }
  });

  test('Function: proxyAuthPasskeyRecoveryFinishPost — finish is forwarded with the build id', async ({
    request,
  }) => {
    const outdated = await request.post('/auth/passkey/recovery/finish', {
      headers: { 'x-app-build': 'other-build' },
      data: FINISH_BODY,
    });
    expect(outdated.status()).toBe(403);
    expect(((await outdated.json()) as { code: string }).code).toBe('app_outdated');
    const malformed = [
      { challengeId: 'c'.repeat(64) },
      { ...FINISH_BODY, extra: true },
      { ...FINISH_BODY, newSparkPubkey: `04${'b'.repeat(64)}` },
      { ...FINISH_BODY, signature: { ...FINISH_BODY.signature, pubkey: 'a'.repeat(66) } },
      { ...FINISH_BODY, signature: { ...FINISH_BODY.signature, extra: true } },
    ];
    for (const data of malformed) {
      const response = await request.post('/auth/passkey/recovery/finish', {
        headers: APP_BUILD,
        data,
      });
      expect(response.status(), JSON.stringify(data)).toBe(400);
      expect(await response.json()).toEqual({
        error: 'Expected a JSON body with challengeId, credential, newSparkPubkey and signature',
      });
    }
  });

  test('Function: finishPasskeyRecovery — a finish without a begun recovery is refused', async ({
    request,
  }) => {
    const foreign = await request.post('/auth/passkey/recovery/finish', {
      headers: APP_BUILD,
      data: FINISH_BODY,
    });
    expect(foreign.status()).toBe(400);
    expect(await foreign.json()).toEqual({ error: 'Invalid origin' });
    const response = await request.post('/auth/passkey/recovery/finish', {
      headers: FINISH_HEADERS,
      data: FINISH_BODY,
    });
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: 'Unknown or expired challenge' });
  });

  test('Function: RecoveryError — begin and finish refusals carry status and text', async ({
    request,
  }) => {
    const begin = await request.post('/auth/passkey/recovery/begin', {
      headers: APP_BUILD,
      data: BEGIN_BODY,
    });
    expect(begin.status()).toBe(404);
    const finish = await request.post('/auth/passkey/recovery/finish', {
      headers: FINISH_HEADERS,
      data: FINISH_BODY,
    });
    expect(finish.status()).toBe(400);
    expect(((await finish.json()) as { error: string }).error).toBe('Unknown or expired challenge');
  });

  test('Function: proxyLnurlpayTransferPost — the address claim is forwarded to the api', async ({
    request,
  }) => {
    expect((await request.post('/lnurlpay/[pubkey]/transfer')).status()).toBe(404);
    const response = await request.post(`/lnurlpay/${NEW_KEY}/transfer`, {
      data: {
        username: 'ada',
        description: 'ada',
        from_pubkey: OLD_KEY,
        from_signature: '3044',
        to_signature: '3045',
        timestamp: 1_761_700_000,
      },
    });
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });

  test('Function: proxyMeRecoverySharePut — put without a session is 401', async ({ request }) => {
    expect((await request.put('/me/recovery-share')).status()).toBe(401);
    const unknown = await request.put('/me/recovery-share', {
      headers: { Authorization: 'Bearer not-a-session' },
      data: { sparkPubkey: OLD_KEY, share: 'academic acid' },
    });
    expect(unknown.status()).toBe(401);
  });

  test('Function: putRecoveryShare — a stored share marks the account set up', async ({
    request,
  }) => {
    const token = await newSession(request);
    const auth = { Authorization: `Bearer ${token}` };
    const stored = await request.put('/me/recovery-share', {
      headers: auth,
      data: { sparkPubkey: OLD_KEY, share: 'academic acid' },
    });
    expect(stored.status()).toBe(200);
    expect(((await stored.json()) as { socialRecoverySetUp?: boolean }).socialRecoverySetUp).toBe(
      true,
    );
    const me = await request.get('/me', { headers: auth });
    expect(((await me.json()) as { socialRecoverySetUp?: boolean }).socialRecoverySetUp).toBe(true);
  });

  test('Function: proxyMePreviousWalletsGet — list without a session is 401', async ({
    request,
  }) => {
    expect((await request.get('/me/previous-wallets')).status()).toBe(401);
  });

  test('Function: fetchPreviousWallets — a new account has no previous wallets', async ({
    request,
  }) => {
    const token = await newSession(request);
    const response = await request.get('/me/previous-wallets', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ wallets: [] });
  });

  test('Function: proxyMePreviousWalletDelete — delete without a session is 401', async ({
    request,
  }) => {
    expect((await request.delete('/me/previous-wallets/[sparkPubkey]')).status()).toBe(401);
  });

  test('Function: deletePreviousWallet — a dropped wallet answers 204 with no body', async ({
    request,
  }) => {
    const token = await newSession(request);
    const response = await request.delete(`/me/previous-wallets/${OLD_KEY}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status()).toBe(204);
    expect(await response.text()).toBe('');
  });
});

test('Function: RecoveryPendingError — the pending passkey is never signalled unknown', async ({
  page,
}) => {
  await answerRecoveryPending(page);
  const finished = page.waitForResponse((response) =>
    response.url().endsWith('/auth/passkey/authenticate/finish'),
  );
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  expect((await finished).status()).toBe(409);
  await expect(page.locator('p[role="alert"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'This passkey is not an account' })).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __unknownCredentialSignals: unknown[] }).__unknownCredentialSignals,
    ),
  ).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('21gifts.session'))).toBeNull();
});
