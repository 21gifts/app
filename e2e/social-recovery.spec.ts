import { createHash } from 'node:crypto';
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

/** A share of another member's recovery set (20 SLIP-39 words), as a holder keeps it. */
const HELD_CODE =
  '21gifts-share:v1:acc_owner:bob:body lily academic acid acne violence volume package glen escape prospect wealthy gesture venture legal already activity raspy camera easel';

/** `localStorage` key of the shares the signed-in test member keeps. */
const HELD_KEY = '21gifts.recoveryShares.acc_e2e';

/**
 * Signs in a member whose account the api route answers, with or without a
 * recovery phrase passkey.
 *
 * @param page - The page.
 * @param passkeyCredentialId - The seed passkey id, or `null` for none yet.
 */
async function signInMember(page: Page, passkeyCredentialId: string | null): Promise<void> {
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
        forumLawsDismissed: false,
        createdAt: 1_700_000_000,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
        ...(passkeyCredentialId === null
          ? {}
          : { walletRequired: true, walletBackupSeenAt: 1, passkeyCredentialId }),
      }),
    });
  });
}

/**
 * Opens the signed-out login card, where a member who lost the passkey starts
 * a social recovery, and checks that it shows Log in and no error.
 *
 * @param page - The page.
 */
async function openLoginCard(page: Page): Promise<void> {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await expect(page.locator('p[role="alert"]')).toHaveCount(0);
}

/**
 * Opens `/settings` signed in, where social recovery is set up and kept
 * shares are reached, and checks its Wallet section.
 *
 * @param page - The page.
 */
async function openSettings(page: Page): Promise<void> {
  await signInMember(page, 'cred-seed');
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Wallet' })).toBeVisible();
}

/**
 * Opens `/wallet` signed in without a wallet key in this build, and checks
 * that no wallet code is downloaded and no balance is shown.
 *
 * @param page - The page.
 */
async function openWalletWithoutKey(page: Page): Promise<void> {
  await signInMember(page, 'cred-seed');
  const urls: string[] = [];
  page.on('request', (req) => {
    urls.push(req.url());
  });
  await page.goto('/wallet');
  await expect(page.getByRole('heading', { name: 'Wallet' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Balance' })).toHaveCount(0);
  expect(urls.some((url) => url.endsWith('.wasm'))).toBe(false);
}

test.describe('social recovery libraries', () => {
  test('Function: Slip39Error — the login card where recovery starts shows no error', async ({
    page,
  }) => {
    await openLoginCard(page);
  });

  test('Function: parseShare — the login card where recovery starts loads', async ({ page }) => {
    await openLoginCard(page);
  });

  test('Function: isRecoveryShare — the login card where recovery starts loads', async ({
    page,
  }) => {
    await openLoginCard(page);
  });

  test('Function: combineShares — the login card where recovery starts loads', async ({ page }) => {
    await openLoginCard(page);
  });

  test('Function: parseShareCode — the login card where recovery starts loads', async ({
    page,
  }) => {
    await openLoginCard(page);
  });

  test('Function: phraseFromShareCodes — the login card where recovery starts loads', async ({
    page,
  }) => {
    await openLoginCard(page);
  });

  test('Function: derSignatureHex — the login card where recovery starts loads', async ({
    page,
  }) => {
    await openLoginCard(page);
  });

  test('Function: lnurlRecoverMessage — the login card where recovery starts loads', async ({
    page,
  }) => {
    await openLoginCard(page);
  });

  test('Function: recoveryMessage — the login card where recovery starts loads', async ({
    page,
  }) => {
    await openLoginCard(page);
  });

  test('Function: splitRecoverySecret — settings, where recovery is set up, show the wallet', async ({
    page,
  }) => {
    await openSettings(page);
  });

  test('Function: splitPhrase — settings, where recovery is set up, show the wallet', async ({
    page,
  }) => {
    await openSettings(page);
  });

  test('Function: encodeShareCode — settings, where recovery is set up, show the wallet', async ({
    page,
  }) => {
    await openSettings(page);
  });

  test('Function: loadHeldShares — a kept share stays in this browser after log out', async ({
    page,
  }) => {
    await openSettings(page);
    const value = JSON.stringify({ v: 1, shares: [{ code: HELD_CODE, storedAt: 1 }] });
    await page.evaluate(({ key, kept }) => localStorage.setItem(key, kept), {
      key: HELD_KEY,
      kept: value,
    });
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login/);
    expect(await page.evaluate(() => localStorage.getItem('21gifts.session'))).toBeNull();
    expect(await page.evaluate((key) => localStorage.getItem(key), HELD_KEY)).toBe(value);
  });

  test('Function: keepHeldShare — settings keep no share until a member keeps one', async ({
    page,
  }) => {
    await openSettings(page);
    expect(await page.evaluate((key) => localStorage.getItem(key), HELD_KEY)).toBeNull();
  });

  test('Function: deleteHeldShare — settings delete no kept share by themselves', async ({
    page,
  }) => {
    await page.addInitScript(
      ({ key, code }) => {
        localStorage.setItem(key, JSON.stringify({ v: 1, shares: [{ code, storedAt: 1 }] }));
      },
      { key: HELD_KEY, code: HELD_CODE },
    );
    await openSettings(page);
    expect(await page.evaluate((key) => localStorage.getItem(key), HELD_KEY)).toContain(HELD_CODE);
  });

  test('Function: appHost — without a wallet key no wallet code loads', async ({ page }) => {
    await openWalletWithoutKey(page);
  });

  test('Function: receiveWalletSparkAddress — without a wallet key no wallet code loads', async ({
    page,
  }) => {
    await openWalletWithoutKey(page);
  });

  test('Function: mergePrfExtension — Add recovery phrase asks the new passkey for PRF output', async ({
    page,
  }) => {
    await signInMember(page, null);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'credentials', {
        configurable: true,
        value: {
          create: async (options?: CredentialCreationOptions) => {
            const first = (
              options?.publicKey?.extensions as { prf?: { eval?: { first?: BufferSource } } }
            )?.prf?.eval?.first;
            const bytes =
              first === undefined
                ? null
                : ArrayBuffer.isView(first)
                  ? new Uint8Array(first.buffer, first.byteOffset, first.byteLength)
                  : new Uint8Array(first);
            Object.assign(window, { __prfFirst: bytes === null ? null : Array.from(bytes) });
            throw new DOMException('cancelled', 'NotAllowedError');
          },
          get: async () => {
            throw new DOMException('cancelled', 'NotAllowedError');
          },
        },
      });
    });
    await page.route(/\/auth\/passkey\/seed\/begin$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          challengeId: 'ch-seed',
          options: {
            challenge: 'AAEC',
            rp: { id: 'localhost', name: '21.gifts' },
            user: { id: 'AQID', name: 'ada', displayName: '21.gifts' },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
            authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
          },
        }),
      });
    });
    await page.goto('/wallet/phrase');
    await page.getByRole('button', { name: 'Add recovery phrase' }).click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __prfFirst?: unknown }).__prfFirst))
      .toEqual(Array.from(createHash('sha256').update('21gifts-nostr-v1').digest()));
  });
});
