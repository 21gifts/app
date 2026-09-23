import { expect, test } from '@playwright/test';

test('landing shows the 21.gifts wordmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: '21.gifts' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Direct human-to-human gifts/i })).toBeVisible();
});

test('landing shows the project donate address', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Donate to this project' })).toBeVisible();
  await expect(page.getByRole('link', { name: '21gifts@walletofsatoshi.com' })).toHaveAttribute(
    'href',
    'lightning:21gifts@walletofsatoshi.com',
  );
});

test('Happyland follows how it works and hides unverified claims', async ({ page }) => {
  await page.goto('/');
  const sections = page.locator('main > section');
  await expect(sections.nth(1)).toHaveAttribute('id', 'how');
  await expect(sections.nth(2)).toHaveAttribute('id', 'happyland');
  await expect(
    page.getByRole('heading', { name: 'Happyland – a glimpse of life in Manila' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: '21.gifts on the ground' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'What your gift makes possible' })).toHaveCount(0);
});

test('legal page is reachable', async ({ page }) => {
  await page.goto('/legal');
  await expect(page.getByRole('heading', { name: 'Legal Notice' })).toBeVisible();
});

test('about page is reachable', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByRole('heading', { name: 'Three convictions' })).toBeVisible();
});

test('landing mobile nav opens the section links', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByLabel('Primary').getByRole('link', { name: 'Handbook' })).toBeVisible();
  await expect(page.getByLabel('Primary').getByRole('link', { name: 'Log in' })).toBeVisible();
});

for (const locale of ['en', 'de', 'es', 'fil'] as const) {
  test(`Function: HappylandSection renders the complete ${locale} essay without overflow`, async ({
    page,
    context,
  }) => {
    await context.addCookies([{ name: 'locale', value: locale, url: 'http://localhost:3000' }]);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const section = page.locator('#happyland');
    await expect(section.getByRole('heading', { level: 2 })).toContainText('Happyland');
    await expect(section.locator('figure')).toHaveCount(8);
    await expect(section.locator('figcaption', { hasText: /^Pagpag$/ })).toHaveCount(1);
    await expect
      .poll(() =>
        section
          .getByRole('img')
          .evaluateAll((images) =>
            images.every(
              (image) =>
                image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}

test('Function: HappylandPhoto preserves photographs and displays descriptive captions', async ({
  page,
}) => {
  await page.goto('/');
  const figures = page.locator('#happyland figure');
  await expect(figures).toHaveCount(8);
  for (const figure of await figures.all()) {
    const image = figure.getByRole('img');
    await expect(image).toHaveAttribute('alt', /.+/);
    await expect(image).toHaveAttribute('src', /^\/happyland\/.+\.webp$/);
    await expect(figure.locator('figcaption')).not.toBeEmpty();
    await expect
      .poll(() =>
        image.evaluate(
          (element) =>
            element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
});
