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

async function mockPayCallback(page: Page): Promise<void> {
  await page.route('https://ln.example.com/pay**', async (route) => {
    const amount = new URL(route.request().url()).searchParams.get('amount');
    if (amount !== '21000') {
      await route.fulfill({ status: 400, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pr: PAY_INVOICE }),
    });
  });
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

async function signInViaStub(page: Page, _request: APIRequestContext): Promise<void> {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText('Signed in')).toBeVisible({ timeout: 10_000 });
}

async function saveOnboardingName(page: Page): Promise<void> {
  await page.getByLabel('Name').fill('Ada');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByRole('button', { name: 'Link address' })).toBeVisible();
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
  await expect(page.getByText('Signed in')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText('Signed in')).toBeVisible({ timeout: 10_000 });
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

test('Function: proxyMeGet — GET /me with bearer is 200', async ({ request }) => {
  const token = await loginHttp(request);
  const res = await request.get('/me', { headers: { authorization: `Bearer ${token}` } });
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { role: string }).role).toBe('basis');
});

test('Function: fetchMe — reload hydrates the signed-in view', async ({ page, request }) => {
  await signInViaStub(page, request);
  await page.reload();
  await expect(page.getByText('Signed in')).toBeVisible();
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
  await page.getByLabel('Name').fill('Ada');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByText('Ada')).toBeVisible();
});

test('Function: setName — signed-in form saves a display name', async ({ page, request }) => {
  await signInViaStub(page, request);
  await page.getByLabel('Name').fill('Ada');
  await page.getByRole('button', { name: 'Save name' }).click();
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
  await page.getByRole('button', { name: 'Link address' }).click();
  await expect(page.getByText('alice@walletofsatoshi.com')).toBeVisible();
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

test('Function: unlinkLightningAddress — signed-in form unlinks the address', async ({
  page,
  request,
}) => {
  await signInViaStub(page, request);
  await saveOnboardingName(page);
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByRole('button', { name: 'Link address' }).click();
  await expect(page.getByRole('button', { name: 'Unlink' })).toBeVisible();
  await page.getByRole('button', { name: 'Unlink' }).click();
  await expect(page.getByRole('button', { name: 'Link address' })).toBeVisible();
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

test('Function: resolveLightningAddress — donate form resolves then shows a payment QR', async ({
  page,
}) => {
  await mockPayCallback(page);
  await page.goto('/donate');
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByLabel('Amount (sats)').fill('21');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Pay 21 sats to alice@walletofsatoshi.com')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toBeVisible();
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

test('Function: LoginCard — a single Log in button is visible', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in' })).toHaveCount(1);
});

test('Function: QrCode — donate shows a Bitcoin payment QR', async ({ page }) => {
  await mockPayCallback(page);
  await page.goto('/donate');
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByLabel('Amount (sats)').fill('21');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toBeVisible();
});

test('Function: uppercaseLnurl — Wallet of Satoshi href is uppercased', async ({ page }) => {
  await mockPayCallback(page);
  await page.goto('/donate');
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByLabel('Amount (sats)').fill('21');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('link', { name: 'Open Wallet of Satoshi' })).toHaveAttribute(
    'href',
    /walletofsatoshi:lightning:LNBC21N1EXAMPLEINVOICE/,
  );
});

test('Function: walletOfSatoshiHref — Wallet of Satoshi href uses the custom scheme', async ({
  page,
}) => {
  await mockPayCallback(page);
  await page.goto('/donate');
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByLabel('Amount (sats)').fill('21');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('link', { name: 'Open Wallet of Satoshi' })).toHaveAttribute(
    'href',
    /^walletofsatoshi:lightning:/,
  );
});

test('Function: isAndroidUserAgent — Android donate uses an Intent URL', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
      configurable: true,
    });
  });
  await mockPayCallback(page);
  await page.goto('/donate');
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByLabel('Amount (sats)').fill('21');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('link', { name: 'Open Wallet of Satoshi' })).toHaveAttribute(
    'href',
    /package=com.livingroomofsatoshi.wallet/,
  );
});

test('Function: walletOfSatoshiIntentHref — Android donate pins the WoS package', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
      configurable: true,
    });
  });
  await mockPayCallback(page);
  await page.goto('/donate');
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByLabel('Amount (sats)').fill('21');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('link', { name: 'Open Wallet of Satoshi' })).toHaveAttribute(
    'href',
    /package=com.livingroomofsatoshi.wallet/,
  );
});

test('Function: useAuthStore — live login reaches the signed-in view', async ({
  page,
  request,
}) => {
  await signInViaStub(page, request);
  await expect(page.getByText('Signed in')).toBeVisible();
});

test('Function: saveSession — live login persists the session token', async ({ page, request }) => {
  await signInViaStub(page, request);
  const token = await page.evaluate(() => window.localStorage.getItem('21gifts.session'));
  expect(token).toBeTruthy();
});

test('Function: loadSession — reload keeps the signed-in view', async ({ page, request }) => {
  await signInViaStub(page, request);
  await page.reload();
  await expect(page.getByText('Signed in')).toBeVisible();
});

test('Function: LightningAddressForm — link and unlink a Wallet of Satoshi address', async ({
  page,
  request,
}) => {
  await signInViaStub(page, request);
  await saveOnboardingName(page);
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByRole('button', { name: 'Link address' }).click();
  await expect(page.getByText('alice@walletofsatoshi.com')).toBeVisible();
  await page.getByRole('button', { name: 'Unlink' }).click();
  await expect(page.getByRole('button', { name: 'Link address' })).toBeVisible();
});

test('Function: clearSession — log out returns to the start action', async ({ page, request }) => {
  await signInViaStub(page, request);
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem('21gifts.session'))).toBeNull();
});

test('Function: DonatePage — donate heading is visible', async ({ page }) => {
  await page.goto('/donate');
  await expect(page.getByRole('heading', { name: 'Send a gift', level: 1 })).toBeVisible();
});

test('Function: DonateForm — donate form is visible', async ({ page }) => {
  await page.goto('/donate');
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('Function: requestDonateInvoice — donate shows a Bitcoin payment QR', async ({ page }) => {
  await mockPayCallback(page);
  await page.goto('/donate');
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByLabel('Amount (sats)').fill('21');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Pay 21 sats to alice@walletofsatoshi.com')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toBeVisible();
});

test('Function: satsToMsat — donate shows a Bitcoin payment QR', async ({ page }) => {
  await mockPayCallback(page);
  await page.goto('/donate');
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByLabel('Amount (sats)').fill('21');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Pay 21 sats to alice@walletofsatoshi.com')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toBeVisible();
});

test('Function: formatMsatAsSats — amount outside the accepted range is explained', async ({
  page,
}) => {
  await page.goto('/donate');
  await page.getByLabel('Wallet of Satoshi address').fill('highmin@walletofsatoshi.com');
  await page.getByLabel('Amount (sats)').fill('21');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('This address accepts 100 sats – 1000000 sats.')).toBeVisible();
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
  await expect(page.getByText('Signed in')).toBeVisible({ timeout: 10_000 });
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
  await expect(page.getByText('Signed in')).toBeVisible({ timeout: 10_000 });
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
  await expect(page.getByText('Signed in')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Save name' })).toBeVisible();
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
  await expect(page.getByText('Signed in')).toBeVisible({ timeout: 10_000 });
});

test('Function: credentialToJSON — create passkey reaches the signed-in view', async ({ page }) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText('Signed in')).toBeVisible({ timeout: 10_000 });
});

test('Function: base64UrlToBytes — create passkey reaches the signed-in view', async ({ page }) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText('Signed in')).toBeVisible({ timeout: 10_000 });
});

test('Function: bytesToBase64Url — create passkey reaches the signed-in view', async ({ page }) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText('Signed in')).toBeVisible({ timeout: 10_000 });
});

test('Function: requestOptionsFromJSON — continue with passkey reaches the signed-in view', async ({
  page,
}) => {
  await signInWithPasskeyThenAgain(page);
});

test('Function: LanguageSwitcher — landing exposes the language select', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Language')).toBeVisible();
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
  await page.getByLabel('Language').selectOption('es');
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
