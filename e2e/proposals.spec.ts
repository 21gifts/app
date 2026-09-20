import { expect, test } from '@playwright/test';

const PROPOSAL = {
  subject: { id: 'acc_rose', name: 'Rose', role: 'verified' as const },
  proposedBy: { id: 'acc_bob', name: 'Bob' },
  createdAt: '2026-08-28T12:00:00.000Z',
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

async function stubProposals(
  page: import('@playwright/test').Page,
  proposals: Array<{
    subject: { id: string; name: string | null; role: 'verified' };
    proposedBy: { id: string; name: string | null };
    createdAt: string;
  }> = [],
): Promise<void> {
  await page.route('**/trust/proposals', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ proposals }),
    });
  });
}

test('Function: ProposalsPage — staff hub Open proposals href /moderate/proposals', async ({
  page,
}) => {
  await seedAdaSession(page, 'founder');
  await stubProposals(page, [PROPOSAL]);
  await page.goto('/moderate');
  await expect(page.getByRole('heading', { name: 'Moderation' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open proposals' })).toHaveAttribute(
    'href',
    '/moderate/proposals',
  );
  await page.getByRole('button', { name: 'Menu' }).click();
  const menu = page.locator('#signed-in-menu');
  await expect(menu.getByRole('link', { name: 'Moderation' })).toHaveAttribute('href', '/moderate');
  await expect(menu.getByRole('link', { name: 'Open proposals' })).toHaveCount(0);
  await page.goto('/moderate/proposals');
  await expect(page.getByRole('heading', { name: 'Open proposals' })).toBeVisible();
});

test('Function: fetchTrustProposals — staff see Confirm as moderator', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await stubProposals(page, [PROPOSAL]);
  await page.goto('/moderate/proposals');
  await expect(page.getByRole('heading', { name: 'Open proposals' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Rose' })).toHaveAttribute(
    'href',
    '/members/acc_rose',
  );
  await expect(page.getByText('Proposed by Bob')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm as moderator' })).toBeVisible();
});

test('Function: ProposalsScreen — waiting copy when proposedBy is self', async ({ page }) => {
  await seedAdaSession(page, 'moderator');
  await stubProposals(page, [{ ...PROPOSAL, proposedBy: { id: 'acc_e2e', name: 'Ada' } }]);
  await page.goto('/moderate/proposals');
  await expect(page.getByText('Rose')).toBeVisible();
  await expect(page.getByText('Waiting for another moderator to confirm.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm as moderator' })).toHaveCount(0);
});

test('Function: ProposalsScreen — basis visitors see the forbidden copy', async ({ page }) => {
  await seedAdaSession(page, 'basis');
  await page.goto('/moderate/proposals');
  await expect(page.getByRole('heading', { name: 'Open proposals' })).toBeVisible();
  await expect(page.getByText('This page is for moderators.')).toBeVisible();
  await expect(page.getByRole('list')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Moderation' })).toHaveAttribute('href', '/moderate');
  await page.getByRole('button', { name: 'Menu' }).click();
  const menu = page.locator('#signed-in-menu');
  await expect(menu.getByRole('link', { name: 'Open proposals' })).toHaveCount(0);
  await expect(menu.getByRole('link', { name: 'Moderation' })).toHaveCount(0);
});

test('Function: proxyTrustProposalsGet — GET /trust/proposals without bearer is 401', async ({
  request,
}) => {
  expect((await request.get('/trust/proposals')).status()).toBe(401);
});
