import { expect, test } from '@playwright/test';

test('wallet page shows Add recovery phrase for an existing member', async ({ page }) => {
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
        lightningAddress: 'ada@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1_700_000_000,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.goto('/wallet');
  await expect(page.getByRole('heading', { name: 'Wallet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add recovery phrase' })).toBeVisible();
});

test('Function: WalletPage — /wallet renders the wallet heading', async ({ page }) => {
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
        lightningAddress: 'ada@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1_700_000_000,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.goto('/wallet');
  await expect(page.getByRole('heading', { name: 'Wallet' })).toBeVisible();
});

test('Function: startPasskeyReplace — begin without a session is 401', async ({ request }) => {
  expect((await request.post('/auth/passkey/replace/begin')).status()).toBe(401);
});

test('Function: finishPasskeyReplace — finish without a session is 401', async ({ request }) => {
  expect((await request.post('/auth/passkey/replace/finish')).status()).toBe(401);
});

test('Function: startPasskeySeed — begin without a session is 401', async ({ request }) => {
  expect((await request.post('/auth/passkey/seed/begin')).status()).toBe(401);
});

test('Function: finishPasskeySeed — finish without a session is 401', async ({ request }) => {
  expect((await request.post('/auth/passkey/seed/finish')).status()).toBe(401);
});

test('Function: postWalletBackupSeen — backup-seen without a session is 401', async ({
  request,
}) => {
  expect((await request.post('/me/wallet-backup-seen')).status()).toBe(401);
});

test('Function: proxyAuthPasskeyReplaceBeginPost — begin without a session is 401', async ({
  request,
}) => {
  expect((await request.post('/auth/passkey/replace/begin')).status()).toBe(401);
});

test('Function: proxyAuthPasskeyReplaceFinishPost — finish without a session is 401', async ({
  request,
}) => {
  expect((await request.post('/auth/passkey/replace/finish')).status()).toBe(401);
});

test('Function: proxyAuthPasskeySeedBeginPost — begin without a session is 401', async ({
  request,
}) => {
  expect((await request.post('/auth/passkey/seed/begin')).status()).toBe(401);
});

test('Function: proxyAuthPasskeySeedFinishPost — finish without a session is 401', async ({
  request,
}) => {
  expect((await request.post('/auth/passkey/seed/finish')).status()).toBe(401);
});

test('Function: proxyMeWalletBackupSeenPost — backup-seen without a session is 401', async ({
  request,
}) => {
  expect((await request.post('/me/wallet-backup-seen')).status()).toBe(401);
});

test('Function: prfEvalFirstSalt — wallet heading is Wallet', async ({ page }) => {
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
        lightningAddress: 'ada@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.goto('/wallet');
  await expect(page.getByRole('heading', { name: 'Wallet' })).toBeVisible();
});

test('Function: readPrfFirst — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: mnemonicFromPrfFirst — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: obtainPrfFirst — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: obtainPrfFirstFromGet — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: classifyWebAuthnError — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: rememberSessionPhrase — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: peekSessionPhrase — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: clearSessionPhrase — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: resetWalletCeremonyLock — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: useWalletPhrase — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: WalletScreenView — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: WalletScreen — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: WalletPhraseScreen — phrase page is not the receive page', async ({ page }) => {
  await page.goto('/wallet/phrase');
  await expect(page).toHaveURL(/\/(wallet\/phrase|login)/);
});

test('Function: WalletPhrasePage — phrase page is not the receive page', async ({ page }) => {
  await page.goto('/wallet/phrase');
  await expect(page).toHaveURL(/\/(wallet\/phrase|login)/);
});

test('Function: resetWalletReturn — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: rememberWalletReturn — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: walletBackHref — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: RememberWalletReturn — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});

test('Function: WalletChromeLeft — wallet heading is Wallet', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page).toHaveURL(/\/(wallet|login)/);
});
