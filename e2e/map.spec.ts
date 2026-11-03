import { expect, test, type Page } from '@playwright/test';

const E2E_ACCOUNT = {
  id: 'acc_e2e',
  linkingKey: `02${'a'.repeat(62)}`,
  role: 'basis' as const,
  name: 'Ada',
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  setup: null,
  missing: [],
};

async function seedSignedIn(page: Page, mapsKey: string | null = null): Promise<void> {
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
  await page.route(/\/maps\/key$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ key: mapsKey }),
    });
  });
}

async function stubPlaceMap(page: Page): Promise<void> {
  await page.addInitScript(() => {
    class MapShim {
      readonly el: HTMLElement;

      constructor(el: HTMLElement) {
        this.el = el;
      }

      setCenter(): void {}

      addListener(
        event: string,
        handler: (event: { latLng: { lat: () => number; lng: () => number } }) => void,
      ): void {
        if (event === 'click') {
          this.el.addEventListener('click', () => {
            handler({ latLng: { lat: () => 14.5, lng: () => 120.9 } });
          });
        }
      }
    }

    class MarkerShim {
      setPosition(): void {}

      getPosition(): null {
        return null;
      }

      addListener(): void {}
    }

    (window as unknown as { google?: unknown }).google = {
      maps: { Map: MapShim, Marker: MarkerShim },
    };
  });
}

test('Function: proxyMessagesPlacesGet — GET /forum/messages/places without bearer is 401', async ({
  request,
}) => {
  expect((await request.get('/forum/messages/places')).status()).toBe(401);
  expect((await request.get('/maps/key')).status()).toBe(200);
});

test('Function: middleware — an old map link opens the shops map', async ({ page }) => {
  await seedSignedIn(page);
  await page.route(/\/forum\/messages\/places$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ places: [] }),
    });
  });
  await page.goto('/map');
  await expect(page).toHaveURL(/\/shops#map$/);
  await expect(page.getByRole('heading', { name: 'Shops' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Map', pressed: true })).toBeVisible();
  await page.goto('/map?pin=m-pin');
  await expect(page).toHaveURL(/\/shops\?pin=m-pin#map$/);
  await expect(page.getByRole('button', { name: 'Map', pressed: true })).toBeVisible();
});

test('Function: fetchPlaces — the map lists a pin', async ({ page }) => {
  await seedSignedIn(page);
  await page.route(/\/forum\/messages\/places$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        places: [
          {
            id: 'm-pin',
            name: 'Ada',
            createdAt: '2026-08-28T12:00:00.000Z',
            lat: 14.6,
            lng: 120.98,
            label: 'Happyland',
          },
        ],
      }),
    });
  });
  await page.goto('/shops#map');
  await expect(page.getByRole('link', { name: 'Ada · Happyland' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Map' })).toHaveCount(0);
});

test('Function: PlacesMapScreen — lists a pin', async ({ page }) => {
  await seedSignedIn(page);
  await page.route(/\/forum\/messages\/places$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        places: [
          {
            id: 'm-pin',
            name: 'Ada',
            createdAt: '2026-08-28T12:00:00.000Z',
            lat: 14.6,
            lng: 120.98,
            label: 'Happyland',
          },
        ],
      }),
    });
  });
  await page.goto('/shops#map');
  await expect(page.getByRole('link', { name: 'Ada · Happyland' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Map' })).toHaveCount(0);
});

test('shop map pins use the shop page only when shopNpub exists', async ({ page }) => {
  await seedSignedIn(page);
  const npub = `npub1${'2'.repeat(58)}`;
  await page.route(/\/forum\/messages\/places$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        places: [
          {
            id: 'm-shop',
            name: 'Ada',
            createdAt: '2026-08-28T12:00:00.000Z',
            lat: 14.6,
            lng: 120.98,
            label: 'Cafe Luna',
            shopNpub: npub,
          },
          {
            id: 'm-pending',
            name: 'Bea',
            createdAt: '2026-08-28T12:00:00.000Z',
            lat: 14.61,
            lng: 120.99,
            label: 'Pending Shop',
            shopNpub: null,
          },
        ],
      }),
    });
  });
  await page.goto('/shops#map');
  await expect(page.getByRole('link', { name: 'Ada · Cafe Luna' })).toHaveAttribute(
    'href',
    `/${npub}`,
  );
  await expect(page.getByRole('link', { name: 'Bea · Pending Shop' })).toHaveAttribute(
    'href',
    '/messages/m-pending',
  );
});

test('Function: PlacesMapScreen — frames every pin', async ({ page }) => {
  await seedSignedIn(page, 'e2e');
  await page.route(/\/forum\/messages\/places$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        places: [
          {
            id: 'm-pin',
            name: 'Ada',
            createdAt: '2026-08-28T12:00:00.000Z',
            lat: 14.6,
            lng: 120.98,
            label: 'Happyland',
          },
          {
            id: 'm-2',
            name: 'Ada',
            createdAt: '2026-08-28T12:00:00.000Z',
            lat: -1.95,
            lng: 37.84,
            label: 'Machakos',
          },
        ],
      }),
    });
  });
  await page.addInitScript(() => {
    type Point = { lat: number; lng: number };
    type Fit = { points: Point[]; padding: number | undefined };
    const host = window as Window & {
      google?: unknown;
      placesMapFits?: Fit[];
      placesMapIdleHandler?: () => void;
    };
    const fits: Fit[] = [];
    host.placesMapFits = fits;
    class LatLngBounds {
      points: Point[] = [];

      extend(point: Point): void {
        this.points.push({ ...point });
      }
    }
    class MapStub {
      setCenter(_center: Point): void {}

      fitBounds(bounds: LatLngBounds, padding?: number): void {
        fits.push({
          points: bounds.points.map((point) => ({ ...point })),
          padding,
        });
      }

      getZoom(): number | undefined {
        return 2;
      }

      setZoom(_zoom: number): void {}
    }
    class MarkerStub {
      constructor(_opts: { position: Point; map: MapStub }) {}
    }
    host.google = {
      maps: {
        Map: MapStub,
        Marker: MarkerStub,
        LatLngBounds,
        event: {
          addListenerOnce(_instance: MapStub, _eventName: string, handler: () => void): void {
            host.placesMapIdleHandler = handler;
          },
        },
      },
    };
  });
  await page.goto('/shops#map');
  await expect(page.getByRole('link', { name: 'Ada · Happyland' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ada · Machakos' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & {
              placesMapFits?: Array<{
                points: Array<{ lat: number; lng: number }>;
                padding: number | undefined;
              }>;
            }
          ).placesMapFits ?? [],
      ),
    )
    .toEqual([
      {
        points: [
          { lat: 14.6, lng: 120.98 },
          { lat: -1.95, lng: 37.84 },
        ],
        padding: 32,
      },
    ]);
});

test('Function: PlaceField — add a place is on the shop composer', async ({ page }) => {
  await seedSignedIn(page);
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
  await page.goto('/shops#post');
  await page.getByRole('button', { name: 'Add a shop' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('button', { name: 'Add a place' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
  await page.getByRole('button', { name: 'Add a place' }).click();
  const unavailable = page.getByText('The map is not available.');
  await expect(unavailable).toHaveCount(1);
  await expect(unavailable).toBeVisible();
  await expect(page.getByLabel('Shop name', { exact: true })).toBeVisible();
});

test('Function: PlacePinChip — confirmed composer place stays in flow and can be removed', async ({
  page,
}) => {
  await stubPlaceMap(page);
  await seedSignedIn(page, 'e2e');
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
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'Add a place' }).click();
  await page.locator('.h-64').click();
  await page.getByLabel('Place name').fill('Stall');
  await page.getByRole('button', { name: 'Use this place' }).click();
  const chip = page.getByText('Stall', { exact: true }).locator('..');
  await expect(chip).toBeVisible();
  await expect.poll(() => chip.evaluate((node) => getComputedStyle(node).position)).toBe('static');
  await page.getByRole('button', { name: 'Remove place' }).click();
  await expect(page.getByText('Stall', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove place' })).toHaveCount(0);
});
