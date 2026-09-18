import { expect, test } from '@playwright/test';

const HIDDEN = {
  id: 'h1',
  name: 'Bob',
  text: 'Hidden note',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 0,
  hasPhoto: false,
  hasVideo: false,
  videoContentType: null,
  parentId: null,
  deletedAt: '2026-08-29T15:00:00.000Z',
  deletedBy: { id: 'acc_mod', name: 'Ada', role: 'moderator' },
};

async function seedAdaSession(
  page: import('@playwright/test').Page,
  role: 'basis' | 'moderator' | 'founder' = 'basis',
): Promise<void> {
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
        role,
        name: 'Ada',
        location: null,
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
}

async function stubHiddenList(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/forum/messages/hidden', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [HIDDEN] }),
    });
  });
}

test('Function: ModeratePage — staff see the moderation hub', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await stubHiddenList(page);
  await page.goto('/moderate');
  await expect(page.getByRole('heading', { name: 'Moderation' })).toBeVisible();
  await expect(page.getByText('Tools for founders and moderators.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Hidden notes' })).toHaveAttribute(
    'href',
    '/moderate/hidden',
  );
  await expect(page.getByText('Hidden by Ada')).toHaveCount(0);
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('link', { name: 'Moderation' })).toHaveAttribute('href', '/moderate');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Hidden notes' }).click();
  await expect(page.getByRole('heading', { name: 'Hidden notes' })).toBeVisible();
  await expect(page.getByText('Hidden by Ada')).toBeVisible();
});

test('Function: ModerateScreen — basis visitors see the forbidden copy', async ({ page }) => {
  await seedAdaSession(page, 'basis');
  await page.goto('/moderate');
  await expect(page.getByRole('heading', { name: 'Moderation' })).toBeVisible();
  await expect(page.getByText('This page is for founders and moderators.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Hidden notes' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('link', { name: 'Moderation' })).toHaveCount(0);
});

test('Function: HiddenNotesPage — staff see the hidden-note list', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await stubHiddenList(page);
  await page.goto('/moderate/hidden');
  await expect(page.getByText('Hidden note', { exact: true })).toBeVisible();
  await expect(page.getByText('Hidden by Ada')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Moderation' })).toHaveAttribute('href', '/moderate');
});

test('Function: HiddenNotesScreen — basis visitors see the forbidden copy', async ({ page }) => {
  await seedAdaSession(page, 'basis');
  await page.goto('/moderate/hidden');
  await expect(page.getByText('This page is for founders and moderators.')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Hidden notes' })).toHaveCount(0);
});

test('Function: listHiddenMessages — staff list shows a hidden note', async ({ page }) => {
  await seedAdaSession(page, 'moderator');
  await stubHiddenList(page);
  await page.goto('/moderate/hidden');
  await expect(page.getByText('Hidden note', { exact: true })).toBeVisible();
  await expect(page.getByText('Hidden by Ada')).toBeVisible();
});

test('Function: HiddenNotesScreen — a visitor row shows the badge, a member row does not', async ({
  page,
}) => {
  await seedAdaSession(page, 'founder');
  await page.route('**/forum/messages/hidden', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'h2',
            name: 'Robin',
            text: 'Hidden visitor note',
            via: 'nostr',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 0,
            hasPhoto: false,
            hasVideo: false,
            videoContentType: null,
            parentId: null,
            deletedAt: '2026-08-29T15:00:00.000Z',
            deletedBy: { id: 'acc_mod', name: 'Ada', role: 'moderator' },
          },
          HIDDEN,
        ],
      }),
    });
  });
  await page.goto('/moderate/hidden');
  await expect(page.getByText('Hidden visitor note', { exact: true })).toBeVisible();
  const visitorRow = page.locator('li', { hasText: 'Robin' });
  await expect(visitorRow.getByText('Visitor')).toBeVisible();
  const memberRow = page.locator('li', { hasText: 'Bob' });
  await expect(memberRow.getByText('Visitor')).toHaveCount(0);
});

test('Function: proxyMessagesHiddenGet — GET /forum/messages/hidden without bearer is 401', async ({
  request,
}) => {
  expect((await request.get('/forum/messages/hidden')).status()).toBe(401);
});
