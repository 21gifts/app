import { expect, test } from '@playwright/test';

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
  await expect(page.getByRole('heading', { name: 'Apply for the 21 gifts grant' })).toBeVisible();
});

test('Function: FundingApplyScreen — empty About me is the first calm step', async ({ page }) => {
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
  await expect(
    page.getByText('First, write a short About me so people can get to know you.'),
  ).toBeVisible();
});

test('Function: aboutMeFilled — name-only About me still asks for a bio', async ({ page }) => {
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
  await page.goto('/profile/apply');
  await expect(
    page.getByText('First, write a short About me so people can get to know you.'),
  ).toBeVisible();
});

test('Function: nextFillStep — photo is next after a filled About me', async ({ page }) => {
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
  await page.goto('/profile/apply');
  await expect(page.getByText('Next, add a photo to your About me.')).toBeVisible();
});

test('Function: locationFilled — location is next after About me and photo', async ({ page }) => {
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
  await page.goto('/profile/apply');
  await expect(page.getByText('Next, add the place you live.')).toBeVisible();
});
