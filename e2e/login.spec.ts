import { expect, test, type Page } from '@playwright/test';
import { RULES_CHAPTER_IDS } from '../src/lib/rules-chapters';

async function agreeToLivingRoomRules(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/setup\/rules/);
  for (let i = 0; i < RULES_CHAPTER_IDS.length; i += 1) {
    await expect(
      page.getByText(`${i + 1} of ${RULES_CHAPTER_IDS.length}`, { exact: true }),
    ).toBeVisible();
    if (i < RULES_CHAPTER_IDS.length - 1) {
      await page.getByRole('button', { name: 'Continue' }).click();
    } else {
      await page.getByRole('button', { name: 'I agree to these rules' }).click();
    }
  }
}

async function installFakeWebAuthn(page: Page, alreadyRegistered = false): Promise<void> {
  await page.addInitScript((registeredStart: boolean) => {
    const pk = globalThis.PublicKeyCredential as unknown as {
      parseCreationOptionsFromJSON?: unknown;
      parseRequestOptionsFromJSON?: unknown;
    };
    if (typeof pk === 'function' || (typeof pk === 'object' && pk !== null)) {
      Object.defineProperty(pk, 'parseCreationOptionsFromJSON', {
        value: undefined,
        configurable: true,
      });
      Object.defineProperty(pk, 'parseRequestOptionsFromJSON', {
        value: undefined,
        configurable: true,
      });
    }
    const rawId = crypto.getRandomValues(new Uint8Array(16)).buffer;
    const idBytes = new Uint8Array(rawId);
    let binary = '';
    for (const byte of idBytes) {
      binary += String.fromCharCode(byte);
    }
    const id = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
    const attestation = {
      id,
      rawId,
      type: 'public-key',
      getClientExtensionResults: () => ({}),
      response: {
        clientDataJSON: new Uint8Array([123]).buffer,
        attestationObject: new Uint8Array([2]).buffer,
      },
    };
    const assertion = {
      ...attestation,
      response: {
        clientDataJSON: new Uint8Array([123]).buffer,
        authenticatorData: new Uint8Array([3]).buffer,
        signature: new Uint8Array([4]).buffer,
        userHandle: null,
      },
    };
    const isBytes = (value: unknown): boolean =>
      value instanceof ArrayBuffer || ArrayBuffer.isView(value);
    let registered = registeredStart;
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: {
        create: async (options?: CredentialCreationOptions) => {
          const publicKey = options?.publicKey;
          if (!publicKey || !isBytes(publicKey.challenge) || !isBytes(publicKey.user?.id)) {
            throw new Error('invalid creation options');
          }
          registered = true;
          return attestation;
        },
        get: async (options?: CredentialRequestOptions) => {
          const publicKey = options?.publicKey;
          if (!publicKey || !isBytes(publicKey.challenge)) {
            throw new Error('invalid request options');
          }
          if (!registered) {
            throw new DOMException('No credentials', 'NotAllowedError');
          }
          return assertion;
        },
      },
    });
  }, alreadyRegistered);
}

async function confirmNewAccount(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { name: 'Do you already have an account?' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Open a new account' }).click();
}

test('login page renders a single Log in button', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Create a passkey' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue with passkey' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create a login' })).toHaveCount(0);
});

test('login shows Preparing your login while passkey begin hangs', async ({ page }) => {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/auth\/passkey\/authenticate\/begin$/, async (route) => {
    await held;
    await route.abort();
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText('Preparing your login…')).toBeVisible();
  release();
});

test('login shows an error when passkey begin fails', async ({ page }) => {
  await page.route(/\/auth\/passkey\/authenticate\/begin$/, async (route) => {
    await route.fulfill({ status: 503, body: 'unavailable' });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText('Something went wrong. Please try again.')).toBeVisible();
});

test('login Try again restarts the single-button flow', async ({ page }) => {
  let authenticateBegins = 0;
  let registerBegins = 0;
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/auth\/passkey\/authenticate\/begin$/, async (route) => {
    authenticateBegins += 1;
    if (authenticateBegins === 1) {
      await route.fulfill({ status: 503, body: 'unavailable' });
      return;
    }
    await held;
    await route.abort();
  });
  await page.route(/\/auth\/passkey\/register\/begin$/, async (route) => {
    registerBegins += 1;
    await route.abort();
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText('Something went wrong. Please try again.')).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Preparing your login…')).toBeVisible();
  await expect.poll(() => authenticateBegins).toBe(2);
  expect(registerBegins).toBe(0);
  release();
});

test('login in-app browser shows escape card instead of Log in', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { TelegramWebviewProxy: { postEvent() {} } });
  });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Open this page in your browser' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open in browser' })).toBeVisible();
});

test('login NotAllowedError shows an account choice instead of creating', async ({ page }) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(
    page.getByRole('heading', { name: 'Do you already have an account?' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in with existing account' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open a new account' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/\/login/);
});

test('login Open a new account creates a passkey after the choice', async ({ page }) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await confirmNewAccount(page);
  await expect(page).toHaveURL(/\/setup\/name/, { timeout: 10_000 });
});

test('login Log in with existing account does not start register', async ({ page }) => {
  let registerBegins = 0;
  await page.route(/\/auth\/passkey\/register\/begin$/, async (route) => {
    registerBegins += 1;
    await route.abort();
  });
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(
    page.getByRole('heading', { name: 'Do you already have an account?' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Log in with existing account' }).click();
  await expect(
    page.getByRole('heading', { name: 'Do you already have an account?' }),
  ).toBeVisible();
  expect(registerBegins).toBe(0);
});

const E2E_ACCOUNT = {
  id: 'acc_e2e',
  linkingKey: `02${'a'.repeat(62)}`,
  role: 'basis' as const,
  name: null as string | null,
  location: null as string | null,
  lightningAddress: null as string | null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: null as number | null,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  setup: 'name' as 'name' | 'lightning-address' | 'rules' | null,
  missing: ['name', 'lightning-address', 'rules'] as Array<'name' | 'lightning-address' | 'rules'>,
};

test('login with an existing passkey skips the account choice', async ({ page }) => {
  await page.route(/\/auth\/passkey\/authenticate\/finish$/, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'sess-e2e', account: E2E_ACCOUNT }),
    });
  });
  await page.route(/\/me$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(E2E_ACCOUNT),
    });
  });
  await installFakeWebAuthn(page, true);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/setup\/name/, { timeout: 10_000 });
  await expect(page.getByRole('heading', { name: 'Do you already have an account?' })).toHaveCount(
    0,
  );
});

test('signed-in session hydrates, then saves a name, links an address, and reaches welcome', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });

  await page.route(/\/me\/name$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...E2E_ACCOUNT,
        name: 'Ada',
        setup: 'lightning-address',
        missing: ['lightning-address', 'rules'],
      }),
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
          name: 'Ada',
          lightningAddress: 'alice@walletofsatoshi.com',
          setup: 'rules',
          missing: ['rules'],
        }),
      });
      return;
    }
    if (method === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          lightningAddress: null,
          setup: 'lightning-address',
          missing: ['lightning-address', 'rules'],
        }),
      });
      return;
    }
    await route.continue();
  });
  await page.route(/\/me\/rules-agreement$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...E2E_ACCOUNT,
        name: 'Ada',
        lightningAddress: 'alice@walletofsatoshi.com',
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(E2E_ACCOUNT),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [] }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/login');
  await expect(page).toHaveURL(/\/setup\/name/);
  await expect(page.getByRole('heading', { name: 'Your name' })).toBeVisible();
  await expect(page.getByText(/Add your name so people know who you are/i)).toBeVisible();
  await expect(
    page.getByText(/Add your Wallet of Satoshi address so gifts can reach you/i),
  ).toHaveCount(0);

  await page.getByRole('textbox', { name: 'Name' }).fill('Ada');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/setup\/address/);
  await expect(page.getByRole('heading', { name: 'Your Wallet of Satoshi address' })).toBeVisible();
  await expect(page.getByText('Hi, Ada')).toBeVisible();
  await expect(
    page.getByText(/Add your Wallet of Satoshi address so gifts can reach you/i),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toHaveCount(0);

  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(/\/setup\/rules/);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  await agreeToLivingRoomRules(page);

  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await expect(page.getByLabel('Your message')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Send a gift' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Unlink' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /verify/i })).toHaveCount(0);

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
});
