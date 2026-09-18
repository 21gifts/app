import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const ID = '11111111-1111-4111-8111-111111111111';

const PUBLIC_NOTE = {
  id: ID,
  name: 'Ada',
  text: 'Hello from Ada',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 0,
  payable: false,
  hasPhoto: false,
  role: 'basis',
  replyCount: 0,
};

const RIANA_ID = '444d655b-73a4-475a-b5fc-f7e36210e82e';
const REPLY_ID = '322f9dea-4a76-5168-91b8-430432e5f90b';
const QUOTED_ID = 'd8cd22dd-d5c4-46a8-82ed-38b4d2f551ec';
const QUOTED_NOTE_URL = 'https://21.gifts/messages/d8cd22dd-d5c4-46a8-82ed-38b4d2f551ec';

const rianaNote = {
  id: RIANA_ID,
  name: 'Riana Rosello',
  text: 'Good morning everyone especially to our sponsor. Another day has come, and I want to sincerely thank you for your continued kindness and generosity to our family. Your Bitcoin support means so much to us because it helps us buy food, rice, and provide school allowance for my  children. As a mother, I am deeply grateful for your help, especially during times when we are struggling. Thank you for being a blessing to our family and for always remembering us.God bless you and thank you.',
  createdAt: '2026-09-16T20:12:43.660Z',
  sats: 21,
  payable: true,
  hasPhoto: false,
  role: 'verified',
  replyCount: 1,
};

const cyrillReply = {
  id: REPLY_ID,
  parentId: RIANA_ID,
  name: 'Cyrill',
  text: 'just for information: https://21.gifts/messages/d8cd22dd-d5c4-46a8-82ed-38b4d2f551ec',
  createdAt: '2026-09-16T20:26:17.290Z',
  sats: 21,
  payable: false,
  hasPhoto: false,
  role: 'founder',
  replyCount: 0,
};

const quotedNote = {
  id: QUOTED_ID,
  name: 'Cyrill',
  text: 'A Quick Technical Note\n\nThe system responsible for automatic payouts operates on the UTC 00:00 standard. This means a new day always begins at 00:00 UTC. For our friends in the Philippines, that is 08:00 PST.',
  createdAt: '2026-09-16T09:50:23.750Z',
  sats: 43,
  payable: true,
  hasPhoto: true,
  role: 'founder',
  replyCount: 0,
};

test('e2e:check dynamic path token for /messages/[id]', async ({ page }) => {
  await page.goto('/messages/[id]');
});

test('signed-in inbox heading is Messages', async ({ page }) => {
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
        role: 'basis',
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
  await page.route(/\/conversations$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [
          {
            id: 'conv-21',
            kind: 'member_platform',
            name: '21.gifts',
            lastText: 'Hello team',
            lastAt: '2026-08-28T12:00:00.000Z',
            lastFromMe: false,
            lastSats: 0,
          },
        ],
      }),
    });
  });
  await page.goto('/messages');
  await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Conversation type' })).toHaveCount(0);
  await expect(
    page.getByRole('list', { name: 'Conversations' }).getByText('21.gifts'),
  ).toBeVisible();
});

test('inbox lastFromMe preview shows You: Hello team', async ({ page }) => {
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
        role: 'basis',
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
  // Members see the unfiltered inbound list; lastFromMe on a member_member row is visible.
  await page.route(/\/conversations$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [
          {
            id: 'conv-bob',
            kind: 'member_member',
            name: 'Bob',
            lastText: 'Hello team',
            lastAt: '2026-08-28T12:00:00.000Z',
            lastFromMe: true,
            lastSats: 0,
          },
        ],
      }),
    });
  });
  await page.goto('/messages');
  await expect(page.getByText('You: Hello team')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Conversation type' })).toHaveCount(0);
});

test('inbox empty shows No private messages yet.', async ({ page }) => {
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
        role: 'basis',
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
  await page.route(/\/conversations$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conversations: [] }),
    });
  });
  await page.goto('/messages');
  await expect(page.getByText('No private messages yet.')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Conversation type' })).toHaveCount(0);
});

test('inbox loading', async ({ page }) => {
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
        role: 'basis',
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
  await page.route(/\/conversations$/, async () => {
    /* hang — inbox loading */
  });
  await page.goto('/messages');
  await expect(page.locator('p.text-center', { hasText: 'Loading…' })).toBeVisible();
});

test('inbox error shows Could not load messages. Please try again.', async ({ page }) => {
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
        role: 'basis',
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
  await page.route(/\/conversations$/, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Platform account is not configured' }),
    });
  });
  await page.goto('/messages');
  await expect(page.getByText('Could not load messages. Please try again.')).toBeVisible();
});

test('inbox thread shows Hello team', async ({ page }) => {
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
        role: 'basis',
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
  await page.route(/\/conversations$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [
          {
            id: 'conv-21',
            kind: 'member_platform',
            name: '21.gifts',
            lastText: 'Hello team',
            lastAt: '2026-08-28T12:00:00.000Z',
            lastFromMe: false,
            lastSats: 0,
          },
        ],
      }),
    });
  });
  await page.route(/\/conversations\/conv-21$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm1',
            name: 'Ada',
            text: 'Hello team',
            createdAt: '2026-08-28T12:00:00.000Z',
            fromMe: false,
            sats: 0,
          },
        ],
      }),
    });
  });
  await page.goto('/messages?c=conv-21');
  await expect(page.getByText('Hello team')).toBeVisible();
});

test('inbox gift-only last preview shows ₿21', async ({ page }) => {
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
        role: 'basis',
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
  await page.route(/\/conversations$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [
          {
            id: 'conv-bob',
            kind: 'member_member',
            name: 'Bob',
            lastText: '',
            lastAt: '2026-08-28T12:00:00.000Z',
            lastFromMe: true,
            lastSats: 21,
          },
        ],
      }),
    });
  });
  await page.goto('/messages');
  await expect(page.getByText('₿21')).toBeVisible();
});

test('opening an unread thread POSTs /conversations/:id/read', async ({ page }) => {
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
        role: 'basis',
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
  const readPosts: string[] = [];
  await page.route(/\/conversations\/conv-21\/read$/, async (route) => {
    expect(route.request().method()).toBe('POST');
    readPosts.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route(/\/conversations$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [
          {
            id: 'conv-21',
            kind: 'member_platform',
            name: '21.gifts',
            lastText: 'Hello team',
            lastAt: '2026-08-28T12:00:00.000Z',
            lastFromMe: false,
            lastSats: 0,
            unread: true,
          },
        ],
        unreadCount: 1,
      }),
    });
  });
  await page.route(/\/conversations\/conv-21$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm1',
            name: 'Ada',
            text: 'Hello team',
            createdAt: '2026-08-28T12:00:00.000Z',
            fromMe: false,
            sats: 0,
          },
        ],
      }),
    });
  });
  await page.goto('/messages');
  await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
  await expect(page.getByRole('button', { name: '21.gifts, Unread' })).toBeVisible();
  expect(readPosts).toEqual([]);
  const readPost = page.waitForRequest(
    (req) => req.method() === 'POST' && req.url().includes('/conversations/conv-21/read'),
  );
  await page.getByRole('button', { name: '21.gifts, Unread' }).click();
  await readPost;
  await expect(page.getByRole('heading', { name: '21.gifts' })).toBeVisible();
  expect(readPosts).toHaveLength(1);
});

test('inbox gift-only bubble shows send ₿21', async ({ page }) => {
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
        role: 'basis',
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
  await page.route(/\/conversations$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [
          {
            id: 'conv-21',
            kind: 'member_platform',
            name: '21.gifts',
            lastText: 'Hello team',
            lastAt: '2026-08-28T12:00:00.000Z',
            lastFromMe: false,
            lastSats: 0,
          },
        ],
      }),
    });
  });
  await page.route(/\/conversations\/conv-21$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm1',
            name: '21.gifts',
            text: 'Hello team',
            createdAt: '2026-08-28T12:00:00.000Z',
            fromMe: false,
            sats: 0,
          },
          {
            id: 'm-gift',
            name: 'Ada',
            text: '',
            createdAt: '2026-08-28T12:05:00.000Z',
            fromMe: true,
            sats: 21,
          },
        ],
      }),
    });
  });
  await page.goto('/messages?c=conv-21');
  await expect(page.getByText('send ₿21')).toBeVisible();
});

test('inbox inbound text+sats shows Hi and ₿21', async ({ page }) => {
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
        role: 'basis',
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
  await page.route(/\/conversations$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [
          {
            id: 'conv-21',
            kind: 'member_platform',
            name: '21.gifts',
            lastText: 'Hi',
            lastAt: '2026-08-28T12:00:00.000Z',
            lastFromMe: false,
            lastSats: 21,
          },
        ],
      }),
    });
  });
  await page.route(/\/conversations\/conv-21$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm1',
            name: '21.gifts',
            text: 'Hi',
            createdAt: '2026-08-28T12:00:00.000Z',
            fromMe: false,
            sats: 21,
          },
        ],
      }),
    });
  });
  await page.goto('/messages?c=conv-21');
  await expect(page.getByText('Hi')).toBeVisible();
  await expect(page.getByText('₿21')).toBeVisible();
});

test('inbox pay sheet shows Pay with Wallet of Satoshi', async ({ page }) => {
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
        role: 'basis',
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
  await page.route(/\/conversations$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [
          {
            id: 'conv-21',
            kind: 'member_platform',
            name: '21.gifts',
            lastText: 'Hello team',
            lastAt: '2026-08-28T12:00:00.000Z',
            lastFromMe: false,
            lastSats: 0,
          },
        ],
      }),
    });
  });
  await page.route(/\/conversations\/conv-21$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm1',
            name: '21.gifts',
            text: 'Hello team',
            createdAt: '2026-08-28T12:00:00.000Z',
            fromMe: false,
            sats: 0,
          },
        ],
      }),
    });
  });
  await page.route(/\/conversations\/conv-21\/invoice$/, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pr: 'lnbc21n1test', amountSats: 21, messageId: 'gift-1' }),
    });
  });
  await page.route(/sinceMessageId=/, async () => {
    /* hang — keep the pay sheet open */
  });
  await page.goto('/messages?c=conv-21');
  await expect(page.getByText('Hello team')).toBeVisible();
  await page.getByLabel('Amount').fill('21');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toBeVisible();
});

test('public message default shows Hello from Ada', async ({ page }) => {
  await page.route(`**/public-messages/${ID}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(`**/public-messages/${ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PUBLIC_NOTE),
    });
  });
  await page.goto(`/messages/${ID}`);
  await expect(page.getByText('Hello from Ada')).toBeVisible();
  await expect(page.getByText('Ada', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
});

test('public message missing shows not-found copy', async ({ page }) => {
  await page.goto('/messages/not-a-uuid');
  await expect(page.getByText('This profile could not be found.')).toBeVisible();
});

test('public message loading shows Loading…', async ({ page }) => {
  await page.route(`**/public-messages/${ID}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(`**/public-messages/${ID}`, async () => {
    // never fulfill
  });
  await page.goto(`/messages/${ID}`);
  await expect(page.getByText('Loading…')).toBeVisible();
});

test('public message error shows Try again', async ({ page }) => {
  await page.route(`**/public-messages/${ID}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(`**/public-messages/${ID}`, async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'boom' }),
    });
  });
  await page.goto(`/messages/${ID}`);
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('quoted public note hides the raw URL and opens the linked note', async ({ page }) => {
  await page.route(`**/public-messages/${RIANA_ID}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [cyrillReply] }),
    });
  });
  await page.route(`**/public-messages/${RIANA_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(rianaNote),
    });
  });
  await page.route(`**/public-messages/${QUOTED_ID}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(`**/public-messages/${QUOTED_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(quotedNote),
    });
  });
  await page.route(`**/messages/${QUOTED_ID}/photo`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      body: fs.readFileSync(path.join(process.cwd(), 'e2e/fixtures/technical-note.jpg')),
    });
  });
  await page.goto(`/messages/${RIANA_ID}`);
  await expect(page.getByText(QUOTED_NOTE_URL)).not.toBeVisible();
  await expect(page.getByText('A Quick Technical Note')).toBeVisible();
  await page.getByRole('link', { name: 'Open linked note from Cyrill' }).click();
  await expect(page).toHaveURL(/\/messages\/d8cd22dd-d5c4-46a8-82ed-38b4d2f551ec/);
});

test('welcome visitor reply shows a badge and keeps the url as text', async ({ page }) => {
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
        role: 'basis',
        name: 'Ada',
        location: null,
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-ada',
            name: 'Ada',
            text: 'Thank you both — that helps.',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 5,
            payable: true,
            hasPhoto: false,
            role: 'moderator',
          },
        ],
      }),
    });
  });
  await page.route('**/forum/messages/**/replies', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'r-nostr-gift',
            name: 'Robin',
            via: 'nostr',
            text: '',
            createdAt: '2026-08-28T12:03:00.000Z',
            sats: 69,
            payable: false,
            hasPhoto: false,
          },
          {
            id: 'r-nostr-text',
            name: 'Robin',
            via: 'nostr',
            text: 'Greetings! https://example.com/hello',
            createdAt: '2026-08-28T12:04:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: false,
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await page.getByText('Thank you both — that helps.').click();
  await expect(page.getByRole('button', { name: 'Visitor' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Visitor' }).first().click();
  await expect(
    page.getByText(
      'Wrote from another app, not from a 21.gifts account. Shown here because this person sent bitcoin to a post.',
    ),
  ).toBeVisible();
  await expect(page.getByText('https://example.com/hello')).toBeVisible();
  await expect(page.getByRole('link', { name: /example\.com/ })).toHaveCount(0);
});

test('unsigned permalink visitor reply is a span and keeps the url as text', async ({ page }) => {
  const parentId = ID;
  await page.route(`**/public-messages/${parentId}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
            parentId,
            name: 'Robin',
            via: 'nostr',
            text: '',
            createdAt: '2026-08-28T12:03:00.000Z',
            sats: 69,
            payable: false,
            hasPhoto: false,
          },
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
            parentId,
            name: 'Robin',
            via: 'nostr',
            text: 'Greetings! https://example.com/hello',
            createdAt: '2026-08-28T12:04:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: false,
          },
        ],
      }),
    });
  });
  await page.route(`**/public-messages/${parentId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...PUBLIC_NOTE,
        replyCount: 2,
      }),
    });
  });
  await page.goto(`/messages/${parentId}`);
  await expect(page.getByText('Hello from Ada')).toBeVisible();
  await expect(page.getByText('Visitor', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Visitor' })).toHaveCount(0);
  await expect(page.getByText('https://example.com/hello')).toBeVisible();
  await expect(page.getByRole('link', { name: /example\.com/ })).toHaveCount(0);
});
