import { expect, test, type Page } from '@playwright/test';

const NAME_INVALID = 'Use 1–32 characters: a-z, 0-9, hyphen, underscore, or dot.';

type FakeWebAuthnOptions = {
  createThrows?: boolean;
  getSucceeds?: boolean;
};

type PasskeyCapture = {
  createCount: number;
  name: string | undefined;
  displayName: string | undefined;
  userId: string | undefined;
};

function uniqueMixedHandle(): string {
  const noise = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `A${noise}`.slice(0, 32);
}

function isRegisterBegin(url: string): boolean {
  return url.includes('/auth/passkey/register/begin');
}

function isRegisterFinish(url: string): boolean {
  return url.includes('/auth/passkey/register/finish');
}

function isAuthenticateBegin(url: string): boolean {
  return url.includes('/auth/passkey/authenticate/begin');
}

function isAuthenticateFinish(url: string): boolean {
  return url.includes('/auth/passkey/authenticate/finish');
}

async function installFakeWebAuthn(page: Page, options: FakeWebAuthnOptions = {}): Promise<void> {
  await page.addInitScript((opts: FakeWebAuthnOptions) => {
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
      getClientExtensionResults: () => ({
        prf: { results: { first: new Uint8Array(32).fill(7) } },
      }),
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
    const capture = window as unknown as {
      __passkeyCreateCount: number;
      __passkeyUserName?: string;
      __passkeyUserDisplayName?: string;
      __passkeyUserId?: string;
    };
    capture.__passkeyCreateCount = 0;
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: {
        create: async (options?: CredentialCreationOptions) => {
          capture.__passkeyCreateCount += 1;
          const publicKey = options?.publicKey;
          if (publicKey?.user) {
            capture.__passkeyUserName = publicKey.user.name;
            capture.__passkeyUserDisplayName = publicKey.user.displayName;
            capture.__passkeyUserId = new TextDecoder().decode(publicKey.user.id);
          }
          if (opts.createThrows === true) {
            throw new DOMException('No credentials', 'NotAllowedError');
          }
          if (!publicKey || !isBytes(publicKey.challenge) || !isBytes(publicKey.user?.id)) {
            throw new Error('invalid creation options');
          }
          return attestation;
        },
        get: async (options?: CredentialRequestOptions) => {
          const publicKey = options?.publicKey;
          if (!publicKey || !isBytes(publicKey.challenge)) {
            throw new Error('invalid request options');
          }
          if (opts.getSucceeds !== true) {
            throw new DOMException('No credentials', 'NotAllowedError');
          }
          return assertion;
        },
      },
    });
  }, options);
}

async function passkeyCapture(page: Page): Promise<PasskeyCapture> {
  return page.evaluate(() => {
    const capture = window as unknown as {
      __passkeyCreateCount?: number;
      __passkeyUserName?: string;
      __passkeyUserDisplayName?: string;
      __passkeyUserId?: string;
    };
    return {
      createCount: capture.__passkeyCreateCount ?? 0,
      name: capture.__passkeyUserName,
      displayName: capture.__passkeyUserDisplayName,
      userId: capture.__passkeyUserId,
    };
  });
}

async function openNameForm(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(
    page.getByRole('heading', { name: 'Do you already have an account?' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Open a new account' }).click();
  await expect(page.getByRole('heading', { name: 'Choose your name' })).toBeVisible();
}

test('passkey name mixed-case unique handle is user.name not user.id', async ({ page }) => {
  await installFakeWebAuthn(page);
  const mixed = uniqueMixedHandle();
  const name = mixed.toLowerCase();
  await openNameForm(page);
  const beginRequestPromise = page.waitForRequest(
    (req) => req.method() === 'POST' && isRegisterBegin(req.url()),
  );
  const finishResponsePromise = page.waitForResponse(
    (res) => res.request().method() === 'POST' && isRegisterFinish(res.url()),
  );
  await page.getByRole('textbox', { name: 'Name' }).fill(mixed);
  await page.getByRole('button', { name: 'Continue' }).click();
  const beginRequest = await beginRequestPromise;
  expect(beginRequest.postDataJSON()).toEqual({ name });
  const finishResponse = await finishResponsePromise;
  expect(finishResponse.status()).toBe(200);
  const finishBody = (await finishResponse.json()) as {
    account: { id: string; name: string; username: string; setup: string };
  };
  const capture = await passkeyCapture(page);
  expect(capture.name).toBe(name);
  expect(capture.displayName).toBe(name);
  expect(capture.userId).not.toBe(name);
  expect(finishBody.account.id).toBe(capture.userId);
  expect(finishBody.account.name).toBe(name);
  expect(finishBody.account.username).toBe(name);
  expect(finishBody.account.setup).toBe('rules');
  await expect(page).toHaveURL(/\/setup\/rules/, { timeout: 10_000 });
});

test('passkey name taken handle stays on the form without create', async ({ page, browser }) => {
  await installFakeWebAuthn(page);
  const mixed = uniqueMixedHandle();
  await openNameForm(page);
  await page.getByRole('textbox', { name: 'Name' }).fill(mixed);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/setup\/rules/, { timeout: 10_000 });

  const secondContext = await browser.newContext({
    baseURL: 'http://localhost:3000',
    locale: 'en-US',
    extraHTTPHeaders: { 'Accept-Language': 'en' },
    timezoneId: 'UTC',
  });
  try {
    const page2 = await secondContext.newPage();
    await installFakeWebAuthn(page2);
    await openNameForm(page2);
    const beginResponsePromise = page2.waitForResponse(
      (res) => res.request().method() === 'POST' && isRegisterBegin(res.url()),
    );
    await page2.getByRole('textbox', { name: 'Name' }).fill(mixed);
    await page2.getByRole('button', { name: 'Continue' }).click();
    const beginResponse = await beginResponsePromise;
    expect(beginResponse.status()).toBe(409);
    expect(await beginResponse.json()).toEqual({ error: 'Username is already in use' });
    await expect(
      page2.getByRole('alert').filter({ hasText: 'That username is already in use.' }),
    ).toHaveText('That username is already in use.');
    expect((await passkeyCapture(page2)).createCount).toBe(0);
    await expect(page2.getByRole('heading', { name: 'Choose your name' })).toBeVisible();
  } finally {
    await secondContext.close();
  }
});

test('passkey name empty and invalid values do not open the passkey dialog', async ({ page }) => {
  const registerBegins: string[] = [];
  page.on('request', (req) => {
    if (isRegisterBegin(req.url())) {
      registerBegins.push(req.url());
    }
  });
  await installFakeWebAuthn(page);
  await openNameForm(page);

  const expectRejected = async (): Promise<void> => {
    expect(registerBegins).toEqual([]);
    expect((await passkeyCapture(page)).createCount).toBe(0);
    await expect(page.getByRole('alert').filter({ hasText: NAME_INVALID })).toHaveText(
      NAME_INVALID,
    );
    await expect(page.getByRole('heading', { name: 'Choose your name' })).toBeVisible();
  };

  await page.getByRole('button', { name: 'Continue' }).click();
  await expectRejected();

  for (const value of ['.ada', '_', 'a b']) {
    await page.getByRole('textbox', { name: 'Name' }).fill(value);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expectRejected();
  }
});

test('passkey name dismissing create returns to the name form', async ({ page }) => {
  await installFakeWebAuthn(page, { createThrows: true });
  await openNameForm(page);
  const beginRequestPromise = page.waitForRequest(
    (req) => req.method() === 'POST' && isRegisterBegin(req.url()),
  );
  await page.getByRole('textbox', { name: 'Name' }).fill(uniqueMixedHandle());
  await page.getByRole('button', { name: 'Continue' }).click();
  await beginRequestPromise;
  await expect(page.getByRole('heading', { name: 'Choose your name' })).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('passkey login of an existing passkey does not call register', async ({ page }) => {
  const registerBegins: string[] = [];
  page.on('request', (req) => {
    if (isRegisterBegin(req.url())) {
      registerBegins.push(req.url());
    }
  });
  await installFakeWebAuthn(page, { createThrows: true, getSucceeds: true });
  const authBeginPromise = page.waitForRequest(
    (req) => req.method() === 'POST' && isAuthenticateBegin(req.url()),
  );
  const authFinishPromise = page.waitForResponse((res) => isAuthenticateFinish(res.url()));
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await authBeginPromise;
  await authFinishPromise;
  await expect(page.getByRole('heading', { name: 'Choose your name' })).toHaveCount(0);
  expect(registerBegins).toEqual([]);
  expect((await passkeyCapture(page)).createCount).toBe(0);
});

test('passkey claim via view key sends viewKey and skips the name form', async ({
  page,
  request,
}) => {
  await installFakeWebAuthn(page);
  const created = await request.post('http://127.0.0.1:3001/e2e/unclaimed-profile');
  expect(created.status()).toBe(200);
  const profile = (await created.json()) as { viewKey: string; id: string; name: string };
  expect(profile).toEqual({
    viewKey: expect.stringMatching(/^[0-9a-f]{64}$/),
    id: expect.stringMatching(/^acc_/),
    name: 'Ada',
  });
  await page.goto(`/view/${profile.viewKey}`);
  await expect(page.getByRole('button', { name: 'Activate' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Choose your name' })).toHaveCount(0);
  const beginRequestPromise = page.waitForRequest(
    (req) => req.method() === 'POST' && isRegisterBegin(req.url()),
  );
  await page.getByRole('button', { name: 'Activate' }).click();
  const beginRequest = await beginRequestPromise;
  expect(beginRequest.postDataJSON()).toEqual({ viewKey: profile.viewKey });
  await expect.poll(async () => (await passkeyCapture(page)).createCount).toBe(1);
  const capture = await passkeyCapture(page);
  expect(capture.name).toBe(profile.id);
  expect(capture.displayName).toBe('Ada');
  expect(capture.userId).toBe(profile.id);
});
