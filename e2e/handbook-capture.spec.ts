import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Writes docs/handbook/images (and public copies) for screen variants.
 * Run with UPDATE_HANDBOOK_IMAGES=1. Skipped otherwise so CI is unchanged.
 */
test.skip(process.env['UPDATE_HANDBOOK_IMAGES'] !== '1', 'set UPDATE_HANDBOOK_IMAGES=1');

const E2E_ACCOUNT = {
  id: 'acc_e2e',
  linkingKey: `02${'a'.repeat(62)}`,
  role: 'basis' as const,
  name: null as string | null,
  lightningAddress: null as string | null,
  lightningAddressVerified: false,
  createdAt: 1_700_000_000,
};

async function writePng(page: Page, basename: string, fullPage = true): Promise<void> {
  const buffer = await page.screenshot({ fullPage, animations: 'disabled', caret: 'hide' });
  const docsPath = path.join('docs', 'handbook', 'images', basename);
  const publicPath = path.join('public', 'handbook-images', basename);
  fs.mkdirSync(path.dirname(docsPath), { recursive: true });
  fs.mkdirSync(path.dirname(publicPath), { recursive: true });
  fs.writeFileSync(docsPath, buffer);
  fs.writeFileSync(publicPath, buffer);
}

test('home default', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Direct human-to-human gifts/i })).toBeVisible();
  await writePng(page, 'root.png');
});

test('home mobile-nav', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByLabel('Primary').getByRole('link', { name: 'Handbook' })).toBeVisible();
  await writePng(page, 'root-mobile-nav.png');
});

test('legal default', async ({ page }) => {
  await page.goto('/legal');
  await expect(page.getByRole('heading', { name: 'Legal Notice' })).toBeVisible();
  await writePng(page, 'legal.png');
});

test('login idle', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Create a passkey' })).toBeVisible();
  await writePng(page, 'login.png');
});

test('login starting', async ({ page }) => {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/auth\/passkey\/register\/begin$/, async (route) => {
    await held;
    await route.fulfill({ status: 503, body: 'unavailable' });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Create a passkey' }).click();
  await expect(page.getByText('Preparing your login…')).toBeVisible();
  await writePng(page, 'login-starting.png');
  release();
});

test('login error', async ({ page }) => {
  await page.route(/\/auth\/passkey\/register\/begin$/, async (route) => {
    await route.fulfill({ status: 503, body: 'unavailable' });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Create a passkey' }).click();
  await expect(page.getByText('Something went wrong. Please try again.')).toBeVisible();
  await writePng(page, 'login-error.png');
});

test('login signed-in', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(E2E_ACCOUNT),
    });
  });
  await page.goto('/login');
  await expect(page.getByText('Signed in')).toBeVisible();
  await writePng(page, 'login-signed-in.png');
});

test('login signed-in-named', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...E2E_ACCOUNT, name: 'Ada' }),
    });
  });
  await page.goto('/login');
  await expect(page.getByText('Ada')).toBeVisible();
  await writePng(page, 'login-signed-in-named.png');
});

test('login signed-in-linked', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...E2E_ACCOUNT,
        lightningAddress: 'alice@walletofsatoshi.com',
      }),
    });
  });
  await page.goto('/login');
  await expect(page.getByText('alice@walletofsatoshi.com')).toBeVisible();
  await writePng(page, 'login-signed-in-linked.png');
});

test('donate form', async ({ page }) => {
  await page.goto('/donate');
  await expect(page.getByRole('heading', { name: 'Send a gift', level: 1 })).toBeVisible();
  await writePng(page, 'donate.png');
});

test('donate busy', async ({ page }) => {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/lightning-address\?/, async (route) => {
    await held;
    await route.abort();
  });
  await page.goto('/donate');
  await page.getByLabel('Wallet of Satoshi address').fill('alice@example.com');
  await page.getByLabel('Amount (sats)').fill('21');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  await writePng(page, 'donate-busy.png');
  release();
});

test('donate validation-error', async ({ page }) => {
  await page.goto('/donate');
  await page.getByLabel('Amount (sats)').fill('21');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Enter a Wallet of Satoshi address')).toBeVisible();
  await writePng(page, 'donate-validation-error.png');
});

test('donate invoice', async ({ page }) => {
  await page.route(/\/lightning-address\?/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        address: 'alice@example.com',
        callback: 'https://ln.example.com/pay',
        minSendable: 1000,
        maxSendable: 1_000_000_000,
      }),
    });
  });
  await page.route('https://ln.example.com/pay**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pr: 'lnbc21n1exampleinvoice' }),
    });
  });
  await page.goto('/donate');
  await page.getByLabel('Wallet of Satoshi address').fill('alice@example.com');
  await page.getByLabel('Amount (sats)').fill('21');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toBeVisible();
  await writePng(page, 'donate-invoice.png');
});

test('donate invoice-android', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
      configurable: true,
    });
  });
  await page.route(/\/lightning-address\?/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        address: 'alice@example.com',
        callback: 'https://ln.example.com/pay',
        minSendable: 1000,
        maxSendable: 1_000_000_000,
      }),
    });
  });
  await page.route('https://ln.example.com/pay**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pr: 'lnbc21n1exampleinvoice' }),
    });
  });
  await page.goto('/donate');
  await page.getByLabel('Wallet of Satoshi address').fill('alice@example.com');
  await page.getByLabel('Amount (sats)').fill('21');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('link', { name: 'Open Wallet of Satoshi' })).toHaveAttribute(
    'href',
    /intent:lightning:LNBC21N1EXAMPLEINVOICE/,
  );
  await writePng(page, 'donate-invoice-android.png');
});

test('stats default', async ({ page }) => {
  await page.route('**/gifts/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalSats: 1500,
        totalBtc: '0.00001500',
        totalUsd: '1.43',
        giftCount: 3,
        recipientCount: 2,
        firstPaidAt: '2026-06-01T00:00:00.000Z',
        lastPaidAt: '2026-07-01T00:00:00.000Z',
        spendOverTime: [
          {
            day: '2026-06-01',
            sats: 500,
            cumulativeSats: 500,
            btc: '0.00000500',
            cumulativeBtc: '0.00000500',
            usd: '0.48',
            cumulativeUsd: '0.48',
          },
          {
            day: '2026-06-02',
            sats: 0,
            cumulativeSats: 500,
            btc: '0.00000000',
            cumulativeBtc: '0.00000500',
            usd: '0.00',
            cumulativeUsd: '0.48',
          },
          {
            day: '2026-07-01',
            sats: 1000,
            cumulativeSats: 1500,
            btc: '0.00001000',
            cumulativeBtc: '0.00001500',
            usd: '0.95',
            cumulativeUsd: '1.43',
          },
        ],
        byRecipient: [
          { recipient: 'alice', giftCount: 2, sats: 1000, btc: '0.00001000', usd: '0.95' },
          { recipient: 'bob', giftCount: 1, sats: 500, btc: '0.00000500', usd: '0.48' },
        ],
        byMonth: [
          { month: '2026-06', giftCount: 2, sats: 500, btc: '0.00000500', usd: '0.48' },
          { month: '2026-07', giftCount: 1, sats: 1000, btc: '0.00001000', usd: '0.95' },
        ],
        fx: {
          quote: 'BTC-USD',
          dayBasis: 'utc',
          source: 'coinbase-exchange-daily-close',
        },
      }),
    });
  });
  await page.goto('/stats');
  await expect(page.getByRole('heading', { name: 'Total spend over time' })).toBeVisible();
  await writePng(page, 'stats.png');
});

test('stats usd-scale', async ({ page }) => {
  await page.route('**/gifts/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalSats: 1_100_000,
        totalBtc: '0.01100000',
        totalUsd: '950.00',
        giftCount: 2,
        recipientCount: 2,
        firstPaidAt: '2026-06-01T00:00:00.000Z',
        lastPaidAt: '2026-07-01T00:00:00.000Z',
        spendOverTime: [
          {
            day: '2026-06-01',
            sats: 1_000_000,
            cumulativeSats: 1_000_000,
            btc: '0.01000000',
            cumulativeBtc: '0.01000000',
            usd: '50.00',
            cumulativeUsd: '50.00',
          },
          {
            day: '2026-07-01',
            sats: 100_000,
            cumulativeSats: 1_100_000,
            btc: '0.00100000',
            cumulativeBtc: '0.01100000',
            usd: '900.00',
            cumulativeUsd: '950.00',
          },
        ],
        byRecipient: [
          { recipient: 'alice', giftCount: 1, sats: 1_000_000, btc: '0.01000000', usd: '50.00' },
          { recipient: 'bob', giftCount: 1, sats: 100_000, btc: '0.00100000', usd: '900.00' },
        ],
        byMonth: [
          { month: '2026-06', giftCount: 1, sats: 1_000_000, btc: '0.01000000', usd: '50.00' },
          { month: '2026-07', giftCount: 1, sats: 100_000, btc: '0.00100000', usd: '900.00' },
        ],
        fx: {
          quote: 'BTC-USD',
          dayBasis: 'utc',
          source: 'coinbase-exchange-daily-close',
        },
      }),
    });
  });
  await page.goto('/stats');
  await page
    .getByRole('group', { name: 'By person bar scale' })
    .getByRole('button', { name: 'USD' })
    .click();
  await page
    .getByRole('group', { name: 'By month bar scale' })
    .getByRole('button', { name: 'USD' })
    .click();
  await expect(page.getByLabel('Spend by month in USD')).toBeVisible();
  await writePng(page, 'stats-usd-scale.png');
});

test('stats empty', async ({ page }) => {
  await page.route('**/gifts/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalSats: 0,
        totalBtc: '0.00000000',
        totalUsd: '0.00',
        giftCount: 0,
        recipientCount: 0,
        firstPaidAt: null,
        lastPaidAt: null,
        spendOverTime: [],
        byRecipient: [],
        byMonth: [],
        fx: {
          quote: 'BTC-USD',
          dayBasis: 'utc',
          source: 'coinbase-exchange-daily-close',
        },
      }),
    });
  });
  await page.goto('/stats');
  await expect(page.getByText('No gifts recorded yet.')).toBeVisible();
  await writePng(page, 'stats-empty.png');
});

test('stats loading', async ({ page }) => {
  await page.route('**/gifts/stats', () => new Promise(() => undefined));
  await page.goto('/stats');
  await expect(page.getByText('Loading…')).toBeVisible();
  await writePng(page, 'stats-loading.png');
});

test('stats error', async ({ page }) => {
  await page.route('**/gifts/stats', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/stats');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await writePng(page, 'stats-error.png');
});

test('handbook default', async ({ page }) => {
  await page.goto('/handbook');
  await expect(page.getByRole('heading', { name: 'Handbook' }).first()).toBeVisible();
  await writePng(page, 'handbook.png', false);
});

test('handbook copied', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/handbook');
  const button = page.getByRole('button', { name: 'Copy link to Handbook' });
  await button.click();
  await expect(button).toHaveAttribute('data-copied', 'true');
  await button.scrollIntoViewIfNeeded();
  await writePng(page, 'handbook-copied.png', false);
});

test('404 default', async ({ page }) => {
  await page.goto('/404');
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
  await writePng(page, 'not-found.png');
});
