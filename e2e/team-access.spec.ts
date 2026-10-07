import { expect, test, type Request as PlaywrightRequest } from '@playwright/test';
import {
  TEAM_AUDIT,
  TEAM_MEMBERS,
  TEAM_RATE_STATS,
  TEAM_WALLET_EMPTY,
  routeTeamMemberData,
  seedTeamViewer,
} from './team-access-fixtures';

test('Function: TeamMembersPage — staff open the member search from the hub', async ({ page }) => {
  await seedTeamViewer(page, 'moderator');
  await page.goto('/moderate');
  await page.getByRole('link', { name: 'Member data' }).click();
  await expect(page).toHaveURL(/\/moderate\/members$/);
  await expect(page.getByRole('heading', { name: 'Member data' })).toBeVisible();
  await expect(page.getByText('Type a name or username.')).toBeVisible();
});

test('Function: TeamMemberSearchScreen — typing lists matches that open the member page', async ({
  page,
}) => {
  await seedTeamViewer(page, 'moderator');
  await page.route('**/team/members?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TEAM_MEMBERS),
    });
  });
  await routeTeamMemberData(page);
  await page.goto('/moderate/members');
  await page.getByLabel('Name or username').fill('ada');
  await expect(page.getByText('@adalove')).toBeVisible();
  await page.getByRole('link', { name: /Ada Lovelace/ }).click();
  await expect(page).toHaveURL(/\/moderate\/members\/acc_ada$/);
  await expect(page.getByRole('link', { name: 'Ada Lovelace, Open profile' })).toBeVisible();
});

test('Function: searchTeamMembers — sends the typed text, shows no match and errors', async ({
  page,
}) => {
  await seedTeamViewer(page, 'founder');
  const queries: string[] = [];
  await page.route('**/team/members?*', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('query') ?? '';
    queries.push(query);
    if (query === 'broken') {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ members: [] }),
    });
  });
  await page.goto('/moderate/members');
  await page.getByLabel('Name or username').fill('zed');
  await expect(page.getByText('No member found.')).toBeVisible();
  await page.getByLabel('Name or username').fill('broken');
  await expect(page.getByText('Could not search members. Please try again.')).toBeVisible();
  expect(queries).toContain('zed');
  expect(queries).toContain('broken');
});

test('Function: TeamMemberSearchScreen — a lower role sees the forbidden sentence', async ({
  page,
}) => {
  await seedTeamViewer(page, 'basis');
  await page.goto('/moderate/members');
  await expect(page.getByText('This page is for moderators.')).toBeVisible();
  await expect(page.getByLabel('Name or username')).toHaveCount(0);
});

test('Function: TeamMemberDataPage — the wallet tab shows balance, summary, and payments', async ({
  page,
}) => {
  await seedTeamViewer(page, 'initiator');
  await routeTeamMemberData(page);
  await page.goto('/moderate/members/acc_ada');
  await expect(page.getByText('Spent in the community')).toBeVisible();
  await expect(page.getByText('60%')).toBeVisible();
  await expect(page.getByText('Reported', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'From Bob' })).toHaveAttribute(
    'href',
    '/members/acc_bob',
  );
  await expect(page.getByText('To carol@example.com')).toBeVisible();
});

test('Function: TeamMemberDataScreen — Activity switches the tab', async ({ page }) => {
  await seedTeamViewer(page, 'moderator');
  await routeTeamMemberData(page);
  await page.goto('/moderate/members/acc_ada');
  await page.getByRole('button', { name: 'Activity' }).click();
  await expect(page.getByText('Opened a page')).toBeVisible();
  await expect(page.getByText('Sent a payment')).toBeVisible();
});

test('Function: TeamMemberWallet — period, direction, and category ask the api again', async ({
  page,
}) => {
  await seedTeamViewer(page, 'moderator');
  const urls: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/team/members/acc_ada/wallet')) {
      urls.push(request.url());
    }
  });
  await routeTeamMemberData(page);
  await page.goto('/moderate/members/acc_ada');
  await expect(page.getByText('Spent in the community')).toBeVisible();
  await page.getByRole('button', { name: '7 days' }).click();
  await expect(page.getByRole('button', { name: '7 days' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page
    .getByRole('group', { name: 'Direction' })
    .getByRole('button', { name: 'Sent' })
    .click();
  await page.getByRole('combobox', { name: 'Category' }).click();
  await expect(page.getByRole('option', { name: 'All categories' })).toBeVisible();
  await page.getByRole('option', { name: 'Shop' }).click();
  await expect(page.getByText('Sent · Shop')).toBeVisible();
  await expect.poll(() => urls.some((url) => url.includes('period=7'))).toBe(true);
  await expect.poll(() => urls.some((url) => url.includes('direction=out'))).toBe(true);
  await expect.poll(() => urls.some((url) => url.includes('category=shop'))).toBe(true);
});

test('Function: fetchTeamMemberWallet — a member without a report says so', async ({ page }) => {
  await seedTeamViewer(page, 'moderator');
  await routeTeamMemberData(page, { wallet: TEAM_WALLET_EMPTY });
  await page.goto('/moderate/members/acc_ada');
  await expect(page.getByText("This member's wallet has not reported yet.")).toBeVisible();
  await expect(page.getByText('No payments in this period.')).toBeVisible();
});

test('Function: useCursorPages — a failed page shows Try again and loads on press', async ({
  page,
}) => {
  await seedTeamViewer(page, 'moderator');
  let fail = true;
  await routeTeamMemberData(page);
  await page.route('**/team/members/acc_ada/wallet*', async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fallback();
  });
  await page.goto('/moderate/members/acc_ada');
  await expect(page.getByText('Could not load the wallet data. Please try again.')).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Spent in the community')).toBeVisible();
});

test('Function: useLatestRateDayState — the wallet tab shows each amount with its fiat', async ({
  page,
}) => {
  await seedTeamViewer(page, 'moderator');
  await page.route('**/gifts/stats**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TEAM_RATE_STATS),
    });
  });
  await routeTeamMemberData(page);
  await page.goto('/moderate/members/acc_ada');
  await expect(page.getByRole('region', { name: 'Balance' })).toContainText(/₿21.000 · .*\d/);
});

test('Function: TeamMemberEvents — empty and failed activity', async ({ page }) => {
  await seedTeamViewer(page, 'moderator');
  await routeTeamMemberData(page, { events: { events: [], nextCursor: null } });
  await page.goto('/moderate/members/acc_ada');
  await page.getByRole('button', { name: 'Activity' }).click();
  await expect(page.getByText('No activity yet.')).toBeVisible();
});

test('Function: fetchTeamMemberEvents — a failed load says so', async ({ page }) => {
  await seedTeamViewer(page, 'moderator');
  await routeTeamMemberData(page, { events: 503 });
  await page.goto('/moderate/members/acc_ada');
  await page.getByRole('button', { name: 'Activity' }).click();
  await expect(page.getByText('Could not load the activity. Please try again.')).toBeVisible();
});

test('Function: TeamMemberDataScreen — a lower role sees the forbidden sentence', async ({
  page,
}) => {
  await seedTeamViewer(page, 'basis');
  await page.goto('/moderate/members/acc_ada');
  await expect(page.getByText('This page is for moderators.')).toBeVisible();
});

test('e2e:check dynamic path token for /moderate/members/[accountId]', async ({ page }) => {
  await seedTeamViewer(page, 'basis');
  await page.goto('/moderate/members/[accountId]');
  await expect(page.getByText('This page is for moderators.')).toBeVisible();
});

test('Function: AccessAuditPage — a founder opens the access log from the hub', async ({
  page,
}) => {
  await seedTeamViewer(page, 'founder');
  await page.route('**/team/audit*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TEAM_AUDIT),
    });
  });
  await page.goto('/moderate');
  await page.getByRole('link', { name: 'Access log' }).click();
  await expect(page.getByRole('heading', { name: 'Access log' })).toBeVisible();
  await expect(page.getByText('Wallet data').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mo' }).first()).toHaveAttribute(
    'href',
    '/members/acc_mod',
  );
});

test('Function: AccessAuditScreen — a moderator sees why the log is closed', async ({ page }) => {
  await seedTeamViewer(page, 'moderator');
  await page.route('**/team/audit*', async (route) => {
    await route.fulfill({ status: 403, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/moderate/audit');
  await expect(page.getByText('This page is for founders and initiators.')).toBeVisible();
});

test('Function: fetchTeamAudit — empty and failed log', async ({ page }) => {
  await seedTeamViewer(page, 'initiator');
  let fail = true;
  await page.route('**/team/audit*', async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ entries: [], nextCursor: null }),
    });
  });
  await page.goto('/moderate/audit');
  await expect(page.getByText('Could not load the access log. Please try again.')).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Nobody has opened member data yet.')).toBeVisible();
});

test('team reads send only the session, and the browser keeps none of the data', async ({
  page,
}) => {
  await seedTeamViewer(page, 'founder');
  const sent: PlaywrightRequest[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/team/')) {
      sent.push(request);
    }
  });
  await page.route('**/team/members?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TEAM_MEMBERS),
    });
  });
  await page.route('**/team/audit*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TEAM_AUDIT),
    });
  });
  await routeTeamMemberData(page);
  await page.goto('/moderate/members');
  await page.getByLabel('Name or username').fill('ada');
  await page.getByRole('link', { name: /Ada Lovelace/ }).click();
  await expect(page.getByText('Spent in the community')).toBeVisible();
  await page.getByRole('button', { name: 'Activity' }).click();
  await expect(page.getByText('Opened a page')).toBeVisible();
  await page.goto('/moderate/audit');
  await expect(page.getByRole('list', { name: 'Access log entries' })).toBeVisible();
  const kind = (request: PlaywrightRequest): string => {
    const path = new URL(request.url()).pathname;
    if (path === '/team/members') return 'search';
    if (path === '/team/audit') return 'audit';
    return path.endsWith('/wallet') ? 'wallet' : path.endsWith('/events') ? 'events' : path;
  };
  await expect
    .poll(() => [...new Set(sent.map(kind))].sort())
    .toEqual(['audit', 'events', 'search', 'wallet']);
  for (const request of sent) {
    expect(request.method()).toBe('GET');
    expect(request.postData()).toBeNull();
    expect(request.headers()['authorization']).toBe('Bearer sess-e2e');
  }
  const stored = await page.evaluate(() => {
    const keys = (storage: Storage): string[] =>
      Array.from({ length: storage.length }, (_, index) => storage.key(index) ?? '');
    const values = (storage: Storage): string =>
      keys(storage)
        .map((key) => storage.getItem(key) ?? '')
        .join(' ');
    return `${values(localStorage)} ${values(sessionStorage)} ${document.cookie}`;
  });
  for (const text of ['balanceSats', 'pay_1', 'Thanks for the bread', 'acc_mod', 'payment_sent']) {
    expect(stored).not.toContain(text);
  }
});

test('Function: proxyTeamMembersGet — member search without a session is 401', async ({
  request,
}) => {
  expect((await request.get('/team/members?query=ada')).status()).toBe(401);
});

test('Function: proxyTeamMemberWalletGet — wallet data without a session is 401', async ({
  request,
}) => {
  expect((await request.get('/team/members/acc_ada/wallet?period=30')).status()).toBe(401);
});

test('Function: proxyTeamMemberEventsGet — activity without a session is 401', async ({
  request,
}) => {
  expect((await request.get('/team/members/acc_ada/events')).status()).toBe(401);
});

test('Function: proxyTeamAuditGet — the access log without a session is 401', async ({
  request,
}) => {
  expect((await request.get('/team/audit')).status()).toBe(401);
});
