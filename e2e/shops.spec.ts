import { expect, test } from '@playwright/test';

const E2E_ACCOUNT = {
  id: 'acc_e2e',
  linkingKey: `02${'a'.repeat(62)}`,
  role: 'basis' as const,
  name: 'Ada',
  location: null,
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  setup: null,
  missing: [],
};

const SHOP_NOTE = {
  id: 'm-shop',
  name: 'Ada',
  text: 'Cafe Luna\n\n#21GiftsShop',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 5,
  payable: true,
  hasPhoto: false,
  role: 'basis',
};

const LIVING_ROOM_NOTE = {
  id: 'm-ada',
  name: 'Ada',
  text: 'Hello from Ada',
  createdAt: '2026-08-28T11:00:00.000Z',
  sats: 5,
  payable: true,
  hasPhoto: false,
  role: 'basis',
};

async function seedSignedIn(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(E2E_ACCOUNT),
    });
  });
}

async function fulfillForumMessages(
  page: import('@playwright/test').Page,
  messages: unknown[],
  status = 200,
): Promise<void> {
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ messages }),
    });
  });
}

async function seedShopList(page: import('@playwright/test').Page): Promise<void> {
  await seedSignedIn(page);
  await fulfillForumMessages(page, [SHOP_NOTE, LIVING_ROOM_NOTE]);
}

test('Function: ShopsViewSwitch — post, map, and table', async ({ page }) => {
  await seedShopList(page);
  await page.route('**/forum/messages/places', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ places: [] }),
    });
  });
  await page.goto('/shops');
  await expect(page.getByRole('button', { name: 'Add a shop' })).toBeVisible();
  await expect(page.getByLabel('Your message')).toHaveCount(0);
  await page.getByRole('button', { name: 'Map' }).click();
  await expect(page.getByText('No places yet.')).toBeVisible();
  await expect(page.getByLabel('Your message')).toHaveCount(0);
  await page.getByRole('button', { name: 'Table' }).click();
  await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
  await expect(page.getByText('Cafe Luna')).toBeVisible();
});

test('Function: ShopTable — name, place, and operator', async ({ page }) => {
  await seedSignedIn(page);
  await fulfillForumMessages(page, [
    {
      ...SHOP_NOTE,
      place: {
        lat: 14.6,
        lng: 120.98,
        label: 'Happyland',
        address: COMPLETE_SHOP_PLACE.address,
      },
      shopAccount: { id: 'acc-luna', username: 'luna', name: 'Luna' },
    },
  ]);
  await page.goto('/shops');
  await page.getByRole('button', { name: 'Table' }).click();
  await expect(page.getByRole('link', { name: 'Happyland' })).toHaveAttribute(
    'href',
    '/map?pin=m-shop',
  );
  await expect(
    page.getByRole('link', { name: 'Happyland · Bahnhofstrasse 12, 8001 Zürich, Switzerland' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: '@luna' })).toHaveAttribute(
    'href',
    '/members/acc-luna',
  );
});

test('Function: ShopsPage — heading is visible', async ({ page }) => {
  await seedShopList(page);
  await page.goto('/shops');
  await expect(page.getByRole('heading', { name: 'Shops' })).toBeVisible();
});

test('Function: ShopAddWizard — steps then summary', async ({ page }) => {
  await stubPlaceMap(page);
  await seedSignedIn(page);
  await fulfillForumMessages(page, []);
  await page.goto('/shops');
  await expect(page.getByLabel('Your message')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add a shop' }).click();
  await expect(page.getByText('1 / 5 · Photos')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('button', { name: 'Add a place' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
  await page.getByRole('button', { name: 'Add a place' }).click();
  await page.locator('.h-64').click();
  await fillShopAddress(page);
  await page.getByRole('button', { name: 'Use this place' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Shop text').fill('Fresh bread every morning.');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('21.gifts username').fill('@luna');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('5 / 5 · Summary')).toBeVisible();
  await expect(page.getByText('@luna')).toBeVisible();
  await expect(page.getByText("Kiki's Bakery")).toBeVisible();
  await expect(page.getByText('Bahnhofstrasse 12, 8001 Zürich, Switzerland')).toBeVisible();
  await expect(page.getByText('Fresh bread every morning.')).toBeVisible();
  await expect(page.locator('form').getByRole('button', { name: 'Back' })).toHaveCount(0);
  await page.locator('[data-app-chrome]').getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByText('1 / 5 · Photos')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
});

test('Function: ShopsScreen — lead is visible', async ({ page }) => {
  await seedSignedIn(page);
  await fulfillForumMessages(page, []);
  await page.goto('/shops');
  await expect(
    page.getByText(
      'Add a shop with photos, a place, text, and an optional 21.gifts user. It appears here and in the forum with a #Shop tag.',
    ),
  ).toBeVisible();
});

test('Function: isShopNote — shop note is listed', async ({ page }) => {
  await seedSignedIn(page);
  const listUrls: string[] = [];
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    listUrls.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          SHOP_NOTE,
          {
            id: 'm-shop-quiet',
            name: 'Ada',
            text: 'Quiet stall\n\n#21GiftsShop',
            createdAt: '2026-08-28T11:30:00.000Z',
            sats: 0,
            payable: true,
            hasPhoto: false,
            role: 'basis',
          },
          LIVING_ROOM_NOTE,
        ],
      }),
    });
  });
  await page.goto('/shops');
  await expect(page.getByText('Quiet stall')).toBeVisible();
  await expect(page.getByText('Cafe Luna')).toBeVisible();
  const shopLinks = page.getByRole('link', { name: '#Shop' });
  await expect(shopLinks).toHaveCount(2);
  await expect(shopLinks.nth(0)).toHaveAttribute('href', '/shops');
  await expect(shopLinks.nth(1)).toHaveAttribute('href', '/shops');
  await expect(page.getByText('Hello from Ada')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Active', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'No gifts yet', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Most popular', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Forum view' })).toHaveCount(0);
  expect(listUrls.length).toBeGreaterThan(0);
  for (const url of listUrls) {
    expect(url).toContain('mode=all');
    expect(url).toContain('hashtag=21GiftsShop');
    expect(url).not.toContain('mode=active');
  }
});

test('Function: stripShopHashtag — raw hashtag is hidden', async ({ page }) => {
  await seedShopList(page);
  await page.goto('/shops');
  await expect(page.getByText('Cafe Luna')).toBeVisible();
  await expect(page.getByText('#21GiftsShop')).toHaveCount(0);
});

test('Function: ShopsPage — shops loading', async ({ page }) => {
  await seedSignedIn(page);
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await held;
    await route.abort();
  });
  await page.goto('/shops');
  await expect(page.locator('p.text-center', { hasText: 'Loading…' })).toBeVisible();
  release();
});

test('shops empty shows the empty copy', async ({ page }) => {
  await seedSignedIn(page);
  await fulfillForumMessages(page, [LIVING_ROOM_NOTE]);
  await page.goto('/shops');
  await expect(page.getByText('No shops yet — add the first one.')).toBeVisible();
});

test('shops error shows the load failure', async ({ page }) => {
  await seedSignedIn(page);
  await fulfillForumMessages(page, [], 503);
  await page.goto('/shops');
  await expect(page.getByText('Could not load messages. Please try again.')).toBeVisible();
});

test('menu Shops opens /shops', async ({ page }) => {
  await seedSignedIn(page);
  await fulfillForumMessages(page, []);
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('link', { name: 'Shops' })).toHaveAttribute('href', '/shops');
  await page.getByRole('link', { name: 'Shops' }).click();
  await expect(page).toHaveURL(/\/shops/);
});

test('Function: ensureShopHashtag — compose appends the tag', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...E2E_ACCOUNT, role: 'verified' }),
    });
  });
  const posted = page.waitForRequest(
    (req) => req.method() === 'POST' && new URL(req.url()).pathname === '/forum/messages',
  );
  await page.route(
    (url) => new URL(url).pathname === '/forum/messages',
    async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ messages: [] }),
        });
        return;
      }
      if (method !== 'POST') {
        await route.continue();
        return;
      }
      const body = route.request().postDataJSON() as { text?: string };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...SHOP_NOTE,
          id: 'm-new-shop',
          text: typeof body.text === 'string' ? body.text : SHOP_NOTE.text,
          hasVideo: false,
          replyCount: 0,
        }),
      });
    },
  );
  await stubPlaceMap(page);
  await page.goto('/shops');
  await page.getByRole('button', { name: 'Add a shop' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Add a place' }).click();
  await page.locator('.h-64').click();
  await fillShopAddress(page);
  await page.getByRole('button', { name: 'Use this place' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Shop text').fill('Cafe Luna is open every morning.');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  const post = page.locator('form').getByRole('button', { name: 'Post', exact: true });
  await expect(post).toBeEnabled();
  await post.evaluate((element) => {
    (element as unknown as { click: () => void }).click();
  });
  const postReq = await posted;
  const parsed = postReq.postDataJSON() as { text?: string };
  expect(typeof parsed.text === 'string' ? parsed.text : '').toContain('#21GiftsShop');
});

async function seedAda(
  page: import('@playwright/test').Page,
  role: 'basis' | 'moderator' = 'basis',
): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...E2E_ACCOUNT, role }),
    });
  });
}

/**
 * Stable clickable map for the shops staff place control. Copied from the
 * visual shops helper: live tiles are not a baseline.
 */
async function stubPlaceMap(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((click: boolean) => {
    class MapShim {
      readonly el: HTMLElement;

      constructor(el: HTMLElement) {
        this.el = el;
        el.style.position = 'relative';
        el.style.setProperty('background-color', '#e7efe4', 'important');
        el.style.setProperty(
          'background-image',
          'linear-gradient(#c9d7c6 1px, transparent 1px), linear-gradient(90deg, #c9d7c6 1px, transparent 1px)',
          'important',
        );
        el.style.setProperty('background-size', '40px 40px', 'important');
        const surface = document.createElement('div');
        surface.dataset['e2eMap'] = 'surface';
        surface.style.position = 'absolute';
        surface.style.inset = '0';
        surface.style.backgroundColor = '#e7efe4';
        surface.style.backgroundImage =
          'linear-gradient(#c9d7c6 1px, transparent 1px), linear-gradient(90deg, #c9d7c6 1px, transparent 1px)';
        surface.style.backgroundSize = '40px 40px';
        el.appendChild(surface);
      }

      setCenter(): void {}

      addListener(
        event: string,
        handler: (event: { latLng: { lat: () => number; lng: () => number } }) => void,
      ): void {
        if (!click || event !== 'click') {
          return;
        }
        this.el.addEventListener('click', () => {
          handler({ latLng: { lat: () => 14.5, lng: () => 120.9 } });
        });
      }
    }
    class MarkerShim {
      constructor(opts: { map?: MapShim }) {
        const host = opts.map?.el;
        if (host === undefined) {
          return;
        }
        const pin = document.createElement('div');
        pin.dataset['e2eMap'] = 'pin';
        pin.style.position = 'absolute';
        pin.style.left = '50%';
        pin.style.top = '42%';
        pin.style.width = '16px';
        pin.style.height = '16px';
        pin.style.margin = '-8px 0 0 -8px';
        pin.style.borderRadius = '999px';
        pin.style.background = '#161616';
        pin.style.boxShadow = '0 0 0 4px #ffffff';
        host.appendChild(pin);
      }

      setPosition(): void {}

      getPosition(): null {
        return null;
      }

      addListener(): void {}
    }
    (window as unknown as { google?: unknown }).google = {
      maps: { Map: MapShim, Marker: MarkerShim },
    };
  }, true);
  await page.route('**/maps/key', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ key: 'e2e' }),
    });
  });
}

const COMPLETE_SHOP_PLACE = {
  lat: 47.3769,
  lng: 8.5417,
  label: "Kiki's Bakery",
  address: {
    street: 'Bahnhofstrasse',
    houseNumber: '12',
    postalCode: '8001',
    city: 'Zürich',
    country: 'CH',
  },
};

const STAFF_SHOP_NOTE = {
  id: 'm-staff',
  name: 'Ada',
  text: 'Cafe Luna is open every morning.\n\n#21GiftsShop',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 0,
  payable: false,
  hasPhoto: false,
  role: 'basis',
};

const STAFF_SHOP_NOTE_COMPLETE = {
  ...STAFF_SHOP_NOTE,
  place: COMPLETE_SHOP_PLACE,
};

function shopNameField(page: import('@playwright/test').Page) {
  return page.getByLabel('Shop name', { exact: true });
}

function shopAddressFields(page: import('@playwright/test').Page) {
  return page.getByTestId('shop-address-fields');
}

async function fillShopAddress(
  page: import('@playwright/test').Page,
  name = "Kiki's Bakery",
): Promise<void> {
  const address = shopAddressFields(page);
  await shopNameField(page).fill(name);
  await address.getByLabel('Street', { exact: true }).fill('Bahnhofstrasse');
  await address.getByLabel('House number', { exact: true }).fill('12');
  await address.getByLabel('Postal code', { exact: true }).fill('8001');
  await address.getByLabel('City', { exact: true }).fill('Zürich');
  await address.getByLabel('Country', { exact: true }).selectOption('CH');
}

test('Function: ShopNoteEditControl — moderator sees the pencil; basis does not', async ({
  page,
}) => {
  await seedAda(page, 'moderator');
  await fulfillForumMessages(page, [STAFF_SHOP_NOTE]);
  await page.goto('/shops');
  await expect(
    page.locator('[data-message-id="m-staff"]').getByRole('button', { name: 'Edit shop note' }),
  ).toBeVisible();

  await seedAda(page, 'basis');
  await fulfillForumMessages(page, [STAFF_SHOP_NOTE]);
  await page.goto('/shops');
  await expect(
    page.locator('[data-message-id="m-staff"]').getByRole('button', { name: 'Edit shop note' }),
  ).toHaveCount(0);
});

test('Function: fetchShopNoteEdits — opening the pencil shows who edited the note', async ({
  page,
}) => {
  await seedAda(page, 'moderator');
  await fulfillForumMessages(page, [STAFF_SHOP_NOTE]);
  await page.route(
    (url) => new URL(url).pathname.endsWith('/forum/messages/m-staff/edits'),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          edits: [
            {
              id: 'e1',
              createdAt: '2026-08-28T13:00:00.000Z',
              field: 'text',
              before: 'Old\n\n#21GiftsShop',
              after: 'Cafe Luna\n\n#21GiftsShop',
              actor: { id: 'acc', name: 'Ada', role: 'moderator' },
            },
          ],
        }),
      });
    },
  );
  await page.goto('/shops');
  const note = page.locator('[data-message-id="m-staff"]');
  await note.getByRole('button', { name: 'Edit shop note' }).click();
  await expect(note.getByRole('heading', { name: 'History' })).toBeVisible();
  await expect(note.getByText(/Ada ·/)).toBeVisible();
  await expect(note.getByText('Old → Cafe Luna')).toBeVisible();
});

test('Function: setMessageShopPhotos — moderator save replaces stills', async ({ page }) => {
  await seedAda(page, 'moderator');
  await fulfillForumMessages(page, [
    { ...STAFF_SHOP_NOTE_COMPLETE, hasPhoto: true, photoCount: 1 },
  ]);
  await page.route('**/messages/m-staff/photo*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    });
  });
  await page.route(
    (url) => new URL(url).pathname.endsWith('/forum/messages/m-staff/edits'),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ edits: [] }),
      });
    },
  );
  await page.route(
    (url) => new URL(url).pathname.endsWith('/forum/messages/m-staff/photos'),
    async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...STAFF_SHOP_NOTE_COMPLETE, hasPhoto: false, photoCount: 0 }),
      });
    },
  );
  await page.goto('/shops');
  const note = page.locator('[data-message-id="m-staff"]');
  await expect(note.getByRole('img').first()).toBeVisible();
  await note.getByRole('button', { name: 'Edit shop note' }).click();
  await note.getByRole('button', { name: 'Remove photo' }).click();
  await note.getByRole('button', { name: 'Next' }).click();
  await note.getByRole('button', { name: 'Next' }).click();
  await note.getByRole('button', { name: 'Next' }).click();
  await note.getByRole('button', { name: 'Next' }).click();
  const save = note.getByRole('button', { name: 'Save changes' });
  await expect(save).toBeEnabled();
  const patched = page.waitForRequest(
    (req) =>
      req.method() === 'PATCH' &&
      new URL(req.url()).pathname.endsWith('/forum/messages/m-staff/photos'),
  );
  await save.evaluate((element) => {
    (element as unknown as { click: () => void }).click();
  });
  const photosReq = await patched;
  expect(photosReq.postDataJSON()).toEqual({ photos: [] });
});

test('Function: setMessageShopText — moderator save updates the shop note', async ({ page }) => {
  await seedAda(page, 'moderator');
  await fulfillForumMessages(page, [STAFF_SHOP_NOTE_COMPLETE]);
  await page.route(
    (url) => new URL(url).pathname.endsWith('/forum/messages/m-staff/edits'),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ edits: [] }),
      });
    },
  );
  await page.route(
    (url) => new URL(url).pathname.endsWith('/forum/messages/m-staff/text'),
    async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue();
        return;
      }
      const body = route.request().postDataJSON() as { text?: string };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...STAFF_SHOP_NOTE,
          text: `${body.text ?? ''}\n\n#21GiftsShop`,
        }),
      });
    },
  );
  await page.goto('/shops');
  const note = page.locator('[data-message-id="m-staff"]');
  await note.getByRole('button', { name: 'Edit shop note' }).click();
  await note.getByRole('button', { name: 'Next' }).click();
  await note.getByRole('button', { name: 'Next' }).click();
  await note.getByLabel('Shop text').fill('Cafe Sol is open every morning.');
  await note.getByRole('button', { name: 'Next' }).click();
  await note.getByRole('button', { name: 'Next' }).click();
  const save = note.getByRole('button', { name: 'Save changes' });
  await expect(save).toBeEnabled();
  const patched = page.waitForRequest(
    (req) =>
      req.method() === 'PATCH' &&
      new URL(req.url()).pathname.endsWith('/forum/messages/m-staff/text'),
  );
  await save.evaluate((element) => {
    (element as unknown as { click: () => void }).click();
  });
  const textReq = await patched;
  expect(textReq.postDataJSON()).toEqual({ text: 'Cafe Sol is open every morning.' });
  await expect(note.getByText('Cafe Sol is open every morning.')).toBeVisible();
});

test('Function: ShopPlaceControl — moderator saves a pin; basis cannot edit', async ({ page }) => {
  await stubPlaceMap(page);
  await seedAda(page, 'moderator');
  await fulfillForumMessages(page, [STAFF_SHOP_NOTE]);
  await page.route(
    (url) => new URL(url).pathname.endsWith('/forum/messages/m-staff/place'),
    async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue();
        return;
      }
      const body = route.request().postDataJSON() as {
        place?: { lat: number; lng: number; label: string | null };
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...STAFF_SHOP_NOTE, place: body.place }),
      });
    },
  );
  await page.goto('/shops');
  const note = page.locator('[data-message-id="m-staff"]');
  await expect(note.getByText('Cafe Luna')).toBeVisible();
  await note.getByRole('button', { name: 'Add a place' }).click();
  await page.locator('.h-64').click();
  await fillShopAddress(page, 'Happyland');
  const patched = page.waitForRequest(
    (req) =>
      req.method() === 'PATCH' &&
      new URL(req.url()).pathname.endsWith('/forum/messages/m-staff/place'),
  );
  await page.getByRole('button', { name: 'Use this place' }).click();
  const placeReq = await patched;
  expect(placeReq.postDataJSON()).toEqual({
    place: {
      lat: 14.5,
      lng: 120.9,
      label: 'Happyland',
      address: COMPLETE_SHOP_PLACE.address,
    },
  });
  await expect(note.getByRole('link', { name: 'Happyland' })).toBeVisible();

  await seedAda(page, 'basis');
  await fulfillForumMessages(page, [
    { ...STAFF_SHOP_NOTE, place: { lat: 14.6, lng: 120.98, label: 'Happyland' } },
  ]);
  await page.goto('/shops');
  await expect(
    page.locator('[data-message-id="m-staff"]').getByRole('button', { name: 'Edit place' }),
  ).toHaveCount(0);
});

test('Function: setMessagePlace — moderator save shows the pin', async ({ page }) => {
  await stubPlaceMap(page);
  await seedAda(page, 'moderator');
  await fulfillForumMessages(page, [STAFF_SHOP_NOTE]);
  await page.route(
    (url) => new URL(url).pathname.endsWith('/forum/messages/m-staff/place'),
    async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue();
        return;
      }
      expect(route.request().headers()['authorization']?.startsWith('Bearer ')).toBe(true);
      const body = route.request().postDataJSON() as {
        place?: { lat: number; lng: number; label: string | null };
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...STAFF_SHOP_NOTE, place: body.place }),
      });
    },
  );
  await page.goto('/shops');
  const note = page.locator('[data-message-id="m-staff"]');
  await note.getByRole('button', { name: 'Add a place' }).click();
  await page.locator('.h-64').click();
  await fillShopAddress(page, 'Happyland');
  await page.getByRole('button', { name: 'Use this place' }).click();
  await expect(note.getByRole('link', { name: 'Happyland' })).toBeVisible();
});

test('Function: ShopAccountControl — moderator saves a username; basis cannot edit', async ({
  page,
}) => {
  await seedAda(page, 'moderator');
  await fulfillForumMessages(page, [STAFF_SHOP_NOTE]);
  await page.route(
    (url) => new URL(url).pathname.endsWith('/forum/messages/m-staff/shop-account'),
    async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue();
        return;
      }
      const body = route.request().postDataJSON() as { username?: string | null };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...STAFF_SHOP_NOTE,
          shopAccount: { id: 'acc-luna', username: body.username, name: 'Luna' },
        }),
      });
    },
  );
  await page.goto('/shops');
  const note = page.locator('[data-message-id="m-staff"]');
  await expect(note.getByText('Cafe Luna')).toBeVisible();
  await note.getByRole('button', { name: 'Add an account' }).click();
  await note.getByLabel('Username').fill('luna');
  const patched = page.waitForRequest(
    (req) =>
      req.method() === 'PATCH' &&
      new URL(req.url()).pathname.endsWith('/forum/messages/m-staff/shop-account'),
  );
  await note.getByRole('button', { name: 'Save account' }).click();
  const accountReq = await patched;
  expect(accountReq.postDataJSON()).toEqual({ username: 'luna' });
  expect(new URL(accountReq.url()).pathname.endsWith('/forum/messages/m-staff/shop-account')).toBe(
    true,
  );
  await expect(note.getByRole('link', { name: '@luna' })).toBeVisible();

  await seedAda(page, 'basis');
  await fulfillForumMessages(page, [
    {
      ...STAFF_SHOP_NOTE,
      shopAccount: { id: 'acc-luna', username: 'luna', name: 'Luna' },
    },
  ]);
  await page.goto('/shops');
  await expect(
    page.locator('[data-message-id="m-staff"]').getByRole('button', { name: 'Add an account' }),
  ).toHaveCount(0);
});

test('Function: setMessageShopAccount — moderator save shows the account', async ({ page }) => {
  await seedAda(page, 'moderator');
  await fulfillForumMessages(page, [STAFF_SHOP_NOTE]);
  await page.route(
    (url) => new URL(url).pathname.endsWith('/forum/messages/m-staff/shop-account'),
    async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue();
        return;
      }
      expect(route.request().headers()['authorization']?.startsWith('Bearer ')).toBe(true);
      const body = route.request().postDataJSON() as { username?: string | null };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...STAFF_SHOP_NOTE,
          shopAccount: { id: 'acc-luna', username: body.username, name: 'Luna' },
        }),
      });
    },
  );
  await page.goto('/shops');
  const note = page.locator('[data-message-id="m-staff"]');
  await note.getByRole('button', { name: 'Add an account' }).click();
  await note.getByLabel('Username').fill('luna');
  await note.getByRole('button', { name: 'Save account' }).click();
  await expect(note.getByRole('link', { name: '@luna' })).toBeVisible();
});

test('Function: ISO_COUNTRIES — country select lists Switzerland', async ({ page }) => {
  await stubPlaceMap(page);
  await seedSignedIn(page);
  await fulfillForumMessages(page, []);
  await page.goto('/shops');
  await page.getByRole('button', { name: 'Add a shop' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Add a place' }).click();
  await page.locator('.h-64').click();
  await expect(shopAddressFields(page).getByLabel('Country', { exact: true })).toContainText(
    'Switzerland',
  );
  await expect(page.getByRole('option', { name: 'Switzerland' })).toHaveAttribute('value', 'CH');
});

test('Function: countryDisplayName — confirmed pin shows Switzerland', async ({ page }) => {
  await stubPlaceMap(page);
  await seedSignedIn(page);
  await fulfillForumMessages(page, []);
  await page.goto('/shops');
  await page.getByRole('button', { name: 'Add a shop' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Add a place' }).click();
  await page.locator('.h-64').click();
  await fillShopAddress(page);
  await page.getByRole('button', { name: 'Use this place' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Shop text').fill('Fresh bread every morning.');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Bahnhofstrasse 12, 8001 Zürich, Switzerland')).toBeVisible();
});

test('Function: countryOptions — first option is Choose a country', async ({ page }) => {
  await stubPlaceMap(page);
  await seedSignedIn(page);
  await fulfillForumMessages(page, []);
  await page.goto('/shops');
  await page.getByRole('button', { name: 'Add a shop' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Add a place' }).click();
  await page.locator('.h-64').click();
  await expect(page.getByRole('option', { name: 'Choose a country' })).toHaveAttribute('value', '');
});

test('Function: shopAddressProblem — Use this place stays off without an address', async ({
  page,
}) => {
  await stubPlaceMap(page);
  await seedSignedIn(page);
  await fulfillForumMessages(page, []);
  await page.goto('/shops');
  await page.getByRole('button', { name: 'Add a shop' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Add a place' }).click();
  await page.locator('.h-64').click();
  await shopNameField(page).fill("Kiki's Bakery");
  await expect(
    page.getByText(/Fill in: street, house number, postal code, city, country/),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use this place' })).toBeDisabled();
});

test('Function: shopAddressProblems — address errors appear before confirm', async ({ page }) => {
  await stubPlaceMap(page);
  await seedSignedIn(page);
  await fulfillForumMessages(page, []);
  await page.goto('/shops');
  await page.getByRole('button', { name: 'Add a shop' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText("Add the shop's place and address.")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
  await page.getByRole('button', { name: 'Add a place' }).click();
  await page.locator('.h-64').click();
  const name = page.getByLabel('Shop name', { exact: true });
  await name.focus();
  await name.blur();
  await expect(page.getByText('Enter the shop name.')).toBeVisible();
  await name.fill('x'.repeat(81));
  await expect(page.getByText('The shop name must be at most 80 characters.')).toBeVisible();
  await name.fill("Kiki's Bakery");
  const street = page.getByLabel('Street', { exact: true });
  await street.fill('x'.repeat(121));
  await expect(page.getByText('The street must be 1–120 characters.')).toBeVisible();
  const house = page.getByLabel('House number', { exact: true });
  await house.fill('abc');
  await expect(page.getByText('Starts with a digit, for example 12 or 12a.')).toBeVisible();
  await expect(house).toHaveAttribute('aria-invalid', 'true');
  const country = page.getByLabel('Country', { exact: true });
  await country.focus();
  await country.blur();
  await expect(page.getByText('Choose a country.')).toBeVisible();
  await country.selectOption('CH');
  await page.getByLabel('Postal code', { exact: true }).fill('80');
  await expect(page.getByText('Use 4 digits for Switzerland and Liechtenstein.')).toBeVisible();
  await page.getByLabel('City', { exact: true }).fill('1234');
  await expect(page.getByText('The city must contain a letter.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use this place' })).toBeDisabled();
});

test('shop summary keeps Post disabled with an off-screen reason', async ({ page }) => {
  await seedSignedIn(page);
  await fulfillForumMessages(page, []);
  await page.goto('/shops');
  await page.getByRole('button', { name: 'Add a shop' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText("Add the shop's place and address.")).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).evaluate((node) => {
    const button = node as HTMLButtonElement;
    button.removeAttribute('disabled');
    button.click();
  });
  await expect(page.getByText(/Describe the shop in at least 20 more characters/)).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).evaluate((node) => {
    const button = node as HTMLButtonElement;
    button.removeAttribute('disabled');
    button.click();
  });
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('5 / 5 · Summary')).toBeVisible();
  await expect(page.getByText("Add the shop's place and address.")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Post' })).toBeDisabled();
});

test('shop description and username rules appear while typing before submit', async ({ page }) => {
  await stubPlaceMap(page);
  await seedSignedIn(page);
  await fulfillForumMessages(page, []);
  await page.goto('/shops');
  await page.getByRole('button', { name: 'Add a shop' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Add a place' }).click();
  await page.locator('.h-64').click();
  await fillShopAddress(page);
  await page.getByRole('button', { name: 'Use this place' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  const text = page.getByLabel('Shop text');
  await text.evaluate((node) => {
    const field = node as HTMLTextAreaElement;
    field.value = 'Fresh bread\u0001 every morning.';
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(
    page.getByText(
      'The description must not contain control characters other than line breaks.',
    ),
  ).toBeVisible();
  await expect(text).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
  await text.fill('Fresh bread every morning.');
  await page.getByRole('button', { name: 'Next' }).click();
  const username = page.getByLabel('21.gifts username');
  await username.fill('_');
  await expect(
    page.getByText(/Use 1–32 lowercase letters, digits, dots, hyphens, or underscores/),
  ).toBeVisible();
  await expect(username).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
});

test('Function: shopUsernameProblem — an unknown valid username blocks Next', async ({ page }) => {
  await stubPlaceMap(page);
  await seedSignedIn(page);
  await fulfillForumMessages(page, []);
  await page.route(/\/forum\/mentions(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accounts: [] }),
    });
  });
  await page.goto('/shops');
  await page.getByRole('button', { name: 'Add a shop' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Add a place' }).click();
  await page.locator('.h-64').click();
  await fillShopAddress(page);
  await page.getByRole('button', { name: 'Use this place' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Shop text').fill('Fresh bread every morning.');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('21.gifts username').fill('missing');
  await expect(page.getByText('No account with that username.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
});

test('Function: shopNameProblem — a street in the name is rejected', async ({ page }) => {
  await stubPlaceMap(page);
  await seedSignedIn(page);
  await fulfillForumMessages(page, []);
  await page.goto('/shops');
  await page.getByRole('button', { name: 'Add a shop' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Add a place' }).click();
  await page.locator('.h-64').click();
  await fillShopAddress(page, 'Bahnhofstrasse bakery');
  await expect(
    page.getByText('The shop name must not contain the street or the postal code.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use this place' })).toBeDisabled();
});

test('Function: shopDescriptionProblem — short shop text keeps Next off', async ({ page }) => {
  await stubPlaceMap(page);
  await seedSignedIn(page);
  await fulfillForumMessages(page, []);
  await page.goto('/shops');
  await page.getByRole('button', { name: 'Add a shop' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Add a place' }).click();
  await page.locator('.h-64').click();
  await fillShopAddress(page);
  await page.getByRole('button', { name: 'Use this place' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Shop text').fill('Cafe');
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
});

test('Function: shopDescriptionRemaining — remaining characters are shown', async ({ page }) => {
  await stubPlaceMap(page);
  await seedSignedIn(page);
  await fulfillForumMessages(page, []);
  await page.goto('/shops');
  await page.getByRole('button', { name: 'Add a shop' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Add a place' }).click();
  await page.locator('.h-64').click();
  await fillShopAddress(page);
  await page.getByRole('button', { name: 'Use this place' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Shop text').fill('Cafe');
  await expect(page.getByText('16 more characters.')).toBeVisible();
});

test('Function: formatShopAddressLine — summary shows the address line', async ({ page }) => {
  await stubPlaceMap(page);
  await seedSignedIn(page);
  await fulfillForumMessages(page, []);
  await page.goto('/shops');
  await page.getByRole('button', { name: 'Add a shop' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Add a place' }).click();
  await page.locator('.h-64').click();
  await fillShopAddress(page);
  await page.getByRole('button', { name: 'Use this place' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Shop text').fill('Fresh bread every morning.');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Bahnhofstrasse 12, 8001 Zürich, Switzerland')).toBeVisible();
});

test('Function: formatPlacePinText — table place uses name and address', async ({ page }) => {
  await seedSignedIn(page);
  await fulfillForumMessages(page, [
    {
      ...SHOP_NOTE,
      place: COMPLETE_SHOP_PLACE,
    },
  ]);
  await page.goto('/shops');
  await page.getByRole('button', { name: 'Table' }).click();
  await expect(
    page.getByRole('link', {
      name: "Kiki's Bakery · Bahnhofstrasse 12, 8001 Zürich, Switzerland",
    }),
  ).toBeVisible();
});

test('Function: shopPlaceComplete — place step Next stays off until the pin is complete', async ({
  page,
}) => {
  await stubPlaceMap(page);
  await seedSignedIn(page);
  await fulfillForumMessages(page, []);
  await page.goto('/shops');
  await page.getByRole('button', { name: 'Add a shop' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
  await page.getByRole('button', { name: 'Add a place' }).click();
  await page.locator('.h-64').click();
  await fillShopAddress(page);
  await page.getByRole('button', { name: 'Use this place' }).click();
  await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
});

test('Function: shopApiProblem — a shop 400 is shown as localized copy', async ({ page }) => {
  await stubPlaceMap(page);
  await seedAda(page, 'moderator');
  await fulfillForumMessages(page, [STAFF_SHOP_NOTE]);
  await page.route(
    (url) => new URL(url).pathname.endsWith('/forum/messages/m-staff/place'),
    async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Shop name is required' }),
      });
    },
  );
  await page.goto('/shops');
  const note = page.locator('[data-message-id="m-staff"]');
  await note.getByRole('button', { name: 'Add a place' }).click();
  await page.locator('.h-64').click();
  await fillShopAddress(page, 'Happyland');
  await page.getByRole('button', { name: 'Use this place' }).click();
  const name = page.getByLabel('Shop name', { exact: true });
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Enter the shop name.')).toBeVisible();
});

test('Function: ShopAddressFields — street, house number, postal code, city, country', async ({
  page,
}) => {
  await stubPlaceMap(page);
  await seedSignedIn(page);
  await fulfillForumMessages(page, []);
  await page.goto('/shops');
  await page.getByRole('button', { name: 'Add a shop' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Add a place' }).click();
  await page.locator('.h-64').click();
  const address = shopAddressFields(page);
  await expect(address.getByLabel('Street', { exact: true })).toBeVisible();
  await expect(address.getByLabel('House number', { exact: true })).toBeVisible();
  await expect(address.getByLabel('Postal code', { exact: true })).toBeVisible();
  await expect(address.getByLabel('City', { exact: true })).toBeVisible();
  await expect(address.getByLabel('Country', { exact: true })).toBeVisible();
});

test('Function: ShopLabeledInput — label names the field, typed value is not part of the name', async ({
  page,
}) => {
  await stubPlaceMap(page);
  await seedSignedIn(page);
  await fulfillForumMessages(page, []);
  await page.goto('/shops');
  await page.getByRole('button', { name: 'Add a shop' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Add a place' }).click();
  await page.locator('.h-64').click();
  const street = shopAddressFields(page).getByLabel('Street', { exact: true });
  await street.fill('Bahnhofstrasse');
  await expect(street).toHaveValue('Bahnhofstrasse');
  await expect(street).toHaveAccessibleName('Street');
});
