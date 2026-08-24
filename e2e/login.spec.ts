import { expect, test } from '@playwright/test';

test('login page renders passkey actions only', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Create a passkey' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with passkey' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in with Wallet of Satoshi' })).toHaveCount(0);
});

test('login shows Preparing your login while passkey begin hangs', async ({ page }) => {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/auth\/passkey\/register\/begin$/, async (route) => {
    await held;
    await route.abort();
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Create a passkey' }).click();
  await expect(page.getByText('Preparing your login…')).toBeVisible();
  release();
});

test('login shows an error when passkey begin fails', async ({ page }) => {
  await page.route(/\/auth\/passkey\/register\/begin$/, async (route) => {
    await route.fulfill({ status: 503, body: 'unavailable' });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Create a passkey' }).click();
  await expect(page.getByText('Something went wrong. Please try again.')).toBeVisible();
});

const E2E_ACCOUNT = {
  id: 'acc_e2e',
  linkingKey: `02${'a'.repeat(62)}`,
  role: 'basis' as const,
  name: null as string | null,
  lightningAddress: null as string | null,
  lightningAddressVerified: false,
  createdAt: 1_700_000_000,
};

test('signed-in session hydrates, then links and unlinks a Wallet of Satoshi address', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });

  await page.route(/\/me\/name$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...E2E_ACCOUNT, name: 'Ada' }),
    });
  });
  await page.route(/\/me\/lightning-address$/, async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          lightningAddress: 'alice@walletofsatoshi.com',
        }),
      });
      return;
    }
    if (method === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...E2E_ACCOUNT, lightningAddress: null }),
      });
      return;
    }
    await route.continue();
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(E2E_ACCOUNT),
    });
  });

  await page.goto('/login');
  await expect(page.getByText('Signed in')).toBeVisible();
  await expect(page.getByText(/Add your name so people know who you are/i)).toBeVisible();
  await expect(
    page.getByText(/Add your Wallet of Satoshi address so gifts can reach you/i),
  ).toBeVisible();

  await page.getByLabel('Name').fill('Ada');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByText('Ada')).toBeVisible();

  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByRole('button', { name: 'Link address' }).click();

  await expect(page.getByText('alice@walletofsatoshi.com')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Unlink' })).toBeVisible();
  await expect(page.getByRole('button', { name: /verify/i })).toHaveCount(0);
  await expect(page.getByText(/not yet verified/i)).toHaveCount(0);
  await expect(page.getByText('Verified')).toHaveCount(0);

  await page.getByRole('button', { name: 'Unlink' }).click();
  await expect(page.getByRole('button', { name: 'Link address' })).toBeVisible();
  await expect(page.getByText('Ada')).toBeVisible();
  await expect(page.getByText(/Add your name so people know who you are/i)).toHaveCount(0);

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('button', { name: 'Create a passkey' })).toBeVisible();
});
