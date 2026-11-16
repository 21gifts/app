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
    lightningAddress: null,
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

/**
 * Signs Ada in and answers every `GET /me`. `funding` may be a getter, read when
 * the request arrives.
 */
async function seedAdaSession(
  page: import('@playwright/test').Page,
  role: 'basis' | 'moderator' | 'founder' | 'verified' = 'basis',
  funding: unknown = undefined,
): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route(/\/me$/, async (route) => {
    const fundingNow = typeof funding === 'function' ? funding() : funding;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role,
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
        funding:
          fundingNow !== undefined
            ? fundingNow
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
  await expect(
    page.getByRole('link', { name: 'Open application (1)', exact: true }),
  ).toHaveAttribute('href', '/grants/applications');
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
  await stubApplications(page, [APPLICATION]);
  await page.goto('/grants');
  await expect(page.getByRole('link', { name: 'Goals', exact: true })).toHaveAttribute(
    'href',
    '/grants/goals',
  );
  await expect(
    page.getByRole('link', { name: 'Open application (1)', exact: true }),
  ).toHaveAttribute('href', '/grants/applications');
});

test("Function: refreshOwnerAccount — today's payout shows one actionable reason", async ({
  page,
}) => {
  await seedAdaSession(page, 'verified', {
    status: 'none',
    trialUtcDate: null,
    admittedAt: null,
    reviewedByName: null,
    shopPaymentDue: true,
    payoutToday: { state: 'blocked', reason: 'shop_payment' },
  });
  await page.goto('/grants');
  const payout = page.getByRole('group', { name: "Today's payout" });
  await expect(payout.locator('p')).toHaveCount(1);
  await expect(
    payout.getByRole('link', {
      name: 'You must have made at least one purchase in a 21.gifts shop today or yesterday.',
    }),
  ).toHaveAttribute('href', '/shops');
});

test('Function: GrantGoalsPage — signed-in goals page explains the shop target', async ({
  page,
}) => {
  await seedAdaSession(page, 'verified');
  await page.goto('/grants/goals');
  await expect(page.getByRole('heading', { name: 'Goals' })).toBeVisible();
  await expect(
    page.getByText('Goal reached: 10 active shops. The grant program is open again.'),
  ).toBeVisible();
});

test('Function: GrantGoalsScreen — a shop is active on 5 of the last 7 days', async ({ page }) => {
  await seedAdaSession(page, 'basis');
  await page.goto('/grants/goals');
  await expect(
    page.getByText(
      'A shop is active when it has at least one transaction on 5 of the last 7 days.',
    ),
  ).toBeVisible();
  await expect(page.getByText(/https:\/\/21\.gifts\/pos/)).toBeVisible();
});

test('Function: fetchGrantContinuation — the goals page shows shops that meet the rule', async ({
  page,
}) => {
  await seedAdaSession(page, 'basis');
  await page.goto('/grants/goals');
  await expect(page.getByText('0 shops meet this')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Shops per UTC day' })).toBeVisible();
});

test('Function: proxyFundingGoalGet — GET /funding/goal without bearer is 401', async ({
  request,
}) => {
  const res = await request.get('/funding/goal');
  expect(res.status()).toBe(401);
});

test('Function: GrantPlacesPanel — the goals page shows free places and the next goal', async ({
  page,
}) => {
  await seedAdaSession(page, 'basis');
  await page.goto('/grants/goals');
  const panel = page.getByRole('group', { name: 'Grant places' });
  await expect(panel.getByText('10 of 10 places are free.')).toBeVisible();
  await expect(
    panel.getByText('When 20 shops are active, the grant program opens for more people.'),
  ).toBeVisible();
});

test('Function: fetchGrantPlaces — the grants page shows the grant places', async ({ page }) => {
  await seedAdaSession(page, 'verified');
  await page.goto('/grants');
  const panel = page.getByRole('group', { name: 'Grant places' });
  await expect(panel.getByText('Moderators have admitted 0 people in this round.')).toBeVisible();
  await expect(
    panel.getByText(
      'Applications are open to every verified member. Moderators admit up to 10 people in this round.',
    ),
  ).toBeVisible();
});

test('Function: proxyFundingPlacesGet — GET /funding/places is public', async ({ request }) => {
  const res = await request.get('/funding/places');
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { placesLeft: number }).placesLeft).toBe(10);
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

test('Function: FundingApplicationDetailScreen — a full round shows the places-full copy', async ({
  page,
}) => {
  await seedAdaSession(page, 'founder');
  await stubDetail(page);
  await page.route('**/funding/admit', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'All grant places are taken' }),
    });
  });
  await page.goto('/grants/applications/acc_rose');
  await page.getByRole('button', { name: 'Yes' }).click();
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(
    page.getByText(
      'All places of this round are taken. Nobody else can be admitted until the next round opens.',
    ),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/grants\/applications\/acc_rose$/);
});

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
  await expect(
    page.getByText('Do these posts, to your knowledge, correspond to the truth?'),
  ).toBeVisible();
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

test('Function: FundingApplicationDetailScreen — a decision opened from the queue does not stay behind its arrow', async ({
  page,
}) => {
  await seedAdaSession(page, 'founder');
  await stubDetail(page);
  await stubApplications(page, [APPLICATION]);
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
        funding: { status: 'rejected', trialUtcDate: null, admittedAt: null, reviewedByName: null },
      }),
    });
  });
  await page.goto('/grants/applications');
  await page.getByRole('link', { name: 'Rose' }).click();
  await expect(page).toHaveURL(/\/grants\/applications\/acc_rose$/);
  await page.getByRole('button', { name: 'No' }).click();
  await expect(page).toHaveURL(/\/grants\/applications$/);
  await expect(page.getByRole('link', { name: 'Back to the forum' })).toHaveAttribute(
    'href',
    '/welcome',
  );
  await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveCount(0);
});

test('Function: FundingStatusCard — basis grants page shows not verified', async ({ page }) => {
  await seedAdaSession(page, 'basis', null);
  await page.goto('/grants');
  await expect(page.getByText('You are not verified yet.')).toBeVisible();
});

/** Verified member whose grant application walk is open, and whose apply posts. */
async function stubApplyWalk(page: import('@playwright/test').Page): Promise<void> {
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
        location: 'Zurich',
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
}

test('Function: postFundingApply — Yes posts apply', async ({ page }) => {
  await stubApplyWalk(page);
  await page.goto('/grants/apply');
  const posted = page.waitForRequest(
    (req) => req.method() === 'POST' && /\/funding\/apply$/.test(new URL(req.url()).pathname),
  );
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(
    page.getByText('Do these posts, to your knowledge, correspond to the truth?'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Yes' }).click();
  expect((await posted).method()).toBe('POST');
});

test('Function: FundingApplyScreen — apply opened from /grants steps back, so /grants does not lead to it again', async ({
  page,
}) => {
  await stubApplyWalk(page);
  await page.goto('/grants');
  await page.getByRole('link', { name: 'Apply for the 21 gifts grant' }).click();
  await expect(page).toHaveURL(/\/grants\/apply$/);
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(
    page.getByText('Do these posts, to your knowledge, correspond to the truth?'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page).toHaveURL(/\/grants$/);
  await expect(page.getByRole('link', { name: 'Back to the forum' })).toHaveAttribute(
    'href',
    '/welcome',
  );
  await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveCount(0);
});

test('Function: postFundingApply — POST /funding/apply without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/funding/apply')).status()).toBe(401);
});

const ADMITTED = {
  status: 'admitted',
  trialUtcDate: null,
  admittedAt: Date.parse('2026-08-28T12:00:00.000Z'),
  reviewedByName: 'Rose',
};

const NO_GRANT = { status: 'none', trialUtcDate: null, admittedAt: null, reviewedByName: null };

/** Answers `GET /funding/places` with `placesLeft` free places of 10. */
async function stubPlaces(
  page: import('@playwright/test').Page,
  placesLeft: () => number,
): Promise<void> {
  await page.route('**/funding/places', async (route) => {
    const left = placesLeft();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        round: 1,
        startsAt: '2026-10-16T00:00:00.000Z',
        places: 10,
        admitted: 10 - left,
        placesLeft: left,
        nextGoalShops: 20,
      }),
    });
  });
}

/** Answers `POST /funding/withdraw` with `status` and counts the requests. */
async function stubWithdraw(
  page: import('@playwright/test').Page,
  status: number,
  hold: Promise<void> = Promise.resolve(),
): Promise<{ count: () => number }> {
  let count = 0;
  await page.route(/\/funding\/withdraw$/, async (route) => {
    count += 1;
    await hold;
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(
        status === 200
          ? { funding: NO_GRANT }
          : { error: status === 409 ? 'Conflict' : status === 404 ? 'Not found' : 'Unauthorized' },
      ),
    });
  });
  return { count: () => count };
}

test("Function: FundingWithdrawControl — Leave the grant asks first, then shows the apply card, the free place, and today's payout again", async ({
  page,
}) => {
  let withdrawn = false;
  await seedAdaSession(page, 'verified', () =>
    withdrawn
      ? { ...NO_GRANT, payoutToday: { state: 'blocked', reason: 'admission' } }
      : { ...ADMITTED, payoutToday: { state: 'paid', reason: null } },
  );
  await stubPlaces(page, () => (withdrawn ? 1 : 0));
  const withdraw = await stubWithdraw(page, 200);
  page.on('request', (req) => {
    if (req.method() === 'POST' && /\/funding\/withdraw$/.test(new URL(req.url()).pathname)) {
      withdrawn = true;
    }
  });
  await page.goto('/grants');
  const panel = page.getByRole('group', { name: 'Grant places' });
  const payout = page.getByRole('group', { name: "Today's payout" });
  await expect(panel.getByText('0 of 10 places are free.')).toBeVisible();
  await expect(payout.getByText('Payout made today.')).toBeVisible();
  await page.getByRole('button', { name: 'Leave the grant' }).click();
  const question = page.getByRole('group', { name: 'Leave the grant?' });
  await expect(
    question.getByText(
      'Your daily payout stops today. Your place becomes free for someone else. You can apply again later, but a place is not guaranteed.',
    ),
  ).toBeVisible();
  expect(withdraw.count()).toBe(0);
  await question.getByRole('button', { name: 'Leave the grant' }).click();
  await expect(page.getByRole('link', { name: 'Apply for the 21 gifts grant' })).toBeVisible();
  await expect(panel.getByText('1 of 10 places is free.')).toBeVisible();
  await expect(
    payout.getByRole('link', { name: 'You must be admitted to the grant program.' }),
  ).toHaveAttribute('href', '/grants/apply');
  await expect(page.getByRole('button', { name: 'Leave the grant' })).toHaveCount(0);
  expect(withdraw.count()).toBe(1);
});

test('Function: discardOwnerRefreshes — after a 409 the payout line shows the reloaded reason, not the one from opening /grants', async ({
  page,
}) => {
  let conflicted = false;
  await seedAdaSession(page, 'verified', () =>
    conflicted
      ? { ...NO_GRANT, payoutToday: { state: 'blocked', reason: 'admission' } }
      : { ...ADMITTED, payoutToday: { state: 'paid', reason: null } },
  );
  await stubWithdraw(page, 409);
  page.on('request', (req) => {
    if (req.method() === 'POST' && /\/funding\/withdraw$/.test(new URL(req.url()).pathname)) {
      conflicted = true;
    }
  });
  await page.goto('/grants');
  const payout = page.getByRole('group', { name: "Today's payout" });
  await expect(payout.getByText('Payout made today.')).toBeVisible();
  await page.getByRole('button', { name: 'Leave the grant' }).click();
  await page
    .getByRole('group', { name: 'Leave the grant?' })
    .getByRole('button', { name: 'Leave the grant' })
    .click();
  await expect(page.getByRole('link', { name: 'Apply for the 21 gifts grant' })).toBeVisible();
  await expect(
    payout.getByRole('link', { name: 'You must be admitted to the grant program.' }),
  ).toHaveAttribute('href', '/grants/apply');
  await expect(payout.getByText('Payout made today.')).toHaveCount(0);
});

test('Function: FundingWithdrawControl — Cancel closes the question and sends nothing', async ({
  page,
}) => {
  await seedAdaSession(page, 'verified', { ...NO_GRANT, status: 'pending' });
  const withdraw = await stubWithdraw(page, 200);
  await page.goto('/grants');
  await page.getByRole('button', { name: 'Withdraw my application' }).click();
  const question = page.getByRole('group', { name: 'Withdraw your application?' });
  await expect(
    question.getByText('A moderator will no longer review it. You can apply again later.'),
  ).toBeVisible();
  await question.getByRole('button', { name: 'Cancel' }).click();
  await expect(question).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Withdraw my application' })).toBeVisible();
  expect(withdraw.count()).toBe(0);
});

test('Function: postFundingWithdraw — an api without the endpoint (404) keeps the question open with the error', async ({
  page,
}) => {
  await seedAdaSession(page, 'verified', { ...ADMITTED, status: 'trial', admittedAt: null });
  await stubWithdraw(page, 404);
  await page.goto('/grants');
  await page.getByRole('button', { name: 'Leave the grant' }).click();
  const question = page.getByRole('group', { name: 'Leave the grant?' });
  await question.getByRole('button', { name: 'Leave the grant' }).click();
  await expect(question.getByRole('alert')).toHaveText(
    'Could not leave the grant. Please try again.',
  );
  await expect(page).toHaveURL(/\/grants$/);
  await expect(question.getByRole('button', { name: 'Cancel' })).toBeEnabled();
});

test('Function: postFundingWithdraw — 409 loads the account again and shows its state without an error', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  let conflicted = false;
  let reloadsAfterConflict = 0;
  await page.route(/\/me$/, async (route) => {
    if (conflicted) {
      reloadsAfterConflict += 1;
    }
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
        funding: conflicted ? NO_GRANT : { ...NO_GRANT, status: 'pending' },
      }),
    });
  });
  await stubWithdraw(page, 409);
  page.on('request', (req) => {
    if (req.method() === 'POST' && /\/funding\/withdraw$/.test(new URL(req.url()).pathname)) {
      conflicted = true;
    }
  });
  await page.goto('/grants');
  await page.getByRole('button', { name: 'Withdraw my application' }).click();
  await page
    .getByRole('group', { name: 'Withdraw your application?' })
    .getByRole('button', { name: 'Withdraw my application' })
    .click();
  await expect(page.getByRole('link', { name: 'Apply for the 21 gifts grant' })).toBeVisible();
  await expect(page.getByText(/^Could not (withdraw|leave)/)).toHaveCount(0);
  expect(reloadsAfterConflict).toBeGreaterThanOrEqual(1);
});

test('Function: postFundingWithdraw — a double tap sends one request while the confirm action is busy', async ({
  page,
}) => {
  await seedAdaSession(page, 'verified', ADMITTED);
  let release: () => void = () => undefined;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const withdraw = await stubWithdraw(page, 200, hold);
  await page.goto('/grants');
  await page.getByRole('button', { name: 'Leave the grant' }).click();
  const confirm = page
    .getByRole('group', { name: 'Leave the grant?' })
    .getByRole('button', { name: 'Leave the grant' });
  await confirm.dblclick();
  await expect(confirm).toBeDisabled();
  release();
  await expect(page.getByRole('link', { name: 'Apply for the 21 gifts grant' })).toBeVisible();
  expect(withdraw.count()).toBe(1);
});

test('Function: postFundingWithdraw — 401 signs the member out', async ({ page }) => {
  await seedAdaSession(page, 'verified', ADMITTED);
  await stubWithdraw(page, 401);
  await page.goto('/grants');
  await page.getByRole('button', { name: 'Leave the grant' }).click();
  await page
    .getByRole('group', { name: 'Leave the grant?' })
    .getByRole('button', { name: 'Leave the grant' })
    .click();
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('21gifts.session'))).toBeNull();
});

test('Function: proxyFundingWithdrawPost — POST /funding/withdraw without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/funding/withdraw')).status()).toBe(401);
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
