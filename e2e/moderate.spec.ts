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
  role: 'basis' | 'verified' | 'moderator' | 'founder' = 'basis',
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
  await expect(page.getByText('Tools for moderators.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Hidden notes' })).toHaveAttribute(
    'href',
    '/moderate/hidden',
  );
  await expect(page.getByRole('link', { name: 'Moderators' })).toHaveAttribute(
    'href',
    '/moderate/group',
  );
  await expect(page.getByText('Hidden by Ada')).toHaveCount(0);
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('link', { name: 'Moderation' })).toHaveAttribute('href', '/moderate');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Hidden notes' }).click();
  await expect(page.getByRole('heading', { name: 'Hidden notes' })).toBeVisible();
  await expect(page.getByText('Hidden by Ada')).toBeVisible();
});

test('Function: ModerateScreen — payout goal expands', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.clock.install({ time: new Date('2026-09-20T12:00:00.000Z') });
  await page.route('**/gifts/stats', async (route) => {
    const start = Date.parse('2026-08-22T00:00:00.000Z');
    const spendOverTime = Array.from({ length: 30 }, (_, i) => {
      const day = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      const giftCount = day === '2026-09-19' ? 12 : 0;
      return {
        day,
        giftCount,
        sats: 0,
        cumulativeSats: 0,
        btc: '0.00000000',
        cumulativeBtc: '0.00000000',
        usd: '0.00',
        cumulativeUsd: '0.00',
        chf: '0.00',
        eur: '0.00',
        php: '0.00',
        cumulativeChf: '0.00',
        cumulativeEur: '0.00',
        cumulativePhp: '0.00',
      };
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalSats: 0,
        totalBtc: '0.00000000',
        totalUsd: '0.00',
        totalChf: '0.00',
        totalEur: '0.00',
        totalPhp: '0.00',
        giftCount: 12,
        recipientCount: 0,
        firstPaidAt: '2026-08-22T00:00:00.000Z',
        lastPaidAt: '2026-09-20T00:00:00.000Z',
        spendOverTime,
        byRecipient: [],
        byMonth: [],
        fx: {
          quote: 'BTC-USD',
          dayBasis: 'utc',
          source: 'coinbase-exchange-daily-close',
          quotes: [{ code: 'USD', pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' }],
        },
      }),
    });
  });
  await page.goto('/moderate');
  await expect(page.getByText('12%')).toBeVisible();
  await page.getByRole('button', { name: /Goal/ }).click();
  await expect(page.getByText('Official payouts by UTC day')).toBeVisible();
});

test('Function: ModerateScreen — payout goal loading', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.route('**/gifts/stats', () => new Promise(() => undefined));
  await page.goto('/moderate');
  await expect(
    page.getByRole('group', { name: 'Daily payout goal' }).getByText('Loading…'),
  ).toBeVisible();
});

test('Function: ModerateScreen — payout goal error', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.route('**/gifts/stats', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'unavailable' }),
    });
  });
  await page.goto('/moderate');
  await expect(page.getByText('Could not load payouts. Please try again.')).toBeVisible();
});

test('Function: ModerateScreen — basis visitors see the forbidden copy', async ({ page }) => {
  await seedAdaSession(page, 'basis');
  await page.goto('/moderate');
  await expect(page.getByRole('heading', { name: 'Moderation' })).toBeVisible();
  await expect(page.getByText('This page is for moderators.')).toBeVisible();
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
  await expect(page.getByText('This page is for moderators.')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Hidden notes' })).toHaveCount(0);
});

test('Function: listHiddenMessages — staff list shows a hidden note', async ({ page }) => {
  await seedAdaSession(page, 'moderator');
  await stubHiddenList(page);
  await page.goto('/moderate/hidden');
  await expect(page.getByText('Hidden note', { exact: true })).toBeVisible();
  await expect(page.getByText('Hidden by Ada')).toBeVisible();
});

test('Function: HiddenNotesScreen — an external row shows the badge, a member row does not', async ({
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
            text: 'Hidden external note',
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
  await expect(page.getByText('Hidden external note', { exact: true })).toBeVisible();
  const externalRow = page.locator('li', { hasText: 'Robin' });
  await expect(externalRow.getByText('External', { exact: true })).toBeVisible();
  const memberRow = page.locator('li', { hasText: 'Bob' });
  await expect(memberRow.getByText(/external/i)).toHaveCount(0);
});

test('Function: proxyMessagesHiddenGet — GET /forum/messages/hidden without bearer is 401', async ({
  request,
}) => {
  expect((await request.get('/forum/messages/hidden')).status()).toBe(401);
});

const GROUP = {
  id: 'conv-mod',
  kind: 'moderator_group',
  name: 'Moderators',
  lastText: 'Hello mods',
  lastAt: '2026-08-28T15:00:00.000Z',
  lastFromMe: false,
  lastSats: 0,
};

async function stubModeratorGroup(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/conversations/moderator-group', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conversation: GROUP }),
    });
  });
  await page.route('**/conversations/conv-mod', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm1',
            name: 'Ada',
            text: 'Hello mods',
            createdAt: '2026-08-28T15:00:00.000Z',
            fromMe: false,
            sats: 0,
          },
        ],
      }),
    });
  });
}

async function stubModeratorGroupStipend(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/conversations/moderator-group', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conversation: GROUP }),
    });
  });
  await page.route('**/conversations/conv-mod', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm1',
            name: 'Ada',
            text: 'Great work today, moderators!',
            createdAt: '2026-08-28T15:00:00.000Z',
            fromMe: false,
            sats: 0,
          },
          {
            id: 'g1',
            name: 'Rose Otero',
            text: '',
            createdAt: '2026-08-28T15:01:00.000Z',
            fromMe: false,
            sats: 6158,
            giftFor: 'm1',
          },
        ],
      }),
    });
  });
  await page.route('**/gifts/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalSats: 6158,
        totalBtc: '0.00006158',
        totalUsd: '5.00',
        totalChf: '4.00',
        totalEur: '4.50',
        totalPhp: '280.00',
        giftCount: 1,
        recipientCount: 1,
        firstPaidAt: '2026-08-28T15:01:00.000Z',
        lastPaidAt: '2026-08-28T15:01:00.000Z',
        spendOverTime: [
          {
            day: '2026-08-28',
            sats: 6158,
            cumulativeSats: 6158,
            btc: '0.00006158',
            cumulativeBtc: '0.00006158',
            usd: '5.00',
            cumulativeUsd: '5.00',
            chf: '4.00',
            eur: '4.50',
            php: '280.00',
            cumulativeChf: '4.00',
            cumulativeEur: '4.50',
            cumulativePhp: '280.00',
          },
        ],
        byRecipient: [],
        byMonth: [],
        fx: {
          quote: 'BTC-USD',
          dayBasis: 'utc',
          source: 'coinbase-exchange-daily-close',
          quotes: [{ code: 'USD', pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' }],
        },
      }),
    });
  });
}

test('moderators see the Moderators hub link', async ({ page }) => {
  await seedAdaSession(page, 'moderator');
  await page.goto('/moderate');
  await expect(page.getByRole('link', { name: 'Moderators' })).toHaveAttribute(
    'href',
    '/moderate/group',
  );
});

test('moderators see the Moderators hub unread count', async ({ page }) => {
  await seedAdaSession(page, 'moderator');
  await page.route('**/conversations/moderator-group', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conversation: { ...GROUP, unread: true } }),
    });
  });
  await page.goto('/moderate');
  await expect(page.getByRole('link', { name: 'Moderators, 1 unread' })).toHaveAttribute(
    'href',
    '/moderate/group',
  );
});

test('opening the unread Moderators room POSTs /conversations/:id/read', async ({ page }) => {
  await seedAdaSession(page, 'moderator');
  const readPosts: string[] = [];
  await page.route(/\/conversations\/conv-mod\/read$/, async (route) => {
    expect(route.request().method()).toBe('POST');
    readPosts.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route(/\/conversations\/moderator-group$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conversation: { ...GROUP, unread: true } }),
    });
  });
  await page.route(/\/conversations\/conv-mod$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm1',
            name: 'Ada',
            text: 'Hello mods',
            createdAt: '2026-08-28T15:00:00.000Z',
            fromMe: false,
            sats: 0,
          },
        ],
      }),
    });
  });
  const readPost = page.waitForRequest(
    (req) => req.method() === 'POST' && /\/conversations\/conv-mod\/read$/.test(req.url()),
  );
  await page.goto('/moderate/group');
  await expect(page.getByText('Hello mods')).toBeVisible();
  await readPost;
  expect(readPosts).toHaveLength(1);
});

test('Function: ModeratorGroupPage — moderators see the group thread', async ({ page }) => {
  await seedAdaSession(page, 'moderator');
  await stubModeratorGroup(page);
  await page.goto('/moderate/group');
  await expect(page.getByText('Hello mods')).toBeVisible();
});

test('Function: ModeratorGroupPage — founders see the group thread', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await stubModeratorGroup(page);
  await page.goto('/moderate/group');
  await expect(page.getByText('Hello mods')).toBeVisible();
});

test('Function: ModeratorGroupScreen — basis visitors see the forbidden copy', async ({ page }) => {
  await seedAdaSession(page, 'basis');
  await page.goto('/moderate/group');
  await expect(page.getByText('This room is for moderators.')).toBeVisible();
});

test('Function: roleAtLeast — a founder opens the Moderators tool from the hub', async ({
  page,
}) => {
  await seedAdaSession(page, 'founder');
  await stubModeratorGroup(page);
  await page.goto('/moderate');
  await page.getByRole('link', { name: 'Moderators' }).click();
  await expect(page.getByText('Hello mods')).toBeVisible();
});

test('Function: roleRank — a verified member ranks below the staff room', async ({ page }) => {
  await seedAdaSession(page, 'verified');
  await page.goto('/moderate/group');
  await expect(page.getByText('This room is for moderators.')).toBeVisible();
});

test('Function: fetchModeratorGroup — moderators see Hello mods', async ({ page }) => {
  await seedAdaSession(page, 'moderator');
  await stubModeratorGroup(page);
  await page.goto('/moderate/group');
  await expect(page.getByText('Hello mods')).toBeVisible();
});

test('Function: proxyModeratorGroupGet — GET /conversations/moderator-group without bearer is 401', async ({
  request,
}) => {
  expect((await request.get('/conversations/moderator-group')).status()).toBe(401);
});

test('Function: groupThreadGifts — the moderator group nests a stipend under its message', async ({
  page,
}) => {
  await seedAdaSession(page, 'moderator');
  await stubModeratorGroupStipend(page);
  await page.goto('/moderate/group');
  await expect(page.getByText('Great work today, moderators!')).toBeVisible();
  const note = page.getByRole('note', { name: /Rose Otero/ });
  await expect(note).toBeVisible();
  await expect(note).toHaveAttribute('data-gift-for', 'm1');
  await expect(note).toHaveAttribute('data-message-id', 'g1');
});

test('Function: preferredFiatSuffix — the nested stipend line shows a fiat suffix', async ({
  page,
}) => {
  await seedAdaSession(page, 'moderator');
  await stubModeratorGroupStipend(page);
  await page.goto('/moderate/group');
  const note = page.getByRole('note', { name: /Rose Otero/ });
  await expect(note).toContainText('$5.00');
});

test('Function: useLatestRateDay — the moderator group thread loads a live fiat rate', async ({
  page,
}) => {
  await seedAdaSession(page, 'moderator');
  await stubModeratorGroupStipend(page);
  const statsRequest = page.waitForRequest((req) => /\/gifts\/stats/.test(req.url()));
  await page.goto('/moderate/group');
  await statsRequest;
  await expect(page.getByRole('note', { name: /Rose Otero/ })).toContainText('$5.00');
});
