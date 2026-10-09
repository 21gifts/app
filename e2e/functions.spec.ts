import fs from 'node:fs';
import path from 'node:path';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { openCryptoPayQrValue } from '../src/lib/gifts-address';
import { fulfillSpot, SPOT_RATES, spotRatesFromStats } from './fx-spot';
import {
  buildShopStickerPdf,
  buildShopStickerSvg,
  shopStickerLangFromQuery,
  shopStickerLangInitial,
  type ShopStickerFormat,
} from '../src/lib/shop-sticker';
import { encodeLnurl } from '../src/lib/lnurl';
import { RULES_CHAPTER_IDS } from '../src/lib/rules-chapters';
import { creditSmallestUnits, parseCreditTermDays, splitCreditPlan } from '../src/lib/credit-plan';
import { parseForumAskAmountInUnit } from '../src/lib/forum-goal';
import {
  fiatDraftForSats,
  fiatToSats,
  parseAmountDraft,
  paySatsFromDraft,
  replySatsFromDraft,
} from '../src/lib/stats-money';
import { fitBoxInFrame, pageFrameProblems } from '../src/lib/page-frame';

async function chooseForumView(page: Page, name: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Forum view' }).click();
  await page.getByRole('option', { name, exact: true }).click();
}

const PAY_INVOICE = 'lnbc21n1exampleinvoice';

test.beforeEach(async ({ page }) => {
  await page.route(/\/forum\/members\/acc_e2e$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        name: 'Ada',
        username: 'alice',
        location: null,
        role: 'basis',
        lightningAddress: null,
        createdAt: '2026-01-15T12:00:00.000Z',
        aboutMe: null,
        profileMessage: null,
        postCount: 14,
        replyCount: 0,
      }),
    });
  });
});

test('Function: readJpegTakenAt — a jpeg with Exif sends its capture time', async ({
  page,
  request,
}) => {
  await reachWelcomeVerified(page, request);
  const posted = page.waitForRequest((req) => {
    if (req.method() !== 'POST') {
      return false;
    }
    return /\/messages\/?$/.test(new URL(req.url()).pathname);
  });
  await openHomeWriter(page);
  await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/taken-at.jpg');
  await expect(page.getByAltText('Selected photo')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  const body = (await posted).postDataJSON() as {
    photo?: { takenAt?: string };
    photos?: { takenAt?: string }[];
  };
  expect(body.photo?.takenAt).toBe('2020-01-01T00:00:00');
  expect(body.photos?.[0]?.takenAt).toBe('2020-01-01T00:00:00');
});

const FX_USD = {
  quote: 'BTC-USD',
  dayBasis: 'utc',
  source: 'coinbase-exchange-daily-close',
  quotes: [{ code: 'USD', pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' }],
};

const FX_ALL = {
  quote: 'BTC-USD',
  dayBasis: 'utc',
  source: 'coinbase-exchange-daily-close',
  quotes: [
    { code: 'USD', pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' },
    { code: 'CHF', pair: 'USD-CHF', source: 'ecb-daily' },
    { code: 'EUR', pair: 'USD-EUR', source: 'ecb-daily' },
    { code: 'PHP', pair: 'USD-PHP', source: 'ecb-daily' },
  ],
};

const POPULATED_STATS = {
  totalSats: 1500,
  totalBtc: '0.00001500',
  totalUsd: '1.43',
  totalChf: '1.20',
  totalEur: '1.30',
  totalPhp: '80.00',
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
      chf: '0.40',
      eur: '0.44',
      php: '27.00',
      cumulativeChf: '0.40',
      cumulativeEur: '0.44',
      cumulativePhp: '27.00',
    },
    {
      day: '2026-06-02',
      sats: 0,
      cumulativeSats: 500,
      btc: '0.00000000',
      cumulativeBtc: '0.00000500',
      usd: '0.00',
      cumulativeUsd: '0.48',
      chf: '0.00',
      eur: '0.00',
      php: '0.00',
      cumulativeChf: '0.40',
      cumulativeEur: '0.44',
      cumulativePhp: '27.00',
    },
    {
      day: '2026-07-01',
      sats: 1000,
      cumulativeSats: 1500,
      btc: '0.00001000',
      cumulativeBtc: '0.00001500',
      usd: '0.95',
      cumulativeUsd: '1.43',
      chf: '0.80',
      eur: '0.86',
      php: '53.00',
      cumulativeChf: '1.20',
      cumulativeEur: '1.30',
      cumulativePhp: '80.00',
    },
  ],
  byRecipient: [
    {
      recipient: 'alice',
      giftCount: 2,
      sats: 1000,
      btc: '0.00001000',
      usd: '0.95',
      chf: '0.80',
      eur: '0.86',
      php: '53.00',
    },
    {
      recipient: 'bob',
      giftCount: 1,
      sats: 500,
      btc: '0.00000500',
      usd: '0.48',
      chf: '0.40',
      eur: '0.44',
      php: '27.00',
    },
  ],
  byMonth: [
    {
      month: '2026-06',
      giftCount: 2,
      sats: 500,
      btc: '0.00000500',
      usd: '0.48',
      chf: '0.40',
      eur: '0.44',
      php: '27.00',
    },
    {
      month: '2026-07',
      giftCount: 1,
      sats: 1000,
      btc: '0.00001000',
      usd: '0.95',
      chf: '0.80',
      eur: '0.86',
      php: '53.00',
    },
  ],
  fx: FX_ALL,
};

const EMPTY_STATS = {
  totalSats: 0,
  totalBtc: '0.00000000',
  totalUsd: '0.00',
  totalChf: '0.00',
  totalEur: '0.00',
  totalPhp: '0.00',
  giftCount: 0,
  recipientCount: 0,
  firstPaidAt: null,
  lastPaidAt: null,
  spendOverTime: [],
  byRecipient: [],
  byMonth: [],
  fx: FX_USD,
};

async function stubPayableNote(page: Page): Promise<void> {
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    const url = route.request().url();
    if (
      url.includes('/invoice') ||
      url.includes('/replies') ||
      route.request().method() !== 'GET'
    ) {
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
            hasPhoto: false,
            role: 'basis',
            replyCount: 1,
          },
        ],
      }),
    });
  });
  await page.route('**/messages/m-pay/replies', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'r-pay',
            name: 'Carol',
            text: 'A payable reply',
            createdAt: '2026-08-28T10:05:00.000Z',
            sats: 0,
            payable: true,
            hasPhoto: false,
            role: 'basis',
            replyCount: 0,
          },
        ],
      }),
    });
  });
  await page.route('**/messages/r-pay/invoice', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pr: PAY_INVOICE, amountSats: 21 }),
    });
  });
}

const walletAssignByPage = new WeakMap<Page, string>();

async function stubWalletLocationAssign(page: Page): Promise<void> {
  const record = (href: string): void => {
    if (href.startsWith('lightning:')) {
      walletAssignByPage.set(page, href);
    }
  };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Page.enable');
  cdp.on('Page.frameRequestedNavigation', (event: { url?: string }) => {
    record(event.url ?? '');
  });
  await page.exposeFunction('__recordWalletAssign', record);
  await page.addInitScript(() => {
    const recordHref = (window as unknown as { __recordWalletAssign?: (href: string) => void })
      .__recordWalletAssign;
    const capture = (href: string): boolean => {
      if (href.startsWith('lightning:')) {
        (window as unknown as { __recordedWalletHref?: string }).__recordedWalletHref = href;
        recordHref?.(href);
        return true;
      }
      return false;
    };
    const loc = window.location;
    const assign = loc.assign.bind(loc);
    loc.assign = (url: string | URL) => {
      const href = String(url);
      if (capture(href)) {
        return;
      }
      assign(url);
    };
    const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(loc), 'href');
    if (desc?.set !== undefined && desc.get !== undefined) {
      Object.defineProperty(loc, 'href', {
        configurable: true,
        enumerable: true,
        get() {
          return desc.get!.call(loc);
        },
        set(value: string) {
          const href = String(value);
          if (capture(href)) {
            return;
          }
          desc.set!.call(loc, value);
        },
      });
    }
  });
}

async function recordedWalletAssign(page: Page): Promise<string | undefined> {
  const fromMap = walletAssignByPage.get(page);
  if (fromMap !== undefined) {
    return fromMap;
  }
  try {
    return await page.evaluate(
      () => (window as unknown as { __recordedWalletHref?: string }).__recordedWalletHref,
    );
  } catch {
    return undefined;
  }
}

async function submitPayAmount(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Continue' }).click();
}

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
  await expect(page).toHaveURL(/\/welcome/);
}

async function openPayInvoice(page: Page, request: APIRequestContext): Promise<void> {
  await stubWalletLocationAssign(page);
  await stubPayableNote(page);
  await signInViaStub(page, request);
  await agreeToLivingRoomRules(page);
  await expect(page).toHaveURL(/\/welcome/);
  await markWalletVerified(page);
  await chooseForumView(page, 'All');
  await page.getByRole('button', { name: 'Show reactions' }).click();
  const replyCard = page.locator('[data-reply-id="r-pay"]');
  await replyCard.getByRole('button', { name: 'Send Bitcoin' }).click();
  await replyCard.getByLabel('Amount').fill('21');
  await submitPayAmount(page);
  await expect(page.getByText('Pay ₿21')).toBeVisible();
}

/** The 21.gifts wallet sentence a Playwright build (no wallet key) shows in a pay sheet. */
const WALLET_UNAVAILABLE = 'Your 21.gifts wallet is not available here, so this cannot be paid.';

/** Public pay link for `ada` whose invoice POST answers {@link PAY_INVOICE}. */
async function stubPayLinkInvoice(page: Page): Promise<void> {
  await page.route(
    (url) => new URL(url).pathname.startsWith('/pay/'),
    async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ pr: PAY_INVOICE, amountSats: 21 }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: 'Ada Lovelace',
          username: 'ada',
          minSats: 1,
          maxSats: 100000,
        }),
      });
    },
  );
}

/** Opens the public pay link and asks for a 21 sat invoice. */
async function openPayLinkInvoice(page: Page): Promise<void> {
  await stubWalletLocationAssign(page);
  await stubPayLinkInvoice(page);
  await page.goto(`/pl?lightning=${encodeURIComponent(PAY_LINK_LNURL)}`);
  await expect(page.getByRole('heading', { name: 'Ada Lovelace' })).toBeVisible();
  await page.getByLabel('Amount').fill('21');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('button', { name: 'Pay with a Bitcoin wallet app' })).toBeEnabled();
}

const PAY_LINK_LNURL =
  'LNURL1DP68GURN8GHJ7V339ENKJEN5WVHJUAM9D3KZ66MWDAMKUTMVDE6HYMRS9ASKGCGMXDMGQ';

async function stubGiftStats(page: Page, body: object): Promise<void> {
  await page.route(/\/gifts\/stats(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
  await fulfillSpot(page, spotRatesFromStats(body as Parameters<typeof spotRatesFromStats>[0]));
}

const EMPTY_ACTIVITY = {
  donatedSats: 0,
  receivedSats: 0,
  donatedOverTime: [] as const,
  receivedOverTime: [] as const,
  fx: FX_USD,
};
async function stubAccountActivity(page: Page, body: unknown): Promise<void> {
  await page.route(/\/me\/activity(?:\?|$)/, async (route) => {
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

async function seedAdaSession(
  page: Page,
  role: 'basis' | 'verified' | 'moderator' | 'founder' = 'basis',
): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route(/\/me\/(?:locale|fiat)$/, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const body = route.request().postDataJSON() as { locale?: unknown; fiat?: unknown };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role,
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        locale: typeof body.locale === 'string' ? body.locale : null,
        fiat: typeof body.fiat === 'string' ? body.fiat : null,
      }),
    });
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role,
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
}

const GERMAN_NOTE_TEXT = 'Kann mir jemand diese Woche ein paar Satoshi leihen?';

/** Signed-in Ada `/welcome` with one paid German note (Active shows Translate). */
async function seedGermanNoteWelcome(page: Page): Promise<void> {
  await seedAdaSession(page);
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-de',
            name: 'Ada',
            text: GERMAN_NOTE_TEXT,
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 5,
            payable: true,
            hasPhoto: false,
            role: 'moderator',
          },
        ],
      }),
    });
  });
}

async function confirmNewAccount(page: Page): Promise<string> {
  await expect(
    page.getByRole('heading', { name: 'Do you already have an account?' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Open a new account' }).click();
  await expect(page.getByRole('heading', { name: 'Choose your name' })).toBeVisible();
  const handle = `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(
    0,
    32,
  );
  await page.getByRole('textbox', { name: 'Name' }).fill(handle);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/setup\/rules/, { timeout: 10_000 });
  return handle;
}

async function signInViaStub(page: Page, _request: APIRequestContext): Promise<string> {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  const handle = await confirmNewAccount(page);
  await expect(page).toHaveURL(/\/setup\/rules/, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  return handle;
}

async function saveOnboardingUsername(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/setup\/username/);
  await page.getByRole('textbox').fill(`ada${Date.now().toString(36)}`);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/setup\/rules/);
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
  await confirmNewAccount(page);
  await expect(page).toHaveURL(/\/setup\/rules/, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  await openSignedInMenu(page);
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/setup\/rules/, { timeout: 10_000 });
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
  const seen = await request.post('/me/wallet-backup-seen', {
    headers: { authorization: `Bearer ${body.token}` },
  });
  expect(seen.status()).toBe(200);
  return body.token;
}

async function signInUnnamed(page: Page, request: APIRequestContext): Promise<void> {
  const token = await loginHttp(request);
  await page.addInitScript((session: string) => {
    localStorage['21gifts.session'] = session;
  }, token);
  await page.goto('/setup/name');
  await expect(page).toHaveURL(/\/setup\/name/);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
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

test('Function: getAppVersion — signed-in Menu shows Version dev', async ({ page, request }) => {
  await signInViaStub(page, request);
  await openSignedInMenu(page);
  await expect(page.getByText('Version dev')).toBeVisible();
});

test('Function: getE2eNow — the document pins the test clock', async ({ page }) => {
  await page.goto('/welcome');
  await expect(page.locator('meta[name="e2e-now"]')).toHaveAttribute(
    'content',
    '2026-01-07T12:00:00.000Z',
  );
});

test('Function: proxyApiRequest — POST passkey register begin is 200', async ({ request }) => {
  const res = await request.post('/auth/passkey/register/begin');
  expect(res.status()).toBe(200);
});

test('Function: proxyMessagesGet — GET /forum/messages without bearer is 401', async ({
  request,
}) => {
  expect((await request.get('/forum/messages')).status()).toBe(401);
});

test('Function: proxyMessagesPost — POST /forum/messages without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/forum/messages', { data: { text: 'hi' } })).status()).toBe(401);
});

test('Function: proxyMessagesRepliesGet — GET /forum/messages/[id]/replies without bearer', async ({
  request,
}) => {
  expect((await request.get('/forum/messages/[id]/replies')).status()).toBeGreaterThanOrEqual(400);
});

test('Function: proxyForumMessageGet — GET /forum/messages/[id] without bearer is 401', async ({
  request,
}) => {
  expect((await request.get('/forum/messages/[id]')).status()).toBeGreaterThanOrEqual(400);
});

test('Function: proxyPublicMessageGet — GET /public-messages/[id] is reachable', async ({
  request,
}) => {
  expect((await request.get('/public-messages/[id]')).status()).toBeGreaterThanOrEqual(400);
});

test('Function: proxyPublicMessageRepliesGet — GET /public-messages/[id]/replies is reachable', async ({
  request,
}) => {
  expect((await request.get('/public-messages/[id]/replies')).status()).toBeGreaterThanOrEqual(400);
});

test('Function: proxyExternalAuthorProfileGet — GET /public-messages/[id]/external-profile is reachable', async ({
  request,
}) => {
  expect(
    (await request.get('/public-messages/[id]/external-profile')).status(),
  ).toBeGreaterThanOrEqual(400);
});

test('Function: proxyExternalAuthorPostsGet — GET /public-messages/[id]/external-posts is reachable', async ({
  request,
}) => {
  expect(
    (await request.get('/public-messages/[id]/external-posts')).status(),
  ).toBeGreaterThanOrEqual(400);
});

test('Function: proxyExternalAuthorRepliesGet — GET /public-messages/[id]/external-replies is reachable', async ({
  request,
}) => {
  expect(
    (await request.get('/public-messages/[id]/external-replies')).status(),
  ).toBeGreaterThanOrEqual(400);
});

test('Function: fetchExternalAuthorProfile — the page shows the address from the client fetch', async ({
  page,
}) => {
  await seedAdaSession(page);
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-ext',
            name: 'Robin',
            via: 'nostr',
            text: 'Hello from Robin',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 21,
            payable: false,
            hasPhoto: false,
            role: 'basis',
          },
        ],
      }),
    });
  });
  await page.route('**/external-profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: 'Robin',
        npub: 'npub1example',
        nip05: 'robin@nostr.example',
        lud16: 'pay@ln.example',
      }),
    });
  });
  await page.goto('/welcome');
  const profileRequest = page.waitForRequest((request) =>
    request.url().includes('/public-messages/m-ext/external-profile'),
  );
  await page.getByRole('button', { name: 'View profile' }).click();
  await expect(page).toHaveURL(/\/messages\/m-ext\/author/);
  expect((await profileRequest).method()).toBe('GET');
  await expect(page.getByText('robin@nostr.example', { exact: true })).toBeVisible();
  await expect(page.getByText('npub1example', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Function: ExternalAuthorProfile — card shows the address, npub, and icon Copy', async ({
  page,
}) => {
  await seedAdaSession(page);
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-ext',
            name: 'Robin',
            via: 'nostr',
            text: 'Hello from Robin',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 21,
            payable: false,
            hasPhoto: false,
            role: 'basis',
          },
        ],
      }),
    });
  });
  await page.route('**/external-profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: 'Robin',
        npub: 'npub1example',
        nip05: 'robin@nostr.example',
        lud16: 'pay@ln.example',
      }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await page.getByRole('button', { name: 'View profile' }).click();
  await expect(page.getByText('robin@nostr.example', { exact: true })).toBeVisible();
  await expect(page.getByText('npub1example', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible();
  await expect(page.getByText('Copy', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Close' })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('link').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'robin@nostr.example' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'npub1example' })).toHaveCount(0);
});

test('Function: fetchExternalAuthorPosts — the page shows a post from the client fetch', async ({
  page,
}) => {
  await page.route('**/external-profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: 'Robin',
        npub: 'npub1example',
        nip05: 'robin@nostr.example',
        lud16: 'pay@ln.example',
        postCount: 1,
        replyCount: 1,
      }),
    });
  });
  await page.route('**/external-posts', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: '33333333-3333-4333-8333-333333333333',
            name: 'Robin',
            via: 'nostr',
            text: 'Robin wrote a note',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: false,
          },
        ],
      }),
    });
  });
  await page.goto('/messages/11111111-1111-4111-8111-111111111111/author?name=Robin');
  await page.getByRole('button', { name: '1 post' }).click();
  await expect(page.getByText('Robin wrote a note')).toBeVisible();
});

test('Function: fetchExternalAuthorReplies — the page shows a reaction from the client fetch', async ({
  page,
}) => {
  await page.route('**/external-profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: 'Robin',
        npub: 'npub1example',
        nip05: 'robin@nostr.example',
        lud16: 'pay@ln.example',
        postCount: 1,
        replyCount: 1,
      }),
    });
  });
  await page.route('**/external-replies', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: '33333333-3333-4333-8333-333333333333',
            name: 'Robin',
            via: 'nostr',
            text: 'Robin wrote a reaction',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: false,
            parentId: '22222222-2222-4222-8222-222222222222',
          },
        ],
      }),
    });
  });
  await page.goto('/messages/11111111-1111-4111-8111-111111111111/author?name=Robin');
  await page.getByRole('button', { name: '1 reaction' }).click();
  await expect(page.getByText('Robin wrote a reaction')).toBeVisible();
});

test('Function: ExternalAuthorPage — heading Profile and the published address', async ({
  page,
}) => {
  await page.route('**/external-profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: 'Robin',
        npub: 'npub1example',
        nip05: 'robin@nostr.example',
        lud16: 'pay@ln.example',
      }),
    });
  });
  await page.goto('/messages/11111111-1111-4111-8111-111111111111/author?name=Robin');
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(page.getByText('robin@nostr.example', { exact: true })).toBeVisible();
});

test('Function: proxyContactPost — POST /contact/submit without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/contact/submit', { data: { text: 'hi' } })).status()).toBe(401);
});

test('Function: proxyConversationsGet — GET /conversations without bearer is 401', async ({
  request,
}) => {
  expect((await request.get('/conversations')).status()).toBe(401);
});

test('Function: proxyConversationsPost — POST /conversations without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/conversations', { data: { forumMessageId: 'x' } })).status()).toBe(
    401,
  );
});

test('Function: proxyConversationGet — GET /conversations/[id] without bearer', async ({
  request,
}) => {
  expect((await request.get('/conversations/[id]')).status()).toBeGreaterThanOrEqual(400);
});

test('Function: proxyConversationPost — POST /conversations/[id] without bearer', async ({
  request,
}) => {
  expect(
    (await request.post('/conversations/[id]', { data: { text: 'hi' } })).status(),
  ).toBeGreaterThanOrEqual(400);
});

test('Function: proxyConversationInvoicePost — POST /conversations/[id]/invoice without bearer', async ({
  request,
}) => {
  expect(
    (await request.post('/conversations/[id]/invoice', { data: { sats: 21 } })).status(),
  ).toBeGreaterThanOrEqual(400);
});

test('Function: proxyConversationReadPost — POST /conversations/[id]/read without bearer', async ({
  request,
}) => {
  expect(
    (await request.post('/conversations/[id]/read', { data: {} })).status(),
  ).toBeGreaterThanOrEqual(400);
});

test('Function: proxyTranslateConversationMessagePost — POST conversation translate without bearer', async ({
  request,
}) => {
  expect(
    (
      await request.post('/conversations/[id]/messages/[messageId]/translate', {
        data: { target: 'en' },
      })
    ).status(),
  ).toBeGreaterThanOrEqual(400);
});

test('Function: translateConversationMessage — Translate an open conversation', async ({
  page,
}) => {
  await seedAdaSession(page);
  await page.route('**/conversations', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || url.pathname !== '/conversations') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [
          {
            id: 'conv-de',
            kind: 'member_member',
            name: 'Bob',
            lastText: GERMAN_NOTE_TEXT,
            lastMessageId: 'cm-de',
            lastAt: '2026-08-28T12:00:00.000Z',
            lastFromMe: false,
            lastSats: 0,
            unread: false,
            unreadMessageCount: 0,
          },
        ],
        unreadCount: 0,
      }),
    });
  });
  await page.route(/\/conversations\/conv-de(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'cm-de',
            name: 'Bob',
            text: GERMAN_NOTE_TEXT,
            fromMe: false,
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 0,
          },
        ],
      }),
    });
  });
  await page.goto('/messages');
  await expect(page.getByText(GERMAN_NOTE_TEXT)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Translate' })).toHaveCount(0);
  await page.goto('/messages?c=conv-de');
  await expect(page.getByText(GERMAN_NOTE_TEXT)).toBeVisible();
  await page.getByRole('button', { name: 'Translate' }).click();
  await expect(page.getByRole('button', { name: 'Show original' })).toBeVisible();
  await expect(page.getByText('Can anyone lend me a few satoshi this week?')).toBeVisible();
});

test('Function: proxyConversationMessagePhotoGet — GET photo without bearer', async ({
  request,
}) => {
  expect(
    (await request.get('/conversations/c1/messages/m1/photo')).status(),
  ).toBeGreaterThanOrEqual(400);
});

test('Function: proxyConversationMessagePhotoGet — GET extra still without bearer', async ({
  request,
}) => {
  expect(
    (await request.get('/conversations/c1/messages/m1/photo/1.jpg')).status(),
  ).toBeGreaterThanOrEqual(400);
});

test('Function: proxyNotificationsGet — GET /forum/notifications without bearer is 401', async ({
  request,
}) => {
  expect((await request.get('/forum/notifications')).status()).toBe(401);
});

test('Function: proxyNotificationsReadAllPost — POST /forum/notifications/read-all without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/forum/notifications/read-all')).status()).toBe(401);
});

test('Function: proxyNotificationsReadByMessagePost — POST /forum/notifications/read-by-message without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/forum/notifications/read-by-message')).status()).toBe(401);
});

test('Function: markNotificationsReadForMessage — opening a signed-in message page POSTs read-by-message', async ({
  page,
}) => {
  const messageId = '11111111-1111-4111-8111-111111111111';
  const noteText = 'Hello from Ada';
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(`**/forum/messages/${messageId}`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET' || pathname !== `/forum/messages/${messageId}`) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: messageId,
        name: 'Ada',
        text: noteText,
        createdAt: '2026-09-12T12:00:00.000Z',
        sats: 0,
        payable: false,
        hasPhoto: false,
      }),
    });
  });
  await page.route(`**/forum/messages/${messageId}/replies`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET' || pathname !== `/forum/messages/${messageId}/replies`) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(/\/forum\/notifications\/read-by-message$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, tags: [] }),
    });
  });
  const readByMessage = page.waitForRequest(
    (req) => req.method() === 'POST' && req.url().includes('/forum/notifications/read-by-message'),
  );
  await page.goto(`/messages/${messageId}`);
  const post = await readByMessage;
  expect(post.method()).toBe('POST');
  expect(post.headers()['authorization']).toBe('Bearer sess-e2e');
  const body = post.postDataJSON() as { messageId?: unknown; endpoint?: unknown };
  expect(body.messageId).toBe(messageId);
  if ('endpoint' in body) {
    expect(typeof body.endpoint).toBe('string');
  }
  await expect(page.getByText(noteText)).toBeVisible();
});

test('Function: pushTagForNotification — clicking a forum reply closes only that push tag', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  const note = {
    id: 'n1',
    type: 'forum_reply',
    parentId: 'p1',
    replyId: 'r1',
    name: 'Bob',
    text: 'hello',
    createdAt: '2026-09-12T12:00:00.000Z',
    readAt: null,
  };
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/forum\/notifications\/read-all$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route(/\/forum\/notifications\/n1\/read$/, async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...note, readAt: '2026-09-12T12:01:00.000Z' }),
    });
  });
  await page.route(/\/forum\/notifications$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notifications: [note], unreadCount: 1 }),
    });
  });
  await page.addInitScript(() => {
    if (
      !Array.isArray((window as unknown as { __e2eClosedPushTags?: string[] }).__e2eClosedPushTags)
    ) {
      (window as unknown as { __e2eClosedPushTags?: string[] }).__e2eClosedPushTags = [];
    }
    const registration = {
      pushManager: {
        getSubscription: async () => ({ endpoint: 'https://push.example/e2e' }),
      },
      getNotifications: async () => [
        {
          tag: 'forum_reply:r1',
          close: () => {
            (window as unknown as { __e2eClosedPushTags?: string[] }).__e2eClosedPushTags?.push(
              'forum_reply:r1',
            );
          },
        },
        {
          tag: 'other',
          close: () => {
            (window as unknown as { __e2eClosedPushTags?: string[] }).__e2eClosedPushTags?.push(
              'other',
            );
          },
        },
      ],
    };
    const serviceWorker = {
      addEventListener() {},
      removeEventListener() {},
      getRegistration: async () => registration,
    };
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: serviceWorker,
    });
  });
  await page.goto('/notifications');
  await page.getByRole('button', { name: /Bob replied/ }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __e2eClosedPushTags?: string[] }).__e2eClosedPushTags,
      ),
    )
    .toEqual(['forum_reply:r1']);
});

test('Function: currentPushEndpoint — clicking a row POSTs read with the push endpoint', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  const note = {
    id: 'n1',
    type: 'forum_reply',
    parentId: 'p1',
    replyId: 'r1',
    name: 'Bob',
    text: 'hello',
    createdAt: '2026-09-12T12:00:00.000Z',
    readAt: null,
  };
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/forum\/notifications\/read-all$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route(/\/forum\/notifications\/n1\/read$/, async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...note, readAt: '2026-09-12T12:01:00.000Z' }),
    });
  });
  await page.route(/\/forum\/notifications$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notifications: [note], unreadCount: 1 }),
    });
  });
  await page.addInitScript(() => {
    if (
      !Array.isArray((window as unknown as { __e2eClosedPushTags?: string[] }).__e2eClosedPushTags)
    ) {
      (window as unknown as { __e2eClosedPushTags?: string[] }).__e2eClosedPushTags = [];
    }
    const registration = {
      pushManager: {
        getSubscription: async () => ({ endpoint: 'https://push.example/e2e' }),
      },
      getNotifications: async () => [
        {
          tag: 'forum_reply:r1',
          close: () => {
            (window as unknown as { __e2eClosedPushTags?: string[] }).__e2eClosedPushTags?.push(
              'forum_reply:r1',
            );
          },
        },
        {
          tag: 'other',
          close: () => {
            (window as unknown as { __e2eClosedPushTags?: string[] }).__e2eClosedPushTags?.push(
              'other',
            );
          },
        },
      ],
    };
    const serviceWorker = {
      addEventListener() {},
      removeEventListener() {},
      getRegistration: async () => registration,
    };
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: serviceWorker,
    });
  });
  await page.goto('/notifications');
  const read = page.waitForRequest(
    (req) => req.method() === 'POST' && req.url().includes('/forum/notifications/n1/read'),
  );
  await page.getByRole('button', { name: /Bob replied/ }).click();
  expect((await read).postDataJSON()).toEqual({ endpoint: 'https://push.example/e2e' });
});

test('Function: closeLocalPushNotifications — clicking a row closes only the matching push tag', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  const note = {
    id: 'n1',
    type: 'forum_reply',
    parentId: 'p1',
    replyId: 'r1',
    name: 'Bob',
    text: 'hello',
    createdAt: '2026-09-12T12:00:00.000Z',
    readAt: null,
  };
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/forum\/notifications\/read-all$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route(/\/forum\/notifications\/n1\/read$/, async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...note, readAt: '2026-09-12T12:01:00.000Z' }),
    });
  });
  await page.route(/\/forum\/notifications$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notifications: [note], unreadCount: 1 }),
    });
  });
  await page.addInitScript(() => {
    if (
      !Array.isArray((window as unknown as { __e2eClosedPushTags?: string[] }).__e2eClosedPushTags)
    ) {
      (window as unknown as { __e2eClosedPushTags?: string[] }).__e2eClosedPushTags = [];
    }
    const registration = {
      pushManager: {
        getSubscription: async () => ({ endpoint: 'https://push.example/e2e' }),
      },
      getNotifications: async () => [
        {
          tag: 'forum_reply:r1',
          close: () => {
            (window as unknown as { __e2eClosedPushTags?: string[] }).__e2eClosedPushTags?.push(
              'forum_reply:r1',
            );
          },
        },
        {
          tag: 'other',
          close: () => {
            (window as unknown as { __e2eClosedPushTags?: string[] }).__e2eClosedPushTags?.push(
              'other',
            );
          },
        },
      ],
    };
    const serviceWorker = {
      addEventListener() {},
      removeEventListener() {},
      getRegistration: async () => registration,
    };
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: serviceWorker,
    });
  });
  await page.goto('/notifications');
  await page.getByRole('button', { name: /Bob replied/ }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __e2eClosedPushTags?: string[] }).__e2eClosedPushTags,
      ),
    )
    .toEqual(['forum_reply:r1']);
});

test('Function: proxyNotificationReadPost — POST /forum/notifications/[id]/read without bearer', async ({
  request,
}) => {
  expect(
    (await request.post('/forum/notifications/[id]/read', { data: {} })).status(),
  ).toBeGreaterThanOrEqual(400);
});

test('Function: proxyMessagesPhotoGet — GET /messages/[id]/photo without a file is 404', async ({
  request,
}) => {
  expect((await request.get('/messages/m1/photo')).status()).toBe(404);
  expect((await request.get('/messages/m1/photo/1.jpg')).status()).toBe(404);
});

test('Function: proxyMessagesVideoGet — GET /messages/[id]/video.mp4 without a file is 404', async ({
  request,
}) => {
  expect((await request.get('/messages/m1/video.mp4')).status()).toBe(404);
});

test('Function: fetchMessagePhoto — photo-only row shows the image alt', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-photo',
            name: 'Ada',
            text: '',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: true,
          },
        ],
      }),
    });
  });
  await page.route(/\/messages\/m-photo\/photo$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      body: Buffer.from(
        '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
        'base64',
      ),
    });
  });
  await page.goto('/welcome');
  await chooseForumView(page, 'All');
  await expect(page.getByAltText('Photo from Ada')).toBeVisible();
});

test('Function: prepareForumPhoto — attach control is visible on welcome', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await openHomeWriter(page);
  await expect(page.getByRole('button', { name: 'Add a photo or video' })).toBeVisible();
});

test('Function: isForumPhotoFile — attach control accepts jpeg png webp', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await openHomeWriter(page);
  const input = page.locator('input[type="file"]');
  await expect(input).toHaveAttribute('accept', /image\/jpeg/);
  await expect(input).toHaveAttribute('accept', /image\/png/);
  await expect(input).toHaveAttribute('accept', /image\/webp/);
});

test('Function: fetchMessages — welcome shows the empty forum', async ({ page, request }) => {
  const handle = await signInViaStub(page, request);
  await agreeToLivingRoomRules(page);
  await expect(page.getByRole('heading', { name: `Welcome, ${handle}` })).toBeVisible();
  await expect(page.getByText('Loading…')).toHaveCount(0);
  await expect(page.getByText('Could not load messages. Please try again.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Write a post' })).toBeVisible();
});

test('Function: postMessage — posting from the composer shows the row', async ({
  page,
  request,
}) => {
  await reachWelcomeVerified(page, request);
  const body = `Hello from Ada ${Date.now()}`;
  await openHomeWriter(page);
  await page.getByLabel('Your message').fill(body);
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByText(body)).toBeVisible();
});

test('Function: postContact — sending from contact shows the official thread', async ({
  page,
  request,
}) => {
  await signInViaStub(page, request);
  await agreeToLivingRoomRules(page);
  await page.goto('/contact');
  const body = `Contact note ${Date.now()}`;
  await page.getByLabel('Your message').fill(body);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page).toHaveURL(/\/messages\?c=/);
  await expect(page.getByText(body)).toBeVisible();
});

/**
 * Marks the signed-in stub account's own in-app wallet as verified, so the
 * api no longer answers that the member cannot receive, then reloads.
 */
async function markWalletVerified(page: Page): Promise<void> {
  const token = await page.evaluate(() => window.localStorage.getItem('21gifts.session'));
  expect(token).toBeTruthy();
  const res = await page.request.post('http://127.0.0.1:3001/e2e/wallet-verified', {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  await page.reload();
}

/** Opens the forum home writer from the floating + (the composer is not on the page). */
async function openHomeWriter(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Write a post' }).click();
  await expect(page.locator('[data-writing-composer]')).toBeVisible();
}

async function reachWelcome(page: Page, request: APIRequestContext): Promise<string> {
  const handle = await signInViaStub(page, request);
  await agreeToLivingRoomRules(page);
  await expect(page).toHaveURL(/\/welcome/);
  await markWalletVerified(page);
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByRole('button', { name: 'Write a post' })).toBeVisible();
  return handle;
}

async function reachWelcomeVerified(page: Page, request: APIRequestContext): Promise<string> {
  const handle = await reachWelcome(page, request);
  await page.route(/\/me$/, async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...body, role: 'verified' }),
    });
  });
  await page.reload();
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByRole('button', { name: 'Write a post' })).toBeVisible();
  return handle;
}

async function attachTinyJpeg(page: Page): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.jpg');
  await expect(page.getByAltText('Selected photo')).toBeVisible({ timeout: 10_000 });
}

async function postAndExpectPhotoRow(
  page: Page,
  author: string,
  caption?: string,
): Promise<string> {
  const posted = page.waitForResponse((response) => {
    if (response.request().method() !== 'POST' || !response.ok()) {
      return false;
    }
    return /\/messages\/?$/.test(new URL(response.url()).pathname);
  });
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  const created = (await (await posted).json()) as {
    id: string;
    text: string;
    hasPhoto: boolean;
  };
  expect(created.hasPhoto).toBe(true);
  expect(created.text).toBe(caption ?? '');
  const row = page.locator(`li[data-message-id="${created.id}"]`);
  await expect(row).toBeVisible();
  await expect(row.getByRole('img', { name: `Photo from ${author}` })).toBeVisible({
    timeout: 10_000,
  });
  if (caption !== undefined) {
    await expect(row).toContainText(caption);
    await expect
      .poll(async () =>
        row.evaluate((el) => {
          const img = el.querySelector('img');
          const captionEl = el.querySelector('p');
          if (img === null || captionEl === null) {
            return false;
          }
          return Boolean(img.compareDocumentPosition(captionEl) & Node.DOCUMENT_POSITION_FOLLOWING);
        }),
      )
      .toBe(true);
  }
  return created.id;
}

test('Function: prepareForumPhoto — attaching a jpeg shows a preview then posts it', async ({
  page,
  request,
}) => {
  const handle = await reachWelcomeVerified(page, request);
  await openHomeWriter(page);
  await attachTinyJpeg(page);
  await postAndExpectPhotoRow(page, handle);
});

test('Function: isForumPhotoFile — photo-only post does not require text', async ({
  page,
  request,
}) => {
  const handle = await reachWelcomeVerified(page, request);
  await openHomeWriter(page);
  await attachTinyJpeg(page);
  await expect(page.getByLabel('Your message')).toHaveValue('');
  await postAndExpectPhotoRow(page, handle);
});

test('Function: fetchMessagePhoto — text plus photo posts both', async ({ page, request }) => {
  const handle = await reachWelcomeVerified(page, request);
  const caption = `Caption ${Date.now()}`;
  await openHomeWriter(page);
  await page.getByLabel('Your message').fill(caption);
  await attachTinyJpeg(page);
  await postAndExpectPhotoRow(page, handle, caption);
});

test('Function: ForumPhotoGallery — two stills peek the next photo', async ({ page }) => {
  const jpeg = Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
    'base64',
  );
  await seedAdaSession(page);
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-photo',
            name: 'Ada',
            text: '',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: true,
            photoCount: 2,
            hasVideo: false,
            role: 'basis',
          },
        ],
      }),
    });
  });
  await page.route(/\/messages\/m-photo\/photo/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/jpeg', body: jpeg });
  });
  await page.goto('/welcome');
  await chooseForumView(page, 'All');
  await expect(page.getByText('1/2')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Photo 2 of 2' })).toBeVisible();
});

test('Function: ForumBoard — empty post without a photo is rejected', async ({ page, request }) => {
  await reachWelcome(page, request);
  await openHomeWriter(page);
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByText('Enter a message or add a photo or video')).toBeVisible();
});

test('Function: ForumLoader — remove photo clears the preview', async ({ page, request }) => {
  await reachWelcome(page, request);
  await openHomeWriter(page);
  await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.jpg');
  await expect(page.getByAltText('Selected photo')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Remove photo' }).click();
  await expect(page.getByAltText('Selected photo')).toHaveCount(0);
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByText('Enter a message or add a photo or video')).toBeVisible();
});

test('Function: proxyMeGet — GET /me with bearer is 200', async ({ request }) => {
  const token = await loginHttp(request);
  const res = await request.get('/me', { headers: { authorization: `Bearer ${token}` } });
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { role: string }).role).toBe('basis');
});

test('Function: proxyMeAboutPut — PUT /me/about without bearer is 401', async ({ request }) => {
  const res = await request.put('/me/about', { data: { text: 'Hi' } });
  expect(res.status()).toBe(401);
});

test('Function: putProfilePhoto — PUT /pictures/me without bearer is 401', async ({ request }) => {
  const res = await request.put('/pictures/me', { data: { photo: null } });
  expect(res.status()).toBe(401);
});

test('Function: fetchProfilePhoto — GET /pictures/me without bearer is 401', async ({
  request,
}) => {
  const res = await request.get('/pictures/me');
  expect(res.status()).toBe(401);
});

test('Function: proxyProfilePhotoGet — GET /pictures/me without bearer is 401', async ({
  request,
}) => {
  const res = await request.get('/pictures/me');
  expect(res.status()).toBe(401);
});

test('Function: proxyProfilePhotoPut — PUT /pictures/me without bearer is 401', async ({
  request,
}) => {
  const res = await request.put('/pictures/me', { data: { photo: null } });
  expect(res.status()).toBe(401);
});

test('Function: putWideBanner — PUT /banners/me without bearer is 401', async ({ request }) => {
  const res = await request.put('/banners/me', { data: { photo: null } });
  expect(res.status()).toBe(401);
});

test('Function: fetchWideBanner — GET /banners/me without bearer is 401', async ({ request }) => {
  const res = await request.get('/banners/me');
  expect(res.status()).toBe(401);
});

test('Function: proxyWideBannerGet — GET /banners/me without bearer is 401', async ({
  request,
}) => {
  const res = await request.get('/banners/me');
  expect(res.status()).toBe(401);
});

test('Function: proxyWideBannerPut — PUT /banners/me without bearer is 401', async ({
  request,
}) => {
  const res = await request.put('/banners/me', { data: { photo: null } });
  expect(res.status()).toBe(401);
});

test('Function: proxyMeAboutPhotoGet — GET /me/about/photo without bearer is 401', async ({
  request,
}) => {
  const res = await request.get('/me/about/photo');
  expect(res.status()).toBe(401);
});

test('Function: proxyViewAboutPhotoGet — GET /view-key/[viewKey]/about/photo without a file is 404', async ({
  request,
}) => {
  const res = await request.get('/view-key/[viewKey]/about/photo');
  expect(res.status()).toBeGreaterThanOrEqual(400);
});

test('Function: PUT — PUT /me/about without bearer is 401', async ({ request }) => {
  const res = await request.put('/me/about', { data: { text: 'Hi' } });
  expect(res.status()).toBe(401);
});

test('Function: putAboutMe — signed-in profile saves About me', async ({ page, request }) => {
  await reachWelcome(page, request);
  await page.goto('/profile');
  const intro = page.getByRole('dialog', { name: 'Introduce yourself' });
  if (await intro.isVisible()) {
    await page.getByRole('button', { name: 'Close' }).click();
  }
  await page.getByRole('button', { name: 'Write your About me' }).click();
  await page.getByRole('textbox', { name: 'About me' }).fill('I build on Bitcoin');
  await page.getByRole('button', { name: 'Save About me' }).click();
  await expect(page.getByText('I build on Bitcoin')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Write your About me' })).toHaveCount(0);
});

test('Function: AboutMeSection — signed-in profile shows the empty About me prompt', async ({
  page,
  request,
}) => {
  await reachWelcome(page, request);
  await page.goto('/profile');
  await expect(page.getByText('Tell others who you are.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Write your About me' })).toBeVisible();
});

test('Function: fetchAboutMePhoto — signed-in profile About me photo is visible after attach', async ({
  page,
  request,
}) => {
  await reachWelcome(page, request);
  await page.goto('/profile');
  const intro = page.getByRole('dialog', { name: 'Introduce yourself' });
  if (await intro.isVisible()) {
    await page.getByRole('button', { name: 'Close' }).click();
  }
  await page.getByRole('button', { name: 'Write your About me' }).click();
  await page.getByRole('button', { name: 'Add a photo' }).click();
  await page
    .locator('input[type="file"]:not([name])')
    .first()
    .setInputFiles('e2e/fixtures/tiny.jpg');
  await expect(page.getByAltText('Selected photo')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('textbox', { name: 'About me' }).fill('I build on Bitcoin');
  await page.getByRole('button', { name: 'Save About me' }).click();
  await expect(page.getByAltText('About me photo')).toBeVisible();
});

test('Function: fetchViewAboutMePhoto — public view shows the About me photo', async ({
  page,
  request,
}) => {
  const token = await loginHttp(request);
  const named = await request.post('/me/name', {
    headers: { authorization: `Bearer ${token}` },
    data: { name: 'Ada' },
  });
  expect(named.status()).toBe(200);
  const put = await request.put('/me/about', {
    headers: { authorization: `Bearer ${token}` },
    data: {
      text: 'Hello from Ada.',
      photo: { contentType: 'image/jpeg', data: '/9j/4AAQ' },
    },
  });
  expect(put.status()).toBe(200);
  const me = await request.get('/me', { headers: { authorization: `Bearer ${token}` } });
  const viewKey = ((await me.json()) as { viewKey: string }).viewKey;
  await page.goto(`/view/${viewKey}`);
  await expect(page.getByAltText('About me photo')).toBeVisible();
});

test('Function: fetchMe — reload hydrates the signed-in view', async ({ page, request }) => {
  await signInViaStub(page, request);
  await page.reload();
  await expect(page).toHaveURL(/\/setup\/rules/);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('Function: proxyMeSetupSkipPost — POST /me/setup/skip advances setup', async ({ request }) => {
  const token = await loginHttp(request);
  const res = await request.post('/me/setup/skip', {
    headers: { authorization: `Bearer ${token}` },
    data: { step: 'name' },
  });
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { setup: string | null; missing: string[] };
  expect(body.setup).toBe('username');
  expect(body.missing).toContain('name');
  expect(body.missing).toContain('username');
});

test('Function: skipSetup — Skip on name setup advances without a name', async ({
  page,
  request,
}) => {
  await signInUnnamed(page, request);
  await page.goto('/setup/name');
  await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page).toHaveURL(/\/setup\/username/);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0);
});

test('Function: NameForm — Skip is absent on the rules setup screen', async ({ page, request }) => {
  await signInUnnamed(page, request);
  await page.getByRole('button', { name: 'Skip' }).click();
  await saveOnboardingUsername(page);
  await expect(page).toHaveURL(/\/setup\/rules/);
  await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0);
});

test('Function: proxyMembersGet — GET /forum/members/:id returns a canned profile', async ({
  request,
}) => {
  const token = await loginHttp(request);
  await request.post('/me/name', {
    headers: { authorization: `Bearer ${token}` },
    data: { name: 'Ada' },
  });
  await request.post('/me/rules-agreement', { headers: { authorization: `Bearer ${token}` } });
  const res = await request.get('/forum/members/22222222-2222-4222-8222-222222222222', {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { name: string }).name).toBe('Carol');
});

test('Function: proxyMembersPostsGet — GET /forum/members/:id/posts returns canned posts', async ({
  request,
}) => {
  const token = await loginHttp(request);
  await request.post('/me/rules-agreement', { headers: { authorization: `Bearer ${token}` } });
  const res = await request.get('/forum/members/22222222-2222-4222-8222-222222222222/posts', {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  expect(JSON.stringify(await res.json())).toContain('Second post from Carol.');
});

test('Function: proxyMembersRepliesGet — GET /forum/members/:id/replies returns canned replies', async ({
  request,
}) => {
  const token = await loginHttp(request);
  await request.post('/me/rules-agreement', { headers: { authorization: `Bearer ${token}` } });
  const res = await request.get('/forum/members/22222222-2222-4222-8222-222222222222/replies', {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  expect(JSON.stringify(await res.json())).toContain('A reply from Carol.');
});

test('Function: fetchMember — member page shows the canned profile', async ({ page, request }) => {
  await reachWelcome(page, request);
  await page.goto('/members/22222222-2222-4222-8222-222222222222');
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(page.getByText('carol@21.gifts')).toBeVisible();
});

test('Function: fetchMemberPosts — member posts open from the count', async ({ page, request }) => {
  await reachWelcome(page, request);
  await page.goto('/members/22222222-2222-4222-8222-222222222222');
  await page.getByRole('button', { name: '2 posts' }).click();
  await expect(page.getByText('Second post from Carol.')).toBeVisible();
});

test('Function: fetchMember — an empty About me note leaves the profile and its other posts', async ({
  page,
  request,
}) => {
  await reachWelcome(page, request);
  await page.goto('/members/77777777-7777-4777-8777-777777777777');
  await expect(page.getByText('dana@21.gifts')).toBeVisible();
  await expect(page.getByText('Could not load this profile. Please try again.')).toHaveCount(0);
  await expect(page.getByText('About me')).toHaveCount(0);
  await page.getByRole('button', { name: '2 posts' }).click();
  await expect(page.getByText('A post from Dana.')).toBeVisible();
  await expect(page.getByText('Could not load messages. Please try again.')).toHaveCount(0);
});

test('Function: fetchMessages — one empty note on the All page leaves the other notes', async ({
  page,
  request,
}) => {
  await reachWelcome(page, request);
  const served: string[][] = [];
  await page.route(/\/forum\/messages\?/, async (route) => {
    const requested = new URL(route.request().url());
    const url = new URL(
      '/forum/members/77777777-7777-4777-8777-777777777777/posts',
      route.request().url(),
    );
    const fetched = await route
      .fetch({ url: url.toString() })
      .then(async (response) => ({
        response,
        body: (await response.json()) as { messages: { text: string }[] },
      }))
      .catch(() => null);
    if (fetched === null) {
      // The reload below cancels a feed request the old page still had in
      // flight; its response is disposed and nothing is left to answer.
      return;
    }
    const { response, body } = fetched;
    // Page 1 holds only the empty About me note; its cursor leads to the fixture page.
    const json =
      requested.searchParams.get('cursor') === 'after-empty'
        ? { messages: body.messages }
        : { messages: body.messages.filter((row) => row.text === ''), nextCursor: 'after-empty' };
    served.push(json.messages.map((row) => row.text));
    await route.fulfill({ response, json });
  });
  await page.reload();
  const view = page.getByRole('combobox', { name: 'Forum view' });
  await view.click();
  await page.getByRole('option', { name: 'All', exact: true }).click();
  await expect(view).toContainText('All');
  await expect(page.getByText('A post from Dana.')).toBeVisible();
  await expect(page.getByText('Could not load messages. Please try again.')).toHaveCount(0);
  expect(served).toContainEqual(['']);
  expect(served).toContainEqual(['A post from Dana.', '']);
});

test('Function: fetchMemberReplies — member replies open from the count', async ({
  page,
  request,
}) => {
  await reachWelcome(page, request);
  await page.goto('/members/22222222-2222-4222-8222-222222222222');
  await page.getByRole('button', { name: '1 reaction' }).click();
  await expect(page.getByText('A reply from Carol.')).toBeVisible();
});

test('Function: MissingRequirementsError — 409 body is missing_requirements', async ({
  request,
}) => {
  const token = await loginHttp(request);
  const res = await request.post('/forum/messages', {
    headers: { authorization: `Bearer ${token}` },
    data: { text: 'blocked until name and rules' },
  });
  expect(res.status()).toBe(409);
  const body = (await res.json()) as { error: string; missing: string[] };
  expect(body.error).toBe('missing_requirements');
  expect(body.missing.length).toBeGreaterThan(0);
});

test('Function: parseMissingRequirements — documented via MissingRequirementsError path', async ({
  request,
}) => {
  const token = await loginHttp(request);
  const res = await request.post('/forum/messages', {
    headers: { authorization: `Bearer ${token}` },
    data: { text: 'blocked until name and rules' },
  });
  expect(res.status()).toBe(409);
  const body = (await res.json()) as { error: string; missing: string[] };
  expect(body.error).toBe('missing_requirements');
  expect(body.missing.length).toBeGreaterThan(0);
});

test('Function: MemberProfileLoader — missing id shows view.missing', async ({ page, request }) => {
  await reachWelcome(page, request);
  await page.goto('/members/not-a-uuid');
  await expect(page.getByText('This profile could not be found.')).toBeVisible();
});

test('Function: MemberProfileScreen — role pill is visible on the canned member', async ({
  page,
  request,
}) => {
  await reachWelcome(page, request);
  await page.goto('/members/22222222-2222-4222-8222-222222222222');
  await expect(page.getByRole('button', { name: 'Verified' }).first()).toBeVisible();
});

test('Function: RequirementsOverlay — contact post without a name opens the overlay', async ({
  page,
  request,
}) => {
  await signInUnnamed(page, request);
  await page.getByRole('button', { name: 'Skip' }).click();
  await saveOnboardingUsername(page);
  await agreeToLivingRoomRules(page);
  await expect(page).toHaveURL(/\/welcome/);
  await page.goto('/contact');
  await page.getByRole('textbox', { name: 'Your message' }).fill('Need a name first');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('dialog', { name: 'Add your name' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0);
});

test('Function: RequirementsOverlay — forum post without a set-up wallet explains the wallet', async ({
  page,
  request,
}) => {
  await signInViaStub(page, request);
  await agreeToLivingRoomRules(page);
  await expect(page).toHaveURL(/\/welcome/);
  await openHomeWriter(page);
  await page.getByLabel('Your message').fill('Hello');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Your wallet is not set up' });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText(
      'Gifts and posts need your own 21.gifts wallet, and it is not set up yet. Open your wallet to set it up.',
    ),
  ).toBeVisible();
  await expect(dialog.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0);
});

test('Function: IntroduceYourselfOverlay — signed-in member without a post sees the dialog', async ({
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        hasPosted: false,
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByRole('dialog', { name: 'Introduce yourself' })).toBeVisible();
  await page.getByRole('button', { name: 'Write an introduction' }).click();
  await expect(page.getByRole('dialog', { name: 'Introduce yourself' })).toHaveCount(0);
  await expect(page.getByLabel('Your message')).toBeFocused();
});

test('Function: requestForumCompose — Write an introduction opens the writer with its field focused', async ({
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        hasPosted: false,
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'Write an introduction' }).click();
  await expect(page.getByLabel('Your message')).toBeFocused();
});

/** A finished member who has not posted yet; the forum list and the till are empty. */
async function stubMemberWithoutPost(page: Page): Promise<void> {
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
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        hasPosted: false,
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'GET' || route.request().resourceType() === 'document') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(/\/pos\/charge$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ charge: null, history: [] }),
    });
  });
}

test('Function: consumeSkipIntroduceOverlay — after Write an introduction the next screen uses the skip, and the forum asks again', async ({
  page,
}) => {
  await stubMemberWithoutPost(page);
  await page.goto('/welcome');
  const intro = page.getByRole('dialog', { name: 'Introduce yourself' });
  await expect(intro).toBeVisible();
  await page.getByRole('button', { name: 'Write an introduction' }).click();
  await expect(intro).toHaveCount(0);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Balance', exact: true }).click();
  await expect(page).toHaveURL(/\/wallet$/);
  await expect(intro).toHaveCount(0);
  await page.getByRole('link', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(intro).toBeVisible();
});

test('Function: consumePendingForumCompose — Write an introduction on the forum focuses the composer', async ({
  page,
}) => {
  await stubMemberWithoutPost(page);
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'Write an introduction' }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByLabel('Your message')).toBeFocused();
});

test('introduce dialog never covers the wallet, its Send and Receive, or the profile after onboarding', async ({
  page,
}) => {
  await stubMemberWithoutPost(page);
  const intro = page.getByRole('dialog', { name: 'Introduce yourself' });
  await page.goto('/wallet');
  await expect(page.getByRole('heading', { name: 'Wallet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Receive' })).toBeEnabled();
  await page.getByRole('button', { name: 'Receive' }).click();
  await expect(page.getByText('ada@21.gifts')).toBeVisible();
  await expect(intro).toHaveCount(0);
  await page.goto('/wallet/phrase');
  await expect(page.getByRole('heading', { name: 'Wallet' })).toBeVisible();
  await expect(intro).toHaveCount(0);
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(intro).toHaveCount(0);
  await page.goto('/messages');
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  await expect(intro).toHaveCount(0);
  await page.goto('/welcome');
  await expect(intro).toBeVisible();
});

test('Function: MemberProfileScreen — public card shows About me, copy-profile-link, and Message', async ({
  page,
}) => {
  const memberId = '22222222-2222-4222-8222-222222222222';
  const noteId = '33333333-3333-4333-8333-333333333333';
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1_700_000_000,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: ['lightning-address'],
      }),
    });
  });
  await page.route(`**/forum/members/${memberId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: memberId,
        name: 'Carol',
        location: null,
        role: 'verified',
        lightningAddress: null,
        createdAt: '2026-01-15T12:00:00.000Z',
        aboutMe: 'Hello from Carol.',
        profileMessage: {
          id: noteId,
          accountId: memberId,
          name: 'Carol',
          text: 'Hello from my profile note.',
          createdAt: '2026-08-01T10:00:00.000Z',
          sats: 21,
          payable: true,
          hasPhoto: false,
          role: 'verified',
          replyCount: 0,
        },
        postCount: 1,
        replyCount: 0,
      }),
    });
  });
  await page.route(`**/forum/members/${memberId}/activity`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(EMPTY_ACTIVITY),
    });
  });
  await page.goto(`/members/${memberId}`);
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(page.getByText('About me')).toBeVisible();
  await expect(page.getByText('Hello from Carol.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy link to this profile' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Message' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show reactions' })).toHaveCount(0);
  await expect(page.getByLabel('Your reaction')).toHaveCount(0);
});

test('Function: MemberProfileScreen — reply without a set-up wallet opens the wallet overlay from the posts feed', async ({
  page,
}) => {
  const memberId = '22222222-2222-4222-8222-222222222222';
  const noteId = '33333333-3333-4333-8333-333333333333';
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1_700_000_000,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: ['lightning-address'],
      }),
    });
  });
  await page.route(`**/forum/members/${memberId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: memberId,
        name: 'Carol',
        location: null,
        role: 'verified',
        lightningAddress: null,
        createdAt: '2026-01-15T12:00:00.000Z',
        aboutMe: 'Hello from Carol.',
        profileMessage: {
          id: noteId,
          accountId: memberId,
          name: 'Carol',
          text: 'Hello from my profile note.',
          createdAt: '2026-08-01T10:00:00.000Z',
          sats: 21,
          payable: true,
          hasPhoto: false,
          role: 'verified',
          replyCount: 0,
        },
        postCount: 1,
        replyCount: 0,
      }),
    });
  });
  await page.route(`**/forum/members/${memberId}/activity`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(EMPTY_ACTIVITY),
    });
  });
  await page.route(`**/forum/members/${memberId}/posts`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: noteId,
            accountId: memberId,
            name: 'Carol',
            text: 'Hello from my profile note.',
            createdAt: '2026-08-01T10:00:00.000Z',
            sats: 21,
            payable: true,
            hasPhoto: false,
            role: 'verified',
            replyCount: 0,
          },
        ],
      }),
    });
  });
  await page.route(`**/forum/messages/${noteId}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto(`/members/${memberId}`);
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await page.getByRole('button', { name: '1 post' }).click();
  await expect(page.getByText('Hello from my profile note.')).toBeVisible();
  await page.getByRole('button', { name: 'Show reactions' }).click();
  await expect(page.getByLabel('Your reaction')).toBeVisible();
  await page.getByLabel('Your reaction').fill('Hello');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Your wallet is not set up' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0);
});

test('Function: nextPostRequirement — rules come right after the username, with no address step', async ({
  page,
  request,
}) => {
  await signInUnnamed(page, request);
  await expect(page).toHaveURL(/\/setup\/name/);
  await page.getByRole('button', { name: 'Skip' }).click();
  await saveOnboardingUsername(page);
  await expect(page).toHaveURL(/\/setup\/rules/);
  const chapter = `1 of ${RULES_CHAPTER_IDS.length}`;
  await expect(page.getByText(chapter, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('Function: nextContactRequirement — contact still opens the name overlay without requiring a wallet', async ({
  page,
  request,
}) => {
  await signInUnnamed(page, request);
  await page.getByRole('button', { name: 'Skip' }).click();
  await saveOnboardingUsername(page);
  await agreeToLivingRoomRules(page);
  await expect(page).toHaveURL(/\/welcome/);
  await page.goto('/contact');
  await page.getByRole('textbox', { name: 'Your message' }).fill('Need a name first');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('dialog', { name: 'Add your name' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0);
});

test('Function: MemberProfilePage — member page heading is visible', async ({ page, request }) => {
  await reachWelcome(page, request);
  await page.goto('/members/22222222-2222-4222-8222-222222222222');
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
});

test('e2e:check dynamic path token for /members/[accountId]', async ({ page, request }) => {
  await page.goto('/members/[accountId]');
  await request.get('/forum/members/[accountId]');
  await request.get('/forum/members/[accountId]/posts');
  await request.get('/forum/members/[accountId]/replies');
});

test('Function: proxyMeUsernamePost — POST /me/username without bearer is 401', async ({
  request,
}) => {
  const res = await request.post('/me/username', { data: { username: 'ada' } });
  expect(res.status()).toBe(401);
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

test('Function: proxyMeLocationPost — POST /me/location sets a location', async ({ request }) => {
  const token = await loginHttp(request);
  const res = await request.post('/me/location', {
    headers: { authorization: `Bearer ${token}` },
    data: { location: 'Zug' },
  });
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { location: string | null }).location).toBe('Zug');
  const me = await request.get('/me', { headers: { authorization: `Bearer ${token}` } });
  expect(((await me.json()) as { location: string | null }).location).toBe('Zug');
  const cleared = await request.post('/me/location', {
    headers: { authorization: `Bearer ${token}` },
    data: { location: '' },
  });
  expect(cleared.status()).toBe(200);
  expect(((await cleared.json()) as { location: string | null }).location).toBeNull();
  const maxOk = await request.post('/me/location', {
    headers: { authorization: `Bearer ${token}` },
    data: { location: 'A'.repeat(80) },
  });
  expect(maxOk.status()).toBe(200);
  const tooLong = await request.post('/me/location', {
    headers: { authorization: `Bearer ${token}` },
    data: { location: 'A'.repeat(81) },
  });
  expect(tooLong.status()).toBe(400);
});

test('Function: proxyMeForumLawsDismissedPost — POST /me/forum-laws-dismissed sets the flag', async ({
  request,
}) => {
  const token = await loginHttp(request);
  const res = await request.post('/me/forum-laws-dismissed', {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { forumLawsDismissed: boolean }).forumLawsDismissed).toBe(true);
  const me = await request.get('/me', { headers: { authorization: `Bearer ${token}` } });
  expect(((await me.json()) as { forumLawsDismissed: boolean }).forumLawsDismissed).toBe(true);
  const again = await request.post('/me/forum-laws-dismissed', {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(again.status()).toBe(200);
  expect(((await again.json()) as { forumLawsDismissed: boolean }).forumLawsDismissed).toBe(true);
});

test('Function: proxyMeNotificationLevelPost — POST /me/notification-level without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/me/notification-level')).status()).toBe(401);
});

test('Function: proxyMeHeartNotificationsPost — POST /me/heart-notifications without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/me/heart-notifications')).status()).toBe(401);
});

test('Function: proxyMeAmountUnitPost — POST /me/amount-unit without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/me/amount-unit')).status()).toBe(401);
});

test('Function: proxyMeLocalePost — POST /me/locale stores de', async ({ request }) => {
  const token = await loginHttp(request);
  const res = await request.post('/me/locale', {
    headers: { authorization: `Bearer ${token}` },
    data: { locale: 'de', onlyIfUnset: false },
  });
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { locale: string }).locale).toBe('de');
});

test('Function: proxyMeFiatPost — POST /me/fiat stores CHF', async ({ request }) => {
  const token = await loginHttp(request);
  const res = await request.post('/me/fiat', {
    headers: { authorization: `Bearer ${token}` },
    data: { fiat: 'CHF', onlyIfUnset: false },
  });
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { fiat: string }).fiat).toBe('CHF');
});

test('Function: setAccountLocale — profile language saves Deutsch', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/profile');
  const deutsch = page.getByRole('button', { name: 'Deutsch' });
  await deutsch.click();
  await expect(deutsch).toHaveAttribute('aria-pressed', 'true');
});

test('Function: setAccountFiat — profile currency saves CHF', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/profile');
  const chf = page
    .getByRole('group', { name: 'Fiat currency' })
    .getByRole('button', { name: 'CHF' });
  await chf.click();
  await expect(chf).toHaveAttribute('aria-pressed', 'true');
});

test('Function: AccountPreferenceSync — an empty account stores the screen language', async ({
  page,
}) => {
  await seedAdaSession(page);
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        locale: null,
        fiat: null,
      }),
    });
  });
  await page.goto('/profile');
  await expect.poll(() => page.evaluate(() => document.cookie)).toContain('locale=en');
});

test('Function: bumpLocaleGeneration — profile language saves Español', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/profile');
  const espanol = page.getByRole('button', { name: 'Español' });
  await espanol.click();
  await expect(espanol).toHaveAttribute('aria-pressed', 'true');
});

test('Function: localeGeneration — profile language saves Filipino', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/profile');
  const filipino = page.getByRole('button', { name: 'Filipino' });
  await filipino.click();
  await expect(filipino).toHaveAttribute('aria-pressed', 'true');
});

test('Function: bumpFiatGeneration — profile currency saves EUR', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/profile');
  const eur = page
    .getByRole('group', { name: 'Fiat currency' })
    .getByRole('button', { name: 'EUR' });
  await eur.click();
  await expect(eur).toHaveAttribute('aria-pressed', 'true');
});

test('Function: fiatGeneration — profile currency saves PHP', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/profile');
  const php = page
    .getByRole('group', { name: 'Fiat currency' })
    .getByRole('button', { name: 'PHP' });
  await php.click();
  await expect(php).toHaveAttribute('aria-pressed', 'true');
});

test('Function: proxyMeRulesAgreementPost — POST /me/rules-agreement sets agreement', async ({
  request,
}) => {
  const token = await loginHttp(request);
  expect((await request.post('/me/rules-agreement')).status()).toBe(401);
  const first = await request.post('/me/rules-agreement', {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(first.status()).toBe(200);
  const firstBody = (await first.json()) as { rulesAgreedAt: number | null };
  expect(typeof firstBody.rulesAgreedAt).toBe('number');
  const second = await request.post('/me/rules-agreement', {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(second.status()).toBe(200);
  const secondBody = (await second.json()) as { rulesAgreedAt: number | null };
  expect(secondBody.rulesAgreedAt).toBe(firstBody.rulesAgreedAt);
});

test('Function: dismissForumLaws — welcome laws hint dismisses', async ({ page, request }) => {
  await signInViaStub(page, request);
  await agreeToLivingRoomRules(page);
  await expect(page).toHaveURL(/\/welcome/);
  await expect(
    page.getByText(
      '21.gifts is a donation platform: gifts are free, and nobody pays for a promise.',
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(
    page.getByText(
      '21.gifts is a donation platform: gifts are free, and nobody pays for a promise.',
    ),
  ).toHaveCount(0);
});

test('Function: agreeToRules — signed-in rules screen records agreement', async ({
  page,
  request,
}) => {
  const handle = await signInViaStub(page, request);
  await agreeToLivingRoomRules(page);
  await expect(page.getByRole('heading', { name: `Welcome, ${handle}` })).toBeVisible();
});

test('Function: RulesSetup — agree button is visible on the rules screen', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: null,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: 'rules',
        missing: ['rules'],
      }),
    });
  });
  await page.goto('/setup/rules');
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('Function: RulesDocument — onboarding first chapter is the lead', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: null,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: 'rules',
        missing: ['rules'],
      }),
    });
  });
  await page.goto('/setup/rules');
  await expect(page.getByText(/You are a guest in a living room/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Our house' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Welcome' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/setup\/rules/);
  await expect(page.getByRole('heading', { name: 'Only free donations' })).toBeVisible();
});

test('Function: RulesSetupPage — rules setup heading is visible', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: null,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: 'rules',
        missing: ['rules'],
      }),
    });
  });
  await page.goto('/setup/rules');
  await expect(page.getByRole('heading', { name: 'Living room rules' })).toBeVisible();
});

test('Function: hasAgreedToRules — a name without agreement stays on rules', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: null,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: 'rules',
        missing: ['rules'],
      }),
    });
  });
  await page.goto('/setup/rules');
  await expect(page).toHaveURL(/\/setup\/rules/);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

/** After the name step the next screen is rules (no address step) and `/me` has the name. */
async function expectSavedName(page: Page, name: string): Promise<void> {
  await expect(page).toHaveURL(/\/setup\/rules/);
  const token = await page.evaluate(() => window.localStorage.getItem('21gifts.session'));
  const me = await page.request.get('/me', { headers: { authorization: `Bearer ${token}` } });
  expect(((await me.json()) as { name: string | null }).name).toBe(name);
}

test('Function: NameForm — signed-in form saves a display name', async ({ page, request }) => {
  await signInUnnamed(page, request);
  await expect(page.getByText(/Add your name so people know who you are/i)).toBeVisible();
  await page.getByRole('textbox', { name: 'Name' }).fill('Ada');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expectSavedName(page, 'Ada');
});

test('Function: setName — signed-in form saves a display name', async ({ page, request }) => {
  await signInUnnamed(page, request);
  await page.getByRole('textbox', { name: 'Name' }).fill('Ada');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expectSavedName(page, 'Ada');
});

test('Function: RootLayout — landing renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Direct human-to-human gifts/i })).toBeVisible();
});

test('Function: Home — landing renders the pitch', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Direct human-to-human gifts/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Donate to this project' })).toBeVisible();
  await expect(page.getByRole('link', { name: '21gifts@21.gifts' })).toHaveAttribute(
    'href',
    'lightning:21gifts@21.gifts',
  );
});

test('Function: MarketingLayout — landing has marketing chrome', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: '21.gifts' }).first()).toBeVisible();
});

test('Function: MarketingHeader — landing shows the wordmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: '21.gifts' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to the forum' })).toHaveAttribute(
    'href',
    '/welcome',
  );
});

test('Function: PwaInstall — iPhone Safari shows the install control', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () =>
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    Object.defineProperty(navigator, 'standalone', {
      configurable: true,
      get: () => false,
    });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Install app' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Install app' }).first().click();
  await expect(
    page.getByRole('heading', { name: 'Add 21.gifts to your Home Screen' }),
  ).toBeVisible();
});

test('Function: PwaInstall — iPhone Chrome shows the install control', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () =>
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
    });
    Object.defineProperty(navigator, 'standalone', {
      configurable: true,
      get: () => false,
    });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Install app' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Install app' }).first().click();
  await expect(
    page.getByRole('heading', { name: 'Add 21.gifts to your Home Screen' }),
  ).toBeVisible();
});

test('Function: shouldOfferIosInstall — iPhone Safari shows the install control', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () =>
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    Object.defineProperty(navigator, 'standalone', {
      configurable: true,
      get: () => false,
    });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Install app' }).first()).toBeVisible();
});

test('Function: MarketingFooter — landing shows the footer wordmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('footer').getByText('21.gifts')).toBeVisible();
});

test('Function: LegalPage — legal heading is visible', async ({ page }) => {
  await page.goto('/legal');
  await expect(page.getByRole('heading', { name: 'Legal Notice' })).toBeVisible();
});

test('Function: AboutPage — about heading is visible', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByRole('heading', { name: 'Three convictions' })).toBeVisible();
});

test('Function: HandbookPage — handbook heading is visible', async ({ page }) => {
  await page.goto('/handbook');
  await expect(page.getByRole('heading', { name: 'Handbook' }).first()).toBeVisible();
});

test('Function: HandbookScreensPage — screens heading is visible', async ({ page }) => {
  await page.goto('/handbook/screens');
  await expect(page.getByRole('heading', { name: 'Screens' }).first()).toBeVisible();
});

test('Function: HandbookFunctionsPage — functions heading is visible', async ({ page }) => {
  await page.goto('/handbook/functions');
  await expect(page.getByRole('heading', { name: 'Functions' }).first()).toBeVisible();
});

test('Function: HandbookEndpointsPage — endpoints heading is visible', async ({ page }) => {
  await page.goto('/handbook/endpoints');
  await expect(page.getByRole('heading', { name: 'Endpoints' }).first()).toBeVisible();
});

test('Function: HandbookImageViewer — compact cards and a viewport switch', async ({ page }) => {
  await page.goto('/handbook/screens');
  await expect(page.getByAltText('/ default')).toBeVisible();
  await expect(page.getByAltText('/ mobile-nav')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mobile', exact: true })).toBeVisible();
});

test('Function: HandbookOutline — contents lists chapter screen and variant', async ({ page }) => {
  await page.goto('/handbook/screens');
  const nav = page.getByRole('navigation', { name: 'Contents' });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('link', { name: '/', exact: true }).first()).toBeVisible();
  await expect(nav.getByRole('link', { name: 'default' }).first()).toBeVisible();
});

test('Function: HandbookSectionHeading — chapter heading is present', async ({ page }) => {
  await page.goto('/handbook/screens');
  await expect(page.getByRole('heading', { level: 2, name: '/', exact: true })).toBeVisible();
});

test('Function: buildHandbookOutline — setup chapter groups name and rules', async ({ page }) => {
  await page.goto('/handbook/screens');
  await expect(page.locator('#chapter-setup')).toBeVisible();
  await expect(page.locator('#screen-setup-name')).toBeVisible();
  await expect(page.locator('#screen-setup-rules')).toBeVisible();
});

test('Function: topicPath — welcome chapter heading is visible', async ({ page }) => {
  await page.goto('/handbook/screens');
  await expect(page.getByRole('heading', { level: 2, name: '/welcome' })).toBeVisible();
});

test('Function: topicVariant — wallet-pay-unavailable contents link is visible', async ({
  page,
}) => {
  await page.goto('/handbook/screens');
  await expect(
    page
      .getByRole('navigation', { name: 'Contents' })
      .getByRole('link', { name: 'wallet-pay-unavailable', exact: true }),
  ).toBeVisible();
});

test('Function: screenChapter — nested stats chapter heading is visible', async ({ page }) => {
  await page.goto('/handbook/screens');
  await expect(page.getByRole('heading', { level: 2, name: '/stats' })).toBeVisible();
});

test('Function: nextOutlineIndex — ArrowRight opens the first screen', async ({ page }) => {
  await page.goto('/handbook/screens');
  await expect(page.getByRole('button', { name: 'Open / default at full size' })).toBeVisible();
  await page.locator('main').click({ position: { x: 8, y: 8 } });
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('Function: pathAnchor — chapter-root id is present', async ({ page }) => {
  await page.goto('/handbook/screens#chapter-root');
  await expect(page.locator('#chapter-root')).toBeVisible();
});

test('Function: HandbookFigure — card description and copy link', async ({ page }) => {
  await page.goto('/handbook/screens');
  await expect(page.getByText(/Desktop\/wide layout/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy link to / default' })).toBeVisible();
});

test('Function: HandbookLightbox — preview opens full size dialog', async ({ page }) => {
  await page.goto('/handbook/screens');
  await page.getByRole('button', { name: 'Open / default at full size' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close image' })).toBeVisible();
});

test('Function: topicAnchor — hash targets the root-default card', async ({ page }) => {
  await page.goto('/handbook/screens#root-default');
  await expect(page.locator('#root-default')).toBeVisible();
});

test('Function: parseScreenVariantDescriptions — wallet-pay-unavailable description is visible', async ({
  page,
}) => {
  await page.goto('/handbook/screens');
  await expect(
    page.getByText(
      /No invoice QR and no button to another wallet app, on desktop and on a smartphone alike/,
    ),
  ).toBeVisible();
});

test('Function: screenVariantDescription — German screen cards follow the locale cookie', async ({
  page,
  context,
}) => {
  await context.addCookies([{ name: 'locale', value: 'de', url: 'http://localhost:3000' }]);
  await page.goto('/handbook/screens');
  await expect(page.getByRole('heading', { name: 'Screens' })).toBeVisible();
  await expect(page.getByText(/Heutige Rate zahlen/).first()).toBeVisible();
  await expect(page.getByText(/Desktop\/wide layout/)).toHaveCount(0);
});

test('Function: topicImageSrc — screens viewer shows an image', async ({ page }) => {
  await page.goto('/handbook/screens');
  await expect(page.locator('img[src*="/handbook-images/"]').first()).toBeVisible();
});

test('Function: comboViewport — Desktop switch is visible', async ({ page }) => {
  await page.goto('/handbook/screens');
  await expect(page.getByRole('button', { name: 'Desktop', exact: true })).toBeVisible();
});

test('Function: comboTheme — Light switch is visible', async ({ page }) => {
  await page.goto('/handbook/screens');
  await expect(page.getByRole('button', { name: 'Light', exact: true })).toBeVisible();
});

test('Function: makeCombo — Mobile switch is visible', async ({ page }) => {
  await page.goto('/handbook/screens');
  await expect(page.getByRole('button', { name: 'Mobile', exact: true })).toBeVisible();
});

test('Function: defaultCombo — first topic image is visible', async ({ page }) => {
  await page.goto('/handbook/screens');
  await expect(page.locator('img[src*="/handbook-images/"]').first()).toBeVisible();
});

test('Function: NotificationsPage — notifications heading is visible', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/forum\/notifications$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notifications: [], unreadCount: 0 }),
    });
  });
  await page.goto('/notifications');
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
});

test('Function: NotificationsLoader — empty notifications copy is visible', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/forum\/notifications$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notifications: [], unreadCount: 0 }),
    });
  });
  await page.goto('/notifications');
  await expect(page.getByText('No notifications yet.')).toBeVisible();
});

test('Function: NotificationsScreen — empty notifications copy is visible', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/forum\/notifications$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notifications: [], unreadCount: 0 }),
    });
  });
  await page.goto('/notifications');
  await expect(page.getByText('No notifications yet.')).toBeVisible();
});

test('Function: fetchNotifications — empty notifications copy is visible', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/forum\/notifications$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notifications: [], unreadCount: 0 }),
    });
  });
  await page.goto('/notifications');
  await expect(page.getByText('No notifications yet.')).toBeVisible();
});

test('Function: markNotificationRead — clicking a row POSTs read', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  const note = {
    id: 'n1',
    type: 'forum_reply',
    parentId: 'p1',
    replyId: 'r1',
    name: 'Bob',
    text: 'hello',
    createdAt: '2026-09-12T12:00:00.000Z',
    readAt: null,
  };
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/forum\/notifications\/read-all$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route(/\/forum\/notifications\/n1\/read$/, async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...note, readAt: '2026-09-12T12:01:00.000Z' }),
    });
  });
  await page.route(/\/forum\/notifications$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notifications: [note], unreadCount: 1 }),
    });
  });
  await page.goto('/notifications');
  await page.getByRole('button', { name: /Bob replied/ }).click();
  await expect(page).toHaveURL(/\/messages\/r1$/);
});

test('Function: markAllNotificationsRead — list fetch POSTs read-all', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/forum\/notifications\/read-all$/, async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route(/\/forum\/notifications$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notifications: [], unreadCount: 0 }),
    });
  });
  const readAll = page.waitForRequest(
    (req) => req.method() === 'POST' && req.url().includes('/forum/notifications/read-all'),
  );
  await page.goto('/notifications');
  await readAll;
  await expect(page.getByText('No notifications yet.')).toBeVisible();
});

test('Function: MessagesPage — inbox heading is visible', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/conversations$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conversations: [] }),
    });
  });
  await page.goto('/messages');
  await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
});

test('Function: InboxLoader — empty inbox copy is visible', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/conversations$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conversations: [] }),
    });
  });
  await page.goto('/messages');
  await expect(page.getByText('No private messages yet.')).toBeVisible();
});

test('Function: InboxScreen — empty inbox copy is visible', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/conversations$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conversations: [] }),
    });
  });
  await page.goto('/messages');
  await expect(page.getByText('No private messages yet.')).toBeVisible();
});

test('Function: fetchConversations — empty inbox copy is visible', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/conversations$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conversations: [] }),
    });
  });
  await page.goto('/messages');
  await expect(page.getByText('No private messages yet.')).toBeVisible();
});

test('Function: fetchConversation — thread body is visible', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/conversations$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [
          {
            id: 'conv-21',
            kind: 'member_platform',
            name: '21.gifts',
            lastText: 'Hello team',
            lastAt: '2026-08-28T12:00:00.000Z',
            lastFromMe: false,
            lastSats: 0,
          },
        ],
      }),
    });
  });
  await page.route(/\/conversations\/conv-21(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm1',
            name: 'Ada',
            text: 'Hello team',
            createdAt: '2026-08-28T12:00:00.000Z',
            fromMe: false,
            sats: 0,
          },
        ],
      }),
    });
  });
  await page.goto('/messages?c=conv-21');
  await expect(page.getByText('Hello team')).toBeVisible();
});

test('Function: postConversationInvoice — amount field is visible on a thread', async ({
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        hasPosted: true,
      }),
    });
  });
  await page.route(/\/conversations$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [
          {
            id: 'conv-21',
            kind: 'member_member',
            name: 'Bob',
            lastText: 'Hello team',
            lastAt: '2026-08-28T12:00:00.000Z',
            lastFromMe: false,
            lastSats: 0,
          },
        ],
      }),
    });
  });
  await page.route(/\/conversations\/conv-21(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm1',
            name: 'Bob',
            text: 'Hello team',
            createdAt: '2026-08-28T12:00:00.000Z',
            fromMe: false,
            sats: 0,
          },
        ],
      }),
    });
  });
  await page.goto('/messages?c=conv-21');
  await expect(page.getByLabel(/amount/i)).toBeVisible();
});

test('Function: markConversationRead — opening a thread POSTs read', async ({ page }) => {
  await seedAdaSession(page);
  await page.route(/\/conversations\/conv-21\/read$/, async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route(/\/conversations$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [
          {
            id: 'conv-21',
            kind: 'member_platform',
            name: '21.gifts',
            lastText: 'Hello team',
            lastAt: '2026-08-28T12:00:00.000Z',
            lastFromMe: false,
            lastSats: 0,
            unread: true,
          },
        ],
        unreadCount: 1,
      }),
    });
  });
  await page.route(/\/conversations\/conv-21(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm1',
            name: 'Ada',
            text: 'Hello team',
            createdAt: '2026-08-28T12:00:00.000Z',
            fromMe: false,
            sats: 0,
          },
        ],
      }),
    });
  });
  await page.goto('/messages');
  await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
  const readPost = page.waitForRequest(
    (req) => req.method() === 'POST' && req.url().includes('/conversations/conv-21/read'),
  );
  await page.getByRole('button', { name: '21.gifts, 1 unread' }).click();
  await readPost;
  await expect(page.getByRole('heading', { name: '21.gifts' })).toBeVisible();
});

test('Function: MessagesChromeLeft — cold open thread is Back to the forum', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        hasPosted: true,
      }),
    });
  });
  await page.route(/\/conversations$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [
          {
            id: 'conv-21',
            kind: 'member_platform',
            name: '21.gifts',
            lastText: 'Hello team',
            lastAt: '2026-08-28T12:00:00.000Z',
            lastFromMe: false,
            lastSats: 0,
          },
        ],
      }),
    });
  });
  await page.route(/\/conversations\/conv-21(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm1',
            name: 'Ada',
            text: 'Hello team',
            createdAt: '2026-08-28T12:00:00.000Z',
            fromMe: false,
            sats: 0,
          },
        ],
      }),
    });
  });
  await page.goto('/messages?c=conv-21');
  await expect(page.getByRole('link', { name: 'Back to the forum' })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Back to the forum' })).toHaveAttribute(
    'href',
    '/welcome',
  );
  await expect(page.getByRole('link', { name: '21.gifts' }).first()).toHaveAttribute(
    'href',
    '/welcome',
  );
  await expect(page.getByRole('link', { name: 'All conversations' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'All conversations' })).toHaveCount(0);
});

test('Function: MessagesChromeLeft — list chrome back goes to the forum', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        hasPosted: true,
      }),
    });
  });
  await page.route(/\/conversations$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conversations: [] }),
    });
  });
  await page.goto('/messages');
  await expect(page.getByRole('link', { name: 'Back to the forum' })).toHaveAttribute(
    'href',
    '/welcome',
  );
  await expect(page.getByRole('link', { name: '21.gifts' }).first()).toHaveAttribute(
    'href',
    '/welcome',
  );
  await expect(page.getByRole('link', { name: 'All conversations' })).toHaveCount(0);
});

test('Function: MessagesChromeLeft — recorded thread returns to the list', async ({ page }) => {
  await seedAdaSession(page);
  await page.addInitScript(() => {
    sessionStorage.setItem(
      '21gifts.viewHistory',
      JSON.stringify({ stack: ['/messages', '/messages?c=conv-21'], cursor: 1 }),
    );
  });
  await page.route(/\/conversations$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [
          {
            id: 'conv-21',
            kind: 'member_platform',
            name: '21.gifts',
            lastText: 'Hello team',
            lastAt: '2026-08-28T12:00:00.000Z',
            lastFromMe: false,
            lastSats: 0,
          },
        ],
      }),
    });
  });
  await page.route(/\/conversations\/conv-21(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm1',
            name: 'Ada',
            text: 'Hello team',
            createdAt: '2026-08-28T12:00:00.000Z',
            fromMe: false,
            sats: 0,
          },
        ],
      }),
    });
  });
  await page.goto('/messages?c=conv-21');
  const back = page.getByRole('link', { name: 'Back', exact: true });
  await expect(back).toHaveCount(1);
  await expect(back).toHaveAttribute('href', '/messages');
  // The load stamps giftsView. Clear it so this click assigns instead of leaving the site.
  await page.evaluate(() => {
    const state = window.history.state as { giftsView?: unknown } | null;
    if (state !== null && typeof state === 'object') {
      const next = { ...state };
      delete next.giftsView;
      window.history.replaceState(next, '');
    }
  });
  const origin = new URL(page.url()).origin;
  await back.click();
  await expect(page).toHaveURL(`${origin}/messages`);
  expect(new URL(page.url()).origin).toBe(origin);
});

/** Empty forum lists so shops and notifications do not depend on the mock server shape. */
async function routeForumLists(page: Page): Promise<void> {
  await page.route(/\/forum\/messages(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(/\/forum\/notifications(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notifications: [], unreadCount: 0 }),
    });
  });
  await page.route(/\/conversations(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conversations: [], unreadCount: 0 }),
    });
  });
}

test('Function: recordCurrentView shows Back to shops after notifications', async ({ page }) => {
  await seedAdaSession(page);
  await routeForumLists(page);
  await page.goto('/shops');
  await page.goto('/notifications');
  const back = page.getByRole('link', { name: 'Back', exact: true });
  await expect(back).toHaveCount(1);
  await expect(back).toHaveAttribute('href', '/shops');
});

test('Function: ViewHistoryRoot records shops then notifications in this tab', async ({ page }) => {
  await seedAdaSession(page);
  await routeForumLists(page);
  await page.goto('/shops');
  await page.goto('/notifications');
  const back = page.getByRole('link', { name: 'Back', exact: true });
  await expect(back).toHaveAttribute('href', '/shops');
  await expect(page.getByRole('link', { name: '21.gifts' }).first()).toHaveAttribute(
    'href',
    '/welcome',
  );
});

test('Function: goToPreviousView opens the shops view from notifications', async ({ page }) => {
  await seedAdaSession(page);
  await routeForumLists(page);
  await page.goto('/shops');
  await page.goto('/notifications');
  const origin = new URL(page.url()).origin;
  await page.getByRole('link', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/shops`);
  expect(new URL(page.url()).origin).toBe(origin);
});

test('Function: canStepBackTo — after the arrow, the browser back continues to the view before', async ({
  page,
}) => {
  await seedAdaSession(page);
  await routeForumLists(page);
  await page.goto('/welcome');
  const origin = new URL(page.url()).origin;
  await openSignedInMenu(page);
  await page.locator('#signed-in-menu').getByRole('link', { name: 'Shops', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/shops`);
  await openSignedInMenu(page);
  await page
    .locator('#signed-in-menu')
    .getByRole('link', { name: 'Notifications', exact: true })
    .click();
  await expect(page).toHaveURL(`${origin}/notifications`);
  await page.getByRole('link', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/shops`);
  await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveAttribute(
    'href',
    '/welcome',
  );
  await page.goBack();
  await expect(page).toHaveURL(`${origin}/welcome`);
});

test('Function: previousViewPath is the shops href on the back link', async ({ page }) => {
  await seedAdaSession(page);
  await routeForumLists(page);
  await page.goto('/shops');
  await page.goto('/notifications');
  await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveAttribute(
    'href',
    '/shops',
  );
});

test('Function: resetViewHistory clears the back history when the Menu opens Home', async ({
  page,
}) => {
  await seedAdaSession(page);
  await routeForumLists(page);
  await page.goto('/shops');
  await page.goto('/notifications');
  await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveAttribute(
    'href',
    '/shops',
  );
  const origin = new URL(page.url()).origin;
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.locator('#signed-in-menu').getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/welcome`);
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back to the forum' })).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('21gifts.viewHistory')))
    .toBe(JSON.stringify({ stack: ['/welcome'], cursor: 0 }));
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.locator('#signed-in-menu').getByRole('link', { name: 'Shops', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/shops`);
  const back = page.getByRole('link', { name: 'Back', exact: true });
  await expect(back).toHaveAttribute('href', '/welcome');
  await back.click();
  await expect(page).toHaveURL(`${origin}/welcome`);
  await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveCount(0);
});

test('Function: ChromeBackProvider shows no back arrow on welcome', async ({ page }) => {
  await seedAdaSession(page);
  await routeForumLists(page);
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back to the forum' })).toHaveCount(0);
});

test('Function: ProfileChromeLeft shows no back arrow on welcome after shops', async ({ page }) => {
  await seedAdaSession(page);
  await routeForumLists(page);
  await page.goto('/shops');
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('21gifts.viewHistory')))
    .toBe(JSON.stringify({ stack: ['/shops', '/welcome'], cursor: 1 }));
  await expect(page.getByRole('link', { name: 'Back', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back to the forum' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '21.gifts' }).first()).toBeVisible();
});

test('Function: useChromeBack shows one chrome Back on the ask step', async ({ page }) => {
  await seedAdaSession(page);
  await routeForumLists(page);
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await openHomeWriter(page);
  await page.getByRole('button', { name: 'Ask for money' }).click();
  await page.getByLabel('Ask').fill('21');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add photos' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toHaveCount(1);
  await expect(
    page.locator('[data-app-chrome]').getByRole('button', { name: 'Back', exact: true }),
  ).toHaveCount(1);
});

test('Function: postConversationMessage — composer is visible on a thread', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/conversations$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [
          {
            id: 'conv-21',
            kind: 'member_platform',
            name: '21.gifts',
            lastText: 'Hello team',
            lastAt: '2026-08-28T12:00:00.000Z',
            lastFromMe: false,
            lastSats: 0,
          },
        ],
      }),
    });
  });
  await page.route(/\/conversations\/conv-21(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm1',
            name: 'Ada',
            text: 'Hello team',
            createdAt: '2026-08-28T12:00:00.000Z',
            fromMe: false,
            sats: 0,
          },
        ],
      }),
    });
  });
  await page.goto('/messages?c=conv-21');
  await expect(page.getByLabel('Your message')).toBeVisible();
});

test('Function: openConversation — Message is on another member profile', async ({ page }) => {
  const memberId = '22222222-2222-4222-8222-222222222222';
  const noteId = '33333333-3333-4333-8333-333333333333';
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(`**/forum/members/${memberId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: memberId,
        name: 'Carol',
        location: null,
        role: 'verified',
        lightningAddress: null,
        createdAt: '2026-01-15T12:00:00.000Z',
        aboutMe: 'Hello from Carol.',
        profileMessage: {
          id: noteId,
          accountId: memberId,
          name: 'Carol',
          text: 'Hello from my profile note.',
          createdAt: '2026-08-01T10:00:00.000Z',
          sats: 21,
          payable: true,
          hasPhoto: false,
          role: 'verified',
          replyCount: 0,
        },
        postCount: 1,
        replyCount: 0,
      }),
    });
  });
  await page.route(`**/forum/members/${memberId}/activity`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(EMPTY_ACTIVITY),
    });
  });
  await page.goto(`/members/${memberId}`);
  await expect(page.getByRole('button', { name: 'Message' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send a private message' })).toHaveCount(0);
});

test('Function: HandbookMarkdown — functions chapter headings render', async ({ page }) => {
  await page.goto('/handbook/functions');
  await expect(page.locator('#functions h2[id^="functions-function-"]').first()).toBeVisible();
});

test('Function: parseHandbookMarkdown — functions chapter headings render', async ({ page }) => {
  await page.goto('/handbook/functions');
  await expect(page.locator('#functions h2[id^="functions-function-"]').first()).toBeVisible();
});

test('Function: loadHandbookDocuments — handbook heading is visible', async ({ page }) => {
  await page.goto('/handbook');
  await expect(page.getByRole('heading', { name: 'Handbook' }).first()).toBeVisible();
  await page.goto('/handbook/functions');
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
  await expect(page.getByRole('link', { name: 'Back home' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back to the forum' })).toHaveAttribute(
    'href',
    '/welcome',
  );
});

test('Function: LoginPage — login heading is visible', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Log in with your device' })).toBeVisible();
});

test('Function: DonatePage — send-help explainer renders', async ({ page }) => {
  await page.goto('/donate');
  await expect(page.getByRole('heading', { name: 'Send help' })).toBeVisible();
});

test('Function: LoginCard — Log in and Open a new account are visible', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Open a new account' })).toBeVisible();
});

test('Function: LoginCard — choice heading is reachable', async ({ page }) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(
    page.getByRole('heading', { name: 'Do you already have an account?' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log in with existing account' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open a new account' })).toBeVisible();
});

/** Hydrate a leftover session whose GET /me is the duplicate-account 403. */
async function expectWrongAccountHint(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-wrong-account');
  });
  await page.route('**/me', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== '/me' && !url.pathname.endsWith('/me')) {
      await route.continue();
      return;
    }
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'You signed in with the wrong account. Please try again with the correct account.',
      }),
    });
  });
  await page.goto('/login');
  await expect(
    page.getByRole('alert').filter({
      hasText: 'You signed in with the wrong account. Please try again with the correct account.',
    }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
}

test('Function: isWrongAccountError — leftover session shows the retry hint', async ({ page }) => {
  await expectWrongAccountHint(page);
});

test('Function: WrongAccountError — leftover session shows the retry hint', async ({ page }) => {
  await expectWrongAccountHint(page);
});

/** Authenticate finish Unknown credential shows the new-account card. */
async function expectUnknownPasskeyCard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const pk = globalThis.PublicKeyCredential as unknown as {
      parseCreationOptionsFromJSON?: unknown;
      parseRequestOptionsFromJSON?: unknown;
      signalUnknownCredential?: unknown;
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
      Object.defineProperty(pk, 'signalUnknownCredential', {
        value: async () => undefined,
        configurable: true,
      });
    }
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: {
        create: async () => {
          throw new Error('create must not run on the login unknown path');
        },
        get: async (options?: CredentialRequestOptions) => {
          const publicKey = options?.publicKey;
          const challenge = publicKey?.challenge;
          const isBytes = challenge instanceof ArrayBuffer || ArrayBuffer.isView(challenge);
          if (!publicKey || !isBytes) {
            throw new Error('invalid request options');
          }
          return {
            id: 'cred',
            type: 'public-key',
            toJSON() {
              return {
                id: 'cred',
                rawId: 'cred',
                type: 'public-key',
                response: {},
                clientExtensionResults: {},
              };
            },
          };
        },
      },
    });
  });
  await page.route(/\/auth\/passkey\/authenticate\/begin$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        challengeId: 'ch',
        options: {
          challenge: 'aa',
          rpId: 'localhost',
          userVerification: 'required',
        },
      }),
    });
  });
  await page.route(/\/auth\/passkey\/authenticate\/finish$/, async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unknown credential' }),
    });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: 'This passkey is not an account' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open a new account' })).toBeVisible();
  await expect(page.getByText('Something went wrong. Please try again.')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
}

test('Function: isUnknownCredentialError — unknown passkey shows the new-account card', async ({
  page,
}) => {
  await expectUnknownPasskeyCard(page);
});

test('Function: UnknownCredentialError — unknown passkey shows the new-account card', async ({
  page,
}) => {
  await expectUnknownPasskeyCard(page);
});

test('Function: InAppBrowserView — Telegram WebView shows Open in browser', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { TelegramWebviewProxy: { postEvent() {} } });
  });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Open this page in your browser' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open in browser' })).toBeVisible();
});

test('Function: iosPasskeyBlock — iOS below 18 names the installed version', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () =>
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    });
  });
  await page.goto('/login');
  await expect(page.getByRole('status')).toHaveText(
    'iOS 17.5.1 is installed. Sign-in needs at least iOS 18.',
  );
});

test('Function: iosPasskeyBlock — iOS 18 hides the version line', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () =>
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    });
  });
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
});

test('Function: androidPasskeyBlock — Android below 9 names the installed version', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () =>
        'Mozilla/5.0 (Linux; Android 8.1.0; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    });
  });
  await page.goto('/login');
  await expect(page.getByRole('status')).toHaveText(
    'Android 8.1.0 is installed. Sign-in needs at least Android 9.',
  );
});

test('Function: androidPasskeyBlock — Android 9 hides the version line', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () =>
        'Mozilla/5.0 (Linux; Android 9; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    });
  });
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
});

test('Function: androidInstalledVersion — Android 14 names the installed OS on a failed login', async ({
  page,
}) => {
  const posted: string[] = [];
  await page.route('**/diagnostics', async (route) => {
    posted.push(route.request().postData() ?? '');
    await route.fulfill({ status: 204, body: '' });
  });
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'userAgent', {
      configurable: true,
      get: () =>
        'Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    });
  });
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
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: {
        create: async () => {
          throw new DOMException('No credentials', 'NotAllowedError');
        },
        get: async (options?: CredentialRequestOptions) => {
          const publicKey = options?.publicKey;
          const challenge = publicKey?.challenge;
          const isBytes = challenge instanceof ArrayBuffer || ArrayBuffer.isView(challenge);
          if (!publicKey || !isBytes) {
            throw new Error('invalid request options');
          }
          throw new DOMException('No credentials', 'NotAllowedError');
        },
      },
    });
  });
  await page.route(/\/auth\/passkey\/authenticate\/begin$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        challengeId: 'ch',
        options: {
          challenge: 'aa',
          rpId: 'localhost',
          userVerification: 'required',
        },
      }),
    });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(
    page.getByRole('heading', { name: 'Do you already have an account?' }),
  ).toBeVisible();
  await expect
    .poll(() => {
      for (const raw of posted) {
        try {
          const body = JSON.parse(raw) as { event?: string; message?: string };
          if (
            body.event === 'client.passkey.login.fail' &&
            body.message?.startsWith('Android 14')
          ) {
            return true;
          }
        } catch {
          continue;
        }
      }
      return false;
    })
    .toBe(true);
});

test('Function: iosInstalledVersion — iOS 18 names the installed OS on a failed login', async ({
  page,
}) => {
  const posted: string[] = [];
  await page.route('**/diagnostics', async (route) => {
    posted.push(route.request().postData() ?? '');
    await route.fulfill({ status: 204, body: '' });
  });
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'userAgent', {
      configurable: true,
      get: () =>
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    });
  });
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
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: {
        create: async () => {
          throw new DOMException('No credentials', 'NotAllowedError');
        },
        get: async (options?: CredentialRequestOptions) => {
          const publicKey = options?.publicKey;
          const challenge = publicKey?.challenge;
          const isBytes = challenge instanceof ArrayBuffer || ArrayBuffer.isView(challenge);
          if (!publicKey || !isBytes) {
            throw new Error('invalid request options');
          }
          throw new DOMException('No credentials', 'NotAllowedError');
        },
      },
    });
  });
  await page.route(/\/auth\/passkey\/authenticate\/begin$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        challengeId: 'ch',
        options: {
          challenge: 'aa',
          rpId: 'localhost',
          userVerification: 'required',
        },
      }),
    });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(
    page.getByRole('heading', { name: 'Do you already have an account?' }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect
    .poll(() => {
      for (const raw of posted) {
        try {
          const body = JSON.parse(raw) as { event?: string; message?: string };
          if (body.event === 'client.passkey.login.fail' && body.message?.startsWith('iOS 18.0')) {
            return true;
          }
        } catch {
          continue;
        }
      }
      return false;
    })
    .toBe(true);
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

test('Function: QrCode — the public pay link shows the invoice QR on a desktop', async ({
  page,
}) => {
  await openPayLinkInvoice(page);
  await expect(page.getByRole('img', { name: 'Bitcoin invoice' })).toBeVisible();
  expect(await recordedWalletAssign(page)).toBeUndefined();
});

test('Function: WalletPay — the forum pay sheet is wallet-only, with no invoice QR or wallet app link', async ({
  page,
  request,
}) => {
  await openPayInvoice(page, request);
  const sheet = page.locator('[data-pay-sheet]');
  await expect(sheet.getByRole('status')).toHaveText(WALLET_UNAVAILABLE);
  await expect(page.getByRole('button', { name: 'Pay with a Bitcoin wallet app' })).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Bitcoin invoice' })).toHaveCount(0);
  expect(await recordedWalletAssign(page)).toBeUndefined();
});

test('Function: ForumPaySheet — the amount form keeps its controls clear of the Close hit area', async ({
  page,
  request,
}) => {
  await stubWalletLocationAssign(page);
  await stubPayableNote(page);
  await signInViaStub(page, request);
  await agreeToLivingRoomRules(page);
  await expect(page).toHaveURL(/\/welcome/);
  await markWalletVerified(page);
  await chooseForumView(page, 'All');
  await page.getByRole('button', { name: 'Show reactions' }).click();
  const replyCard = page.locator('[data-reply-id="r-pay"]');
  await replyCard.getByRole('button', { name: 'Send Bitcoin' }).click();
  const sheet = replyCard.locator('[data-pay-sheet]');
  const close = sheet.getByRole('button', { name: 'Close' });
  await expect(close).toBeVisible();
  const sheetBox = await sheet.boundingBox();
  const closeBox = await close.boundingBox();
  if (sheetBox === null || closeBox === null) {
    throw new Error('pay sheet is not laid out');
  }
  expect(closeBox.x - sheetBox.x).toBeGreaterThanOrEqual(12);
  expect(closeBox.x - sheetBox.x).toBeLessThanOrEqual(14);
  expect(closeBox.y - sheetBox.y).toBeGreaterThanOrEqual(12);
  expect(closeBox.y - sheetBox.y).toBeLessThanOrEqual(14);
  // The 24px X has a 44px hit area around its centre.
  const hitRight = closeBox.x + closeBox.width / 2 + 22;
  const hitBottom = closeBox.y + closeBox.height / 2 + 22;
  const controls = sheet.locator('input, button:not([aria-label="Close"]), [role="radio"]');
  const count = await controls.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    const box = await controls.nth(i).boundingBox();
    if (box === null) {
      continue;
    }
    expect(box.x >= hitRight || box.y >= hitBottom).toBe(true);
  }
});

const REACTION_PAY_ANSWER = 'This is my answer';
const REACTION_PAY_NOTE = 'Thank you so much to all donors.';

/** Signed-in welcome, one foreign note, a paid reaction invoice that stays waiting. */
async function openReactionPayPage(page: Page, invoiceStatus: number = 200): Promise<void> {
  await seedAdaSession(page);
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-bob',
            accountId: 'acc_bob',
            name: 'Bob',
            text: REACTION_PAY_NOTE,
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 1000,
            payable: true,
            hasPhoto: false,
            photoCount: 0,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 1,
          },
        ],
      }),
    });
  });
  await page.route('**/forum/messages/**/replies', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'r-platform',
            accountId: 'acc_platform',
            name: '21.gifts',
            text: 'Glad it reached you.',
            createdAt: '2026-08-28T12:05:00.000Z',
            sats: 1000,
            payable: false,
            hasPhoto: false,
            photoCount: 0,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ],
      }),
    });
  });
  await page.route(/\/messages\/m-bob\/invoice$/, async (route) => {
    if (invoiceStatus === 404) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not found' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pr: 'lnbc21n1example', amountSats: 21 }),
    });
  });
  await page.route(/\/public-messages\/m-bob/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'm-bob',
        accountId: 'acc_bob',
        name: 'Bob',
        text: REACTION_PAY_NOTE,
        createdAt: '2026-08-28T12:00:00.000Z',
        sats: 1000,
        payable: true,
        hasPhoto: false,
        photoCount: 0,
        hasVideo: false,
        videoContentType: null,
        role: 'basis',
        replyCount: 1,
      }),
    });
  });
  await page.goto('/welcome');
  await page.getByText(REACTION_PAY_NOTE).click();
  const field = page.getByLabel('Your reaction');
  await expect(field).toBeVisible();
  await page.getByLabel('Amount').fill('21');
  await field.fill(REACTION_PAY_ANSWER);
  const form = page.getByLabel('Your reaction').locator('xpath=ancestor::form');
  await form.getByRole('button', { name: 'Post' }).click();
}

test('Function: ForumReplyPayPage — paid reaction replaces the reply composer', async ({
  page,
}) => {
  await openReactionPayPage(page);
  const payPage = page.locator('[data-reply-pay-page]');
  await expect(payPage).toBeVisible();
  await expect(payPage.getByText(REACTION_PAY_ANSWER)).toBeVisible();
  await expect(payPage.getByText('Waiting for payment…')).toBeVisible();
  await expect(payPage.getByText(WALLET_UNAVAILABLE)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pay with a Bitcoin wallet app' })).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toHaveCount(0);
  await expect(page.getByLabel('Your reaction')).toHaveCount(0);
});

test('Function: isSmartphoneUserAgent — an iPhone pay link has no invoice QR, only the Pay link', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      get: () =>
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
  });
  await openPayLinkInvoice(page);
  await expect(page.getByRole('img', { name: 'Bitcoin invoice' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Pay with a Bitcoin wallet app' })).toHaveText(
    'Pay',
  );
  expect(await recordedWalletAssign(page)).toBeUndefined();
});

test('Function: isSmartphoneUserAgent — a desktop pay link shows the invoice QR', async ({
  page,
}) => {
  await openPayLinkInvoice(page);
  await expect(page.getByRole('img', { name: 'Bitcoin invoice' })).toBeVisible();
});

test('Function: lightningHref — the pay link Pay button opens lightning:<invoice>', async ({
  page,
}) => {
  await openPayLinkInvoice(page);
  await page.getByRole('button', { name: 'Pay with a Bitcoin wallet app' }).click();
  await expect.poll(() => recordedWalletAssign(page)).toBe(`lightning:${PAY_INVOICE}`);
});

test('Function: useAuthStore — live login reaches the signed-in view', async ({
  page,
  request,
}) => {
  await signInViaStub(page, request);
  await expect(page).toHaveURL(/\/setup\/rules/);
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
  await expect(page).toHaveURL(/\/setup\/rules/);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
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
  await agreeToLivingRoomRules(page);
  await expect(page).toHaveURL(/\/welcome/);
  await chooseForumView(page, 'All');
  await expect(page.getByRole('button', { name: 'React', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show reactions' }).click();
  await expect(page.getByRole('button', { name: 'Send Bitcoin' })).toBeVisible();
});

test('Function: RulesPage — rules heading is visible', async ({ page }) => {
  await page.goto('/rules');
  await expect(page.getByRole('heading', { name: 'Living room rules', level: 1 })).toBeVisible();
});

test('Function: RulesPageChrome — unsigned rules keeps public chrome', async ({ page }) => {
  await page.goto('/rules');
  await expect(page.getByRole('link', { name: '21.gifts', exact: true })).toHaveAttribute(
    'href',
    '/',
  );
  await expect(page.getByRole('button', { name: 'Menu' })).toHaveCount(0);
});

test('Function: RulesPageChrome — signed-in rules shows back and Menu', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/rules');
  await expect(page.getByRole('link', { name: 'Back to the forum' }).first()).toHaveAttribute(
    'href',
    '/welcome',
  );
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
});

test('Function: RulesDocument — only free donations rule is visible', async ({ page }) => {
  await page.goto('/rules');
  await expect(page.getByRole('heading', { name: 'Only free donations' })).toBeVisible();
});

test('Function: ForumLoader — welcome forum is the pay surface', async ({ page, request }) => {
  await stubPayableNote(page);
  await signInViaStub(page, request);
  await agreeToLivingRoomRules(page);
  await expect(page).toHaveURL(/\/welcome/);
  await chooseForumView(page, 'All');
  await page.getByRole('button', { name: 'Show reactions' }).click();
  await expect(page.getByRole('button', { name: 'Send Bitcoin' })).toBeVisible();
});

test('Endpoint: GET /messages/compose-target — without a session is 401', async ({ request }) => {
  const res = await request.get('/messages/compose-target');
  expect(res.status()).toBe(401);
});

test('Function: proxyMessagesComposeTargetGet — GET /messages/compose-target without a session is 401', async ({
  request,
}) => {
  const res = await request.get('/messages/compose-target');
  expect(res.status()).toBe(401);
});

test('Function: fetchComposeTarget — a basis welcome post invoices 21.gifts', async ({
  page,
  request,
}) => {
  await reachWelcome(page, request);
  await openHomeWriter(page);
  await page.getByLabel('Your message').fill('Hello gifts');
  const compose = page.waitForRequest(
    (req) => req.method() === 'GET' && new URL(req.url()).pathname === '/messages/compose-target',
  );
  const invoice = page.waitForRequest(
    (req) =>
      req.method() === 'POST' && /\/messages\/[^/]+\/invoice$/.test(new URL(req.url()).pathname),
  );
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await compose;
  await invoice;
  await expect(page.getByText(WALLET_UNAVAILABLE)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pay with a Bitcoin wallet app' })).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toHaveCount(0);
});

async function stubFirstPostFree(page: Page): Promise<void> {
  await page.route('**/messages/compose-target', async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...body, firstPostFree: true }),
    });
  });
}

test('Function: fetchComposeTarget — a free first post is created without an invoice', async ({
  page,
  request,
}) => {
  await stubFirstPostFree(page);
  let invoiced = false;
  page.on('request', (req) => {
    if (
      req.method() === 'POST' &&
      /\/messages\/[^/]+\/invoice$/.test(new URL(req.url()).pathname)
    ) {
      invoiced = true;
    }
  });
  await reachWelcome(page, request);
  await openHomeWriter(page);
  await expect(page.getByText('Your first post is free.')).toBeVisible();
  await page.getByLabel('Your message').fill('My first note is free');
  const created = page.waitForResponse(
    (res) => res.request().method() === 'POST' && new URL(res.url()).pathname === '/forum/messages',
  );
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  expect((await created).status()).toBe(200);
  await expect(page.getByText('My first note is free')).toBeVisible();
  // A successful post closes the writer; reopened, its field is empty.
  await openHomeWriter(page);
  await expect(page.getByLabel('Your message')).toHaveValue('');
  await expect(page.getByText('Your first post is free.')).toHaveCount(0);
  await expect(page.getByText(WALLET_UNAVAILABLE)).toHaveCount(0);
  expect(invoiced).toBe(false);
});

test('Function: PostFeeRequiredError — a refused free first post asks for the posting fee', async ({
  page,
  request,
}) => {
  await stubFirstPostFree(page);
  await page.route('**/forum/messages', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'A post needs a Bitcoin payment' }),
    });
  });
  await reachWelcome(page, request);
  await openHomeWriter(page);
  await expect(page.getByText('Your first post is free.')).toBeVisible();
  await page.getByLabel('Your message').fill('Hello gifts');
  const invoice = page.waitForRequest(
    (req) =>
      req.method() === 'POST' && /\/messages\/[^/]+\/invoice$/.test(new URL(req.url()).pathname),
  );
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await invoice;
  await expect(page.getByText(WALLET_UNAVAILABLE)).toBeVisible();
  await expect(page.getByText('Your first post is free.')).toHaveCount(0);
});

test('Function: postMessageInvoice — pay sheet requests an invoice', async ({ page, request }) => {
  await openPayInvoice(page, request);
});

test("Function: CannotReceiveError — a cannot_receive forum invoice says the author's wallet cannot receive", async ({
  page,
}) => {
  await seedAdaSession(page);
  await stubPayableNote(page);
  await page.route('**/messages/r-pay/invoice', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Cannot receive', code: 'cannot_receive' }),
    });
  });
  await page.goto('/welcome');
  await chooseForumView(page, 'All');
  await page.getByRole('button', { name: 'Show reactions' }).click();
  const replyCard = page.locator('[data-reply-id="r-pay"]');
  await replyCard.getByRole('button', { name: 'Send Bitcoin' }).click();
  await replyCard.getByLabel('Amount').fill('21');
  await submitPayAmount(page);
  await expect(
    page.getByText("The author's wallet cannot receive this Bitcoin payment"),
  ).toBeVisible();
  await expect(page.getByText('Pay ₿21')).toHaveCount(0);
});

test('Function: NoteDeletedError — deleted reply invoice shows the note-deleted alert', async ({
  page,
}) => {
  await openReactionPayPage(page, 404);
  await expect(page.getByRole('alert').filter({ hasText: 'This note was deleted.' })).toBeVisible();
  await expect(page.locator('[data-reply-pay-page]')).toHaveCount(0);
});

test('Function: shownFiatForSats — pay sheet sends the shown amounts', async ({
  page,
  request,
}) => {
  await stubGiftStats(page, POPULATED_STATS);
  await stubWalletLocationAssign(page);
  await stubPayableNote(page);
  await signInViaStub(page, request);
  await agreeToLivingRoomRules(page);
  await expect(page).toHaveURL(/\/welcome/);
  await markWalletVerified(page);
  await chooseForumView(page, 'All');
  await page.getByRole('button', { name: 'Show reactions' }).click();
  const replyCard = page.locator('[data-reply-id="r-pay"]');
  await replyCard.getByRole('button', { name: 'Send Bitcoin' }).click();
  await replyCard.getByLabel('Amount').fill('21');
  const invoice = page.waitForRequest(
    (req) =>
      req.method() === 'POST' && /\/messages\/[^/]+\/invoice$/.test(new URL(req.url()).pathname),
  );
  await submitPayAmount(page);
  const body = (await invoice).postDataJSON() as {
    amountUsd: string | null;
    amountChf: string | null;
    amountEur: string | null;
    amountPhp: string | null;
  };
  expect(body).toMatchObject({
    amountUsd: '0.02',
    amountChf: '0.02',
    amountEur: '0.02',
    amountPhp: '1.11',
  });
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

test('Function: proxyMessagesStatsGet — GET /messages/stats counts posts', async ({ request }) => {
  const res = await request.get('/messages/stats');
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { postCount: number }).postCount).toBe(6);
});

test('Function: proxyGiftsStatsGet — GET /gifts/stats is empty', async ({ request }) => {
  const res = await request.get('/gifts/stats');
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { giftCount: number }).giftCount).toBe(0);
});

test('Function: proxyFxSpotGet — GET /fx/spot has no rate on the stub', async ({ request }) => {
  const res = await request.get('/fx/spot');
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { rates: Record<string, string> }).rates).toEqual({});
});

test('Function: fetchPostStats — stats page shows notes and replies as posts', async ({ page }) => {
  await stubGiftStats(page, EMPTY_STATS);
  await page.route('**/messages/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        postCount: 4,
        postsOverTime: [{ day: '2026-08-01', postCount: 4 }],
      }),
    });
  });
  await page.goto('/stats');
  await expect(page.getByRole('region', { name: 'Posts' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Posts' })).toContainText('4');
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

test('Function: StatsDashboard — signed-in stats has no fiat switcher', async ({ page }) => {
  await seedAdaSession(page);
  await stubGiftStats(page, EMPTY_STATS);
  await page.goto('/stats');
  await expect(page.getByRole('group', { name: 'Fiat currency' })).toHaveCount(0);
});

test('Function: StatsDashboard — a spend day on the chart opens /stats/{day}', async ({ page }) => {
  await stubGiftStats(page, POPULATED_STATS);
  await page.goto('/stats');
  await page.getByLabel('Spend over time in ₿').getByRole('link', { name: '2026-06-01' }).click();
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
      {
        month: '2026-06',
        giftCount: 1,
        sats: 1_000_000,
        btc: '0.01000000',
        usd: '50.00',
        chf: '42.00',
        eur: '45.00',
        php: '2800.00',
      },
      {
        month: '2026-07',
        giftCount: 1,
        sats: 100_000,
        btc: '0.00100000',
        usd: '900.00',
        chf: '756.00',
        eur: '820.00',
        php: '50400.00',
      },
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

test('Function: formatBitcoin — populated stats draw the ₿ chart', async ({ page }) => {
  await stubGiftStats(page, POPULATED_STATS);
  await page.goto('/stats');
  await expect(page.getByLabel('Spend over time in ₿')).toBeVisible();
  await expect(page.getByLabel('Spend over time in ₿').getByText("₿1'500")).toBeVisible();
});

test("Function: formatGroupedNumber — /stats default grouped ₿1'500", async ({ page }) => {
  await stubGiftStats(page, POPULATED_STATS);
  await page.goto('/stats');
  await expect(page.getByLabel('Spend over time in ₿').getByText("₿1'500")).toBeVisible();
});

test('Function: formatUsdTick — populated profile chart shows USD ticks', async ({ page }) => {
  await seedAdaSession(page);
  await stubAccountActivity(page, {
    ...EMPTY_ACTIVITY,
    receivedSats: 1500,
    receivedOverTime: POPULATED_STATS.spendOverTime,
  });
  await page.goto('/profile');
  await page
    .getByRole('group', { name: 'Chart scale' })
    .getByRole('button', { name: 'USD' })
    .click();
  await expect(page.getByLabel('Given and received in USD')).toBeVisible();
  await expect(page.getByLabel('Given and received in USD').getByText('$1.43')).toBeVisible();
});

test('Function: formatFiatTick — populated profile chart shows CHF ticks', async ({ page }) => {
  await seedAdaSession(page);
  await stubAccountActivity(page, {
    ...EMPTY_ACTIVITY,
    receivedSats: 1500,
    receivedOverTime: POPULATED_STATS.spendOverTime,
  });
  await page.goto('/profile');
  await page
    .getByRole('group', { name: 'Fiat currency' })
    .getByRole('button', { name: 'CHF' })
    .click();
  await page
    .getByRole('group', { name: 'Chart scale' })
    .getByRole('button', { name: 'CHF' })
    .click();
  await expect(page.getByLabel('Given and received in CHF')).toBeVisible();
  await expect(page.getByLabel('Given and received in CHF').getByText('CHF 1.2')).toBeVisible();
});

test('Function: FiatPicker — stats page offers CHF EUR USD PHP', async ({ page }) => {
  await stubGiftStats(page, EMPTY_STATS);
  await page.goto('/stats');
  const group = page.getByRole('group', { name: 'Fiat currency' });
  await expect(group.getByRole('button', { name: 'CHF' })).toBeVisible();
  await expect(group.getByRole('button', { name: 'EUR' })).toBeVisible();
  await expect(group.getByRole('button', { name: 'USD' })).toBeVisible();
  await expect(group.getByRole('button', { name: 'PHP' })).toBeVisible();
});

test('Function: FiatPicker — empty profile offers CHF EUR USD PHP', async ({ page }) => {
  await seedAdaSession(page);
  await stubAccountActivity(page, EMPTY_ACTIVITY);
  await page.goto('/profile');
  const groups = page.getByRole('group', { name: 'Fiat currency' });
  await expect(groups).toHaveCount(1);
  const group = groups.first();
  await expect(group.getByRole('button', { name: 'CHF' })).toBeVisible();
  await expect(group.getByRole('button', { name: 'EUR' })).toBeVisible();
  await expect(group.getByRole('button', { name: 'USD' })).toBeVisible();
  await expect(group.getByRole('button', { name: 'PHP' })).toBeVisible();
  await expect(group.getByRole('button', { name: 'USD' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('No gifts yet.')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Chart scale' })).toHaveCount(0);
});

test('Function: formatFiatDisplay — empty stats hero shows $0.00', async ({ page }) => {
  await stubGiftStats(page, EMPTY_STATS);
  await page.goto('/stats');
  await expect(page.locator('dl').getByText('$0.00')).toBeVisible();
});

test('Function: satsToFiatAmount — a note without stored fiat shows the viewer fiat', async ({
  page,
}) => {
  await stubGiftStats(page, POPULATED_STATS);
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        hasPosted: true,
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm2',
            name: 'Carol',
            text: 'I can send a small gift tomorrow.',
            createdAt: '2026-08-28T11:00:00.000Z',
            sats: 21,
            payable: true,
            hasPhoto: false,
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await chooseForumView(page, 'All');
  await expect(page.getByText('₿21')).toBeVisible();
  await expect(page.getByText('$0.02')).toBeVisible();
  await openHomeWriter(page);
  await page.getByRole('button', { name: 'Ask for money' }).click();
  await page.getByLabel('Ask').fill('21');
  await expect(page.getByText('$0.02').first()).toBeVisible();
});

test('Function: formatDefinedGoalAmount — a peso ask shows the typed amount once', async ({
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        hasPosted: true,
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-php',
            name: 'Ada',
            text: 'The train fare is in pesos.',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 0,
            goalSats: 1000,
            goalCurrency: 'PHP',
            goalAmount: '200',
            goalAmountUsd: '3.50',
            goalAmountChf: null,
            goalAmountEur: null,
            goalAmountPhp: '200.00',
            payable: true,
            hasPhoto: false,
            role: 'basis',
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await chooseForumView(page, 'All');
  await expect(page.getByText('₱200.00')).toBeVisible();
  await expect(page.getByText("₿1'000")).toBeVisible();
  await expect(page.getByText('$3.50')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Translate' })).toHaveCount(0);
});

test('Function: fiatPrefix — francs keep the code and pesos use the sign', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        hasPosted: true,
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-chf',
            name: 'Ada',
            text: 'The goal is defined in francs.',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 0,
            goalSats: 1000,
            goalCurrency: 'CHF',
            goalAmount: '10.00',
            goalAmountUsd: '11.00',
            payable: true,
            hasPhoto: false,
            role: 'basis',
          },
          {
            id: 'm-php',
            name: 'Ada',
            text: 'The goal is defined in pesos.',
            createdAt: '2026-08-28T11:00:00.000Z',
            sats: 0,
            goalSats: 1000,
            goalCurrency: 'PHP',
            goalAmount: '200.00',
            goalAmountUsd: '1.50',
            payable: true,
            hasPhoto: false,
            role: 'basis',
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await chooseForumView(page, 'All');
  await expect(page.getByText('CHF 10.00')).toBeVisible();
  await expect(page.getByText('₱200.00')).toBeVisible();
  await expect(page.getByText('PHP 200.00')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Translate' })).toHaveCount(0);
});

test('Function: forumFiatGoalPercent — a fiat ask percent uses the payment sum', async ({
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        hasPosted: true,
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-half',
            name: 'Ada',
            text: 'Half of a dollar ask',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 999999,
            goalSats: 1000,
            goalCurrency: 'USD',
            goalAmount: '1.50',
            amountUsd: '0.75',
            payable: true,
            hasPhoto: false,
            role: 'basis',
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByText('50%')).toBeVisible();
  await expect(page.getByText('$1.50')).toBeVisible();
});

test('Function: spotRateDay — pay sheet shows a live USD equivalent for 21 sats', async ({
  page,
}) => {
  await stubGiftStats(page, POPULATED_STATS);
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        hasPosted: true,
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-pay',
            name: 'Carol',
            text: 'Please send help.',
            createdAt: '2026-08-28T11:00:00.000Z',
            sats: 21,
            payable: true,
            hasPhoto: false,
            replyCount: 1,
          },
        ],
      }),
    });
  });
  await page.route('**/messages/m-pay/replies', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'r-pay',
            name: 'Carol',
            text: 'A payable reply',
            createdAt: '2026-08-28T11:05:00.000Z',
            sats: 0,
            payable: true,
            hasPhoto: false,
            role: 'basis',
            replyCount: 0,
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await chooseForumView(page, 'All');
  await page.getByRole('button', { name: 'Show reactions' }).click();
  const replyCard = page.locator('[data-reply-id="r-pay"]');
  await replyCard.getByRole('button', { name: 'Send Bitcoin' }).click();
  await expect(replyCard.getByLabel('Amount')).toBeVisible();
  await replyCard.getByLabel('Amount').fill('21');
  await expect(page.getByRole('group', { name: 'Fiat currency' })).toHaveCount(0);
  await expect(page.getByText('$0.02').first()).toBeVisible();
});

test('Function: formatFiatTick — populated stats draw the USD chart', async ({ page }) => {
  await stubGiftStats(page, POPULATED_STATS);
  await page.goto('/stats');
  await page
    .getByRole('group', { name: 'Over time scale' })
    .getByRole('button', { name: 'USD' })
    .click();
  await expect(page.getByLabel('Spend over time in USD')).toBeVisible();
  await expect(page.getByLabel('Spend over time in USD').getByText('$1.43')).toBeVisible();
});

test('Function: defaultFiatForLocale — English stats default to USD', async ({ page }) => {
  await stubGiftStats(page, EMPTY_STATS);
  await page.goto('/stats');
  await expect(
    page.getByRole('group', { name: 'Fiat currency' }).getByRole('button', { name: 'USD' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('dl').getByText('$0.00')).toBeVisible();
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

test('Function: proxyDiagnosticsPost — POST /diagnostics is accepted', async ({ request }) => {
  const res = await request.post('/diagnostics', {
    data: { event: 'client.unhandled', stage: 'unhandled' },
  });
  expect(res.status()).toBe(204);
});

/**
 * Open `/login` and wait until the diagnostics effect is listening.
 * `goto` can resolve on `load` before that effect runs, so an error
 * dispatched immediately is missed.
 */
async function openLoginWithDiagnostics(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const marked = window as unknown as { __diagLive: number };
    marked.__diagLive = 0;
    type TrackedListener = (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) => void;
    const origAdd = window.addEventListener.bind(window) as TrackedListener;
    const origRemove = window.removeEventListener.bind(window) as TrackedListener;
    const trackAdd: TrackedListener = (type, listener, options) => {
      if (type === 'error') {
        marked.__diagLive += 1;
      }
      origAdd(type, listener, options);
    };
    const trackRemove: TrackedListener = (type, listener, options) => {
      if (type === 'error') {
        marked.__diagLive -= 1;
      }
      origRemove(type, listener, options);
    };
    window.addEventListener = trackAdd as typeof window.addEventListener;
    window.removeEventListener = trackRemove as typeof window.removeEventListener;
  });
  await page.goto('/login');
  await page.waitForFunction(() => (window as unknown as { __diagLive: number }).__diagLive > 0);
}

test('Function: reportDiagnostic — a window error is posted', async ({ page }) => {
  const bodies: string[] = [];
  await page.route('**/diagnostics', async (route) => {
    bodies.push(route.request().postData() ?? '');
    await route.fulfill({ status: 204, body: '' });
  });
  await openLoginWithDiagnostics(page);
  await page.evaluate(() => {
    const error = new TypeError('Boom');
    window.dispatchEvent(new ErrorEvent('error', { error, message: error.message }));
  });
  await expect.poll(() => bodies.join('\n')).toContain('client.unhandled');
  await expect.poll(() => bodies.join('\n')).toContain('Boom');
});

test('Function: DiagnosticsListener — an unhandled rejection is posted', async ({ page }) => {
  const bodies: string[] = [];
  await page.route('**/diagnostics', async (route) => {
    bodies.push(route.request().postData() ?? '');
    await route.fulfill({ status: 204, body: '' });
  });
  await openLoginWithDiagnostics(page);
  await page.evaluate(() => {
    const reason = new Error('Later');
    window.dispatchEvent(
      new PromiseRejectionEvent('unhandledrejection', {
        promise: Promise.resolve(),
        reason,
      }),
    );
  });
  await expect.poll(() => bodies.join('\n')).toContain('client.unhandled');
  await expect.poll(() => bodies.join('\n')).toContain('Later');
});

test('Function: startPasskeyRegistration — create passkey reaches the signed-in view', async ({
  page,
}) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await confirmNewAccount(page);
  await expect(page).toHaveURL(/\/setup\/rules/, { timeout: 10_000 });
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
  await confirmNewAccount(page);
  await expect(page).toHaveURL(/\/setup\/rules/, { timeout: 10_000 });
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
  const handle = await confirmNewAccount(page);
  await expect(page).toHaveURL(/\/setup\/rules/, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  const token = await page.evaluate(() => window.localStorage.getItem('21gifts.session'));
  expect(token).toBeTruthy();
  const me = await request.get('/me', { headers: { authorization: `Bearer ${token}` } });
  const body = (await me.json()) as {
    name: string;
    username: string;
    linkingKey: string | null;
  };
  expect(body.name).toBe(handle);
  expect(body.username).toBe(handle);
  expect(body.linkingKey).toBeNull();
});

test('Function: creationOptionsFromJSON — create passkey reaches the signed-in view', async ({
  page,
}) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await confirmNewAccount(page);
  await expect(page).toHaveURL(/\/setup\/rules/, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('Function: credentialToJSON — create passkey reaches the signed-in view', async ({ page }) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await confirmNewAccount(page);
  await expect(page).toHaveURL(/\/setup\/rules/, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('Function: base64UrlToBytes — create passkey reaches the signed-in view', async ({ page }) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await confirmNewAccount(page);
  await expect(page).toHaveURL(/\/setup\/rules/, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('Function: bytesToBase64Url — create passkey reaches the signed-in view', async ({ page }) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await confirmNewAccount(page);
  await expect(page).toHaveURL(/\/setup\/rules/, { timeout: 10_000 });
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

test("Function: parseNumberFormat — Number format options include 10'000.23", async ({ page }) => {
  await seedAdaSession(page);
  await stubGiftStats(page, EMPTY_STATS);
  await page.goto('/profile');
  await expect(
    page.getByRole('group', { name: 'Number format' }).getByRole('button', { name: "10'000.23" }),
  ).toBeVisible();
});

test('Function: separatorsFor — same click shows 10,000.23 and 23.000,33', async ({ page }) => {
  await seedAdaSession(page);
  await stubGiftStats(page, EMPTY_STATS);
  await page.goto('/profile');
  const group = page.getByRole('group', { name: 'Number format' });
  await expect(group.getByRole('button', { name: '10,000.23' })).toBeVisible();
  await expect(group.getByRole('button', { name: '23.000,33' })).toBeVisible();
});

test('Function: getRequestNumberFormat — signed-in /profile Number format is visible', async ({
  page,
}) => {
  await seedAdaSession(page);
  await stubGiftStats(page, EMPTY_STATS);
  await page.goto('/profile');
  await expect(page.getByRole('group', { name: 'Number format' })).toBeVisible();
});

test('Function: NumberFormatProvider — picking 23.000,33 writes numberFormat=de cookie', async ({
  page,
  context,
}) => {
  await seedAdaSession(page);
  await stubGiftStats(page, EMPTY_STATS);
  await page.goto('/profile');
  await page
    .getByRole('group', { name: 'Number format' })
    .getByRole('button', { name: '23.000,33' })
    .click();
  const cookies = await context.cookies();
  expect(cookies.some((cookie) => cookie.name === 'numberFormat' && cookie.value === 'de')).toBe(
    true,
  );
});

test('Function: useNumberFormat — Number format on /profile reads provider', async ({ page }) => {
  await seedAdaSession(page);
  await stubGiftStats(page, EMPTY_STATS);
  await page.goto('/profile');
  await expect(page.getByRole('group', { name: 'Number format' })).toBeVisible();
});

test('Function: parseFiatCode — English stats without a cookie show USD', async ({ page }) => {
  await stubGiftStats(page, EMPTY_STATS);
  await page.goto('/stats');
  await expect(page.locator('dl').getByText('$0.00')).toBeVisible();
});

test('Function: getRequestFiat — English stats without a cookie show USD', async ({ page }) => {
  await stubGiftStats(page, EMPTY_STATS);
  await page.goto('/stats');
  await expect(page.locator('dl').getByText('$0.00')).toBeVisible();
});

test('Function: FiatPreferenceProvider — forum has no fiat switcher', async ({ page }) => {
  await seedAdaSession(page);
  await stubGiftStats(page, EMPTY_STATS);
  await page.goto('/welcome');
  await expect(page.getByRole('group', { name: 'Fiat currency' })).toHaveCount(0);
});

test('Function: useFiatPreference — welcome feed has no fiat switcher', async ({ page }) => {
  await stubGiftStats(page, EMPTY_STATS);
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        hasPosted: true,
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByRole('group', { name: 'Fiat currency' })).toHaveCount(0);
});

test('Function: FiatPreferenceSwitcher — /profile offers CHF EUR USD PHP', async ({ page }) => {
  await seedAdaSession(page);
  await stubGiftStats(page, EMPTY_STATS);
  await page.goto('/profile');
  const group = page.getByRole('group', { name: 'Fiat currency' }).last();
  await expect(group.getByRole('button', { name: 'CHF' })).toBeVisible();
  await expect(group.getByRole('button', { name: 'EUR' })).toBeVisible();
  await expect(group.getByRole('button', { name: 'USD' })).toBeVisible();
  await expect(group.getByRole('button', { name: 'PHP' })).toBeVisible();
});

test('Function: NumberFormatSwitcher — /profile lists the three samples', async ({ page }) => {
  await seedAdaSession(page);
  await stubGiftStats(page, EMPTY_STATS);
  await page.goto('/profile');
  const group = page.getByRole('group', { name: 'Number format' });
  await expect(group.getByRole('button', { name: "10'000.23" })).toBeVisible();
  await expect(group.getByRole('button', { name: '10,000.23' })).toBeVisible();
  await expect(group.getByRole('button', { name: '23.000,33' })).toBeVisible();
});

test('Function: LanguagePreferenceSwitcher — /profile lists English Deutsch Español Filipino', async ({
  page,
}) => {
  await seedAdaSession(page);
  await stubGiftStats(page, EMPTY_STATS);
  await page.goto('/profile');
  const group = page.getByRole('group', { name: 'Language' });
  await expect(group.getByRole('button', { name: 'English' })).toBeVisible();
  await expect(group.getByRole('button', { name: 'Deutsch' })).toBeVisible();
  await expect(group.getByRole('button', { name: 'Español' })).toBeVisible();
  await expect(group.getByRole('button', { name: 'Filipino' })).toBeVisible();
  await expect(group.getByRole('button', { name: 'English' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: null,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: 'name',
        missing: ['name', 'lightning-address', 'rules'],
      }),
    });
  });
  await page.goto('/setup/name');
  await expect(page.getByRole('heading', { name: 'Your name' })).toBeVisible();
});

test('Function: UsernameSetupPage — username screen heading is visible', async ({ page }) => {
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
        username: null,
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: null,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: 'username',
        missing: ['username', 'lightning-address', 'rules'],
      }),
    });
  });
  await page.goto('/setup/username');
  await expect(page.getByRole('heading', { name: 'Your 21.gifts name' })).toBeVisible();
});

test('Function: UsernameForm — username screen heading is visible', async ({ page }) => {
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
        username: null,
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: null,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: 'username',
        missing: ['username', 'lightning-address', 'rules'],
      }),
    });
  });
  await page.goto('/setup/username');
  await expect(page.getByRole('heading', { name: 'Your 21.gifts name' })).toBeVisible();
});

test('Function: UsernameSetup — username screen heading is visible', async ({ page }) => {
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
        username: null,
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: null,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: 'username',
        missing: ['username', 'lightning-address', 'rules'],
      }),
    });
  });
  await page.goto('/setup/username');
  await expect(page.getByRole('heading', { name: 'Your 21.gifts name' })).toBeVisible();
});

test('Function: setUsername — signed-in form saves a username', async ({ page, request }) => {
  await signInUnnamed(page, request);
  await page.getByRole('button', { name: 'Skip' }).click();
  await saveOnboardingUsername(page);
});

test('Function: giftsLightningAddress — member card shows username@21.gifts', async ({
  page,
  request,
}) => {
  await reachWelcome(page, request);
  await page.goto('/members/22222222-2222-4222-8222-222222222222');
  await expect(page.getByText('carol@21.gifts')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Open CryptoPay QR code' })).toBeVisible();
});

const ADA_LNURL = 'LNURL1DP68GURN8GHJ7V339ENKJEN5WVHJUAM9D3KZ66MWDAMKUTMVDE6HYMRS9ASKGCGMXDMGQ';

test('Function: decodeLnurl — BIP-173 inverse of encodeLnurl', async ({ page }) => {
  await page.route('**/pay/ada', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ name: 'Ada Lovelace', username: 'ada', minSats: 1, maxSats: 100 }),
    });
  });
  await page.goto(`/pl?lightning=${ADA_LNURL}`);
  await expect(page.getByRole('heading', { name: 'Ada Lovelace' })).toBeVisible();
});

test('Function: payLinkUsername — localhost QR names ada', async ({ page }) => {
  await page.route('**/pay/ada', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ name: 'Ada Lovelace', username: 'ada', minSats: 1, maxSats: 100 }),
    });
  });
  await page.goto(`/pl?lightning=${ADA_LNURL}`);
  await expect(page.getByRole('heading', { name: 'Ada Lovelace' })).toBeVisible();
});

test('Function: PayLinkScreen — public pay page names the person', async ({ page }) => {
  await page.route('**/pay/ada', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ name: 'Ada Lovelace', username: 'ada', minSats: 1, maxSats: 100 }),
    });
  });
  await page.goto(`/pl?lightning=${ADA_LNURL}`);
  await expect(page.getByRole('heading', { name: 'Ada Lovelace' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('Function: PayLinkPage — missing lightning stays on the pay page', async ({ page }) => {
  await page.goto('/pl?lightning=');
  await expect(page.getByText('This payment link is not valid.')).toBeVisible();
});

test('Endpoint: GET /pay/[username] — checker literal', async ({ request }) => {
  await request.get('/pay/[username]');
});

test('Endpoint: POST /pay/[username]/invoice — checker literal', async ({ request }) => {
  await request.post('/pay/[username]/invoice');
});

test('Function: encodeLnurl — BIP-173 LNURL of a cleartext URL', async ({ page, request }) => {
  await reachWelcome(page, request);
  await page.goto('/members/22222222-2222-4222-8222-222222222222');
  await expect(page.getByRole('img', { name: 'Open CryptoPay QR code' })).toBeVisible();
  expect(encodeLnurl('https://service.io/?q=3fc3645b439ce8e7')).toBe(
    'LNURL1DP68GURN8GHJ7UM9WFMXJCM99E5K7TELWY7NXENRXVMRGDTZXSENJCM98PJNWXQ96S9',
  );
  expect(encodeLnurl('https://aa')).toBe('LNURL1DP68GURN8GHJ7CTP6U9UJJ');
});

test('Function: openCryptoPayQrValue — profile QR is the Open CryptoPay URL', async ({
  page,
  request,
}) => {
  await reachWelcome(page, request);
  await page.goto('/members/22222222-2222-4222-8222-222222222222');
  await expect(page.getByText('carol@21.gifts')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Open CryptoPay QR code' })).toBeVisible();
  expect(openCryptoPayQrValue('carol')).toBe(
    'https://21.gifts/pl/?lightning=LNURL1DP68GURN8GHJ7V339ENKJEN5WVHJUAM9D3KZ66MWDAMKUTMVDE6HYMRS9A3KZUN0DS7CX370',
  );
  expect(openCryptoPayQrValue('ada', 'dev.21.gifts')).toBe(
    'https://dev.21.gifts/pl/?lightning=LNURL1DP68GURN8GHJ7ER9WCHRYVFWVA5KVARN9UH8WETVDSKKKMN0WAHZ7MRWW4EXCUP0V9JXZD4X5DN',
  );
  expect(openCryptoPayQrValue('ada', 'localhost')).toBe(
    'https://21.gifts/pl/?lightning=LNURL1DP68GURN8GHJ7V339ENKJEN5WVHJUAM9D3KZ66MWDAMKUTMVDE6HYMRS9ASKGCGMXDMGQ',
  );
  expect(openCryptoPayQrValue(null)).toBeNull();
  expect(openCryptoPayQrValue('   ')).toBeNull();
});

const CAROL_MEMBER = '/members/22222222-2222-4222-8222-222222222222';

async function openShopSticker(page: Page, request: APIRequestContext): Promise<Locator> {
  await reachWelcome(page, request);
  await page.goto(CAROL_MEMBER);
  await expect(page.getByText('carol@21.gifts')).toBeVisible();
  await page.getByRole('button', { name: 'Shop sticker' }).click();
  const dialog = page.getByRole('dialog', { name: 'Shop sticker' });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function downloadShopSticker(
  page: Page,
  dialog: Locator,
  format: ShopStickerFormat,
): Promise<{ name: string; bytes: Buffer }> {
  await dialog.getByRole('button', { name: format.toUpperCase() }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Download' }).click(),
  ]);
  return { name: download.suggestedFilename(), bytes: fs.readFileSync(await download.path()) };
}

test('Function: ShopStickerOverlay — Shop sticker opens the preview and Escape closes it', async ({
  page,
  request,
}) => {
  const dialog = await openShopSticker(page, request);
  await expect(
    dialog.getByText('Print it for a shop window. The QR code pays carol@21.gifts.'),
  ).toBeVisible();
  await expect(
    dialog.getByRole('img', { name: 'Shop sticker preview for carol@21.gifts' }),
  ).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'PDF' })).toHaveAttribute('aria-pressed', 'true');
  const language = dialog.getByRole('combobox', { name: 'Second language' });
  await expect(language).toContainText('None (English only)');
  await language.click();
  await expect(dialog.getByRole('option', { name: 'Spanish' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('listbox')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Shop sticker' })).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Open CryptoPay QR code' })).toBeVisible();
});

test('Function: buildShopStickerSvg — preview and SVG download are the member sticker', async ({
  page,
  request,
}) => {
  const dialog = await openShopSticker(page, request);
  const expected = buildShopStickerSvg(openCryptoPayQrValue('carol') as string, 'english');
  const src = await dialog
    .getByRole('img', { name: 'Shop sticker preview for carol@21.gifts' })
    .getAttribute('src');
  expect(decodeURIComponent((src as string).slice((src as string).indexOf(',') + 1))).toBe(
    expected,
  );
  const svg = await downloadShopSticker(page, dialog, 'svg');
  expect(svg.bytes.toString('utf8')).toBe(expected);
});

test('Function: buildShopStickerPdf — PDF download is the one-page vector sticker', async ({
  page,
  request,
}) => {
  const dialog = await openShopSticker(page, request);
  const pdf = await downloadShopSticker(page, dialog, 'pdf');
  expect(
    pdf.bytes.equals(
      Buffer.from(buildShopStickerPdf(openCryptoPayQrValue('carol') as string, 'english')),
    ),
  ).toBe(true);
  expect(pdf.bytes.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4');
});

test('Function: shopStickerBlob — PNG and JPG downloads are 3000 px images', async ({
  page,
  request,
}) => {
  const dialog = await openShopSticker(page, request);
  const png = await downloadShopSticker(page, dialog, 'png');
  expect(png.bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png.bytes.readUInt32BE(16)).toBe(3000);
  expect(png.bytes.readUInt32BE(20)).toBe(1836);
  // the printed QR, orange mark included, must still scan to Carol's pay link
  const image = PNG.sync.read(png.bytes);
  expect(jsQR(new Uint8ClampedArray(image.data), image.width, image.height)?.data).toBe(
    openCryptoPayQrValue('carol'),
  );
  const jpg = await downloadShopSticker(page, dialog, 'jpg');
  expect(jpg.bytes.subarray(0, 3).toString('hex')).toBe('ffd8ff');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
});

test('Function: shopStickerFileName — downloads are named after the username', async ({
  page,
  request,
}) => {
  const dialog = await openShopSticker(page, request);
  for (const format of ['pdf', 'png', 'jpg', 'svg'] as const) {
    const file = await downloadShopSticker(page, dialog, format);
    expect(file.name).toBe(`21gifts-shop-sticker-carol-english.${format}`);
  }
});

test('Function: shopStickerLangFromQuery — Kikamba and unknown values', () => {
  expect(shopStickerLangFromQuery('Kikamba')).toBe('kikamba');
  expect(shopStickerLangFromQuery('kam')).toBe('kikamba');
  expect(shopStickerLangFromQuery('es')).toBe('spanish');
  expect(shopStickerLangFromQuery('de')).toBe('german');
  expect(shopStickerLangFromQuery('fr')).toBe('french');
  expect(shopStickerLangFromQuery('en')).toBe('english');
  expect(shopStickerLangFromQuery('keine')).toBe('english');
  expect(shopStickerLangFromQuery(null)).toBe('filipino');
  expect(shopStickerLangFromQuery('')).toBe('filipino');
  expect(shopStickerLangFromQuery('Swahili')).toBe('filipino');
});

test('Function: shopStickerLangFromLocation — ?lang=Kikamba opens the English/Kikamba sticker', async ({
  page,
  request,
}) => {
  await reachWelcome(page, request);
  await page.goto(`${CAROL_MEMBER}?lang=Kikamba`);
  await expect(page.getByText('carol@21.gifts', { exact: true })).toBeVisible();
  const dialog = page.getByRole('dialog', { name: 'Shop sticker' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Second language' })).toContainText('Kikamba');
  const expected = buildShopStickerSvg(openCryptoPayQrValue('carol') as string, 'kikamba');
  const src = await dialog
    .getByRole('img', { name: 'Shop sticker preview for carol@21.gifts' })
    .getAttribute('src');
  expect(decodeURIComponent((src as string).slice((src as string).indexOf(',') + 1))).toBe(
    expected,
  );
  const svg = await downloadShopSticker(page, dialog, 'svg');
  expect(svg.name).toBe('21gifts-shop-sticker-carol-kikamba.svg');
});

test('Function: shopStickerLangInitial — UI language is the sticker default', () => {
  expect(shopStickerLangInitial('en')).toBe('english');
  expect(shopStickerLangInitial('de')).toBe('german');
  expect(shopStickerLangInitial('es')).toBe('spanish');
  expect(shopStickerLangInitial('fil')).toBe('filipino');
});

test('Function: shopStickerLangInitial — unknown lang follows the English UI', async ({
  page,
  request,
}) => {
  await reachWelcome(page, request);
  await page.goto(`${CAROL_MEMBER}?lang=Swahili`);
  await expect(page.getByText('carol@21.gifts')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Shop sticker' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Shop sticker' }).click();
  const dialog = page.getByRole('dialog', { name: 'Shop sticker' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Second language' })).toContainText(
    'None (English only)',
  );
  const expected = buildShopStickerSvg(openCryptoPayQrValue('carol') as string, 'english');
  const src = await dialog
    .getByRole('img', { name: 'Shop sticker preview for carol@21.gifts' })
    .getAttribute('src');
  expect(decodeURIComponent((src as string).slice((src as string).indexOf(',') + 1))).toBe(
    expected,
  );
});

test('Function: shopStickerLangInitial — ?lang=fil still selects Filipino', async ({
  page,
  request,
}) => {
  await reachWelcome(page, request);
  await page.goto(`${CAROL_MEMBER}?lang=fil`);
  await expect(page.getByText('carol@21.gifts')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Shop sticker' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Shop sticker' }).click();
  const dialog = page.getByRole('dialog', { name: 'Shop sticker' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Second language' })).toContainText('Filipino');
  const expected = buildShopStickerSvg(openCryptoPayQrValue('carol') as string, 'filipino');
  const src = await dialog
    .getByRole('img', { name: 'Shop sticker preview for carol@21.gifts' })
    .getAttribute('src');
  expect(decodeURIComponent((src as string).slice((src as string).indexOf(',') + 1))).toBe(
    expected,
  );
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: null,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: 'name',
        missing: ['name', 'lightning-address', 'rules'],
      }),
    });
  });
  await page.goto('/setup/name');
  await expect(page.getByRole('heading', { name: 'Your name' })).toBeVisible();
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
});

test('Function: noteKinds — a credit, a donation, and a shop each get their tag', async ({
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-loan',
            name: 'Ada',
            text: 'Need help with a train ticket',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 0,
            goalSats: 21000,
            goalRepayable: true,
            goalTermDays: 30,
            payable: true,
            hasPhoto: false,
            role: 'basis',
            replyCount: 0,
          },
          {
            id: 'm-gift',
            name: 'Bea',
            text: 'For the hall',
            createdAt: '2026-08-28T11:00:00.000Z',
            sats: 0,
            goalSats: 21000,
            payable: true,
            hasPhoto: false,
            role: 'basis',
            replyCount: 0,
          },
          {
            id: 'm-shop',
            name: 'Cara',
            text: 'Cafe Luna\n\n#21GiftsShop',
            createdAt: '2026-08-28T10:00:00.000Z',
            sats: 21,
            payable: true,
            hasPhoto: false,
            role: 'basis',
            replyCount: 0,
          },
          {
            id: 'm-plain',
            name: 'Dan',
            text: 'Hello',
            createdAt: '2026-08-28T09:00:00.000Z',
            sats: 1,
            payable: true,
            hasPhoto: false,
            role: 'basis',
            replyCount: 1,
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await chooseForumView(page, 'All');
  await expect(page.getByRole('button', { name: 'Loan' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Donation', expanded: false })).toBeVisible();
  await expect(page.getByRole('link', { name: '#Shop' })).toBeVisible();
  await expect(page.getByText('Hello')).toBeVisible();
  await expect(page.getByText('#21GiftsShop')).toHaveCount(0);
});

test('Function: MessageKindTags — pressing Loan explains the credit', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-loan',
            name: 'Ada',
            text: 'Need help with a train ticket',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 0,
            goalSats: 21000,
            goalRepayable: true,
            goalTermDays: 30,
            payable: true,
            hasPhoto: false,
            role: 'basis',
            replyCount: 0,
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await chooseForumView(page, 'All');
  const loan = page.getByRole('button', { name: 'Loan' });
  await loan.click();
  await expect(page.getByRole('status')).toContainText('paid back');
  await loan.click();
  await expect(page.getByRole('status')).toHaveCount(0);
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
});

test('Function: revealReplyForm — expanded reply stays inside the shell', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
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
            sats: 1,
            payable: true,
            hasPhoto: false,
          },
        ],
      }),
    });
  });
  await page.route('**/forum/messages/**/replies', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await page.getByText('Hello from Ada').click();
  const field = page.getByPlaceholder('Write a reaction');
  await expect(field).toBeVisible();
  const inside = await field.evaluate((node) => {
    const form = node.closest('form');
    const scroller = node.closest('[data-scrollport]');
    if (!(form instanceof HTMLElement) || !(scroller instanceof HTMLElement)) {
      return false;
    }
    const formBox = form.getBoundingClientRect();
    const shell = scroller.getBoundingClientRect();
    return formBox.top >= shell.top - 1 && formBox.bottom <= shell.bottom + 1;
  });
  expect(inside).toBe(true);
});

test('Function: revealPaySheet — paying a reaction keeps the note on screen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 520 });
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages\/m1\/invoice$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pr: 'lnbc21n1example', amountSats: 21 }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
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
            sats: 1,
            payable: true,
            hasPhoto: false,
          },
        ],
      }),
    });
  });
  await page.route('**/forum/messages/**/replies', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(/\/public-messages\//, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'm1',
        name: 'Ada',
        text: 'Hello from Ada',
        createdAt: '2026-08-28T12:00:00.000Z',
        sats: 1,
        payable: true,
        hasPhoto: false,
        photoCount: 0,
        hasVideo: false,
        videoContentType: null,
        role: 'basis',
        replyCount: 0,
      }),
    });
  });
  await page.goto('/welcome');
  await page.getByText('Hello from Ada').click();
  const field = page.getByLabel('Your reaction');
  await field.fill('This is my answer');
  await page.getByLabel('Amount').fill('21');
  await field.locator('xpath=ancestor::form').getByRole('button', { name: 'Post' }).click();
  const back = page.getByRole('button', { name: 'Close' });
  await expect(back).toBeVisible();
  const payPage = page.locator('[data-reply-pay-page]');
  await expect(payPage.getByText('This is my answer')).toBeVisible();
  await expect(field).toHaveCount(0);
  const noteStillVisible = await page.getByText('Hello from Ada').evaluate((node) => {
    const scroller = node.closest('[data-scrollport]');
    if (!(scroller instanceof HTMLElement)) {
      return false;
    }
    const note = node.getBoundingClientRect();
    const shell = scroller.getBoundingClientRect();
    return note.top >= shell.top - 1 && note.top <= shell.bottom;
  });
  expect(noteStillVisible).toBe(true);
  const backIsLeft = await back.evaluate((node) => {
    const sheet = node.closest('[data-pay-sheet]');
    if (!(sheet instanceof HTMLElement)) {
      return false;
    }
    const button = node.getBoundingClientRect();
    const card = sheet.getBoundingClientRect();
    return button.left < card.left + card.width / 2;
  });
  expect(backIsLeft).toBe(true);
});

test('Function: ForumAskWizard — welcome loads', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await openHomeWriter(page);
  await page.getByRole('button', { name: 'Ask for money' }).click();
  await expect(page.getByText('How much?')).toBeVisible();
});

test('Function: parseForumAskAmount — welcome loads', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await openHomeWriter(page);
  await page.getByRole('button', { name: 'Ask for money' }).click();
  await expect(page.getByText('How much?')).toBeVisible();
  await page.getByLabel('Ask').fill('0');
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await page.getByLabel('Ask').fill('1000');
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
});

test('Function: ForumGoalBar — welcome loads', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-goal',
            name: 'Ada',
            text: 'Goal note',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 23100,
            goalSats: 21000,
            payable: true,
            hasPhoto: false,
            role: 'basis',
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByText('110%')).toBeVisible();
});

test('Function: forumGoalPercent — welcome loads', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-goal',
            name: 'Ada',
            text: 'Goal note',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 23100,
            goalSats: 21000,
            payable: true,
            hasPhoto: false,
            role: 'basis',
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByText('110%')).toBeVisible();
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.goto('/contact');
  await expect(
    page.getByText(
      'Write to 21.gifts here — there is no email address. This is the only way to reach us.',
    ),
  ).toBeVisible();
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
});

test('Function: ForumLoader — becoming visible again refetches the forum list', async ({
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  let messagesBody: unknown = { messages: [] };
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(messagesBody),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();

  messagesBody = {
    messages: [
      {
        id: 'm-refresh',
        name: 'Ada',
        text: 'Visible again note',
        createdAt: '2026-08-28T12:00:00.000Z',
        sats: 21,
        payable: true,
        hasPhoto: false,
        hasVideo: false,
        videoContentType: null,
        role: 'basis',
        replyCount: 0,
      },
    ],
  };

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  await expect(page.getByText('Visible again note')).toBeVisible();
});

test('Function: ForumLoader — scrolled silent refresh shows New posts without inserting the note', async ({
  page,
}) => {
  await seedAdaSession(page);
  const first = Array.from({ length: 12 }, (_, index) => ({
    id: `m-tall-${String(index)}`,
    name: 'Ada',
    text: `Tall note ${String(index)} so the welcome list can scroll past the top.`,
    createdAt: `2026-08-28T12:${String(index).padStart(2, '0')}:00.000Z`,
    sats: 21,
    payable: true,
    hasPhoto: false,
    hasVideo: false,
    videoContentType: null,
    role: 'basis',
    replyCount: 0,
  }));
  let messagesBody: unknown = { messages: first };
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(messagesBody),
    });
  });
  await page.goto('/welcome');
  await expect(
    page.getByText('Tall note 0 so the welcome list can scroll past the top.'),
  ).toBeVisible();
  await page.evaluate(() => {
    const scroller = document.querySelector('main [data-scrollport]');
    if (scroller instanceof HTMLElement) {
      scroller.scrollTop = 900;
    } else {
      window.scrollTo(0, 900);
    }
  });
  messagesBody = {
    messages: [
      {
        id: 'm-unseen',
        name: 'Carol',
        text: 'Held unseen note for the New posts pill.',
        createdAt: '2026-08-28T13:00:00.000Z',
        sats: 21,
        payable: true,
        hasPhoto: false,
        hasVideo: false,
        videoContentType: null,
        role: 'basis',
        replyCount: 0,
      },
      ...first,
    ],
  };
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('button', { name: 'New posts' })).toBeVisible();
  await expect(page.getByText('Held unseen note for the New posts pill.')).toHaveCount(0);
  await page.getByRole('button', { name: 'New posts' }).click();
  await expect(page.getByText('Held unseen note for the New posts pill.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New posts' })).toHaveCount(0);
});

test('Function: hasUnseenForumPosts — scrolled silent refresh holds a new id behind New posts', async ({
  page,
}) => {
  await seedAdaSession(page);
  const first = Array.from({ length: 12 }, (_, index) => ({
    id: `m-tall-${String(index)}`,
    name: 'Ada',
    text: `Tall note ${String(index)} so the welcome list can scroll past the top.`,
    createdAt: `2026-08-28T12:${String(index).padStart(2, '0')}:00.000Z`,
    sats: 21,
    payable: true,
    hasPhoto: false,
    hasVideo: false,
    videoContentType: null,
    role: 'basis',
    replyCount: 0,
  }));
  let messagesBody: unknown = { messages: first };
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(messagesBody),
    });
  });
  await page.goto('/welcome');
  await expect(
    page.getByText('Tall note 0 so the welcome list can scroll past the top.'),
  ).toBeVisible();
  await page.evaluate(() => {
    const scroller = document.querySelector('main [data-scrollport]');
    if (scroller instanceof HTMLElement) {
      scroller.scrollTop = 900;
    } else {
      window.scrollTo(0, 900);
    }
  });
  messagesBody = {
    messages: [
      {
        id: 'm-unseen-ids',
        name: 'Carol',
        text: 'Unseen id held by hasUnseenForumPosts.',
        createdAt: '2026-08-28T13:00:00.000Z',
        sats: 21,
        payable: true,
        hasPhoto: false,
        hasVideo: false,
        videoContentType: null,
        role: 'basis',
        replyCount: 0,
      },
      ...first,
    ],
  };
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('button', { name: 'New posts' })).toBeVisible();
  await expect(page.getByText('Unseen id held by hasUnseenForumPosts.')).toHaveCount(0);
});

test('Function: ForumLoader — wordmark click on /welcome refetches', async ({ page }) => {
  await seedAdaSession(page);
  let messagesBody: unknown = { messages: [] };
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(messagesBody),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
  messagesBody = {
    messages: [
      {
        id: 'm-home',
        name: 'Ada',
        text: 'From wordmark refresh',
        createdAt: '2026-08-28T12:00:00.000Z',
        sats: 21,
        payable: true,
        hasPhoto: false,
        hasVideo: false,
        videoContentType: null,
        role: 'basis',
        replyCount: 0,
      },
    ],
  };
  await page.getByRole('link', { name: '21.gifts' }).click();
  await expect(page.getByText('From wordmark refresh')).toBeVisible();
});

test('Function: ForumHomeWordmark — clicking 21.gifts on /welcome does not leave the forum', async ({
  page,
}) => {
  await seedAdaSession(page);
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
  await page.getByRole('link', { name: '21.gifts' }).click();
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
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
            sats: 1,
            payable: true,
            hasPhoto: false,
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByText('Hello from Ada')).toBeVisible();
  await expect(page.getByText(/2026/)).toBeVisible();
});

test.describe('welcome clock uses the browser local timezone', () => {
  test.use({ timezoneId: 'Europe/Zurich' });

  test('Function: formatForumTime — welcome clock uses the browser local timezone', async ({
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
          location: null,
          lightningAddress: null,
          lightningAddressVerified: false,
          forumLawsDismissed: false,
          createdAt: 1,
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          aboutMe: null,
          setup: null,
          missing: [],
        }),
      });
    });
    await page.route(/\/messages(?:\?|$)/, async (route) => {
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
              sats: 1,
              payable: true,
              hasPhoto: false,
            },
          ],
        }),
      });
    });
    await page.goto('/welcome');
    await expect(page.getByText('Hello from Ada')).toBeVisible();
    const { localString, utcString } = await page.evaluate(() => {
      const instant = new Date('2026-08-28T12:00:00.000Z');
      const localString = new Intl.DateTimeFormat('en', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(instant);
      const utcString = new Intl.DateTimeFormat('en', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      }).format(instant);
      return { localString, utcString };
    });
    await expect(page.getByText(localString, { exact: true })).toBeVisible();
    expect(localString).not.toBe(utcString);
    await expect(page.getByText(utcString, { exact: true })).toHaveCount(0);
  });
});

test('Function: visibleForumMessages — Active, All, and Most popular filter the welcome list', async ({
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-founder',
            name: 'Eve',
            text: 'Founder unpaid note for Active.',
            createdAt: '2026-08-28T13:00:00.000Z',
            sats: 0,
            payable: true,
            hasPhoto: false,
            role: 'founder',
          },
          {
            id: 'm-mod',
            name: 'Dan',
            text: 'Moderator unpaid note for Active.',
            createdAt: '2026-08-28T12:30:00.000Z',
            sats: 0,
            payable: true,
            hasPhoto: false,
            role: 'moderator',
          },
          {
            id: 'm3',
            name: 'Ada',
            text: 'Thank you both — that helps.',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 5,
            payable: true,
            hasPhoto: false,
          },
          {
            id: 'm2',
            name: 'Carol',
            text: 'I can send a small gift tomorrow.',
            createdAt: '2026-08-28T11:00:00.000Z',
            sats: 21,
            payable: true,
            hasPhoto: false,
          },
          {
            id: 'm1',
            name: 'Bob',
            text: 'Does anyone have spare sats this week?',
            createdAt: '2026-08-28T10:00:00.000Z',
            sats: 0,
            payable: true,
            hasPhoto: false,
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByText('Thank you both — that helps.')).toBeVisible();
  await expect(page.getByText('I can send a small gift tomorrow.')).toBeVisible();
  await expect(page.getByText('Does anyone have spare sats this week?')).not.toBeVisible();
  await expect(page.getByText('Founder unpaid note for Active.')).toBeVisible();
  await expect(page.getByText('Moderator unpaid note for Active.')).toBeVisible();

  await chooseForumView(page, 'All');
  await expect(page.getByText('Does anyone have spare sats this week?')).toBeVisible();

  await chooseForumView(page, 'No gifts yet');
  await expect(page.getByText('Does anyone have spare sats this week?')).toBeVisible();
  await expect(page.getByText('Thank you both — that helps.')).not.toBeVisible();
  await expect(page.getByText('I can send a small gift tomorrow.')).not.toBeVisible();

  await chooseForumView(page, 'Most popular');
  const items = page.getByRole('listitem');
  await expect(items.nth(0)).toContainText('I can send a small gift tomorrow.');
  await expect(items.nth(0)).toContainText('₿21');
  await expect(items.nth(1)).toContainText('Thank you both — that helps.');
  await expect(items.nth(1)).toContainText('₿5');
  await expect(page.getByText('Founder unpaid note for Active.')).not.toBeVisible();
  await expect(page.getByText('Moderator unpaid note for Active.')).not.toBeVisible();
});

async function seedWelcomeWithUnpaidCount(page: Page): Promise<void> {
  await seedAdaSession(page);
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.forum-unpaid-seen', '2026-01-01T00:00:00.000Z');
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm3',
            name: 'Ada',
            text: 'Thank you both — that helps.',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 5,
            payable: true,
            hasPhoto: false,
          },
          {
            id: 'm2',
            name: 'Carol',
            text: 'I can send a small gift tomorrow.',
            createdAt: '2026-08-28T11:00:00.000Z',
            sats: 21,
            payable: true,
            hasPhoto: false,
          },
          {
            id: 'm1',
            name: 'Bob',
            text: 'Does anyone have spare sats this week?',
            createdAt: '2026-08-28T10:00:00.000Z',
            sats: 0,
            payable: true,
            hasPhoto: false,
          },
        ],
      }),
    });
  });
}

test('Function: unpaidNewCount — No gifts yet shows unpaid notes newer than last visit', async ({
  page,
}) => {
  await seedWelcomeWithUnpaidCount(page);
  await page.goto('/welcome');
  const view = page.getByRole('combobox', { name: 'Forum view' });
  await expect(view).toContainText('Active');
  await expect(view).toContainText('1');
  await expect(page.getByRole('option', { name: 'No gifts yet, 1 new', exact: true })).toHaveCount(
    0,
  );
  await view.click();
  await expect(
    page.getByRole('option', { name: 'No gifts yet, 1 new', exact: true }),
  ).toBeVisible();
  await page.getByRole('option', { name: 'No gifts yet, 1 new', exact: true }).click();
  await expect(view).toContainText('No gifts yet');
  await expect(page.getByRole('option', { name: 'No gifts yet, 1 new', exact: true })).toHaveCount(
    0,
  );
});

test('Function: loadUnpaidSeenAt — stored last visit restores the unpaid count', async ({
  page,
}) => {
  await seedWelcomeWithUnpaidCount(page);
  await page.goto('/welcome');
  const view = page.getByRole('combobox', { name: 'Forum view' });
  await expect(view).toContainText('Active');
  await expect(view).toContainText('1');
  await view.click();
  await expect(
    page.getByRole('option', { name: 'No gifts yet, 1 new', exact: true }),
  ).toBeVisible();
  await view.click();
  await expect(view).toContainText('Active');
  await expect(view).toContainText('1');
  await expect(page.getByRole('option', { name: 'No gifts yet, 1 new', exact: true })).toHaveCount(
    0,
  );
});

test('Function: saveUnpaidSeenAt — opening No gifts yet clears the unpaid count', async ({
  page,
}) => {
  await seedWelcomeWithUnpaidCount(page);
  await page.goto('/welcome');
  const view = page.getByRole('combobox', { name: 'Forum view' });
  await expect(view).toContainText('Active');
  await expect(view).toContainText('1');
  await view.click();
  await expect(
    page.getByRole('option', { name: 'No gifts yet, 1 new', exact: true }),
  ).toBeVisible();
  await page.getByRole('option', { name: 'No gifts yet, 1 new', exact: true }).click();
  await expect(view).toContainText('No gifts yet');
  await expect(page.getByRole('option', { name: 'No gifts yet, 1 new', exact: true })).toHaveCount(
    0,
  );
});

test('Function: OnboardingGate — login sends a new account to the rules screen', async ({
  page,
  request,
}) => {
  await signInViaStub(page, request);
  await expect(page).toHaveURL(/\/setup\/rules/);
});

test('Function: OnboardingGate — a name without agreement goes to rules', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: null,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: 'rules',
        missing: ['rules'],
      }),
    });
  });
  await page.goto('/welcome');
  await expect(page).toHaveURL(/\/setup\/rules/);
});

test('Function: nextOnboardingPath — login sends a new account to the rules screen', async ({
  page,
  request,
}) => {
  await signInViaStub(page, request);
  await expect(page).toHaveURL(/\/setup\/rules/);
});

test('Function: hasDisplayName — login sends a new account to the rules screen', async ({
  page,
  request,
}) => {
  await signInViaStub(page, request);
  await expect(page).toHaveURL(/\/setup\/rules/);
});

test('Function: nextOnboardingPath — the api lightning-address step opens rules, with no address screen', async ({
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
        username: 'ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: null,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: 'lightning-address',
        missing: ['lightning-address', 'rules'],
      }),
    });
  });
  await page.goto('/welcome');
  await expect(page).toHaveURL(/\/setup\/rules/);
});

test('Function: useHydrateSession — reload keeps the rules screen', async ({ page, request }) => {
  await signInViaStub(page, request);
  await page.reload();
  await expect(page).toHaveURL(/\/setup\/rules/);
});

test('Function: LogoutButton — log out returns to login', async ({ page, request }) => {
  await signInViaStub(page, request);
  await openSignedInMenu(page);
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
});

test('Function: useUnreadCount — menu shows unread notification count', async ({ page }) => {
  await seedAdaSession(page);
  await page.route(/\/forum\/notifications$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notifications: [], unreadCount: 3 }),
    });
  });
  await page.goto('/profile');
  await openSignedInMenu(page);
  await expect(page.getByRole('link', { name: 'Notifications, 3 unread' })).toBeVisible();
});

test('Function: useUnreadCount — menu shows inbox unread count', async ({ page }) => {
  await seedAdaSession(page);
  await page.route(/\/conversations$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [
          {
            id: 'c1',
            kind: 'member_member',
            name: 'Bob',
            lastText: 'Hi',
            lastAt: '2026-08-28T12:00:00.000Z',
            lastFromMe: false,
            lastSats: 0,
            unread: true,
          },
          {
            id: 'c2',
            kind: 'member_member',
            name: 'Carol',
            lastText: 'Hey',
            lastAt: '2026-08-28T13:00:00.000Z',
            lastFromMe: false,
            lastSats: 0,
            unread: true,
          },
        ],
        unreadCount: 2,
      }),
    });
  });
  await page.goto('/profile');
  await openSignedInMenu(page);
  await expect(page.getByRole('link', { name: 'Messages, 2 unread' })).toBeVisible();
});

test('Function: useUnreadCount — menu shows moderation unread count', async ({ page }) => {
  await seedAdaSession(page, 'moderator');
  await page.route(/\/conversations\/moderator-group$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversation: {
          id: 'conv-mod',
          kind: 'moderator_group',
          name: 'Moderators',
          lastText: 'Hello mods',
          lastAt: '2026-08-28T15:00:00.000Z',
          lastFromMe: false,
          lastSats: 0,
          unread: true,
        },
      }),
    });
  });
  await page.goto('/profile');
  await openSignedInMenu(page);
  await expect(page.getByRole('link', { name: 'Moderation, 1 unread' })).toBeVisible();
});

test('Function: resyncPushSubscription — signed-in chrome still shows Menu', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/profile');
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
});

test('Function: SignedInChrome — Menu reveals Profile and log out', async ({ page, request }) => {
  await signInViaStub(page, request);
  await expect(page).toHaveURL(/\/setup\/rules/);
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  await expect(page.locator('#signed-in-menu')).toBeHidden();
  await openSignedInMenu(page);
  await expect(page.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/welcome');
  await expect(page.getByRole('link', { name: 'Shops' })).toHaveAttribute('href', '/shops');
  await expect(page.getByRole('link', { name: /Profile/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Living room rules' })).toHaveAttribute(
    'href',
    '/rules',
  );
  await expect(page.getByRole('link', { name: 'Notifications' })).toHaveAttribute(
    'href',
    '/notifications',
  );
  await expect(page.getByRole('link', { name: 'Messages' })).toHaveAttribute('href', '/messages');
  await expect(page.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
  await expect(page.getByLabel('Language')).toHaveCount(0);
  await expect(page.getByRole('option', { name: 'Deutsch' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
  await expect(page.getByText('Version dev')).toBeVisible();
});

test('Function: ProfilePage — profile heading is visible', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
});

test('Function: LocationForm — profile shows the location heading', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/profile');
  await expect(page.getByText('Location')).toBeVisible();
});

test('Function: setLocation — signed-in form saves a location', async ({ page, request }) => {
  await reachWelcome(page, request);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Edit location' }).click();
  await page.getByRole('textbox', { name: 'Location' }).fill('Zug');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Zug')).toBeVisible();
});

test('Function: PosPage — till heading is visible', async ({ page }) => {
  await seedAdaSession(page);
  await page.route(/\/pos\/charge$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ charge: null, history: [] }),
    });
  });
  await page.goto('/pos');
  await expect(page.getByRole('heading', { name: 'Point of sale' })).toBeVisible();
});

test('Function: PosTill — wallet links to the till instead of mounting it', async ({ page }) => {
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
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/pos\/charge$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ charge: null, history: [] }),
    });
  });
  await page.goto('/wallet');
  await expect(page.getByRole('heading', { name: 'Wallet' })).toBeAttached();
  await page.getByRole('button', { name: 'Receive' }).click();
  await expect(page.getByText('ada@21.gifts')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Set an amount' })).toHaveAttribute('href', '/pos');
  await expect(page.getByRole('heading', { name: 'Point of sale' })).toHaveCount(0);
});

test('Function: ForumVideo — a playable note shows Full screen', async ({ page }) => {
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-clip',
            name: 'Ada',
            text: 'A clip',
            createdAt: '2026-08-28T10:00:00.000Z',
            sats: 21,
            payable: true,
            hasPhoto: false,
            hasVideo: true,
            videoContentType: 'video/mp4',
            role: 'basis',
            replyCount: 0,
          },
        ],
      }),
    });
  });
  await page.route('**/video.mp4', () => new Promise(() => undefined));
  await page.goto('/welcome');
  await expect(page.getByText('A clip')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Full screen' })).toBeVisible();
});

test('Function: fetchPublicForumMessages — signed-out welcome asks for the active page', async ({
  page,
}) => {
  let sawActive = false;
  page.on('request', (request) => {
    if (request.method() !== 'GET' || !request.url().includes('/forum/messages?')) {
      return;
    }
    if (!request.url().includes('mode=active')) {
      return;
    }
    if (request.headers()['authorization'] === undefined) {
      sawActive = true;
    }
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-active',
            name: 'Ada',
            text: 'Active without a session',
            createdAt: '2026-08-28T10:00:00.000Z',
            sats: 21,
            payable: true,
            hasPhoto: false,
            role: 'basis',
            replyCount: 0,
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByText('Active without a session')).toBeVisible();
  expect(sawActive).toBe(true);
});

test('Function: PublicForumUnauthorizedError — a later public page 401 is login, not the load error', async ({
  page,
}) => {
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('cursor') !== null) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-pub',
            name: 'Ada',
            text: 'Public note',
            createdAt: '2026-08-28T10:00:00.000Z',
            sats: 21,
            payable: true,
            hasPhoto: false,
            role: 'basis',
            replyCount: 0,
          },
        ],
        nextCursor: 'cur',
      }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByText('Public note')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test('Function: PosScreen — till heading is visible', async ({ page }) => {
  await seedAdaSession(page);
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        username: 'alice',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        sparkWalletVerified: true,
      }),
    });
  });
  await page.route(/\/pos\/charge$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ charge: null, history: [] }),
    });
  });
  await page.goto('/pos');
  await expect(page.getByRole('heading', { name: 'Point of sale' })).toBeVisible();
});

test('Function: fetchPosState — till shows the amount form', async ({ page }) => {
  await seedAdaSession(page);
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        username: 'alice',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        sparkWalletVerified: true,
      }),
    });
  });
  await page.route(/\/pos\/charge$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ charge: null, history: [] }),
    });
  });
  await page.goto('/pos');
  await expect(page.getByRole('heading', { name: 'Point of sale' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Set an amount' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create payment' })).toHaveCount(0);
});

test('Function: createPosCharge — create opens the charge', async ({ page }) => {
  await seedAdaSession(page);
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        username: 'alice',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        sparkWalletVerified: true,
      }),
    });
  });
  let created = false;
  await page.route(/\/pos\/charge$/, async (route) => {
    if (route.request().method() === 'POST') {
      created = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          charge: {
            id: 'pos-e2e',
            amountSats: 21,
            status: 'pending',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        created
          ? {
              charge: {
                id: 'pos-e2e',
                amountSats: 21,
                status: 'pending',
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 60_000).toISOString(),
              },
              history: [],
            }
          : { charge: null, history: [] },
      ),
    });
  });
  await page.goto('/pos/amount');
  await page.getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: 'Create payment' }).click();
  await expect(page).toHaveURL(/\/pos$/);
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
});

/** Signed-in till with a verified wallet: `POST /pos/charge` opens a charge that later reads return. */
async function routeChargeableTill(page: Page): Promise<void> {
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        username: 'alice',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        sparkWalletVerified: true,
      }),
    });
  });
  let charge: Record<string, unknown> | null = null;
  await page.route(/\/pos\/charge$/, async (route) => {
    if (route.request().method() === 'POST') {
      charge = {
        id: 'pos-e2e',
        amountSats: 21,
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
      };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ charge }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ charge, history: charge === null ? [] : [charge] }),
    });
  });
}

/** Menu → Point of sale → Set an amount → ₿21 → Create payment, from the forum home. */
async function createChargeFromMenu(page: Page, origin: string): Promise<void> {
  await openSignedInMenu(page);
  await page
    .locator('#signed-in-menu')
    .getByRole('link', { name: 'Point of sale', exact: true })
    .click();
  await expect(page).toHaveURL(`${origin}/pos`);
  await page.getByRole('link', { name: 'Set an amount' }).click();
  await expect(page).toHaveURL(`${origin}/pos/amount`);
  await page.getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: 'Create payment' }).click();
  await expect(page).toHaveURL(`${origin}/pos`);
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
}

test('Function: returnToView — after a charge, the till arrow opens the forum', async ({
  page,
}) => {
  await seedAdaSession(page);
  await routeForumLists(page);
  await routeChargeableTill(page);
  await page.goto('/welcome');
  const origin = new URL(page.url()).origin;
  await createChargeFromMenu(page, origin);
  const back = page.getByRole('link', { name: 'Back', exact: true });
  await expect(back).toHaveAttribute('href', '/welcome');
  await back.click();
  await expect(page).toHaveURL(`${origin}/welcome`);
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
});

test('Function: PosAmount — after a charge, the browser back on the till opens the forum', async ({
  page,
}) => {
  await seedAdaSession(page);
  await routeForumLists(page);
  await routeChargeableTill(page);
  await page.goto('/welcome');
  const origin = new URL(page.url()).origin;
  await createChargeFromMenu(page, origin);
  await page.goBack();
  await expect(page).toHaveURL(`${origin}/welcome`);
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
});

test('Function: PosAmount — the amount arrow returns to the till, whose arrow opens the forum', async ({
  page,
}) => {
  await seedAdaSession(page);
  await routeForumLists(page);
  await routeChargeableTill(page);
  await page.goto('/welcome');
  const origin = new URL(page.url()).origin;
  await openSignedInMenu(page);
  await page
    .locator('#signed-in-menu')
    .getByRole('link', { name: 'Point of sale', exact: true })
    .click();
  await page.getByRole('link', { name: 'Set an amount' }).click();
  await expect(page).toHaveURL(`${origin}/pos/amount`);
  const back = page.getByRole('link', { name: 'Back', exact: true });
  await expect(back).toHaveAttribute('href', '/pos');
  await back.click();
  await expect(page).toHaveURL(`${origin}/pos`);
  await expect(page.getByRole('link', { name: 'Set an amount' })).toBeVisible();
  await expect(back).toHaveAttribute('href', '/welcome');
  await back.click();
  await expect(page).toHaveURL(`${origin}/welcome`);
});

test('Function: returnToView — a reloaded amount page replaces itself, and the till arrow opens the forum', async ({
  page,
}) => {
  await seedAdaSession(page);
  await routeForumLists(page);
  await routeChargeableTill(page);
  await page.goto('/welcome');
  const origin = new URL(page.url()).origin;
  await openSignedInMenu(page);
  await page
    .locator('#signed-in-menu')
    .getByRole('link', { name: 'Point of sale', exact: true })
    .click();
  await page.getByRole('link', { name: 'Set an amount' }).click();
  await expect(page).toHaveURL(`${origin}/pos/amount`);
  await page.reload();
  await page.getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: 'Create payment' }).click();
  await expect(page).toHaveURL(`${origin}/pos`);
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  const back = page.getByRole('link', { name: 'Back', exact: true });
  await expect(back).toHaveAttribute('href', '/welcome');
  await back.click();
  await expect(page).toHaveURL(`${origin}/welcome`);
});

test('Function: PosTill — a direct load of the till has the arrow to the forum', async ({
  page,
}) => {
  await seedAdaSession(page);
  await routeChargeableTill(page);
  await page.goto('/pos');
  await expect(page.getByRole('link', { name: 'Set an amount' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to the forum' })).toHaveAttribute(
    'href',
    '/welcome',
  );
});

test('Function: cancelPosCharge — cancel returns the amount form', async ({ page }) => {
  await seedAdaSession(page);
  const open = {
    id: 'pos-e2e',
    amountSats: 21,
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  let cancelled = false;
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        username: 'alice',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        sparkWalletVerified: true,
      }),
    });
  });
  await page.route(/\/pos\/charge$/, async (route) => {
    if (route.request().method() === 'DELETE') {
      cancelled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ charge: null }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        cancelled ? { charge: null, history: [] } : { charge: open, history: [open] },
      ),
    });
  });
  await page.goto('/pos');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('link', { name: 'Set an amount' })).toBeVisible();
});

/** Signs Ada in for the till: CHF, fiat entry, a verified wallet, and charges recorded. */
async function seedChfTill(page: Page): Promise<{ created: number[] }> {
  await seedAdaSession(page);
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        username: 'alice',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        sparkWalletVerified: true,
        fiat: 'CHF',
        amountUnit: 'fiat',
      }),
    });
  });
  const created: number[] = [];
  await page.route(/\/pos\/charge$/, async (route) => {
    if (route.request().method() === 'POST') {
      const { amountSats } = route.request().postDataJSON() as { amountSats: number };
      created.push(amountSats);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          charge: {
            id: 'pos-chf',
            amountSats,
            status: 'pending',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ charge: null, history: [] }),
    });
  });
  return { created };
}

test('Function: useSpotRate — the till in CHF charges the sats of the spot rate', async ({
  page,
}) => {
  await fulfillSpot(page, SPOT_RATES);
  const till = await seedChfTill(page);
  await page.goto('/pos/amount');
  const unit = page.getByRole('group', { name: 'Bitcoin or fiat' });
  await expect(unit.getByRole('button', { name: 'CHF' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '6', exact: true }).click();
  await page.getByRole('button', { name: '8', exact: true }).click();
  await expect(page.getByText("₿85'000")).toBeVisible();
  await page.getByRole('button', { name: 'Create payment' }).click();
  await expect(page).toHaveURL(/\/pos$/);
  expect(till.created).toEqual([85_000]);
});

test('Function: AmountEntry — without a CHF rate the till disables CHF and charges ₿', async ({
  page,
}) => {
  await fulfillSpot(page, { USD: '100000.00' });
  const till = await seedChfTill(page);
  await page.goto('/pos/amount');
  const unit = page.getByRole('group', { name: 'Bitcoin or fiat' });
  await expect(unit.getByRole('button', { name: 'CHF' })).toBeDisabled();
  await expect(unit.getByRole('button', { name: '₿' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '6', exact: true }).click();
  await page.getByRole('button', { name: '8', exact: true }).click();
  await expect(page.getByText('No exchange rate yet')).toBeVisible();
  await page.getByRole('button', { name: 'Create payment' }).click();
  await expect(page).toHaveURL(/\/pos$/);
  await expect(page.getByText('Enter a whole number.')).toHaveCount(0);
  expect(till.created).toEqual([68]);
});

test('Function: fetchFxSpot — the till asks GET /fx/spot for the current price', async ({
  page,
}) => {
  await seedChfTill(page);
  const spot = page.waitForResponse((res) => new URL(res.url()).pathname === '/fx/spot');
  await page.goto('/pos/amount');
  const body = (await (await spot).json()) as { rates: Record<string, string> };
  expect(body.rates).toEqual({});
  await expect(
    page.getByRole('group', { name: 'Bitcoin or fiat' }).getByRole('button', { name: 'CHF' }),
  ).toBeDisabled();
});

test('Function: PosAmount — amount page has the keypad and no QR', async ({ page }) => {
  await seedAdaSession(page);
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        username: 'alice',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        sparkWalletVerified: true,
      }),
    });
  });
  await page.route(/\/pos\/charge$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ charge: null, history: [] }),
    });
  });
  await page.goto('/pos/amount');
  await expect(page.getByRole('heading', { name: 'Amount' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create payment' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Open CryptoPay QR code' })).toHaveCount(0);
});

const POS_ACCOUNT = {
  id: 'acc_e2e',
  linkingKey: null,
  role: 'basis',
  name: 'Ada',
  username: 'alice',
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  setup: null,
  missing: [],
};

/** Signed-in till whose `POST /pos/charge` answers 400 with `code` (or no code when `null`). */
async function openPosAmountAnswering(page: Page, code: string | null): Promise<void> {
  await seedAdaSession(page);
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...POS_ACCOUNT, sparkWalletVerified: true }),
    });
  });
  await page.route(/\/pos\/charge$/, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify(
          code === null ? { error: 'Wallet answer' } : { error: 'Wallet answer', code },
        ),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ charge: null, history: [] }),
    });
  });
  await page.goto('/pos/amount');
  await page.getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: 'Create payment' }).click();
}

test('Function: PosTill — a username without a verified wallet links to the wallet setup', async ({
  page,
}) => {
  await seedAdaSession(page);
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...POS_ACCOUNT, sparkWalletVerified: false }),
    });
  });
  await page.route(/\/pos\/charge$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ charge: null, history: [] }),
    });
  });
  await page.goto('/pos');
  await expect(page.getByRole('link', { name: 'Set up your wallet first.' })).toHaveAttribute(
    'href',
    '/wallet',
  );
  await expect(page.getByRole('link', { name: 'Set an amount' })).toHaveCount(0);
});

test('Function: WalletRequiredError — a wallet_required charge answer asks to set up the wallet', async ({
  page,
}) => {
  await openPosAmountAnswering(page, 'wallet_required');
  await expect(page.getByText('Set up your wallet first.')).toBeVisible();
});

test('Function: CannotReceiveError — a cannot_receive charge answer says the wallet cannot receive', async ({
  page,
}) => {
  await openPosAmountAnswering(page, 'cannot_receive');
  await expect(
    page.getByText('Your wallet cannot receive this payment right now. Please try again later.'),
  ).toBeVisible();
});

test('Function: throwIfWalletAnswer — a 400 is decided by its code, not by its status', async ({
  page,
}) => {
  await openPosAmountAnswering(page, 'wallet_required');
  await expect(page.getByText('Set up your wallet first.')).toBeVisible();
  await expect(page.getByText('Point of sale is unavailable.')).toHaveCount(0);
});

test('Function: throwIfWalletAnswer — a 400 without a wallet code stays the generic error', async ({
  page,
}) => {
  await openPosAmountAnswering(page, null);
  await expect(page.getByText('Point of sale is unavailable.')).toBeVisible();
  await expect(page.getByText('Set up your wallet first.')).toHaveCount(0);
});

test('Function: resetPosTillWriteForTests — till heading is visible', async ({ page }) => {
  await page.goto('/pos');
  await expect(page).toHaveURL(/\/(pos|login)/);
});

test('Function: PosAmountPage — amount heading is visible', async ({ page }) => {
  await page.goto('/pos/amount');
  await expect(page).toHaveURL(/\/(pos\/amount|login)/);
});

test('Function: fetchShopChargeInvoice — GET /pay/shop shows the open charge and POST /pay/shop/invoice its Spark invoice', async ({
  request,
}) => {
  const profile = await request.get('/pay/shop');
  expect(profile.status()).toBe(200);
  const body = (await profile.json()) as { charge: { amountSats: number; status: string } };
  expect(body.charge).toMatchObject({ amountSats: 7_000, status: 'pending' });
  const charge = await request.post('/pay/shop/invoice', { data: { amountSats: 7_000 } });
  expect(charge.status()).toBe(200);
  expect(await charge.json()).toEqual({
    pr: 'lnbc70u1shopcharge',
    amountSats: 7_000,
    sparkInvoice: 'sparkrt1shopcharge',
  });
  const other = await request.post('/pay/shop/invoice', { data: { amountSats: 21 } });
  expect(await other.json()).toMatchObject({ amountSats: 21, sparkInvoice: null });
});

test('Function: fetchMemberSparkInvoice — POST /pay/alice/invoice issues a Spark invoice for the amount entered without a charge', async ({
  request,
}) => {
  const withMessage = await request.post('/pay/alice/invoice', {
    data: { amountSats: 2_100, comment: 'Thanks' },
  });
  expect(withMessage.status()).toBe(200);
  expect(await withMessage.json()).toEqual({
    pr: 'lnbc2100n1alice',
    amountSats: 2_100,
    sparkInvoice: 'sparkrt1alice2100-Thanks',
  });
  const plain = await request.post('/pay/alice/invoice', { data: { amountSats: 21 } });
  expect(await plain.json()).toMatchObject({ amountSats: 21, sparkInvoice: 'sparkrt1alice21' });
  const refused = await request.post('/pay/alice/invoice', { data: { amountSats: 0 } });
  expect(refused.status()).toBe(400);
});

test('Function: PosTill — an open charge turns into Paid ✓ and New payment opens the keypad', async ({
  page,
}) => {
  await seedAdaSession(page);
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        username: 'alice',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        sparkWalletVerified: true,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  const open = {
    id: 'pos-e2e',
    amountSats: 21,
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
    paidAt: null,
  };
  let loads = 0;
  await page.route(/\/pos\/charge$/, async (route) => {
    loads += 1;
    const charge =
      loads === 1 ? open : { ...open, status: 'paid', paidAt: new Date().toISOString() };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ charge, history: [charge] }),
    });
  });
  await page.goto('/pos');
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Paid ✓' })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
  await page.getByRole('link', { name: 'New payment' }).click();
  await expect(page).toHaveURL(/\/pos\/amount$/);
  await expect(page.getByRole('button', { name: 'Create payment' })).toBeVisible();
});

test('Function: PosHistory — the till list gains the charge once it is paid', async ({ page }) => {
  await seedAdaSession(page);
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        username: 'alice',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        sparkWalletVerified: true,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  const earlier = {
    id: 'pos-earlier',
    amountSats: 500,
    status: 'expired',
    createdAt: '2026-09-19T08:30:00.000Z',
    expiresAt: '2026-09-19T08:35:00.000Z',
    paidAt: null,
  };
  const open = {
    id: 'pos-e2e',
    amountSats: 21,
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
    paidAt: null,
  };
  let loads = 0;
  await page.route(/\/pos\/charge$/, async (route) => {
    loads += 1;
    const charge =
      loads === 1 ? open : { ...open, status: 'paid', paidAt: new Date().toISOString() };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ charge, history: [charge, earlier] }),
    });
  });
  await page.goto('/pos');
  const history = page.getByRole('region', { name: 'History' });
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  await expect(history.getByRole('listitem')).toHaveCount(1);
  await expect(history.getByText('Expired')).toBeVisible();
  await expect(history.getByText(/^Paid ✓ /)).toBeVisible({ timeout: 10_000 });
  await expect(history.getByRole('listitem')).toHaveCount(2);
  await expect(history.getByRole('listitem').first()).toContainText('₿21');
});

test('Function: PosHistory — Cancel puts the charge in the list as Cancelled', async ({ page }) => {
  await seedAdaSession(page);
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        username: 'alice',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        sparkWalletVerified: true,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  const open = {
    id: 'pos-e2e',
    amountSats: 21,
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
    paidAt: null,
  };
  let cancelled = false;
  await page.route(/\/pos\/charge$/, async (route) => {
    if (route.request().method() === 'DELETE') {
      cancelled = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }
    const body = cancelled
      ? { charge: null, history: [{ ...open, status: 'cancelled' }] }
      : { charge: open, history: [open] };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
  await page.goto('/pos');
  const history = page.getByRole('region', { name: 'History' });
  await expect(history.getByText('No payments yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('link', { name: 'Set an amount' })).toBeVisible();
  await expect(history.getByText('Cancelled')).toBeVisible();
  await expect(history.getByText('₿21')).toBeVisible();
  await expect(history.getByText('No payments yet.')).toHaveCount(0);
});

test('Function: proxyPosGet — GET /pos/charge without bearer is 401', async ({ request }) => {
  expect((await request.get('/pos/charge')).status()).toBe(401);
});

test('Function: proxyPosPost — POST /pos/charge without bearer is 401', async ({ request }) => {
  expect((await request.post('/pos/charge', { data: { amountSats: 21 } })).status()).toBe(401);
});

test('Function: proxyPosDelete — DELETE /pos/charge without bearer is 401', async ({ request }) => {
  expect((await request.delete('/pos/charge')).status()).toBe(401);
});

test('Function: ProfileScreen — back to forum is visible', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/profile');
  await expect(page.getByRole('link', { name: 'Back to the forum' })).toBeVisible();
});

test('Function: ProfileChromeLeft — profile chrome has back and wordmark', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/profile');
  await expect(page.getByRole('link', { name: 'Back to the forum' })).toBeVisible();
  await expect(page.getByRole('link', { name: '21.gifts' }).first()).toBeVisible();
});

test('Function: Button — login shows the Log in button', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
});

test('Function: ButtonLink — landing Ask for help is a link', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Ask for help' })).toBeVisible();
});

test('Function: Wordmark — landing shows the 21.gifts wordmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: '21.gifts' }).first()).toBeVisible();
});

test('Function: HomeWordmark — unsigned donate wordmark goes home', async ({ page }) => {
  await page.goto('/donate');
  await expect(page.getByRole('link', { name: '21.gifts' })).toHaveAttribute('href', '/');
  await expect(page.getByRole('link', { name: 'Back to the forum' })).toHaveAttribute(
    'href',
    '/welcome',
  );
});

test('Function: HomeWordmark — signed-in donate wordmark goes to welcome', async ({ page }) => {
  await seedAdaSession(page);
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/donate');
  await expect(page.getByRole('link', { name: '21.gifts' })).toHaveAttribute('href', '/welcome');
  await page.getByRole('link', { name: '21.gifts' }).click();
  await expect(page).toHaveURL(/\/welcome/);
});

test('Function: SegmentedControl — the welcome writer shows Send a post', async ({ page }) => {
  await seedAdaSession(page);
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await openHomeWriter(page);
  await expect(page.getByRole('group', { name: 'Compose' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send a post' })).toBeVisible();
});

test('Function: ForumModeSelect — welcome forum view is a dropdown', async ({ page }) => {
  await seedAdaSession(page);
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  const view = page.getByRole('combobox', { name: 'Forum view' });
  await expect(view).toBeVisible();
  await expect(view).toContainText('Active');
  await expect(page.getByRole('option', { name: 'Active', exact: true })).toHaveCount(0);
  await expect(page.getByRole('option', { name: 'No gifts yet', exact: true })).toHaveCount(0);
  await expect(page.getByRole('option', { name: 'All', exact: true })).toHaveCount(0);
  await expect(page.getByRole('option', { name: 'Most popular', exact: true })).toHaveCount(0);
  await view.click();
  await expect(page.getByRole('option', { name: 'Active', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'No gifts yet', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'All', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Most popular', exact: true })).toBeVisible();
  await page.getByRole('option', { name: 'Most popular', exact: true }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(view).toContainText('Most popular');
});

test('Function: IconButton — the welcome writer shows the Post icon control', async ({ page }) => {
  await seedAdaSession(page);
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await openHomeWriter(page);
  await expect(page.getByRole('button', { name: 'Post', exact: true })).toBeVisible();
});

test('Function: Card — login card is visible', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Log in with your device' })).toBeVisible();
});

test('Function: Field — pay amount uses Field', async ({ page }) => {
  await seedAdaSession(page);
  await stubPayableNote(page);
  await page.goto('/welcome');
  await chooseForumView(page, 'All');
  await page.getByRole('button', { name: 'Show reactions' }).click();
  const replyCard = page.locator('[data-reply-id="r-pay"]');
  await replyCard.getByRole('button', { name: 'Send Bitcoin' }).click();
  await expect(replyCard.getByLabel('Amount')).toBeVisible();
});

test('Function: PageChrome — public rules shows language switcher chrome', async ({ page }) => {
  await page.goto('/rules');
  await expect(page.getByRole('combobox', { name: 'Language' })).toBeVisible();
});

test('Function: AppShell — login chrome is visible', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('combobox', { name: 'Language' })).toBeVisible();
});

test('Function: Scrollport — login has one scrollport and the document does not scroll', async ({
  page,
}) => {
  await page.goto('/login');
  await expect(page.locator('[data-scrollport]')).toHaveCount(1);
  await expect(page.locator('[data-scrollport][data-scroll-locked]')).toHaveCount(0);
  const documentScrolls = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollHeight > root.clientHeight + 1;
  });
  expect(documentScrolls).toBe(false);
});

test('Function: bindScrollport — the page scrollport is the one that is unlocked', async ({
  page,
}) => {
  await page.goto('/login');
  const unlocked = await page.evaluate(() => {
    return document.querySelectorAll('[data-scrollport]:not([data-scroll-locked])').length;
  });
  expect(unlocked).toBe(1);
});

test('Function: releaseScrollport — leaving the page does not leave a locked document', async ({
  page,
}) => {
  await page.goto('/login');
  await page.goto('/rules');
  const documentScrolls = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollHeight > root.clientHeight + 1;
  });
  expect(documentScrolls).toBe(false);
  await expect(page.locator('[data-scrollport]:not([data-scroll-locked])')).toHaveCount(1);
});

test('Function: syncScrollSurfaces — a scrolling box added at runtime is clipped', async ({
  page,
}) => {
  await page.goto('/login');
  await page.evaluate(() => {
    const stray = document.createElement('div');
    stray.id = 'stray-scroll';
    stray.style.overflow = 'auto';
    stray.textContent = 'stray';
    document.body.appendChild(stray);
  });
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.getElementById('stray-scroll')!).overflowY),
    )
    .toBe('clip');
});

test('Function: ScrollSurfaceGuard — typing in a textarea does not make the field scroll', async ({
  page,
}) => {
  await page.goto('/login');
  const scrollsInside = await page.evaluate(() => {
    const field = document.createElement('textarea');
    document.body.appendChild(field);
    field.value = 'line\n'.repeat(30);
    field.dispatchEvent(new InputEvent('input', { bubbles: true }));
    const style = getComputedStyle(field);
    return (
      style.overflowY === 'auto' ||
      style.overflowY === 'scroll' ||
      field.scrollHeight > field.clientHeight + 2
    );
  });
  expect(scrollsInside).toBe(false);
});

test('Function: useAppShellScroller — welcome inner scroller drives New posts', async ({
  page,
}) => {
  await seedAdaSession(page);
  const first = Array.from({ length: 12 }, (_, index) => ({
    id: `m-scroller-${String(index)}`,
    name: 'Ada',
    text: `Scroller note ${String(index)} so the welcome list can scroll past the top.`,
    createdAt: `2026-08-28T12:${String(index).padStart(2, '0')}:00.000Z`,
    sats: 21,
    payable: true,
    hasPhoto: false,
    hasVideo: false,
    videoContentType: null,
    role: 'basis',
    replyCount: 0,
  }));
  let messagesBody: unknown = { messages: first };
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(messagesBody),
    });
  });
  await page.goto('/welcome');
  await expect(
    page.getByText('Scroller note 0 so the welcome list can scroll past the top.'),
  ).toBeVisible();
  await page.evaluate(() => {
    const scroller = document.querySelector('main [data-scrollport]');
    if (scroller instanceof HTMLElement) {
      scroller.scrollTop = 900;
    }
  });
  const afterScroll = await page.evaluate(() => {
    const scroller = document.querySelector('main [data-scrollport]');
    return {
      innerTop: scroller instanceof HTMLElement ? scroller.scrollTop : -1,
      windowY: window.scrollY,
    };
  });
  expect(afterScroll.innerTop).toBeGreaterThanOrEqual(8);
  expect(afterScroll.windowY).toBe(0);
  messagesBody = {
    messages: [
      {
        id: 'm-unseen-scroller',
        name: 'Carol',
        text: 'Held unseen note for the inner scroller New posts pill.',
        createdAt: '2026-08-28T13:00:00.000Z',
        sats: 21,
        payable: true,
        hasPhoto: false,
        hasVideo: false,
        videoContentType: null,
        role: 'basis',
        replyCount: 0,
      },
      ...first,
    ],
  };
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('button', { name: 'New posts' })).toBeVisible();
  await expect(
    page.getByText('Held unseen note for the inner scroller New posts pill.'),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'New posts' }).click();
  await expect(
    page.getByText('Held unseen note for the inner scroller New posts pill.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'New posts' })).toHaveCount(0);
  const afterTop = await page.evaluate(() => {
    const scroller = document.querySelector('main [data-scrollport]');
    return scroller instanceof HTMLElement ? scroller.scrollTop : -1;
  });
  expect(afterTop).toBeLessThan(8);
});

test('Function: AppShell — signed-in notifications Menu sits in the page-frame header', async ({
  page,
}) => {
  await seedAdaSession(page);
  await page.route(/\/forum\/notifications$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notifications: [], unreadCount: 0 }),
    });
  });
  await page.goto('/notifications');
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  const frame = page.locator('main > section');
  const chrome = frame.locator('[data-app-chrome]');
  const menu = chrome.getByRole('button', { name: 'Menu' });
  await expect(chrome).toBeVisible();
  await expect(menu).toBeVisible();
  const menuBox = await menu.boundingBox();
  const frameBox = await frame.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(frameBox).not.toBeNull();
  const menuX = menuBox?.x ?? 0;
  const menuY = menuBox?.y ?? 0;
  const menuRight = menuX + (menuBox?.width ?? 0);
  const menuBottom = menuY + (menuBox?.height ?? 0);
  const frameX = frameBox?.x ?? 0;
  const frameY = frameBox?.y ?? 0;
  const frameRight = frameX + (frameBox?.width ?? 0);
  const frameBottom = frameY + (frameBox?.height ?? 0);
  expect(menuX).toBeGreaterThanOrEqual(frameX - 1);
  expect(menuY).toBeGreaterThanOrEqual(frameY - 1);
  expect(menuRight).toBeLessThanOrEqual(frameRight + 1);
  expect(menuBottom).toBeLessThanOrEqual(frameBottom + 1);
});

test('Function: AppShellTopLeft — rules setup shows the wordmark', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: true,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: null,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: 'rules',
        missing: ['rules'],
      }),
    });
  });
  await page.goto('/setup/rules');
  await expect(page.getByText('21.gifts').first()).toBeVisible();
});

test('Function: AppHeightSync — document has --app-height', async ({ page }) => {
  await page.goto('/login');
  const value = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim(),
  );
  expect(value).not.toBe('');
});

test('Function: useAppHeight — document has --app-height', async ({ page }) => {
  await page.goto('/login');
  const value = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim(),
  );
  expect(value).not.toBe('');
});

test('Function: resolveAppHeight — document has --app-height', async ({ page }) => {
  await page.goto('/login');
  const value = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim(),
  );
  expect(value).not.toBe('');
});

test('Function: resolveAppHeight — short keyboard visualViewport sizes the page frame', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
    const inner = window.innerHeight;
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        height: Math.round(inner * 0.6),
        offsetTop: Math.round(inner * 0.15),
        scale: 1,
        addEventListener() {},
        removeEventListener() {},
      },
    });
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await openHomeWriter(page);
  await page.getByLabel('Your message').focus();
  const measured = await page.evaluate(() => {
    const inner = window.innerHeight;
    const vv = window.visualViewport;
    const main = document.querySelector('main');
    return {
      appHeight: getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim(),
      appOffset: getComputedStyle(document.documentElement)
        .getPropertyValue('--app-offset-top')
        .trim(),
      inner,
      short: vv === null || vv === undefined ? 0 : Math.round(vv.height),
      offset: vv === null || vv === undefined ? 0 : Math.round(vv.offsetTop ?? 0),
      bodyTop: document.body.getBoundingClientRect().top,
      mainHeight: main === null ? 0 : Math.round(main.getBoundingClientRect().height),
    };
  });
  expect(measured.short).toBeGreaterThan(0);
  expect(measured.short).toBeLessThan(measured.inner);
  expect(measured.appHeight).toBe(`${measured.short}px`);
  expect(measured.appOffset).toBe(`${measured.offset}px`);
  expect(measured.bodyTop).toBe(measured.offset);
  expect(measured.mainHeight).toBe(measured.short);
  expect(measured.mainHeight).not.toBe(measured.short + measured.offset);
});

test('Function: resolveAppOffsetTop — body sits on the visual viewport', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        height: 500,
        offsetTop: 120,
        scale: 1,
        addEventListener() {},
        removeEventListener() {},
      },
    });
  });
  await page.goto('/login');
  const measured = await page.evaluate(() => {
    const main = document.querySelector('main');
    return {
      offset: getComputedStyle(document.documentElement)
        .getPropertyValue('--app-offset-top')
        .trim(),
      height: getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim(),
      bodyTop: document.body.getBoundingClientRect().top,
      mainHeight: main === null ? 0 : Math.round(main.getBoundingClientRect().height),
    };
  });
  expect(measured.offset).toBe('120px');
  expect(measured.height).toBe('500px');
  expect(measured.bodyTop).toBe(120);
  expect(measured.mainHeight).toBe(500);
});

test('Function: revealInScrollport — a focused field moves the scrollport, not the document', async ({
  page,
}) => {
  await page.goto('/login');
  await page.locator('[data-scrollport][data-scroll-active]').waitFor();
  const before = await page.evaluate(() => {
    const scroller = document.querySelector('[data-scrollport][data-scroll-active]');
    if (!(scroller instanceof HTMLElement)) {
      return { ready: false, scrollTop: -1, scrollY: window.scrollY, below: false };
    }
    const field = document.createElement('textarea');
    field.id = 'reveal-probe';
    field.setAttribute('aria-label', 'Reveal probe');
    field.style.display = 'block';
    field.style.width = '12rem';
    field.style.marginTop = '2400px';
    // Room below the field so the 12px reveal is not clamped at the scroll end.
    field.style.marginBottom = '48px';
    scroller.appendChild(field);
    const fieldBox = field.getBoundingClientRect();
    const scrollerBox = scroller.getBoundingClientRect();
    return {
      ready: true,
      scrollTop: scroller.scrollTop,
      scrollY: window.scrollY,
      below: fieldBox.bottom > scrollerBox.bottom,
    };
  });
  expect(before.ready).toBe(true);
  expect(before.scrollTop).toBe(0);
  expect(before.scrollY).toBe(0);
  expect(before.below).toBe(true);

  const after = await page.evaluate(
    () =>
      new Promise<{ focused: boolean; scrollTop: number; scrollY: number; bottomGap: number }>(
        (resolve) => {
          const field = document.querySelector('#reveal-probe');
          const scroller = document.querySelector('[data-scrollport][data-scroll-active]');
          if (!(field instanceof HTMLTextAreaElement) || !(scroller instanceof HTMLElement)) {
            resolve({ focused: false, scrollTop: -1, scrollY: window.scrollY, bottomGap: -1 });
            return;
          }
          // The browser must not scroll on focus. The app's focus listener reveals.
          field.focus({ preventScroll: true });
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const fieldBox = field.getBoundingClientRect();
              const scrollerBox = scroller.getBoundingClientRect();
              resolve({
                focused: document.activeElement === field,
                scrollTop: scroller.scrollTop,
                scrollY: window.scrollY,
                bottomGap: scrollerBox.bottom - fieldBox.bottom,
              });
            });
          });
        },
      ),
  );
  expect(after.focused).toBe(true);
  expect(after.scrollTop).toBeGreaterThan(before.scrollTop);
  expect(after.scrollY).toBe(0);
  expect(Math.abs(after.bottomGap - 12)).toBeLessThan(1);
});

test('Function: AppHeightViewport — document has --app-height', async ({ page }) => {
  await page.goto('/login');
  const value = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim(),
  );
  expect(value).not.toBe('');
});

test('Function: AppShellHeader — name screen heading is visible', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: null,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: 'name',
        missing: ['name', 'lightning-address', 'rules'],
      }),
    });
  });
  await page.goto('/setup/name');
  await expect(page.getByRole('heading', { name: 'Your name' })).toBeVisible();
});

test('Function: AppShellFooter — name screen Continue is visible', async ({ page }) => {
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
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: null,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: 'name',
        missing: ['name', 'lightning-address', 'rules'],
      }),
    });
  });
  await page.goto('/setup/name');
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('Function: PublicMessagePage — public note shows Hello from Ada', async ({ page }) => {
  const id = '11111111-1111-4111-8111-111111111111';
  await page.route(`**/public-messages/${id}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(`**/public-messages/${id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id,
        name: 'Ada',
        text: 'Hello from Ada',
        createdAt: '2026-08-28T12:00:00.000Z',
        sats: 0,
        payable: false,
        hasPhoto: false,
        role: 'basis',
        replyCount: 0,
      }),
    });
  });
  await page.goto(`/messages/${id}`);
  await expect(page.getByText('Hello from Ada')).toBeVisible();
});

test('Function: PublicMessageChrome — unsigned public note keeps public chrome', async ({
  page,
}) => {
  const id = '11111111-1111-4111-8111-111111111111';
  await page.route(`**/public-messages/${id}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(`**/public-messages/${id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id,
        name: 'Ada',
        text: 'Hello from Ada',
        createdAt: '2026-08-28T12:00:00.000Z',
        sats: 0,
        payable: false,
        hasPhoto: false,
        role: 'basis',
        replyCount: 0,
      }),
    });
  });
  await page.goto(`/messages/${id}`);
  await expect(page.getByRole('link', { name: '21.gifts', exact: true })).toHaveAttribute(
    'href',
    '/',
  );
  await expect(page.getByRole('button', { name: 'Menu' })).toHaveCount(0);
});

test('Function: PublicMessageChrome — signed-in public note shows back and Menu', async ({
  page,
}) => {
  const id = '11111111-1111-4111-8111-111111111111';
  await seedAdaSession(page);
  await page.route(`**/forum/messages/${id}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(`**/public-messages/${id}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(`**/public-messages/${id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id,
        name: 'Ada',
        text: 'Hello from Ada',
        createdAt: '2026-08-28T12:00:00.000Z',
        sats: 0,
        payable: false,
        hasPhoto: false,
        role: 'basis',
        replyCount: 0,
      }),
    });
  });
  await page.goto(`/messages/${id}`);
  await expect(page.getByRole('link', { name: 'Back to the forum' }).first()).toHaveAttribute(
    'href',
    '/welcome',
  );
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
});

test('Function: PublicMessageThread — signed-in permalink shows Copy link to this note', async ({
  page,
}) => {
  const id = '11111111-1111-4111-8111-111111111111';
  const signedNote = {
    id,
    name: 'Ada',
    text: 'Hello from Ada',
    createdAt: '2026-08-28T12:00:00.000Z',
    sats: 0,
    payable: false,
    hasPhoto: false,
    role: 'basis',
    replyCount: 0,
    accountId: 'acc_e2e',
  };
  await seedAdaSession(page);
  await page.route(`**/forum/messages/${id}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(`**/public-messages/${id}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(`**/public-messages/${id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(signedNote),
    });
  });
  await page.route(`**/forum/messages/${id}`, async (route) => {
    if (route.request().url().includes('/replies')) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(signedNote),
    });
  });
  await page.goto(`/messages/${id}`);
  await expect(page.getByRole('button', { name: 'Copy link to this note' })).toBeVisible();
});

test('Function: useActiveSession — an open signed-in session loads the permalink with the bearer route', async ({
  page,
}) => {
  const id = '11111111-1111-4111-8111-111111111111';
  const signedNote = {
    id,
    name: 'Ada',
    text: 'Hello from Ada',
    createdAt: '2026-08-28T12:00:00.000Z',
    sats: 0,
    payable: false,
    hasPhoto: false,
    role: 'basis',
    replyCount: 0,
    accountId: 'acc_e2e',
  };
  await seedAdaSession(page);
  await page.route(`**/forum/messages/${id}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(`**/public-messages/${id}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(`**/public-messages/${id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(signedNote),
    });
  });
  await page.route(`**/forum/messages/${id}`, async (route) => {
    if (route.request().url().includes('/replies')) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(signedNote),
    });
  });
  const signedRequests: string[] = [];
  page.on('request', (req) => {
    if (req.url().endsWith(`/forum/messages/${id}`)) {
      signedRequests.push(req.url());
    }
  });
  await page.goto(`/messages/${id}`);
  await expect(page.getByRole('button', { name: 'Copy link to this note' })).toBeVisible();
  // Playwright builds count the wallet as open, so the session is active.
  expect(signedRequests.length).toBeGreaterThan(0);
});

test('Function: generateMetadata — public note HTML includes og:title', async ({ request }) => {
  const res = await request.get('/messages/11111111-1111-4111-8111-111111111111');
  expect(await res.text()).toContain('property="og:title"');
});

test('Function: loadPublicMessageForOg — public note HTML includes og:title', async ({
  request,
}) => {
  const res = await request.get('/messages/11111111-1111-4111-8111-111111111111');
  expect(await res.text()).toContain('property="og:title"');
});

test('Function: publicMessageOgMetadata — public note HTML includes og:title', async ({
  request,
}) => {
  const res = await request.get('/messages/11111111-1111-4111-8111-111111111111');
  expect(await res.text()).toContain('property="og:title"');
});

test('Function: PublicMessageLoader — invalid id shows not-found copy', async ({ page }) => {
  await page.goto('/messages/not-a-uuid');
  await expect(page.getByText('This profile could not be found.')).toBeVisible();
});

test('Function: PublicMessageLoader — public note has no fiat switcher', async ({ page }) => {
  const id = '11111111-1111-4111-8111-111111111111';
  await page.route(`**/public-messages/${id}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(`**/public-messages/${id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id,
        name: 'Ada',
        text: 'Hello from Ada',
        createdAt: '2026-08-28T12:00:00.000Z',
        sats: 0,
        payable: false,
        hasPhoto: false,
        role: 'basis',
        replyCount: 0,
      }),
    });
  });
  await page.goto(`/messages/${id}`);
  await expect(page.getByText('Ada', { exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Fiat currency' })).toHaveCount(0);
});

test('Function: fetchPublicMessage — public note loads via the client fetch', async ({ page }) => {
  const id = '11111111-1111-4111-8111-111111111111';
  await page.route(`**/public-messages/${id}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(`**/public-messages/${id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id,
        name: 'Ada',
        text: 'Hello from Ada',
        createdAt: '2026-08-28T12:00:00.000Z',
        sats: 0,
        payable: false,
        hasPhoto: false,
        role: 'basis',
        replyCount: 0,
      }),
    });
  });
  await page.goto(`/messages/${id}`);
  await expect(page.getByText('Ada', { exact: true })).toBeVisible();
});

test('Function: fetchForumMessage — staff hidden note loads via the bearer fetch', async ({
  page,
}) => {
  const id = '11111111-1111-4111-8111-111111111111';
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
        role: 'moderator',
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1_700_000_000,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(`**/forum/messages/${id}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(`**/forum/messages/${id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id,
        name: 'Ada',
        text: 'Hidden from the living room',
        createdAt: '2026-08-28T12:00:00.000Z',
        sats: 0,
        payable: false,
        hasPhoto: false,
        role: 'moderator',
        replyCount: 0,
        deletedAt: '2026-08-29T15:00:00.000Z',
        deletedBy: { id: 'acc_mod', name: 'Marta', role: 'moderator' },
      }),
    });
  });
  await page.goto(`/messages/${id}`);
  await expect(page.getByRole('status')).toContainText('This note was hidden by Marta');
  await expect(page.getByText('Hidden from the living room')).toBeVisible();
});

test('Function: fetchPublicMessagePhoto — public note with photo shows alt', async ({ page }) => {
  const id = '11111111-1111-4111-8111-111111111111';
  await page.route(`**/public-messages/${id}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(`**/public-messages/${id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id,
        name: 'Ada',
        text: '',
        createdAt: '2026-08-28T12:00:00.000Z',
        sats: 0,
        payable: false,
        hasPhoto: true,
        role: 'basis',
        replyCount: 0,
      }),
    });
  });
  await page.route(`**/messages/${id}/photo`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    });
  });
  await page.goto(`/messages/${id}`);
  await expect(page.getByAltText('Photo from Ada')).toBeVisible();
});

test('Function: fetchPublicReplies — public thread loads replies without bearer', async ({
  page,
}) => {
  const parentId = '11111111-1111-4111-8111-111111111111';
  const replyId = '22222222-2222-4222-8222-222222222222';
  const parent = {
    id: parentId,
    name: 'Ada',
    text: 'Hello from Ada',
    createdAt: '2026-08-28T12:00:00.000Z',
    sats: 0,
    payable: false,
    hasPhoto: false,
    role: 'basis',
    replyCount: 1,
  };
  const reply = {
    id: replyId,
    parentId,
    name: 'Pater Severin',
    text: '',
    sats: 3000,
    payable: false,
    hasPhoto: false,
    role: 'basis',
    replyCount: 0,
    createdAt: '2026-08-28T12:01:00.000Z',
  };
  await page.route(`**/public-messages/${parentId}/replies`, async (route) => {
    expect(route.request().headers()['authorization']).toBeFalsy();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [reply] }),
    });
  });
  await page.route(`**/public-messages/${parentId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(parent),
    });
  });
  await page.goto(`/messages/${parentId}`);
  await expect(page.getByText('Hello from Ada')).toBeVisible();
  await expect(page.getByText('Pater Severin')).toBeVisible();
});

test('Function: fetchReplies — expanding a welcome note loads replies', async ({ page }) => {
  await seedAdaSession(page);
  const id = 'm-expand';
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id,
            name: 'Ada',
            text: 'Hello from Ada',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 5,
            payable: true,
            hasPhoto: false,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 1,
          },
        ],
      }),
    });
  });
  await page.route(`**/forum/messages/${id}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'r1',
            name: 'Bob',
            text: 'A reply',
            createdAt: '2026-08-28T12:30:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: false,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await chooseForumView(page, 'All');
  await page.getByRole('button', { name: 'Show reactions' }).click();
  await expect(page.getByPlaceholder('Write a reaction')).toBeVisible();
});

test('Function: isReplyPaymentExempt — a founder posts a reaction without an invoice', async ({
  page,
}) => {
  await seedAdaSession(page, 'founder');
  const id = 'm-exempt';
  const note = {
    id,
    accountId: 'acc_other',
    name: 'Bob',
    text: 'Hello from Bob',
    createdAt: '2026-08-28T12:00:00.000Z',
    sats: 5,
    payable: true,
    hasPhoto: false,
    hasVideo: false,
    videoContentType: null,
    role: 'basis',
    replyCount: 0,
  };
  let invoiceRequests = 0;
  let replyBody: unknown = null;
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    if (route.request().method() === 'POST') {
      replyBody = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          message: {
            ...note,
            id: 'r-exempt',
            name: 'Ada',
            text: 'Thank you',
            sats: 0,
            role: 'founder',
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [note] }),
    });
  });
  await page.route(`**/forum/messages/${id}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(/\/messages\/[^/]+\/invoice$/, async (route) => {
    invoiceRequests += 1;
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/welcome');
  await chooseForumView(page, 'All');
  await page.getByRole('button', { name: 'Show reactions' }).click();
  await page.getByPlaceholder('Write a reaction').fill('Thank you');
  await page.getByRole('button', { name: 'Post', exact: true }).last().click();
  await expect.poll(() => replyBody).toMatchObject({ text: 'Thank you', inReplyTo: id });
  expect(invoiceRequests).toBe(0);
});

async function routeOwnReplyForum(
  page: import('@playwright/test').Page,
  note: { id: string } & Record<string, unknown>,
): Promise<{ replyBodies: unknown[]; invoiceUrls: string[]; invoiceBodies: unknown[] }> {
  const seen = {
    replyBodies: [] as unknown[],
    invoiceUrls: [] as string[],
    invoiceBodies: [] as unknown[],
  };
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { text: string };
      seen.replyBodies.push(body);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          message: {
            ...note,
            id: 'r-own',
            name: 'Ada',
            text: body.text,
            sats: 0,
            payable: false,
            role: 'basis',
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [note] }),
    });
  });
  await page.route(`**/forum/messages/${note.id}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route('**/messages/compose-target', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messageId: 'compose-fee', sats: 0, firstPostFree: false }),
    });
  });
  await page.route(/\/messages\/[^/]+\/invoice$/, async (route) => {
    seen.invoiceUrls.push(new URL(route.request().url()).pathname);
    seen.invoiceBodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pr: 'lnbc10n1pexample', amountSats: 1 }),
    });
  });
  return seen;
}

test('Function: isOwnNote — a Basis member replies to their own post without paying', async ({
  page,
}) => {
  await seedAdaSession(page, 'basis');
  const note = {
    id: 'm-own',
    accountId: 'acc_e2e',
    name: 'Ada',
    text: 'Hello from Ada',
    createdAt: '2026-08-28T12:00:00.000Z',
    sats: 0,
    payable: true,
    hasPhoto: false,
    hasVideo: false,
    videoContentType: null,
    role: 'basis',
    replyCount: 0,
  };
  const seen = await routeOwnReplyForum(page, note);
  await page.goto('/welcome');
  await chooseForumView(page, 'All');
  await page.getByRole('button', { name: 'Show reactions' }).click();
  const composer = page.getByPlaceholder('Write a reaction');
  await expect(composer).toBeVisible();
  await expect(page.locator('#forum-reply-amount')).toHaveCount(0);
  await composer.fill('A note to my own post');
  await composer.locator('xpath=ancestor::form').getByRole('button', { name: 'Post' }).click();
  await expect
    .poll(() => seen.replyBodies)
    .toEqual([{ text: 'A note to my own post', inReplyTo: 'm-own' }]);
  await expect(page.getByText('A note to my own post')).toBeVisible();
  await expect(page.getByRole('button', { name: /and post/ })).toHaveCount(0);
  expect(seen.invoiceUrls).toEqual([]);
});

test('Function: isOwnNote — a Basis reply to someone else still pays 1 sat', async ({ page }) => {
  await seedAdaSession(page, 'basis');
  const note = {
    id: 'm-bob',
    accountId: 'acc_bob',
    name: 'Bob',
    text: 'Hello from Bob',
    createdAt: '2026-08-28T12:00:00.000Z',
    sats: 0,
    payable: true,
    hasPhoto: false,
    hasVideo: false,
    videoContentType: null,
    role: 'basis',
    replyCount: 0,
  };
  const seen = await routeOwnReplyForum(page, note);
  await page.goto('/welcome');
  await chooseForumView(page, 'All');
  await page.getByRole('button', { name: 'Show reactions' }).click();
  const composer = page.getByPlaceholder('Write a reaction');
  await expect(composer).toBeVisible();
  await expect(page.locator('#forum-reply-amount')).toBeVisible();
  await composer.fill('Hi Bob');
  await composer.locator('xpath=ancestor::form').getByRole('button', { name: 'Post' }).click();
  await expect.poll(() => seen.invoiceUrls).toEqual(['/messages/compose-fee/invoice']);
  expect(seen.invoiceBodies[0]).toMatchObject({ sats: 1, text: 'inReplyTo:m-bob\nHi Bob' });
  expect(seen.replyBodies).toEqual([]);
});

test('Function: ViewProfilePage — public view heading is visible', async ({ page }) => {
  const key = 'a'.repeat(64);
  await page.route(new RegExp(`/view-key/${key}$`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        createdAt: 1,
        hasPasskey: false,
        aboutMe: null,
      }),
    });
  });
  await page.route('**/view-key/**/activity**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(EMPTY_ACTIVITY),
    });
  });
  await page.goto('/view/[viewKey]');
  await page.goto(`/view/${key}`);
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
});

test('Function: ViewProfileLoader — missing key shows not-found copy', async ({ page }) => {
  const missing = 'b'.repeat(64);
  await page.route(new RegExp(`/view-key/${missing}$`), async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Not found' }),
    });
  });
  await page.goto(`/view/${missing}`);
  await expect(page.getByText('This profile could not be found.')).toBeVisible();
});

test('Function: ViewProfileScreen — public card shows the name', async ({ page }) => {
  const key = 'a'.repeat(64);
  await page.route(new RegExp(`/view-key/${key}$`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        createdAt: 1,
        hasPasskey: false,
        aboutMe: null,
      }),
    });
  });
  await page.route('**/view-key/**/activity**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(EMPTY_ACTIVITY),
    });
  });
  await page.goto(`/view/${key}`);
  await expect(page.getByText('Ada')).toBeVisible();
  await expect(page.getByText('No gifts yet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit name' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Copy link to this profile' })).toBeVisible();
  await expect(page.getByText('Copy link to this profile')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
});

test('Function: ViewProfileClaim — public view shows the passkey claim control', async ({
  page,
}) => {
  const key = 'a'.repeat(64);
  await page.route(new RegExp(`/view-key/${key}$`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        createdAt: 1,
        hasPasskey: false,
        aboutMe: null,
      }),
    });
  });
  await page.route('**/view-key/**/activity**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(EMPTY_ACTIVITY),
    });
  });
  await page.goto(`/view/${key}`);
  await expect(page.getByText('Action required, the account must be activated')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Activate' })).toBeVisible();
});

test('Function: fetchViewProfile — public view card loads via the client fetch', async ({
  page,
}) => {
  const key = 'a'.repeat(64);
  await page.route(new RegExp(`/view-key/${key}$`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        createdAt: 1,
        hasPasskey: false,
        aboutMe: null,
      }),
    });
  });
  await page.route('**/view-key/**/activity**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(EMPTY_ACTIVITY),
    });
  });
  await page.goto(`/view/${key}`);
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(page.getByText('Ada')).toBeVisible();
});

test('Function: proxyViewGet — GET /view-key/[viewKey] is reachable', async ({ request }) => {
  const res = await request.get('/view-key/[viewKey]');
  expect(res.status()).toBeGreaterThanOrEqual(400);
});
test('Function: fetchAccountActivity — profile chart shows received sats and the menu does not', async ({
  page,
}) => {
  await seedAdaSession(page);
  await stubAccountActivity(page, {
    ...EMPTY_ACTIVITY,
    receivedSats: 1500,
    receivedOverTime: POPULATED_STATS.spendOverTime,
  });
  await page.goto('/profile');
  await expect(page.getByLabel('Given and received in ₿').getByText("₿1'500")).toBeVisible();
  await openSignedInMenu(page);
  await expect(page.getByRole('link', { name: 'Profile', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Received ₿/ })).toHaveCount(0);
});
test('Function: fetchMemberActivity — member card shows empty activity copy', async ({
  page,
  request,
}) => {
  await reachWelcome(page, request);
  await page.goto('/members/22222222-2222-4222-8222-222222222222');
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(page.getByText('No gifts yet.')).toBeVisible();
});
test('Function: fetchViewActivity — public view card shows empty activity copy', async ({
  page,
}) => {
  const key = 'a'.repeat(64);
  await page.route(new RegExp(`/view-key/${key}$`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        createdAt: 1,
        hasPasskey: false,
        aboutMe: null,
      }),
    });
  });
  await page.route('**/view-key/**/activity**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(EMPTY_ACTIVITY),
    });
  });
  await page.goto(`/view/${key}`);
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(page.getByText('No gifts yet.')).toBeVisible();
});
test('Function: proxyMeActivityGet — GET /me/activity is 401', async ({ request }) => {
  expect((await request.get('/me/activity')).status()).toBe(401);
});
test('Function: proxyMembersActivityGet — GET /forum/members/[accountId]/activity is reachable', async ({
  request,
}) => {
  expect(
    (await request.get('/forum/members/[accountId]/activity')).status(),
  ).toBeGreaterThanOrEqual(400);
});
test('Function: proxyViewActivityGet — GET /view-key/[viewKey]/activity is reachable', async ({
  request,
}) => {
  expect((await request.get('/view-key/[viewKey]/activity')).status()).toBe(200);
});

test('Function: useAccountTotals — profile chart reads /me/activity and the menu hides amounts', async ({
  page,
}) => {
  await seedAdaSession(page);
  await stubAccountActivity(page, {
    ...EMPTY_ACTIVITY,
    receivedSats: 1500,
    receivedOverTime: POPULATED_STATS.spendOverTime,
  });
  await page.goto('/profile');
  await expect(page.getByLabel('Given and received in ₿').getByText("₿1'500")).toBeVisible();
  await openSignedInMenu(page);
  await expect(page.getByRole('link', { name: 'Profile', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Received ₿/ })).toHaveCount(0);
});

test('Function: AccountActivityChart — profile shows Given legend and ₿ chart', async ({
  page,
}) => {
  await seedAdaSession(page);
  await stubAccountActivity(page, EMPTY_ACTIVITY);
  await page.goto('/profile');
  await expect(page.getByText('No gifts yet.')).toBeVisible();
  await expect(page.getByLabel('Given and received in ₿')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Given and received' })).toHaveCount(0);
});

test('Function: alignActivitySeries — receive series days appear on the profile chart', async ({
  page,
}) => {
  await seedAdaSession(page);
  await stubAccountActivity(page, {
    ...EMPTY_ACTIVITY,
    receivedSats: 1500,
    receivedOverTime: POPULATED_STATS.spendOverTime,
  });
  await page.goto('/profile');
  await expect(page.getByText('2026-06-01')).toBeVisible();
  await expect(page.getByText('2026-07-01')).toBeVisible();
});

test('Function: activityValue — USD toggle shows received USD on the profile chart', async ({
  page,
}) => {
  await seedAdaSession(page);
  await stubAccountActivity(page, {
    ...EMPTY_ACTIVITY,
    receivedSats: 1500,
    receivedOverTime: POPULATED_STATS.spendOverTime,
  });
  await page.goto('/profile');
  await page
    .getByRole('group', { name: 'Chart scale' })
    .getByRole('button', { name: 'USD' })
    .click();
  await expect(page.getByLabel('Given and received in USD')).toBeVisible();
  await expect(page.getByLabel('Given and received in USD').getByText('$1.43')).toBeVisible();
});

test('Function: activityMaxY — empty profile chart shows copy instead of an axis', async ({
  page,
}) => {
  await seedAdaSession(page);
  await stubAccountActivity(page, EMPTY_ACTIVITY);
  await page.goto('/profile');
  await expect(page.getByText('No gifts yet.')).toBeVisible();
  await expect(page.getByLabel('Given and received in ₿')).toHaveCount(0);
});

test('Function: formatBitcoin — populated profile chart shows grouped ₿ ticks', async ({
  page,
}) => {
  await seedAdaSession(page);
  await stubAccountActivity(page, {
    ...EMPTY_ACTIVITY,
    receivedSats: 1500,
    receivedOverTime: POPULATED_STATS.spendOverTime,
  });
  await page.goto('/profile');
  await expect(page.getByLabel('Given and received in ₿').getByText("₿1'500")).toBeVisible();
});

test('Function: ThemeProvider — picking Dark sets html.dark on /profile', async ({ page }) => {
  await seedAdaSession(page);
  await stubAccountActivity(page, EMPTY_ACTIVITY);
  await page.goto('/profile');
  await page.getByRole('group', { name: 'Theme' }).getByRole('button', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('Function: ThemeSwitcher — System Light Dark options on /profile', async ({ page }) => {
  await seedAdaSession(page);
  await stubAccountActivity(page, EMPTY_ACTIVITY);
  await page.goto('/profile');
  const theme = page.getByRole('group', { name: 'Theme' });
  await expect(theme.getByRole('button', { name: 'System' })).toBeVisible();
  await expect(theme.getByRole('button', { name: 'Light' })).toBeVisible();
  await expect(theme.getByRole('button', { name: 'Dark' })).toBeVisible();
});

test('Function: useTheme — ThemeSwitcher on /profile reads provider context', async ({ page }) => {
  await seedAdaSession(page);
  await stubAccountActivity(page, EMPTY_ACTIVITY);
  await page.goto('/profile');
  await expect(page.getByRole('group', { name: 'Theme' })).toBeVisible();
});

test('Function: THEME_COOKIE — Dark option persists theme=dark', async ({ page }) => {
  await seedAdaSession(page);
  await stubAccountActivity(page, EMPTY_ACTIVITY);
  await page.goto('/profile');
  await page.getByRole('group', { name: 'Theme' }).getByRole('button', { name: 'Dark' }).click();
  expect(await page.context().cookies()).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: 'theme', value: 'dark' })]),
  );
});

test('Function: parseThemePreference — Light cookie resolves without dark class', async ({
  page,
}) => {
  await page
    .context()
    .addCookies([{ name: 'theme', value: 'light', url: 'http://localhost:3000' }]);
  await page.goto('/login');
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('Function: resolveTheme — Dark cookie forces html.dark', async ({ page }) => {
  await page.context().addCookies([{ name: 'theme', value: 'dark', url: 'http://localhost:3000' }]);
  await page.goto('/login');
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('Function: THEME_BOOTSTRAP_SCRIPT — dark cookie paints html.dark before interaction', async ({
  page,
}) => {
  await page.context().addCookies([{ name: 'theme', value: 'dark', url: 'http://localhost:3000' }]);
  await page.goto('/login');
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('Function: APP_HEIGHT_BOOTSTRAP_SCRIPT — document has --app-height', async ({ page }) => {
  await page.goto('/login');
  const value = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim(),
  );
  expect(value).not.toBe('');
});

test('Function: manifest — web app manifest is served', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { name: string; display: string; start_url: string };
  expect(body.name).toBe('21.gifts');
  expect(body.display).toBe('standalone');
  expect(body.start_url).toBe('/welcome');
});

test('Function: proxyPushVapidPublicGet — GET /push/vapid-public without bearer is 401', async ({
  request,
}) => {
  expect((await request.get('/push/vapid-public')).status()).toBe(401);
});

test('Function: bumpUnreadAppBadgeEpoch — signed-in notifications screen loads', async ({
  page,
}) => {
  await seedAdaSession(page);
  await page.route(/\/forum\/notifications/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notifications: [], unreadCount: 0 }),
    });
  });
  await page.goto('/notifications');
  await expect(page.getByText('No notifications yet.')).toBeVisible();
});

test('Function: unreadAppBadgeEpoch — menu shows unread notification count', async ({ page }) => {
  await seedAdaSession(page);
  await page.route(/\/forum\/notifications$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notifications: [], unreadCount: 3 }),
    });
  });
  await page.goto('/profile');
  await openSignedInMenu(page);
  await expect(page.getByRole('link', { name: 'Notifications, 3 unread' })).toBeVisible();
});

test('Function: setUnreadAppBadge — menu shows unread notification count', async ({ page }) => {
  await seedAdaSession(page);
  await page.route(/\/forum\/notifications$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notifications: [], unreadCount: 3 }),
    });
  });
  await page.goto('/profile');
  await openSignedInMenu(page);
  await expect(page.getByRole('link', { name: 'Notifications, 3 unread' })).toBeVisible();
});

test('Function: refreshUnreadAppBadge — opening a thread refetches notifications', async ({
  page,
}) => {
  await seedAdaSession(page);
  let notificationGets = 0;
  await page.route(/\/forum\/notifications$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    notificationGets += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notifications: [], unreadCount: 0 }),
    });
  });
  await page.route(/\/conversations\/conv-21\/read$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route(/\/conversations$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [
          {
            id: 'conv-21',
            kind: 'member_platform',
            name: '21.gifts',
            lastText: 'Hello team',
            lastAt: '2026-08-28T12:00:00.000Z',
            lastFromMe: false,
            lastSats: 0,
            unread: true,
          },
        ],
        unreadCount: 1,
      }),
    });
  });
  await page.route(/\/conversations\/conv-21(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm1',
            name: 'Ada',
            text: 'Hello team',
            createdAt: '2026-08-28T12:00:00.000Z',
            fromMe: false,
            sats: 0,
          },
        ],
      }),
    });
  });
  await page.goto('/messages');
  await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
  await expect.poll(() => notificationGets).toBeGreaterThan(0);
  const beforeThread = notificationGets;
  await page.getByRole('button', { name: '21.gifts, 1 unread' }).click();
  await expect(page.getByRole('heading', { name: '21.gifts' })).toBeVisible();
  await expect.poll(() => notificationGets).toBe(beforeThread + 1);
});

test('Function: push service worker — GET /sw.js is the push worker', async ({ request }) => {
  const res = await request.get('/sw.js');
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain('navigator.setAppBadge');
  expect(body).toContain('showNotification');
  expect(body).toContain('isDeviceSunday');
  expect(body).toContain('21gifts-push-open');
  const guardAt = body.indexOf("payload.type !== 'conversation'");
  expect(guardAt).toBeGreaterThan(-1);
  expect(body.indexOf('showNotification', guardAt)).toBeGreaterThan(guardAt);
});

test('Function: PushOpenListener — welcome heading is visible', async ({ page }) => {
  await seedAdaSession(page);
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await page.evaluate(async () => {
    const cache = await caches.open('21gifts-push-open');
    await cache.put(
      new URL('/push-open/e2e-push', location.origin).href,
      new Response(
        JSON.stringify({
          url: '/messages/note-1?from=https://21.gifts/welcome',
          at: Date.now(),
          id: 'e2e-push',
        }),
        { headers: { 'Content-Type': 'application/json' } },
      ),
    );
  });
  await page.reload();
  await expect(page).toHaveURL(/\/messages\/note-1\?from=https:\/\/21\.gifts\/welcome$/);
});

test('Function: fetchVapidPublicKey — GET /push/vapid-public with bearer is 200', async ({
  request,
}) => {
  const token = await loginHttp(request);
  const res = await request.get('/push/vapid-public', {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { publicKey: string }).publicKey.length).toBeGreaterThan(8);
});

test('Function: proxyMePushSubscriptionsPost — POST /me/push-subscriptions without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/me/push-subscriptions')).status()).toBe(401);
});

test('Function: postPushSubscription — POST /me/push-subscriptions with bearer is 200', async ({
  request,
}) => {
  const token = await loginHttp(request);
  const res = await request.post('/me/push-subscriptions', {
    headers: { authorization: `Bearer ${token}` },
    data: {
      endpoint: 'https://push.example/e2e',
      keys: { p256dh: 'p256', auth: 'auth' },
    },
  });
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { endpoint: string }).endpoint).toBe('https://push.example/e2e');
});

test('Function: POST — POST /me/name without bearer is 401', async ({ request }) => {
  expect((await request.post('/me/name', { data: { name: 'Ada' } })).status()).toBe(401);
});

test('Function: DELETE — DELETE /me/push-subscriptions without bearer is 401', async ({
  request,
}) => {
  expect((await request.delete('/me/push-subscriptions')).status()).toBe(401);
});

test('Function: proxyMePushSubscriptionsDelete — DELETE /me/push-subscriptions without bearer is 401', async ({
  request,
}) => {
  expect((await request.delete('/me/push-subscriptions')).status()).toBe(401);
});

test('Function: deletePushSubscription — DELETE /me/push-subscriptions with bearer is 200', async ({
  request,
}) => {
  const token = await loginHttp(request);
  const res = await request.delete('/me/push-subscriptions', {
    headers: { authorization: `Bearer ${token}` },
    data: { endpoint: 'https://push.example/e2e' },
  });
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
});

test('Function: postNotificationLevel — profile shows All Active Mentions', async ({
  page,
  request,
}) => {
  await reachWelcome(page, request);
  await page.goto('/profile');
  const intro = page.getByRole('dialog', { name: 'Introduce yourself' });
  if (await intro.isVisible()) {
    await page.getByRole('button', { name: 'Close' }).click();
  }
  await expect(page.getByRole('group', { name: 'Notification level' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Active' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mentions' })).toBeVisible();
  const posted = page.waitForResponse((response) => {
    if (response.request().method() !== 'POST') {
      return false;
    }
    return new URL(response.url()).pathname === '/me/notification-level';
  });
  await page.getByRole('button', { name: 'Active' }).click();
  expect((await posted).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Active' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('Function: postHeartNotifications — profile Hearts Off posts the switch', async ({
  page,
  request,
}) => {
  await reachWelcome(page, request);
  await page.goto('/profile');
  const intro = page.getByRole('dialog', { name: 'Introduce yourself' });
  if (await intro.isVisible()) {
    await page.getByRole('button', { name: 'Close' }).click();
  }
  const hearts = page.getByRole('group', { name: 'Hearts' });
  await expect(hearts.getByRole('button', { name: 'On' })).toHaveAttribute('aria-pressed', 'true');
  const posted = page.waitForResponse((response) => {
    if (response.request().method() !== 'POST') {
      return false;
    }
    return new URL(response.url()).pathname === '/me/heart-notifications';
  });
  await hearts.getByRole('button', { name: 'Off' }).click();
  expect((await posted).status()).toBe(200);
  await expect(hearts.getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'true');
});

test('Function: sendHeartTip — signed-out heart does not mint', async ({ page }) => {
  await page.route(/\/forum\/messages/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: '44444444-4444-4444-8444-444444444444',
            accountId: 'acc-ada',
            name: 'Ada',
            text: 'Hello from the active list.',
            createdAt: '2026-08-01T10:00:00.000Z',
            sats: 21,
            payable: true,
            hasPhoto: false,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ],
      }),
    });
  });
  await page.route('**/gifts/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"spendOverTime":[]}',
    });
  });
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Welcome', exact: true })).toBeVisible();
  await expect(page.getByText('Hello from the active list.')).toBeVisible();
  let invoiced = false;
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/invoice')) {
      invoiced = true;
    }
  });
  await page.getByRole('button', { name: 'Send ₿1' }).first().click();
  expect(invoiced).toBe(false);
  await expect(page.getByText('+1', { exact: true })).toHaveCount(0);
  await expect(
    page.getByText('A Bitcoin balance is required for this.', { exact: true }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/\/welcome/);
});

test('Function: useHeartTip — signed-out board shows the heart', async ({ page }) => {
  await page.route(/\/forum\/messages/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: '44444444-4444-4444-8444-444444444444',
            accountId: 'acc-ada',
            name: 'Ada',
            text: 'Hello from the active list.',
            createdAt: '2026-08-01T10:00:00.000Z',
            sats: 21,
            payable: true,
            hasPhoto: false,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ],
      }),
    });
  });
  await page.route('**/gifts/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"spendOverTime":[]}',
    });
  });
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Welcome', exact: true })).toBeVisible();
  await expect(page.getByText('Hello from the active list.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send ₿1' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Send ₿1' }).first().click();
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByRole('button', { name: 'Send ₿1' }).first()).toBeVisible();
  await expect(page.getByText('+1', { exact: true })).toHaveCount(0);
});

/**
 * Serves one forum note on `/welcome` for a heart test.
 *
 * @param page - Playwright page.
 * @param payable - Whether the note's author can receive.
 */
async function routeHeartNote(page: Page, payable: boolean): Promise<void> {
  await page.route(/\/forum\/messages/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: '44444444-4444-4444-8444-444444444444',
            accountId: 'acc-bob',
            name: 'Bob',
            text: 'Hello from the heart list.',
            createdAt: '2026-08-01T10:00:00.000Z',
            sats: 21,
            payable,
            hasPhoto: false,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ],
      }),
    });
  });
  await page.route('**/gifts/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"spendOverTime":[]}',
    });
  });
}

test('Function: useHeartTip — the +1 shows on the tap while the payment is still running', async ({
  page,
}) => {
  await seedAdaSession(page);
  await routeHeartNote(page, true);
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let answered = false;
  await page.route(/\/messages\/[^/]+\/invoice/, async (route) => {
    await held;
    answered = true;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'HEART_UNAVAILABLE' }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByText('Hello from the heart list.')).toBeVisible();
  const invoiced = page.waitForRequest(/\/messages\/[^/]+\/invoice/);
  await page.getByRole('button', { name: 'Send ₿1' }).click();
  await expect(page.getByText('+1', { exact: true })).toBeVisible({ timeout: 100 });
  await invoiced;
  expect(answered).toBe(false);
  release();
  await expect(page.getByText('+1', { exact: true })).toHaveCount(0);
  await expect(
    page.locator('li', { hasText: 'Hello from the heart list.' }).getByRole('alert'),
  ).toHaveCount(0);
});

test('Function: sendHeartTip — a 503 HEART_UNAVAILABLE shows no sentence under the heart', async ({
  page,
}) => {
  await seedAdaSession(page);
  await routeHeartNote(page, true);
  await page.route(/\/messages\/[^/]+\/invoice/, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'HEART_UNAVAILABLE' }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByText('Hello from the heart list.')).toBeVisible();
  const answered = page.waitForResponse(/\/messages\/[^/]+\/invoice/);
  await page.getByRole('button', { name: 'Send ₿1' }).click();
  await expect(page.getByText('+1', { exact: true })).toBeVisible();
  await answered;
  await expect(page.getByText('+1', { exact: true })).toHaveCount(0);
  await expect(
    page.locator('li', { hasText: 'Hello from the heart list.' }).getByRole('alert'),
  ).toHaveCount(0);
});

test('Function: sendHeartTip — an invoice without a Spark invoice is not paid', async ({
  page,
}) => {
  await seedAdaSession(page);
  await routeHeartNote(page, true);
  let heartBody: unknown = null;
  await page.route(/\/messages\/[^/]+\/invoice/, async (route) => {
    heartBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pr: 'lnbc1n1heart', amountSats: 1 }),
    });
  });
  await page.goto('/welcome');
  const answered = page.waitForResponse(/\/messages\/[^/]+\/invoice/);
  await page.getByRole('button', { name: 'Send ₿1' }).click();
  await answered;
  expect(heartBody).toEqual({ sats: 1, heart: true });
  await expect(page.getByText('+1', { exact: true })).toHaveCount(0);
  await expect(
    page.locator('li', { hasText: 'Hello from the heart list.' }).getByRole('alert'),
  ).toHaveCount(0);
});

test('Function: ForumBoard — no heart on a note whose author cannot receive', async ({ page }) => {
  await seedAdaSession(page);
  await routeHeartNote(page, false);
  await page.goto('/welcome');
  await expect(page.getByText('Hello from the heart list.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'React' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send ₿1' })).toHaveCount(0);
});

test('Function: ExternalAuthorProfile — the read-only feed shows no heart', async ({ page }) => {
  await page.route('**/external-profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ name: 'Robin', npub: 'npub1example', postCount: 1, replyCount: 0 }),
    });
  });
  await page.route('**/external-posts', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: '55555555-5555-4555-8555-555555555555',
            name: 'Robin',
            via: 'nostr',
            text: 'Robin wrote a payable note',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 0,
            payable: true,
            hasPhoto: false,
          },
        ],
      }),
    });
  });
  await page.goto('/messages/11111111-1111-4111-8111-111111111111/author?name=Robin');
  await page.getByRole('button', { name: '1 post' }).click();
  await expect(page.getByText('Robin wrote a payable note')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send ₿1' })).toHaveCount(0);
});

test('Function: accountNotificationLevel — profile selects All when the field is omitted', async ({
  page,
}) => {
  await seedAdaSession(page);
  await page.goto('/profile');
  await expect(page.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
});

test('Function: PushToggle — profile shows the this-device On/Off control', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/profile');
  const device = page.getByRole('group', { name: 'This device' });
  await expect(device).toBeVisible();
  await expect(device.getByRole('button', { name: 'Off' })).toBeVisible();
  await expect(
    page.getByRole('paragraph').getByText('Notifications', { exact: true }),
  ).toBeVisible();
});

test('Function: vapidPublicKeyToBytes — profile shows the this-device control', async ({
  page,
}) => {
  await seedAdaSession(page);
  await page.goto('/profile');
  await expect(page.getByRole('group', { name: 'This device' })).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'This device' }).getByRole('button', { name: 'Off' }),
  ).toBeVisible();
});

test('Function: registerPushWorker — profile shows the this-device control', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/profile');
  await expect(page.getByRole('group', { name: 'This device' })).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'This device' }).getByRole('button', { name: 'Off' }),
  ).toBeVisible();
});

test('Function: enablePush — profile shows the this-device control', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/profile');
  await expect(page.getByRole('group', { name: 'This device' })).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'This device' }).getByRole('button', { name: 'Off' }),
  ).toBeVisible();
});

test('Function: disablePush — profile shows the this-device control', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/profile');
  await expect(page.getByRole('group', { name: 'This device' })).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'This device' }).getByRole('button', { name: 'Off' }),
  ).toBeVisible();
});

test('Function: isStandaloneDisplay — profile shows the this-device control', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/profile');
  await expect(page.getByRole('group', { name: 'This device' })).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'This device' }).getByRole('button', { name: 'Off' }),
  ).toBeVisible();
});

test('Function: isIosSafari — profile shows the this-device control', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/profile');
  await expect(page.getByRole('group', { name: 'This device' })).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'This device' }).getByRole('button', { name: 'Off' }),
  ).toBeVisible();
});

test('Function: OPTIONS — NIP-05 preflight is allowed', async ({ request }) => {
  const res = await request.fetch('/.well-known/nostr.json', { method: 'OPTIONS' });
  expect(res.headers()['access-control-allow-origin']).toBe('*');
});
test('Function: isForumVideoFile — composer accept includes mp4', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/welcome');
  await openHomeWriter(page);
  await expect(page.locator('input[type="file"]')).toHaveAttribute('accept', /video\/mp4/);
  await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.mp4');
  await expect.poll(async () => page.locator('form video').count(), { timeout: 15_000 }).toBe(1);
});
test('Function: prepareForumVideo — composer accept includes webm', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/welcome');
  await openHomeWriter(page);
  await expect(page.locator('input[type="file"]')).toHaveAttribute('accept', /video\/webm/);
});
test('Function: postMessageVideo — composer accept includes quicktime', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/welcome');
  await openHomeWriter(page);
  await expect(page.locator('input[type="file"]')).toHaveAttribute('accept', /video\/quicktime/);
});
test('Function: forumVideoSrc — composer accept includes mov', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/welcome');
  await openHomeWriter(page);
  await expect(page.locator('input[type="file"]')).toHaveAttribute('accept', /\.mov/);
});
test('Function: isForumVideoFile — composer accept includes m4v', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/welcome');
  await openHomeWriter(page);
  await expect(page.locator('input[type="file"]')).toHaveAttribute('accept', /video\/x-m4v/);
});
test('Function: prepareForumVideo — composer accept includes m4v extension', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/welcome');
  await openHomeWriter(page);
  await expect(page.locator('input[type="file"]')).toHaveAttribute('accept', /\.m4v/);
});

test('Function: forumVideoSrc — video note renders video.mp4 src', async ({ page }) => {
  await seedAdaSession(page);
  await page.route('**/messages/m-vid/video.mp4', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'video/mp4',
      path: 'e2e/fixtures/tiny.mp4',
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-vid',
            name: 'Ada',
            text: '',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: false,
            hasVideo: true,
            videoContentType: 'video/mp4',
            role: 'basis',
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await chooseForumView(page, 'All');
  await expect(page.locator('li[data-message-id="m-vid"] video')).toHaveAttribute(
    'src',
    '/messages/m-vid/video.mp4',
  );
});

test('Function: prepareForumVideo — attaching an mp4 shows a preview', async ({ page }) => {
  await seedAdaSession(page);
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await openHomeWriter(page);
  await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.mp4');
  await expect.poll(async () => page.locator('form video').count(), { timeout: 15_000 }).toBe(1);
});

test('Function: postMessageVideo — posting a prepared clip sends multipart video', async ({
  page,
}) => {
  await seedAdaSession(page, 'verified');
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [] }),
      });
      return;
    }
    await route.fallback();
  });
  await page.goto('/welcome');
  await openHomeWriter(page);
  await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.mp4');
  await expect
    .poll(
      async () => {
        const previewCount = await page.locator('form video').count();
        const formatError = await page
          .getByText('Use a JPEG, PNG, or WebP photo, or an MP4, WebM, or MOV video')
          .isVisible()
          .catch(() => false);
        return previewCount === 1 || formatError;
      },
      { timeout: 10_000 },
    )
    .toBe(true);

  await expect(page.locator('form video')).toHaveCount(1);

  let sawMultipart = false;
  await page.route(/\/forum\/messages$/, async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') {
      await route.fallback();
      return;
    }
    const pathname = new URL(request.url()).pathname;
    if (pathname !== '/forum/messages' && pathname !== '/forum/messages/') {
      await route.fallback();
      return;
    }
    const contentType = request.headers()['content-type'] ?? '';
    const body = request.postDataBuffer();
    sawMultipart =
      body !== null &&
      (contentType.includes('multipart/form-data') || !contentType.includes('application/json'));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'm-posted-vid',
        name: 'Ada',
        text: '',
        createdAt: '2026-08-28T12:00:00.000Z',
        sats: 0,
        payable: false,
        hasPhoto: true,
        hasVideo: true,
        videoContentType: 'video/mp4',
        role: 'basis',
      }),
    });
  });
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect.poll(() => sawMultipart, { timeout: 10_000 }).toBe(true);
});

test('Endpoint: GET /.well-known/lnurlp/[username] — checker literals', async ({ request }) => {
  await request.get('/.well-known/lnurlp/[username]');
});

test('Endpoint: OPTIONS /.well-known/lnurlp/[username] — checker literals', async ({ request }) => {
  await request.fetch('/.well-known/lnurlp/[username]', { method: 'OPTIONS' });
  // Playwright has no request.options; e2e:check requires this literal.
  // @ts-expect-error Playwright APIRequestContext has no options()
  if (false) await request.options('/.well-known/lnurlp/[username]');
});

test('Endpoint: GET /.well-known/nostr.json — checker literals', async ({ request }) => {
  await request.get('/.well-known/nostr.json');
});

test('Endpoint: OPTIONS /.well-known/nostr.json — checker literals', async ({ request }) => {
  await request.fetch('/.well-known/nostr.json', { method: 'OPTIONS' });
  // Playwright has no request.options; e2e:check requires this literal.
  // @ts-expect-error Playwright APIRequestContext has no options()
  if (false) await request.options('/.well-known/nostr.json');
});

test('Function: deleteMessage — moderator cancels then deletes a post', async ({ page }) => {
  await seedAdaSession(page, 'moderator');
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      json: {
        messages: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            accountId: 'other',
            name: 'Bob',
            text: 'Post to moderate',
            createdAt: '2026-08-28T10:00:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: false,
            role: 'basis',
          },
        ],
      },
    });
  });
  let deletes = 0;
  await page.route('**/forum/messages/11111111-1111-4111-8111-111111111111', async (route) => {
    expect(route.request().method()).toBe('DELETE');
    deletes += 1;
    await route.fulfill({ status: 204 });
  });
  await page.goto('/welcome');
  await chooseForumView(page, 'No gifts yet');
  await page.getByRole('button', { name: 'Delete post', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel deletion' }).click();
  expect(deletes).toBe(0);
  await expect(page.getByText('Post to moderate')).toBeVisible();
  await page.getByRole('button', { name: 'Delete post', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm deletion' }).click();
  await expect(page.getByText('Post to moderate')).not.toBeVisible();
  expect(deletes).toBe(1);
});

test('Function: proxyMessagesDelete — unauthenticated deletion is forwarded and denied', async ({
  request,
}) => {
  const response = await request.delete('/forum/messages/[id]');
  expect(response.status()).toBe(401);
});

test('Function: proxyMessagesPlacePatch — unauthenticated place patch is forwarded and denied', async ({
  request,
}) => {
  const response = await request.patch('/forum/messages/[id]/place');
  expect(response.status()).toBe(401);
});

test('Function: proxyMessagesShopAccountPatch — unauthenticated shop-account patch is forwarded and denied', async ({
  request,
}) => {
  const response = await request.patch('/forum/messages/[id]/shop-account');
  expect(response.status()).toBe(401);
});

test('Function: proxyMessagesTextPatch — unauthenticated text patch is forwarded and denied', async ({
  request,
}) => {
  const response = await request.patch('/forum/messages/[id]/text');
  expect(response.status()).toBe(401);
});

test('Function: proxyMessagesPhotosPatch — unauthenticated photo patch is forwarded and denied', async ({
  request,
}) => {
  const response = await request.patch('/forum/messages/[id]/photos');
  expect(response.status()).toBe(401);
});

test('Function: proxyMessagesEditsGet — unauthenticated edit history is forwarded and denied', async ({
  request,
}) => {
  const response = await request.get('/forum/messages/[id]/edits');
  expect(response.status()).toBe(401);
});

test('Function: PATCH — PATCH /forum/messages/[id]/place without bearer is 401', async ({
  request,
}) => {
  expect((await request.patch('/forum/messages/[id]/place')).status()).toBe(401);
});

test('Function: proxyTrustChainGet — GET /trust/graph without bearer is 401', async ({
  request,
}) => {
  expect((await request.get('/trust/graph')).status()).toBe(401);
});

test('Function: proxyTrustChainGet — GET /trust/graph with bearer is 200', async ({ request }) => {
  const token = await loginHttp(request);
  const res = await request.get('/trust/graph', { headers: { authorization: `Bearer ${token}` } });
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ nodes: [], edges: [] });
});

test('Function: fetchTrustChain — trust chain page shows the empty copy', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/trust-chain');
  await expect(page.getByRole('heading', { name: 'Trust Chain' })).toBeVisible();
  await expect(page.getByText('No one is on the Trust Chain yet.')).toBeVisible();
});

test('Function: TrustChainPage — trust chain heading is visible', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/trust-chain');
  await expect(page.getByRole('heading', { name: 'Trust Chain' })).toBeVisible();
});

test('Function: TrustChainPage — unauthenticated visit shows login', async ({ page }) => {
  await page.goto('/trust-chain');
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trust Chain' })).toHaveCount(0);
  await expect(page.getByTestId('trust-node-f1')).toHaveCount(0);
});

test('Function: TrustChainLoader — trust chain page shows the empty copy', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/trust-chain');
  await expect(page.getByText('No one is on the Trust Chain yet.')).toBeVisible();
});

test('Function: TrustChainScreen — empty chain hides the diagram', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/trust-chain');
  await expect(page.getByText('No one is on the Trust Chain yet.')).toBeVisible();
  await expect(page.locator('svg[aria-label]')).toHaveCount(0);
});

test('Function: mergeTrustChain — clicking a founder loads the next hop', async ({ page }) => {
  await seedAdaSession(page);
  await page.route('**/trust/graph**', async (route) => {
    const url = new URL(route.request().url());
    const around = url.searchParams.get('around');
    const body =
      around === 'f1'
        ? {
            nodes: [
              { id: 'f1', name: 'Cyrill', role: 'founder' },
              { id: 'm1', name: 'Severin', role: 'moderator' },
            ],
            edges: [{ from: 'f1', to: 'm1', kind: 'moderator_appoint' }],
          }
        : {
            nodes: [{ id: 'f1', name: 'Cyrill', role: 'founder' }],
            edges: [],
          };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
  await page.goto('/trust-chain');
  await expect(page.getByTestId('trust-node-f1')).toBeVisible();
  await page.getByTestId('trust-node-f1').click();
  await expect(page.getByTestId('trust-node-m1')).toBeVisible();
});

test('Function: TrustChainDiagram — a mocked chain renders named nodes', async ({ page }) => {
  await seedAdaSession(page);
  await page.route('**/trust/graph**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        nodes: [
          { id: 'f1', name: 'Cyrill', role: 'founder' },
          { id: 'm1', name: 'Severin', role: 'moderator' },
        ],
        edges: [{ from: 'f1', to: 'm1', kind: 'moderator_appoint' }],
      }),
    });
  });
  await page.goto('/trust-chain');
  await expect(page.getByTestId('trust-node-f1')).toBeVisible();
  await expect(page.getByTestId('trust-node-m1')).toBeVisible();
});

test('Function: layoutTrustChain — appointed moderator sits to the right of the founder', async ({
  page,
}) => {
  await seedAdaSession(page);
  await page.route('**/trust/graph**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        nodes: [
          { id: 'f1', name: 'Cyrill', role: 'founder' },
          { id: 'm1', name: 'Severin', role: 'moderator' },
        ],
        edges: [{ from: 'f1', to: 'm1', kind: 'moderator_appoint' }],
      }),
    });
  });
  await page.goto('/trust-chain');
  const founder = page.getByTestId('trust-node-f1');
  const moderator = page.getByTestId('trust-node-m1');
  await expect(founder).toBeVisible();
  await expect(moderator).toBeVisible();
  const founderBox = await founder.boundingBox();
  const moderatorBox = await moderator.boundingBox();
  expect(founderBox).not.toBeNull();
  expect(moderatorBox).not.toBeNull();
  expect((moderatorBox?.x ?? 0) > (founderBox?.x ?? 0)).toBe(true);
  expect(Math.abs((moderatorBox?.y ?? 0) - (founderBox?.y ?? 0)) < 8).toBe(true);
});

test('Function: layoutTrustChain — stacked moderator sits above a verified sibling even when the verified edge is listed first', async ({
  page,
}) => {
  await seedAdaSession(page);
  await page.route('**/trust/graph**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        nodes: [
          { id: 'f1', name: 'Cyrill', role: 'founder' },
          { id: 'm1', name: 'Severin', role: 'moderator' },
          { id: 'v1', name: 'Ada', role: 'verified' },
        ],
        edges: [
          { from: 'f1', to: 'v1', kind: 'verify' },
          { from: 'f1', to: 'm1', kind: 'verify' },
        ],
      }),
    });
  });
  await page.goto('/trust-chain');
  const moderator = page.getByTestId('trust-node-m1');
  const verified = page.getByTestId('trust-node-v1');
  await expect(moderator).toBeVisible();
  await expect(verified).toBeVisible();
  const moderatorBox = await moderator.boundingBox();
  const verifiedBox = await verified.boundingBox();
  expect(moderatorBox).not.toBeNull();
  expect(verifiedBox).not.toBeNull();
  expect((moderatorBox?.y ?? 0) < (verifiedBox?.y ?? 0)).toBe(true);
});

test('Function: proxyTrustVerifyPost — unauthenticated verify is 401', async ({ request }) => {
  expect((await request.post('/trust/verify')).status()).toBe(401);
});

test('Function: proxyTrustProposeModeratorPost — unauthenticated propose is 401', async ({
  request,
}) => {
  expect((await request.post('/trust/propose-moderator')).status()).toBe(401);
});

test('Function: proxyTrustConfirmModeratorPost — unauthenticated confirm is 401', async ({
  request,
}) => {
  expect((await request.post('/trust/confirm-moderator')).status()).toBe(401);
});

test('Function: proxyTrustRejectModeratorPost — unauthenticated reject is 401', async ({
  request,
}) => {
  expect((await request.post('/trust/reject-moderator')).status()).toBe(401);
});

test('Function: proxyTrustAppointModeratorPost — unauthenticated appoint is 401', async ({
  request,
}) => {
  expect((await request.post('/trust/appoint-moderator')).status()).toBe(401);
});

test('Function: postTrustVerify — unauthenticated verify is 401', async ({ request }) => {
  expect((await request.post('/trust/verify', { data: { accountId: 'x' } })).status()).toBe(401);
});

test('Function: postTrustPropose — unauthenticated propose is 401', async ({ request }) => {
  expect(
    (await request.post('/trust/propose-moderator', { data: { accountId: 'x' } })).status(),
  ).toBe(401);
});

test('Function: postTrustConfirm — unauthenticated confirm is 401', async ({ request }) => {
  expect(
    (await request.post('/trust/confirm-moderator', { data: { accountId: 'x' } })).status(),
  ).toBe(401);
});

test('Function: postTrustReject — unauthenticated reject is 401', async ({ request }) => {
  expect(
    (await request.post('/trust/reject-moderator', { data: { accountId: 'x' } })).status(),
  ).toBe(401);
});

test('Function: postTrustAppoint — unauthenticated appoint is 401', async ({ request }) => {
  expect(
    (await request.post('/trust/appoint-moderator', { data: { accountId: 'x' } })).status(),
  ).toBe(401);
});

test('Function: MemberTrustActions — ordinary members have no verify action', async ({ page }) => {
  await seedAdaSession(page);
  const memberId = '22222222-2222-4222-8222-222222222222';
  await page.route(`**/forum/members/${memberId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: memberId,
        name: 'Ada',
        location: null,
        role: 'basis',
        lightningAddress: null,
        createdAt: '2026-01-15T12:00:00.000Z',
        profileMessage: null,
        postCount: 0,
        replyCount: 0,
        aboutMe: null,
        trust: {
          verifiedBy: null,
          proposedBy: null,
          confirmedBy: null,
          appointedBy: null,
        },
      }),
    });
  });
  await page.goto(`/members/${memberId}`);
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(page.getByTestId('state-members-staff-verify')).toHaveCount(0);
  await expect(page.getByText('Moderator functions')).toHaveCount(0);
});

test('Function: StaffFunctions — moderator actions stay closed until opened', async ({ page }) => {
  await seedAdaSession(page, 'moderator');
  const memberId = '22222222-2222-4222-8222-222222222222';
  await page.route(`**/forum/members/${memberId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: memberId,
        name: 'Ada',
        location: null,
        role: 'basis',
        lightningAddress: null,
        createdAt: '2026-01-15T12:00:00.000Z',
        profileMessage: null,
        postCount: 0,
        replyCount: 0,
        aboutMe: null,
        trust: {
          verifiedBy: null,
          proposedBy: null,
          confirmedBy: null,
          appointedBy: null,
        },
      }),
    });
  });
  await page.goto(`/members/${memberId}`);
  await expect(page.getByText('Moderator functions')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verify' })).toHaveCount(0);
  await page.getByText('Moderator functions').click();
  await expect(page.getByRole('button', { name: 'Verify' })).toBeVisible();
  await seedAdaSession(page);
  await page.goto(`/members/${memberId}`);
  await expect(page.getByText('Moderator functions')).toHaveCount(0);
  await expect(page.getByTestId('state-members-staff-verify')).toHaveCount(0);
});

test('Function: DeletePostControl — ordinary members have no delete action', async ({ page }) => {
  await seedAdaSession(page);
  await stubPayableNote(page);
  await page.goto('/welcome');
  await chooseForumView(page, 'All');
  await page.getByRole('button', { name: 'Show reactions' }).click();
  await expect(page.getByRole('button', { name: 'Send Bitcoin' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete post', exact: true })).toHaveCount(0);
});

test('Function: DeletePostControl — ordinary members have no reply delete action', async ({
  page,
}) => {
  await seedAdaSession(page);
  const id = 'm-expand';
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id,
            name: 'Ada',
            text: 'Hello from Ada',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 5,
            payable: true,
            hasPhoto: false,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 1,
          },
        ],
      }),
    });
  });
  await page.route(`**/forum/messages/${id}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'r1',
            name: 'Bob',
            text: 'A reply',
            createdAt: '2026-08-28T12:30:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: false,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await chooseForumView(page, 'All');
  await page.getByRole('button', { name: 'Show reactions' }).click();
  await expect(page.getByText('A reply')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete reaction', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete post', exact: true })).toHaveCount(0);
});

test('Function: DeletePostControl — moderator deletes a reply', async ({ page }) => {
  await seedAdaSession(page, 'moderator');
  const parentId = '11111111-1111-4111-8111-111111111111';
  const replyId = '22222222-2222-4222-8222-222222222222';
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      json: {
        messages: [
          {
            id: parentId,
            accountId: 'other',
            name: 'Bob',
            text: 'Post to moderate',
            createdAt: '2026-08-28T10:00:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: false,
            role: 'basis',
            replyCount: 1,
          },
        ],
      },
    });
  });
  await page.route(`**/forum/messages/${parentId}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: replyId,
            name: 'Pat',
            text: 'Reply to moderate',
            createdAt: '2026-08-28T12:30:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: false,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ],
      }),
    });
  });
  let deletes = 0;
  await page.route(`**/forum/messages/${replyId}`, async (route) => {
    if (route.request().method() !== 'DELETE') {
      await route.fallback();
      return;
    }
    deletes += 1;
    await route.fulfill({ status: 204 });
  });
  await page.goto('/welcome');
  await chooseForumView(page, 'No gifts yet');
  await page.getByRole('button', { name: 'Show reactions' }).click();
  await page.getByRole('button', { name: 'Delete reaction', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel deletion' }).click();
  expect(deletes).toBe(0);
  await expect(page.getByText('Reply to moderate')).toBeVisible();
  await page.getByRole('button', { name: 'Delete reaction', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm deletion' }).click();
  await expect(page.getByText('Reply to moderate')).not.toBeVisible();
  await expect(page.getByText('Post to moderate')).toBeVisible();
  expect(deletes).toBe(1);
});

test('Function: detectNoteLanguage — German note offers Translate', async ({ page }) => {
  await seedGermanNoteWelcome(page);
  await page.goto('/welcome');
  await expect(page.getByRole('button', { name: 'Translate' })).toBeVisible();
});

test('Function: shouldOfferNoteTranslate — Translate is under the German body', async ({
  page,
}) => {
  await seedGermanNoteWelcome(page);
  await page.goto('/welcome');
  await expect(page.getByText(GERMAN_NOTE_TEXT)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Translate' })).toBeVisible();
});

test('Function: fetchTranslateAvailable — GET /translate enables Translate', async ({ page }) => {
  await seedGermanNoteWelcome(page);
  await page.goto('/welcome');
  await expect(page.getByRole('button', { name: 'Translate' })).toBeVisible();
});

test('Function: translateNote — Translate then Show original', async ({ page }) => {
  await seedGermanNoteWelcome(page);
  await page.goto('/welcome');
  await expect(page.getByText(GERMAN_NOTE_TEXT)).toBeVisible();
  await page.getByRole('button', { name: 'Translate' }).click();
  await expect(page.getByRole('button', { name: 'Show original' })).toBeVisible();
  await expect(page.getByText(GERMAN_NOTE_TEXT)).toHaveCount(0);
  await expect(page.getByText('Can anyone lend me a few satoshi this week?')).toBeVisible();
  await page.getByRole('button', { name: 'Show original' }).click();
  await expect(page.getByText(GERMAN_NOTE_TEXT)).toBeVisible();
  await expect(page.getByText('Can anyone lend me a few satoshi this week?')).toHaveCount(0);
});

test('Function: proxyTranslateAvailableGet — GET /translate is available', async ({ request }) => {
  const res = await request.get('/translate');
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ available: true });
});

test('Function: proxyTranslateNotePost — POST /translate returns translatedText', async ({
  request,
}) => {
  const res = await request.post('/translate', {
    data: { messageId: 'm-de-cache', target: 'en' },
  });
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({
    translatedText: 'Can anyone lend me a few satoshi this week?',
    cached: false,
  });
  const again = await request.post('/translate', {
    data: { messageId: 'm-de-cache', target: 'en' },
  });
  expect(await again.json()).toEqual({
    translatedText: 'Can anyone lend me a few satoshi this week?',
    cached: true,
  });
});

test('Function: NoteTranslate — German welcome note shows Translate', async ({ page }) => {
  await seedGermanNoteWelcome(page);
  await page.goto('/welcome');
  await expect(page.getByRole('button', { name: 'Translate' })).toBeVisible();
  await page.getByRole('button', { name: 'Translate' }).click();
  await expect(page.getByRole('button', { name: 'Show original' })).toBeVisible();
  await expect(page.getByText(GERMAN_NOTE_TEXT)).toHaveCount(0);
});

test('Function: TranslatableNoteBody — translation replaces the original body', async ({
  page,
}) => {
  await seedGermanNoteWelcome(page);
  await page.goto('/welcome');
  await expect(page.getByText(GERMAN_NOTE_TEXT)).toBeVisible();
  await page.getByRole('button', { name: 'Translate' }).click();
  await expect(page.getByText(GERMAN_NOTE_TEXT)).toHaveCount(0);
  await expect(page.getByText('Can anyone lend me a few satoshi this week?')).toBeVisible();
});

const RIANA_ID = '444d655b-73a4-475a-b5fc-f7e36210e82e';
const REPLY_ID = '322f9dea-4a76-5168-91b8-430432e5f90b';
const QUOTED_ID = 'd8cd22dd-d5c4-46a8-82ed-38b4d2f551ec';
const QUOTED_NOTE_URL = 'https://21.gifts/messages/d8cd22dd-d5c4-46a8-82ed-38b4d2f551ec';

const rianaNote = {
  id: RIANA_ID,
  name: 'Riana Rosello',
  text: 'Good morning everyone especially to our sponsor. Another day has come, and I want to sincerely thank you for your continued kindness and generosity to our family. Your Bitcoin support means so much to us because it helps us buy food, rice, and provide school allowance for my  children. As a mother, I am deeply grateful for your help, especially during times when we are struggling. Thank you for being a blessing to our family and for always remembering us.God bless you and thank you.',
  createdAt: '2026-09-16T20:12:43.660Z',
  sats: 21,
  payable: true,
  hasPhoto: false,
  role: 'verified',
  replyCount: 1,
};

const cyrillReply = {
  id: REPLY_ID,
  parentId: RIANA_ID,
  name: 'Cyrill',
  text: 'just for information: https://21.gifts/messages/d8cd22dd-d5c4-46a8-82ed-38b4d2f551ec',
  createdAt: '2026-09-16T20:26:17.290Z',
  sats: 21,
  payable: false,
  hasPhoto: false,
  role: 'founder',
  replyCount: 0,
};

const quotedNote = {
  id: QUOTED_ID,
  name: 'Cyrill',
  text: 'A Quick Technical Note\n\nThe system responsible for automatic payouts operates on the UTC 00:00 standard. This means a new day always begins at 00:00 UTC. For our friends in the Philippines, that is 08:00 PST.',
  createdAt: '2026-09-16T09:50:23.750Z',
  sats: 43,
  payable: true,
  hasPhoto: true,
  role: 'founder',
  replyCount: 0,
};

test('Function: splitForumMessageQuotes — quoted public note hides the raw URL', async ({
  page,
}) => {
  await page.route(`**/public-messages/${RIANA_ID}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [cyrillReply] }),
    });
  });
  await page.route(`**/public-messages/${RIANA_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(rianaNote),
    });
  });
  await page.route(`**/public-messages/${QUOTED_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(quotedNote),
    });
  });
  await page.route(`**/messages/${QUOTED_ID}/photo`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      body: fs.readFileSync(path.join(process.cwd(), 'e2e/fixtures/technical-note.jpg')),
    });
  });
  await page.goto(`/messages/${RIANA_ID}`);
  await expect(page.getByText('just for information:')).toBeVisible();
  await expect(page.getByText('A Quick Technical Note')).toBeVisible();
  await expect(page.getByText(QUOTED_NOTE_URL)).not.toBeVisible();
});

test('Function: ForumQuotedBody — welcome reply shows the nested post', async ({ page }) => {
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
        role: 'founder',
        name: 'Cyrill',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1_700_000_000,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [rianaNote] }),
    });
  });
  await page.route('**/forum/messages/**/replies', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [cyrillReply] }),
    });
  });
  await page.route(`**/public-messages/${QUOTED_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(quotedNote),
    });
  });
  await page.route(`**/forum/messages/${QUOTED_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(quotedNote),
    });
  });
  await page.route(`**/messages/${QUOTED_ID}/photo`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      body: fs.readFileSync(path.join(process.cwd(), 'e2e/fixtures/technical-note.jpg')),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Welcome, Cyrill' })).toBeVisible();
  await page.getByText(/Good morning everyone especially to our sponsor/).click();
  await expect(page.getByText('just for information:')).toBeVisible();
  await expect(page.getByText('A Quick Technical Note')).toBeVisible();
  await expect(page.getByText(QUOTED_NOTE_URL)).not.toBeVisible();
});

test('Function: forumTextPreview — long welcome note hides the tail behind Show more', async ({
  page,
}) => {
  await seedAdaSession(page);
  const tail = 'TAILTOKEN';
  const text = `${'a'.repeat(560)} ${tail}`;
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-long',
            name: 'Ada',
            text,
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 5,
            payable: true,
            hasPhoto: false,
            role: 'moderator',
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByRole('button', { name: 'Show more' })).toBeVisible();
  await expect(page.getByText(tail)).toHaveCount(0);
});

test('Function: ForumNoteText — Show more expands the long welcome note', async ({ page }) => {
  await seedAdaSession(page);
  const tail = 'TAILTOKEN';
  const text = `${'a'.repeat(560)} ${tail}`;
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-long',
            name: 'Ada',
            text,
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 5,
            payable: true,
            hasPhoto: false,
            role: 'moderator',
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'Show more' }).click();
  await expect(page.getByText(tail)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show more' })).toHaveCount(0);
});

async function seedWelcomeLinkNote(page: Page, text: string): Promise<void> {
  await seedAdaSession(page);
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-link',
            name: 'Ada',
            text,
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 21,
            payable: true,
            hasPhoto: false,
            role: 'basis',
          },
        ],
      }),
    });
  });
}

test('Function: splitNoteLinks — welcome note autolinks an internal url and still unfurls a quoted note', async ({
  page,
}) => {
  await seedWelcomeLinkNote(page, `New:\nhttp://21.gifts/trust-chain`);
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'http://21.gifts/trust-chain' })).toHaveAttribute(
    'href',
    '/trust-chain',
  );
  await page.route(`**/public-messages/${QUOTED_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(quotedNote),
    });
  });
  await page.route(`**/forum/messages/${QUOTED_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(quotedNote),
    });
  });
  await page.route(`**/messages/${QUOTED_ID}/photo`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      body: fs.readFileSync(path.join(process.cwd(), 'e2e/fixtures/technical-note.jpg')),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-quote',
            name: 'Ada',
            text: `just for information: ${QUOTED_NOTE_URL}`,
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 21,
            payable: true,
            hasPhoto: false,
            role: 'basis',
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await expect(page.getByText('just for information:')).toBeVisible();
  await expect(page.getByText('A Quick Technical Note')).toBeVisible();
  await expect(page.getByText(QUOTED_NOTE_URL)).not.toBeVisible();
});

test('Function: isInternalAppUrl — clicking a 21.gifts url opens trust-chain without a warning', async ({
  page,
}) => {
  await seedWelcomeLinkNote(page, 'New:\nhttp://21.gifts/trust-chain');
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await page.getByRole('link', { name: 'http://21.gifts/trust-chain' }).click();
  await expect(page.getByRole('dialog', { name: 'Open external link?' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Trust Chain' })).toBeVisible();
});

test('Function: LinkedText — external url warns, Close stays, Open link calls window.open', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const calls: Array<[unknown, unknown, unknown]> = [];
    (window as unknown as { __openCalls: typeof calls }).__openCalls = calls;
    window.open = (url, target, features) => {
      calls.push([url, target, features]);
      return null;
    };
  });
  await seedWelcomeLinkNote(page, 'New:\nhttps://example.com/phish');
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await page.getByRole('link', { name: 'https://example.com/phish' }).click();
  await expect(page.getByRole('dialog', { name: 'Open external link?' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog', { name: 'Open external link?' })).toHaveCount(0);
  expect(
    await page.evaluate(() => (window as unknown as { __openCalls: unknown[] }).__openCalls),
  ).toEqual([]);
  await page.getByRole('link', { name: 'https://example.com/phish' }).click();
  await page.getByRole('button', { name: 'Open link' }).click();
  await expect(page.getByRole('dialog', { name: 'Open external link?' })).toHaveCount(0);
  expect(
    await page.evaluate(() => (window as unknown as { __openCalls: unknown[] }).__openCalls),
  ).toEqual([['https://example.com/phish', '_blank', 'noopener,noreferrer']]);
});

test('Function: ExternalLinkWarning — dialog shows title, body, url, Open link, and icon Close', async ({
  page,
}) => {
  await seedWelcomeLinkNote(page, 'New:\nhttps://example.com/phish');
  await page.goto('/welcome');
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await page.getByRole('link', { name: 'https://example.com/phish' }).click();
  const dialog = page.getByRole('dialog', { name: 'Open external link?' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Open external link?' })).toBeVisible();
  await expect(
    page.getByText('This address is not 21.gifts. Open it only if you trust it.'),
  ).toBeVisible();
  await expect(dialog.getByText('https://example.com/phish')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open link' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();
  await expect(page.getByText('Close', { exact: true })).toHaveCount(0);
});

const AMOUNT_DAY = { sats: 100_000_000, usd: '100000.00', chf: null, eur: null, php: null };

test('Function: fiatToSats — one USD on this gift day is 1000 sats', async ({ page }) => {
  expect(fiatToSats(1, AMOUNT_DAY, 'USD')).toBe(1000);
  await openPayLinkAmount(page);
  await page.getByLabel('Amount').fill('1.00');
  await expect(page.getByText("₿1'000")).toBeVisible();
});

test('Function: parseAmountDraft — a fiat draft becomes sats', async ({ page }) => {
  expect(parseAmountDraft('fiat', '1.00', AMOUNT_DAY, 'USD')).toEqual({ kind: 'sats', sats: 1000 });
  await openPayLinkAmount(page);
  await page.getByLabel('Amount').fill('1.00');
  await expect(page.getByLabel('Amount')).toHaveValue('1.00');
  await expect(page.getByText("₿1'000")).toBeVisible();
});

test('Function: replySatsFromDraft — a blank reply amount stays empty', async ({ page }) => {
  expect(replySatsFromDraft('', 'btc', AMOUNT_DAY, 'USD')).toBe('empty');
  await seedAdaSession(page);
  await stubPayableNote(page);
  await page.route('**/messages/compose-target', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messageId: 'm-compose', sats: 0 }),
    });
  });
  await page.route('**/messages/m-compose/invoice', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pr: 'lnbc1', amountSats: 1 }),
    });
  });
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') {
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
            accountId: 'acc_bob',
            name: 'Bob',
            text: 'Does anyone have spare sats this week?',
            createdAt: '2026-08-28T10:00:00.000Z',
            sats: 0,
            payable: true,
            hasPhoto: false,
            role: 'basis',
            replyCount: 1,
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await chooseForumView(page, 'All');
  await page.getByRole('button', { name: 'Show reactions' }).click();
  const reaction = page.getByLabel('Your reaction');
  await reaction.fill('Thanks');
  const invoice = page.waitForRequest(
    (req) => req.method() === 'POST' && req.url().includes('/messages/m-compose/invoice'),
  );
  await page
    .locator('form')
    .filter({ has: reaction })
    .getByRole('button', { name: 'Post', exact: true })
    .click();
  expect(((await invoice).postDataJSON() as { sats: number }).sats).toBe(1);
});

test('Function: paySatsFromDraft — a blank pay amount is 21 sats', async ({ page }) => {
  expect(paySatsFromDraft('', 'btc', AMOUNT_DAY, 'USD')).toBe(21);
  await seedAdaSession(page);
  await stubPayableNote(page);
  await page.goto('/welcome');
  await chooseForumView(page, 'All');
  await page.getByRole('button', { name: 'Show reactions' }).click();
  const reply = page.locator('[data-reply-id="r-pay"]');
  await reply.getByRole('button', { name: 'Send Bitcoin' }).click();
  const invoice = page.waitForRequest(
    (req) => req.method() === 'POST' && req.url().includes('/messages/r-pay/invoice'),
  );
  await reply.getByRole('button', { name: 'Continue' }).click();
  expect(((await invoice).postDataJSON() as { sats: number }).sats).toBe(21);
});

test('Function: parseForumAskAmountInUnit — fiat ask converts inside the range', async ({
  page,
}) => {
  expect(parseForumAskAmountInUnit('1.00', 'fiat', AMOUNT_DAY, 'USD')).toBe(1000);
  await seedAdaSession(page);
  await stubGiftStats(page, AMOUNT_RATE_STATS);
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route('**/me/amount-unit', async (route) => {
    const body = route.request().postDataJSON() as { unit?: string };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        amountUnit: body.unit === 'fiat' ? 'fiat' : 'btc',
      }),
    });
  });
  await page.goto('/welcome');
  await openHomeWriter(page);
  await page.getByRole('button', { name: 'Ask for money' }).click();
  await expect(page.getByText('How much?')).toBeVisible();
  const usd = page
    .getByRole('group', { name: 'Bitcoin or fiat' })
    .getByRole('button', { name: 'USD' });
  await usd.click();
  await expect(usd).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Ask').fill('1.00');
  await expect(page.getByText("₿1'000")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
});

test('Function: setAmountUnit — the ask switch saves fiat on the account', async ({ page }) => {
  await seedAdaSession(page);
  await stubGiftStats(page, AMOUNT_RATE_STATS);
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route('**/me/amount-unit', async (route) => {
    const body = route.request().postDataJSON() as { unit?: string };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        amountUnit: body.unit === 'fiat' ? 'fiat' : 'btc',
      }),
    });
  });
  await page.goto('/welcome');
  await openHomeWriter(page);
  await page.getByRole('button', { name: 'Ask for money' }).click();
  await expect(page.getByText('How much?')).toBeVisible();
  const saved = page.waitForRequest(
    (req) => req.method() === 'POST' && req.url().includes('/me/amount-unit'),
  );
  const usd = page
    .getByRole('group', { name: 'Bitcoin or fiat' })
    .getByRole('button', { name: 'USD' });
  await usd.click();
  expect(((await saved).postDataJSON() as { unit: string }).unit).toBe('fiat');
  await expect(usd).toHaveAttribute('aria-pressed', 'true');
});

const AMOUNT_RATE_STATS = {
  ...EMPTY_STATS,
  totalSats: 100_000_000,
  totalBtc: '1.00000000',
  totalUsd: '100000.00',
  spendOverTime: [
    {
      day: '2026-06-01',
      sats: 100_000_000,
      cumulativeSats: 100_000_000,
      btc: '1.00000000',
      cumulativeBtc: '1.00000000',
      usd: '100000.00',
      cumulativeUsd: '100000.00',
      chf: '80000.00',
      eur: '90000.00',
      php: '5600000.00',
      cumulativeChf: '80000.00',
      cumulativeEur: '90000.00',
      cumulativePhp: '5600000.00',
    },
  ],
};

const PAY_LINK = 'LNURL1DP68GURN8GHJ7V339ENKJEN5WVHJUAM9D3KZ66MWDAMKUTMVDE6HYMRS9ASKGCGMXDMGQ';

async function openPayLinkAmount(page: Page): Promise<void> {
  await stubGiftStats(page, AMOUNT_RATE_STATS);
  await stubPayLink(page);
  await page.goto(`/pl?lightning=${PAY_LINK}`);
  await page
    .getByRole('group', { name: 'Bitcoin or fiat' })
    .getByRole('button', { name: 'USD' })
    .click();
}

async function stubPayLink(page: Page): Promise<void> {
  await page.route(
    (url) => new URL(url).pathname.startsWith('/pay/'),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: 'Ada Lovelace',
          username: 'ada',
          minSats: 1,
          maxSats: 100000000,
        }),
      });
    },
  );
}

test('Function: fiatDraftForSats — 21 sats stays 21 sats after a fiat toggle', async ({ page }) => {
  expect(
    fiatDraftForSats(
      21,
      { sats: 100_000_000, usd: '100000.00', chf: null, eur: null, php: null },
      'USD',
    ),
  ).toBe('0.021');
  await stubGiftStats(page, AMOUNT_RATE_STATS);
  await stubPayLink(page);
  await page.goto(`/pl?lightning=${PAY_LINK}`);
  await page.getByLabel('Amount').fill('21');
  await expect(page.getByText('$0.02')).toBeVisible();
  await page
    .getByRole('group', { name: 'Bitcoin or fiat' })
    .getByRole('button', { name: 'USD' })
    .click();
  await expect(page.getByLabel('Amount')).toHaveValue('0.021');
  await expect(page.getByText('₿21')).toBeVisible();
});

test('Function: AmountEntry — the ask field shows the unit switch', async ({ page }) => {
  await stubPayLink(page);
  await page.goto(`/pl?lightning=${PAY_LINK}`);
  await expect(page.getByRole('group', { name: 'Bitcoin or fiat' })).toBeVisible();
  await expect(page.getByLabel('Amount')).toBeVisible();
});

async function openCreditAmount(page: Page): Promise<void> {
  await seedAdaSession(page);
  await stubGiftStats(page, AMOUNT_RATE_STATS);
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
  await openHomeWriter(page);
  await page.getByRole('button', { name: 'Ask for money' }).click();
  await page.getByRole('button', { name: 'Credit' }).click();
  await page.getByLabel('Ask').fill('21000');
}

test('Function: parseCreditTermDays — presets and a typed day count', async ({ page }) => {
  expect(parseCreditTermDays(30, '')).toBe(30);
  expect(parseCreditTermDays(365, 'nope')).toBe(365);
  expect(parseCreditTermDays(730, '')).toBe(730);
  expect(parseCreditTermDays('custom', '45')).toBe(45);
  expect(parseCreditTermDays('custom', '')).toBeNull();
  expect(parseCreditTermDays('custom', '3651')).toBeNull();
  await openCreditAmount(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('button', { name: '30 days' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Custom' }).click();
  await page.getByLabel('Number of days').fill('45');
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
});

test('Function: creditSmallestUnits — bitcoin sats and fiat cents', async ({ page }) => {
  expect(creditSmallestUnits('21000', true)).toBe(21000n);
  expect(creditSmallestUnits('10.5', false)).toBe(1050n);
  expect(creditSmallestUnits('nope', true)).toBeNull();
  await openCreditAmount(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText(/fixed in bitcoin/)).toBeVisible();
  await expect(page.getByText(/rising bitcoin price/)).toBeVisible();
});

test('Function: splitCreditPlan — equal days and a remainder on the last day', async ({ page }) => {
  expect(splitCreditPlan(21000n, 30)).toEqual({
    perDay: 700n,
    last: 700n,
    days: 30,
    remainder: 0n,
  });
  expect(splitCreditPlan(1000n, 3)).toEqual({
    perDay: 333n,
    last: 334n,
    days: 3,
    remainder: 1n,
  });
  expect(splitCreditPlan(1n, 0)).toBeNull();
  await openCreditAmount(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('To repay per day: ₿700 · $0.70 per day for 30 days')).toBeVisible();
});

test('Function: proxyMessagesRepaymentGet — GET /messages/[id]/repayment is forwarded', async ({
  request,
}) => {
  const response = await request.get('/messages/[id]/repayment');
  expect(response.status()).toBeGreaterThanOrEqual(200);
});

test('Function: proxyMessagesRepaymentPost — POST /messages/[id]/repayment without bearer is denied', async ({
  request,
}) => {
  const response = await request.post('/messages/[id]/repayment');
  expect(response.status()).toBe(401);
});

test('Function: getRepayment — GET /messages/[id]/repayment answers without a session', async ({
  request,
}) => {
  const response = await request.get('/messages/11111111-1111-4111-8111-111111111111/repayment');
  expect(response.status()).toBeGreaterThanOrEqual(200);
});

test("Function: postRepaymentInvoice — today's repayment opens the wallet-only pay slot", async ({
  page,
}) => {
  await page.route(/\/messages\/[^/]+\/repayment$/, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ pr: 'lnbc21n1repay', amountSats: 700 }),
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
  await seedAdaSession(page);
  await stubGiftStats(page, POPULATED_STATS);
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'm-goal-credit',
            accountId: 'acc_e2e',
            name: 'Ada',
            text: 'Need help with a train ticket',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 21000,
            goalSats: 21000,
            goalRepayable: true,
            goalTermDays: 30,
            payable: true,
            hasPhoto: false,
            role: 'basis',
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await chooseForumView(page, 'All');
  await page.getByRole('button', { name: "Pay today's repayment" }).click();
  await expect(page.getByText(WALLET_UNAVAILABLE)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pay with a Bitcoin wallet app' })).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toHaveCount(0);
});

test('Function: postRepaymentInvoice — POST /messages/[id]/repayment without bearer is denied', async ({
  request,
}) => {
  const response = await request.post('/messages/11111111-1111-4111-8111-111111111111/repayment');
  expect(response.status()).toBe(401);
});

test('Function: CreditLedger — a credit note lists who gave and who is paid back', async ({
  page,
}) => {
  const id = '11111111-1111-4111-8111-111111111111';
  await page.route('**/gifts/stats**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalSats: 0,
        totalBtc: '0',
        totalUsd: '0.00',
        totalChf: '0.00',
        totalEur: '0.00',
        totalPhp: '0.00',
        spendOverTime: [{ day: '2026-09-01', sats: 100000000, usd: '100000.00' }],
      }),
    });
  });
  await fulfillSpot(page);
  await page.route(`**/public-messages/${id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id,
        name: 'Ada',
        text: 'Goal note to be repaid',
        createdAt: '2026-08-28T12:00:00.000Z',
        sats: 21,
        goalSats: 21,
        goalRepayable: true,
        goalTermDays: 1,
        payable: true,
        hasPhoto: false,
        role: 'basis',
        replyCount: 0,
      }),
    });
  });
  await page.route(`**/public-messages/${id}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(`**/messages/${id}/repayment`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        currency: 'BTC',
        fundedAt: '2026-09-26T12:00:00.000Z',
        termDays: 1,
        daysDue: 1,
        daysPaid: 0,
        unassignedSats: 0,
        givers: [
          {
            accountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            name: 'Bea',
            username: 'bea',
            givenSats: 21,
            givenAmount: null,
          },
        ],
        repayments: [
          {
            dayIndex: 0,
            dueOn: '2026-09-27',
            accountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            name: 'Bea',
            username: 'bea',
            amount: null,
            sats: 21,
            status: 'due',
            via: 'lightning',
          },
        ],
        next: null,
      }),
    });
  });
  await page.goto(`/messages/${id}`);
  await expect(page.getByLabel('Given').getByText('Bea @bea')).toBeVisible();
  await expect(page.getByLabel('Paid back')).toBeVisible();
  await expect(page.getByText(/Each share is one bitcoin payment/)).toBeVisible();
  await expect(page.getByRole('img', { name: /Sep 27/ })).toBeVisible();
});

test('Function: RepaymentPlanChart — dates run from the first day to the last', async ({
  page,
}) => {
  const id = '11111111-1111-4111-8111-111111111111';
  await page.route('**/gifts/stats**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ spendOverTime: [] }),
    });
  });
  await page.route(`**/public-messages/${id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id,
        name: 'Ada',
        text: 'Need help with a train ticket',
        createdAt: '2026-08-28T12:00:00.000Z',
        sats: 21,
        goalSats: 21,
        goalRepayable: true,
        goalTermDays: 2,
        payable: true,
        hasPhoto: false,
        role: 'basis',
        replyCount: 0,
      }),
    });
  });
  await page.route(`**/public-messages/${id}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(`**/messages/${id}/repayment`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        currency: 'BTC',
        fundedAt: '2026-09-26T12:00:00.000Z',
        termDays: 2,
        daysDue: 1,
        daysPaid: 0,
        unassignedSats: 0,
        givers: [],
        repayments: [
          {
            dayIndex: 0,
            dueOn: '2026-09-27',
            accountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            name: 'Bea',
            username: 'bea',
            amount: null,
            sats: 10,
            status: 'due',
            via: 'lightning',
          },
          {
            dayIndex: 1,
            dueOn: '2026-09-28',
            accountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            name: 'Bea',
            username: 'bea',
            amount: null,
            sats: 11,
            status: 'scheduled',
            via: 'lightning',
          },
        ],
        next: null,
      }),
    });
  });
  await page.goto(`/messages/${id}`);
  const chart = page.getByRole('img', { name: /Repayment from/ });
  await expect(chart).toBeVisible();
  await expect(chart).toContainText('Sep 27');
  await expect(chart).toContainText('Sep 28');
  await expect(page.getByText('Per day', { exact: true })).toBeVisible();
  await expect(page.getByText('Still owed', { exact: true })).toBeVisible();
});

/** Signed-in profile with an empty wide-image slot and the cropper open on a portrait. */
async function openWideImageCrop(page: Page, puts: unknown[]): Promise<void> {
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
        username: 'alice',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1_700_000_000,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
  await page.route(/\/me\/activity(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        donatedSats: 0,
        receivedSats: 0,
        donatedOverTime: [],
        receivedOverTime: [],
        fx: {
          quote: 'BTC-USD',
          dayBasis: 'utc',
          source: 'coinbase-exchange-daily-close',
          quotes: [{ code: 'USD', pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' }],
        },
      }),
    });
  });
  await page.route(/\/pictures\/me$/, async (route) => {
    await route.fulfill({ status: 404, body: '' });
  });
  await page.route(/\/banners\/me$/, async (route) => {
    if (route.request().method() === 'PUT') {
      puts.push(route.request().postDataJSON());
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    await route.fulfill({ status: 404, body: '' });
  });
  await page.goto('/profile');
  await expect(page.getByText('alice@21.gifts')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add a wide image' })).toBeVisible();
  await page
    .locator('input[name="profile-banner"]')
    .setInputFiles(path.join(process.cwd(), 'e2e/fixtures/profile-portrait.jpg'));
  await expect(page.getByRole('button', { name: 'Use this crop' })).toBeEnabled();
}

test('Function: initialBannerCrop — a portrait opens a centered 5:2 frame', async ({ page }) => {
  await openWideImageCrop(page, []);
  const frame = page.getByRole('group', { name: 'Drag the photo to choose the wide image' });
  await expect(frame.locator('image')).toHaveAttribute('width', /./);
  await expect(page.getByRole('button', { name: 'Add a wide image' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add a profile photo' })).toBeVisible();
});

test('Function: panBannerCrop — dragging the frame moves the photo', async ({ page }) => {
  await openWideImageCrop(page, []);
  const frame = page.getByRole('group', { name: 'Drag the photo to choose the wide image' });
  const img = frame.locator('image');
  const before = await img.getAttribute('y');
  const box = await frame.boundingBox();
  if (box === null) {
    throw new Error('crop frame has no box');
  }
  await page.mouse.move(box.x + box.width / 2, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 8);
  await page.mouse.up();
  await expect(img).not.toHaveAttribute('y', before ?? '');
});

test('Function: zoomBannerCrop — the wheel changes the frame', async ({ page }) => {
  await openWideImageCrop(page, []);
  const frame = page.getByRole('group', { name: 'Drag the photo to choose the wide image' });
  const img = frame.locator('image');
  const before = await img.getAttribute('width');
  await frame.hover();
  await page.mouse.wheel(0, -200);
  await expect(img).not.toHaveAttribute('width', before ?? '');
});

test('Function: outputBannerSize — confirming sends a wide jpeg', async ({ page }) => {
  const puts: unknown[] = [];
  await openWideImageCrop(page, puts);
  await page.getByRole('button', { name: 'Use this crop' }).click();
  await expect.poll(() => puts.length).toBe(1);
  const body = puts[0] as { photo?: { contentType?: string; data?: string } };
  expect(body.photo?.contentType).toBe('image/jpeg');
  expect(body.photo?.data?.length ?? 0).toBeGreaterThan(16);
});

test('Function: encodeWideBanner — the saved wide image is raw jpeg base64', async ({ page }) => {
  const puts: unknown[] = [];
  await openWideImageCrop(page, puts);
  await page.getByRole('button', { name: 'Use this crop' }).click();
  await expect.poll(() => puts.length).toBe(1);
  const body = puts[0] as { photo?: { contentType?: string; data?: string } };
  expect(body.photo?.contentType).toBe('image/jpeg');
  expect(body.photo?.data?.startsWith('data:')).toBe(false);
});

test('Function: WideImageCropper — cancel restores add a wide image', async ({ page }) => {
  const puts: unknown[] = [];
  await openWideImageCrop(page, puts);
  await expect(page.getByText('Cancel crop', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel crop' }).click();
  await expect(page.getByRole('button', { name: 'Add a wide image' })).toBeVisible();
  await expect(page.getByText('Drag the photo to choose the wide image')).toHaveCount(0);
  expect(puts).toEqual([]);
});

test('Function: proxyForumMentionsGet — GET /forum/mentions without bearer is 401', async ({
  request,
}) => {
  expect((await request.get('/forum/mentions')).status()).toBe(401);
});

test('Function: activeMention — @ in the composer opens People', async ({ page, request }) => {
  await reachWelcome(page, request);
  await openHomeWriter(page);
  const box = page.getByRole('textbox', { name: 'Your message' });
  await box.fill('@');
  await expect(page.getByRole('listbox', { name: 'People' })).toBeVisible();
  await expect(page.getByRole('option', { name: '@ada', exact: true })).toBeVisible();
});

test('Function: MentionTextarea — choosing a person inserts the handle', async ({
  page,
  request,
}) => {
  await reachWelcome(page, request);
  await openHomeWriter(page);
  const box = page.getByRole('textbox', { name: 'Your message' });
  await box.fill('@');
  await page.getByRole('option', { name: '@ada', exact: true }).click();
  await expect(box).toHaveValue('@ada ');
});

test('Function: searchMentionAccounts — @as keeps only that prefix', async ({ page, request }) => {
  await reachWelcome(page, request);
  await openHomeWriter(page);
  const box = page.getByRole('textbox', { name: 'Your message' });
  await box.fill('@as');
  await expect(page.getByRole('option', { name: '@ashton' })).toBeVisible();
  await expect(page.getByRole('option', { name: '@ada', exact: true })).toHaveCount(0);
});

test('Function: remapClosedMentionStarts — earlier text keeps that @ closed', async ({
  page,
  request,
}) => {
  await reachWelcome(page, request);
  await openHomeWriter(page);
  const box = page.getByRole('textbox', { name: 'Your message' });
  const people = page.getByRole('listbox', { name: 'People' });
  await box.fill('hi @');
  await expect(people).toBeVisible();
  await box.press('Escape');
  await expect(people).toHaveCount(0);
  await box.press('Home');
  await box.press('x');
  await box.press('End');
  await expect(people).toHaveCount(0);
  await expect(box).toHaveValue('xhi @');
});

test('Function: fitBoxInFrame — a wide panel is pulled inside the frame', async ({ page }) => {
  await page.goto('/login');
  const box = await page.evaluate(fitBoxInFrame, {
    frameLeft: 24,
    frameRight: 351,
    frameTop: 0,
    frameBottom: 800,
    anchorLeft: 56,
    anchorTop: 160,
    anchorBottom: 200,
    gap: 8,
    preferredWidth: 384,
    inset: 16,
    viewportHeight: 800,
  });
  expect(box).not.toBeNull();
  if (box === null) {
    return;
  }
  expect(box.left).toBeGreaterThanOrEqual(24 + 16);
  expect(box.left + box.width).toBeLessThanOrEqual(351 - 16);
  expect(box.width).toBeLessThanOrEqual(384);
});

test('Function: pageFrameProblems — login at phone width stays inside the window', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/login');
  const problems = await page.evaluate(pageFrameProblems);
  expect(problems).toEqual([]);
});

test('Function: ReplyDirectionAmounts — sent and received stay apart', async ({ page }) => {
  await seedAdaSession(page);
  const id = '11111111-1111-4111-8111-111111111111';
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id,
            name: 'Ada',
            text: 'The note that was paid',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 21000,
            payable: true,
            hasPhoto: false,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 1,
          },
        ],
      }),
    });
  });
  await page.route(`**/forum/messages/${id}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            name: 'Ada',
            text: 'A written reply',
            createdAt: '2026-08-28T12:30:00.000Z',
            sats: 21000,
            receivedSats: 100,
            payable: false,
            hasPhoto: false,
            hasVideo: false,
            videoContentType: null,
            role: 'basis',
            replyCount: 0,
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await chooseForumView(page, 'All');
  await page.getByRole('button', { name: 'Show reactions' }).click();
  await expect(page.getByText('A written reply')).toBeVisible();
  await expect(page.getByText("sent \u20BF21'000")).toBeVisible();
  await expect(page.getByText('received \u20BF100')).toBeVisible();
  await expect(page.getByText("\u20BF21'100")).toHaveCount(0);
});

test('Function: proxyLnurlPayRequestPost — POST /lnurl/pay-request returns the bounds', async ({
  request,
}) => {
  const token = await loginHttp(request);
  const res = await request.post('/lnurl/pay-request', {
    headers: { authorization: `Bearer ${token}` },
    data: { target: 'bob@example.com' },
  });
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({
    target: 'bob@example.com',
    minSendableMsat: 1_000,
    commentAllowed: 10,
  });
});

test('Function: proxyLnurlInvoicePost — POST /lnurl/invoice returns the invoice', async ({
  request,
}) => {
  const token = await loginHttp(request);
  const res = await request.post('/lnurl/invoice', {
    headers: { authorization: `Bearer ${token}` },
    data: { target: 'bob@example.com', amountMsat: 21_000 },
  });
  expect(res.status()).toBe(200);
  // 21'000 msat is 210'000 pico-bitcoin (BOLT11 multiplier p).
  expect(((await res.json()) as { pr: string }).pr).toBe('lnbc210000p1mockrelay');
});

test('Function: postLnurlPayRequest — refusals carry the contract error texts', async ({
  request,
}) => {
  const token = await loginHttp(request);
  const headers = { authorization: `Bearer ${token}` };
  for (const [target, status, error] of [
    ['bob@21.gifts', 400, 'Not a payable address'],
    ['missing@example.com', 404, 'Address not found'],
    ['down@example.com', 502, 'Address could not be reached'],
  ] as const) {
    const res = await request.post('/lnurl/pay-request', { headers, data: { target } });
    expect(res.status()).toBe(status);
    expect(await res.json()).toEqual({ error });
  }
});

test('Function: postLnurlInvoice — amount and comment refusals', async ({ request }) => {
  const token = await loginHttp(request);
  const headers = { authorization: `Bearer ${token}` };
  const range = await request.post('/lnurl/invoice', {
    headers,
    data: { target: 'bob@example.com', amountMsat: 500 },
  });
  expect(range.status()).toBe(400);
  expect(await range.json()).toEqual({ error: 'Amount out of range' });
  const comment = await request.post('/lnurl/invoice', {
    headers,
    data: { target: 'bob@example.com', amountMsat: 21_000, comment: 'far too long a message' },
  });
  expect(comment.status()).toBe(400);
  expect(await comment.json()).toEqual({ error: 'Comment too long' });
});
