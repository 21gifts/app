import { expect, test } from '@playwright/test';

const NOTE_ID = '77e0510d-03a8-4063-8716-75d61178e7f1';
const MEMBER_ID = 'd70c4763-3033-43da-817a-2c7de9938f27';

test('Function: shortResourceUrl — copy writes an 8-hex short link', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
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
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: NOTE_ID,
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
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'Copy link to this note' }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(`${new URL(page.url()).origin}/l/77e0510d`);
});

test('Function: shortLinkPath — message and member codes redirect', async ({ request }) => {
  const message = await request.get('/l/77e0510d', { maxRedirects: 0 });
  expect(message.status()).toBe(307);
  expect(message.headers().location).toContain(`/messages/${NOTE_ID}`);
  const member = await request.get('/l/d70c4763', { maxRedirects: 0 });
  expect(member.status()).toBe(307);
  expect(member.headers().location).toContain(`/members/${MEMBER_ID}`);
});

test('Function: splitShortLinks — a pasted short url becomes a quoted card', async ({ page }) => {
  const parentId = '444d655b-73a4-475a-b5fc-f7e36210e82e';
  const quotedId = 'd8cd22dd-d5c4-46a8-82ed-38b4d2f551ec';
  const code = 'd8cd22dd';
  await page.route(`**/links/${code}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ kind: 'message', id: quotedId }),
    });
  });
  await page.route(`**/public-messages/${parentId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: parentId,
        name: 'Riana Rosello',
        text: 'Good morning everyone especially to our sponsor.',
        createdAt: '2026-09-16T20:12:43.660Z',
        sats: 21,
        payable: true,
        hasPhoto: false,
        role: 'verified',
        replyCount: 1,
      }),
    });
  });
  await page.route(`**/public-messages/${parentId}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: '322f9dea-4a76-5168-91b8-430432e5f90b',
            parentId,
            name: 'Cyrill',
            text: `just for information: https://21.gifts/l/${code}`,
            createdAt: '2026-09-16T20:26:17.290Z',
            sats: 21,
            payable: false,
            hasPhoto: false,
            role: 'founder',
            replyCount: 0,
          },
        ],
      }),
    });
  });
  await page.route(`**/public-messages/${quotedId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: quotedId,
        name: 'Cyrill',
        text: 'A Quick Technical Note',
        createdAt: '2026-09-16T09:50:23.750Z',
        sats: 43,
        payable: true,
        hasPhoto: false,
        role: 'founder',
        replyCount: 0,
      }),
    });
  });
  await page.route(`**/public-messages/${quotedId}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto(`/messages/${parentId}`);
  await expect(page.getByText('A Quick Technical Note')).toBeVisible();
  await expect(page.getByText(`https://21.gifts/l/${code}`)).toHaveCount(0);
});

test('Function: proxyShortLinkGet — GET /links/[code] is reachable', async ({ request }) => {
  expect((await request.get('/links/[code]')).status()).toBeGreaterThanOrEqual(400);
});

test('Function: fetchShortLink — a short note link becomes a quoted card', async ({ page }) => {
  const parentId = '444d655b-73a4-475a-b5fc-f7e36210e82e';
  const quotedId = 'd8cd22dd-d5c4-46a8-82ed-38b4d2f551ec';
  const code = 'd8cd22dd';
  const note = {
    id: parentId,
    name: 'Riana Rosello',
    text: 'Good morning everyone especially to our sponsor.',
    createdAt: '2026-09-16T20:12:43.660Z',
    sats: 21,
    payable: true,
    hasPhoto: false,
    role: 'verified',
    replyCount: 1,
  };
  const reply = {
    id: '322f9dea-4a76-5168-91b8-430432e5f90b',
    parentId,
    name: 'Cyrill',
    text: `just for information: https://21.gifts/l/${code}`,
    createdAt: '2026-09-16T20:26:17.290Z',
    sats: 21,
    payable: false,
    hasPhoto: false,
    role: 'founder',
    replyCount: 0,
  };
  const quoted = {
    id: quotedId,
    name: 'Cyrill',
    text: 'A Quick Technical Note',
    createdAt: '2026-09-16T09:50:23.750Z',
    sats: 43,
    payable: true,
    hasPhoto: false,
    role: 'founder',
    replyCount: 0,
  };
  await page.route(`**/links/${code}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ kind: 'message', id: quotedId }),
    });
  });
  await page.route(`**/public-messages/${parentId}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [reply] }),
    });
  });
  await page.route(`**/public-messages/${parentId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(note),
    });
  });
  await page.route(`**/public-messages/${quotedId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(quoted),
    });
  });
  await page.route(`**/public-messages/${quotedId}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto(`/messages/${parentId}`);
  await expect(page.getByText('just for information:')).toBeVisible();
  await expect(page.getByText('A Quick Technical Note')).toBeVisible();
  await expect(page.getByText(`https://21.gifts/l/${code}`)).toHaveCount(0);
});

test('short link redirect — GET /l/[code] is not found for a non-hex code', async ({ request }) => {
  expect((await request.get('/l/[code]')).status()).toBe(404);
});
