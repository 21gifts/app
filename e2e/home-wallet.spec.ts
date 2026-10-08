import { expect, test, type Page } from '@playwright/test';
import { cameraStats, stubCamera } from './camera';

/** Signs in Ada with an account that can hold the wallet. */
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
        forumLawsDismissed: true,
        hasPosted: true,
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

/** A forum page long enough to scroll. */
async function longFeed(page: Page): Promise<void> {
  const messages = Array.from({ length: 20 }, (_, index) => ({
    id: `m${index + 1}`,
    name: 'Carol',
    text: `Note number ${index + 1} on the forum home.`,
    createdAt: `2026-08-28T${String(10 + (index % 10)).padStart(2, '0')}:00:00.000Z`,
    sats: 21,
    payable: true,
    hasPhoto: false,
    role: 'verified',
  }));
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages }),
    });
  });
}

/** The active page scrollport. */
async function portScrollTop(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (document.querySelector('[data-scrollport][data-scroll-active]') as HTMLElement).scrollTop,
  );
}

async function setPortScrollTop(page: Page, top: number): Promise<void> {
  await page.evaluate((value) => {
    (document.querySelector('[data-scrollport][data-scroll-active]') as HTMLElement).scrollTop =
      value;
  }, top);
}

test('Function: WelcomeScreen — Send stays enabled on the forum home while the wallet opens and opens at once', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await stubCamera(page, { kind: 'blank' });
  await page.goto('/welcome?visual=setup-pending');
  const send = page.getByRole('button', { name: 'Send', exact: true });
  await expect(send).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Receive' })).toBeEnabled();
  await send.click();
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await expect(region.locator('video')).toBeVisible();
  await expect(region.getByRole('button', { name: 'Paste' })).toBeEnabled();
});

test('Function: WalletFooterActions — Receive and Send stay fixed at the bottom of the forum home while the feed scrolls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signInWalletEligible(page);
  await longFeed(page);
  await page.goto('/welcome?visual=balance-ready');
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await expect(page.getByText('Note number 20 on the forum home.')).toBeAttached();
  const receive = page.getByRole('button', { name: 'Receive' });
  const send = page.getByRole('button', { name: 'Send', exact: true });
  await expect(send).toBeEnabled();
  const before = { receive: (await receive.boundingBox())!, send: (await send.boundingBox())! };
  expect(before.receive.x + before.receive.width).toBeLessThanOrEqual(before.send.x);
  expect(Math.abs(before.receive.y - before.send.y)).toBeLessThan(1);
  // The footer sits outside the scrollport: below its bottom edge.
  const port = (await page.locator('[data-scrollport][data-scroll-active]').boundingBox())!;
  expect(before.receive.y).toBeGreaterThanOrEqual(port.y + port.height);
  await setPortScrollTop(page, 600);
  await expect.poll(() => portScrollTop(page)).toBeGreaterThan(0);
  const after = (await receive.boundingBox())!;
  expect(after.y).toBe(before.receive.y);
  // The fade above the buttons does not take taps.
  const fade = page.locator('footer [aria-hidden="true"].bottom-full');
  await expect(fade).toHaveCSS('pointer-events', 'none');
  await expect(fade).toHaveCSS('height', '18px');
});

test('Function: WalletFooterActions — at 320 px the arrows hide and both labels fit', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await signInWalletEligible(page);
  await page.goto('/welcome?visual=balance-ready');
  const receive = page.getByRole('button', { name: 'Receive' });
  await expect(receive).toBeVisible();
  await expect(receive.locator('svg')).toBeHidden();
  const send = (await page.getByRole('button', { name: 'Send', exact: true }).boundingBox())!;
  const footer = (await page.locator('footer').boundingBox())!;
  expect(send.x + send.width).toBeLessThanOrEqual(footer.x + footer.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('forum home shows no Receive or Send without a configured wallet or signed out', async ({
  page,
}) => {
  await signInWalletEligible(page);
  // This build has no wallet key, so without a pin the wallet is not configured.
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Receive' })).toHaveCount(0);
  await page.evaluate(() => {
    localStorage.removeItem('21gifts.session');
  });
  await page.context().clearCookies();
  const signedOut = await page.context().newPage();
  await signedOut.goto('/welcome?visual=balance-ready');
  await expect(signedOut.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  await expect(signedOut.getByRole('button', { name: 'Receive' })).toHaveCount(0);
});

test('Function: useWalletPanel — Receive opens over the feed, Back returns to the same scroll position', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signInWalletEligible(page);
  await longFeed(page);
  await page.goto('/welcome?visual=balance-ready');
  await expect(page.getByText('Note number 20 on the forum home.')).toBeAttached();
  await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0);
  await setPortScrollTop(page, 500);
  await expect.poll(() => portScrollTop(page)).toBe(500);
  await page.getByRole('button', { name: 'Receive' }).click();
  await expect(page.getByText('ada@21.gifts')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Receive' })).toHaveCount(0);
  expect(await portScrollTop(page)).toBe(0);
  await expect(page).toHaveURL(/\/welcome\?visual=balance-ready$/);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByText('ada@21.gifts')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0);
  await expect.poll(() => portScrollTop(page)).toBe(500);
  await expect(page.getByRole('button', { name: 'Receive' })).toBeVisible();
});

test('Function: useWalletPanel — the wordmark and the Menu Home close an open view and show the top of the feed', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await longFeed(page);
  await page.goto('/welcome?visual=balance-ready');
  await page.getByRole('button', { name: 'Receive' }).click();
  await expect(page.getByText('ada@21.gifts')).toBeVisible();
  await page.locator('[data-app-chrome]').getByRole('link', { name: '21.gifts' }).click();
  await expect(page.getByText('ada@21.gifts')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await expect.poll(() => portScrollTop(page)).toBe(0);

  await page.getByRole('button', { name: 'Receive' }).click();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.getByText('ada@21.gifts')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Receive' })).toBeVisible();
});

test('Function: WalletReceive — the Receive view over the forum home copies the address', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signInWalletEligible(page);
  await page.goto('/welcome?visual=balance-ready');
  await page.getByRole('button', { name: 'Receive' }).click();
  await expect(page.getByRole('img', { name: 'Open CryptoPay QR code' })).toBeVisible();
  await page.getByRole('button', { name: 'Copy' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('ada@21.gifts');
  await expect(page.getByRole('link', { name: 'Set an amount' })).toHaveAttribute('href', '/pos');
});

test('Function: WalletPanelView — each open view carries the screen-reader Wallet heading', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await stubCamera(page, { kind: 'blank' });
  await page.goto('/welcome?visual=balance-ready');
  await page.getByRole('button', { name: 'Receive' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Wallet' })).toBeAttached();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Send Bitcoin' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Wallet' })).toBeAttached();
});

test('Function: visualPin — a send pin opens the Send view on the forum home in a Playwright build', async ({
  page,
}) => {
  await signInWalletEligible(page);
  await stubCamera(page, { kind: 'blank' });
  await page.goto('/welcome?visual=send-input');
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await expect(region.locator('video')).toBeVisible();
  await expect(region.getByText('Point the camera at a Bitcoin QR code')).toBeVisible();
  await expect.poll(async () => (await cameraStats(page)).live).toBe(1);
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Receive' })).toHaveCount(0);
});

test('forum home Send camera fills the page port and Back steps out of the sheet, then out of Send, stopping the camera', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signInWalletEligible(page);
  await stubCamera(page, { kind: 'blank' });
  await page.goto('/welcome?visual=send-input');
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await expect(region.locator('video')).toBeVisible();
  const boxes = await page.evaluate(() => {
    const box = (selector: string): number[] => {
      const rect = (document.querySelector(selector) as HTMLElement).getBoundingClientRect();
      return [rect.x, rect.y, rect.width, rect.height].map(Math.round);
    };
    return {
      layer: box('[data-port-fill]'),
      port: box('[data-scrollport][data-scroll-active]'),
    };
  });
  expect(boxes.layer).toEqual(boxes.port);
  await region.getByRole('button', { name: 'Enter manually' }).click();
  await expect(region.getByLabel('Payment request or address')).toBeFocused();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(region.getByLabel('Payment request or address')).toHaveCount(0);
  await expect(region.locator('video')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('region', { name: 'Send Bitcoin' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await expect.poll(async () => (await cameraStats(page)).live).toBe(0);
});

test('forum home Send camera denied keeps Paste and Enter manually working', async ({ page }) => {
  await signInWalletEligible(page);
  await stubCamera(page, { kind: 'denied' });
  await page.goto('/welcome?visual=send-input');
  const region = page.getByRole('region', { name: 'Send Bitcoin' });
  await expect(region.getByRole('alert')).toHaveText(
    'Camera access was blocked. Allow it in your browser settings, or paste the payment request.',
  );
  await region.getByRole('button', { name: 'Enter manually' }).click();
  await expect(region.getByLabel('Payment request or address')).toBeVisible();
});

test('Function: MenuAccountHeader — on a phone the open Menu ends above the footer and scrolls to its last row', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 640 });
  await signInWalletEligible(page);
  await page.goto('/welcome?visual=balance-ready');
  await expect(page.getByRole('button', { name: 'Receive' })).toBeVisible();
  await page.getByRole('button', { name: 'Menu' }).click();
  const menu = page.locator('#signed-in-menu');
  await expect(menu.locator('dl').getByText('Posts', { exact: true })).toBeVisible();
  const footer = (await page.locator('footer').boundingBox())!;
  const panel = (await menu.boundingBox())!;
  expect(panel.y + panel.height).toBeLessThanOrEqual(footer.y + 1);
  await expect(menu).toHaveAttribute('data-scroll-active', '');
  await menu.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(menu.getByText(/^Version /)).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(menu).not.toHaveAttribute('data-scrollport', '');
  await expect(page.locator('[data-scrollport][data-scroll-active]')).toHaveCount(1);
});
