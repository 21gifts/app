import { expect, test, type Page } from '@playwright/test';

/**
 * A stored session that is held back after a reload: the wallet phrase lives
 * in tab memory only, so the session counts as signed in again only after the
 * login card's passkey prompt. `?visual=held-session` (Playwright builds only)
 * holds back the session found in storage; a login in the tab then counts as
 * open, as it does once a real wallet has opened.
 */

/** A member account as `/me` and the login answer it. */
function memberAccount(id: string, name: string, username: string): Record<string, unknown> {
  return {
    id,
    linkingKey: `02${'a'.repeat(62)}`,
    role: 'basis',
    name,
    username,
    location: null,
    lightningAddress: null,
    lightningAddressVerified: false,
    forumLawsDismissed: true,
    hasPosted: true,
    createdAt: 1_700_000_000,
    rulesAgreedAt: 1,
    viewKey: 'a'.repeat(64),
    aboutMe: null,
    aboutMeHasPhoto: false,
    setup: null,
    missing: [],
    walletRequired: true,
    walletBackupSeenAt: 1,
    passkeyCredentialId: 'AQIDBAUGBwgJCgsMDQ4PEA',
  };
}

const ADA = memberAccount('acc_e2e', 'Ada', 'ada');
const BOB = memberAccount('acc_bob', 'Bob', 'bob');

/** Stores Ada's session before the page loads, as a reload finds it. */
async function storeHeldSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route(/\/me$/, async (route) => {
    const bob = route.request().headers()['authorization'] === 'Bearer sess-bob';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(bob ? BOB : ADA),
    });
  });
}

/**
 * Stubs the passkey prompt (counted in `sessionStorage` as
 * `e2e.credentialGets`) and the login that answers with `token` for `account`.
 * With `dismiss`, the prompt is dismissed instead.
 */
async function stubLogin(
  page: Page,
  answer: { token: string; account: Record<string, unknown> } | 'dismiss',
): Promise<void> {
  await page.addInitScript((dismiss: boolean) => {
    if (sessionStorage.getItem('e2e.credentialGets') === null) {
      sessionStorage.setItem('e2e.credentialGets', '0');
    }
    const pk = globalThis.PublicKeyCredential as unknown as {
      parseRequestOptionsFromJSON?: unknown;
    };
    if (typeof pk === 'function' || (typeof pk === 'object' && pk !== null)) {
      Object.defineProperty(pk, 'parseRequestOptionsFromJSON', {
        value: undefined,
        configurable: true,
      });
    }
    const assertion = {
      id: 'AQIDBAUGBwgJCgsMDQ4PEA',
      rawId: Uint8Array.from({ length: 16 }, (_, i) => i + 1).buffer,
      type: 'public-key',
      getClientExtensionResults: () => ({}),
      response: {
        clientDataJSON: new Uint8Array([123]).buffer,
        authenticatorData: new Uint8Array([3]).buffer,
        signature: new Uint8Array([4]).buffer,
        userHandle: null,
      },
    };
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: {
        create: async () => {
          throw new DOMException('Not used here', 'NotAllowedError');
        },
        get: async () => {
          const count = Number(sessionStorage.getItem('e2e.credentialGets') ?? '0') + 1;
          sessionStorage.setItem('e2e.credentialGets', String(count));
          if (dismiss) {
            throw new DOMException('The prompt was dismissed', 'NotAllowedError');
          }
          return assertion;
        },
      },
    });
  }, answer === 'dismiss');
  await page.route('**/auth/passkey/authenticate/begin', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        challengeId: 'ch-auth',
        options: { challenge: 'aa', rpId: 'localhost', allowCredentials: [] },
      }),
    });
  });
  if (answer !== 'dismiss') {
    await page.route('**/auth/passkey/authenticate/finish', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(answer),
      });
    });
  }
}

/** Number of passkey prompts so far (see {@link stubLogin}). */
async function credentialGets(page: Page): Promise<number> {
  return page.evaluate(() => Number(sessionStorage.getItem('e2e.credentialGets') ?? '0'));
}

test('held-back session: a reload on /welcome shows the login card, not the guest feed', async ({
  page,
}) => {
  await storeHeldSession(page);
  await page.goto('/welcome?visual=held-session');
  await expect(page.getByText('Welcome back, Ada')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Log in with your device' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
  await expect(page.getByText('New to 21.gifts?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open a new account' })).toBeVisible();
  // No second way out of the card, and nothing of the guest view.
  await expect(page.getByRole('button', { name: 'Log out' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Welcome', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Log in', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Menu/ })).toHaveCount(0);
  await expect(page).toHaveURL(/\/welcome\?visual=held-session$/);
});

test('Function: hydratesLocked — held-back session: one passkey prompt brings the member back to /welcome', async ({
  page,
}) => {
  await storeHeldSession(page);
  await stubLogin(page, { token: 'sess-e2e', account: ADA });
  await page.goto('/welcome?visual=held-session');
  await expect(page.getByText('Welcome back, Ada')).toBeVisible();
  expect(await credentialGets(page)).toBe(0);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Menu/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/\/welcome\?visual=held-session$/);
  expect(await credentialGets(page)).toBe(1);
});

test("held-back session: another account's passkey replaces the held session", async ({ page }) => {
  await storeHeldSession(page);
  await stubLogin(page, { token: 'sess-bob', account: BOB });
  await page.goto('/welcome?visual=held-session');
  await expect(page.getByText('Welcome back, Ada')).toBeVisible();
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Bob' })).toBeVisible();
  await expect(page.getByText('Welcome back, Ada')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('21gifts.session'))).toBe('sess-bob');
  expect(await credentialGets(page)).toBe(1);
});

test('held-back session: a dismissed prompt stays on the card with the retry message', async ({
  page,
}) => {
  await storeHeldSession(page);
  await stubLogin(page, 'dismiss');
  await page.goto('/welcome?visual=held-session');
  const login = page.getByRole('button', { name: 'Log in', exact: true });
  await login.click();
  await expect(page.getByRole('alert')).toHaveText('Something went wrong. Please try again.');
  await expect(page.getByText('Welcome back, Ada')).toBeVisible();
  await expect(login).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Do you already have an account?' })).toHaveCount(
    0,
  );
  expect(await page.evaluate(() => localStorage.getItem('21gifts.session'))).toBe('sess-e2e');
});

test('held-back session: /login is the ordinary login with a greeting and no Log out', async ({
  page,
}) => {
  await storeHeldSession(page);
  await page.goto('/login?visual=held-session');
  await expect(page.getByText('Welcome back, Ada')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Log in with your device' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open a new account' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log out' })).toHaveCount(0);
  await expect(page).toHaveURL(/\/login\?visual=held-session$/);
});

test('a signed-out visitor keeps the guest /welcome and the ordinary login', async ({ page }) => {
  await page.goto('/welcome?visual=held-session');
  await expect(page.getByRole('heading', { name: 'Welcome', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Log in with your device' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open a new account' })).toBeVisible();
  await expect(page.getByText(/Welcome back/)).toHaveCount(0);
});
