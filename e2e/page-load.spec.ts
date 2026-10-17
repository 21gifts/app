import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Why a page was loaded (`src/lib/page-load.ts`): a client-side navigation
 * leaves the one word `app` in `sessionStorage` while it runs, the committed
 * view removes it, and a full page load that App Router falls back to reads
 * and removes it at start-up.
 */

test.describe.configure({ timeout: 60_000 });

/** `sessionStorage` key of the app-navigation marker. */
const MARKER_KEY = '21gifts.load';

/**
 * Whether a request is App Router's page-data request for `/terms`.
 *
 * @param route - Intercepted route.
 * @returns True for the RSC request of `/terms`.
 */
function isTermsData(route: Route): boolean {
  const request = route.request();
  return new URL(request.url()).pathname === '/terms' && request.headers()['rsc'] === '1';
}

/**
 * Opens `/legal` and tags its document, so a later full page load is visible.
 *
 * @param page - Playwright page.
 * @param settle - Wait until the network is idle (off while a request is held on purpose).
 */
async function openLegal(page: Page, settle = true): Promise<void> {
  await page.goto('/legal');
  await page.waitForLoadState(settle ? 'networkidle' : 'load');
  await page.evaluate(() => {
    (window as unknown as { e2eDocument?: string }).e2eDocument = 'legal';
  });
}

/**
 * Reads the marker and whether the `/legal` document is still loaded.
 *
 * @param page - Playwright page.
 * @returns The marker value and the document tag.
 */
async function readState(page: Page): Promise<{ marker: string | null; tag: string | null }> {
  return page.evaluate((key) => {
    return {
      marker: sessionStorage.getItem(key),
      tag: (window as unknown as { e2eDocument?: string }).e2eDocument ?? null,
    };
  }, MARKER_KEY);
}

test('Function: markAppNavigation — a client-side navigation leaves the app marker while it runs', async ({
  page,
}) => {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/terms**', async (route) => {
    if (!isTermsData(route)) {
      await route.continue();
      return;
    }
    await held;
    await route.continue();
  });
  // The prefetch of `/terms` is held as well, so the network never goes idle.
  await openLegal(page, false);
  expect((await readState(page)).marker).toBeNull();
  await page.locator('a[href="/terms"]').first().click();
  await expect.poll(async () => (await readState(page)).marker).toBe('app');
  release();
  await expect(page).toHaveURL(/\/terms$/);
});

test('Function: clearAppNavigation — the committed navigation removes the marker and keeps the document', async ({
  page,
}) => {
  await openLegal(page);
  await page.locator('a[href="/terms"]').first().click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole('heading').first()).toBeVisible();
  await expect.poll(async () => readState(page)).toEqual({ marker: null, tag: 'legal' });
});

test('Function: capturePageLoad — a failed page-data request falls back to a full page load that reads and removes the marker', async ({
  page,
}) => {
  await page.route('**/terms**', async (route) => {
    if (isTermsData(route)) {
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  await openLegal(page);
  await page.locator('a[href="/terms"]').first().click();
  await expect(page).toHaveURL(/\/terms$/);
  await page.waitForLoadState('load');
  // A new document: the tag of `/legal` is gone, and its start-up took the marker.
  await expect.poll(async () => readState(page)).toEqual({ marker: null, tag: null });
  const type = await page.evaluate(
    () => (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).type,
  );
  expect(type).toBe('navigate');
});
