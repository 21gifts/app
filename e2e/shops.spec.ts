import { expect, test } from '@playwright/test';

const E2E_ACCOUNT = {
  id: 'acc_e2e',
  linkingKey: `02${'a'.repeat(62)}`,
  role: 'basis' as const,
  name: 'Ada',
  location: null,
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  setup: null,
  missing: [],
};

const SHOP_NOTE = {
  id: 'm-shop',
  name: 'Ada',
  text: 'Cafe Luna\n\n#21GiftsShop',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 5,
  payable: true,
  hasPhoto: false,
  role: 'basis',
};

const LIVING_ROOM_NOTE = {
  id: 'm-ada',
  name: 'Ada',
  text: 'Hello from Ada',
  createdAt: '2026-08-28T11:00:00.000Z',
  sats: 5,
  payable: true,
  hasPhoto: false,
  role: 'basis',
};

async function seedSignedIn(page: import('@playwright/test').Page): Promise<void> {
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
}

async function fulfillForumMessages(
  page: import('@playwright/test').Page,
  messages: unknown[],
  status = 200,
): Promise<void> {
  await page.route(/\/messages$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ messages }),
    });
  });
}

async function seedShopList(page: import('@playwright/test').Page): Promise<void> {
  await seedSignedIn(page);
  await fulfillForumMessages(page, [SHOP_NOTE, LIVING_ROOM_NOTE]);
}

test('Function: ShopsPage — heading is visible', async ({ page }) => {
  await seedShopList(page);
  await page.goto('/shops');
  await expect(page.getByRole('heading', { name: 'Shops' })).toBeVisible();
});

test('Function: ShopsScreen — lead is visible', async ({ page }) => {
  await seedSignedIn(page);
  await fulfillForumMessages(page, []);
  await page.goto('/shops');
  await expect(
    page.getByText(
      'Add a shop the same way you write a living-room post. It appears here and in the forum with a #Shop tag.',
    ),
  ).toBeVisible();
});

test('Function: isShopNote — shop note is listed', async ({ page }) => {
  await seedShopList(page);
  await page.goto('/shops');
  await expect(page.getByText('Cafe Luna')).toBeVisible();
  await expect(page.getByRole('link', { name: '#Shop' })).toHaveAttribute('href', '/shops');
  await expect(page.getByText('Hello from Ada')).toHaveCount(0);
});

test('Function: stripShopHashtag — raw hashtag is hidden', async ({ page }) => {
  await seedShopList(page);
  await page.goto('/shops');
  await expect(page.getByText('Cafe Luna')).toBeVisible();
  await expect(page.getByText('#21GiftsShop')).toHaveCount(0);
});

test('Function: ShopsPage — shops loading', async ({ page }) => {
  await seedSignedIn(page);
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/messages$/, async (route) => {
    await held;
    await route.abort();
  });
  await page.goto('/shops');
  await expect(page.locator('p.text-center', { hasText: 'Loading…' })).toBeVisible();
  release();
});

test('shops empty shows the empty copy', async ({ page }) => {
  await seedSignedIn(page);
  await fulfillForumMessages(page, [LIVING_ROOM_NOTE]);
  await page.goto('/shops');
  await expect(page.getByText('No shops yet — add the first one.')).toBeVisible();
});

test('shops error shows the load failure', async ({ page }) => {
  await seedSignedIn(page);
  await fulfillForumMessages(page, [], 503);
  await page.goto('/shops');
  await expect(page.getByText('Could not load messages. Please try again.')).toBeVisible();
});

test('menu Shops opens /shops', async ({ page }) => {
  await seedSignedIn(page);
  await fulfillForumMessages(page, []);
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('link', { name: 'Shops' })).toHaveAttribute('href', '/shops');
  await page.getByRole('link', { name: 'Shops' }).click();
  await expect(page).toHaveURL(/\/shops/);
});

test('Function: ensureShopHashtag — compose appends the tag', async ({ page }) => {
  await seedSignedIn(page);
  let postedText = '';
  let resolvePosted: () => void = () => undefined;
  const posted = new Promise<void>((resolve) => {
    resolvePosted = resolve;
  });
  await page.route(/\/messages$/, async (route) => {
    if (route.request().method() === 'POST') {
      const contentType = route.request().headers()['content-type'] ?? '';
      if (contentType.includes('multipart/form-data')) {
        postedText = route.request().postData() ?? '';
      } else {
        const parsed = route.request().postDataJSON() as { text?: string };
        postedText = typeof parsed.text === 'string' ? parsed.text : '';
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'm-shop-new',
          name: 'Ada',
          text: 'Cafe Luna\n\n#21GiftsShop',
          createdAt: '2026-08-28T12:00:00.000Z',
          sats: 0,
          payable: true,
          hasPhoto: false,
          role: 'basis',
        }),
      });
      resolvePosted();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/shops');
  await page.getByLabel('Your message').fill('Cafe Luna');
  await page.getByRole('button', { name: 'Post' }).click();
  await posted;
  expect(postedText).toContain('#21GiftsShop');
});
