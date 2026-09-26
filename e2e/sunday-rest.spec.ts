import { test, expect } from '@playwright/test';
import { isSundayRest } from '../src/lib/sunday-rest';

test('Function: middleware — weekday API traffic or Sunday rejection', async ({ request }) => {
  const response = await request.get('/healthz');
  expect(response.status()).toBe(isSundayRest(Date.now()) ? 503 : 200);
});
test('Function: sundayRetryAfter — scheduled HTTP retry delay', async ({ request }) => {
  const response = await request.get('/healthz');
  if (isSundayRest(Date.now())) {
    expect(Number(response.headers()['retry-after'])).toBeGreaterThan(0);
    expect(response.headers()['cache-control']).toContain('no-store');
  } else expect(response.status()).toBe(200);
});
test('Function: SundayRestPage — direct rest destination', async ({ page }) => {
  await page.goto('/sunday-rest');
  if (isSundayRest(Date.now()))
    await expect(page.getByRole('heading', { name: 'Christ is risen!' })).toBeVisible();
  else await expect(page).toHaveURL('/');
});
test('Function: SundayRestGate — an open window rests and resumes', async ({ page }) => {
  test.skip(isSundayRest(Date.now()), 'Server already resting; opening case covered above');
  await page.clock.install();
  await page.goto('/');
  const manila = new Date(Date.now() + 8 * 3600000);
  const untilSunday =
    ((7 - manila.getUTCDay()) % 7) * 86400000 -
    (manila.getUTCHours() * 3600000 +
      manila.getUTCMinutes() * 60000 +
      manila.getUTCSeconds() * 1000 +
      manila.getUTCMilliseconds());
  await page.clock.fastForward(untilSunday + 1000);
  await expect(page.getByRole('heading', { name: 'Christ is risen!' })).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(0);
  await page.clock.fastForward(86400000);
  await expect(page.getByRole('heading', { name: 'Christ is risen!' })).toHaveCount(0);
});
test('Function: isSundayRest — server policy ignores the browser timezone', async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: 'America/Los_Angeles' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Christ is risen!' })).toHaveCount(
    isSundayRest(Date.now()) ? 1 : 0,
  );
  await context.close();
});
