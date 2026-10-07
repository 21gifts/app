import { expect, test, type Page } from '@playwright/test';

/**
 * The unlocked wallet keeps its recovery phrase in tab memory only, so a
 * document load locks it. These specs open the wallet's passkey step once,
 * then leave and return through the top-left arrow and through the Menu. The
 * document must stay the same (a marker on `window` survives) and the device
 * must not be asked for the passkey again.
 */

const ACCOUNT = {
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
  sparkWalletVerified: true,
  passkeyCredentialId: 'Y3JlZC1zZWVk',
};

/** Signed-in wallet member, empty lists, and a passkey that answers with PRF. */
async function signInWithPasskey(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
    const prf = new Uint8Array(32).fill(7).buffer;
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: {
        create: async () => {
          throw new DOMException('Not used here', 'NotAllowedError');
        },
        get: async () => {
          const count = Number(sessionStorage.getItem('e2e.passkeyPrompts') ?? '0') + 1;
          sessionStorage.setItem('e2e.passkeyPrompts', String(count));
          return {
            id: 'Y3JlZC1zZWVk',
            type: 'public-key',
            rawId: new Uint8Array([1, 2, 3]).buffer,
            response: {},
            getClientExtensionResults: () => ({ prf: { results: { first: prf } } }),
          };
        },
      },
    });
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ACCOUNT),
    });
  });
  for (const list of [/\/forum\/messages(?:\?|$)/, /\/messages(?:\?|$)/]) {
    await page.route(list, async (route) => {
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
  await page.route(/\/forum\/notifications(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notifications: [], unreadCount: 0 }),
    });
  });
  await page.route(/\/conversations(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conversations: [], unreadCount: 0 }),
    });
  });
}

/** Mark this document. A document load drops the mark. */
async function markDocument(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { e2eDocument?: string }).e2eDocument = 'same';
  });
}

async function sameDocument(page: Page): Promise<string | null> {
  return page.evaluate(() => (window as unknown as { e2eDocument?: string }).e2eDocument ?? null);
}

async function passkeyPrompts(page: Page): Promise<number> {
  return page.evaluate(() => Number(sessionStorage.getItem('e2e.passkeyPrompts') ?? '0'));
}

test('Function: markBackNavigation keeps the document and asks for no passkey across the back arrow and the Menu', async ({
  page,
}) => {
  await signInWithPasskey(page);
  await page.goto('/shops');
  await expect(page.getByRole('heading', { name: 'Shops' })).toBeVisible();
  await markDocument(page);
  const origin = new URL(page.url()).origin;

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Balance', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/wallet`);
  await expect(page.getByRole('heading', { name: 'Wallet' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Show recovery phrase' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/settings`);
  await page.getByRole('link', { name: 'Recovery phrase', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/wallet/phrase`);
  await page.getByRole('button', { name: 'Show recovery phrase' }).click();
  await expect(page.getByRole('listitem')).toHaveCount(12);
  expect(await passkeyPrompts(page)).toBe(1);

  // First press hides the words on the same view, the second returns to Settings.
  await page.getByRole('link', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('listitem')).toHaveCount(0);
  await expect(page).toHaveURL(`${origin}/wallet/phrase`);
  await page.getByRole('link', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/settings`);
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  expect(await sameDocument(page)).toBe('same');

  await page.getByRole('link', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/wallet`);
  await expect(page.getByRole('heading', { name: 'Wallet' })).toBeVisible();
  expect(await sameDocument(page)).toBe('same');

  await page.getByRole('link', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/shops`);
  await expect(page.getByRole('heading', { name: 'Shops' })).toBeVisible();
  expect(await sameDocument(page)).toBe('same');
  await expect(page.getByRole('link', { name: 'Back to the forum' })).toHaveAttribute(
    'href',
    '/welcome',
  );

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Balance', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/wallet`);
  await expect(page.getByRole('heading', { name: 'Wallet' })).toBeVisible();
  expect(await sameDocument(page)).toBe('same');
  expect(await passkeyPrompts(page)).toBe(1);
});

test('Function: SignedInChrome Home clears the back history and keeps the wallet unlocked', async ({
  page,
}) => {
  await signInWithPasskey(page);
  await page.goto('/shops');
  await expect(page.getByRole('heading', { name: 'Shops' })).toBeVisible();
  await markDocument(page);
  const origin = new URL(page.url()).origin;
  const menu = page.locator('#signed-in-menu');

  await page.getByRole('button', { name: 'Menu' }).click();
  await menu.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/settings`);
  await page.getByRole('link', { name: 'Recovery phrase', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/wallet/phrase`);
  await page.getByRole('button', { name: 'Show recovery phrase' }).click();
  await expect(page.getByRole('listitem')).toHaveCount(12);
  expect(await passkeyPrompts(page)).toBe(1);

  await page.getByRole('button', { name: 'Menu' }).click();
  await menu.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/welcome`);
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back to the forum' })).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('21gifts.viewHistory')))
    .toBe(JSON.stringify({ stack: ['/welcome'], cursor: 0 }));
  expect(await sameDocument(page)).toBe('same');

  await page.getByRole('button', { name: 'Menu' }).click();
  await menu.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/settings`);
  const back = page.getByRole('link', { name: 'Back', exact: true });
  await expect(back).toHaveAttribute('href', '/welcome');
  await back.click();
  await expect(page).toHaveURL(`${origin}/welcome`);
  await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveCount(0);
  expect(await sameDocument(page)).toBe('same');
  expect(await passkeyPrompts(page)).toBe(1);
});

test('Function: goToPreviousView opens the forum from the first rules chapter without a document load', async ({
  page,
}) => {
  await signInWithPasskey(page);
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...ACCOUNT, rulesAgreedAt: null, setup: 'rules', missing: ['rules'] }),
    });
  });
  await page.goto('/setup/rules');
  await markDocument(page);
  const origin = new URL(page.url()).origin;
  await page.getByRole('button', { name: 'Back to the forum' }).click();
  await expect(page).toHaveURL(new RegExp(`^${origin}/(welcome|setup/rules)`));
  expect(await sameDocument(page)).toBe('same');
});

test('forum place, shops post and table place, and operator links keep the document', async ({
  page,
}) => {
  await signInWithPasskey(page);
  const shop = {
    id: 'm-pin',
    accountId: 'acc_bo',
    name: 'Bo',
    text: 'Cafe Luna\n\n#21GiftsShop',
    createdAt: '2026-01-06T12:00:00.000Z',
    sats: 5000,
    payable: true,
    hasPhoto: false,
    photoCount: 0,
    hasVideo: false,
    videoContentType: null,
    role: 'basis',
    replyCount: 0,
    place: { lat: 14.6, lng: 120.98, label: 'Happyland' },
    shopAccount: { id: 'acc-luna', username: 'luna', name: 'Luna' },
  };
  for (const list of [/\/forum\/messages(?:\?|$)/, /\/messages(?:\?|$)/]) {
    await page.route(list, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            shop,
            {
              ...shop,
              id: 'm-two',
              text: 'Bakery\n\n#21GiftsShop',
              place: { lat: 14.7, lng: 121, label: 'Bakery' },
            },
          ],
        }),
      });
    });
  }
  await page.goto('/welcome');
  const place = page.getByRole('link', { name: 'Happyland' }).first();
  await expect(place).toHaveAttribute('href', '/shops?pin=m-pin#map');
  await markDocument(page);
  const origin = new URL(page.url()).origin;

  await place.click();
  await expect(page).toHaveURL(`${origin}/shops?pin=m-pin#map`);
  await expect(page.getByRole('button', { name: 'Map', pressed: true })).toBeVisible();
  expect(await sameDocument(page)).toBe('same');

  // The same place from the table differs only in the hash; Back returns to the table.
  await page.getByRole('button', { name: 'Table' }).click();
  await page.getByRole('link', { name: 'Happyland' }).click();
  await expect(page.getByRole('button', { name: 'Map', pressed: true })).toBeVisible();
  await expect(page).toHaveURL(`${origin}/shops?pin=m-pin#map`);
  await page.goBack();
  await expect(page).toHaveURL(`${origin}/shops?pin=m-pin#table`);
  await expect(page.getByRole('button', { name: 'Table', pressed: true })).toBeVisible();
  expect(await sameDocument(page)).toBe('same');

  // A place in the table opens the map; browser Back returns to the table.
  await page.getByRole('button', { name: 'Table' }).click();
  await page.getByRole('link', { name: 'Bakery' }).click();
  await expect(page.getByRole('button', { name: 'Map', pressed: true })).toBeVisible();
  await expect(page).toHaveURL(`${origin}/shops?pin=m-two#map`);
  await page.goBack();
  await expect(page).toHaveURL(`${origin}/shops?pin=m-pin#table`);
  await expect(page.getByRole('button', { name: 'Table', pressed: true })).toBeVisible();
  expect(await sameDocument(page)).toBe('same');

  // A place in the post list opens the map; browser Back returns to the posts.
  await page.getByRole('button', { name: 'Post' }).click();
  await page.getByRole('link', { name: 'Bakery' }).first().click();
  await expect(page.getByRole('button', { name: 'Map', pressed: true })).toBeVisible();
  await expect(page).toHaveURL(`${origin}/shops?pin=m-two#map`);
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Post', pressed: true })).toBeVisible();
  expect(await sameDocument(page)).toBe('same');

  await page.getByRole('button', { name: 'Table' }).click();
  await page.getByRole('link', { name: '@luna' }).first().click();
  await expect(page).toHaveURL(`${origin}/members/acc-luna`);
  expect(await sameDocument(page)).toBe('same');
  expect(await passkeyPrompts(page)).toBe(0);
});

test('the top-left arrow from a place on the shops map returns to the posts', async ({ page }) => {
  await signInWithPasskey(page);
  const shop = {
    id: 'm-pin',
    accountId: 'acc_bo',
    name: 'Bo',
    text: 'Cafe Luna\n\n#21GiftsShop',
    createdAt: '2026-01-06T12:00:00.000Z',
    sats: 5000,
    payable: true,
    hasPhoto: false,
    photoCount: 0,
    hasVideo: false,
    videoContentType: null,
    role: 'basis',
    replyCount: 0,
    place: { lat: 14.6, lng: 120.98, label: 'Happyland' },
    shopAccount: { id: 'acc-luna', username: 'luna', name: 'Luna' },
  };
  for (const list of [/\/forum\/messages(?:\?|$)/, /\/messages(?:\?|$)/]) {
    await page.route(list, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            shop,
            {
              ...shop,
              id: 'm-two',
              text: 'Bakery\n\n#21GiftsShop',
              place: { lat: 14.7, lng: 121, label: 'Bakery' },
            },
          ],
        }),
      });
    });
  }
  await page.goto('/shops');
  await markDocument(page);
  const origin = new URL(page.url()).origin;
  await page.getByRole('link', { name: 'Bakery' }).first().click();
  await expect(page.getByRole('button', { name: 'Map', pressed: true })).toBeVisible();
  await expect(page).toHaveURL(`${origin}/shops?pin=m-two#map`);
  await page.getByRole('link', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/shops`);
  await expect(page.getByRole('button', { name: 'Post', pressed: true })).toBeVisible();
  expect(await sameDocument(page)).toBe('same');
});

/** Latest gift day used for the fiat line: ₿1 = $100,000. */
async function fulfillRateDay(page: Page): Promise<void> {
  await page.route('**/gifts/stats**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalSats: 100_000_000,
        totalBtc: '1.00000000',
        totalUsd: '100000.00',
        totalChf: '80000.00',
        totalEur: '90000.00',
        totalPhp: '5600000.00',
        giftCount: 1,
        recipientCount: 1,
        firstPaidAt: '2026-01-06T00:00:00.000Z',
        lastPaidAt: '2026-01-06T00:00:00.000Z',
        spendOverTime: [
          {
            day: '2026-01-06',
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
      }),
    });
  });
}

test('Function: MenuAccountHeader shows the ready balance with fiat, the name, and the stats, and its balance opens the wallet without a document load', async ({
  page,
}) => {
  await signInWithPasskey(page);
  await fulfillRateDay(page);
  await page.goto('/settings?visual=balance-ready');
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  // No wallet control in the header row any more; the balance lives in the Menu.
  await expect(
    page.locator('[data-app-chrome]').getByRole('link', { name: /Wallet|₿/ }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Menu' }).click();
  const menu = page.locator('#signed-in-menu');
  const balance = menu.getByRole('link', { name: /₿21'000/ });
  await expect(balance).toContainText('$21.00');
  await expect(balance).toHaveAttribute('href', '/wallet');
  for (const label of ['Received', 'Given', 'Posts']) {
    await expect(menu.locator('dl').getByText(label, { exact: true })).toBeVisible();
  }
  await expect(menu.locator('dl .animate-pulse')).toHaveCount(0);
  const rows = menu.getByRole('link');
  await expect(rows.nth(1)).toHaveAccessibleName('Home');
  await expect(rows.nth(2)).toHaveAccessibleName('Balance');
  await markDocument(page);
  const origin = new URL(page.url()).origin;
  await balance.click();
  await expect(page).toHaveURL(`${origin}/wallet`);
  await expect(menu).toBeHidden();
  expect(await sameDocument(page)).toBe('same');
  expect(await passkeyPrompts(page)).toBe(0);
});

test('MenuAccountHeader keeps the stats row height while the numbers load', async ({ page }) => {
  await signInWithPasskey(page);
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/me\/activity$/, async (route) => {
    await held;
    await route.fallback();
  });
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Menu' }).click();
  const row = page.locator('#signed-in-menu dl');
  await expect(row.locator('.animate-pulse')).toHaveCount(5);
  const before = (await row.boundingBox())!;
  release();
  await expect(row.locator('.animate-pulse')).toHaveCount(0);
  const after = (await row.boundingBox())!;
  expect(after.height).toBe(before.height);
});

test('the Menu rows stay put when it opens right after a page load', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithPasskey(page);
  // The stored session is still being checked while the Menu opens.
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/me$/, async (route) => {
    await held;
    await route.fallback();
  });
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Menu' }).click();
  const menu = page.locator('#signed-in-menu');
  const home = menu.getByRole('link', { name: 'Home' });
  await expect(home).toBeVisible();
  await expect(menu.locator('dl .animate-pulse')).toHaveCount(5);
  const before = (await home.boundingBox())!;
  release();
  await expect(menu.getByText('@ada')).toBeVisible();
  await page.waitForTimeout(3_000);
  const after = (await home.boundingBox())!;
  expect(after.y).toBe(before.y);
});

for (const width of [320, 375]) {
  test(`the signed-in header fits the back arrow, the wordmark, and Menu at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 700 });
    await signInWithPasskey(page);
    await page.goto('/settings?visual=balance-ready');
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    const chrome = (await page.locator('[data-app-chrome]').boundingBox())!;
    const back = (await page.locator('[data-app-chrome] a').first().boundingBox())!;
    const mark = (await page.locator('[data-app-chrome]').getByText('21.gifts').boundingBox())!;
    const menu = (await page.getByRole('button', { name: 'Menu' }).boundingBox())!;
    expect(back.width).toBe(44);
    expect(mark.x + mark.width).toBeLessThanOrEqual(menu.x);
    expect(menu.x + menu.width).toBeLessThanOrEqual(chrome.x + chrome.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}
