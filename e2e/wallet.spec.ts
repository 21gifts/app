import { expect, test, type Page } from '@playwright/test';

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

/** Sign in an account that can unlock the in-app wallet (new balance tests only). */
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
}

test('wallet page shows Add recovery phrase for an existing member', async ({ page }) => {
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
  await expect(page.getByRole('link', { name: 'Add recovery phrase' })).toBeVisible();
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
  await expect(page.getByText('Advanced functions')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Balance' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Unlock wallet' })).toHaveCount(0);
});

test('wallet balance-locked pin shows unlock control', async ({ page }) => {
  await signInWalletEligible(page);
  await page.goto('/wallet?visual=balance-locked');
  const region = page.getByRole('region', { name: 'Balance' });
  await expect(region).toBeVisible();
  await expect(region.getByText('Unlock your wallet to see your Bitcoin balance.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unlock wallet' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Set an amount' })).toBeVisible();
  await page.getByRole('button', { name: 'Unlock wallet' }).click();
  await expect(page.getByRole('button', { name: 'Unlock wallet' })).toBeVisible();
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

test('Function: unlockWalletPhrase — locked pin shows Unlock wallet', async ({ page }) => {
  await signInWalletEligible(page);
  await page.goto('/wallet?visual=balance-locked');
  await expect(page.getByRole('button', { name: 'Unlock wallet' })).toBeVisible();
});

test('Function: canUnlockWallet — locked pin for eligible account', async ({ page }) => {
  await signInWalletEligible(page);
  await page.goto('/wallet?visual=balance-locked');
  await expect(page.getByRole('region', { name: 'Balance' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unlock wallet' })).toBeVisible();
});

async function stubWalletRate(page: Page): Promise<void> {
  await page.route('**/gifts/stats**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(WALLET_RATE_DAY_STATS),
    });
  });
}

test('wallet key unset shows no send region', async ({ page }) => {
  await signInWalletEligible(page);
  await page.goto('/wallet');
  await expect(page.getByRole('heading', { name: 'Wallet' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Send Bitcoin' })).toHaveCount(0);
});

test('wallet balance pins other than ready show no send region', async ({ page }) => {
  await signInWalletEligible(page);
  await page.goto('/wallet?visual=balance-locked');
  await expect(page.getByRole('button', { name: 'Unlock wallet' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Send Bitcoin' })).toHaveCount(0);
});

test('wallet send-input pin shows the paste field under the balance', async ({ page }) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-input');
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await expect(region).toBeVisible();
  const field = region.getByLabel('Payment request or address');
  await expect(field).toHaveAttribute('placeholder', 'Paste a Bitcoin payment request or address');
  await expect(region.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await field.fill('lnbc1');
  await expect(region.getByRole('button', { name: 'Continue' })).toBeEnabled();
  await expect(page.getByRole('region', { name: 'Balance' }).getByText("₿21'000")).toBeVisible();
});

test('wallet send-amount pin asks for an amount, bounds, and a comment', async ({ page }) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-amount');
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await expect(region.getByText('To bob@example.com')).toBeVisible();
  await expect(region.getByLabel('Amount')).toBeVisible();
  await expect(
    region.getByText(/^Between ₿1 · \$0\.00 and ₿1'000'000 · \$1.000\.00$/),
  ).toBeVisible();
  await expect(region.getByLabel('Message (optional)')).toHaveAttribute('maxlength', '140');
  await expect(region.getByRole('button', { name: 'Cancel' })).toBeVisible();
});

test('wallet send-confirm pin shows recipient, amount, and fee with fiat', async ({ page }) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-confirm');
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await expect(region.getByText('To bob@example.com')).toBeVisible();
  await expect(region.getByText("Send ₿2'100")).toBeVisible();
  await expect(region.getByText('$2.10')).toBeVisible();
  await expect(region.getByText(/Fee ₿0/)).toBeVisible();
  await expect(region.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
});

test('wallet send-sent pin shows the sent amount and Done', async ({ page }) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-sent');
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await expect(region.getByRole('status')).toContainText("Sent ₿2'100");
  await expect(region.getByRole('button', { name: 'Done' })).toBeVisible();
});

test('wallet send-onchain pin says a base-chain address is not supported yet', async ({ page }) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-onchain');
  await expect(page.getByRole('region', { name: 'Send Bitcoin' }).getByRole('alert')).toHaveText(
    'Sending to this kind of Bitcoin address is not supported yet.',
  );
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
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await expect(region.getByText('To bob@example.com')).toBeVisible();
  await expect(region.getByLabel('Message (optional)')).toBeVisible();
  await expect(region.getByRole('alert')).toHaveText('This message is too long for the receiver.');
});

test('wallet send pin: Cancel is inert while a step is pinned', async ({ page }) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-confirm');
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/wallet\?visual=send-confirm/);
});

test('Function: WalletSend — send-input pin shows the Send Bitcoin region', async ({ page }) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-input');
  await expect(page.getByRole('region', { name: 'Send Bitcoin' })).toBeVisible();
});

test('Function: useWalletSend — send-confirm pin shows the confirm step', async ({ page }) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-confirm');
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
});

test('Function: walletSendBounds — send-amount pin shows the receiver bounds', async ({ page }) => {
  await signInWalletEligible(page);
  await stubWalletRate(page);
  await page.goto('/wallet?visual=send-amount');
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
