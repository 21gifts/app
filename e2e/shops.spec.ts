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

test('Function: ShopsPage — heading is visible', async ({ page }) => {
  await seedShopList(page);
  await page.goto('/shops');
  await expect(page.getByRole('heading', { name: 'Shops' })).toBeVisible();
});

test('Function: ShopsScreen — lead is visible', async ({ page }) => {
  await seedSignedIn(page);
  await fulfillForumMessages(page, []);
  await page.goto('/shops');
  await expect(
    page.getByText(
      'Add a shop the same way you write a living-room post. It appears here and in the forum with a #Shop tag.',
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
  await seedSignedIn(page);
  const invoiced = page.waitForRequest(
    (req) =>
      req.method() === 'POST' && /\/messages\/[^/]+\/invoice$/.test(new URL(req.url()).pathname),
  );
  await page.route(/\/messages\/compose-target$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messageId: 'm-platform-profile', sats: 0 }),
    });
  });
  await page.route(/\/messages\/[^/]+\/invoice$/, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pr: 'lnbc1test', amountSats: 1 }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/shops');
  await page.getByLabel('Your message').fill('Cafe Luna');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  const invoiceReq = await invoiced;
  const parsed = invoiceReq.postDataJSON() as { text?: string };
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

const STAFF_SHOP_NOTE = {
  id: 'm-staff',
  name: 'Ada',
  text: 'Cafe Luna\n\n#21GiftsShop',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 0,
  payable: false,
  hasPhoto: false,
  role: 'basis',
};

test('Function: ShopPlaceControl — moderator saves a pin; basis cannot edit', async ({
  page,
}) => {
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
  await note.getByLabel('Place name').fill('Happyland');
  const patched = page.waitForRequest(
    (req) =>
      req.method() === 'PATCH' &&
      new URL(req.url()).pathname.endsWith('/forum/messages/m-staff/place'),
  );
  await note.getByRole('button', { name: 'Use this place' }).click();
  const placeReq = await patched;
  expect(placeReq.postDataJSON()).toEqual({
    place: { lat: 14.5, lng: 120.9, label: 'Happyland' },
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
