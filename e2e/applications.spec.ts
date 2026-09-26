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

test('Function: FundingApplicationsPage — grants page opens the queue', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await stubApplications(page, [APPLICATION]);
  await page.goto('/grants');
  await expect(page.getByRole('link', { name: 'Open applications' })).toHaveAttribute(
    'href',
    '/grants/applications',
  );
  await page.goto('/grants/applications');
  await expect(page.getByRole('heading', { name: 'Open applications' })).toBeVisible();
  await page.goto('/moderate/applications');
});

test('Function: GrantsPage — signed-in grant card is on /grants', async ({ page }) => {
  await seedAdaSession(page, 'verified');
  await page.goto('/grants');
  await expect(page.getByText('21 gifts grant', { exact: true })).toBeVisible();
});

test('Function: GrantsScreen — moderator sees the applications link', async ({ page }) => {
  await seedAdaSession(page, 'moderator');
  await page.goto('/grants');
  await expect(page.getByRole('link', { name: 'Open applications' })).toHaveAttribute(
    'href',
    '/grants/applications',
  );
});

test('Function: fetchFundingApplications — staff see an applicant row', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await stubApplications(page, [APPLICATION]);
  await page.goto('/grants/applications');
  await expect(page.getByRole('link', { name: 'Rose' })).toHaveAttribute(
    'href',
    '/grants/applications/acc_rose',
  );
});

test('Function: FundingApplicationsScreen — basis visitors see the forbidden copy', async ({
  page,
}) => {
  await seedAdaSession(page, 'basis');
  await page.goto('/grants/applications');
  await expect(page.getByRole('heading', { name: 'Open applications' })).toBeVisible();
  await expect(page.getByText('This page is for moderators.')).toBeVisible();
  await expect(page.getByRole('list')).toHaveCount(0);
});

test('Function: formatForumTimeFromMs — applied time is visible', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await stubApplications(page, [APPLICATION]);
  await page.goto('/grants/applications');
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
  await page.goto('/grants/applications/acc_rose');
  await expect(page.getByRole('heading', { name: 'Grant application' })).toBeVisible();
  await expect(page.getByText('Living-room note.')).toBeVisible();
  await expect(
    page.getByText('Do their profile posts match the core principles of 21.gifts?'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Yes' })).toBeVisible();
});

test('Function: FundingApplicationDetailScreen — basis visitors see the forbidden copy', async ({
  page,
}) => {
  await seedAdaSession(page, 'basis');
  await page.goto('/grants/applications/[accountId]');
  await page.goto('/moderate/applications/[accountId]');
  await expect(page.getByRole('heading', { name: 'Grant application' })).toBeVisible();
  await expect(page.getByText('This page is for moderators.')).toBeVisible();
});

test('Function: fetchFundingApplication — staff see the principles question and posts', async ({
  page,
}) => {
  await seedAdaSession(page, 'moderator');
  await page.route('**/funding/applications/acc_rose', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DETAIL),
    });
  });
  await page.goto('/grants/applications/acc_rose');
  await expect(
    page.getByText('Do their profile posts match the core principles of 21.gifts?'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'No' })).toBeVisible();
});

async function stubDetail(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/funding/applications/acc_rose', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DETAIL),
    });
  });
}

const DECISION = {
  id: 'acc_rose',
  name: 'Rose',
  role: 'verified' as const,
  funding: {
    status: 'trial' as const,
    trialUtcDate: '2026-09-20',
    admittedAt: null,
    reviewedByName: 'Ada',
  },
};

test('Function: postFundingAdmit — Yes admits and returns to the queue', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await stubDetail(page);
  await stubApplications(page, []);
  await page.route('**/funding/admit', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...DECISION,
        funding: {
          status: 'admitted',
          trialUtcDate: null,
          admittedAt: Date.parse('2026-08-28T12:00:00.000Z'),
          reviewedByName: 'Ada',
        },
      }),
    });
  });
  await page.goto('/grants/applications/acc_rose');
  const posted = page.waitForRequest(
    (req) => req.method() === 'POST' && req.url().includes('/funding/admit'),
  );
  await page.getByRole('button', { name: 'Yes' }).click();
  expect((await posted).method()).toBe('POST');
  await expect(page).toHaveURL(/\/grants\/applications$/);
});

test('Function: postFundingReject — unmet posts reject and returns to the queue', async ({
  page,
}) => {
  await seedAdaSession(page, 'founder');
  await stubDetail(page);
  await stubApplications(page, []);
  await page.route('**/funding/reject', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...DECISION,
        funding: {
          status: 'rejected',
          trialUtcDate: null,
          admittedAt: null,
          reviewedByName: null,
        },
      }),
    });
  });
  await page.goto('/grants/applications/acc_rose');
  const posted = page.waitForRequest(
    (req) => req.method() === 'POST' && req.url().includes('/funding/reject'),
  );
  await page.getByRole('button', { name: 'No' }).click();
  expect((await posted).method()).toBe('POST');
  await expect(page).toHaveURL(/\/grants\/applications$/);
});

test('Function: FundingStatusCard — basis grants page shows not verified', async ({ page }) => {
  await seedAdaSession(page, 'basis', null);
  await page.goto('/grants');
  await expect(page.getByText('You are not verified yet.')).toBeVisible();
});

test('Function: postFundingApply — Yes posts apply', async ({ page }) => {
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
        location: 'Zurich',
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
  await page.route(/\/forum\/members\/[^/]+\/posts/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'msg_1',
            accountId: 'acc_e2e',
            name: 'Ada',
            text: 'Living-room note.',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: false,
            photoCount: 0,
            hasVideo: false,
            videoContentType: null,
            role: 'verified',
            replyCount: 0,
          },
        ],
      }),
    });
  });
  await page.route(/\/funding\/apply$/, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        funding: {
          status: 'pending',
          trialUtcDate: null,
          admittedAt: null,
          reviewedByName: null,
        },
      }),
    });
  });
  await page.goto('/grants/apply');
  const posted = page.waitForRequest(
    (req) => req.method() === 'POST' && /\/funding\/apply$/.test(new URL(req.url()).pathname),
  );
  await page.getByRole('button', { name: 'Yes' }).click();
  expect((await posted).method()).toBe('POST');
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
