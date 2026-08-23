import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const DUMMY_KEY = `02${'a'.repeat(62)}`;
const PAY_INVOICE = 'lnbc21n1exampleinvoice';

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

async function signInViaStub(page: Page, request: APIRequestContext): Promise<void> {
  await page.goto('/login');
  const pending = page.waitForResponse((res) => {
    const pathName = new URL(res.url()).pathname;
    return res.request().method() === 'GET' && pathName === '/auth/lnurl';
  });
  await page.getByRole('button', { name: 'Log in with Wallet of Satoshi' }).click();
  const start = (await (await pending).json()) as { k1: string };
  const cb = await request.get(
    `/auth/lnurl/callback?tag=login&k1=${start.k1}&sig=00&key=${DUMMY_KEY}`,
  );
  expect(cb.status()).toBe(200);
  expect(await cb.json()).toEqual({ status: 'OK' });
  await expect(page.getByText('Signed in')).toBeVisible({ timeout: 10_000 });
}

async function installFakeWebAuthn(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const rawId = new Uint8Array([1, 2, 3, 4]).buffer;
    const attestation = {
      id: 'cred-e2e',
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
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: {
        create: async () => attestation,
        get: async () => assertion,
      },
    });
  });
}

async function loginHttp(request: APIRequestContext): Promise<string> {
  const startRes = await request.get('/auth/lnurl');
  expect(startRes.status()).toBe(200);
  const start = (await startRes.json()) as { k1: string; pollToken: string };
  const cb = await request.get(
    `/auth/lnurl/callback?tag=login&k1=${start.k1}&sig=00&key=${DUMMY_KEY}`,
  );
  expect((await cb.json()) as { status: string }).toEqual({ status: 'OK' });
  const sess = await request.get('/auth/session', {
    headers: { 'x-poll-token': start.pollToken },
  });
  const body = (await sess.json()) as { status: string; token: string };
  expect(body.status).toBe('authenticated');
  return body.token;
}

test('Function: GET — healthz is ok', async ({ request }) => {
  const res = await request.get('/healthz');
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ status: 'ok' });
});

test('Function: getApiUrl — proxy reaches the stub', async ({ request }) => {
  const res = await request.get('/auth/lnurl');
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { k1: string };
  expect(body.k1.length).toBeGreaterThan(8);
});

test('Function: proxyApiRequest — GET /auth/lnurl is 200', async ({ request }) => {
  const res = await request.get('/auth/lnurl');
  expect(res.status()).toBe(200);
});

test('Function: proxyAuthLnurlGet — GET /auth/lnurl returns a challenge', async ({ request }) => {
  const res = await request.get('/auth/lnurl');
  const body = (await res.json()) as { lnurl: string; k1: string; pollToken: string };
  expect(body.lnurl.startsWith('lnurl1')).toBe(true);
  expect(body.k1.length).toBeGreaterThan(8);
  expect(body.pollToken.length).toBeGreaterThan(8);
});

test('Function: startLnurlAuth — clicking login starts the challenge and shows the QR', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in with Wallet of Satoshi' }).click();
  await expect(page.getByRole('img', { name: 'Login QR code' })).toBeVisible();
});

test('Function: proxyAuthLnurlCallbackGet — callback without params is ERROR', async ({
  request,
}) => {
  const res = await request.get('/auth/lnurl/callback');
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { status: string }).status).toBe('ERROR');
});

test('Function: proxyAuthSessionGet — poll after callback is authenticated', async ({
  request,
}) => {
  const token = await loginHttp(request);
  expect(token.length).toBeGreaterThan(8);
});

test('Function: pollSession — live login reaches the signed-in view', async ({ page, request }) => {
  await signInViaStub(page, request);
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
});

test('Function: setLightningAddress — signed-in form links a Wallet of Satoshi address', async ({
  page,
  request,
}) => {
  await signInViaStub(page, request);
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

test('Function: LoginCard — wallet sign-in action is visible', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Log in with Wallet of Satoshi' })).toBeVisible();
});

test('Function: useLnurlLogin — clicking login shows the QR', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in with Wallet of Satoshi' }).click();
  await expect(page.getByRole('img', { name: 'Login QR code' })).toBeVisible();
});

test('Function: QrCode — clicking login shows the QR', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in with Wallet of Satoshi' }).click();
  await expect(page.getByRole('img', { name: 'Login QR code' })).toBeVisible();
});

test('Function: uppercaseLnurl — Wallet of Satoshi href is uppercased', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in with Wallet of Satoshi' }).click();
  await expect(page.getByRole('link', { name: 'Open Wallet of Satoshi' })).toHaveAttribute(
    'href',
    /walletofsatoshi:lightning:LNURL1/,
  );
});

test('Function: walletOfSatoshiHref — Wallet of Satoshi href uses the custom scheme', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in with Wallet of Satoshi' }).click();
  await expect(page.getByRole('link', { name: 'Open Wallet of Satoshi' })).toHaveAttribute(
    'href',
    /^walletofsatoshi:lightning:/,
  );
});

test('Function: isAndroidUserAgent — Android login uses an Intent URL', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
      configurable: true,
    });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in with Wallet of Satoshi' }).click();
  await expect(page.getByRole('link', { name: 'Open Wallet of Satoshi' })).toHaveAttribute(
    'href',
    /package=com.livingroomofsatoshi.wallet/,
  );
});

test('Function: walletOfSatoshiIntentHref — Android login pins the WoS package', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
      configurable: true,
    });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in with Wallet of Satoshi' }).click();
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
  await expect(page.getByText('basis')).toBeVisible();
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
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByRole('button', { name: 'Link address' }).click();
  await expect(page.getByText('alice@walletofsatoshi.com')).toBeVisible();
  await page.getByRole('button', { name: 'Unlink' }).click();
  await expect(page.getByRole('button', { name: 'Link address' })).toBeVisible();
});

test('Function: clearSession — log out returns to the start action', async ({ page, request }) => {
  await signInViaStub(page, request);
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('button', { name: 'Log in with Wallet of Satoshi' })).toBeVisible();
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

test('Function: proxyGiftsStatsGet — GET /gifts/stats is empty', async ({ request }) => {
  const res = await request.get('/gifts/stats');
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { giftCount: number }).giftCount).toBe(0);
});

test('Function: fetchGiftStats — stats page shows the empty copy', async ({ page }) => {
  await page.goto('/stats');
  await expect(page.getByText('No gifts recorded yet.')).toBeVisible();
});

test('Function: StatsPage — stats heading is visible', async ({ page }) => {
  await page.goto('/stats');
  await expect(page.getByRole('heading', { name: 'Gifts' })).toBeVisible();
});

test('Function: StatsLoader — stats page shows the empty copy', async ({ page }) => {
  await page.goto('/stats');
  await expect(page.getByText('No gifts recorded yet.')).toBeVisible();
});

test('Function: StatsDashboard — empty stats hide the spend chart heading', async ({ page }) => {
  await page.goto('/stats');
  await expect(page.getByText('No gifts recorded yet.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Total spend over time' })).toHaveCount(0);
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

test('Function: startPasskeyRegistration — POST begin returns a challenge', async ({ request }) => {
  const res = await request.post('/auth/passkey/register/begin');
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { challengeId: string }).challengeId.length).toBeGreaterThan(8);
});

test('Function: proxyAuthPasskeyRegisterFinishPost — POST finish without body is 400', async ({
  request,
}) => {
  const res = await request.post('/auth/passkey/register/finish');
  expect(res.status()).toBe(400);
});

test('Function: finishPasskeyRegistration — POST finish without body is 400', async ({
  request,
}) => {
  const res = await request.post('/auth/passkey/register/finish');
  expect(res.status()).toBe(400);
});

test('Function: proxyAuthPasskeyAuthenticateBeginPost — POST begin returns a challenge', async ({
  request,
}) => {
  const res = await request.post('/auth/passkey/authenticate/begin');
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { challengeId: string }).challengeId.length).toBeGreaterThan(8);
});

test('Function: startPasskeyAuthentication — POST begin returns a challenge', async ({
  request,
}) => {
  const res = await request.post('/auth/passkey/authenticate/begin');
  expect(res.status()).toBe(200);
});

test('Function: proxyAuthPasskeyAuthenticateFinishPost — POST finish without body is 400', async ({
  request,
}) => {
  const res = await request.post('/auth/passkey/authenticate/finish');
  expect(res.status()).toBe(400);
});

test('Function: finishPasskeyAuthentication — POST finish without body is 400', async ({
  request,
}) => {
  const res = await request.post('/auth/passkey/authenticate/finish');
  expect(res.status()).toBe(400);
});

test('Function: usePasskeyLogin — create passkey reaches the signed-in view', async ({ page }) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Create a passkey' }).click();
  await expect(page.getByText('Signed in')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('basis')).toBeVisible();
});

test('Function: creationOptionsFromJSON — create passkey reaches the signed-in view', async ({
  page,
}) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Create a passkey' }).click();
  await expect(page.getByText('Signed in')).toBeVisible({ timeout: 10_000 });
});

test('Function: credentialToJSON — create passkey reaches the signed-in view', async ({ page }) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Create a passkey' }).click();
  await expect(page.getByText('Signed in')).toBeVisible({ timeout: 10_000 });
});

test('Function: base64UrlToBytes — create passkey reaches the signed-in view', async ({ page }) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Create a passkey' }).click();
  await expect(page.getByText('Signed in')).toBeVisible({ timeout: 10_000 });
});

test('Function: bytesToBase64Url — create passkey reaches the signed-in view', async ({ page }) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Create a passkey' }).click();
  await expect(page.getByText('Signed in')).toBeVisible({ timeout: 10_000 });
});

test('Function: requestOptionsFromJSON — continue with passkey reaches the signed-in view', async ({
  page,
}) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Continue with passkey' }).click();
  await expect(page.getByText('Signed in')).toBeVisible({ timeout: 10_000 });
});
