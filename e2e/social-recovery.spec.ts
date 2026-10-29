import { createHash } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { stubCamera } from './camera';
import { fulfillSpot } from './fx-spot';

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

  test('Function: loadHeldShares — a kept share is listed, and stays in this browser after log out', async ({
    page,
  }) => {
    await page.addInitScript(
      ({ key, code }) => {
        if (sessionStorage.getItem('e2e.seeded') === null) {
          sessionStorage.setItem('e2e.seeded', '1');
          localStorage.setItem(
            key,
            JSON.stringify({ v: 1, shares: [{ code, storedAt: 1_767_268_800_000 }] }),
          );
        }
      },
      { key: HELD_KEY, code: HELD_CODE },
    );
    await signInMember(page, 'cred-seed');
    await page.goto('/settings/held-shares');
    await expect(page.getByRole('listitem')).toHaveText(['@bobKept since Jan 1, 2026']);
    const value = await page.evaluate((key) => localStorage.getItem(key), HELD_KEY);
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login/);
    expect(await page.evaluate(() => localStorage.getItem('21gifts.session'))).toBeNull();
    expect(await page.evaluate((key) => localStorage.getItem(key), HELD_KEY)).toBe(value);
  });

  test('Function: keepHeldShare — a scanned share is kept under the signed-in member', async ({
    page,
  }) => {
    await stubCamera(page, { kind: 'qr', text: HELD_CODE });
    await signInMember(page, 'cred-seed');
    await page.goto('/settings/held-shares');
    expect(await page.evaluate((key) => localStorage.getItem(key), HELD_KEY)).toBeNull();
    await page.getByRole('button', { name: 'Keep a share' }).click();
    await expect(page.getByRole('status')).toHaveText('You now keep a share for @bob.');
    const stored = await page.evaluate((key) => localStorage.getItem(key), HELD_KEY);
    expect(JSON.parse(stored ?? 'null')).toMatchObject({ v: 1, shares: [{ code: HELD_CODE }] });
  });

  test('Function: deleteHeldShare — a confirmed delete removes the kept share', async ({
    page,
  }) => {
    await page.addInitScript(
      ({ key, code }) => {
        if (sessionStorage.getItem('e2e.seeded') === null) {
          sessionStorage.setItem('e2e.seeded', '1');
          localStorage.setItem(
            key,
            JSON.stringify({ v: 1, shares: [{ code, storedAt: 1_767_268_800_000 }] }),
          );
        }
      },
      { key: HELD_KEY, code: HELD_CODE },
    );
    await signInMember(page, 'cred-seed');
    await page.goto('/settings/held-shares');
    await page.getByRole('button', { name: 'Delete share of @bob' }).click();
    const confirm = page.getByRole('group', {
      name: 'Delete the share of @bob? Only do this when they ask.',
    });
    await confirm.getByRole('button', { name: 'Keep' }).click();
    await expect(page.getByRole('listitem')).toHaveCount(1);
    await page.getByRole('button', { name: 'Delete share of @bob' }).click();
    await confirm.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('You keep no shares for others yet.')).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), HELD_KEY)).toBeNull();
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

/** Ada's owner account as `GET /me` answers it, with a recovery passkey. */
const OWNER = {
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
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
  walletRequired: true,
  walletBackupSeenAt: 1,
  passkeyCredentialId: 'cred-seed',
};

/** Three previous wallets: a balance, an empty one, and one the explorer could not read. */
const PREVIOUS_WALLETS = [
  {
    sparkPubkey: `02${'a'.repeat(64)}`,
    sparkAddress: 'spark1old',
    replacedAt: 1_767_268_800_000,
    balanceSats: 21_000,
  },
  {
    sparkPubkey: `03${'b'.repeat(64)}`,
    sparkAddress: 'spark1older',
    replacedAt: 1_764_590_400_000,
    balanceSats: 0,
  },
  {
    sparkPubkey: `02${'c'.repeat(64)}`,
    sparkAddress: 'spark1oldest',
    replacedAt: 1_761_998_400_000,
    balanceSats: null,
  },
];

/**
 * Signs Ada in with these account fields on top of {@link OWNER}.
 *
 * @param page - The page.
 * @param extra - Account fields to set.
 */
async function signInOwner(page: Page, extra: Record<string, unknown> = {}): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...OWNER, ...extra }),
    });
  });
}

/**
 * Answers `GET /me/previous-wallets` with the given answers in turn; the last
 * one repeats.
 *
 * @param page - The page.
 * @param answers - Status and body of each answer.
 * @returns How many times the list was read.
 */
async function answerPreviousWallets(
  page: Page,
  answers: ReadonlyArray<{ status: number; body: unknown }>,
): Promise<() => number> {
  let reads = 0;
  await page.route(/\/me\/previous-wallets$/, async (route) => {
    const answer = answers[Math.min(reads, answers.length - 1)]!;
    reads += 1;
    await route.fulfill({
      status: answer.status,
      contentType: 'application/json',
      body: JSON.stringify(answer.body),
    });
  });
  return () => reads;
}

test.describe('social recovery in the settings', () => {
  test('Function: SocialRecoveryRow — without a connected wallet only the kept shares open', async ({
    page,
  }) => {
    await signInOwner(page);
    const reads = await answerPreviousWallets(page, [{ status: 200, body: { wallets: [] } }]);
    await page.goto('/settings');
    const row = page.locator('#social-recovery');
    await expect(row.getByText('Social Recovery', { exact: true })).toBeVisible();
    await expect(row.getByText('Available once your wallet is connected.')).toBeVisible();
    await expect(row.getByRole('link', { name: 'Secure my account' })).toHaveCount(0);
    await row.getByRole('link', { name: 'Shares I keep for others' }).click();
    await expect(page).toHaveURL(/\/settings\/held-shares$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Shares I keep for others' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Back', exact: true }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.locator('#social-recovery')).toBeVisible();
    expect(reads()).toBe(0);
  });

  test('Function: SettingsScreen — the Social Recovery row says whether it is set up for this wallet', async ({
    page,
  }) => {
    await signInOwner(page, { sparkWalletVerified: true, socialRecoverySetUp: false });
    await answerPreviousWallets(page, [{ status: 200, body: { wallets: [] } }]);
    await page.goto('/settings');
    const row = page.locator('#social-recovery');
    await expect(
      row.getByText('Not set up yet. Two people you trust can help you get your account back.'),
    ).toBeVisible();
    await expect(row.getByRole('link', { name: 'Secure my account' })).toHaveAttribute(
      'href',
      '/settings/social-recovery',
    );
    await expect(page.locator('#previous-wallets')).toHaveCount(0);
  });

  test('the Social Recovery row says it is set up once 21.gifts keeps the share', async ({
    page,
  }) => {
    await signInOwner(page, { sparkWalletVerified: true, socialRecoverySetUp: true });
    await answerPreviousWallets(page, [{ status: 200, body: { wallets: [] } }]);
    await page.goto('/settings');
    const row = page.locator('#social-recovery');
    await expect(row.getByText('Set up for this wallet.')).toBeVisible();
    await expect(row.getByRole('link', { name: 'Secure my account' })).toBeVisible();
    await expect(row.getByRole('link', { name: 'Shares I keep for others' })).toBeVisible();
  });

  test('Function: PreviousWalletsRow — every previous wallet shows its balance and one transfer link, never a remove', async ({
    page,
  }) => {
    await signInOwner(page, { sparkWalletVerified: true, socialRecoverySetUp: true });
    await fulfillSpot(page);
    await answerPreviousWallets(page, [{ status: 200, body: { wallets: PREVIOUS_WALLETS } }]);
    await page.goto('/settings');
    const row = page.locator('#previous-wallets');
    await expect(row.getByText('Previous wallets', { exact: true })).toBeVisible();
    const items = row.getByRole('listitem');
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText('Replaced on Jan 1, 2026');
    await expect(items.nth(0)).toContainText("₿21'000 · $21.00");
    await expect(items.nth(1)).toContainText('Empty');
    await expect(items.nth(2)).toContainText('Balance unknown');
    const links = row.getByRole('link', { name: 'Transfer remaining balance' });
    await expect(links).toHaveCount(3);
    for (const [index, wallet] of PREVIOUS_WALLETS.entries()) {
      await expect(links.nth(index)).toHaveAttribute(
        'href',
        `/settings/previous-wallets/${wallet.sparkPubkey}`,
      );
    }
    await expect(row.getByRole('button')).toHaveCount(0);
    await expect(page.getByText(/Remove/)).toHaveCount(0);
    await expect(row).not.toContainText('spark1');
  });

  test('Function: usePreviousWallets — a failed list shows the alert, and Try again reads it again', async ({
    page,
  }) => {
    await signInOwner(page, { sparkWalletVerified: true, socialRecoverySetUp: true });
    const reads = await answerPreviousWallets(page, [
      { status: 503, body: { error: 'Wallet data is unavailable' } },
      { status: 200, body: { wallets: [PREVIOUS_WALLETS[1]] } },
    ]);
    await page.goto('/settings');
    const row = page.locator('#previous-wallets');
    await expect(row.getByRole('alert')).toHaveText('Previous wallets could not be loaded.');
    await row.getByRole('button', { name: 'Try again' }).click();
    await expect(row.getByRole('listitem')).toHaveCount(1);
    await expect(row.getByRole('alert')).toHaveCount(0);
    expect(reads()).toBe(2);
  });

  test('/settings#previous-wallets scrolls to the previous wallets once they loaded', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 640 });
    await signInOwner(page, { sparkWalletVerified: true, socialRecoverySetUp: true });
    await fulfillSpot(page);
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/me\/previous-wallets$/, async (route) => {
      await held;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ wallets: PREVIOUS_WALLETS }),
      });
    });
    await page.goto('/settings#previous-wallets');
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect(page.locator('#previous-wallets')).toHaveCount(0);
    release();
    const row = page.locator('#previous-wallets');
    await expect(row.getByRole('listitem')).toHaveCount(3);
    await expect
      .poll(async () => {
        const box = await row.boundingBox();
        const port = await page.locator('main [data-scrollport]').boundingBox();
        return box !== null && port !== null ? Math.round(box.y - port.y) : null;
      })
      .toBeLessThan(40);
    expect(
      await page.locator('main [data-scrollport]').evaluate((node) => node.scrollTop),
    ).toBeGreaterThan(0);
  });
});

test.describe('shares kept for others', () => {
  /** A share of another set (official SLIP-39 vector 43), kept for Cara. */
  const CARA_CODE =
    '21gifts-share:v1:acc_cara:cara:enemy favorite academic acid cowboy phrase havoc level response walnut budget painting inside trash adjust froth kitchen learn tidy punish';

  test('Function: HeldSharesPage — /settings/held-shares lists no shares for a new holder', async ({
    page,
  }) => {
    await signInOwner(page);
    await page.goto('/settings/held-shares');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Shares I keep for others' }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Someone chose you to help restore their account. Keep their share here. Show it only to them, in person, when they ask.',
      ),
    ).toBeVisible();
    await expect(page.getByText('You keep no shares for others yet.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Keep a share' })).toBeVisible();
  });

  test('Function: HeldSharesScreen — the code of a kept share is shown for its owner, and Back returns to the list', async ({
    page,
  }) => {
    await page.addInitScript(
      ({ key, codes }) => {
        localStorage.setItem(
          key,
          JSON.stringify({
            v: 1,
            shares: codes.map((code, index) => ({
              code,
              storedAt: 1_767_268_800_000 + index * 86_400_000,
            })),
          }),
        );
      },
      { key: HELD_KEY, codes: [HELD_CODE, CARA_CODE] },
    );
    await signInOwner(page);
    await page.goto('/settings/held-shares');
    await expect(page.getByRole('listitem')).toHaveText([
      '@caraKept since Jan 2, 2026',
      '@bobKept since Jan 1, 2026',
    ]);
    const show = page.getByRole('button', { name: 'Show code for @bob' });
    await expect(page.getByText('Show code for @bob')).toHaveCount(0);
    await show.click();
    await expect(page.getByRole('heading', { level: 2, name: 'Share of @bob' })).toBeVisible();
    await expect(
      page.getByText('Show this code only to @bob in person, so they can restore their account.'),
    ).toBeVisible();
    await expect(page.getByRole('img', { name: 'Share code' })).toBeVisible();
    await page.getByRole('link', { name: 'Back to the forum' }).click();
    await expect(page).toHaveURL(/\/settings\/held-shares$/);
    await expect(page.getByRole('listitem')).toHaveCount(2);
  });

  test("Function: useHeldShares — a share of the member's own account is refused and nothing is kept", async ({
    page,
  }) => {
    await stubCamera(page, { kind: 'qr', text: HELD_CODE.replace('acc_owner:bob', 'acc_e2e:ada') });
    await signInOwner(page);
    await page.goto('/settings/held-shares');
    await page.getByRole('button', { name: 'Keep a share' }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText(
      'This is a share of your own account. Only other people can keep it.',
    );
    expect(await page.evaluate((key) => localStorage.getItem(key), HELD_KEY)).toBeNull();
  });

  test('a second share of one setup is refused, also when another account in this browser keeps it', async ({
    page,
  }) => {
    await stubCamera(page, { kind: 'qr', text: HELD_CODE });
    await page.addInitScript(
      ({ code }) => {
        localStorage.setItem(
          '21gifts.recoveryShares.acc_other',
          JSON.stringify({ v: 1, shares: [{ code, storedAt: 1_767_268_800_000 }] }),
        );
      },
      { code: HELD_CODE },
    );
    await signInOwner(page);
    await page.goto('/settings/held-shares');
    await page.getByRole('button', { name: 'Keep a share' }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText(
      'This phone already keeps a share of this setup for @bob. One phone keeps only one share of a setup.',
    );
    await expect(page.getByText('You keep no shares for others yet.')).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), HELD_KEY)).toBeNull();
  });

  test('a scanned text that is not a share is refused, and the camera stops', async ({ page }) => {
    await stubCamera(page, { kind: 'qr', text: 'https://example.com/not-a-share' });
    await signInOwner(page);
    await page.goto('/settings/held-shares');
    await page.getByRole('button', { name: 'Keep a share' }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText('This is not a Social Recovery code.');
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { __cameraStub: { live: number } }).__cameraStub.live,
        ),
      )
      .toBe(0);
  });

  test('the camera layer says how to scan, and Back returns to the list', async ({ page }) => {
    await stubCamera(page, { kind: 'blank' });
    await signInOwner(page);
    await page.goto('/settings/held-shares');
    await page.getByRole('button', { name: 'Keep a share' }).click();
    await expect(
      page.getByRole('region', { name: 'Point the camera at the code on the other phone' }),
    ).toBeVisible();
    await expect(page.getByText('Point the camera at a Bitcoin QR code')).toHaveCount(0);
    await page.getByRole('link', { name: 'Back to the forum' }).click();
    await expect(page.getByRole('button', { name: 'Keep a share' })).toBeVisible();
    await expect(page).toHaveURL(/\/settings\/held-shares$/);
  });

  test('a blocked camera says how to allow it', async ({ page }) => {
    await stubCamera(page, { kind: 'denied' });
    await signInOwner(page);
    await page.goto('/settings/held-shares');
    await page.getByRole('button', { name: 'Keep a share' }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText(
      'Camera access is off. Allow the camera to scan the code.',
    );
  });

  test('a device without a camera says to use a phone with one', async ({ page }) => {
    await stubCamera(page, { kind: 'none' });
    await signInOwner(page);
    await page.goto('/settings/held-shares');
    await page.getByRole('button', { name: 'Keep a share' }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText(
      'No camera found. Use a phone with a camera to scan the code.',
    );
  });
});

test.describe('the Social Recovery prompt on the forum home', () => {
  /** The admitted grant of a member. */
  const ADMITTED = {
    status: 'admitted',
    trialUtcDate: null,
    admittedAt: 1_700_000_000_000,
    reviewedByName: 'Mod',
  };

  /**
   * Answers the forum lists with no notes.
   *
   * @param page - The page.
   */
  async function emptyForum(page: Page): Promise<void> {
    await page.route(/\/messages(?:\?|$)/, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [] }),
      });
    });
  }

  test('Function: SocialRecoveryPromptOverlay — a grant member without Social Recovery is asked on /welcome', async ({
    page,
  }) => {
    await signInOwner(page, { hasPosted: true, socialRecoverySetUp: false, funding: ADMITTED });
    await emptyForum(page);
    await page.goto('/welcome');
    const dialog = page.getByRole('dialog', { name: 'Social Recovery for your grant' });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(
        'Grant payouts need Social Recovery. Choose two people who can help you restore your account if you lose your passkey.',
      ),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.locator('#signed-in-menu').getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(dialog).toHaveCount(0);
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.locator('#signed-in-menu').getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Secure my account' }).click();
    await expect(page).toHaveURL(/\/settings\/social-recovery$/);
  });

  test('Introduce yourself comes first, then the Social Recovery prompt', async ({ page }) => {
    await signInOwner(page, { hasPosted: false, socialRecoverySetUp: false, funding: ADMITTED });
    await emptyForum(page);
    await page.goto('/welcome');
    const introduce = page.getByRole('dialog', { name: 'Introduce yourself' });
    await expect(introduce).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Social Recovery for your grant' })).toHaveCount(
      0,
    );
    await introduce.getByRole('button', { name: 'Close' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Social Recovery for your grant' }),
    ).toBeVisible();
  });

  test('Write an introduction opens the writer, and the Social Recovery prompt does not cover it', async ({
    page,
  }) => {
    await signInOwner(page, { hasPosted: false, socialRecoverySetUp: false, funding: ADMITTED });
    await emptyForum(page);
    await page.goto('/welcome');
    await page
      .getByRole('dialog', { name: 'Introduce yourself' })
      .getByRole('button', { name: 'Write an introduction' })
      .click();
    await expect(page.getByLabel('Your message')).toBeFocused();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('no Social Recovery prompt once it is set up', async ({ page }) => {
    await signInOwner(page, { hasPosted: true, socialRecoverySetUp: true, funding: ADMITTED });
    await emptyForum(page);
    await page.goto('/welcome');
    await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  /** A funding object without a grant; each case below sets its status. */
  const NO_GRANT = { status: 'none', trialUtcDate: null, admittedAt: null, reviewedByName: null };

  for (const [label, funding] of [
    ['a pending application', { ...NO_GRANT, status: 'pending' }],
    ['a rejected application', { ...NO_GRANT, status: 'rejected' }],
    ['no application', NO_GRANT],
    ['no funding object (basis)', null],
  ] as const) {
    test(`no Social Recovery prompt without a grant: ${label}`, async ({ page }) => {
      await signInOwner(page, { hasPosted: true, socialRecoverySetUp: false, funding });
      await emptyForum(page);
      await page.goto('/welcome');
      await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });
  }
});

test('the phrase screen warns that the 12 words take over the whole account', async ({ page }) => {
  await signInOwner(page);
  await page.goto('/wallet/phrase?visual=phrase');
  await expect(page.getByText('abandon').first()).toBeVisible();
  await expect(
    page.getByText(
      'Keep these 12 words secret. Whoever has them can take over your whole account, not only the wallet.',
    ),
  ).toBeVisible();
  await expect(page.getByText(/21\.gifts cannot recover/)).toHaveCount(0);
});
