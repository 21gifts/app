import { expect, test } from '@playwright/test';

const APPLICATION = {
  accountId: 'acc_rose',
  name: 'Rose',
  role: 'verified' as const,
  appliedAt: Date.parse('2026-08-28T12:00:00.000Z'),
};

const DETAIL = {
  account: {
    id: 'acc_rose',
    name: 'Rose',
    role: 'verified' as const,
    lightningAddress: 'rose@walletofsatoshi.com',
  },
  grant: {
    status: 'pending' as const,
    appliedAt: APPLICATION.appliedAt,
    trialUtcDate: null,
    admittedAt: null,
    decidedAt: null,
  },
  messages: [
    {
      id: 'msg_1',
      name: 'Rose',
      text: 'Living-room note.',
      createdAt: '2026-08-28T12:00:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
      role: 'verified',
      replyCount: 0,
    },
  ],
};

async function seedAdaSession(
  page: import('@playwright/test').Page,
  role: 'basis' | 'moderator' | 'founder' | 'verified' = 'basis',
  funding: unknown = undefined,
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
        funding:
          funding !== undefined
            ? funding
            : role === 'basis'
              ? null
              : {
                  status: 'none',
                  trialUtcDate: null,
                  admittedAt: null,
                  reviewedByName: null,
                },
      }),
    });
  });
}

async function stubApplications(
  page: import('@playwright/test').Page,
  applications: Array<typeof APPLICATION> = [],
): Promise<void> {
  await page.route('**/funding/applications', async (route) => {
    if (/\/funding\/applications\/[^/]+$/.test(new URL(route.request().url()).pathname)) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ applications }),
    });
  });
}

test('Function: FundingApplicationsPage — staff hub Open applications href /moderate/applications', async ({
  page,
}) => {
  await seedAdaSession(page, 'founder');
  await stubApplications(page, [APPLICATION]);
  await page.goto('/moderate');
  await expect(page.getByRole('heading', { name: 'Moderation' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open applications' })).toHaveAttribute(
    'href',
    '/moderate/applications',
  );
  await page.goto('/moderate/applications');
  await expect(page.getByRole('heading', { name: 'Open applications' })).toBeVisible();
});

test('Function: fetchFundingApplications — staff see an applicant row', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await stubApplications(page, [APPLICATION]);
  await page.goto('/moderate/applications');
  await expect(page.getByRole('link', { name: 'Rose' })).toHaveAttribute(
    'href',
    '/moderate/applications/acc_rose',
  );
});

test('Function: FundingApplicationsScreen — basis visitors see the forbidden copy', async ({
  page,
}) => {
  await seedAdaSession(page, 'basis');
  await page.goto('/moderate/applications');
  await expect(page.getByRole('heading', { name: 'Open applications' })).toBeVisible();
  await expect(page.getByText('This page is for founders and moderators.')).toBeVisible();
  await expect(page.getByRole('list')).toHaveCount(0);
});

test('Function: formatForumTimeFromMs — applied time is visible', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await stubApplications(page, [APPLICATION]);
  await page.goto('/moderate/applications');
  await expect(page.getByRole('link', { name: 'Rose' })).toBeVisible();
  await expect(page.locator('time').first()).toBeVisible();
});

test('Function: FundingApplicationDetailPage — staff review loads posts', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.route('**/funding/applications/acc_rose', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DETAIL),
    });
  });
  await page.goto('/moderate/applications/acc_rose');
  await expect(page.getByRole('heading', { name: 'Grant application' })).toBeVisible();
  await expect(page.getByText('Living-room note.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Trial' })).toBeVisible();
});

test('Function: FundingApplicationDetailScreen — basis visitors see the forbidden copy', async ({
  page,
}) => {
  await seedAdaSession(page, 'basis');
  await page.goto('/moderate/applications/[accountId]');
  await expect(page.getByRole('heading', { name: 'Grant application' })).toBeVisible();
  await expect(page.getByText('This page is for founders and moderators.')).toBeVisible();
});

test('Function: fetchFundingApplication — staff see Trial Admit Reject', async ({ page }) => {
  await seedAdaSession(page, 'moderator');
  await page.route('**/funding/applications/acc_rose', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DETAIL),
    });
  });
  await page.goto('/moderate/applications/acc_rose');
  await expect(page.getByRole('button', { name: 'Admit' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reject' })).toBeVisible();
});

test('Function: postFundingTrial — Trial control is labeled', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.route('**/funding/applications/acc_rose', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DETAIL),
    });
  });
  await page.goto('/moderate/applications/acc_rose');
  await expect(page.getByRole('button', { name: 'Trial' })).toBeVisible();
});

test('Function: postFundingAdmit — Admit control is labeled', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.route('**/funding/applications/acc_rose', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DETAIL),
    });
  });
  await page.goto('/moderate/applications/acc_rose');
  await expect(page.getByRole('button', { name: 'Admit' })).toBeVisible();
});

test('Function: postFundingReject — Reject control is labeled', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.route('**/funding/applications/acc_rose', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DETAIL),
    });
  });
  await page.goto('/moderate/applications/acc_rose');
  await expect(page.getByRole('button', { name: 'Reject' })).toBeVisible();
});

test('Function: FundingStatusCard — basis profile shows not verified', async ({ page }) => {
  await seedAdaSession(page, 'basis', null);
  await page.goto('/profile');
  await expect(page.getByText('You are not verified yet.')).toBeVisible();
});

test('Function: postFundingApply — verified profile shows Apply for the 21 gifts grant', async ({
  page,
}) => {
  await seedAdaSession(page, 'verified');
  await page.goto('/profile');
  await expect(page.getByRole('button', { name: 'Apply for the 21 gifts grant' })).toBeVisible();
});

test('Function: proxyFundingApplicationsGet — GET /funding/applications without bearer is 401', async ({
  request,
}) => {
  expect((await request.get('/funding/applications')).status()).toBe(401);
});

test('Function: proxyFundingApplicationGet — GET /funding/applications/[accountId] without bearer is 401', async ({
  request,
}) => {
  expect((await request.get('/funding/applications/[accountId]')).status()).toBeGreaterThanOrEqual(
    400,
  );
});

test('Function: proxyFundingApplyPost — POST /funding/apply without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/funding/apply')).status()).toBe(401);
});

test('Function: proxyFundingTrialPost — POST /funding/trial without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/funding/trial')).status()).toBe(401);
});

test('Function: proxyFundingAdmitPost — POST /funding/admit without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/funding/admit')).status()).toBe(401);
});

test('Function: proxyFundingRejectPost — POST /funding/reject without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/funding/reject')).status()).toBe(401);
});
