import { expect, test, type Page } from '@playwright/test';

/**
 * Content-Security-Policy in the Playwright build: `CSP_MODE` is unset, so
 * every page sends the policy report-only. `NEXT_PUBLIC_SENTRY_DSN` is empty,
 * so the report route is closed. The enforcing header and the forwarding are
 * covered by the unit tests of `src/middleware.ts`, `src/lib/csp.ts`, and
 * `src/lib/sentry.ts`.
 */

/** Header the default mode sends. */
const REPORT_ONLY = 'content-security-policy-report-only';

/** Signed-in member, enough for the signed-in screens to render. */
const E2E_ACCOUNT = {
  id: 'acc_e2e',
  linkingKey: `02${'a'.repeat(62)}`,
  role: 'basis' as const,
  name: 'Ada',
  username: 'ada',
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

/**
 * Collect every violation the page reports, from before its first script.
 *
 * @param page - Page under test.
 * @returns Reads the violations seen so far as `directive blocked` lines.
 */
async function recordViolations(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __cspViolations: string[] }).__cspViolations = seen;
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(`${event.effectiveDirective} ${event.blockedURI}`);
    });
  });
  return () =>
    page.evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations);
}

/**
 * Sign the page in with a stubbed account.
 *
 * @param page - Page under test.
 */
async function seedSignedIn(page: Page): Promise<void> {
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

test('Function: getCspMode — pages send the policy report-only by default', async ({ page }) => {
  const response = await page.goto('/');
  const headers = response?.headers() ?? {};
  expect(headers[REPORT_ONLY]).toContain("default-src 'self'");
  expect(headers['content-security-policy']).toBeUndefined();
});

test('Function: cspHeaderName — route handlers carry the same report-only header', async ({
  request,
}) => {
  const response = await request.get('/healthz');
  expect(response.headers()[REPORT_ONLY]).toContain('report-uri /monitoring/csp');
  expect(response.headers()['reporting-endpoints']).toBe('csp="/monitoring/csp"');
});

test('Function: createCspNonce — every page script carries the nonce of its response', async ({
  page,
}) => {
  const response = await page.goto('/');
  const nonce = /'nonce-([^']+)'/.exec(response?.headers()[REPORT_ONLY] ?? '')?.[1];
  expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  const scripts = await page.evaluate(() =>
    [...document.querySelectorAll('script:not([type="application/ld+json"])')].map(
      (script) => (script as HTMLScriptElement).nonce,
    ),
  );
  expect(scripts.length).toBeGreaterThan(3);
  expect(new Set(scripts)).toEqual(new Set([nonce]));
  const again = await page.goto('/');
  expect(again?.headers()[REPORT_ONLY]).not.toContain(`'nonce-${nonce}'`);
});

test('Function: buildCsp — landing, welcome, and shops load without a violation', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const violations = await recordViolations(page);
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  expect(await violations()).toEqual([]);
  await seedSignedIn(page);
  await page.goto('/welcome');
  await expect(page.locator('main')).toBeVisible();
  expect(await violations()).toEqual([]);
  await page.goto('/shops');
  await expect(page.getByRole('button', { name: 'Add a shop' })).toBeVisible();
  expect(await violations()).toEqual([]);
  // The listener does see a violation: an http image is outside img-src.
  await page.evaluate(() => {
    const image = document.createElement('img');
    image.src = 'http://csp-check.invalid/x.png';
    document.body.append(image);
  });
  await expect
    .poll(violations)
    .toEqual([expect.stringMatching(/^img-src http:\/\/csp-check\.invalid/)]);
});

test('Function: forwardCspReport — POST /monitoring/csp is 404 while reporting is off', async ({
  request,
}) => {
  const response = await request.post('/monitoring/csp', {
    headers: { 'Content-Type': 'application/csp-report' },
    data: JSON.stringify({
      'csp-report': {
        'document-uri': 'http://localhost:3000/',
        'effective-directive': 'img-src',
        'blocked-uri': 'https://images.example/a.png',
      },
    }),
  });
  expect(response.status()).toBe(404);
});
