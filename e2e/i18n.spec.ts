import { expect, test } from '@playwright/test';

test.describe('Accept-Language de', () => {
  test.use({
    locale: 'de-DE',
    extraHTTPHeaders: { 'Accept-Language': 'de-DE,de;q=0.9' },
  });

  test('home heading is German', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Hilf Menschen mit Bitcoin/ })).toBeVisible();
    await page.getByText('Brauche ich ein Konto, um das Wohnzimmer zu sehen?').click();
    await expect(
      page.getByText('Ja. Für das Wohnzimmer meldest du dich an.', { exact: false }),
    ).toBeVisible();
  });

  test('home giving CTA is German', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Sende Hilfe' })).toBeVisible();
  });

  test('login button is German', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log in' })).toHaveCount(0);
  });
});

test.describe('Accept-Language es', () => {
  test.use({
    locale: 'es-ES',
    extraHTTPHeaders: { 'Accept-Language': 'es' },
  });

  test('login button is Spanish', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  });
});

test.describe('Accept-Language tl without en', () => {
  test.use({
    locale: 'fil-PH',
    extraHTTPHeaders: { 'Accept-Language': 'tl-PH,tl;q=0.9' },
  });

  test('home CTA is Filipino', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.locator('main > section').first().getByRole('link', { name: 'Humiling ng tulong' }),
    ).toBeVisible();
  });

  test('login button is Filipino', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Mag-log in' })).toBeVisible();
  });
});

test.describe('Accept-Language PH default with en first', () => {
  test.use({
    locale: 'en-US',
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9,tl;q=0.8' },
  });

  test('home stays English when en outranks tl', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Help people with Bitcoin/ })).toBeVisible();
  });
});

test.describe('language switcher cookie', () => {
  test.use({
    locale: 'en-US',
    extraHTTPHeaders: { 'Accept-Language': 'en' },
  });

  test('selecting Español sets locale cookie and refreshes UI', async ({ page, context }) => {
    await page.goto('/');
    await page.getByLabel('Language').click();
    await page.getByRole('option', { name: 'Español' }).click();
    await expect(
      page.getByRole('heading', { name: /Ayuda a otras personas con Bitcoin/ }),
    ).toBeVisible();
    const cookies = await context.cookies();
    expect(cookies.some((cookie) => cookie.name === 'locale' && cookie.value === 'es')).toBe(true);
  });
});

test.describe('locale cookie overrides Accept-Language', () => {
  test.use({
    locale: 'de-DE',
    extraHTTPHeaders: { 'Accept-Language': 'de' },
  });

  test('fil cookie wins over German header', async ({ page, context }) => {
    await context.addCookies([
      {
        name: 'locale',
        value: 'fil',
        url: 'http://localhost:3000',
      },
    ]);
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /Tumulong sa kapwa gamit ang Bitcoin/ }),
    ).toBeVisible();
  });
});
