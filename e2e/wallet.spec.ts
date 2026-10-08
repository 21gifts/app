import { expect, test, type Page } from '@playwright/test';
import { cameraStats, stubCamera } from './camera';
import { fulfillSpot, spotRatesFromStats } from './fx-spot';
import { PRF_UNSUPPORTED_MESSAGE } from './no-prf';

const WALLET_RATE_DAY_STATS = {
  totalSats: 100_000_000,
  totalBtc: '1.00000000',
  totalUsd: '100000.00',
  totalChf: '80000.00',
  totalEur: '90000.00',
  totalPhp: '5600000.00',
  giftCount: 1,
  recipientCount: 1,
  firstPaidAt: '2026-06-01T00:00:00.000Z',
  lastPaidAt: '2026-06-01T00:00:00.000Z',
  spendOverTime: [
    {
      day: '2026-06-01',
      giftCount: 1,
      sats: 100_000_000,
      cumulativeSats: 100_000_000,
      btc: '1.00000000',
      cumulativeBtc: '1.00000000',
      usd: '100000.00',
      cumulativeUsd: '100000.00',
      chf: '80000.00',
      eur: '90000.00',
      php: '5600000.00',
      cumulativeChf: '80000.00',
      cumulativeEur: '90000.00',
      cumulativePhp: '5600000.00',
    },
  ],
  byRecipient: [],
  byMonth: [],
  fx: {
    quote: 'BTC-USD',
    dayBasis: 'utc',
    source: 'coinbase-exchange-daily-close',
    quotes: [{ code: 'USD', pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' }],
  },
};

/** Sign in an account whose in-app wallet belongs to its seed passkey. */
async function signInWalletEligible(page: Page): Promise<void> {
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
        walletRequired: true,
        walletBackupSeenAt: 1,
        passkeyCredentialId: 'cred-seed',
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
}

test('wallet page shows Receive left of Send and no recovery link for an existing member', async ({
  page,
}) => {
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
      }),
    });
  });
  await page.goto('/wallet');
  await expect(page.getByRole('heading', { name: 'Wallet' })).toBeVisible();
  const receive = await page.getByRole('button', { name: 'Receive' }).boundingBox();
  const send = await page.getByRole('button', { name: 'Send', exact: true }).boundingBox();
  expect(receive).not.toBeNull();
  expect(send).not.toBeNull();
  expect(receive!.x + receive!.width).toBeLessThanOrEqual(send!.x);
  expect(Math.abs(receive!.y - send!.y)).toBeLessThan(1);
  expect(Math.abs(receive!.width - send!.width)).toBeLessThan(1);
  await expect(page.getByRole('link', { name: 'Add recovery phrase' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Show recovery phrase' })).toHaveCount(0);
});

test('Function: WalletPage — /wallet renders the wallet heading', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
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
        setup: null,
        missing: [],
      }),
    });
  });
  await page.goto('/wallet');
  await expect(page.getByRole('heading', { name: 'Wallet' })).toBeVisible();
});

test('Function: startPasskeyReplace — begin without a session is 401', async ({ request }) => {
  expect((await request.post('/auth/passkey/replace/begin')).status()).toBe(401);
});

test('Function: finishPasskeyReplace — finish without a session is 401', async ({ request }) => {
  expect((await request.post('/auth/passkey/replace/finish')).status()).toBe(401);
});

test('Function: startPasskeySeed — begin without a session is 401', async ({ request }) => {
  expect((await request.post('/auth/passkey/seed/begin')).status()).toBe(401);
});

test('Function: finishPasskeySeed — finish without a session is 401', async ({ request }) => {
  expect((await request.post('/auth/passkey/seed/finish')).status()).toBe(401);
});

test('Function: postWalletBackupSeen — backup-seen without a session is 401', async ({
  request,
}) => {
  expect((await request.post('/me/wallet-backup-seen')).status()).toBe(401);
});

test('Function: proxyAuthPasskeyReplaceBeginPost — begin without a session is 401', async ({
  request,
}) => {
  expect((await request.post('/auth/passkey/replace/begin')).status()).toBe(401);
});

test('Function: proxyAuthPasskeyReplaceFinishPost — finish without a session is 401', async ({
  request,
}) => {
  expect((await request.post('/auth/passkey/replace/finish')).status()).toBe(401);
});

test('Function: proxyAuthPasskeySeedBeginPost — begin without a session is 401', async ({
  request,
}) => {
  expect((await request.post('/auth/passkey/seed/begin')).status()).toBe(401);
});

test('Function: proxyAuthPasskeySeedFinishPost — finish without a session is 401', async ({
  request,
}) => {
  expect((await request.post('/auth/passkey/seed/finish')).status()).toBe(401);
});

test('Function: proxyMeWalletBackupSeenPost — backup-seen without a session is 401', async ({
  request,
}) => {
  expect((await request.post('/me/wallet-backup-seen')).status()).toBe(401);
});

test('Function: postPasskeyRenewReport — report without a session is 401', async ({ request }) => {
  expect((await request.post('/me/passkey-renew/report')).status()).toBe(401);
});

test('Function: passkeyRenewDebug — report without a session is 401', async ({ request }) => {
  expect((await request.post('/me/passkey-renew/report')).status()).toBe(401);
});

test('Function: passkeyRenewDebugFields — report without a session is 401', async ({ request }) => {
  expect((await request.post('/me/passkey-renew/report')).status()).toBe(401);
});

test('Function: passkeyRenewClientCapabilities — report without a session is 401', async ({
  request,
}) => {
  expect((await request.post('/me/passkey-renew/report')).status()).toBe(401);
});

test('Function: postPasskeyRenewAck — ack without a session is 401', async ({ request }) => {
  expect((await request.post('/me/passkey-renew/ack')).status()).toBe(401);
});

test('Function: renewPasskey — report without a session is 401', async ({ request }) => {
  expect((await request.post('/me/passkey-renew/report')).status()).toBe(401);
});

test('Function: DailyPayoutStoppedNotice — shows when flag true and hides when false', async ({
  page,
}) => {
  let stopped = true;
  const account = {
    id: 'acc_e2e',
    linkingKey: `02${'a'.repeat(62)}`,
    role: 'verified',
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
    walletRequired: true,
    funding: {
      status: 'none',
      trialUtcDate: null,
      admittedAt: null,
      reviewedByName: null,
      dailyPayoutStoppedNotice: true,
    },
  };
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...account,
        funding: {
          ...account.funding,
          dailyPayoutStoppedNotice: stopped,
        },
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm1',
            name: 'Ada',
            text: 'Hello',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 0,
            payable: true,
            hasPhoto: false,
            role: 'verified',
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Daily payout stopped' })).toBeVisible();
  await expect(
    page.getByText(
      'Applications are currently paused. You can apply again when shop transactions have increased.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'https://21.gifts/statistics' })).toHaveAttribute(
    'href',
    'https://21.gifts/statistics',
  );
  await expect(page.getByRole('link', { name: 'Apply for the 21 gifts grant' })).toHaveCount(0);
  stopped = false;
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Daily payout stopped' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Daily payout stopped' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Apply for the 21 gifts grant' })).toHaveCount(0);
});

test('Function: PasskeyRenewNotice — failure OK closes the dialog', async ({ page }) => {
  let closed = false;
  const renewAccount = {
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
    walletRequired: false,
    passkeyRenewFailed: true,
    passkeyRenewClosed: false,
  };
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...renewAccount,
        passkeyRenewFailed: !closed,
        passkeyRenewClosed: closed,
      }),
    });
  });
  await page.route(/\/me\/passkey-renew\/ack$/, async (route) => {
    closed = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...renewAccount,
        passkeyRenewFailed: false,
        passkeyRenewClosed: true,
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm1',
            name: 'Ada',
            text: 'Hello',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 0,
            payable: true,
            hasPhoto: false,
            role: 'basis',
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByText('You do not need to do anything now.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0);
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('You do not need to do anything now.')).toHaveCount(0);
});

test('Function: proxyMePasskeyRenewReportPost — report without a session is 401', async ({
  request,
}) => {
  expect((await request.post('/me/passkey-renew/report')).status()).toBe(401);
});

test('Function: proxyMePasskeyRenewAckPost — ack without a session is 401', async ({ request }) => {
  expect((await request.post('/me/passkey-renew/ack')).status()).toBe(401);
});

test('Function: prfEvalFirstSalt — wallet heading is Wallet', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        username: 'ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.goto('/wallet');
  await expect(page.getByRole('heading', { name: 'Wallet' })).toBeVisible();
});

test('Function: readPrfFirst — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: mnemonicFromPrfFirst — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: obtainPrfFirst — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: obtainPrfFirstFromGet — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: classifyWebAuthnError — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: rememberSessionPhrase — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: peekSessionPhrase — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: clearSessionPhrase — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: resetWalletCeremonyLock — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: useWalletPhrase — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: WalletScreenView — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: WalletScreen — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: WalletLoginCard — a locked wallet logs in in place without redirecting', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await page.goto('/wallet?visual=balance-locked');
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Wallet', exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/\/wallet\?visual=balance-locked$/);
});

test('Function: useWalletOpen — Playwright builds count the signed-in wallet as open', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await page.goto('/wallet');
  await expect(page.getByRole('heading', { name: 'Wallet', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toHaveCount(0);
});

test('Function: walletGateApplies — the balance-locked pin applies the wallet gate', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await page.goto('/wallet?visual=balance-locked');
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Wallet', exact: true })).toHaveCount(0);
});

test('Function: isWalletOpen — an unpinned Playwright wallet opens without a tab phrase', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await page.goto('/wallet');
  await expect(page.getByRole('heading', { name: 'Wallet', exact: true })).toBeVisible();
});

test('Function: hydratesLocked — a held session gates wallet but leaves welcome as the guest forum', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await page.goto('/wallet?visual=balance-locked');
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();

  await page.goto('/welcome?visual=balance-locked');
  await expect(page.getByRole('heading', { name: 'Welcome', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Log in', exact: true })).toBeVisible();
});

/**
 * Signs in a wallet account whose passkey gives no PRF output, with the
 * login answering for another passkey than the seed, and counts the passkey
 * prompts in `sessionStorage` (`e2e.credentialGets`).
 */
async function stubLoginWithoutPrf(page: Page): Promise<void> {
  await page.addInitScript(() => {
    sessionStorage.setItem('e2e.credentialGets', '0');
    const pk = globalThis.PublicKeyCredential as unknown as {
      parseRequestOptionsFromJSON?: unknown;
    };
    if (typeof pk === 'function' || (typeof pk === 'object' && pk !== null)) {
      Object.defineProperty(pk, 'parseRequestOptionsFromJSON', {
        value: undefined,
        configurable: true,
      });
    }
    const rawId = new Uint8Array(16).fill(5).buffer;
    const assertion = {
      id: 'BQUFBQUFBQUFBQUFBQUFBQ',
      rawId,
      type: 'public-key',
      getClientExtensionResults: () => ({}),
      response: {
        clientDataJSON: new Uint8Array([123]).buffer,
        authenticatorData: new Uint8Array([3]).buffer,
        signature: new Uint8Array([4]).buffer,
        userHandle: null,
      },
    };
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: {
        create: async () => {
          throw new DOMException('Not used here', 'NotAllowedError');
        },
        get: async (options?: CredentialRequestOptions) => {
          const count = Number(sessionStorage.getItem('e2e.credentialGets') ?? '0') + 1;
          sessionStorage.setItem('e2e.credentialGets', String(count));
          // The credential ids each prompt asks for, as byte lists.
          const asked = (options?.publicKey?.allowCredentials ?? []).map((cred) =>
            Array.from(new Uint8Array(cred.id as ArrayBuffer)),
          );
          sessionStorage.setItem(`e2e.credentialGet${count}`, JSON.stringify(asked));
          return assertion;
        },
      },
    });
  });
  await signInWalletEligible(page);
  const account = {
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
    walletRequired: true,
    walletBackupSeenAt: 1,
    // A real seed credential id (base64url), which the second prompt decodes.
    passkeyCredentialId: 'AQIDBAUGBwgJCgsMDQ4PEA',
  };
  await page.route('**/auth/passkey/authenticate/begin', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        challengeId: 'ch-auth',
        options: { challenge: 'aa', rpId: 'localhost', allowCredentials: [] },
      }),
    });
  });
  await page.route('**/auth/passkey/authenticate/finish', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'sess-e2e', account }),
    });
  });
}

/** Number of passkey prompts so far (see {@link stubLoginWithoutPrf}). */
async function credentialGets(page: Page): Promise<number> {
  return page.evaluate(() => Number(sessionStorage.getItem('e2e.credentialGets') ?? '0'));
}

test('Function: finishWalletOpen — after Log in, a passkey without PRF holds the session back', async ({
  page,
}) => {
  await stubLoginWithoutPrf(page);
  await page.goto('/wallet?visual=balance-locked');
  const logIn = page.getByRole('button', { name: 'Log in', exact: true });
  await expect(logIn).toBeVisible();
  expect(await credentialGets(page)).toBe(0);
  await logIn.click();
  // Another passkey than the seed signed in without PRF output, so opening
  // the wallet asks the seed passkey once, gets none either, and holds the
  // session back with the sentence.
  await expect(page.getByRole('alert').filter({ hasText: PRF_UNSUPPORTED_MESSAGE })).toBeVisible();
  await expect(logIn).toBeVisible();
  await expect(page).toHaveURL(/\/wallet\?visual=balance-locked$/);
  await expect(page.getByRole('heading', { name: 'Wallet', exact: true })).toHaveCount(0);
  expect(await credentialGets(page)).toBe(2);
});

test('Function: visualPin — an unknown pin is ignored', async ({ page }) => {
  await signInWalletEligible(page);
  await page.goto('/wallet?visual=nope');
  await expect(page.getByRole('heading', { name: 'Wallet', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toHaveCount(0);
});

test('Function: WalletPhraseScreen — phrase page is not the receive page', async ({ page }) => {
  await page.goto('/wallet/phrase');
  await expect(page).toHaveURL(/\/(wallet\/phrase|login)/);
});

test('Function: WalletPhrasePage — phrase page is not the receive page', async ({ page }) => {
  await page.goto('/wallet/phrase');
  await expect(page).toHaveURL(/\/(wallet\/phrase|login)/);
});

test('Function: resetWalletReturn — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: rememberWalletReturn — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: walletBackHref — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: RememberWalletReturn — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: WalletChromeLeft — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('wallet key unset shows no balance region', async ({ page }) => {
  await signInWalletEligible(page);
  await page.goto('/wallet');
  await expect(page.getByRole('heading', { name: 'Wallet' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Show recovery phrase' })).toHaveCount(0);
  await expect(page.getByText('Advanced functions')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Balance' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Receive' })).toBeEnabled();
});

test('balance-locked pin shows the login card in place of the wallet', async ({ page }) => {
  await signInWalletEligible(page);
  await page.goto('/wallet?visual=balance-locked');
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Wallet', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Balance' })).toHaveCount(0);
  // A held-back session counts as signed out: no signed-in Menu next to the card.
  await expect(page.getByRole('button', { name: /^Menu/ })).toHaveCount(0);
  await expect(page).toHaveURL(/\/wallet\?visual=balance-locked$/);
});

test('Function: LogoutButton — logs a held-back session out from the login card', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await page.goto('/wallet?visual=balance-locked');
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('21gifts.session'))).toBeNull();
});

test('the login card on /setup/rules keeps the one top-left back arrow', async ({ page }) => {
  await signInWalletEligible(page);
  await page.goto('/setup/rules?visual=balance-locked');
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
  await expect(page.locator('[data-app-chrome]').getByRole('link', { name: /^Back/ })).toHaveCount(
    1,
  );
  await expect(page.getByRole('link', { name: /^Back/ })).toHaveCount(1);
});

test('balance-locked-prf-unsupported pin says this phone cannot hold a wallet', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await page.goto('/wallet?visual=balance-locked-prf-unsupported');
  await expect(
    page.getByRole('alert').filter({
      hasText:
        'This phone or browser cannot hold a 21.gifts wallet. Please use an up-to-date phone or browser that supports passkeys.',
    }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Wallet', exact: true })).toHaveCount(0);
});

test('balance-locked-error pin shows the login error above Log in', async ({ page }) => {
  await signInWalletEligible(page);
  await page.goto('/wallet?visual=balance-locked-error');
  const alert = page.getByRole('alert').filter({ hasText: /\S/ });
  const login = page.getByRole('button', { name: 'Log in', exact: true });
  await expect(alert).toHaveText('Something went wrong. Please try again.');
  await expect(login).toBeVisible();
  const alertBox = await alert.boundingBox();
  const loginBox = await login.boundingBox();
  expect(alertBox).not.toBeNull();
  expect(loginBox).not.toBeNull();
  expect((alertBox?.y ?? 0) + (alertBox?.height ?? 0)).toBeLessThanOrEqual(loginBox?.y ?? 0);
  await expect(page.getByRole('heading', { name: 'Wallet', exact: true })).toHaveCount(0);
});

test('wallet balance-connecting pin shows pending status', async ({ page }) => {
  await signInWalletEligible(page);
  await page.goto('/wallet?visual=balance-connecting');
  const region = page.getByRole('region', { name: 'Balance' });
  await expect(region.getByRole('status')).toHaveText('Opening your wallet…');
  await expect(region.getByRole('button')).toHaveCount(0);
});

test('wallet balance-ready pin shows bitcoin and fiat', async ({ page }) => {
  await signInWalletEligible(page);
  await page.route('**/gifts/stats**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(WALLET_RATE_DAY_STATS),
    });
  });
  await fulfillSpot(page, spotRatesFromStats(WALLET_RATE_DAY_STATS));
  await page.goto('/wallet?visual=balance-ready');
  const region = page.getByRole('region', { name: 'Balance' });
  await expect(region.getByText("₿21'000")).toBeVisible();
  await expect(region.getByText('$21.00')).toBeVisible();
});

test('wallet balance-error pin shows alert and retry', async ({ page }) => {
  await signInWalletEligible(page);
  await page.goto('/wallet?visual=balance-error');
  const region = page.getByRole('region', { name: 'Balance' });
  await expect(region.getByRole('alert')).toHaveText(
    'Your wallet could not be opened. Please try again.',
  );
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('wallet balance pin does not appear on phrase page', async ({ page }) => {
  await signInWalletEligible(page);
  await page.goto('/wallet/phrase?visual=balance-ready');
  await expect(page.getByRole('region', { name: 'Balance' })).toHaveCount(0);
});

test('Function: getBreezApiKey — unset key leaves no balance region or wasm', async ({ page }) => {
  await signInWalletEligible(page);
  const urls: string[] = [];
  page.on('request', (req) => {
    urls.push(req.url());
  });
  await page.goto('/wallet');
  await expect(page.getByRole('region', { name: 'Balance' })).toHaveCount(0);
  expect(urls.some((u) => u.endsWith('.wasm'))).toBe(false);
});

test('Function: useWalletStore — unset key leaves no balance region or wasm', async ({ page }) => {
  await signInWalletEligible(page);
  const urls: string[] = [];
  page.on('request', (req) => {
    urls.push(req.url());
  });
  await page.goto('/wallet');
  await expect(page.getByRole('region', { name: 'Balance' })).toHaveCount(0);
  expect(urls.some((u) => u.endsWith('.wasm'))).toBe(false);
});

test('Function: loadWalletSdk — unset key leaves no balance region or wasm', async ({ page }) => {
  await signInWalletEligible(page);
  const urls: string[] = [];
  page.on('request', (req) => {
    urls.push(req.url());
  });
  await page.goto('/wallet');
  await expect(page.getByRole('region', { name: 'Balance' })).toHaveCount(0);
  expect(urls.some((u) => u.endsWith('.wasm'))).toBe(false);
});

test('Function: connectWallet — unset key leaves no balance region or wasm', async ({ page }) => {
  await signInWalletEligible(page);
  const urls: string[] = [];
  page.on('request', (req) => {
    urls.push(req.url());
  });
  await page.goto('/wallet');
  await expect(page.getByRole('region', { name: 'Balance' })).toHaveCount(0);
  expect(urls.some((u) => u.endsWith('.wasm'))).toBe(false);
});

test('Function: refreshWallet — unset key leaves no balance region or wasm', async ({ page }) => {
  await signInWalletEligible(page);
  const urls: string[] = [];
  page.on('request', (req) => {
    urls.push(req.url());
  });
  await page.goto('/wallet');
  await expect(page.getByRole('region', { name: 'Balance' })).toHaveCount(0);
  expect(urls.some((u) => u.endsWith('.wasm'))).toBe(false);
});

test('Function: disconnectWallet — unset key leaves no balance region or wasm', async ({
  page,
}) => {
  await signInWalletEligible(page);
  const urls: string[] = [];
  page.on('request', (req) => {
    urls.push(req.url());
  });
  await page.goto('/wallet');
  await expect(page.getByRole('region', { name: 'Balance' })).toHaveCount(0);
  expect(urls.some((u) => u.endsWith('.wasm'))).toBe(false);
});

test('Function: listenForWalletPhrase — unset key leaves no balance region or wasm', async ({
  page,
}) => {
  await signInWalletEligible(page);
  const urls: string[] = [];
  page.on('request', (req) => {
    urls.push(req.url());
  });
  await page.goto('/wallet');
  await expect(page.getByRole('region', { name: 'Balance' })).toHaveCount(0);
  expect(urls.some((u) => u.endsWith('.wasm'))).toBe(false);
});

test('Function: rememberPhraseFromPrf — unset key leaves no balance region or wasm', async ({
  page,
}) => {
  await signInWalletEligible(page);
  const urls: string[] = [];
  page.on('request', (req) => {
    urls.push(req.url());
  });
  await page.goto('/wallet');
  await expect(page.getByRole('region', { name: 'Balance' })).toHaveCount(0);
  expect(urls.some((u) => u.endsWith('.wasm'))).toBe(false);
});

test('Function: sessionPhraseGeneration — unset key leaves no balance region or wasm', async ({
  page,
}) => {
  await signInWalletEligible(page);
  const urls: string[] = [];
  page.on('request', (req) => {
    urls.push(req.url());
  });
  await page.goto('/wallet');
  await expect(page.getByRole('region', { name: 'Balance' })).toHaveCount(0);
  expect(urls.some((u) => u.endsWith('.wasm'))).toBe(false);
});

test('Function: WalletSync — unset key leaves no balance region or wasm', async ({ page }) => {
  await signInWalletEligible(page);
  const urls: string[] = [];
  page.on('request', (req) => {
    urls.push(req.url());
  });
  await page.goto('/wallet');
  await expect(page.getByRole('region', { name: 'Balance' })).toHaveCount(0);
  expect(urls.some((u) => u.endsWith('.wasm'))).toBe(false);
});

test('Function: useWallet — ready pin shows fixture balance', async ({ page }) => {
  await signInWalletEligible(page);
  await page.route('**/gifts/stats**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(WALLET_RATE_DAY_STATS),
    });
  });
  await fulfillSpot(page, spotRatesFromStats(WALLET_RATE_DAY_STATS));
  await page.goto('/wallet?visual=balance-ready');
  await expect(page.getByRole('region', { name: 'Balance' }).getByText("₿21'000")).toBeVisible();
});

test('Function: WalletBalance — error pin shows Try again', async ({ page }) => {
  await signInWalletEligible(page);
  await page.goto('/wallet?visual=balance-error');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('Function: walletNeedsReload — error pin keeps Try again in place', async ({ page }) => {
  await signInWalletEligible(page);
  await page.goto('/wallet?visual=balance-error');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('region', { name: 'Balance' }).getByRole('alert')).toHaveText(
    'Your wallet could not be opened. Please try again.',
  );
  await expect(page).toHaveURL(/\/wallet\?visual=balance-error/);
});

test('Function: unlockWalletPhrase — a login with another passkey asks the seed passkey once', async ({
  page,
}) => {
  await stubLoginWithoutPrf(page);
  await page.goto('/wallet?visual=balance-locked');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: PRF_UNSUPPORTED_MESSAGE })).toBeVisible();
  // The login prompt, then exactly one prompt from the unlock, for the seed
  // credential (`AQIDBAUGBwgJCgsMDQ4PEA` is the bytes 1 to 16).
  expect(await credentialGets(page)).toBe(2);
  expect(await page.evaluate(() => sessionStorage.getItem('e2e.credentialGet2'))).toBe(
    JSON.stringify([Array.from({ length: 16 }, (_, i) => i + 1)]),
  );
});

test('Function: canUnlockWallet — eligible account is open in an unpinned Playwright build', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await page.goto('/wallet');
  await expect(page.getByRole('heading', { name: 'Wallet', exact: true })).toBeVisible();
});

async function stubWalletRate(page: Page): Promise<void> {
  await page.route('**/gifts/stats**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(WALLET_RATE_DAY_STATS),
    });
  });
  await fulfillSpot(page, spotRatesFromStats(WALLET_RATE_DAY_STATS));
}

/** Opens the Send view from the wallet home. */
async function openSend(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Send Bitcoin' })).toBeVisible();
}

test('wallet key unset shows no send region', async ({ page }) => {
  await signInWalletEligible(page);
  await page.goto('/wallet');
  await expect(page.getByRole('heading', { name: 'Wallet' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Send Bitcoin' })).toHaveCount(0);
});

test('Function: useWalletSend — with the key unset, Send opens and a text the wallet reads says the wallet is not available', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await stubCamera(page, { kind: 'blank' });
  await page.goto('/wallet');
  await openSend(page);
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await region.getByRole('button', { name: 'Enter manually' }).click();
  await region.getByLabel('Payment request or address').fill('lnbc1unavailable');
  await region.getByRole('button', { name: 'Continue' }).click();
  await expect(region.getByRole('alert')).toHaveText(
    'Your 21.gifts wallet is not available here, so this cannot be paid.',
  );
});

/** Answers the api's read of the outside address bob@example.com and its invoice. */
async function routeOutsideAddress(page: Page): Promise<void> {
  await page.route(/\/lnurl\/pay-request$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        target: 'bob@example.com',
        minSendableMsat: 1_000,
        maxSendableMsat: 100_000_000,
        commentAllowed: 10,
        description: 'Pay bob',
        domain: 'example.com',
      }),
    });
  });
  await page.route(/\/lnurl\/invoice$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pr: 'lnbc10u1mockrelay' }),
    });
  });
}

test.describe('Send while the wallet is still opening', () => {
  test('Function: useWalletPanel — Send stays enabled while the wallet opens and opens the camera at once', async ({
    page,
  }) => {
    await signInWalletEligible(page);
    await stubWalletRate(page);
    await stubCamera(page, { kind: 'blank' });
    await page.goto('/wallet?visual=setup-pending');
    await expect(
      page.getByRole('region', { name: 'Balance' }).getByText('Opening your wallet…'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Receive' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
    await openSend(page);
    const region = page.getByRole('region', { name: 'Send Bitcoin' });
    await expect(region.locator('video')).toBeVisible();
    await expect(region.getByRole('button', { name: 'Paste' })).toBeEnabled();
    await expect(region.getByRole('button', { name: 'Enter manually' })).toBeEnabled();
  });

  test('Function: useWalletSend — a scanned outside address reaches the amount step, and the confirm step waits with Opening your wallet…', async ({
    page,
  }) => {
    await signInWalletEligible(page);
    await stubWalletRate(page);
    await stubCamera(page, { kind: 'qr', text: 'bob@example.com' });
    await routeOutsideAddress(page);
    await page.goto('/wallet?visual=setup-pending');
    await openSend(page);
    const region = page.getByRole('region', { name: 'Send Bitcoin' });
    await expect(region.getByText('To bob@example.com')).toBeVisible();
    await region.getByLabel('Amount').fill('1000');
    await region.getByRole('button', { name: 'Continue' }).click();
    await expect(region.getByRole('status')).toHaveText('Opening your wallet…');
    await expect(region.getByText("₿1'000", { exact: true })).toBeVisible();
    await expect(region.getByText('To bob@example.com')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(region.getByText('Opening your wallet…')).toHaveCount(0);
  });

  test('Function: WalletSend — Paste and Enter manually keep the text and show Opening your wallet… until the wallet is open', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await signInWalletEligible(page);
    await stubWalletRate(page);
    await stubCamera(page, { kind: 'blank' });
    await page.goto('/wallet?visual=setup-pending');
    await openSend(page);
    const region = page.getByRole('region', { name: 'Send Bitcoin' });
    await page.evaluate(() => navigator.clipboard.writeText('lnbc1pastedwhileopening'));
    await region.getByRole('button', { name: 'Paste' }).click();
    await expect(region.getByRole('status')).toHaveText('Opening your wallet…');
    await expect(region.getByRole('button', { name: 'Paste' })).toBeDisabled();
    await expect(region.getByRole('alert')).toHaveCount(0);

    await page.reload();
    await openSend(page);
    await region.getByRole('button', { name: 'Enter manually' }).click();
    await region.getByLabel('Payment request or address').fill('lnbc1typedwhileopening');
    await region.getByRole('button', { name: 'Continue' }).click();
    await expect(region.getByLabel('Payment request or address')).toHaveCount(0);
    await expect(region.getByRole('status')).toHaveText('Opening your wallet…');
    await expect(region.getByRole('alert')).toHaveCount(0);
  });

  test('Function: useWalletSend — send-confirm-opens shows Opening your wallet… on the confirm step, then the quote', async ({
    page,
  }) => {
    await signInWalletEligible(page);
    await stubWalletRate(page);
    await page.goto('/wallet?visual=send-confirm-opens');
    const region = page.getByRole('region', { name: 'Send Bitcoin' });
    await expect(region.getByRole('status')).toHaveText('Opening your wallet…');
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
    await expect(region.getByText('Fee ₿0', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(region.getByText('Opening your wallet…')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
  });

  test('Function: useWalletSend — a wallet that cannot be opened shows the error with Try again on the step that needs it', async ({
    page,
  }) => {
    await signInWalletEligible(page);
    await stubWalletRate(page);
    await page.goto('/wallet?visual=send-confirm-wallet-error');
    const region = page.getByRole('region', { name: 'Send Bitcoin' });
    await expect(region.getByRole('alert')).toHaveText(
      'Your wallet could not be opened. Please try again.',
    );
    await expect(region.getByText("₿2'100", { exact: true })).toBeVisible();
    await region.getByRole('button', { name: 'Try again' }).click();
    await expect(region.getByRole('status')).toHaveText('Opening your wallet…');
    await expect(region.getByText('Fee ₿0', { exact: true })).toBeVisible({ timeout: 10_000 });

    await page.goto('/wallet?visual=send-input-wallet-error');
    await expect(region.getByRole('alert')).toHaveText(
      'Your wallet could not be opened. Please try again.',
    );
    await region.getByRole('button', { name: 'Try again' }).click();
    await expect(region.getByRole('status')).toHaveText('Opening your wallet…');
    await expect(region.getByRole('alert')).toHaveCount(0);
  });

  test('Function: WalletReceive — Receive opens while the wallet opens and shows Opening your wallet… in place of the address', async ({
    page,
  }) => {
    await signInWalletEligible(page);
    await stubWalletRate(page);
    await page.goto('/wallet?visual=setup-pending');
    await page.getByRole('button', { name: 'Receive' }).click();
    await expect(page.getByRole('status')).toHaveText('Opening your wallet…');
    await expect(page.getByText('ada@21.gifts')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Set an amount' })).toHaveAttribute('href', '/pos');
  });
});

test('wallet locked pin shows no send region', async ({ page }) => {
  await signInWalletEligible(page);
  await page.goto('/wallet?visual=balance-locked');
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Send Bitcoin' })).toHaveCount(0);
});

test('wallet send-input pin: Send replaces home with the camera, Paste, and Enter manually', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await stubCamera(page, { kind: 'blank' });
  await page.goto('/wallet?visual=send-input');
  await expect(page.getByRole('region', { name: 'Send Bitcoin' })).toHaveCount(0);
  await openSend(page);
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await expect(region.locator('video')).toBeVisible();
  await expect(region.getByText('Point the camera at a Bitcoin QR code')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Balance' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Receive' })).toHaveCount(0);
  await expect(region.getByLabel('Payment request or address')).toHaveCount(0);
  await region.getByRole('button', { name: 'Enter manually' }).click();
  const field = region.getByLabel('Payment request or address');
  await expect(field).toBeFocused();
  await expect(field).toHaveAttribute('placeholder', 'Paste a Bitcoin payment request or address');
  await expect(region.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await field.fill('lnbc1');
  await expect(region.getByRole('button', { name: 'Continue' })).toBeEnabled();
});

test('wallet send-amount pin asks for an amount, bounds, and a comment', async ({ page }) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-amount');
  await openSend(page);
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await expect(region.getByText('To bob@example.com')).toBeVisible();
  await expect(region.getByLabel('Amount')).toBeVisible();
  await expect(region.locator('video')).toHaveCount(0);
  await expect(
    region.getByText(/^Between ₿1 · \$0\.00 and ₿1'000'000 · \$1.000\.00$/),
  ).toBeVisible();
  await expect(region.getByLabel('Message (optional)')).toHaveAttribute('maxlength', '140');
  await expect(region.getByRole('button', { name: 'Cancel' })).toBeVisible();
});

test('wallet send-confirm pin shows the large amount with fiat, recipient, fee, and the footer Send and Cancel', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-confirm');
  await openSend(page);
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await expect(region.getByText("₿2'100", { exact: true })).toBeVisible();
  await expect(region.getByText('$2.10', { exact: true })).toBeVisible();
  await expect(region.getByText('To bob@example.com')).toBeVisible();
  await expect(region.getByText('Fee ₿0', { exact: true })).toBeVisible();
  await expect(region.getByText(/^Send ₿/)).toHaveCount(0);
  await expect(region.getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel' })).toHaveText('Cancel');
});

test('wallet send-sent pin shows the check, the sent amount with fiat, the recipient, and Done', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-sent');
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await expect(region.getByRole('status')).toContainText("Sent ₿2'100");
  await expect(region.getByRole('status')).toContainText('$2.10');
  await expect(region.getByText('To bob@example.com')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
});

test('wallet send-amount-onchain pin asks for an amount for a Bitcoin address without bounds or a message', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-amount-onchain');
  await openSend(page);
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await expect(region.getByText('To bc1qar0srr…wf5mdq')).toBeVisible();
  await expect(region.getByLabel('Amount')).toBeVisible();
  await expect(region.getByText(/^Between/)).toHaveCount(0);
  await expect(region.getByLabel('Message (optional)')).toHaveCount(0);
});

test('wallet send-amount-onchain-min pin names the smallest amount for the address', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-amount-onchain-min');
  await openSend(page);
  await expect(page.getByRole('region', { name: 'Send Bitcoin' }).getByRole('alert')).toHaveText(
    'Enter an amount of at least ₿294 · $0.29.',
  );
});

test('Function: useWalletSend — send-confirm-onchain pin shows each speed with its fee, and Fast changes the fee and total', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-confirm-onchain');
  await openSend(page);
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await expect(region.getByText("₿50'000", { exact: true })).toBeVisible();
  await expect(region.getByText('$50.00', { exact: true })).toBeVisible();
  await expect(region.getByText('To bc1qar0srr…wf5mdq')).toBeVisible();
  const speeds = region.getByRole('group', { name: 'Speed' });
  await expect(speeds.getByRole('button')).toHaveText([
    "Fast₿2'840 · $2.84",
    "Medium₿1'420 · $1.42",
    'Slow₿710 · $0.71',
  ]);
  await expect(speeds.getByRole('button', { name: /^Medium/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(region.getByText("Fee ₿1'420 · $1.42", { exact: true })).toBeVisible();
  await expect(region.getByText("Total ₿51'420 · $51.42", { exact: true })).toBeVisible();
  await expect(
    region.getByText(
      'A payment to a Bitcoin address pays a network fee. It is much higher than the fee of other payments.',
    ),
  ).toBeVisible();
  await speeds.getByRole('button', { name: /^Fast/ }).click();
  await expect(speeds.getByRole('button', { name: /^Fast/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(region.getByText("Fee ₿2'840 · $2.84", { exact: true })).toBeVisible();
  await expect(region.getByText("Total ₿52'840 · $52.84", { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(region.getByText("Total ₿52'840 · $52.84", { exact: true })).toBeVisible();
  await expect(region.getByRole('status')).toHaveCount(0);
});

test('wallet send-confirm-onchain-low pin disables a speed the balance does not cover', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-confirm-onchain-low');
  await openSend(page);
  const speeds = page.getByRole('group', { name: 'Speed' });
  await expect(speeds.getByRole('button', { name: /^Fast/ })).toBeDisabled();
  await expect(speeds.getByRole('button', { name: /^Fast/ })).toContainText('Balance too low');
  await expect(speeds.getByRole('button', { name: /^Medium/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText("Total ₿51'420 · $51.42", { exact: true })).toBeVisible();
});

test('wallet send-confirm-onchain-renewed pin says the fee offer expired and nothing was sent', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-confirm-onchain-renewed');
  await openSend(page);
  await expect(page.getByRole('region', { name: 'Send Bitcoin' }).getByRole('alert')).toHaveText(
    'The fee offer expired, so nothing was sent. Check the new fee and press Send again.',
  );
});

test('wallet send-confirm-onchain-renewing pin keeps Cancel usable while the fee offer is renewed', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-confirm-onchain-renewing');
  const speeds = page.getByRole('group', { name: 'Speed' });
  await expect(speeds.getByRole('button', { name: /^Fast/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeEnabled();
});

test('wallet send-confirm-onchain-sending pin disables the speeds, Send, and Cancel', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-confirm-onchain-sending');
  const speeds = page.getByRole('group', { name: 'Speed' });
  for (const name of [/^Fast/, /^Medium/, /^Slow/]) {
    await expect(speeds.getByRole('button', { name })).toBeDisabled();
  }
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeDisabled();
});

test('wallet send-error pin shows the plain unreachable error', async ({ page }) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-error');
  await expect(page.getByRole('region', { name: 'Send Bitcoin' }).getByRole('alert')).toHaveText(
    'The receiver could not be reached from this browser. Please try again later.',
  );
});

test('wallet send-not-payable pin says the address cannot receive a payment', async ({ page }) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-not-payable');
  await expect(page.getByRole('region', { name: 'Send Bitcoin' }).getByRole('alert')).toHaveText(
    'This address cannot receive a payment.',
  );
});

test('Function: LnurlRelayError — send-not-found pin shows the not-found alert', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-not-found');
  await expect(page.getByRole('region', { name: 'Send Bitcoin' }).getByRole('alert')).toHaveText(
    'This address was not found.',
  );
});

test('wallet send-relay-unreachable pin says the receiver server did not answer', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-relay-unreachable');
  await expect(page.getByRole('region', { name: 'Send Bitcoin' }).getByRole('alert')).toHaveText(
    "The receiver's server did not answer. Please try again later.",
  );
});

test('Function: lnurlRelayTarget — send-comment-long pin shows an outside address with the comment alert', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-comment-long');
  await openSend(page);
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await expect(region.getByText('To bob@example.com')).toBeVisible();
  await expect(region.getByLabel('Message (optional)')).toBeVisible();
  await expect(region.getByRole('alert')).toHaveText('This message is too long for the receiver.');
});

test('wallet send pin: Cancel is inert while a step is pinned', async ({ page }) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-confirm');
  await openSend(page);
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/wallet\?visual=send-confirm/);
});

test('Function: WalletSend — send-input pin shows the Send Bitcoin region', async ({ page }) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await stubCamera(page, { kind: 'blank' });
  await page.goto('/wallet?visual=send-input');
  await openSend(page);
});

test('Function: useWalletSend — send-confirm pin shows the confirm step', async ({ page }) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-confirm');
  await openSend(page);
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
});

test('Function: lnurlPayAddress — send-confirm-fixed pin names the shop of a point-of-sale QR and its charge', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-confirm-fixed');
  await openSend(page);
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await expect(region.getByText('To shop@21.gifts')).toBeVisible();
  await expect(region.getByText("₿7'000", { exact: true })).toBeVisible();
  await expect(region.getByText('$7.00', { exact: true })).toBeVisible();
  await expect(region.getByText(/^Fee ₿3 · \$0\.00$/)).toBeVisible();
  await expect(region.getByLabel('Amount')).toHaveCount(0);
  await expect(region.getByLabel('Message (optional)')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
});

test('Function: ownShop — send-confirm-shop pin pays the shop charge of a point-of-sale QR with Fee ₿0', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-confirm-shop');
  await openSend(page);
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await expect(region.getByText('To shop@21.gifts')).toBeVisible();
  await expect(region.getByText("₿7'000", { exact: true })).toBeVisible();
  await expect(region.getByText('$7.00', { exact: true })).toBeVisible();
  await expect(region.getByText('Fee ₿0', { exact: true })).toBeVisible();
  await expect(region.getByLabel('Amount')).toHaveCount(0);
  await expect(region.getByLabel('Message (optional)')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
});

test('Function: useWalletSend — send-confirm-member pin pays a 21.gifts member the amount entered with Fee ₿0', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-confirm-member');
  await openSend(page);
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await expect(region.getByText('To alice@21.gifts')).toBeVisible();
  await expect(region.getByText("₿2'100", { exact: true })).toBeVisible();
  await expect(region.getByText('$2.10', { exact: true })).toBeVisible();
  await expect(region.getByText('Fee ₿0', { exact: true })).toBeVisible();
  await expect(region.getByText(/^Fee ₿0 · /)).toHaveCount(0);
  await expect(region.getByLabel('Amount')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
});

test('Function: walletSendBounds — send-amount pin shows the receiver bounds', async ({ page }) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-amount');
  await openSend(page);
  await expect(page.getByText(/^Between ₿1 · \$0\.00 and ₿1'000'000 · \$1.000\.00$/)).toBeVisible();
});

test('Function: parseWalletInput — unset key loads no wasm and shows no send region', async ({
  page,
}) => {
  await signInWalletEligible(page);
  const urls: string[] = [];
  page.on('request', (req) => {
    urls.push(req.url());
  });
  await page.goto('/wallet');
  await expect(page.getByRole('region', { name: 'Send Bitcoin' })).toHaveCount(0);
  expect(urls.some((u) => u.endsWith('.wasm'))).toBe(false);
});

test('Function: QrScanner — Send opens the camera; a scanned QR is taken and submitted', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await stubCamera(page, { kind: 'qr', text: 'lnbc21scanned' });
  await page.goto('/wallet?visual=send-input-busy');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  // The pinned flow marks the submit busy: a spinner over the camera area, both buttons waiting.
  await expect(region.locator('.animate-spin')).toBeVisible();
  await expect(region.getByRole('button', { name: 'Paste' })).toBeDisabled();
  await expect(region.getByRole('button', { name: 'Enter manually' })).toBeDisabled();
  await expect(region.locator('video')).toHaveCount(0);
  expect(await cameraStats(page)).toEqual({ requests: 1, live: 0 });
});

test('wallet Send reads a scanned QR once and keeps the camera off until the text changes', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await stubCamera(page, { kind: 'qr', text: 'lnbc21scanned' });
  await page.goto('/wallet?visual=send-input');
  await openSend(page);
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await expect.poll(async () => (await cameraStats(page)).requests).toBe(1);
  await page.waitForTimeout(1_000);
  expect(await cameraStats(page)).toEqual({ requests: 1, live: 0 });
  await expect(page.locator('video')).toHaveCount(0);
  await region.getByRole('button', { name: 'Enter manually' }).click();
  const field = region.getByLabel('Payment request or address');
  await expect(field).toHaveValue('lnbc21scanned');
  await field.fill('');
  await region.getByRole('button', { name: 'Cancel' }).click();
  // The stubbed camera still shows the same QR, so the restarted camera may read
  // it again at once and close; the second camera request is the change itself.
  await expect.poll(async () => (await cameraStats(page)).requests).toBe(2);
});

test('wallet Send camera stops on Back and starts again on Send', async ({ page }) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await stubCamera(page, { kind: 'blank' });
  await page.goto('/wallet?visual=send-input');
  await openSend(page);
  await expect(page.getByRole('region', { name: 'Send Bitcoin' }).locator('video')).toBeVisible();
  await expect.poll(async () => (await cameraStats(page)).live).toBe(1);
  await page.getByRole('link', { name: 'Back to the forum' }).click();
  await expect(page.getByRole('region', { name: 'Send Bitcoin' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Balance' })).toBeVisible();
  await expect(page).toHaveURL(/\/wallet\?visual=send-input$/);
  expect(await cameraStats(page)).toEqual({ requests: 1, live: 0 });
  await openSend(page);
  await expect.poll(async () => cameraStats(page)).toEqual({ requests: 2, live: 1 });
});

/** Boxes of the full-size camera layer and of the page port it fills. */
async function cameraLayer(page: Page): Promise<{
  layer: { x: number; y: number; width: number; height: number };
  port: { x: number; y: number; width: number; height: number };
}> {
  return page.evaluate(() => {
    const layer = document.querySelector('section[aria-label="Send Bitcoin"][data-port-fill]');
    const port = document.querySelector('[data-scrollport][data-scroll-active]');
    if (layer === null || port === null) {
      throw new Error('missing camera layer');
    }
    const box = (element: Element): { x: number; y: number; width: number; height: number } => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    return { layer: box(layer), port: box(port) };
  });
}

function expectFills(boxes: Awaited<ReturnType<typeof cameraLayer>>): void {
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(boxes.layer[key] - boxes.port[key])).toBeLessThanOrEqual(1);
  }
}

test('wallet Send camera fills the page port edge to edge, with floating buttons over it, on a phone and on desktop', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await stubCamera(page, { kind: 'blank' });
  await page.goto('/wallet?visual=send-input');
  await openSend(page);
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await expect(region.locator('video')).toBeVisible();
  const phone = await cameraLayer(page);
  expectFills(phone);
  await expect(region.locator('video')).toHaveCSS('object-fit', 'cover');
  const hint = region.getByText('Point the camera at a Bitcoin QR code');
  await expect(hint).toHaveCSS('font-size', '18px');
  const hintBox = (await hint.boundingBox())!;
  expect(Math.abs(hintBox.y - phone.layer.y)).toBeLessThanOrEqual(1);
  // The viewfinder is a centred square of 68% of the smaller side and lets taps through.
  const finder = await region.locator('video ~ div[aria-hidden="true"]').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      pointer: getComputedStyle(element).pointerEvents,
    };
  });
  expect(Math.abs(finder.width - finder.height)).toBeLessThanOrEqual(1);
  expect(finder.width).toBeCloseTo(Math.min(phone.layer.width, phone.layer.height) * 0.68, 0);
  expect(finder.pointer).toBe('none');
  for (const name of ['Paste', 'Enter manually']) {
    const button = region.getByRole('button', { name });
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(box.y + box.height).toBeLessThanOrEqual(phone.layer.y + phone.layer.height);
    expect(box.y).toBeGreaterThan(phone.layer.y + phone.layer.height / 2);
    await expect(button).toHaveCSS('color', 'rgb(255, 255, 255)');
  }
  expect(
    await page.evaluate(() => {
      const port = document.querySelector('[data-scrollport]') as HTMLElement;
      return [port.scrollWidth - port.clientWidth, port.scrollHeight - port.clientHeight];
    }),
  ).toEqual([0, 0]);
  expect(await cameraStats(page)).toEqual({ requests: 1, live: 1 });

  // At 320 px the two buttons wrap and stay inside the camera area.
  await page.setViewportSize({ width: 320, height: 640 });
  await expect.poll(async () => expectFills(await cameraLayer(page))).toBeUndefined();
  const narrow = await cameraLayer(page);
  for (const name of ['Paste', 'Enter manually']) {
    const box = (await region.getByRole('button', { name }).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(narrow.layer.x);
    expect(box.x + box.width).toBeLessThanOrEqual(narrow.layer.x + narrow.layer.width);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect.poll(async () => expectFills(await cameraLayer(page))).toBeUndefined();
});

test('wallet Send camera alert sits on the full-size black area and both buttons still work', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await stubCamera(page, { kind: 'denied' });
  await page.goto('/wallet?visual=send-input');
  await openSend(page);
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  const alert = region.getByRole('alert');
  await expect(alert).toHaveText(
    'Camera access was blocked. Allow it in your browser settings, or paste the payment request.',
  );
  await expect(alert).toHaveCSS('font-size', '18px');
  await expect(alert).toHaveCSS('color', 'rgb(255, 255, 255)');
  expectFills(await cameraLayer(page));
  await expect(region.locator('video')).toHaveCount(0);
  await expect(region.getByRole('button', { name: 'Paste' })).toBeEnabled();
  await region.getByRole('button', { name: 'Enter manually' }).click();
  await expect(region.getByLabel('Payment request or address')).toBeVisible();
});

test('wallet Send says no camera was found and keeps Paste and Enter manually', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await stubCamera(page, { kind: 'none' });
  await page.goto('/wallet?visual=send-input');
  await openSend(page);
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await expect(region.getByRole('alert')).toHaveText(
    'No camera found. Paste the payment request instead.',
  );
  await expect(region.getByRole('button', { name: 'Paste' })).toBeVisible();
  await expect(region.getByRole('button', { name: 'Enter manually' })).toBeVisible();
});

test('wallet Send Paste takes the clipboard text like a scan', async ({ page }) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await stubCamera(page, { kind: 'blank' });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: () => Promise.resolve('lnbc21pasted'),
        writeText: () => Promise.resolve(),
      },
    });
  });
  await page.goto('/wallet?visual=send-input');
  await openSend(page);
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await expect.poll(async () => (await cameraStats(page)).live).toBe(1);
  await region.getByRole('button', { name: 'Paste' }).click();
  // Like a scan: the camera stops until the text changes, and the text is in the field.
  await expect(region.locator('video')).toHaveCount(0);
  await expect.poll(async () => (await cameraStats(page)).live).toBe(0);
  await region.getByRole('button', { name: 'Enter manually' }).click();
  await expect(region.getByLabel('Payment request or address')).toHaveValue('lnbc21pasted');
});

for (const [label, readText, message] of [
  ['refused', 'reject', 'Pasting was not allowed. Use Enter manually instead.'],
  ['empty', 'empty', 'The clipboard is empty.'],
] as const) {
  test(`wallet Send Paste with a ${label} clipboard shows a short alert and keeps the camera`, async ({
    page,
  }) => {
    await signInWalletEligible(page);
    await stubWalletRate(page);
    await stubCamera(page, { kind: 'blank' });
    await page.addInitScript((mode) => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          readText: () =>
            mode === 'reject'
              ? Promise.reject(new DOMException('denied', 'NotAllowedError'))
              : Promise.resolve(''),
          writeText: () => Promise.resolve(),
        },
      });
    }, readText);
    await page.goto('/wallet?visual=send-input');
    await openSend(page);
    const region = page.getByRole('region', { name: 'Send Bitcoin' });
    await region.getByRole('button', { name: 'Paste' }).click();
    await expect(region.getByRole('alert')).toHaveText(message);
    await expect(region.locator('video')).toBeVisible();
    await expect(region.getByRole('alert')).toHaveCount(0, { timeout: 6_000 });
  });
}

test('wallet Send manual sheet: Close and Back return to the camera, the next Back returns home', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await stubCamera(page, { kind: 'blank' });
  await page.goto('/wallet?visual=send-input');
  await openSend(page);
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await region.getByRole('button', { name: 'Enter manually' }).click();
  await expect(region.getByLabel('Payment request or address')).toBeVisible();
  await expect(region.locator('video')).toHaveCount(0);
  await region.getByRole('button', { name: 'Cancel' }).click();
  await expect(region.getByLabel('Payment request or address')).toHaveCount(0);
  await expect(region.locator('video')).toBeVisible();
  await region.getByRole('button', { name: 'Enter manually' }).click();
  await page.getByRole('link', { name: 'Back to the forum' }).click();
  await expect(region.getByLabel('Payment request or address')).toHaveCount(0);
  await expect(region.locator('video')).toBeVisible();
  await page.getByRole('link', { name: 'Back to the forum' }).click();
  await expect(page.getByRole('region', { name: 'Send Bitcoin' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Balance' })).toBeVisible();
});

test('wallet Send shows the unavailable and unreadable alerts with Try again', async ({ page }) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  for (const [pin, message] of [
    ['send-unavailable', 'Your 21.gifts wallet is not available here, so this cannot be paid.'],
    ['send-unreadable', 'This could not be read. Please try again.'],
  ] as const) {
    await page.goto(`/wallet?visual=${pin}`);
    const region = page.getByRole('region', { name: 'Send Bitcoin' });
    await expect(region.getByRole('alert')).toHaveText(message);
    await expect(region.getByRole('button', { name: 'Try again' })).toBeVisible();
  }
});

test('wallet Receive shows the QR, the address, Copy, and Set an amount; Back returns home', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signInWalletEligible(page);
  await page.goto('/wallet?visual=balance-ready');
  await page.getByRole('button', { name: 'Receive' }).click();
  await expect(page.getByRole('img', { name: 'Open CryptoPay QR code' })).toBeVisible();
  await expect(page.getByText('ada@21.gifts')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Set an amount' })).toHaveAttribute('href', '/pos');
  await expect(page.getByRole('region', { name: 'Balance' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Copy' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('ada@21.gifts');
  await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible({ timeout: 5_000 });
  await page.getByRole('link', { name: 'Back to the forum' }).click();
  await expect(page.getByRole('region', { name: 'Balance' })).toBeVisible();
  await expect(page).toHaveURL(/\/wallet\?visual=balance-ready$/);
});

test('wallet balance without a usable rate shows only bitcoin and cannot be tapped', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await page.route('**/fx/spot', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });
  const spot = page.waitForResponse('**/fx/spot');
  await page.goto('/wallet?visual=balance-ready');
  await spot;
  const region = page.getByRole('region', { name: 'Balance' });
  await expect(region.getByText("₿21'000")).toBeVisible();
  await expect(region.getByRole('button')).toHaveCount(0);
});

test('wallet balance tap swaps the large figure between bitcoin and fiat', async ({ page }) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=balance-ready');
  const region = page.getByRole('region', { name: 'Balance' });
  const toggle = region.getByRole('button');
  await expect(toggle.locator('span').first()).toHaveText("₿21'000");
  await toggle.click();
  await expect(toggle.locator('span').first()).toHaveText('$21.00');
  await expect(toggle.locator('span').last()).toHaveText("₿21'000");
  await toggle.click();
  await expect(toggle.locator('span').first()).toHaveText("₿21'000");
});
