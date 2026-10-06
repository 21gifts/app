import { expect, test, type Page } from '@playwright/test';

/**
 * In-app wallet pay slot of the gift pay sheet. The in-app wallet is the only
 * way to pay: there is no invoice QR and no link to another wallet app.
 * Playwright builds leave the wallet key unset, so the live slot says the
 * wallet is not available; the other states are reached through
 * `?visual=wallet-pay-…` pins, with or without a `sparkInvoice`.
 */

const UNAVAILABLE = 'Your 21.gifts wallet is not available here, so this cannot be paid.';

const SPARK_INVOICE = 'spark1e2egiftinvoice';

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

/** Signs in Ada, an account that could unlock the in-app wallet. */
async function signInAda(page: Page): Promise<void> {
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
        username: 'alice',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1_700_000_000,
        rulesAgreedAt: 1_700_000_001,
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
  await page.route('**/gifts/stats**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(RATE_DAY_STATS),
    });
  });
}

/** One post with one payable reply, and its invoice with or without `sparkInvoice`. */
async function stubPayableReply(page: Page, sparkInvoice: string | null): Promise<string[]> {
  const invoiceBodies: string[] = [];
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    const url = route.request().url();
    if (
      url.includes('/invoice') ||
      url.includes('/replies') ||
      route.request().method() !== 'GET'
    ) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-pay',
            name: 'Bob',
            text: 'Does anyone have spare sats this week?',
            createdAt: '2026-08-28T10:00:00.000Z',
            sats: 0,
            payable: true,
            hasPhoto: false,
            role: 'basis',
            replyCount: 1,
          },
        ],
      }),
    });
  });
  await page.route('**/messages/m-pay/replies', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'r-pay',
            name: 'Carol',
            text: 'A payable reply',
            createdAt: '2026-08-28T10:05:00.000Z',
            sats: 0,
            payable: true,
            hasPhoto: false,
            role: 'basis',
            replyCount: 0,
          },
        ],
      }),
    });
  });
  await page.route('**/messages/r-pay/invoice', async (route) => {
    const body = JSON.stringify(
      sparkInvoice === null
        ? { pr: 'lnbc21n1exampleinvoice', amountSats: 21 }
        : { pr: 'lnbc21n1exampleinvoice', amountSats: 21, sparkInvoice },
    );
    invoiceBodies.push(body);
    await route.fulfill({ status: 200, contentType: 'application/json', body });
  });
  return invoiceBodies;
}

/** Opens `/welcome` (with an optional pin), then the Gift pay sheet on the reply, and submits 21. */
async function openPaySheet(page: Page, visual: string | null): Promise<void> {
  await page.goto(visual === null ? '/welcome' : `/welcome?visual=${visual}`);
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Forum view' }).click();
  await page.getByRole('option', { name: 'All', exact: true }).click();
  await page.getByRole('button', { name: 'Show reactions' }).click();
  const replyCard = page.locator('[data-reply-id="r-pay"]');
  await replyCard.getByRole('button', { name: 'Send Bitcoin' }).click();
  await replyCard.getByLabel('Amount').fill('21');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText(/^Pay ₿21\b/)).toBeVisible();
}

test('wallet pay: key unset shows only the unavailable wallet sentence', async ({ page }) => {
  await signInAda(page);
  const bodies = await stubPayableReply(page, SPARK_INVOICE);
  const urls: string[] = [];
  page.on('request', (request) => {
    urls.push(request.url());
  });
  await openPaySheet(page, null);
  expect(bodies.some((body) => body.includes(SPARK_INVOICE))).toBe(true);
  const sheet = page.locator('[data-pay-sheet]');
  await expect(sheet.getByRole('status')).toHaveText(UNAVAILABLE);
  await expect(page.getByRole('button', { name: 'Pay with a Bitcoin wallet app' })).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Pay from wallet' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Unlock and pay/ })).toHaveCount(0);
  expect(urls.some((url) => url.endsWith('.wasm'))).toBe(false);
});

test('wallet pay: key unset without a sparkInvoice is still wallet-only', async ({ page }) => {
  await signInAda(page);
  await stubPayableReply(page, null);
  await openPaySheet(page, null);
  await expect(page.locator('[data-pay-sheet]').getByRole('status')).toHaveText(UNAVAILABLE);
  await expect(page.getByRole('button', { name: 'Pay with a Bitcoin wallet app' })).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toHaveCount(0);
});

test('wallet pay: a confirm pin works without a sparkInvoice', async ({ page }) => {
  await signInAda(page);
  await stubPayableReply(page, null);
  await openPaySheet(page, 'wallet-pay-confirm');
  await expect(page.getByRole('button', { name: 'Pay from wallet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pay with a Bitcoin wallet app' })).toHaveCount(0);
});

test('wallet pay: unavailable pin shows the unavailable wallet sentence', async ({ page }) => {
  await signInAda(page);
  await stubPayableReply(page, null);
  await openPaySheet(page, 'wallet-pay-unavailable');
  await expect(page.locator('[data-pay-sheet]').getByRole('status')).toHaveText(UNAVAILABLE);
});

test('wallet pay: locked wallet offers one Unlock and pay button and nothing else', async ({
  page,
}) => {
  await signInAda(page);
  await stubPayableReply(page, SPARK_INVOICE);
  await openPaySheet(page, 'wallet-pay-unlock');
  const sheet = page.locator('[data-pay-sheet]');
  await expect(sheet.getByRole('button', { name: /^Unlock and pay ₿21/ })).toHaveText(
    'Unlock and pay ₿21 · $0.02',
  );
  await expect(sheet.getByRole('button', { name: 'Unlock wallet' })).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: 'Pay from wallet' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Pay with a Bitcoin wallet app' })).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toHaveCount(0);
});

test('wallet pay: failed pin shows the prepare error and Try again', async ({ page }) => {
  await signInAda(page);
  await stubPayableReply(page, null);
  await openPaySheet(page, 'wallet-pay-failed');
  const sheet = page.locator('[data-pay-sheet]');
  await expect(sheet.getByRole('alert')).toHaveText(
    'Your wallet could not prepare this payment. Please try again.',
  );
  await expect(sheet.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('wallet pay: preparing pin shows Checking your wallet…', async ({ page }) => {
  await signInAda(page);
  await stubPayableReply(page, SPARK_INVOICE);
  await openPaySheet(page, 'wallet-pay-preparing');
  await expect(page.locator('[data-pay-sheet]').getByRole('status')).toHaveText(
    'Checking your wallet…',
  );
});

test('wallet pay: confirm pin shows the fee with fiat and Pay from wallet', async ({ page }) => {
  await signInAda(page);
  await stubPayableReply(page, SPARK_INVOICE);
  await openPaySheet(page, 'wallet-pay-confirm');
  const sheet = page.locator('[data-pay-sheet]');
  await expect(sheet.getByText(/Fee ₿0/)).toBeVisible();
  await expect(sheet.getByText('$0.00')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Pay from wallet' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Pay from wallet' }).click();
  await expect(sheet.getByRole('button', { name: 'Pay from wallet' })).toBeVisible();
});

test('wallet pay: paying pin shows Paying from your wallet… while waiting', async ({ page }) => {
  await signInAda(page);
  await stubPayableReply(page, SPARK_INVOICE);
  await openPaySheet(page, 'wallet-pay-paying');
  const sheet = page.locator('[data-pay-sheet]');
  await expect(sheet.getByRole('status')).toHaveText('Paying from your wallet…');
  await expect(sheet.getByText('Waiting for payment…')).toBeVisible();
});

test('wallet pay: insufficient pin shows the own address and QR to add funds', async ({ page }) => {
  await signInAda(page);
  await stubPayableReply(page, SPARK_INVOICE);
  await openPaySheet(page, 'wallet-pay-insufficient');
  const sheet = page.locator('[data-pay-sheet]');
  await expect(sheet.getByRole('alert')).toHaveText(
    'Your wallet does not have enough Bitcoin for this payment.',
  );
  await expect(sheet.getByText('To add Bitcoin, send it to your address:')).toBeVisible();
  await expect(sheet.getByText(/^alice@/)).toBeVisible();
  await expect(sheet.getByRole('img', { name: 'Open CryptoPay QR code' })).toBeVisible();
});

test('wallet pay: insufficient pin says how much is still missing in ₿ and fiat', async ({
  page,
}) => {
  await signInAda(page);
  await stubPayableReply(page, SPARK_INVOICE);
  await openPaySheet(page, 'wallet-pay-insufficient');
  const sheet = page.locator('[data-pay-sheet]');
  await expect(sheet.getByText(/^Still missing: ₿21/)).toHaveText('Still missing: ₿21 · $0.02');
  await expect(sheet.getByText(/^alice@/)).toBeVisible();
});

test('wallet pay: received pin says Bitcoin arrived and pays without another tap', async ({
  page,
}) => {
  await signInAda(page);
  await stubPayableReply(page, SPARK_INVOICE);
  await openPaySheet(page, 'wallet-pay-received');
  const sheet = page.locator('[data-pay-sheet]');
  await expect(sheet.getByRole('status')).toHaveText('Bitcoin received — paying…');
  await expect(sheet.getByRole('button', { name: 'Pay from wallet' })).toHaveCount(0);
  await expect(sheet.getByRole('alert')).toHaveCount(0);
});

test('wallet pay: unconfirmed pin shows the neutral sentence', async ({ page }) => {
  await signInAda(page);
  await stubPayableReply(page, SPARK_INVOICE);
  await openPaySheet(page, 'wallet-pay-unconfirmed');
  await expect(page.locator('[data-pay-sheet]').getByRole('status')).toHaveText(
    'This payment is not confirmed yet. Check your balance again later.',
  );
  await expect(page.locator('[data-pay-sheet]').getByRole('alert')).toHaveCount(0);
});

test('Function: WalletPay — confirm pin shows Pay from wallet and no wallet app link', async ({
  page,
}) => {
  await signInAda(page);
  await stubPayableReply(page, SPARK_INVOICE);
  await openPaySheet(page, 'wallet-pay-confirm');
  await expect(page.getByRole('button', { name: 'Pay from wallet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pay with a Bitcoin wallet app' })).toHaveCount(0);
});

test('Function: WalletPay — locked pin shows one Unlock and pay button with the amount and fiat', async ({
  page,
}) => {
  await signInAda(page);
  await stubPayableReply(page, null);
  await openPaySheet(page, 'wallet-pay-unlock');
  const sheet = page.locator('[data-pay-sheet]');
  await expect(sheet.getByRole('button', { name: /^Unlock and pay ₿21/ })).toHaveText(
    'Unlock and pay ₿21 · $0.02',
  );
  await expect(sheet.getByRole('button', { name: 'Close' })).toBeVisible();
  await expect(sheet.getByRole('button')).toHaveCount(2);
  await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toHaveCount(0);
});

test('Function: useWalletPay — a tap on the pinned Unlock and pay neither prompts nor pays', async ({
  page,
}) => {
  await signInAda(page);
  await stubPayableReply(page, SPARK_INVOICE);
  await openPaySheet(page, 'wallet-pay-unlock');
  const sheet = page.locator('[data-pay-sheet]');
  const button = sheet.getByRole('button', { name: /^Unlock and pay ₿21/ });
  await button.click();
  await expect(button).toBeVisible();
  await expect(sheet.getByText('Checking your wallet…')).toHaveCount(0);
  await expect(sheet.getByText('Paying from your wallet…')).toHaveCount(0);
});

test('Function: useWalletPay — the received pin after a top-up shows no second pay button', async ({
  page,
}) => {
  await signInAda(page);
  await stubPayableReply(page, SPARK_INVOICE);
  await openPaySheet(page, 'wallet-pay-received');
  const sheet = page.locator('[data-pay-sheet]');
  await expect(sheet.getByText('Bitcoin received — paying…')).toBeVisible();
  await expect(sheet.getByRole('button', { name: /^Unlock and pay/ })).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: 'Pay from wallet' })).toHaveCount(0);
  await expect(
    sheet.getByText('Your wallet does not have enough Bitcoin for this payment.'),
  ).toHaveCount(0);
});

test('Function: WalletPay — insufficient pin shows the missing amount above the own address and QR', async ({
  page,
}) => {
  await signInAda(page);
  await stubPayableReply(page, null);
  await openPaySheet(page, 'wallet-pay-insufficient');
  const sheet = page.locator('[data-pay-sheet]');
  await expect(sheet.getByText('Still missing: ₿21 · $0.02')).toBeVisible();
  await expect(sheet.getByRole('img', { name: 'Open CryptoPay QR code' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toHaveCount(0);
});

test('Function: useWalletPay — an unset wallet key gives the unavailable view', async ({
  page,
}) => {
  await signInAda(page);
  await stubPayableReply(page, SPARK_INVOICE);
  await openPaySheet(page, null);
  await expect(page.locator('[data-pay-sheet]').getByRole('status')).toHaveText(UNAVAILABLE);
});

test('Function: payFromWallet — not called while the wallet is not configured', async ({
  page,
}) => {
  await signInAda(page);
  await stubPayableReply(page, SPARK_INVOICE);
  const urls: string[] = [];
  page.on('request', (request) => {
    urls.push(request.url());
  });
  await openPaySheet(page, null);
  await expect(page.locator('[data-pay-sheet]').getByRole('status')).toHaveText(UNAVAILABLE);
  expect(urls.some((url) => url.endsWith('.wasm'))).toBe(false);
});

test('Function: ForumLoader — paying the posting fee from the wallet shows the post and closes the card', async ({
  page,
}) => {
  // Playwright builds have no wallet key, so the slot is pinned to its paying
  // state; the stubbed api then settles the fee and creates the post, as the
  // api does when the wallet's Spark payment arrives.
  await signInAda(page);
  const text = 'Hello from my wallet';
  let invoiced = false;
  let paid = false;
  let failedOwnCount = false;
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    const request = route.request();
    if (request.method() !== 'GET') {
      await route.continue();
      return;
    }
    const mode = new URL(request.url()).searchParams.get('mode');
    if (mode === 'all' && invoiced && !failedOwnCount) {
      failedOwnCount = true;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Messages are unavailable' }),
      });
      return;
    }
    const messages =
      mode === 'all' && paid
        ? [
            {
              id: 'm-new',
              accountId: 'acc_e2e',
              name: 'Ada',
              text,
              createdAt: '2026-10-05T13:25:00.000Z',
              sats: 0,
              payable: true,
              hasPhoto: false,
              role: 'basis',
              replyCount: 0,
            },
          ]
        : [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages }),
    });
  });
  await page.route('**/messages/compose-target', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messageId: 'fee-note', sats: 0 }),
    });
  });
  await page.route('**/messages/fee-note/invoice', async (route) => {
    expect((route.request().postDataJSON() as { text?: string }).text).toBe(text);
    invoiced = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        pr: 'lnbc10n1postingfee',
        amountSats: 1,
        sparkInvoice: SPARK_INVOICE,
      }),
    });
  });
  await page.route('**/public-messages/fee-note**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'fee-note',
        accountId: 'acc_platform',
        name: '21.gifts',
        text: 'Posting fees go here.',
        createdAt: '2026-10-05T13:22:00.000Z',
        sats: paid ? 1 : 0,
        payable: true,
        hasPhoto: false,
        role: 'basis',
        replyCount: 0,
      }),
    });
  });
  await page.goto('/welcome?visual=wallet-pay-paying');
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await page.getByLabel('Your message').fill(text);
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  const sheet = page.locator('[data-pay-sheet]');
  await expect(sheet.getByText('Pay ₿1')).toBeVisible();
  await expect(sheet.getByRole('status')).toHaveText('Paying from your wallet…');
  await expect(sheet.getByText('Waiting for payment…')).toBeVisible();
  await expect.poll(() => failedOwnCount).toBe(true);
  paid = true;
  await expect(page.getByText(text)).toBeVisible();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByText('Waiting for payment…')).toHaveCount(0);
  await expect(page.getByLabel('Your message')).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Forum view' })).toContainText('All');
});
