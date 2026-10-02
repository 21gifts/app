import { expect, test } from '@playwright/test';

const PAUSED =
  'Applications are currently paused. You can apply again when shop transactions have increased.';

test('Function: FundingApplyPage — apply heading is visible', async ({ page }) => {
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
        role: 'verified',
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
        funding: {
          status: 'none',
          trialUtcDate: null,
          admittedAt: null,
          reviewedByName: null,
        },
      }),
    });
  });
  await page.goto('/profile/apply');
  await page.goto('/grants/apply');
  await expect(page.getByRole('heading', { name: '21 gifts grant' })).toBeVisible();
  await expect(page.getByText(PAUSED)).toBeVisible();
});

test('Function: FundingApplyScreen — shows paused applications copy', async ({ page }) => {
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
        role: 'verified',
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
        funding: {
          status: 'none',
          trialUtcDate: null,
          admittedAt: null,
          reviewedByName: null,
        },
      }),
    });
  });
  await page.goto('/grants/apply');
  await expect(page.getByRole('heading', { name: '21 gifts grant' })).toBeVisible();
  await expect(page.getByText(PAUSED)).toBeVisible();
});

test('Function: FundingPausedCopy — shows the paused sentence and the statistics link', async ({
  page,
}) => {
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
        role: 'verified',
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
        funding: {
          status: 'none',
          trialUtcDate: null,
          admittedAt: null,
          reviewedByName: null,
        },
      }),
    });
  });
  await page.goto('/grants/apply');
  await expect(page.getByText(PAUSED)).toBeVisible();
  await expect(page.getByRole('link', { name: 'https://21.gifts/statistics' })).toHaveAttribute(
    'href',
    'https://21.gifts/statistics',
  );
  await expect(page.getByRole('link', { name: 'Apply for the 21 gifts grant' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Apply for the 21 gifts grant' })).toHaveCount(0);
});
