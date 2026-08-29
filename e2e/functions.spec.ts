import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const PAY_INVOICE = 'lnbc21n1exampleinvoice';

const POPULATED_STATS = {
  totalSats: 1500,
  totalBtc: '0.00001500',
  totalUsd: '1.43',
  giftCount: 3,
  recipientCount: 2,
  firstPaidAt: '2026-06-01T00:00:00.000Z',
  lastPaidAt: '2026-07-01T00:00:00.000Z',
  spendOverTime: [
    {
      day: '2026-06-01',
      sats: 500,
      cumulativeSats: 500,
      btc: '0.00000500',
      cumulativeBtc: '0.00000500',
      usd: '0.48',
      cumulativeUsd: '0.48',
    },
    {
      day: '2026-06-02',
      sats: 0,
      cumulativeSats: 500,
      btc: '0.00000000',
      cumulativeBtc: '0.00000500',
      usd: '0.00',
      cumulativeUsd: '0.48',
    },
    {
      day: '2026-07-01',
      sats: 1000,
      cumulativeSats: 1500,
      btc: '0.00001000',
      cumulativeBtc: '0.00001500',
      usd: '0.95',
      cumulativeUsd: '1.43',
    },
  ],
  byRecipient: [
    { recipient: 'alice', giftCount: 2, sats: 1000, btc: '0.00001000', usd: '0.95' },
    { recipient: 'bob', giftCount: 1, sats: 500, btc: '0.00000500', usd: '0.48' },
  ],
  byMonth: [
    { month: '2026-06', giftCount: 2, sats: 500, btc: '0.00000500', usd: '0.48' },
    { month: '2026-07', giftCount: 1, sats: 1000, btc: '0.00001000', usd: '0.95' },
  ],
  fx: {
    quote: 'BTC-USD',
    dayBasis: 'utc',
    source: 'coinbase-exchange-daily-close',
  },
};

const EMPTY_STATS = {
  totalSats: 0,
  totalBtc: '0.00000000',
  totalUsd: '0.00',
  giftCount: 0,
  recipientCount: 0,
  firstPaidAt: null,
  lastPaidAt: null,
  spendOverTime: [],
  byRecipient: [],
  byMonth: [],
  fx: {
    quote: 'BTC-USD',
    dayBasis: 'utc',
    source: 'coinbase-exchange-daily-close',
  },
};

async function stubPayableNote(page: Page): Promise<void> {
  await page.route('**/messages', async (route) => {
    const url = route.request().url();
    if (url.includes('/invoice') || route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-pay',
            name: 'Bob',
            text: 'Does anyone have spare sats this week?',
            createdAt: '2026-08-28T10:00:00.000Z',
            sats: 0,
            payable: true,
          },
        ],
      }),
    });
  });
  await page.route('**/messages/m-pay/invoice', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pr: PAY_INVOICE, amountSats: 21 }),
    });
  });
}

async function openPayInvoice(page: Page, request: APIRequestContext): Promise<void> {
  await stubPayableNote(page);
  await signInViaStub(page, request);
  await saveOnboardingName(page);
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/welcome/);
  await page.getByRole('button', { name: 'Send Bitcoin' }).click();
  await page.getByLabel('Amount (sats)').fill('21');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toBeVisible();
}

async function stubGiftStats(page: Page, body: unknown): Promise<void> {
  await page.route('**/gifts/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

async function openSignedInMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Menu' }).click();
}

async function seedAdaSession(page: Page): Promise<void> {
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
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        createdAt: 1,
      }),
    });
  });
}

async function signInViaStub(page: Page, _request: APIRequestContext): Promise<void> {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/setup\/name/, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
}

async function saveOnboardingName(page: Page): Promise<void> {
  await page.getByRole('textbox', { name: 'Name' }).fill('Ada');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/setup\/address/);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
}

async function installFakeWebAuthn(page: Page): Promise<void> {
  await page.addInitScript(() => {
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
    let registered = false;
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
  });
}

async function signInWithPasskeyThenAgain(page: Page): Promise<void> {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/setup\/name/, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  await openSignedInMenu(page);
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/setup\/name/, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
}

async function loginHttp(request: APIRequestContext): Promise<string> {
  const begin = await request.post('/auth/passkey/register/begin');
  expect(begin.status()).toBe(200);
  const started = (await begin.json()) as { challengeId: string };
  const finish = await request.post('/auth/passkey/register/finish', {
    headers: { origin: 'http://localhost:3000' },
    data: {
      challengeId: started.challengeId,
      credential: {
        id: `cred_${started.challengeId.slice(0, 8)}`,
        rawId: 'YQ',
        type: 'public-key',
      },
    },
  });
  expect(finish.status()).toBe(200);
  const body = (await finish.json()) as { token: string };
  expect(body.token.length).toBeGreaterThan(8);
  return body.token;
}

test('Function: GET — healthz is ok', async ({ request }) => {
  const res = await request.get('/healthz');
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ status: 'ok' });
});

test('Function: getApiUrl — proxy reaches the stub', async ({ request }) => {
  const res = await request.post('/auth/passkey/register/begin');
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { challengeId: string };
  expect(body.challengeId.length).toBeGreaterThan(8);
});

test('Function: proxyApiRequest — POST passkey register begin is 200', async ({ request }) => {
  const res = await request.post('/auth/passkey/register/begin');
  expect(res.status()).toBe(200);
});

test('Function: proxyMessagesGet — GET /messages without bearer is 401', async ({ request }) => {
  expect((await request.get('/messages')).status()).toBe(401);
});

test('Function: proxyMessagesPost — POST /messages without bearer is 401', async ({ request }) => {
  expect((await request.post('/messages', { data: { text: 'hi' } })).status()).toBe(401);
});

test('Function: proxyContactPost — POST /contact/submit without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/contact/submit', { data: { text: 'hi' } })).status()).toBe(401);
});

test('Function: fetchMessages — welcome shows the empty forum', async ({ page, request }) => {
  await signInViaStub(page, request);
  await saveOnboardingName(page);
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByRole('heading', { name: 'Forum' })).toBeVisible();
  await expect(page.getByText('Loading…')).toHaveCount(0);
  await expect(page.getByText('Could not load messages. Please try again.')).toHaveCount(0);
  await expect(page.getByLabel('Your message')).toBeVisible();
});

test('Function: postMessage — posting from the composer shows the row', async ({
  page,
  request,
}) => {
  await signInViaStub(page, request);
  await saveOnboardingName(page);
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/welcome/);
  const body = `Hello from Ada ${Date.now()}`;
  await page.getByLabel('Your message').fill(body);
  await page.getByRole('button', { name: 'Post' }).click();
  await expect(page.getByText(body)).toBeVisible();
});

test('Function: postContact — sending from contact shows success', async ({ page, request }) => {
  await signInViaStub(page, request);
  await saveOnboardingName(page);
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByRole('button', { name: 'Link address' }).click();
  await expect(page).toHaveURL(/\/welcome/);
  await page.goto('/contact');
  const body = `Contact note ${Date.now()}`;
  await page.getByLabel('Your message').fill(body);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Received. We read this in the app.')).toBeVisible();
});

test('Function: proxyMeGet — GET /me with bearer is 200', async ({ request }) => {
  const token = await loginHttp(request);
  const res = await request.get('/me', { headers: { authorization: `Bearer ${token}` } });
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { role: string }).role).toBe('basis');
});

test('Function: fetchMe — reload hydrates the signed-in view', async ({ page, request }) => {
  await signInViaStub(page, request);
  await page.reload();
  await expect(page).toHaveURL(/\/setup\/name/);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('Function: proxyMeNamePost — POST /me/name sets a display name', async ({ request }) => {
  const token = await loginHttp(request);
  const res = await request.post('/me/name', {
    headers: { authorization: `Bearer ${token}` },
    data: { name: 'Ada' },
  });
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { name: string }).name).toBe('Ada');
  const me = await request.get('/me', { headers: { authorization: `Bearer ${token}` } });
  expect(((await me.json()) as { name: string }).name).toBe('Ada');
  const maxOk = await request.post('/me/name', {
    headers: { authorization: `Bearer ${token}` },
    data: { name: 'A'.repeat(80) },
  });
  expect(maxOk.status()).toBe(200);
  const tooLong = await request.post('/me/name', {
    headers: { authorization: `Bearer ${token}` },
    data: { name: 'A'.repeat(81) },
  });
  expect(tooLong.status()).toBe(400);
});

test('Function: NameForm — signed-in form saves a display name', async ({ page, request }) => {
  await signInViaStub(page, request);
  await expect(page.getByText(/Add your name so people know who you are/i)).toBeVisible();
  await page.getByRole('textbox', { name: 'Name' }).fill('Ada');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Ada')).toBeVisible();
});

test('Function: setName — signed-in form saves a display name', async ({ page, request }) => {
  await signInViaStub(page, request);
  await page.getByRole('textbox', { name: 'Name' }).fill('Ada');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Ada')).toBeVisible();
});

test('Function: POST — POST /me/lightning-address links an address', async ({ request }) => {
  const token = await loginHttp(request);
  const res = await request.post('/me/lightning-address', {
    headers: { authorization: `Bearer ${token}` },
    data: { address: 'alice@walletofsatoshi.com' },
  });
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { lightningAddress: string }).lightningAddress).toBe(
    'alice@walletofsatoshi.com',
  );
});

test('Function: proxyMeLightningAddressPost — POST links an address', async ({ request }) => {
  const token = await loginHttp(request);
  const res = await request.post('/me/lightning-address', {
    headers: { authorization: `Bearer ${token}` },
    data: { address: 'alice@walletofsatoshi.com' },
  });
  expect(res.status()).toBe(200);
  const bad = await request.post('/me/lightning-address', {
    headers: { authorization: `Bearer ${token}` },
    data: { address: 'not-an-address' },
  });
  expect(bad.status()).toBe(400);
});

test('Function: setLightningAddress — signed-in form links a Wallet of Satoshi address', async ({
  page,
  request,
}) => {
  await signInViaStub(page, request);
  await saveOnboardingName(page);
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
});

test('Function: DELETE — DELETE /me/lightning-address clears the address', async ({ request }) => {
  const token = await loginHttp(request);
  await request.post('/me/lightning-address', {
    headers: { authorization: `Bearer ${token}` },
    data: { address: 'alice@walletofsatoshi.com' },
  });
  const res = await request.delete('/me/lightning-address', {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { lightningAddress: string | null }).lightningAddress).toBeNull();
});

test('Function: proxyMeLightningAddressDelete — DELETE clears the address', async ({ request }) => {
  const token = await loginHttp(request);
  await request.post('/me/lightning-address', {
    headers: { authorization: `Bearer ${token}` },
    data: { address: 'alice@walletofsatoshi.com' },
  });
  const res = await request.delete('/me/lightning-address', {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { lightningAddress: string | null }).lightningAddress).toBeNull();
});

test('Function: unlinkLightningAddress — DELETE /me/lightning-address clears the address', async ({
  request,
}) => {
  const token = await loginHttp(request);
  await request.post('/me/lightning-address', {
    headers: { authorization: `Bearer ${token}` },
    data: { address: 'alice@walletofsatoshi.com' },
  });
  const res = await request.delete('/me/lightning-address', {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { lightningAddress: string | null }).lightningAddress).toBeNull();
});

test('Function: proxyLightningAddressGet — GET resolves a Wallet of Satoshi address', async ({
  request,
}) => {
  const res = await request.get('/lightning-address?address=alice@walletofsatoshi.com');
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { callback: string; address: string };
  expect(body.address).toBe('alice@walletofsatoshi.com');
  expect(body.callback).toBe('https://ln.example.com/pay');
});

test('Function: resolveLightningAddress — GET /lightning-address still resolves', async ({
  request,
}) => {
  const res = await request.get('/lightning-address?address=alice@walletofsatoshi.com');
  expect(res.status()).toBe(200);
});

test('Function: RootLayout — landing renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Direct human-to-human gifts/i })).toBeVisible();
});

test('Function: Home — landing renders the pitch', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Direct human-to-human gifts/i })).toBeVisible();
});

test('Function: MarketingLayout — landing has marketing chrome', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: '21.gifts' }).first()).toBeVisible();
});

test('Function: MarketingHeader — landing shows the wordmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: '21.gifts' }).first()).toBeVisible();
});

test('Function: MarketingFooter — landing shows the footer wordmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('footer').getByText('21.gifts')).toBeVisible();
});

test('Function: LegalPage — legal heading is visible', async ({ page }) => {
  await page.goto('/legal');
  await expect(page.getByRole('heading', { name: 'Legal Notice' })).toBeVisible();
});

test('Function: HandbookPage — handbook heading is visible', async ({ page }) => {
  await page.goto('/handbook');
  await expect(page.getByRole('heading', { name: 'Handbook' }).first()).toBeVisible();
});

test('Function: HandbookMarkdown — functions chapter headings render', async ({ page }) => {
  await page.goto('/handbook');
  await expect(page.locator('#functions h2[id^="functions-function-"]').first()).toBeVisible();
});

test('Function: parseHandbookMarkdown — functions chapter headings render', async ({ page }) => {
  await page.goto('/handbook');
  await expect(page.locator('#functions h2[id^="functions-function-"]').first()).toBeVisible();
});

test('Function: loadHandbookDocuments — handbook heading is visible', async ({ page }) => {
  await page.goto('/handbook');
  await expect(page.getByRole('heading', { name: 'Handbook' }).first()).toBeVisible();
  await expect(page.locator('#functions h2[id^="functions-function-"]').first()).toBeVisible();
});

test('Function: HandbookCopyLink — copy link marks the button copied', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/handbook');
  const button = page.getByRole('button', { name: 'Copy link to Handbook' });
  await expect(button).toBeVisible();
  await button.click();
  await expect(button).toHaveAttribute('data-copied', 'true');
});

test('Function: NotFound — unknown path is 404', async ({ page }) => {
  await page.goto('/404');
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
});

test('Function: LoginPage — login heading is visible', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Log in to 21.gifts' })).toBeVisible();
});

test('Function: DonatePage — send-help explainer renders', async ({ page }) => {
  await page.goto('/donate');
  await expect(page.getByRole('heading', { name: 'Send help' })).toBeVisible();
});

test('Function: LoginCard — a single Log in button is visible', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in' })).toHaveCount(1);
});

test('Function: isInAppBrowser — Telegram WebView hides Log in', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { TelegramWebviewProxy: { postEvent() {} } });
  });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Open this page in your browser' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in' })).toHaveCount(0);
});

test('Function: openInSystemBrowser — Open in browser is shown in Telegram WebView', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.assign(window, { TelegramWebviewProxy: { postEvent() {} } });
  });
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Open in browser' })).toBeVisible();
  await page.getByRole('button', { name: 'Open in browser' }).click();
  // Do not assert navigation.
});

test('Function: QrCode — pay sheet shows the invoice QR', async ({ page, request }) => {
  await openPayInvoice(page, request);
});

test('Function: uppercaseLnurl — pay sheet uses an uppercase lightning href', async ({
  page,
  request,
}) => {
  await openPayInvoice(page, request);
  const href = await page
    .getByRole('link', { name: 'Open Wallet of Satoshi' })
    .getAttribute('href');
  expect(href?.startsWith('walletofsatoshi:lightning:LNBC')).toBe(true);
});

test('Function: walletOfSatoshiHref — pay sheet opens Wallet of Satoshi', async ({
  page,
  request,
}) => {
  await openPayInvoice(page, request);
  await expect(page.getByRole('link', { name: 'Open Wallet of Satoshi' })).toBeVisible();
});

test('Function: isAndroidUserAgent — Android pay sheet uses an Intent href', async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      get: () => 'Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit/537.36',
    });
  });
  await openPayInvoice(page, request);
  const href = await page
    .getByRole('link', { name: 'Open Wallet of Satoshi' })
    .getAttribute('href');
  expect(href?.startsWith('intent:lightning:')).toBe(true);
});

test('Function: walletOfSatoshiIntentHref — Android pay sheet pins the WoS package', async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      get: () => 'Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit/537.36',
    });
  });
  await openPayInvoice(page, request);
  const href = await page
    .getByRole('link', { name: 'Open Wallet of Satoshi' })
    .getAttribute('href');
  expect(href?.includes('com.livingroomofsatoshi.wallet')).toBe(true);
});

test('Function: useAuthStore — live login reaches the signed-in view', async ({
  page,
  request,
}) => {
  await signInViaStub(page, request);
  await expect(page).toHaveURL(/\/setup\/name/);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('Function: saveSession — live login persists the session token', async ({ page, request }) => {
  await signInViaStub(page, request);
  const token = await page.evaluate(() => window.localStorage.getItem('21gifts.session'));
  expect(token).toBeTruthy();
});

test('Function: loadSession — reload keeps the signed-in view', async ({ page, request }) => {
  await signInViaStub(page, request);
  await page.reload();
  await expect(page).toHaveURL(/\/setup\/name/);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('Function: LightningAddressForm — link reaches welcome', async ({ page, request }) => {
  await signInViaStub(page, request);
  await saveOnboardingName(page);
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unlink' })).toHaveCount(0);
});

test('Function: clearSession — log out returns to the start action', async ({ page, request }) => {
  await signInViaStub(page, request);
  await openSignedInMenu(page);
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem('21gifts.session'))).toBeNull();
});

test('Function: ForumBoard — welcome forum is the pay surface', async ({ page, request }) => {
  await stubPayableNote(page);
  await signInViaStub(page, request);
  await saveOnboardingName(page);
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByRole('button', { name: 'Send Bitcoin' })).toBeVisible();
});

test('Function: RulesPage — rules heading is visible', async ({ page }) => {
  await page.goto('/rules');
  await expect(page.getByRole('heading', { name: 'Living room rules', level: 1 })).toBeVisible();
});

test('Function: RulesDocument — only free donations law is visible', async ({ page }) => {
  await page.goto('/rules');
  await expect(page.getByRole('heading', { name: '1. Only free donations' })).toBeVisible();
});

test('Function: ForumLoader — welcome forum is the pay surface', async ({ page, request }) => {
  await stubPayableNote(page);
  await signInViaStub(page, request);
  await saveOnboardingName(page);
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByRole('button', { name: 'Send Bitcoin' })).toBeVisible();
});

test('Function: postMessageInvoice — pay sheet requests an invoice', async ({ page, request }) => {
  await openPayInvoice(page, request);
});

test('Function: proxyMessagesInvoicePost — pay sheet requests an invoice', async ({
  page,
  request,
}) => {
  await openPayInvoice(page, request);
});

test('Function: proxyGiftsGet — GET /gifts without a day is 400', async ({ request }) => {
  const res = await request.get('/gifts');
  expect(res.status()).toBe(400);
});

test('Function: fetchGiftDay — day page lists alice', async ({ page }) => {
  await page.goto('/stats/2026-06-01');
  await expect(page.getByText('alice')).toBeVisible();
});

test('Function: GiftDayTable — day page lists alice', async ({ page }) => {
  await page.goto('/stats/2026-06-01');
  await expect(page.getByText('alice')).toBeVisible();
});

test('Function: DayLoader — empty day copy is visible', async ({ page }) => {
  await page.goto('/stats/2026-06-02');
  await expect(page.getByText('No gifts recorded on this day.')).toBeVisible();
});

test('Function: GiftDayPage — invalid day is 404', async ({ page }) => {
  await page.goto('/stats/[day]');
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
});

test('Function: isUtcDay — invalid day is 404', async ({ page }) => {
  await page.goto('/stats/2026-02-31');
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
});

test('Function: proxyGiftsStatsGet — GET /gifts/stats is empty', async ({ request }) => {
  const res = await request.get('/gifts/stats');
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { giftCount: number }).giftCount).toBe(0);
});

test('Function: fetchGiftStats — stats page shows the empty copy', async ({ page }) => {
  await stubGiftStats(page, EMPTY_STATS);
  await page.goto('/stats');
  await expect(page.getByText('No gifts recorded yet.')).toBeVisible();
});

test('Function: StatsPage — stats heading is visible', async ({ page }) => {
  await page.goto('/stats');
  await expect(page.getByRole('heading', { name: 'Gifts' })).toBeVisible();
});

test('Function: StatsLoader — stats page shows the empty copy', async ({ page }) => {
  await stubGiftStats(page, EMPTY_STATS);
  await page.goto('/stats');
  await expect(page.getByText('No gifts recorded yet.')).toBeVisible();
});

test('Function: StatsDashboard — empty stats hide the spend chart heading', async ({ page }) => {
  await stubGiftStats(page, EMPTY_STATS);
  await page.goto('/stats');
  await expect(page.getByText('No gifts recorded yet.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Total spend over time' })).toHaveCount(0);
});

test('Function: StatsDashboard — a spend day on the chart opens /stats/{day}', async ({ page }) => {
  await stubGiftStats(page, POPULATED_STATS);
  await page.goto('/stats');
  await page.getByLabel('Spend over time in BTC').getByRole('link', { name: '2026-06-01' }).click();
  await expect(page).toHaveURL(/\/stats\/2026-06-01$/);
  await expect(page.getByText('alice')).toBeVisible();
});

test('Function: StatsDashboard — month USD scale makes the higher-USD month taller', async ({
  page,
}) => {
  await stubGiftStats(page, {
    ...POPULATED_STATS,
    giftCount: 2,
    byMonth: [
      { month: '2026-06', giftCount: 1, sats: 1_000_000, btc: '0.01000000', usd: '50.00' },
      { month: '2026-07', giftCount: 1, sats: 100_000, btc: '0.00100000', usd: '900.00' },
    ],
  });
  await page.goto('/stats');
  await page
    .getByRole('group', { name: 'By month bar scale' })
    .getByRole('button', { name: 'USD' })
    .click();
  const svg = page.getByLabel('Spend by month in USD');
  const juneH = Number(await svg.locator('rect').nth(0).getAttribute('height'));
  const julyH = Number(await svg.locator('rect').nth(1).getAttribute('height'));
  expect(julyH).toBeGreaterThan(juneH);
});

test('Function: formatUsdDisplay — empty stats hero shows $0.00', async ({ page }) => {
  await stubGiftStats(page, EMPTY_STATS);
  await page.goto('/stats');
  await expect(page.locator('dl').getByText('$0.00')).toBeVisible();
});

test('Function: formatBtcTick — populated stats draw the BTC chart', async ({ page }) => {
  await stubGiftStats(page, POPULATED_STATS);
  await page.goto('/stats');
  await expect(page.getByLabel('Spend over time in BTC')).toBeVisible();
  await expect(page.getByLabel('Spend over time in BTC').getByText('0.000015')).toBeVisible();
});

test('Function: formatUsdTick — populated stats draw the USD chart', async ({ page }) => {
  await stubGiftStats(page, POPULATED_STATS);
  await page.goto('/stats');
  await page
    .getByRole('group', { name: 'Over time scale' })
    .getByRole('button', { name: 'USD' })
    .click();
  await expect(page.getByLabel('Spend over time in USD')).toBeVisible();
  await expect(page.getByLabel('Spend over time in USD').getByText('$1.43')).toBeVisible();
});

test('Function: proxyAuthPasskeyRegisterBeginPost — POST begin returns a challenge', async ({
  request,
}) => {
  const res = await request.post('/auth/passkey/register/begin');
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { challengeId: string; options: { challenge: string } };
  expect(body.challengeId.length).toBeGreaterThan(8);
  expect(body.options.challenge.length).toBeGreaterThan(8);
});

test('Function: startPasskeyRegistration — create passkey reaches the signed-in view', async ({
  page,
}) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/setup\/name/, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('Function: proxyAuthPasskeyRegisterFinishPost — POST finish without body is 400', async ({
  request,
}) => {
  const res = await request.post('/auth/passkey/register/finish');
  expect(res.status()).toBe(400);
});

test('Function: finishPasskeyRegistration — create passkey reaches the signed-in view', async ({
  page,
}) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/setup\/name/, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('Function: proxyAuthPasskeyAuthenticateBeginPost — POST begin returns a challenge', async ({
  request,
}) => {
  const res = await request.post('/auth/passkey/authenticate/begin');
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { challengeId: string }).challengeId.length).toBeGreaterThan(8);
});

test('Function: startPasskeyAuthentication — continue with passkey reaches the signed-in view', async ({
  page,
}) => {
  await signInWithPasskeyThenAgain(page);
});

test('Function: proxyAuthPasskeyAuthenticateFinishPost — POST finish without body is 400', async ({
  request,
}) => {
  const res = await request.post('/auth/passkey/authenticate/finish');
  expect(res.status()).toBe(400);
});

test('Function: finishPasskeyAuthentication — continue with passkey reaches the signed-in view', async ({
  page,
}) => {
  await signInWithPasskeyThenAgain(page);
});

test('Function: usePasskeyLogin — create passkey reaches the signed-in view', async ({
  page,
  request,
}) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/setup\/name/, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  const token = await page.evaluate(() => window.localStorage.getItem('21gifts.session'));
  expect(token).toBeTruthy();
  const me = await request.get('/me', { headers: { authorization: `Bearer ${token}` } });
  expect(((await me.json()) as { linkingKey: string | null }).linkingKey).toBeNull();
});

test('Function: creationOptionsFromJSON — create passkey reaches the signed-in view', async ({
  page,
}) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/setup\/name/, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('Function: credentialToJSON — create passkey reaches the signed-in view', async ({ page }) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/setup\/name/, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('Function: base64UrlToBytes — create passkey reaches the signed-in view', async ({ page }) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/setup\/name/, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('Function: bytesToBase64Url — create passkey reaches the signed-in view', async ({ page }) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/setup\/name/, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('Function: requestOptionsFromJSON — continue with passkey reaches the signed-in view', async ({
  page,
}) => {
  await signInWithPasskeyThenAgain(page);
});

test('Function: LanguageSwitcher — landing exposes the language switcher', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Language')).toBeVisible();
  await page.getByLabel('Language').click();
  await expect(page.getByRole('option', { name: 'Deutsch' })).toBeVisible();
});

test('Function: LocaleProvider — landing heading is English by default', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Direct human-to-human gifts/ })).toBeVisible();
});

test('Function: useTranslations — landing heading is English by default', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Direct human-to-human gifts/ })).toBeVisible();
});

test('Function: translate — landing heading is English by default', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Direct human-to-human gifts/ })).toBeVisible();
});

test('Function: getCatalog — landing heading is English by default', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Direct human-to-human gifts/ })).toBeVisible();
});

test('Function: getRequestLocale — landing heading is English by default', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Direct human-to-human gifts/ })).toBeVisible();
});

test('Function: parseSupportedLocale — Español cookie localizes the landing heading', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Language').click();
  await page.getByRole('option', { name: 'Español' }).click();
  await expect(
    page.getByRole('heading', { name: /Regalos directos de persona a persona/ }),
  ).toBeVisible();
});

test.describe('Function: parseAcceptLanguage', () => {
  test.use({
    locale: 'de-DE',
    extraHTTPHeaders: { 'Accept-Language': 'de-DE,de;q=0.9' },
  });

  test('Function: parseAcceptLanguage — German Accept-Language localizes the landing heading', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /Direkte Geschenke von Mensch zu Mensch/ }),
    ).toBeVisible();
  });
});

test('Function: HandbookIntro — handbook heading is visible', async ({ page }) => {
  await page.goto('/handbook');
  await expect(page.getByRole('heading', { name: 'Handbook' }).first()).toBeVisible();
});

test('Function: NameSetupPage — name screen heading is visible', async ({ page }) => {
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
        name: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        createdAt: 1,
      }),
    });
  });
  await page.goto('/setup/name');
  await expect(page.getByRole('heading', { name: 'Your name' })).toBeVisible();
});

test('Function: NameSetup — name screen heading is visible', async ({ page }) => {
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
        name: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        createdAt: 1,
      }),
    });
  });
  await page.goto('/setup/name');
  await expect(page.getByRole('heading', { name: 'Your name' })).toBeVisible();
});

test('Function: AddressSetupPage — address screen heading is visible', async ({ page }) => {
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
        lightningAddress: null,
        lightningAddressVerified: false,
        createdAt: 1,
      }),
    });
  });
  await page.goto('/setup/address');
  await expect(page.getByRole('heading', { name: 'Your Wallet of Satoshi address' })).toBeVisible();
});

test('Function: AddressSetup — address screen heading is visible', async ({ page }) => {
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
        lightningAddress: null,
        lightningAddressVerified: false,
        createdAt: 1,
      }),
    });
  });
  await page.goto('/setup/address');
  await expect(page.getByRole('heading', { name: 'Your Wallet of Satoshi address' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  await expect(page.getByLabel('Language')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Log out' })).toHaveCount(0);
  await openSignedInMenu(page);
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
});

test('Function: WelcomePage — welcome heading is visible', async ({ page }) => {
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
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        createdAt: 1,
      }),
    });
  });
  await page.route(/\/messages$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
});

test('Function: WelcomeScreen — welcome heading is visible', async ({ page }) => {
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
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        createdAt: 1,
      }),
    });
  });
  await page.route(/\/messages$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
});

test('Function: ForumBoard — forum heading is visible', async ({ page }) => {
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
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        createdAt: 1,
      }),
    });
  });
  await page.route(/\/messages$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Forum' })).toBeVisible();
});

test('Function: ContactPage — contact heading is visible', async ({ page }) => {
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
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        createdAt: 1,
      }),
    });
  });
  await page.goto('/contact');
  await expect(page.getByRole('heading', { name: 'Contact' })).toBeVisible();
});

test('Function: ContactScreen — contact lead is visible', async ({ page }) => {
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
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        createdAt: 1,
      }),
    });
  });
  await page.goto('/contact');
  await expect(page.getByText('Write to 21.gifts here. There is no email.')).toBeVisible();
});

test('Function: ContactLoader — Send button is visible', async ({ page }) => {
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
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        createdAt: 1,
      }),
    });
  });
  await page.goto('/contact');
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
});

test('Function: ForumLoader — empty forum copy is visible', async ({ page }) => {
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
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        createdAt: 1,
      }),
    });
  });
  await page.route(/\/messages$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByText('No messages yet. Be the first to write.')).toBeVisible();
});

test('Function: formatForumTime — message timestamp is visible', async ({ page }) => {
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
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        createdAt: 1,
      }),
    });
  });
  await page.route(/\/messages$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm1',
            name: 'Ada',
            text: 'Hello from Ada',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 0,
            payable: true,
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByText('Hello from Ada')).toBeVisible();
  await expect(page.getByText(/2026/)).toBeVisible();
});

test('Function: OnboardingGate — login sends a new account to the name screen', async ({
  page,
  request,
}) => {
  await signInViaStub(page, request);
  await expect(page).toHaveURL(/\/setup\/name/);
});

test('Function: nextOnboardingPath — login sends a new account to the name screen', async ({
  page,
  request,
}) => {
  await signInViaStub(page, request);
  await expect(page).toHaveURL(/\/setup\/name/);
});

test('Function: hasDisplayName — login sends a new account to the name screen', async ({
  page,
  request,
}) => {
  await signInViaStub(page, request);
  await expect(page).toHaveURL(/\/setup\/name/);
});

test('Function: hasLightningAddress — named account without address stays on address screen', async ({
  page,
}) => {
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
        lightningAddress: null,
        lightningAddressVerified: false,
        createdAt: 1,
      }),
    });
  });
  await page.goto('/setup/address');
  await expect(page).toHaveURL(/\/setup\/address/);
});

test('Function: useHydrateSession — reload keeps the name screen', async ({ page, request }) => {
  await signInViaStub(page, request);
  await page.reload();
  await expect(page).toHaveURL(/\/setup\/name/);
});

test('Function: LogoutButton — log out returns to login', async ({ page, request }) => {
  await signInViaStub(page, request);
  await openSignedInMenu(page);
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
});

test('Function: SignedInChrome — Menu reveals Profile, language, and log out', async ({
  page,
  request,
}) => {
  await signInViaStub(page, request);
  await expect(page).toHaveURL(/\/setup\/name/);
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  await expect(page.getByLabel('Language')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Log out' })).toHaveCount(0);
  await openSignedInMenu(page);
  await expect(page.getByRole('link', { name: /Profile/ })).toBeVisible();
  await expect(page.getByLabel('Language')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
});

test('Function: ProfilePage — profile heading is visible', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
});

test('Function: ProfileScreen — back to forum is visible', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/profile');
  await expect(page.getByRole('link', { name: 'Back to forum' })).toBeVisible();
});

test('Function: accountTotals — menu shows received sats for alice', async ({ page }) => {
  await seedAdaSession(page);
  await stubGiftStats(page, {
    ...EMPTY_STATS,
    byRecipient: [{ recipient: 'alice', giftCount: 2, sats: 1000, btc: '0.00001000', usd: '0.95' }],
  });
  await page.goto('/profile');
  await openSignedInMenu(page);
  await expect(page.getByRole('link', { name: /Received 1000 sats/ })).toBeVisible();
});

test('Function: recipientHandleFromAddress — alice handle matches stats row', async ({ page }) => {
  await seedAdaSession(page);
  await stubGiftStats(page, {
    ...EMPTY_STATS,
    byRecipient: [{ recipient: 'alice', giftCount: 2, sats: 1000, btc: '0.00001000', usd: '0.95' }],
  });
  await page.goto('/profile');
  await openSignedInMenu(page);
  await expect(page.getByRole('link', { name: /Received 1000 sats/ })).toBeVisible();
});

test('Function: useAccountTotals — profile totals load from gift stats', async ({ page }) => {
  await seedAdaSession(page);
  await stubGiftStats(page, {
    ...EMPTY_STATS,
    byRecipient: [{ recipient: 'alice', giftCount: 2, sats: 1000, btc: '0.00001000', usd: '0.95' }],
  });
  await page.goto('/profile');
  await expect(page.getByLabel('Received 1000 sats')).toBeVisible();
});
