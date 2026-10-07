import { expect, test, type Page } from '@playwright/test';
import type { Locale } from '../src/lib/locale';
import { getCatalog, type MessageKey } from '../src/lib/messages';

const LOCALES: ReadonlyArray<{ locale: Locale; browserLocale: string; acceptLanguage: string }> = [
  { locale: 'en', browserLocale: 'en-US', acceptLanguage: 'en-US,en;q=0.9' },
  { locale: 'de', browserLocale: 'de-DE', acceptLanguage: 'de-DE,de;q=0.9' },
  { locale: 'es', browserLocale: 'es-ES', acceptLanguage: 'es-ES,es;q=0.9' },
  { locale: 'fil', browserLocale: 'fil-PH', acceptLanguage: 'fil-PH,fil;q=0.9' },
];

const CLAUSES = [1, 2, 3, 4, 5] as const;

for (const { locale, browserLocale, acceptLanguage } of LOCALES) {
  test.describe(`Terms of Use in ${locale}`, () => {
    test.use({ locale: browserLocale, extraHTTPHeaders: { 'Accept-Language': acceptLanguage } });

    test(`Function: TermsPage renders the five ${locale} clauses in order`, async ({ page }) => {
      const catalog = getCatalog(locale);
      await page.goto('/terms');
      await expect(
        page.getByRole('heading', { name: catalog['terms.title'], level: 1 }),
      ).toBeVisible();
      await expect(page.getByText(catalog['terms.lastUpdated'])).toBeVisible();
      await expect(
        page.getByRole('heading', { name: catalog['terms.heading'], level: 2 }),
      ).toBeVisible();
      const items = page.locator('main ol > li');
      await expect(items).toHaveText(
        CLAUSES.map(
          (n) =>
            `${catalog[`terms.clause${n}Title` as MessageKey]}. ${catalog[`terms.clause${n}` as MessageKey]}`,
        ),
      );
    });
  });
}

test('legal page links the Terms of Use and the Wallet and data section', async ({ page }) => {
  await page.goto('/legal');
  await expect(page.getByRole('heading', { name: 'Wallet and payment data' })).toBeVisible();
  await expect(page.getByText(/sell data, or track visitors/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Wallet and data' })).toHaveAttribute(
    'href',
    '/terms#wallet-and-data',
  );
  await page.locator('main').getByRole('link', { name: 'Terms of Use' }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole('heading', { name: 'Wallet and data' })).toBeVisible();
});

test('Function: MarketingFooter links the Terms of Use', async ({ page }) => {
  await page.goto('/about');
  await page.locator('footer').getByRole('link', { name: 'Terms of Use' }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole('heading', { name: 'Terms of Use', level: 1 })).toBeVisible();
});

/** Signed-in visitor at `/setup/rules` with name and username saved, rules not agreed. */
async function openRulesSetup(page: Page): Promise<void> {
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
        username: 'ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: null,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: 'rules',
        missing: ['rules'],
      }),
    });
  });
}

test('Function: RulesSetup links the Terms of Use on the last chapter only', async ({ page }) => {
  await openRulesSetup(page);
  await page.goto('/setup/rules');
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  await expect(page.getByText('By continuing you accept the')).toHaveCount(0);
  const next = page.getByRole('button', { name: 'Continue' });
  for (let i = 0; i < 8; i += 1) {
    await next.click();
  }
  await expect(page.getByRole('heading', { name: 'Our house' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'I agree to these rules' })).toBeVisible();
  await expect(page.getByText('By continuing you accept the')).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await page.getByRole('link', { name: 'Terms of Use' }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole('heading', { name: 'Wallet and data' })).toBeVisible();
});
