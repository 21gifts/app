import { test, expect } from '@playwright/test';

const sundayOrigin = 'http://localhost:3002';

test('Function: middleware — Sunday cannot be bypassed with a direct write or data request', async ({
  request,
}) => {
  for (const method of ['GET', 'POST', 'DELETE']) {
    const response = await request.fetch(`${sundayOrigin}/me`, { method });
    expect(response.status()).toBe(503);
    expect(await response.json()).toMatchObject({ error: 'SUNDAY_REST' });
  }
  expect((await request.get(`${sundayOrigin}/healthz`)).status()).toBe(200);
});
test('Function: sundayRetryAfter — scheduled HTTP retry delay and cache controls', async ({
  request,
}) => {
  const response = await request.get(`${sundayOrigin}/me`);
  expect(Number(response.headers()['retry-after'])).toBeGreaterThan(0);
  expect(response.headers()['cache-control']).toContain('no-store');
});
test('Function: SundayRestPage — direct Sunday destination and weekday redirect', async ({
  page,
}) => {
  await page.goto(`${sundayOrigin}/sunday-rest`);
  await expect(page.getByRole('heading', { name: 'Christ is risen!' })).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(0);
  await page.goto('/sunday-rest');
  await expect(page).toHaveURL('/');
});
test('Function: SundayRestGate — an open window rests and resumes', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-24T12:00:00Z') });
  await page.goto('/');
  // Server is anchored to Thursday noon UTC. Three days reaches Sunday afternoon in Manila.
  await page.clock.fastForward(3 * 86400000);
  await expect(page.getByRole('heading', { name: 'Christ is risen!' })).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(0);
  await page.clock.fastForward(86400000);
  await expect(page.getByRole('heading', { name: 'Christ is risen!' })).toHaveCount(0);
});
test('Function: isSundayRest — server policy ignores browser timezone and local clock', async ({
  browser,
}) => {
  const context = await browser.newContext({
    timezoneId: 'America/Los_Angeles',
    locale: 'de-DE',
    extraHTTPHeaders: { 'Accept-Language': 'de' },
  });
  const page = await context.newPage();
  await page.clock.install({ time: new Date('2026-09-28T12:00:00Z') });
  await page.goto(`${sundayOrigin}/about`);
  await expect(page.getByRole('heading', { name: 'Christus ist auferstanden!' })).toBeVisible();
  await expect(page.getByText(/Lasst die Arbeit und das Einkaufen ruhen/)).toBeVisible();
  await expect(page.getByRole('link')).toHaveCount(0);
  await context.close();
});
