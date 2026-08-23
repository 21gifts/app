import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Writes docs/handbook/images (and public copies) for screen variants.
 * Run with UPDATE_HANDBOOK_IMAGES=1. Skipped otherwise so CI is unchanged.
 */
test.skip(process.env['UPDATE_HANDBOOK_IMAGES'] !== '1', 'set UPDATE_HANDBOOK_IMAGES=1');

const LNURL = 'lnurl1dp68gurn8ghj7example';
const E2E_ACCOUNT = {
  id: 'acc_e2e',
  linkingKey: `02${'a'.repeat(62)}`,
  role: 'basis' as const,
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

async function mockPendingAuth(page: Page): Promise<void> {
  await page.route(/\/auth\/lnurl$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        lnurl: LNURL,
        k1: 'ab'.repeat(32),
        pollToken: 'cd'.repeat(32),
        expiresInSeconds: 90,
      }),
    });
  });
  await page.route(/\/auth\/session$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'pending' }),
    });
  });
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
  await expect(
    page.getByRole('button', { name: 'Log in with your Lightning wallet' }),
  ).toBeVisible();
  await writePng(page, 'login.png');
});

test('login starting', async ({ page }) => {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/auth\/lnurl$/, async (route) => {
    await held;
    await route.fulfill({ status: 503, body: 'unavailable' });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in with your Lightning wallet' }).click();
  await expect(page.getByText('Preparing your login…')).toBeVisible();
  await writePng(page, 'login-starting.png');
  release();
});

test('login qr', async ({ page }) => {
  await mockPendingAuth(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in with your Lightning wallet' }).click();
  await expect(page.getByRole('img', { name: 'Lightning login QR code' })).toBeVisible();
  await writePng(page, 'login-qr.png');
});

test('login qr-android', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
      configurable: true,
    });
  });
  await mockPendingAuth(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in with your Lightning wallet' }).click();
  await expect(page.getByRole('link', { name: 'Open Wallet of Satoshi' })).toBeVisible();
  await writePng(page, 'login-qr-android.png');
});

test('login expired', async ({ page }) => {
  await page.route(/\/auth\/lnurl$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        lnurl: LNURL,
        k1: 'ab'.repeat(32),
        pollToken: 'cd'.repeat(32),
        expiresInSeconds: 90,
      }),
    });
  });
  await page.route(/\/auth\/session$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'expired' }),
    });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in with your Lightning wallet' }).click();
  await expect(page.getByText('Login expired')).toBeVisible({ timeout: 10_000 });
  await writePng(page, 'login-expired.png');
});

test('login error', async ({ page }) => {
  await page.route(/\/auth\/lnurl$/, async (route) => {
    await route.fulfill({ status: 503, body: 'unavailable' });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in with your Lightning wallet' }).click();
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
  await page.getByLabel('Lightning Address').fill('alice@example.com');
  await page.getByLabel('Amount (sats)').fill('21');
  await page.getByRole('button', { name: 'Create invoice' }).click();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  await writePng(page, 'donate-busy.png');
  release();
});

test('donate validation-error', async ({ page }) => {
  await page.goto('/donate');
  await page.getByLabel('Amount (sats)').fill('21');
  await page.getByRole('button', { name: 'Create invoice' }).click();
  await expect(page.getByText('Enter a Lightning Address')).toBeVisible();
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
  await page.getByLabel('Lightning Address').fill('alice@example.com');
  await page.getByLabel('Amount (sats)').fill('21');
  await page.getByRole('button', { name: 'Create invoice' }).click();
  await expect(page.getByRole('img', { name: 'Lightning invoice QR code' })).toBeVisible();
  await writePng(page, 'donate-invoice.png');
});

test('handbook default', async ({ page }) => {
  await page.goto('/handbook');
  await expect(page.getByRole('heading', { name: 'Handbook' }).first()).toBeVisible();
  await writePng(page, 'handbook.png', false);
});

test('404 default', async ({ page }) => {
  await page.goto('/404');
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
  await writePng(page, 'not-found.png');
});
