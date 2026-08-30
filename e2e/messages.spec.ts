import { expect, test } from '@playwright/test';

const ID = '11111111-1111-4111-8111-111111111111';

const PUBLIC_NOTE = {
  id: ID,
  name: 'Ada',
  text: 'Hello from Ada',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 0,
  payable: false,
  hasPhoto: false,
  role: 'basis',
  replyCount: 0,
};

test('e2e:check dynamic path token for /messages/[id]', async ({ page }) => {
  await page.goto('/messages/[id]');
});

test('signed-in inbox heading is Messages', async ({ page }) => {
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
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
      }),
    });
  });
  await page.route(/\/conversations$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [
          {
            id: 'conv-21',
            name: '21.gifts',
            lastText: 'Hello team',
            lastAt: '2026-08-28T12:00:00.000Z',
          },
        ],
      }),
    });
  });
  await page.goto('/messages');
  await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
});

test('inbox empty shows No private messages yet.', async ({ page }) => {
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
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
      }),
    });
  });
  await page.route(/\/conversations$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conversations: [] }),
    });
  });
  await page.goto('/messages');
  await expect(page.getByText('No private messages yet.')).toBeVisible();
});

test('inbox loading', async ({ page }) => {
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
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
      }),
    });
  });
  await page.route(/\/conversations$/, async () => {
    /* hang — inbox loading */
  });
  await page.goto('/messages');
  await expect(page.getByText('Loading…')).toBeVisible();
});

test('inbox error shows Could not load messages. Please try again.', async ({ page }) => {
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
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
      }),
    });
  });
  await page.route(/\/conversations$/, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Platform account is not configured' }),
    });
  });
  await page.goto('/messages');
  await expect(page.getByText('Could not load messages. Please try again.')).toBeVisible();
});

test('inbox thread shows Hello team', async ({ page }) => {
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
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
      }),
    });
  });
  await page.route(/\/conversations$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [
          {
            id: 'conv-21',
            name: '21.gifts',
            lastText: 'Hello team',
            lastAt: '2026-08-28T12:00:00.000Z',
          },
        ],
      }),
    });
  });
  await page.route(/\/conversations\/conv-21$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm1',
            name: 'Ada',
            text: 'Hello team',
            createdAt: '2026-08-28T12:00:00.000Z',
          },
        ],
      }),
    });
  });
  await page.goto('/messages?c=conv-21');
  await expect(page.getByText('Hello team')).toBeVisible();
});

test('public message default shows Hello from Ada', async ({ page }) => {
  await page.route(`**/public-messages/${ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PUBLIC_NOTE),
    });
  });
  await page.goto(`/messages/${ID}`);
  await expect(page.getByText('Hello from Ada')).toBeVisible();
  await expect(page.getByText('Ada', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
});

test('public message missing shows not-found copy', async ({ page }) => {
  await page.goto('/messages/not-a-uuid');
  await expect(page.getByText('This profile could not be found.')).toBeVisible();
});

test('public message loading shows Loading…', async ({ page }) => {
  await page.route(`**/public-messages/${ID}`, async () => {
    // never fulfill
  });
  await page.goto(`/messages/${ID}`);
  await expect(page.getByText('Loading…')).toBeVisible();
});

test('public message error shows Try again', async ({ page }) => {
  await page.route(`**/public-messages/${ID}`, async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'boom' }),
    });
  });
  await page.goto(`/messages/${ID}`);
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});
