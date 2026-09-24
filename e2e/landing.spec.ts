import { expect, test } from '@playwright/test';
import { getCatalog } from '../src/lib/messages';

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

for (const locale of ['en', 'de', 'es', 'fil'] as const) {
  for (const width of [375, 768, 1024, 1280]) {
    test(`Function: MarketingHeader opens Happyland in ${locale} at ${width}px`, async ({
      page,
      context,
    }) => {
      await context.addCookies([{ name: 'locale', value: locale, url: 'http://localhost:3000' }]);
      await page.setViewportSize({ width, height: 812 });
      await page.goto('/');
      const menu = page.getByRole('button', {
        name: getCatalog(locale)['aria.menu'],
        exact: true,
        includeHidden: true,
      });
      if (await menu.isVisible()) await menu.click();
      const nav = page.locator('header nav');
      const happyland = nav.getByRole('link', { name: 'Happyland', exact: true });
      await expect(nav.getByRole('link').nth(0)).toHaveAttribute('href', '/#how');
      await expect(nav.getByRole('link').nth(1)).toHaveText('Happyland');
      await expect(happyland).toHaveAttribute('href', '/#happyland');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await happyland.click();
      await expect(page).toHaveURL(/\/#happyland$/);
      await expect(page.locator('#happyland-title')).toBeInViewport();
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
      await expect
        .poll(async () => {
          const heading = await page.locator('#happyland-title').boundingBox();
          const header = await page.locator('header').boundingBox();
          return heading !== null && header !== null && heading.y >= header.y + header.height;
        })
        .toBe(true);
    });
  }
}

for (const width of [375, 1280]) {
  test(`Happyland navigation returns from About to the photo essay at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/about');
    const menu = page.getByRole('button', { name: 'Menu', exact: true, includeHidden: true });
    if (await menu.isVisible()) await menu.click();
    await page.locator('header nav').getByRole('link', { name: 'Happyland', exact: true }).click();
    await expect(page).toHaveURL(/\/#happyland$/);
    await expect(page.locator('#happyland-title')).toBeInViewport();
    await expect(
      page.getByRole('button', { name: 'Menu', exact: true, includeHidden: true }),
    ).toHaveAttribute('aria-expanded', 'false');
  });
}
