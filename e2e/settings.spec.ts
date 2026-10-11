import { expect, test, type Page } from '@playwright/test';

/**
 * Signed-in member; `passkeyCredentialId` decides which recovery control `/settings` shows.
 * `extra` overrides account fields (for example a missing username).
 */
async function signIn(
  page: Page,
  passkeyCredentialId: string | null,
  extra: Record<string, unknown> = {},
): Promise<void> {
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
        ...extra,
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

test('the signed-in Menu lists Home and Balance first and opens /settings from Settings, right after Grants', async ({
  page,
}) => {
  await signIn(page, 'cred-seed');
  await page.goto('/wallet');
  await page.getByRole('button', { name: 'Menu' }).click();
  // The account header's profile and balance links come before the rows.
  const rows = page.locator('#signed-in-menu > a');
  const names = (await rows.allInnerTexts()).map((name) => name.trim());
  expect(names.slice(0, 2)).toEqual(['Home', 'Balance']);
  const grants = names.indexOf('Grants');
  expect(grants).toBeGreaterThanOrEqual(0);
  expect(names[grants + 1]).toBe('Settings');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
});

test('settings sends a signed-out visitor to log in', async ({ page }) => {
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/login/);
});

test('settings shows Wallet, Display, Notifications, Account, and About & legal in that order', async ({
  page,
}) => {
  await signIn(page, 'cred-seed');
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    'Wallet',
    'Display',
    'Notifications',
    'Account',
    'About & legal',
  ]);
  const display = page.getByRole('region', { name: 'Display' });
  for (const name of ['Language', 'Theme', 'Fiat currency', 'Number format']) {
    await expect(display.getByRole('group', { name })).toBeVisible();
  }
  await expect(display.getByText('Saved on this device')).toHaveCount(2);
  const notifications = page.getByRole('region', { name: 'Notifications' });
  await expect(notifications.getByRole('group', { name: 'Living room' })).toBeVisible();
  await expect(notifications.getByRole('group', { name: 'Hearts' })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Account' }).getByRole('button', { name: 'Log out' }),
  ).toBeVisible();
  const about = page.getByRole('region', { name: 'About & legal' });
  await expect(about.getByRole('link')).toHaveText([
    'Handbook',
    'Legal & Privacy',
    'Terms of Use',
    'Living room rules',
    'Contact',
  ]);
  await expect(about.getByText(/^Version /)).toBeVisible();
});

test('settings About & legal opens the terms without a page load', async ({ page }) => {
  await signIn(page, 'cred-seed');
  await page.goto('/settings');
  await page.evaluate(() => {
    (window as unknown as { settingsMarker?: boolean }).settingsMarker = true;
  });
  await page
    .getByRole('region', { name: 'About & legal' })
    .getByRole('link', { name: 'Terms of Use' })
    .click();
  await expect(page).toHaveURL(/\/terms$/);
  expect(
    await page.evaluate(() => (window as unknown as { settingsMarker?: boolean }).settingsMarker),
  ).toBe(true);
});

test('settings shows the 21.gifts address and copies it', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signIn(page, 'cred-seed');
  await page.goto('/settings');
  const wallet = page.getByRole('region', { name: 'Wallet' });
  await expect(wallet.getByText('ada@21.gifts')).toBeVisible();
  await wallet.getByRole('button', { name: 'Copy 21.gifts address' }).click();
  await expect(wallet.getByText('Copied')).toBeAttached();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('ada@21.gifts');
});

test('settings offers the username form while no username is set', async ({ page }) => {
  await signIn(page, 'cred-seed', { username: null });
  await page.route(/\/me\/username$/, async (route) => {
    const body = route.request().postDataJSON() as { username?: string };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: `02${'a'.repeat(62)}`,
        role: 'basis',
        name: 'Ada',
        username: body.username,
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
        walletRequired: true,
        walletBackupSeenAt: 1,
        passkeyCredentialId: 'cred-seed',
      }),
    });
  });
  await page.goto('/settings');
  const wallet = page.getByRole('region', { name: 'Wallet' });
  await expect(wallet.getByText('Set a username first.')).toBeVisible();
  await wallet.getByRole('textbox').fill('grace');
  await wallet.getByRole('button', { name: 'Continue' }).click();
  await expect(wallet.getByText('grace@21.gifts')).toBeVisible();
  await expect(wallet.getByText('Set a username first.')).toHaveCount(0);
});

test('Function: saveAmountUnit — the Settings default amount saves fiat on the account', async ({
  page,
}) => {
  await signIn(page, 'cred-seed');
  await page.route(/\/me\/amount-unit$/, async (route) => {
    const body = route.request().postDataJSON() as { unit?: string };
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
        amountUnit: body.unit === 'fiat' ? 'fiat' : 'btc',
      }),
    });
  });
  await page.goto('/settings');
  const group = page.getByRole('group', { name: 'Default amount' });
  await expect(group.getByRole('button', { name: '₿' })).toHaveAttribute('aria-pressed', 'true');
  const saved = page.waitForRequest(
    (req) => req.method() === 'POST' && req.url().includes('/me/amount-unit'),
  );
  await group.getByRole('button', { name: 'USD' }).click();
  expect((await saved).postDataJSON()).toEqual({ unit: 'fiat' });
  await expect(group.getByRole('button', { name: 'USD' })).toHaveAttribute('aria-pressed', 'true');
});

test('the notifications page links to the Settings notifications section', async ({ page }) => {
  await signIn(page, 'cred-seed');
  await page.route(/\/forum\/notifications(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notifications: [], unreadCount: 0 }),
    });
  });
  await page.goto('/notifications');
  await page.getByRole('link', { name: 'Notification settings' }).click();
  await expect(page).toHaveURL(/\/settings#notifications$/);
  await expect(page.getByRole('region', { name: 'Notifications' })).toBeInViewport();
});

test('the wallet links Back up your wallet to the Settings recovery entry without a phrase', async ({
  page,
}) => {
  await signIn(page, null);
  await page.goto('/wallet');
  await page.getByRole('link', { name: 'Back up your wallet' }).click();
  await expect(page).toHaveURL(/\/settings#recovery$/);
  await expect(page.getByRole('link', { name: 'Add recovery phrase' })).toBeInViewport();
});

test('the wallet shows no Back up your wallet link once the account has a phrase', async ({
  page,
}) => {
  await signIn(page, 'cred-seed');
  await page.goto('/wallet');
  await expect(page.getByRole('button', { name: 'Receive' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back up your wallet' })).toHaveCount(0);
});

test('Receive without a username links to the Settings address row', async ({ page }) => {
  await signIn(page, 'cred-seed', { username: null });
  await page.goto('/wallet');
  await page.getByRole('button', { name: 'Receive' }).click();
  await page.getByRole('link', { name: 'Set a username first.' }).click();
  await expect(page).toHaveURL(/\/settings#address$/);
  await expect(page.getByText('Set a username first.')).toBeInViewport();
});
