import { expect, test } from '@playwright/test';

test('donate page renders the gift form', async ({ page }) => {
  await page.goto('/donate');
  await expect(page.getByRole('heading', { name: 'Send a gift', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create invoice' })).toBeVisible();
});

test('donate form creates an invoice QR from a Lightning Address', async ({ page }) => {
  await page.route(/\/lightning-address\?/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        address: 'alice@example.com',
        callback: 'https://ln.example.com/pay',
        minSendable: 1000,
        maxSendable: 1_000_000_000,
      }),
    });
  });
  await page.route('https://ln.example.com/pay**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pr: 'lnbc21n1exampleinvoice' }),
    });
  });

  await page.goto('/donate');
  await page.getByLabel('Lightning Address').fill('alice@example.com');
  await page.getByLabel('Amount (sats)').fill('21');
  await page.getByRole('button', { name: 'Create invoice' }).click();

  await expect(page.getByText('Pay 21 sats to alice@example.com')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Lightning invoice QR code' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open in wallet' })).toHaveAttribute(
    'href',
    'lightning:lnbc21n1exampleinvoice',
  );
});
