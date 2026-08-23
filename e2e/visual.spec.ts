import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Visual baselines are Linux Chromium (CI and the Playwright Docker image).
 * Behavioral e2e specs still run on macOS; these comparisons do not.
 */
test.skip(process.platform !== 'linux', 'visual baselines are linux/chromium');

test.describe.configure({ mode: 'serial' });

const LNURL = 'lnurl1dp68gurn8ghj7example';

const E2E_ACCOUNT = {
  id: 'acc_e2e',
  linkingKey: `02${'a'.repeat(62)}`,
  role: 'basis' as const,
  lightningAddress: null as string | null,
  lightningAddressVerified: false,
  createdAt: 1_700_000_000,
};

const SHOT = { animations: 'disabled' as const, caret: 'hide' as const };

/** Writes handbook + public PNGs when regenerating baselines. */
async function maybeWriteHandbookPng(
  page: Page,
  basename: string,
  fullPage: boolean,
): Promise<void> {
  if (process.env['UPDATE_HANDBOOK_IMAGES'] !== '1') {
    return;
  }
  const buffer = await page.screenshot({ fullPage, animations: 'disabled', caret: 'hide' });
  const docsPath = path.join('docs', 'handbook', 'images', basename);
  const publicPath = path.join('public', 'handbook-images', basename);
  fs.mkdirSync(path.dirname(docsPath), { recursive: true });
  fs.mkdirSync(path.dirname(publicPath), { recursive: true });
  fs.writeFileSync(docsPath, buffer);
  fs.writeFileSync(publicPath, buffer);
}

/** Screenshot plus optional handbook PNG copy. */
async function shotScreen(
  page: Page,
  arg: string,
  handbookFile: string,
  fullPage = true,
): Promise<void> {
  await expect(page).toHaveScreenshot(`${arg}.png`, {
    fullPage,
    // The handbook viewport embeds other screen PNGs; variant shots shift a few percent.
    maxDiffPixelRatio: arg === 'screen-handbook' ? 0.05 : 0,
    ...SHOT,
  });
  await maybeWriteHandbookPng(page, handbookFile, fullPage);
}

test.describe('screen baselines', () => {
  test('screen /', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Direct human-to-human gifts/i })).toBeVisible();
    await shotScreen(page, 'screen-root', 'root.png');
  });

  test('screen /legal', async ({ page }) => {
    await page.goto('/legal');
    await expect(page.getByRole('heading', { name: 'Legal Notice' })).toBeVisible();
    await shotScreen(page, 'screen-legal', 'legal.png');
  });

  test('screen /login', async ({ page }) => {
    await page.goto('/login');
    await expect(
      page.getByRole('button', { name: 'Log in with your Lightning wallet' }),
    ).toBeVisible();
    await shotScreen(page, 'screen-login', 'login.png');
  });

  test('screen /donate', async ({ page }) => {
    await page.goto('/donate');
    await expect(page.getByRole('heading', { name: 'Send a gift', level: 1 })).toBeVisible();
    await shotScreen(page, 'screen-donate', 'donate.png');
  });

  test('screen /404', async ({ page }) => {
    await page.goto('/404');
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await shotScreen(page, 'screen-404', 'not-found.png');
  });

  test('screen /handbook', async ({ page }) => {
    await page.goto('/handbook');
    await expect(page.getByRole('heading', { name: 'Handbook' }).first()).toBeVisible();
    // Viewport only: a full-page shot would nest the other screen PNGs inside this one.
    await shotScreen(page, 'screen-handbook', 'handbook.png', false);
  });
});

test.describe('function baselines', () => {
  test('every handbook function section', async ({ page }) => {
    await page.goto('/handbook');
    await expect(page.getByRole('heading', { name: 'Handbook' }).first()).toBeVisible();

    const headings = page.locator('#functions h2[id^="functions-function-"]');
    const count = await headings.count();
    expect(count).toBeGreaterThan(0);

    const sections = await headings.evaluateAll((nodes) =>
      nodes.map((node) => {
        const el = node as HTMLElement;
        const label = (el.textContent ?? '').trim();
        const match = /^Function: (.+)$/.exec(label);
        return { id: el.id, name: match?.[1] ?? '' };
      }),
    );
    expect(sections.every((s) => s.id !== '' && s.name !== '')).toBe(true);
    expect(new Set(sections.map((s) => s.name)).size).toBe(sections.length);
  });

  test('LoginCard QR + QrCode', async ({ page }) => {
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
    await page.goto('/login');
    await page.getByRole('button', { name: 'Log in with your Lightning wallet' }).click();
    await expect(page.getByRole('img', { name: 'Lightning login QR code' })).toBeVisible();
    await expect(page).toHaveScreenshot('state-login-qr.png', { fullPage: true, ...SHOT });
  });

  test('LightningAddressForm signed-in', async ({ page }) => {
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
    await expect(page).toHaveScreenshot('state-login-signed-in.png', { fullPage: true, ...SHOT });
  });

  test('DonateForm invoice QR', async ({ page }) => {
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
    await expect(page).toHaveScreenshot('state-donate-invoice.png', { fullPage: true, ...SHOT });
  });

  test('NotFound', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await expect(page).toHaveScreenshot('state-not-found.png', { fullPage: true, ...SHOT });
  });
});
