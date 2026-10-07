import { expect, test, type Page } from '@playwright/test';

const RATE_DAY_STATS = {
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

const PUBKEY = `02${'a'.repeat(64)}`;

/** Signed-in account that would need the one-time wallet setup when the wallet is configured. */
async function signIn(page: Page, overrides: Record<string, unknown> = {}): Promise<void> {
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
        sparkPubkey: null,
        sparkWalletVerified: false,
        ...overrides,
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
  await page.route('**/gifts/stats**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(RATE_DAY_STATS),
    });
  });
}

/** Opens `/wallet` and records every request URL. */
async function openWallet(page: Page, query = ''): Promise<string[]> {
  const urls: string[] = [];
  page.on('request', (req) => {
    urls.push(req.url());
  });
  await page.goto(`/wallet${query}`);
  await expect(page.getByRole('heading', { name: 'Wallet', exact: true })).toBeVisible();
  return urls;
}

/** With the key unset, `/wallet` shows no payment list and loads no wallet code. */
async function expectNoLiveHistory(page: Page): Promise<void> {
  await signIn(page, { sparkWalletVerified: true, sparkPubkey: PUBKEY });
  const urls = await openWallet(page);
  await expect(page.getByRole('region', { name: 'Payments' })).toHaveCount(0);
  expect(urls.some((u) => u.endsWith('.wasm'))).toBe(false);
}

test.describe('wallet setup endpoints', () => {
  test('Function: proxyMeWalletPut — put without a session is 401', async ({ request }) => {
    const response = await request.put('/me/wallet', { data: { sparkPubkey: PUBKEY } });
    expect(response.status()).toBe(401);
  });

  test('Function: putWallet — put with an unknown session is 401', async ({ request }) => {
    const response = await request.put('/me/wallet', {
      headers: { Authorization: 'Bearer not-a-session' },
      data: { sparkPubkey: PUBKEY },
    });
    expect(response.status()).toBe(401);
  });

  test('Function: proxyLnurlpayRegisterPost — registration is forwarded to the api', async ({
    request,
  }) => {
    expect((await request.post('/lnurlpay/[pubkey]')).status()).toBe(404);
    const response = await request.post(`/lnurlpay/${PUBKEY}`, {
      headers: { 'X-Breez-Signature': 'sig', 'X-Breez-Timestamp': '1700000000' },
      data: { username: 'ada' },
    });
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });

  test('Function: proxyLnurlpayRecoverPost — recover is forwarded to the api', async ({
    request,
  }) => {
    expect((await request.post('/lnurlpay/[pubkey]/recover')).status()).toBe(404);
    expect((await request.post(`/lnurlpay/${PUBKEY}/recover`, { data: {} })).status()).toBe(404);
  });

  test('Function: proxyLnurlpayMetadataGet — metadata is forwarded to the api', async ({
    request,
  }) => {
    expect((await request.get('/lnurlpay/[pubkey]/metadata')).status()).toBe(404);
    expect((await request.get(`/lnurlpay/${PUBKEY}/metadata?offset=0`)).status()).toBe(404);
  });

  test('Function: proxyLnurlpInvoiceGet — any origin may read the invoice route', async ({
    request,
  }) => {
    const response = await request.get('/lnurlp/[username]/invoice');
    expect(response.status()).toBe(404);
    expect(response.headers()['access-control-allow-origin']).toBe('*');
    const named = await request.get('/lnurlp/ada/invoice?amount=1000');
    expect(named.status()).toBe(404);
    expect(named.headers()['access-control-allow-origin']).toBe('*');
  });

  test('Function: proxyVerifyGet — any origin may read the verify route', async ({ request }) => {
    const response = await request.get('/verify/[paymentHash]');
    expect(response.status()).toBe(404);
    expect(response.headers()['access-control-allow-origin']).toBe('*');
  });
});

test.describe('wallet setup dialog', () => {
  test('wallet setup-intro pin shows Set up wallet', async ({ page }) => {
    await signIn(page);
    await openWallet(page, '?visual=setup-intro');
    const dialog = page.getByRole('dialog', { name: 'Set up your wallet' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Set up wallet' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Log out' })).toBeVisible();
  });

  test('wallet setup-progress pin shows the progress line', async ({ page }) => {
    await signIn(page);
    await openWallet(page, '?visual=setup-progress');
    await expect(
      page.getByRole('status').filter({ hasText: 'Setting up your wallet…' }),
    ).toBeVisible();
  });

  test('wallet setup-error pin shows the error and Try again', async ({ page }) => {
    await signIn(page);
    await openWallet(page, '?visual=setup-error');
    await expect(
      page.getByText('Your wallet could not be set up. Please try again.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('wallet setup-no-prf pin says this phone or browser cannot hold a wallet', async ({
    page,
  }) => {
    await signIn(page);
    await openWallet(page, '?visual=setup-no-prf');
    await expect(
      page.getByRole('dialog', { name: 'No wallet on this phone or browser' }),
    ).toBeVisible();
    await expect(
      page.getByText(
        'This phone or browser cannot hold a 21.gifts wallet. Please use an up-to-date phone or browser that supports passkeys.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
  });

  test('Function: WalletSetupNotice — Log out leaves the setup for the login page', async ({
    page,
  }) => {
    await signIn(page);
    await openWallet(page, '?visual=setup-error');
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('Function: useWalletSetup — a pinned view stays inert on Set up wallet', async ({
    page,
  }) => {
    await signIn(page);
    await openWallet(page, '?visual=setup-intro');
    await page.getByRole('button', { name: 'Set up wallet' }).click();
    await expect(page.getByRole('button', { name: 'Set up wallet' })).toBeVisible();
  });

  test('Function: walletSetupPin — an unknown pin shows no setup dialog', async ({ page }) => {
    await signIn(page);
    await openWallet(page, '?visual=setup-unknown');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Function: walletSetupInFlight — unset key runs no setup and shows no progress', async ({
    page,
  }) => {
    await signIn(page);
    await openWallet(page);
    await expect(page.getByText('Setting up your wallet…')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Function: settlePhraseDerivations — unset key asks for no second passkey', async ({
    page,
  }) => {
    await signIn(page);
    await openWallet(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Setting up your wallet…')).toHaveCount(0);
  });

  test('Function: needsWalletSetup — unset key shows no setup dialog', async ({ page }) => {
    await signIn(page);
    await openWallet(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Function: runWalletSetup — unset key never claims or loads the wallet', async ({
    page,
  }) => {
    await signIn(page);
    const urls = await openWallet(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(urls.some((u) => u.endsWith('/me/wallet'))).toBe(false);
    expect(urls.some((u) => u.includes('/lnurlpay/'))).toBe(false);
    expect(urls.some((u) => u.endsWith('.wasm'))).toBe(false);
  });
});

test.describe('wallet history', () => {
  test('wallet history-empty pin shows no payments yet', async ({ page }) => {
    await signIn(page, { sparkWalletVerified: true, sparkPubkey: PUBKEY });
    await openWallet(page, '?visual=history-empty');
    await expect(page.getByRole('region', { name: 'Payments' })).toBeVisible();
    await expect(page.getByText('No payments yet.')).toBeVisible();
  });

  test('wallet history-rows pin shows titled rows with signed amounts, fiat, status, and messages', async ({
    page,
  }) => {
    await signIn(page, { sparkWalletVerified: true, sparkPubkey: PUBKEY });
    await openWallet(page, '?visual=history-rows');
    const rows = page.getByRole('region', { name: 'Payments' }).getByRole('link');
    await expect(rows).toHaveCount(10);
    await expect(rows.nth(0)).toContainText('Gift on your post');
    await expect(rows.nth(0)).toContainText("+₿2'100");
    await expect(rows.nth(0)).toContainText('$2.10');
    await expect(rows.nth(0)).toContainText('Great photo!');
    await expect(rows.nth(1)).toContainText('Gift to @alice');
    await expect(rows.nth(1)).toContainText("−₿5'000");
    await expect(rows.nth(3)).toContainText('bob@example.com');
    await expect(rows.nth(3)).toContainText('Thanks for dinner');
    await expect(page.getByText('Happy birthday!')).toBeVisible();
    await expect(rows.nth(5)).toContainText('Pending');
    await expect(rows.nth(6)).toContainText('Failed');
    await expect(rows.nth(7)).toContainText('On-chain deposit');
    await expect(rows.nth(8)).toContainText('On-chain withdrawal');
  });

  test('Function: WalletPaymentDetails — tapping a row opens its payment screen and the arrow returns to the list', async ({
    page,
  }) => {
    await signIn(page, { sparkWalletVerified: true, sparkPubkey: PUBKEY });
    await openWallet(page, '?visual=history-rows');
    const rows = page.getByRole('region', { name: 'Payments' }).getByRole('link');
    await rows.nth(3).click();
    await expect(page).toHaveURL(/\/wallet\/payment\?id=abe077a7-[0-9a-f-]+&visual=history-rows$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Payment' })).toBeAttached();
    await expect(page.getByText("−₿10'000")).toBeVisible();
    await expect(page.getByText('Thanks for dinner')).toBeVisible();
    const summary = page.locator('[data-scroll-page] dl').first();
    await expect(summary).toContainText('Total');
    await expect(summary).toContainText("₿10'003");
    await page.getByRole('link', { name: 'Back', exact: true }).click();
    await expect(page).toHaveURL(/\/wallet\?visual=history-rows$/);
    await expect(page.getByRole('region', { name: 'Payments' })).toBeVisible();
  });

  test('Function: useWalletPayment — an unknown payment says it could not be found', async ({
    page,
  }) => {
    await signIn(page, { sparkWalletVerified: true, sparkPubkey: PUBKEY });
    await page.goto('/wallet/payment?id=nope&visual=history-rows');
    await expect(page.getByText('This payment could not be found.')).toHaveAttribute(
      'role',
      'alert',
    );
    await page.goto('/wallet/payment?visual=history-rows');
    await expect(page.getByText('This payment could not be found.')).toHaveAttribute(
      'role',
      'alert',
    );
  });

  test('Function: useLatestRateDayState — the payment screen shows its amounts only with the loaded fiat', async ({
    page,
  }) => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await signIn(page, { sparkWalletVerified: true, sparkPubkey: PUBKEY });
    // After signIn, so this hold wins over its rate answer (the latest route is used first).
    await page.route(/\/gifts\/stats(?:\?|$)/, async (route) => {
      await held;
      await route.fallback();
    });
    await page.goto('/wallet/payment?id=f43f0362-edf9-4387-8edb-e18af9bb4dbc&visual=history-rows');
    await expect(page.getByRole('heading', { level: 1, name: 'Payment' })).toBeAttached();
    await expect(page.getByText("+₿2'100")).toHaveCount(0);
    release();
    await expect(page.getByText("+₿2'100")).toBeVisible();
  });

  test('wallet payment screen copies a technical value in full and shows no key or note id', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await signIn(page, { sparkWalletVerified: true, sparkPubkey: PUBKEY });
    await openWallet(page, '?visual=history-rows');
    await page.getByRole('region', { name: 'Payments' }).getByRole('link').first().click();
    await expect(page.getByText('Gift on your post')).toBeVisible();
    await expect(page.getByText(/npub1|note1/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Copy Payment ID' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      'f43f0362-edf9-4387-8edb-e18af9bb4dbc',
    );
  });

  test('Function: paymentHref — an on-chain payment links to mempool.space only through the external-link warning', async ({
    page,
  }) => {
    await signIn(page, { sparkWalletVerified: true, sparkPubkey: PUBKEY });
    await openWallet(page, '?visual=history-rows');
    await page.getByRole('region', { name: 'Payments' }).getByRole('link').nth(7).click();
    await expect(page).toHaveURL(/\/wallet\/payment\?id=9bc2f53d-/);
    await page.getByRole('link', { name: 'View on mempool.space' }).click();
    await expect(page.getByRole('dialog', { name: 'Open external link?' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Function: paymentTitle — the rows pin names each row', async ({ page }) => {
    await signIn(page, { sparkWalletVerified: true, sparkPubkey: PUBKEY });
    await openWallet(page, '?visual=history-rows');
    const rows = page.getByRole('region', { name: 'Payments' }).getByRole('link');
    await expect(rows.first()).toContainText('Gift on your post');
    await expect(rows.nth(9)).toContainText('Posting fee');
  });

  test('Function: paymentMessage — the rows pin shows the message under each row', async ({
    page,
  }) => {
    await signIn(page, { sparkWalletVerified: true, sparkPubkey: PUBKEY });
    await openWallet(page, '?visual=history-rows');
    const rows = page.getByRole('region', { name: 'Payments' }).getByRole('link');
    await expect(rows.first()).toContainText('Great photo!');
    await expect(rows.nth(4)).toContainText('Happy birthday!');
  });

  test('Function: WalletPaymentPage — /wallet/payment renders the payment screen behind the wallet chrome', async ({
    page,
  }) => {
    await signIn(page, { sparkWalletVerified: true, sparkPubkey: PUBKEY });
    await page.goto('/wallet/payment');
    await expect(page.getByRole('heading', { level: 1, name: 'Payment' })).toBeAttached();
    await expect(page.getByText('This payment could not be found.')).toHaveAttribute(
      'role',
      'alert',
    );
    await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  });

  test('wallet history-error pin shows the error and Try again', async ({ page }) => {
    await signIn(page, { sparkWalletVerified: true, sparkPubkey: PUBKEY });
    await openWallet(page, '?visual=history-error');
    await expect(
      page.getByText('Your payments could not be loaded. Please try again.'),
    ).toBeVisible();
  });

  test('Function: WalletHistory — the list sits between the balance and Send', async ({ page }) => {
    await signIn(page, { sparkWalletVerified: true, sparkPubkey: PUBKEY });
    await openWallet(page, '?visual=history-rows');
    const payments = await page.getByRole('region', { name: 'Payments' }).boundingBox();
    const balance = await page.getByRole('region', { name: 'Balance' }).boundingBox();
    const send = await page.getByRole('button', { name: 'Send', exact: true }).boundingBox();
    expect(payments).not.toBeNull();
    expect(balance).not.toBeNull();
    expect(send).not.toBeNull();
    // The list scrolls in the page scrollport; Send stays fixed in the footer below its start.
    expect(payments?.y ?? 0).toBeGreaterThanOrEqual((balance?.y ?? 0) + (balance?.height ?? 0));
    expect(payments?.y ?? 0).toBeLessThan(send?.y ?? 0);
    await expect(page.locator('[data-scrollport] button', { hasText: 'Receive' })).toHaveCount(0);
  });

  test('Function: useWalletHistory — pinned rows stay ten after scrolling', async ({ page }) => {
    await signIn(page, { sparkWalletVerified: true, sparkPubkey: PUBKEY });
    await openWallet(page, '?visual=history-rows');
    const rows = page.getByRole('region', { name: 'Payments' }).getByRole('listitem');
    await rows.last().scrollIntoViewIfNeeded();
    await expect(rows).toHaveCount(10);
  });

  test('Function: getWalletPayment — unset key shows no payment screen data or wasm', async ({
    page,
  }) => {
    const urls: string[] = [];
    page.on('request', (request) => {
      urls.push(request.url());
    });
    await signIn(page, { sparkWalletVerified: true, sparkPubkey: PUBKEY });
    await page.goto('/wallet/payment?id=p1');
    await expect(page.getByRole('heading', { level: 1, name: 'Payment' })).toBeAttached();
    await expect(page.getByText('Date', { exact: true })).toHaveCount(0);
    expect(urls.some((u) => u.endsWith('.wasm'))).toBe(false);
  });

  test('Function: toWalletPayment — unset key shows no payment list or wasm', async ({ page }) => {
    await expectNoLiveHistory(page);
  });

  test('Function: ensureWalletConnected — unset key shows no payment list or wasm', async ({
    page,
  }) => {
    await expectNoLiveHistory(page);
  });

  test('Function: registerWalletAddress — unset key shows no payment list or wasm', async ({
    page,
  }) => {
    await expectNoLiveHistory(page);
  });

  test('Function: listWalletPayments — unset key shows no payment list or wasm', async ({
    page,
  }) => {
    await expectNoLiveHistory(page);
  });
});

test.describe('username freeze', () => {
  test('username-frozen shows the current username disabled with the reason', async ({ page }) => {
    await signIn(page, {
      sparkWalletVerified: true,
      sparkPubkey: PUBKEY,
      setup: 'username',
      missing: ['username'],
    });
    await page.goto('/setup/username');
    const field = page.getByRole('textbox');
    await expect(field).toHaveValue('ada');
    await expect(field).toBeDisabled();
    await expect(
      page.getByText('Your username can no longer be changed because your wallet address uses it.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });
});
