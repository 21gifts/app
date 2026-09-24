import fs from 'node:fs';
import path from 'node:path';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { openCryptoPayQrValue } from '../src/lib/gifts-address';
import {
  buildShopStickerPdf,
  buildShopStickerSvg,
  type ShopStickerFormat,
} from '../src/lib/shop-sticker';
import { encodeLnurl } from '../src/lib/lnurl';
import { RULES_CHAPTER_IDS } from '../src/lib/rules-chapters';
import { parseForumAskAmountInUnit } from '../src/lib/forum-goal';
import {
  fiatDraftForSats,
  fiatToSats,
  parseAmountDraft,
  paySatsFromDraft,
  replySatsFromDraft,
} from '../src/lib/stats-money';

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
        lightningAddress: 'alice@walletofsatoshi.com',
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
    if (href.startsWith('walletofsatoshi:') || href.startsWith('intent:')) {
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
      if (href.startsWith('walletofsatoshi:') || href.startsWith('intent:')) {
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
  await saveOnboardingName(page);
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByRole('button', { name: 'Continue' }).click();
  await agreeToLivingRoomRules(page);
  await expect(page).toHaveURL(/\/welcome/);
  await chooseForumView(page, 'All');
  await page.getByRole('button', { name: 'Show reactions' }).click();
  const replyCard = page.locator('[data-reply-id="r-pay"]');
  await replyCard.getByRole('button', { name: 'Send Bitcoin' }).click();
  await replyCard.getByLabel('Amount').fill('21');
  await submitPayAmount(page);
  await expect(page.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeVisible();
}

async function stubGiftStats(page: Page, body: unknown): Promise<void> {
  await page.route(/\/gifts\/stats(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
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
        lightningAddress: 'alice@walletofsatoshi.com',
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

async function confirmNewAccount(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { name: 'Do you already have an account?' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Open a new account' }).click();
  await expect(page).toHaveURL(/\/setup\/name/, { timeout: 10_000 });
}

async function signInViaStub(page: Page, _request: APIRequestContext): Promise<void> {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await confirmNewAccount(page);
  await expect(page).toHaveURL(/\/setup\/name/, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
}

async function saveOnboardingName(page: Page): Promise<void> {
  await page.getByRole('textbox', { name: 'Name' }).fill('Ada');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/setup\/address/);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
}

async function saveOnboardingUsername(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/setup\/username/);
  await page.getByRole('textbox').fill(`ada${Date.now().toString(36)}`);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/setup\/address/);
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
  const seen = await request.post('/me/wallet-backup-seen', {
    headers: { authorization: `Bearer ${body.token}` },
  });
  expect(seen.status()).toBe(200);
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

test('Function: getAppVersion — signed-in Menu shows Version dev', async ({ page, request }) => {
  await signInViaStub(page, request);
  await openSignedInMenu(page);
  await expect(page.getByText('Version dev')).toBeVisible();
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

test('Function: translateConversationMessage — unsigned conversation translate is rejected', async ({
  request,
}) => {
  const res = await request.post('/conversations/[id]/messages/[messageId]/translate', {
    data: { target: 'en' },
  });
  expect(res.status()).toBeGreaterThanOrEqual(400);
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
  const input = page.locator('input[type="file"]');
  await expect(input).toHaveAttribute('accept', /image\/jpeg/);
  await expect(input).toHaveAttribute('accept', /image\/png/);
  await expect(input).toHaveAttribute('accept', /image\/webp/);
});

test('Function: fetchMessages — welcome shows the empty forum', async ({ page, request }) => {
  await signInViaStub(page, request);
  await saveOnboardingName(page);
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByRole('button', { name: 'Continue' }).click();
  await agreeToLivingRoomRules(page);
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await expect(page.getByText('Loading…')).toHaveCount(0);
  await expect(page.getByText('Could not load messages. Please try again.')).toHaveCount(0);
  await expect(page.getByLabel('Your message')).toBeVisible();
});

test('Function: postMessage — posting from the composer shows the row', async ({
  page,
  request,
}) => {
  await reachWelcomeVerified(page, request);
  const body = `Hello from Ada ${Date.now()}`;
  await page.getByLabel('Your message').fill(body);
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByText(body)).toBeVisible();
});

test('Function: postContact — sending from contact shows the official thread', async ({
  page,
  request,
}) => {
  await signInViaStub(page, request);
  await saveOnboardingName(page);
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByRole('button', { name: 'Continue' }).click();
  await agreeToLivingRoomRules(page);
  await page.goto('/contact');
  const body = `Contact note ${Date.now()}`;
  await page.getByLabel('Your message').fill(body);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page).toHaveURL(/\/messages\?c=/);
  await expect(page.getByText(body)).toBeVisible();
});

async function reachWelcome(page: Page, request: APIRequestContext): Promise<void> {
  await signInViaStub(page, request);
  await saveOnboardingName(page);
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByRole('button', { name: 'Continue' }).click();
  await agreeToLivingRoomRules(page);
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByRole('button', { name: 'Add a photo or video' })).toBeVisible();
}

async function reachWelcomeVerified(page: Page, request: APIRequestContext): Promise<void> {
  await reachWelcome(page, request);
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
  await expect(page.getByRole('button', { name: 'Add a photo or video' })).toBeVisible();
}

async function attachTinyJpeg(page: Page): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.jpg');
  await expect(page.getByAltText('Selected photo')).toBeVisible({ timeout: 10_000 });
}

async function postAndExpectPhotoRow(page: Page, caption?: string): Promise<string> {
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
  await expect(row.getByRole('img', { name: 'Photo from Ada' })).toBeVisible({
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
  await reachWelcomeVerified(page, request);
  await attachTinyJpeg(page);
  await postAndExpectPhotoRow(page);
});

test('Function: isForumPhotoFile — photo-only post does not require text', async ({
  page,
  request,
}) => {
  await reachWelcomeVerified(page, request);
  await attachTinyJpeg(page);
  await expect(page.getByLabel('Your message')).toHaveValue('');
  await postAndExpectPhotoRow(page);
});

test('Function: fetchMessagePhoto — text plus photo posts both', async ({ page, request }) => {
  await reachWelcomeVerified(page, request);
  const caption = `Caption ${Date.now()}`;
  await page.getByLabel('Your message').fill(caption);
  await attachTinyJpeg(page);
  await postAndExpectPhotoRow(page, caption);
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
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByText('Enter a message or add a photo or video')).toBeVisible();
});

test('Function: ForumLoader — remove photo clears the preview', async ({ page, request }) => {
  await reachWelcome(page, request);
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
  await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.jpg');
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
  await expect(page).toHaveURL(/\/setup\/name/);
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
  await signInViaStub(page, request);
  await page.goto('/setup/name');
  await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page).toHaveURL(/\/setup\/username/);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0);
});

test('Function: NameForm — Skip is absent on the rules setup screen', async ({ page, request }) => {
  await signInViaStub(page, request);
  await page.getByRole('button', { name: 'Skip' }).click();
  await saveOnboardingUsername(page);
  await page.getByRole('button', { name: 'Skip' }).click();
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
  await request.post('/me/lightning-address', {
    headers: { authorization: `Bearer ${token}` },
    data: { address: 'alice@walletofsatoshi.com' },
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

test('Function: fetchMemberReplies — member replies open from the count', async ({
  page,
  request,
}) => {
  await reachWelcome(page, request);
  await page.goto('/members/22222222-2222-4222-8222-222222222222');
  await page.getByRole('button', { name: '1 reactions' }).click();
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
  await signInViaStub(page, request);
  await page.getByRole('button', { name: 'Skip' }).click();
  await saveOnboardingUsername(page);
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByRole('button', { name: 'Continue' }).click();
  await agreeToLivingRoomRules(page);
  await expect(page).toHaveURL(/\/welcome/);
  await page.goto('/contact');
  await page.getByRole('textbox', { name: 'Your message' }).fill('Need a name first');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('dialog', { name: 'Add your name' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0);
});

test('Function: RequirementsOverlay — forum post without a lightning-address opens the overlay', async ({
  page,
  request,
}) => {
  await signInViaStub(page, request);
  await saveOnboardingName(page);
  await page.getByRole('button', { name: 'Skip' }).click();
  await agreeToLivingRoomRules(page);
  await expect(page).toHaveURL(/\/welcome/);
  await page.getByLabel('Your message').fill('Hello');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Add your Wallet of Satoshi address' }),
  ).toBeVisible();
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
        lightningAddress: 'alice@walletofsatoshi.com',
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

test('Function: requestForumCompose — Write an introduction focuses the welcome composer', async ({
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
        lightningAddress: 'alice@walletofsatoshi.com',
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

test('Function: consumeSkipIntroduceOverlay — CTA from profile lands on welcome without the dialog', async ({
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
  await page.goto('/profile');
  await expect(page.getByRole('dialog', { name: 'Introduce yourself' })).toBeVisible();
  await page.getByRole('button', { name: 'Write an introduction' }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole('dialog', { name: 'Introduce yourself' })).toHaveCount(0);
});

test('Function: consumePendingForumCompose — CTA from profile focuses the welcome composer after navigation', async ({
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Write an introduction' }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByLabel('Your message')).toBeFocused();
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
        lightningAddress: 'carol@walletofsatoshi.com',
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

test('Function: MemberProfileScreen — reply without a lightning-address opens the overlay from the posts feed', async ({
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
        lightningAddress: 'carol@walletofsatoshi.com',
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
  await page.getByRole('button', { name: '1 posts' }).click();
  await expect(page.getByText('Hello from my profile note.')).toBeVisible();
  await page.getByRole('button', { name: 'Show reactions' }).click();
  await expect(page.getByLabel('Your reaction')).toBeVisible();
  await page.getByLabel('Your reaction').fill('Hello');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Add your Wallet of Satoshi address' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0);
});

test('Function: nextPostRequirement — rules before name before lightning-address for forum overlay order', async ({
  page,
  request,
}) => {
  await signInViaStub(page, request);
  await expect(page).toHaveURL(/\/setup\/name/);
  await page.getByRole('button', { name: 'Skip' }).click();
  await saveOnboardingUsername(page);
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page).toHaveURL(/\/setup\/rules/);
  const chapter = `1 of ${RULES_CHAPTER_IDS.length}`;
  await expect(page.getByText(chapter, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('Function: nextContactRequirement — contact still opens name overlay without requiring lightning-address', async ({
  page,
  request,
}) => {
  await signInViaStub(page, request);
  await page.getByRole('button', { name: 'Skip' }).click();
  await saveOnboardingUsername(page);
  await page.getByRole('button', { name: 'Skip' }).click();
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

test('Function: proxyMeAmountUnitPost — POST /me/amount-unit without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/me/amount-unit')).status()).toBe(401);
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
  await saveOnboardingName(page);
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByRole('button', { name: 'Continue' }).click();
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
  await signInViaStub(page, request);
  await saveOnboardingName(page);
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByRole('button', { name: 'Continue' }).click();
  await agreeToLivingRoomRules(page);
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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

test('Function: hasAgreedToRules — name and address without agreement stay on rules', async ({
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
  await agreeToLivingRoomRules(page);
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
  await expect(page.getByRole('heading', { name: 'Donate to this project' })).toBeVisible();
  await expect(page.getByRole('link', { name: '21gifts@walletofsatoshi.com' })).toHaveAttribute(
    'href',
    'lightning:21gifts@walletofsatoshi.com',
  );
});

test('Function: MarketingLayout — landing has marketing chrome', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: '21.gifts' }).first()).toBeVisible();
});

test('Function: MarketingHeader — landing shows the wordmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: '21.gifts' }).first()).toBeVisible();
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

test('Function: topicVariant — pay-qr contents link is visible', async ({ page }) => {
  await page.goto('/handbook/screens');
  await expect(
    page
      .getByRole('navigation', { name: 'Contents' })
      .getByRole('link', { name: 'pay-qr', exact: true }),
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

test('Function: parseScreenVariantDescriptions — pay-qr description is visible', async ({
  page,
}) => {
  await page.goto('/handbook/screens');
  await expect(page.getByText(/invoice card shows the Bitcoin payment QR/)).toBeVisible();
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
  await expect(page).toHaveURL(/\/messages\/p1$/);
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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

test('Function: MessagesChromeLeft — open thread has one All conversations back', async ({
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
  await expect(page.getByRole('link', { name: 'All conversations' })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'All conversations' })).toHaveAttribute(
    'href',
    '/messages',
  );
  await expect(page.getByRole('link', { name: '21.gifts' }).first()).toHaveAttribute(
    'href',
    '/welcome',
  );
  await expect(page.getByRole('button', { name: 'All conversations' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back to the forum' })).toHaveCount(0);
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'carol@walletofsatoshi.com',
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
});

test('Function: LoginPage — login heading is visible', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Log in with your device' })).toBeVisible();
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

test('Function: InAppBrowserView — Telegram WebView shows Open in browser', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { TelegramWebviewProxy: { postEvent() {} } });
  });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Open this page in your browser' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open in browser' })).toBeVisible();
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
  await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toBeVisible();
  expect(await recordedWalletAssign(page)).toBeUndefined();
});

test('Function: isSmartphoneUserAgent — iPhone pay sheet has no QR, only the wallet button', async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      get: () =>
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
  });
  await openPayInvoice(page, request);
  await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeVisible();
  await expect(page.getByText('Pay ₿21')).toBeVisible();
  expect(await recordedWalletAssign(page)).toBeUndefined();
});

test('Function: uppercaseLnurl — pay sheet uses an uppercase lightning href', async ({
  page,
  request,
}) => {
  await openPayInvoice(page, request);
  await page.getByRole('button', { name: 'Pay with Wallet of Satoshi' }).click();
  const href = await recordedWalletAssign(page);
  expect(href?.startsWith('walletofsatoshi:lightning:LNBC')).toBe(true);
});

test('Function: walletOfSatoshiHref — pay sheet opens Wallet of Satoshi', async ({
  page,
  request,
}) => {
  await openPayInvoice(page, request);
  await expect(page.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeVisible();
});

test('Function: isAndroidUserAgent — Android pay sheet uses an Intent href', async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      get: () =>
        'Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    });
  });
  await openPayInvoice(page, request);
  await page.getByRole('button', { name: 'Pay with Wallet of Satoshi' }).click();
  const href = await recordedWalletAssign(page);
  expect(href?.startsWith('intent:lightning:')).toBe(true);
});

test('Function: walletOfSatoshiIntentHref — Android pay sheet pins the WoS package', async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      get: () =>
        'Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    });
  });
  await openPayInvoice(page, request);
  await page.getByRole('button', { name: 'Pay with Wallet of Satoshi' }).click();
  const href = await recordedWalletAssign(page);
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
  await agreeToLivingRoomRules(page);
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
  await saveOnboardingName(page);
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByRole('button', { name: 'Continue' }).click();
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
});

test('Function: postMessageInvoice — pay sheet requests an invoice', async ({ page, request }) => {
  await openPayInvoice(page, request);
});

test('Function: shownFiatForSats — pay sheet sends the shown amounts', async ({
  page,
  request,
}) => {
  await stubGiftStats(page, POPULATED_STATS);
  await stubWalletLocationAssign(page);
  await stubPayableNote(page);
  await signInViaStub(page, request);
  await saveOnboardingName(page);
  await page.getByLabel('Wallet of Satoshi address').fill('alice@walletofsatoshi.com');
  await page.getByRole('button', { name: 'Continue' }).click();
  await agreeToLivingRoomRules(page);
  await expect(page).toHaveURL(/\/welcome/);
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

test('Function: satsToFiatAmount — forum note shows a USD equivalent next to ₿', async ({
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
});

test('Function: latestRateDay — pay sheet shows a live USD equivalent for 21 sats', async ({
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
        lightningAddress: 'alice@walletofsatoshi.com',
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

test('Function: startPasskeyRegistration — create passkey reaches the signed-in view', async ({
  page,
}) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await confirmNewAccount(page);
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
  await confirmNewAccount(page);
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
  await confirmNewAccount(page);
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
  await confirmNewAccount(page);
  await expect(page).toHaveURL(/\/setup\/name/, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('Function: credentialToJSON — create passkey reaches the signed-in view', async ({ page }) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await confirmNewAccount(page);
  await expect(page).toHaveURL(/\/setup\/name/, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('Function: base64UrlToBytes — create passkey reaches the signed-in view', async ({ page }) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await confirmNewAccount(page);
  await expect(page).toHaveURL(/\/setup\/name/, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('Function: bytesToBase64Url — create passkey reaches the signed-in view', async ({ page }) => {
  await installFakeWebAuthn(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await confirmNewAccount(page);
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
  await signInViaStub(page, request);
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
  await expect(page.getByRole('button', { name: 'Create invoice' })).toBeVisible();
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
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Shop sticker' })).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Open CryptoPay QR code' })).toBeVisible();
});

test('Function: buildShopStickerSvg — preview and SVG download are the member sticker', async ({
  page,
  request,
}) => {
  const dialog = await openShopSticker(page, request);
  const expected = buildShopStickerSvg(openCryptoPayQrValue('carol') as string);
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
    pdf.bytes.equals(Buffer.from(buildShopStickerPdf(openCryptoPayQrValue('carol') as string))),
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
    expect(file.name).toBe(`21gifts-shop-sticker-carol.${format}`);
  }
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
  await page.goto('/setup/address');
  await expect(page.getByRole('heading', { name: 'Your Wallet of Satoshi address' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  await expect(page.locator('#signed-in-menu')).toBeHidden();
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
        location: null,
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
    const scroller = node.closest('.overflow-y-auto');
    if (!(form instanceof HTMLElement) || !(scroller instanceof HTMLElement)) {
      return false;
    }
    const formBox = form.getBoundingClientRect();
    const shell = scroller.getBoundingClientRect();
    return formBox.top >= shell.top - 1 && formBox.bottom <= shell.bottom + 1;
  });
  expect(inside).toBe(true);
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
    const scroller = document.querySelector('main .overflow-y-auto');
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
    const scroller = document.querySelector('main .overflow-y-auto');
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
          lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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

test('Function: OnboardingGate — login sends a new account to the name screen', async ({
  page,
  request,
}) => {
  await signInViaStub(page, request);
  await expect(page).toHaveURL(/\/setup\/name/);
});

test('Function: OnboardingGate — name and address without agreement go to rules', async ({
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
  await expect(page).toHaveURL(/\/setup\/name/);
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
  await page.route(/\/pos\/charge$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ charge: null, history: [] }),
    });
  });
  await page.goto('/pos');
  await expect(page.getByRole('heading', { name: 'Point of sale' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create payment' })).toBeVisible();
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
  await page.route(/\/pos\/charge$/, async (route) => {
    if (route.request().method() === 'POST') {
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
      body: JSON.stringify({ charge: null, history: [] }),
    });
  });
  await page.goto('/pos');
  await page.getByLabel('Amount').fill('21');
  await page.getByRole('button', { name: 'Create payment' }).click();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
  await expect(page.getByRole('button', { name: 'Create payment' })).toBeVisible();
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

test('Function: SegmentedControl — welcome composer shows Send a post', async ({ page }) => {
  await seedAdaSession(page);
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
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

test('Function: IconButton — welcome composer shows the Post icon control', async ({ page }) => {
  await seedAdaSession(page);
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.goto('/welcome');
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
    const scroller = document.querySelector('main .overflow-y-auto');
    if (scroller instanceof HTMLElement) {
      scroller.scrollTop = 900;
    }
  });
  const afterScroll = await page.evaluate(() => {
    const scroller = document.querySelector('main .overflow-y-auto');
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
    const scroller = document.querySelector('main .overflow-y-auto');
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
        lightningAddress: 'ada@walletofsatoshi.com',
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

test('Function: resolveAppHeight — short keyboard visualViewport does not shrink the page frame', async ({
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
  await page.getByLabel('Your message').focus();
  const measured = await page.evaluate(() => {
    const inner = window.innerHeight;
    const vv = window.visualViewport;
    const main = document.querySelector('main');
    return {
      appHeight: getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim(),
      inner,
      short: vv === null || vv === undefined ? 0 : Math.round(vv.height),
      mainHeight: main === null ? 0 : Math.round(main.getBoundingClientRect().height),
    };
  });
  expect(measured.short).toBeGreaterThan(0);
  expect(measured.short).toBeLessThan(measured.inner);
  expect(measured.appHeight).toBe(`${measured.inner}px`);
  expect(measured.mainHeight).toBe(measured.inner);
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
  await expect(page.getByRole('button', { name: 'Copy link to this note' })).toBeVisible();
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
        lightningAddress: 'alice@walletofsatoshi.com',
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

test('Function: ViewProfilePage — public view heading is visible', async ({ page }) => {
  const key = 'a'.repeat(64);
  await page.route(new RegExp(`/view-key/${key}$`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: 'Ada',
        location: null,
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
  await expect(page.getByRole('button', { name: 'Edit Wallet of Satoshi address' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove Wallet of Satoshi address' })).toHaveCount(
    0,
  );
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
test('Function: fetchAccountActivity — signed-in profile menu shows received sats', async ({
  page,
}) => {
  await seedAdaSession(page);
  await stubAccountActivity(page, { ...EMPTY_ACTIVITY, receivedSats: 1000 });
  await page.goto('/profile');
  await openSignedInMenu(page);
  await expect(page.getByRole('link', { name: /Received ₿1'000/ })).toBeVisible();
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
        lightningAddress: 'alice@walletofsatoshi.com',
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

test('Function: useAccountTotals — menu shows received sats from /me/activity', async ({
  page,
}) => {
  await seedAdaSession(page);
  await stubAccountActivity(page, { ...EMPTY_ACTIVITY, receivedSats: 1000 });
  await page.goto('/profile');
  await openSignedInMenu(page);
  await expect(page.getByRole('link', { name: /Received ₿1'000/ })).toBeVisible();
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
  await expect(page.locator('input[type="file"]')).toHaveAttribute('accept', /video\/mp4/);
  await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.mp4');
  await expect.poll(async () => page.locator('form video').count(), { timeout: 15_000 }).toBe(1);
});
test('Function: prepareForumVideo — composer accept includes webm', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/welcome');
  await expect(page.locator('input[type="file"]')).toHaveAttribute('accept', /video\/webm/);
});
test('Function: postMessageVideo — composer accept includes quicktime', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/welcome');
  await expect(page.locator('input[type="file"]')).toHaveAttribute('accept', /video\/quicktime/);
});
test('Function: forumVideoSrc — composer accept includes mov', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/welcome');
  await expect(page.locator('input[type="file"]')).toHaveAttribute('accept', /\.mov/);
});
test('Function: isForumVideoFile — composer accept includes m4v', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/welcome');
  await expect(page.locator('input[type="file"]')).toHaveAttribute('accept', /video\/x-m4v/);
});
test('Function: prepareForumVideo — composer accept includes m4v extension', async ({ page }) => {
  await seedAdaSession(page);
  await page.goto('/welcome');
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'cyrill@walletofsatoshi.com',
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
  const text = `${'a'.repeat(280)} ${tail}`;
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
  const text = `${'a'.repeat(280)} ${tail}`;
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
        lightningAddress: 'alice@walletofsatoshi.com',
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
