import { expect, test } from '@playwright/test';

const ABOUT_STEP = 'First, write a short About me so people can get to know you.';

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
        lightningAddress: null,
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
  await expect(page.getByRole('heading', { name: 'Apply for the 21 gifts grant' })).toBeVisible();
  await expect(page.getByText(ABOUT_STEP)).toBeVisible();
});

test('Function: FundingApplyScreen — shows the apply walk to any verified member', async ({
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
        lightningAddress: null,
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
  await expect(page.getByRole('heading', { name: 'Apply for the 21 gifts grant' })).toBeVisible();
  await expect(page.getByText(ABOUT_STEP)).toBeVisible();
});

test('Function: aboutMeFilled — a name-matching About me still asks for the bio', async ({
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
        username: 'joey-rosima',
        location: null,
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: 'Ada',
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
  await expect(
    page.getByText('First, write a short About me so people can get to know you.'),
  ).toBeVisible();
});

test('Function: nextFillStep — the photo step is offered after About me', async ({ page }) => {
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
        username: 'joey-rosima',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: 'I build on Bitcoin',
        aboutMeHasPhoto: false,
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
  await expect(page.getByText('Next, add a photo to your About me.')).toBeVisible();
});

test('Function: locationFilled — the location step is offered after About me and a photo', async ({
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
        username: 'joey-rosima',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: 'I build on Bitcoin',
        aboutMeHasPhoto: true,
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
  await expect(page.getByText('Next, add the place you live.')).toBeVisible();
});
