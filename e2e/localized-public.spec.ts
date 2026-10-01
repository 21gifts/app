import { expect, test } from '@playwright/test';

const locales = ['en', 'de', 'es', 'fil'] as const;
const pages = ['', '/about', '/donate', '/rules'] as const;

test('Function: middleware — URL language overrides a conflicting cookie', async ({
  page,
  context,
}) => {
  await context.addCookies([{ name: 'locale', value: 'fil', url: 'http://localhost:3000' }]);
  await page.goto('/de/about');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('heading', { name: 'Wofür 21.gifts steht' })).toBeVisible();
});

test('Function: localizedPublicPath — giving links keep the page language', async ({ page }) => {
  await page.goto('/es');
  await expect(page.getByRole('link', { name: 'Envía ayuda' })).toHaveAttribute(
    'href',
    '/es/donate',
  );
});

test('Function: parseLocalizedPublicPath — unsupported language and app routes stay unavailable', async ({
  request,
}) => {
  expect((await request.get('/fr/about')).status()).toBe(404);
  expect((await request.get('/es/login')).status()).toBe(404);
  expect((await request.get('/fil/about')).status()).toBe(200);
});

test('Function: publicPathFromUrl — switching language keeps the current page', async ({
  page,
}) => {
  await page.goto('/de/about');
  await page.getByLabel('Sprache').click();
  await page.getByRole('option', { name: 'Español' }).click();
  await expect(page).toHaveURL(/\/es\/about$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('heading', { name: 'Lo que representa 21.gifts' })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toContainText('Mateo 10:8');
  await expect(page.getByRole('contentinfo')).not.toContainText('Matthäus 10,8');
  await expect(page.getByRole('navigation', { name: 'Principal' })).toContainText('Cómo funciona');
});

test('language switching updates the preview, navigation, and footer in every language', async ({
  page,
}) => {
  await page.goto('/de');
  for (const choice of [
    {
      option: 'Español',
      locale: 'es',
      preview: 'Así llega tu donación',
      navigation: 'Cómo funciona',
      verse: 'Mateo 10:8',
    },
    {
      option: 'Filipino',
      locale: 'fil',
      preview: 'Ganito nakakarating ang donasyon mo',
      navigation: 'Paano ito gumagana',
      verse: 'Mateo 10:8',
    },
    {
      option: 'English',
      locale: 'en',
      preview: 'How your donation arrives',
      navigation: 'How it works',
      verse: 'Matthew 10:8',
    },
    {
      option: 'Deutsch',
      locale: 'de',
      preview: 'So kommt deine Spende an',
      navigation: "So funktioniert's",
      verse: 'Matthäus 10,8',
    },
  ]) {
    const option = page.getByRole('option', { name: choice.option });
    await expect(async () => {
      if (!(await option.isVisible())) await page.getByRole('combobox').click();
      await expect(option).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 10000 });
    await option.click();
    await expect(page).toHaveURL(new RegExp(`/${choice.locale}$`));
    await expect(page.locator('html')).toHaveAttribute('lang', choice.locale);
    await expect(page.getByRole('heading', { name: choice.preview })).toBeVisible();
    await expect(page.getByRole('navigation').first()).toContainText(choice.navigation);
    await expect(page.getByRole('contentinfo')).toContainText(choice.verse);
  }
});

test('all localized public pages serve reciprocal canonical and language links', async ({
  request,
}) => {
  for (const path of pages) {
    for (const locale of locales) {
      const response = await request.get(`/${locale}${path}`, {
        headers: { Cookie: 'locale=de', 'Accept-Language': 'en' },
      });
      expect(response.status()).toBe(200);
      const html = await response.text();
      expect(html).toContain(`<html lang="${locale}"`);
      expect(html).toContain(`rel="canonical" href="https://21.gifts/${locale}${path}"`);
      for (const alternate of locales) {
        expect(html).toContain(
          `rel="alternate" hrefLang="${alternate}" href="https://21.gifts/${alternate}${path}"`,
        );
      }
    }
  }
});

test('sitemap lists the sixteen localized public pages', async ({ request }) => {
  const response = await request.get('/sitemap.xml');
  expect(response.status()).toBe(200);
  const xml = await response.text();
  for (const path of pages) {
    for (const locale of locales) {
      expect(xml).toContain(`<loc>https://21.gifts/${locale}${path}</loc>`);
    }
  }
});
