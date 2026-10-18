import { expect, test, type Page } from '@playwright/test';
import { fulfillSpot, spotRatesFromStats } from './fx-spot';

/** Opens the forum home writer from the floating + (the composer is not on the page). */
async function openHomeWriter(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Write a post' }).click();
  await expect(page.locator('[data-writing-composer]')).toBeVisible();
}

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

/** Signs in Ada, whose seed passkey owns the in-app wallet. */
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
  await fulfillSpot(page, spotRatesFromStats(RATE_DAY_STATS));
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
  const sheet = page.getByRole('dialog', { name: 'Send to Carol' });
  await expect(sheet.getByText('₿21', { exact: true })).toBeVisible();
  // The fiat of the amount, on its own line under it.
  await expect(sheet.locator('p', { hasText: /^\$0\.02$/ })).toBeVisible();
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
  await expect(page.getByRole('button', { name: 'Send ₿21', exact: true })).toHaveCount(0);
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
  await expect(page.getByRole('button', { name: 'Send ₿21', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pay with a Bitcoin wallet app' })).toHaveCount(0);
});

test('wallet pay: unavailable pin shows the unavailable wallet sentence', async ({ page }) => {
  await signInAda(page);
  await stubPayableReply(page, null);
  await openPaySheet(page, 'wallet-pay-unavailable');
  await expect(page.locator('[data-pay-sheet]').getByRole('status')).toHaveText(UNAVAILABLE);
});

test('wallet pay confirm shows Send ₿21 without another wallet fallback', async ({ page }) => {
  await signInAda(page);
  await stubPayableReply(page, SPARK_INVOICE);
  await page.goto('/wallet?visual=balance-ready');
  await expect(page.getByRole('heading', { name: 'Wallet', exact: true })).toBeVisible();

  await openPaySheet(page, 'wallet-pay-confirm');
  const sheet = page.locator('[data-pay-sheet]');
  await expect(sheet.getByRole('button', { name: 'Send ₿21', exact: true })).toBeVisible();
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

test('wallet-pay-setup-failed pin shows the setup note and Try again', async ({ page }) => {
  await signInAda(page);
  await stubPayableReply(page, null);
  await openPaySheet(page, 'wallet-pay-setup-failed');
  const sheet = page.locator('[data-pay-sheet]');
  await expect(sheet.getByRole('alert')).toContainText('Your wallet could not be set up yet.');
  await expect(sheet.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Set up your wallet' })).toHaveCount(0);
});

test('wallet pay: preparing pin shows Checking your wallet…', async ({ page }) => {
  await signInAda(page);
  await stubPayableReply(page, SPARK_INVOICE);
  await openPaySheet(page, 'wallet-pay-preparing');
  await expect(page.locator('[data-pay-sheet]').getByRole('status')).toHaveText(
    'Checking your wallet…',
  );
});

test('wallet pay: confirm pin shows no row for the fee of ₿0, only the full-width Send ₿21', async ({
  page,
}) => {
  await signInAda(page);
  await stubPayableReply(page, SPARK_INVOICE);
  await openPaySheet(page, 'wallet-pay-confirm');
  const sheet = page.locator('[data-pay-sheet]');
  const send = sheet.getByRole('button', { name: 'Send ₿21', exact: true });
  await expect(send).toBeVisible();
  await expect(sheet.getByText(/Fee ₿/)).toHaveCount(0);
  const widths = await send.evaluate((node) => {
    const slot = node.parentElement as HTMLElement;
    return [node.getBoundingClientRect().width, slot.getBoundingClientRect().width];
  });
  expect(widths[0]).toBe(widths[1]);
  await send.click();
  await expect(send).toBeVisible();
});

test('wallet pay: paying pin shows Paying from your wallet… and no waiting line', async ({
  page,
}) => {
  await signInAda(page);
  await stubPayableReply(page, SPARK_INVOICE);
  await openPaySheet(page, 'wallet-pay-paying');
  const sheet = page.locator('[data-pay-sheet]');
  await expect(sheet.getByRole('status')).toHaveText('Paying from your wallet…');
  await expect(page.getByText('Waiting for payment…')).toHaveCount(0);
});

test('wallet pay: insufficient pin offers Add Bitcoin, with no address and no QR', async ({
  page,
}) => {
  await signInAda(page);
  await stubPayableReply(page, SPARK_INVOICE);
  await openPaySheet(page, 'wallet-pay-insufficient');
  const sheet = page.locator('[data-pay-sheet]');
  await expect(sheet.getByRole('alert')).toHaveText(
    'Your wallet does not have enough Bitcoin for this payment.',
  );
  await expect(sheet.getByRole('button', { name: 'Add Bitcoin' })).toBeVisible();
  await expect(sheet.getByText('To add Bitcoin, send it to your address:')).toHaveCount(0);
  await expect(sheet.getByText(/^alice@/)).toHaveCount(0);
  await expect(sheet.getByRole('img')).toHaveCount(0);
});

test('wallet pay: insufficient pin says how much is still missing in ₿ and fiat', async ({
  page,
}) => {
  await signInAda(page);
  await stubPayableReply(page, SPARK_INVOICE);
  await openPaySheet(page, 'wallet-pay-insufficient');
  const sheet = page.locator('[data-pay-sheet]');
  await expect(sheet.getByText(/^Still missing: ₿21/)).toHaveText('Still missing: ₿21 · $0.02');
  await expect(sheet.getByRole('button', { name: 'Send ₿21', exact: true })).toHaveCount(0);
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

test('Function: WalletPay — confirm pin shows Send ₿21 and no wallet app link', async ({
  page,
}) => {
  await signInAda(page);
  await stubPayableReply(page, SPARK_INVOICE);
  await openPaySheet(page, 'wallet-pay-confirm');
  await expect(page.getByRole('button', { name: 'Send ₿21', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pay with a Bitcoin wallet app' })).toHaveCount(0);
});

test('Function: WalletPay — insufficient pin shows the missing amount above Add Bitcoin', async ({
  page,
}) => {
  await signInAda(page);
  await stubPayableReply(page, null);
  await openPaySheet(page, 'wallet-pay-insufficient');
  const sheet = page.locator('[data-pay-sheet]');
  await expect(sheet.getByText('Still missing: ₿21 · $0.02')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Add Bitcoin' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Open CryptoPay QR code' })).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toHaveCount(0);
});

test('Function: WalletPay — the posting fee confirm says Pay ₿1 and post without fiat or a fee row, a gift says Send ₿21', async ({
  page,
}) => {
  await signInAda(page);
  await stubPayableReply(page, SPARK_INVOICE);
  await page.route('**/messages/compose-target', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messageId: 'fee-note', sats: 0 }),
    });
  });
  await page.route('**/messages/fee-note/invoice', async (route) => {
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
  await page.goto('/welcome?visual=wallet-pay-confirm');
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await openHomeWriter(page);
  await page.getByLabel('Your message').fill('Paid and posted');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Pay to post' });
  await expect(sheet.getByRole('button', { name: /^Pay ₿1 and post/ })).toHaveText(
    'Pay ₿1 and post',
  );
  await expect(sheet.getByText(/Fee ₿/)).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: /^Send/ })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('[data-pay-sheet]')).toHaveCount(0);
  // The writer stays open behind the sheet; Back closes it before the gift.
  await expect(page.locator('[data-writing-composer]')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await openPaySheet(page, 'wallet-pay-confirm');
  await expect(
    page.locator('[data-pay-sheet]').getByRole('button', { name: 'Send ₿21', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /and post/ })).toHaveCount(0);
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
  await openHomeWriter(page);
  await page.getByLabel('Your message').fill(text);
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Pay to post' });
  await expect(sheet.getByText('₿1', { exact: true })).toBeVisible();
  await expect(sheet.getByRole('status')).toHaveText('Paying from your wallet…');
  await expect.poll(() => failedOwnCount).toBe(true);
  paid = true;
  await expect(page.getByText(text)).toBeVisible();
  // The payment closed the sheet: its success step shows, then it slides away.
  await expect(page.locator('[data-pay-sheet="success"]').getByRole('status')).toContainText(
    'Paid and posted',
  );
  await expect(page.locator('[data-pay-sheet]')).toHaveCount(0);
  // The paid post closed the writer; reopened, its field is empty.
  await expect(page.locator('[data-writing-composer]')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Forum view' })).toContainText('All');
  await openHomeWriter(page);
  await expect(page.getByLabel('Your message')).toHaveValue('');
});

/**
 * Posting fee of `text` that the stubbed api settles once `paid()` is called: from then on the
 * forum lists the visitor's new post, as the api does when the wallet's payment arrived.
 */
async function stubPostingFee(page: Page, text: string): Promise<{ paid: () => void }> {
  let settled = false;
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    const request = route.request();
    if (request.method() !== 'GET') {
      await route.continue();
      return;
    }
    const mode = new URL(request.url()).searchParams.get('mode');
    const messages =
      mode === 'all' && settled
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
        sats: settled ? 1 : 0,
        payable: true,
        hasPhoto: false,
        role: 'basis',
        replyCount: 0,
      }),
    });
  });
  return {
    paid: () => {
      settled = true;
    },
  };
}

/** Writes `text` in the forum home writer and posts it, so the posting fee's sheet opens. */
async function postFromWriter(page: Page, text: string): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await openHomeWriter(page);
  await page.getByLabel('Your message').fill(text);
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Pay to post' })).toBeVisible();
}

/** Records every `data-pay-sheet` step and every `data-swap` view (with `:inert`) from now on. */
async function recordSheetSteps(page: Page): Promise<() => Promise<string[]>> {
  await page.evaluate(() => {
    const log: string[] = [];
    (window as unknown as { sheetSteps: string[] }).sheetSteps = log;
    const read = (): void => {
      for (const el of Array.from(document.querySelectorAll('[data-pay-sheet], [data-swap]'))) {
        const step = el.hasAttribute('data-pay-sheet')
          ? `sheet:${String(el.getAttribute('data-pay-sheet'))}`
          : `swap:${String(el.getAttribute('data-swap'))}${el.hasAttribute('inert') ? ':inert' : ''}`;
        if (!log.includes(step)) {
          log.push(step);
        }
      }
    };
    read();
    new MutationObserver(read).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-pay-sheet', 'data-swap', 'inert'],
    });
  });
  return () => page.evaluate(() => (window as unknown as { sheetSteps: string[] }).sheetSteps);
}

test('Function: PaySheet — a gift opens the bottom sheet over the page; Close, the dimmed page and Escape cancel it without a success step', async ({
  page,
}) => {
  // A phone-sized frame, where the sheet rises from the frame's bottom edge.
  await page.setViewportSize({ width: 375, height: 812 });
  await signInAda(page);
  await stubPayableReply(page, SPARK_INVOICE);
  await openPaySheet(page, 'wallet-pay-confirm');
  const replyCard = page.locator('[data-reply-id="r-pay"]');
  const sheet = page.getByRole('dialog', { name: 'Send to Carol' });
  await expect(page.locator('[data-pay-sheet-layer="open"]')).toBeAttached();
  await expect(sheet.getByRole('heading', { name: 'Send to Carol' })).toBeVisible();
  // The amount box stays where it was, disabled, behind the dimmed page.
  await expect(replyCard.getByLabel('Amount')).toBeDisabled();
  await expect(replyCard.getByRole('button', { name: 'Continue' })).toBeDisabled();
  // Once it has slid up, the sheet sits on the bottom edge of the frame body.
  await expect
    .poll(() =>
      sheet.evaluate((node) => {
        const body = node.closest('[data-app-body]') as HTMLElement;
        return Math.abs(node.getBoundingClientRect().bottom - body.getBoundingClientRect().bottom);
      }),
    )
    .toBeLessThan(2);
  const steps = await recordSheetSteps(page);
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('[data-pay-sheet-layer="closed"]')).toBeAttached();
  await expect(page.locator('[data-pay-sheet]')).toHaveCount(0);
  await expect(replyCard.locator('[data-pay-amount]')).toHaveCount(0);
  expect(await steps()).not.toContain('sheet:success');

  await replyCard.getByRole('button', { name: 'Send Bitcoin' }).click();
  await replyCard.getByLabel('Amount').fill('21');
  await replyCard.getByRole('button', { name: 'Continue' }).click();
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-pay-sheet]')).toHaveCount(0);

  await replyCard.getByRole('button', { name: 'Send Bitcoin' }).click();
  await replyCard.getByLabel('Amount').fill('21');
  await replyCard.getByRole('button', { name: 'Continue' }).click();
  await expect(sheet).toBeVisible();
  // A tap on the dimmed page above the sheet.
  await page.locator('[data-pay-sheet-layer] > button').click({ position: { x: 20, y: 20 } });
  await expect(page.locator('[data-pay-sheet]')).toHaveCount(0);
  expect(await steps()).not.toContain('sheet:success');
});

test('Function: usePresent — when the payment closes the posting fee sheet, it shows Paid and posted, then slides away', async ({
  page,
}) => {
  await signInAda(page);
  const text = 'Paid from my wallet';
  const fee = await stubPostingFee(page, text);
  await page.goto('/welcome?visual=wallet-pay-paying');
  await postFromWriter(page, text);
  const steps = await recordSheetSteps(page);
  fee.paid();
  const success = page.locator('[data-pay-sheet="success"]');
  await expect(success.getByRole('status')).toContainText('Paid and posted');
  await expect(success.getByRole('status')).toContainText('₿1');
  // The pay host's fold is folded away, inert and at rest (`held`), while it holds the sheet for
  // this step.
  await expect(page.locator('[data-collapse="held"][inert]')).toHaveCount(1);
  await expect(page.locator('[data-pay-sheet-layer="closed"]')).toBeAttached();
  await expect(page.locator('[data-pay-sheet]')).toHaveCount(0);
  await expect(page.getByText(text)).toBeVisible();
  expect(await steps()).toEqual(expect.arrayContaining(['sheet:pay', 'sheet:success']));
});

test('Function: Swap — the pay sheet fades its pay step out before the success step fades in', async ({
  page,
}) => {
  await signInAda(page);
  const text = 'Faded into the success step';
  const fee = await stubPostingFee(page, text);
  await page.goto('/welcome?visual=wallet-pay-paying');
  await postFromWriter(page, text);
  const steps = await recordSheetSteps(page);
  fee.paid();
  await expect(page.locator('[data-pay-sheet="success"] [data-swap="success"]')).toBeVisible();
  const seen = await steps();
  const leaving = seen.indexOf('swap:pay:inert');
  expect(leaving, seen.join(' ')).toBeGreaterThanOrEqual(0);
  expect(leaving, seen.join(' ')).toBeLessThan(seen.indexOf('swap:success'));
});

test('Function: PaySheet — with reduced motion the sheet appears and leaves at once, and the success step still shows', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signInAda(page);
  const text = 'Paid without motion';
  const fee = await stubPostingFee(page, text);
  await page.goto('/welcome?visual=wallet-pay-paying');
  await postFromWriter(page, text);
  const panel = page.locator('[data-pay-sheet]');
  const duration = await panel.evaluate((node) => getComputedStyle(node).transitionDuration);
  expect(Number.parseFloat(duration)).toBeLessThan(0.001);
  fee.paid();
  await expect(page.locator('[data-pay-sheet="success"]').getByRole('status')).toContainText(
    'Paid and posted',
  );
  await expect(page.locator('[data-pay-sheet]')).toHaveCount(0);
});

test('Function: AddBitcoinButton — on the forum home Add Bitcoin closes the sheet and opens Receive over the forum', async ({
  page,
}) => {
  await signInAda(page);
  await stubPayableReply(page, SPARK_INVOICE);
  await openPaySheet(page, 'wallet-pay-insufficient');
  const sheet = page.getByRole('dialog', { name: 'Send to Carol' });
  await expect(sheet.getByText('Still missing: ₿21 · $0.02')).toBeVisible();
  await sheet.getByRole('button', { name: 'Add Bitcoin' }).click();
  await expect(page.locator('[data-pay-sheet]')).toHaveCount(0);
  await expect(page.getByText(/^alice@/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeHidden();
  await expect(page).toHaveURL(/\/welcome\?visual=wallet-pay-insufficient$/);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  // The payment was left: its amount box is closed too.
  await expect(page.locator('[data-pay-amount]')).toHaveCount(0);
});

test('Function: usePaySheetClose — Add Bitcoin leaves the payment as the member, so no success step shows', async ({
  page,
}) => {
  await signInAda(page);
  await stubPayableReply(page, SPARK_INVOICE);
  await openPaySheet(page, 'wallet-pay-insufficient');
  const steps = await recordSheetSteps(page);
  await page.getByRole('button', { name: 'Add Bitcoin' }).click();
  await expect(page.locator('[data-pay-sheet-layer="closed"]')).toBeAttached();
  await expect(page.locator('[data-pay-sheet]')).toHaveCount(0);
  expect(await steps()).not.toContain('sheet:success');
});

test('Function: OpenReceiveProvider — Add Bitcoin on the posting fee closes the writer and opens Receive on the forum home', async ({
  page,
}) => {
  await signInAda(page);
  await stubPostingFee(page, 'Not enough yet');
  await page.goto('/welcome?visual=wallet-pay-insufficient');
  await postFromWriter(page, 'Not enough yet');
  await page
    .getByRole('dialog', { name: 'Pay to post' })
    .getByRole('button', { name: 'Add Bitcoin' })
    .click();
  await expect(page.locator('[data-writing-composer]')).toHaveCount(0);
  await expect(page.getByText(/^alice@/)).toBeVisible();
  await expect(page).toHaveURL(/\/welcome\?visual=wallet-pay-insufficient$/);
});
