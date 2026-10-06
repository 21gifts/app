import { expect, test, type Page } from '@playwright/test';

/** Signed-in member; `passkeyCredentialId` decides which recovery control `/settings` shows. */
async function signIn(page: Page, passkeyCredentialId: string | null): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: `02${'a'.repeat(62)}`,
        role: 'basis',
        name: 'Ada',
        username: 'ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1_700_000_000,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
        ...(passkeyCredentialId === null
          ? {}
          : { walletRequired: true, walletBackupSeenAt: 1, passkeyCredentialId }),
      }),
    });
  });
}

test('Function: SettingsPage — /settings shows the Settings heading and a Wallet section', async ({
  page,
}) => {
  await signIn(page, 'cred-seed');
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Wallet' })).toBeVisible();
});

test('Function: SettingsScreen — Recovery phrase opens /wallet/phrase and Back returns to /settings', async ({
  page,
}) => {
  await signIn(page, 'cred-seed');
  await page.goto('/settings');
  const section = page.getByRole('region', { name: 'Wallet' });
  await expect(section.getByRole('link', { name: 'Recovery phrase', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add recovery phrase' })).toHaveCount(0);
  await section.getByRole('link', { name: 'Recovery phrase', exact: true }).click();
  await expect(page).toHaveURL(/\/wallet\/phrase$/);
  await expect(page.getByRole('button', { name: 'Show recovery phrase' })).toBeVisible();
  await page.getByRole('link', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
});

test('settings offers the add hint and Add recovery phrase without a recovery passkey', async ({
  page,
}) => {
  await signIn(page, null);
  await page.goto('/settings');
  const section = page.getByRole('region', { name: 'Wallet' });
  await expect(
    section.getByText(
      'This creates a recovery phrase on this device. Your existing login passkey stays.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Recovery phrase', exact: true })).toHaveCount(0);
  await section.getByRole('link', { name: 'Add recovery phrase' }).click();
  await expect(page).toHaveURL(/\/wallet\/phrase$/);
  await expect(page.getByRole('button', { name: 'Add recovery phrase' })).toBeVisible();
});

test('the signed-in Menu opens /settings from Settings, right after Wallet', async ({ page }) => {
  await signIn(page, 'cred-seed');
  await page.goto('/wallet');
  await page.getByRole('button', { name: 'Menu' }).click();
  const rows = page.locator('#signed-in-menu a');
  const names = await rows.allInnerTexts();
  const wallet = names.findIndex((name) => name.trim() === 'Wallet');
  expect(wallet).toBeGreaterThanOrEqual(0);
  expect(names[wallet + 1]?.trim()).toBe('Settings');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
});

test('settings sends a signed-out visitor to log in', async ({ page }) => {
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/login/);
});
