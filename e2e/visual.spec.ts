import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

async function chooseForumView(page: Page, name: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Forum view' }).click();
  await page.getByRole('option', { name, exact: true }).click();
}

/**
 * Visual baselines are Linux Chromium (CI and the Playwright Docker image).
 * Behavioral e2e specs still run on macOS; these comparisons do not.
 */
test.skip(process.platform !== 'linux', 'visual baselines are linux/chromium');

const E2E_ACCOUNT = {
  id: 'acc_e2e',
  linkingKey: `02${'a'.repeat(62)}`,
  role: 'basis' as const,
  name: null as string | null,
  username: null as string | null,
  location: null as string | null,
  lightningAddress: null as string | null,
  lightningAddressVerified: false,
  forumLawsDismissed: true,
  createdAt: 1_700_000_000,
  rulesAgreedAt: null as number | null,
  viewKey: 'a'.repeat(64),
  aboutMe: null as string | null,
  setup: 'name' as 'wallet' | 'name' | 'username' | 'lightning-address' | 'rules' | null,
  missing: ['name', 'username', 'lightning-address', 'rules'] as Array<
    'wallet' | 'name' | 'username' | 'lightning-address' | 'rules'
  >,
};

const SHOT = { animations: 'disabled' as const, caret: 'hide' as const };

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

const RATE_DAY_STATS = {
  totalSats: 100_000_000,
  totalBtc: '1.00000000',
  totalUsd: '100000.00',
  totalChf: '80000.00',
  totalEur: '90000.00',
  totalPhp: '5600000.00',
  giftCount: 1,
  recipientCount: 1,
  firstPaidAt: '2026-06-01T00:00:00.000Z',
  lastPaidAt: '2026-06-01T00:00:00.000Z',
  spendOverTime: [
    {
      day: '2026-06-01',
      giftCount: 1,
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
  byRecipient: [],
  byMonth: [],
  fx: FX_USD,
};

async function fulfillRateDay(page: Page): Promise<void> {
  await page.route('**/gifts/stats**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(RATE_DAY_STATS),
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

const VIEW_RECEIVED_ACTIVITY = {
  donatedSats: 0,
  receivedSats: 1500,
  donatedOverTime: [] as const,
  receivedOverTime: [
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
  fx: FX_ALL,
};

const TRUST_CHAIN_SEED = {
  nodes: [{ id: 'f1', name: 'Cyrill', role: 'founder' }],
  edges: [] as { from: string; to: string; kind: 'verify' | 'moderator_appoint' }[],
};

const TRUST_CHAIN_AROUND_FOUNDER = {
  nodes: [
    { id: 'f1', name: 'Cyrill', role: 'founder' },
    { id: 'm1', name: 'Severin', role: 'moderator' },
  ],
  edges: [{ from: 'f1', to: 'm1', kind: 'moderator_appoint' as const }],
};

const TRUST_CHAIN_AROUND_MODERATOR = {
  nodes: [
    { id: 'f1', name: 'Cyrill', role: 'founder' },
    { id: 'm1', name: 'Severin', role: 'moderator' },
    { id: 'v1', name: 'Ada', role: 'verified' },
    { id: 'v2', name: 'Bob', role: 'verified' },
  ],
  edges: [
    { from: 'f1', to: 'm1', kind: 'moderator_appoint' as const },
    { from: 'm1', to: 'v1', kind: 'verify' as const },
    { from: 'm1', to: 'v2', kind: 'verify' as const },
  ],
};

const POSTS_DEFAULT = {
  postCount: 6,
  postsOverTime: [
    { day: '2026-06-01', postCount: 2 },
    { day: '2026-06-02', postCount: 0 },
    { day: '2026-07-01', postCount: 4 },
  ],
};

/**
 * Serves the public posts series so `/stats` baselines include that section.
 *
 * @param page - Playwright page.
 * @param body - Stats payload. Defaults to {@link POSTS_DEFAULT}.
 */
async function stubPostStats(
  page: Page,
  body: { postCount: number; postsOverTime: { day: string; postCount: number }[] } = POSTS_DEFAULT,
): Promise<void> {
  await page.route('**/messages/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

const STATS_DEFAULT = {
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

const STATS_USD_SCALE = {
  totalSats: 1_100_000,
  totalBtc: '0.01100000',
  totalUsd: '950.00',
  totalChf: '800.00',
  totalEur: '860.00',
  totalPhp: '53200.00',
  giftCount: 2,
  recipientCount: 2,
  firstPaidAt: '2026-06-01T00:00:00.000Z',
  lastPaidAt: '2026-07-01T00:00:00.000Z',
  spendOverTime: [
    {
      day: '2026-06-01',
      sats: 1_000_000,
      cumulativeSats: 1_000_000,
      btc: '0.01000000',
      cumulativeBtc: '0.01000000',
      usd: '50.00',
      cumulativeUsd: '50.00',
      chf: '42.00',
      eur: '45.00',
      php: '2800.00',
      cumulativeChf: '42.00',
      cumulativeEur: '45.00',
      cumulativePhp: '2800.00',
    },
    {
      day: '2026-07-01',
      sats: 100_000,
      cumulativeSats: 1_100_000,
      btc: '0.00100000',
      cumulativeBtc: '0.01100000',
      usd: '900.00',
      cumulativeUsd: '950.00',
      chf: '756.00',
      eur: '820.00',
      php: '50400.00',
      cumulativeChf: '800.00',
      cumulativeEur: '860.00',
      cumulativePhp: '53200.00',
    },
  ],
  byRecipient: [
    {
      recipient: 'alice',
      giftCount: 1,
      sats: 1_000_000,
      btc: '0.01000000',
      usd: '50.00',
      chf: '42.00',
      eur: '45.00',
      php: '2800.00',
    },
    {
      recipient: 'bob',
      giftCount: 1,
      sats: 100_000,
      btc: '0.00100000',
      usd: '900.00',
      chf: '756.00',
      eur: '820.00',
      php: '50400.00',
    },
  ],
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
  fx: FX_ALL,
};

const STATS_EMPTY = {
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

/**
 * True when this visual run is a mobile combo project.
 *
 * @param testInfo - Playwright test info (project name is the combo id).
 * @returns Whether the project id starts with `mobile-`.
 */
function isMobileProject(testInfo: { project: { name: string } }): boolean {
  return testInfo.project.name.startsWith('mobile-');
}

test.beforeEach(async ({ page }, testInfo) => {
  const theme = testInfo.project.name.endsWith('dark') ? 'dark' : 'light';
  await page.context().addCookies([{ name: 'theme', value: theme, url: 'http://localhost:3000' }]);
});

/**
 * Playwright fullPage stitches viewport chunks; sticky chrome is painted
 * into every chunk. Force document flow so each header appears once.
 * The sticky New posts pill is a viewport shot, not unstuck here.
 *
 * @param page - Page under test.
 */
async function unstickStickyChrome(page: Page): Promise<void> {
  await page.addStyleTag({
    content: 'header.sticky { position: static !important; }',
  });
}

async function shotScreen(page: Page, arg: string, fullPage = true): Promise<void> {
  await unstickStickyChrome(page);
  await expect(page).toHaveScreenshot(`${arg}.png`, {
    fullPage,
    maxDiffPixelRatio: 0,
    ...SHOT,
  });
}

/** Empty public thread replies so `/messages/[id]` does not hang on the replies GET. */
async function fulfillPublicThreadReplies(
  page: Page,
  id: string,
  messages: unknown[] = [],
): Promise<void> {
  await page.route(`**/public-messages/${id}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages }),
    });
  });
}

/** Signed-in Ada viewing Carol (username `carol`), for the Shop sticker states. */
async function seedShopStickerMember(page: Page): Promise<void> {
  const memberId = '22222222-2222-4222-8222-222222222222';
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...E2E_ACCOUNT,
        name: 'Ada',
        location: null,
        username: 'alice',
        lightningAddress: 'alice@walletofsatoshi.com',
        rulesAgreedAt: 1_700_000_001,
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
        username: 'carol',
        lightningAddress: 'carol@walletofsatoshi.com',
        createdAt: '2026-01-15T12:00:00.000Z',
        aboutMe: 'Hello from Carol.',
        profileMessage: null,
        postCount: 0,
        replyCount: 0,
      }),
    });
  });
  await page.goto(`/members/${memberId}`);
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(page.getByText('carol@21.gifts')).toBeVisible();
}

/** Presses Shop sticker and waits until the preview image has decoded. */
async function openShopStickerOverlay(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Shop sticker' }).click();
  const dialog = page.getByRole('dialog', { name: 'Shop sticker' });
  const preview = dialog.getByRole('img', { name: 'Shop sticker preview for carol@21.gifts' });
  await expect(preview).toBeVisible();
  await expect
    .poll(() => preview.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
    .toBe(true);
  return dialog;
}

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

const RULES_SETUP_ACCOUNT = {
  ...E2E_ACCOUNT,
  name: 'Ada',
  username: 'ada',
  lightningAddress: 'alice@walletofsatoshi.com',
  rulesAgreedAt: null,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  setup: 'rules' as const,
  missing: ['rules'] as Array<'name' | 'username' | 'lightning-address' | 'rules'>,
};

/** Signed-in visitor at `/setup/rules` (name + address saved, rules not agreed). */
async function openRulesSetup(
  page: Page,
  agreement: 'none' | 'fail' | 'hang' = 'none',
): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(RULES_SETUP_ACCOUNT),
    });
  });
  if (agreement === 'fail') {
    await page.route(/\/me\/rules-agreement$/, async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    });
  } else if (agreement === 'hang') {
    await page.route(/\/me\/rules-agreement$/, () => undefined);
  }
}

/** Advance from the lead chapter; does not POST (stops before the last agree). */
async function advanceRulesChapters(page: Page, clicks: number): Promise<void> {
  const next = page.getByRole('button', { name: 'Continue' });
  for (let i = 0; i < clicks; i += 1) {
    await next.click();
  }
}

/** Newest-first mixed-sats forum fixture for `/welcome` Active / All / Most popular. */
async function fulfillMixedSatsMessages(page: Page): Promise<void> {
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
            role: 'moderator',
          },
          {
            id: 'm2',
            name: 'Carol',
            text: 'I can send a small gift tomorrow.',
            createdAt: '2026-08-28T11:00:00.000Z',
            sats: 21,
            payable: true,
            hasPhoto: false,
            role: 'verified',
          },
          {
            id: 'm1',
            name: 'Bob',
            text: 'Does anyone have spare sats this week?',
            createdAt: '2026-08-28T10:00:00.000Z',
            sats: 0,
            payable: true,
            hasPhoto: false,
            role: 'basis',
          },
        ],
      }),
    });
  });
}

const GERMAN_NOTE_TEXT = 'Kann mir jemand diese Woche ein paar Satoshi leihen?';

/** One paid German Ada note so Active shows Translate under the body. */
async function fulfillGermanPaidAdaNote(page: Page): Promise<void> {
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

/** Intercept same-origin POST /translate; GET continues to the app route. */
async function fulfillTranslatePost(page: Page, outcome: 'ok' | 'fail' | 'hang'): Promise<void> {
  await page.route(/\/translate$/, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    if (outcome === 'hang') {
      return;
    }
    if (outcome === 'fail') {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Translate upstream failed' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        translatedText: 'Can anyone lend me a few satoshi this week?',
      }),
    });
  });
}

test.describe('screen baselines', () => {
  test('screen /', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Direct human-to-human gifts/i })).toBeVisible();
    await shotScreen(page, 'screen-root');
  });

  test('state / mobile-nav', async ({ page }, testInfo) => {
    await page.goto('/');
    if (isMobileProject(testInfo)) {
      await page.getByRole('button', { name: 'Menu' }).click();
      await expect(
        page.getByLabel('Primary').getByRole('link', { name: 'Handbook' }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole('heading', { name: /Direct human-to-human gifts/i }),
      ).toBeVisible();
    }
    await shotScreen(page, 'state-root-mobile-nav');
  });

  test('state / language-open', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Language').click();
    await expect(page.getByRole('option', { name: 'Español' })).toBeVisible();
    await shotScreen(page, 'state-root-language');
  });

  test('screen /legal', async ({ page }) => {
    await page.goto('/legal');
    await expect(page.getByRole('heading', { name: 'Legal Notice' })).toBeVisible();
    await shotScreen(page, 'screen-legal');
  });

  test('screen /about', async ({ page }) => {
    await page.goto('/about');
    await expect(page.getByRole('heading', { name: 'Three convictions' })).toBeVisible();
    await shotScreen(page, 'screen-about');
  });

  test('screen /login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
    await shotScreen(page, 'screen-login');
  });

  test('screen /donate', async ({ page }) => {
    await page.goto('/donate');
    await expect(page.getByRole('heading', { name: 'Send help' })).toBeVisible();
    await shotScreen(page, 'screen-donate');
  });

  test('screen /wallet', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'ada',
          lightningAddress: 'ada@walletofsatoshi.com',
          rulesAgreedAt: 1,
          setup: null,
          missing: [],
        }),
      });
    });
    await page.goto('/wallet');
    await expect(page.getByRole('heading', { name: 'Wallet' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Activate recovery phrase' })).toBeVisible();
    await shotScreen(page, 'screen-wallet');
  });

  test('wallet phrase', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'ada',
          lightningAddress: 'ada@walletofsatoshi.com',
          rulesAgreedAt: 1,
          setup: null,
          missing: [],
          walletRequired: true,
          walletBackupSeenAt: 1,
        }),
      });
    });
    await page.goto('/wallet?visual=phrase');
    await expect(page.getByText('abandon')).toBeVisible();
    await shotScreen(page, 'state-wallet-phrase');
  });

  test('wallet setup', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          setup: 'wallet',
          walletRequired: true,
          walletBackupSeenAt: null,
          missing: ['wallet', 'name', 'username', 'lightning-address', 'rules'],
        }),
      });
    });
    await page.goto('/wallet?visual=phrase');
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
    await shotScreen(page, 'state-wallet-setup');
  });

  test('wallet confirm', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          setup: 'wallet',
          walletRequired: true,
          walletBackupSeenAt: null,
          missing: ['wallet', 'name', 'username', 'lightning-address', 'rules'],
        }),
      });
    });
    await page.goto('/wallet?visual=confirm');
    await expect(page.getByRole('button', { name: 'I saved these words' })).toBeVisible();
    await shotScreen(page, 'state-wallet-confirm');
  });

  test('wallet reveal', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'ada',
          lightningAddress: 'ada@walletofsatoshi.com',
          rulesAgreedAt: 1,
          setup: null,
          missing: [],
          walletRequired: true,
          walletBackupSeenAt: 1,
        }),
      });
    });
    await page.goto('/wallet');
    await expect(page.getByText('Advanced functions')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show recovery phrase' })).toHaveCount(0);
    await shotScreen(page, 'state-wallet-reveal');
  });

  test('wallet reveal-open', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'ada',
          lightningAddress: 'ada@walletofsatoshi.com',
          rulesAgreedAt: 1,
          setup: null,
          missing: [],
          walletRequired: true,
          walletBackupSeenAt: 1,
        }),
      });
    });
    await page.goto('/wallet');
    await page.getByText('Advanced functions').click();
    await expect(page.getByRole('button', { name: 'Show recovery phrase' })).toBeVisible();
    await shotScreen(page, 'state-wallet-reveal-open');
  });

  test('wallet error', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'ada',
          lightningAddress: 'ada@walletofsatoshi.com',
          rulesAgreedAt: 1,
          setup: null,
          missing: [],
        }),
      });
    });
    await page.goto('/wallet?visual=error');
    await expect(
      page.getByText('The recovery phrase could not be opened. Check this device and try again.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await shotScreen(page, 'state-wallet-error');
  });

  test('wallet timeout', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'ada',
          lightningAddress: 'ada@walletofsatoshi.com',
          rulesAgreedAt: 1,
          setup: null,
          missing: [],
        }),
      });
    });
    await page.goto('/wallet?visual=timeout');
    await expect(
      page.getByText('The device prompt timed out before you finished. Try again.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await shotScreen(page, 'state-wallet-timeout');
  });

  test('wallet prf-unsupported', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'ada',
          lightningAddress: 'ada@walletofsatoshi.com',
          rulesAgreedAt: 1,
          setup: null,
          missing: [],
        }),
      });
    });
    await page.goto('/wallet?visual=prf-unsupported');
    await expect(
      page.getByText(
        'This browser cannot create a recovery phrase. Try another browser or device.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await shotScreen(page, 'state-wallet-prf-unsupported');
  });

  test('screen /stats', async ({ page }) => {
    await stubPostStats(page);
    await page.route('**/gifts/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(STATS_DEFAULT),
      });
    });
    await page.goto('/stats');
    await expect(page.getByRole('heading', { name: 'Total spend over time' })).toBeVisible();
    await shotScreen(page, 'screen-stats');
  });

  test('screen /stats/[day]', async ({ page }) => {
    await page.goto('/stats/2026-06-01');
    await expect(page.getByText('alice')).toBeVisible();
    await shotScreen(page, 'screen-stats-day');
  });

  test('screen /rules', async ({ page }) => {
    await page.goto('/rules');
    await expect(page.getByText('Only free donations')).toBeVisible();
    await shotScreen(page, 'screen-rules');
  });

  test('rules signed-in', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          aboutMe: null,
          setup: null,
          missing: [],
        }),
      });
    });
    await page.goto('/rules');
    await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
    await shotScreen(page, 'state-rules-signed-in');
  });

  test('screen /404', async ({ page }) => {
    await page.goto('/404');
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await shotScreen(page, 'screen-404');
  });
});

test.describe('login variant baselines', () => {
  test('login starting', async ({ page }) => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/auth\/passkey\/authenticate\/begin$/, async (route) => {
      await held;
      await route.fulfill({ status: 503, body: 'unavailable' });
    });
    await page.goto('/login');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('Preparing your login…')).toBeVisible();
    await shotScreen(page, 'state-login-starting');
    release();
  });

  test('login error', async ({ page }) => {
    await page.route(/\/auth\/passkey\/authenticate\/begin$/, async (route) => {
      await route.fulfill({ status: 503, body: 'unavailable' });
    });
    await page.goto('/login');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('Something went wrong. Please try again.')).toBeVisible();
    await shotScreen(page, 'state-login-error');
  });

  test('login wrong-account', async ({ page }) => {
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
    await shotScreen(page, 'state-login-wrong-account');
  });

  test('login choice', async ({ page }) => {
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
            throw new Error('create must not run on the login choice path');
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
    await shotScreen(page, 'state-login-choice');
  });

  test('login in-app', async ({ page }) => {
    await page.addInitScript(() => {
      Object.assign(window, { TelegramWebviewProxy: { postEvent() {} } });
    });
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: 'Open this page in your browser' }),
    ).toBeVisible();
    await shotScreen(page, 'state-login-in-app');
  });

  test('login language-open', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Language').click();
    await expect(page.getByRole('option', { name: 'Deutsch' })).toBeVisible();
    await shotScreen(page, 'state-login-language');
  });
});

test.describe('onboarding screens', () => {
  test('screen /setup/name', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(E2E_ACCOUNT),
      });
    });
    await page.goto('/setup/name');
    await expect(page.getByRole('heading', { name: 'Your name' })).toBeVisible();
    await shotScreen(page, 'screen-setup-name');
  });

  test('screen /setup/username', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: null,
          setup: 'username',
          missing: ['username', 'lightning-address', 'rules'],
        }),
      });
    });
    await page.goto('/setup/username');
    await expect(page.getByRole('heading', { name: 'Your 21.gifts name' })).toBeVisible();
    await shotScreen(page, 'screen-setup-username');
  });

  test('screen /setup/address', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
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
    await page.goto('/setup/address');
    await expect(
      page.getByRole('heading', { name: 'Your Wallet of Satoshi address' }),
    ).toBeVisible();
    await shotScreen(page, 'screen-setup-address');
  });

  test('screen /setup/rules', async ({ page }) => {
    await openRulesSetup(page);
    await page.goto('/setup/rules');
    await expect(page.getByText('You are a guest in a living room')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
    await shotScreen(page, 'screen-setup-rules');
  });

  test('setup-rules law1', async ({ page }) => {
    await openRulesSetup(page);
    await page.goto('/setup/rules');
    await advanceRulesChapters(page, 1);
    await expect(page.getByRole('heading', { name: 'Only free donations' })).toBeVisible();
    await shotScreen(page, 'state-setup-rules-law1');
  });

  test('setup-rules law2', async ({ page }) => {
    await openRulesSetup(page);
    await page.goto('/setup/rules');
    await advanceRulesChapters(page, 2);
    await expect(page.getByRole('heading', { name: 'Donors come first' })).toBeVisible();
    await shotScreen(page, 'state-setup-rules-law2');
  });

  test('setup-rules law3', async ({ page }) => {
    await openRulesSetup(page);
    await page.goto('/setup/rules');
    await advanceRulesChapters(page, 3);
    await expect(page.getByRole('heading', { name: 'Contact stays in the app' })).toBeVisible();
    await shotScreen(page, 'state-setup-rules-law3');
  });

  test('setup-rules wanted', async ({ page }) => {
    await openRulesSetup(page);
    await page.goto('/setup/rules');
    await advanceRulesChapters(page, 4);
    await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
    await shotScreen(page, 'state-setup-rules-wanted');
  });

  test('setup-rules allowed', async ({ page }) => {
    await openRulesSetup(page);
    await page.goto('/setup/rules');
    await advanceRulesChapters(page, 5);
    await expect(page.getByRole('heading', { name: 'Allowed' })).toBeVisible();
    await shotScreen(page, 'state-setup-rules-allowed');
  });

  test('setup-rules ratherNot', async ({ page }) => {
    await openRulesSetup(page);
    await page.goto('/setup/rules');
    await advanceRulesChapters(page, 6);
    await expect(page.getByRole('heading', { name: 'Better not' })).toBeVisible();
    await shotScreen(page, 'state-setup-rules-ratherNot');
  });

  test('setup-rules forbidden', async ({ page }) => {
    await openRulesSetup(page);
    await page.goto('/setup/rules');
    await advanceRulesChapters(page, 7);
    await expect(page.getByRole('heading', { name: 'Forbidden', exact: true })).toBeVisible();
    await shotScreen(page, 'state-setup-rules-forbidden');
  });

  test('setup-rules house', async ({ page }) => {
    await openRulesSetup(page);
    await page.goto('/setup/rules');
    await advanceRulesChapters(page, 8);
    await expect(page.getByRole('heading', { name: 'Our house' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'I agree to these rules' })).toBeVisible();
    await shotScreen(page, 'state-setup-rules-house');
  });

  test('setup-rules error', async ({ page }) => {
    await openRulesSetup(page, 'fail');
    await page.goto('/setup/rules');
    await advanceRulesChapters(page, 8);
    await page.getByRole('button', { name: 'I agree to these rules' }).click();
    await expect(page.getByText('Could not save your agreement')).toBeVisible();
    await shotScreen(page, 'state-setup-rules-error');
  });

  test('setup-rules busy', async ({ page }) => {
    await openRulesSetup(page, 'hang');
    await page.goto('/setup/rules');
    await advanceRulesChapters(page, 8);
    await expect(page.getByRole('heading', { name: 'Our house' })).toBeVisible();
    await page.getByRole('button', { name: 'I agree to these rules' }).click();
    await expect(page.getByRole('button', { name: 'I agree to these rules' })).toBeDisabled();
    await shotScreen(page, 'state-setup-rules-busy');
  });

  test('screen /welcome', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          aboutMe: null,
          setup: null,
          missing: [],
        }),
      });
    });
    await fulfillMixedSatsMessages(page);
    await page.goto('/welcome');
    await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
    await expect(page.getByText('Thank you both — that helps.')).toBeVisible();
    await expect(page.getByText('I can send a small gift tomorrow.')).toBeVisible();
    await expect(page.getByText('Does anyone have spare sats this week?')).not.toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Forum view' })).toContainText('Active');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await shotScreen(page, 'screen-welcome');
  });

  test('welcome shop-tag', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
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
              text: 'Thank you both — that helps.\n\n#21GiftsShop',
              createdAt: '2026-08-28T12:00:00.000Z',
              sats: 5,
              payable: true,
              hasPhoto: false,
              role: 'moderator',
            },
            {
              id: 'm2',
              name: 'Carol',
              text: 'I can send a small gift tomorrow.',
              createdAt: '2026-08-28T11:00:00.000Z',
              sats: 21,
              payable: true,
              hasPhoto: false,
              role: 'verified',
            },
            {
              id: 'm1',
              name: 'Bob',
              text: 'Does anyone have spare sats this week?',
              createdAt: '2026-08-28T10:00:00.000Z',
              sats: 0,
              payable: true,
              hasPhoto: false,
              role: 'basis',
            },
          ],
        }),
      });
    });
    await page.goto('/welcome');
    await expect(page.getByRole('link', { name: '#Shop' })).toBeVisible();
    await shotScreen(page, 'state-welcome-shop-tag');
  });

  test('state /welcome laws', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          forumLawsDismissed: false,
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          aboutMe: null,
          setup: null,
          missing: [],
        }),
      });
    });
    await fulfillMixedSatsMessages(page);
    await page.goto('/welcome');
    await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible();
    await expect(
      page.getByText(
        '21.gifts is a donation platform: gifts are free, and nobody pays for a promise.',
      ),
    ).toBeVisible();
    await shotScreen(page, 'state-welcome-laws');
  });

  test('state /welcome expanded', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          aboutMe: null,
          setup: null,
          missing: [],
        }),
      });
    });
    await fulfillMixedSatsMessages(page);
    await page.route('**/forum/messages/**/replies', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [] }),
      });
    });
    await page.goto('/welcome');
    await page.getByText('Thank you both — that helps.').click();
    await expect(page.getByPlaceholder('Write a reaction')).toBeVisible();
    await shotScreen(page, 'state-welcome-expanded');
  });

  test('state /welcome expanded-gifts', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
        }),
      });
    });
    await fulfillMixedSatsMessages(page);
    await page.route('**/forum/messages/**/replies', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: 'r-gift',
              name: 'Bob',
              text: '',
              createdAt: '2026-08-28T12:01:00.000Z',
              sats: 21,
              payable: false,
              hasPhoto: false,
              role: 'basis',
            },
            {
              id: 'r-text',
              name: 'Carol',
              text: 'Nice one',
              createdAt: '2026-08-28T12:02:00.000Z',
              sats: 21,
              payable: false,
              hasPhoto: false,
              role: 'verified',
            },
          ],
        }),
      });
    });
    await page.goto('/welcome');
    await page.getByText('Thank you both — that helps.').click();
    await expect(page.getByText('send ₿21')).toBeVisible();
    await expect(page.getByText('Nice one')).toBeVisible();
    await shotScreen(page, 'state-welcome-expanded-gifts');
  });

  test('state /welcome expanded-external', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          location: null,
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
        }),
      });
    });
    await fulfillMixedSatsMessages(page);
    await page.route('**/forum/messages/**/replies', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: 'r-nostr-gift',
              name: 'Robin',
              via: 'nostr',
              text: '',
              createdAt: '2026-08-28T12:03:00.000Z',
              sats: 69,
              payable: false,
              hasPhoto: false,
            },
            {
              id: 'r-nostr-text',
              name: 'Robin',
              via: 'nostr',
              text: 'Greetings! https://example.com/hello',
              createdAt: '2026-08-28T12:04:00.000Z',
              sats: 0,
              payable: false,
              hasPhoto: false,
            },
          ],
        }),
      });
    });
    await page.goto('/welcome');
    await page.getByText('Thank you both — that helps.').click();
    await expect(page.getByText('External', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'External', exact: true }).first().click();
    await expect(
      page.getByText(
        'Wrote from another app, not from a 21.gifts account. Shown here because this person sent bitcoin to a post.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByText('Greetings! https://example.com/hello', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /example\.com/ })).toHaveCount(0);
    await shotScreen(page, 'state-welcome-expanded-external');
  });

  test('state /welcome quoted-note', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          role: 'founder',
          name: 'Cyrill',
          forumLawsDismissed: true,
          username: 'cyrill',
          lightningAddress: 'cyrill@walletofsatoshi.com',
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
    await expect(page.getByAltText('Photo from Cyrill')).toBeVisible();
    await expect(page.getByText(QUOTED_NOTE_URL)).not.toBeVisible();
    await shotScreen(page, 'state-welcome-quoted-note');
  });

  test('state /welcome copy', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          aboutMe: null,
          setup: null,
          missing: [],
        }),
      });
    });
    await fulfillMixedSatsMessages(page);
    await page.goto('/welcome');
    await expect(
      page.getByRole('button', { name: 'Copy link to this note' }).first(),
    ).toBeVisible();
    await shotScreen(page, 'state-welcome-copy');
  });

  test('state /welcome reply-copy', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          location: null,
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          aboutMe: null,
          setup: null,
          missing: [],
        }),
      });
    });
    await fulfillMixedSatsMessages(page);
    await page.route('**/forum/messages/**/replies', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: 'r-reply-copy',
              name: 'Bob',
              text: 'Nice one',
              createdAt: '2026-08-28T12:02:00.000Z',
              sats: 0,
              payable: false,
              hasPhoto: false,
              role: 'basis',
            },
          ],
        }),
      });
    });
    await page.goto('/welcome');
    await page.getByText('Thank you both — that helps.').click();
    await expect(page.getByRole('button', { name: 'Copy link to this reply' })).toBeVisible();
    await shotScreen(page, 'state-welcome-reply-copy');
  });

  test('state /welcome translate', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
        }),
      });
    });
    await fulfillGermanPaidAdaNote(page);
    await page.goto('/welcome');
    await expect(page.getByRole('button', { name: 'Translate' })).toBeVisible();
    await shotScreen(page, 'state-welcome-translate');
  });

  test('state /welcome translate-loading', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
        }),
      });
    });
    await fulfillGermanPaidAdaNote(page);
    await fulfillTranslatePost(page, 'hang');
    await page.goto('/welcome');
    await page.getByRole('button', { name: 'Translate' }).click();
    await expect(page.getByRole('button', { name: 'Translate' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await shotScreen(page, 'state-welcome-translate-loading');
  });

  test('state /welcome translate-done', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
        }),
      });
    });
    await fulfillGermanPaidAdaNote(page);
    await fulfillTranslatePost(page, 'ok');
    await page.goto('/welcome');
    await page.getByRole('button', { name: 'Translate' }).click();
    await expect(page.getByRole('button', { name: 'Show original' })).toBeVisible();
    await shotScreen(page, 'state-welcome-translate-done');
  });

  test('state /welcome translate-hidden', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
        }),
      });
    });
    await fulfillGermanPaidAdaNote(page);
    await fulfillTranslatePost(page, 'ok');
    await page.goto('/welcome');
    await page.getByRole('button', { name: 'Translate' }).click();
    await expect(page.getByRole('button', { name: 'Show original' })).toBeVisible();
    await page.getByRole('button', { name: 'Show original' }).click();
    await expect(page.getByRole('button', { name: 'Show translation' })).toBeVisible();
    await shotScreen(page, 'state-welcome-translate-hidden');
  });

  test('state /welcome translate-error', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
        }),
      });
    });
    await fulfillGermanPaidAdaNote(page);
    await fulfillTranslatePost(page, 'fail');
    await page.goto('/welcome');
    await page.getByRole('button', { name: 'Translate' }).click();
    await expect(page.getByText('Could not translate this note. Please try again.')).toBeVisible();
    await shotScreen(page, 'state-welcome-translate-error');
  });

  test('state /welcome note-truncated', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
        }),
      });
    });
    const tail = 'TAILTOKEN';
    const text = `${'Good morning everyone. '.repeat(14)}${tail}`;
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
    await shotScreen(page, 'state-welcome-note-truncated');
  });

  test('state /welcome new-posts', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
        }),
      });
    });
    const baseMessages = Array.from({ length: 12 }, (_, index) => ({
      id: `m-tall-${String(index)}`,
      name: 'Ada',
      text: `Tall note ${String(index)} so the welcome list can scroll past the top.`,
      createdAt: `2026-08-28T12:${String(index).padStart(2, '0')}:00.000Z`,
      sats: 21,
      payable: true,
      hasPhoto: false,
      hasVideo: false,
      videoContentType: null,
      role: 'basis' as const,
      replyCount: 0,
    }));
    let messagesBody: { messages: typeof baseMessages } = { messages: baseMessages };
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
        return;
      }
      window.scrollTo(0, 900);
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
        ...baseMessages,
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
    // Viewport shot: fullPage stitches the sticky New posts pill into a random chunk.
    await shotScreen(page, 'state-welcome-new-posts', false);
  });

  test('state /welcome moderator-appointed', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          forumLawsDismissed: true,
          viewKey: 'a'.repeat(64),
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
    await page.route('**/forum/notifications', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          notifications: [
            {
              id: 'n-appointed',
              type: 'moderator_appointed',
              parentId: 'acc_e2e',
              replyId: 'acc_e2e',
              name: 'Cyrill',
              text: '',
              createdAt: '2026-09-16T12:00:00.000Z',
              readAt: null,
            },
          ],
          unreadCount: 1,
        }),
      });
    });
    await page.goto('/welcome');
    await expect(page.getByRole('button', { name: 'You are a moderator' })).toBeVisible();
    await shotScreen(page, 'state-welcome-moderator-appointed', false);
  });

  test('screen /profile', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
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
        body: JSON.stringify(EMPTY_ACTIVITY),
      });
    });
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await shotScreen(page, 'screen-profile');
  });

  test('screen /pos', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
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
    await shotScreen(page, 'screen-pos');
  });

  test('pos open', async ({ page }) => {
    await page.addInitScript(() => {
      const fixed = Date.parse('2026-09-20T12:00:00.000Z');
      Date.now = () => fixed;
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
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
        body: JSON.stringify({
          charge: {
            id: 'pos-e2e',
            amountSats: 21,
            status: 'pending',
            createdAt: '2026-09-20T12:00:00.000Z',
            expiresAt: '2026-09-20T12:05:00.000Z',
          },
          history: [
            {
              id: 'pos-e2e',
              amountSats: 21,
              status: 'pending',
              createdAt: '2026-09-20T12:00:00.000Z',
              expiresAt: '2026-09-20T12:05:00.000Z',
            },
          ],
        }),
      });
    });
    await page.goto('/pos');
    await expect(page.getByRole('heading', { name: 'Point of sale' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByText('5:00 left')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create payment' })).toHaveCount(0);
    await page.getByRole('heading', { name: 'History' }).scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-pos-open');
  });

  test('pos loading', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          aboutMe: null,
          setup: null,
          missing: [],
        }),
      });
    });
    await page.route(/\/pos\/charge$/, () => new Promise(() => undefined));
    await page.goto('/pos');
    await expect(page.getByRole('heading', { name: 'Point of sale' })).toBeVisible();
    await expect(page.locator('.animate-spin')).toBeVisible();
    await shotScreen(page, 'state-pos-loading');
  });

  test('pos error', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
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
        status: 500,
        contentType: 'application/json',
        body: '{"error":"nope"}',
      });
    });
    await page.goto('/pos');
    await expect(page.getByText('Point of sale is unavailable.')).toBeVisible();
    await shotScreen(page, 'state-pos-error');
  });

  test('pos bad amount', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
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
    await page.getByLabel('Amount').fill('1.5');
    await page.getByRole('button', { name: 'Create payment' }).click();
    await expect(page.getByText('Enter a whole number.')).toBeVisible();
    await shotScreen(page, 'state-pos-bad-amount');
  });

  test('pos create outside', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
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
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Amount is outside the wallet range' }),
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
    await expect(page.getByText('Amount is outside the wallet range.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create payment' })).toBeVisible();
    await page.getByText('Amount is outside the wallet range.').scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-pos-create-outside');
  });

  test('pos create already', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
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
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'A payment is already open' }),
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
    await expect(page.getByText('A payment is already open.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create payment' })).toBeVisible();
    await page.getByText('A payment is already open.').scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-pos-create-already');
  });

  test('pos create failed', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
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
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
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
    await expect(page.getByText('Point of sale is unavailable.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create payment' })).toBeVisible();
    await page.getByText('Point of sale is unavailable.').scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-pos-create-failed');
  });

  test('pos cancel failed', async ({ page }) => {
    await page.addInitScript(() => {
      const fixed = Date.parse('2026-09-20T12:00:00.000Z');
      Date.now = () => fixed;
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
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
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          charge: {
            id: 'pos-e2e',
            amountSats: 21,
            status: 'pending',
            createdAt: '2026-09-20T12:00:00.000Z',
            expiresAt: '2026-09-20T12:05:00.000Z',
          },
          history: [
            {
              id: 'pos-e2e',
              amountSats: 21,
              status: 'pending',
              createdAt: '2026-09-20T12:00:00.000Z',
              expiresAt: '2026-09-20T12:05:00.000Z',
            },
          ],
        }),
      });
    });
    await page.goto('/pos');
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Point of sale is unavailable.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await page.getByRole('heading', { name: 'History' }).scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-pos-cancel-failed');
  });

  test('pos refresh failed', async ({ page }) => {
    await page.addInitScript(() => {
      const fixed = Date.parse('2026-09-20T12:00:00.000Z');
      Date.now = () => fixed;
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          aboutMe: null,
          setup: null,
          missing: [],
        }),
      });
    });
    let gets = 0;
    await page.route(/\/pos\/charge$/, async (route) => {
      gets += 1;
      if (gets > 1) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          charge: {
            id: 'pos-e2e',
            amountSats: 21,
            status: 'pending',
            createdAt: '2026-09-20T11:55:00.000Z',
            expiresAt: '2026-09-20T12:00:00.000Z',
          },
          history: [
            {
              id: 'pos-e2e',
              amountSats: 21,
              status: 'pending',
              createdAt: '2026-09-20T11:55:00.000Z',
              expiresAt: '2026-09-20T12:00:00.000Z',
            },
          ],
        }),
      });
    });
    await page.goto('/pos');
    await expect(page.getByText('Point of sale is unavailable.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByText('0:00 left')).toBeVisible();
    await page.getByRole('heading', { name: 'History' }).scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-pos-refresh-failed');
  });

  test('pos history', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
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
        body: JSON.stringify({
          charge: null,
          history: [
            {
              id: 'c2',
              amountSats: 5,
              status: 'cancelled',
              createdAt: '2026-09-20T12:00:00.000Z',
              expiresAt: '2026-09-20T12:05:00.000Z',
            },
            {
              id: 'c3',
              amountSats: 8,
              status: 'expired',
              createdAt: '2026-09-20T11:00:00.000Z',
              expiresAt: '2026-09-20T11:05:00.000Z',
            },
          ],
        }),
      });
    });
    await page.goto('/pos');
    await expect(page.getByText('Cancelled')).toBeVisible();
    await expect(page.getByText('Expired')).toBeVisible();
    await page.getByRole('heading', { name: 'History' }).scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-pos-history');
  });

  test('pos need username', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: null,
          lightningAddress: null,
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
    await expect(page.getByRole('link', { name: 'Set a username first.' })).toBeVisible();
    await shotScreen(page, 'state-pos-need-username');
  });

  test('pos need address', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: null,
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
    await expect(
      page.getByRole('link', { name: 'Set a Wallet of Satoshi address first.' }),
    ).toBeVisible();
    await shotScreen(page, 'state-pos-need-address');
  });

  test('profile fiat', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
        }),
      });
    });
    await page.route(/\/me\/activity(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EMPTY_ACTIVITY),
      });
    });
    await page.goto('/profile');
    const group = page.getByRole('group', { name: 'Fiat currency' }).last();
    await expect(group.getByRole('button', { name: 'CHF' })).toBeVisible();
    await group.scrollIntoViewIfNeeded();
    // Viewport-only capture after AppShell scroller scroll keeps the Fiat
    // currency row in frame.
    await shotScreen(page, 'state-profile-fiat', false);
  });

  test('screen /members/[accountId]', async ({ page }) => {
    const memberId = '22222222-2222-4222-8222-222222222222';
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
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
          username: 'carol',
          lightningAddress: 'carol@walletofsatoshi.com',
          createdAt: '2026-01-15T12:00:00.000Z',
          aboutMe: 'Hello from Carol.',
          profileMessage: {
            id: '33333333-3333-4333-8333-333333333333',
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
    await page.goto(`/members/${memberId}`);
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(page.getByText('About me')).toBeVisible();
    await expect(page.getByText('Hello from Carol.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy link to this profile' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Message' })).toBeVisible();
    await shotScreen(page, 'screen-members-accountId');
  });

  test('state /members posts-open', async ({ page }) => {
    const memberId = '22222222-2222-4222-8222-222222222222';
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
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
          username: 'carol',
          lightningAddress: 'carol@walletofsatoshi.com',
          createdAt: '2026-01-15T12:00:00.000Z',
          aboutMe: null,
          profileMessage: {
            id: '33333333-3333-4333-8333-333333333333',
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
    await page.route(`**/forum/members/${memberId}/posts`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: '44444444-4444-4444-8444-444444444444',
              accountId: memberId,
              name: 'Carol',
              text: 'Second post from Carol.',
              createdAt: '2026-08-02T10:00:00.000Z',
              sats: 0,
              payable: true,
              hasPhoto: false,
              hasVideo: false,
              videoContentType: null,
              role: 'verified',
              replyCount: 0,
            },
          ],
        }),
      });
    });
    await page.goto(`/members/${memberId}`);
    await page.getByRole('button', { name: '1 posts' }).click();
    await expect(page.getByText('Second post from Carol.')).toBeVisible();
    await expect(page.getByText('Hello from my profile note.')).toHaveCount(0);
    await page.getByText('Second post from Carol.').scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-members-posts-open');
  });

  test('state /members posts-open-photo', async ({ page }) => {
    const memberId = '22222222-2222-4222-8222-222222222222';
    const postId = '44444444-4444-4444-8444-444444444444';
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
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
          username: 'carol',
          lightningAddress: 'carol@walletofsatoshi.com',
          createdAt: '2026-01-15T12:00:00.000Z',
          aboutMe: null,
          profileMessage: {
            id: '33333333-3333-4333-8333-333333333333',
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
    await page.route(`**/forum/members/${memberId}/posts`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: postId,
              accountId: memberId,
              name: 'Carol',
              text: 'Second post from Carol.',
              createdAt: '2026-08-02T10:00:00.000Z',
              sats: 0,
              payable: true,
              hasPhoto: true,
              hasVideo: false,
              videoContentType: null,
              role: 'verified',
              replyCount: 0,
            },
          ],
        }),
      });
    });
    await page.route(`**/messages/${postId}/photo`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/jpeg',
        // 1×1 JPEG — ForumBoard `w-full max-h-80` paints it as a large black square.
        body: Buffer.from(
          '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
          'base64',
        ),
      });
    });
    await page.goto(`/members/${memberId}`);
    await page.getByRole('button', { name: '1 posts' }).click();
    await expect(page.getByText('Second post from Carol.')).toBeVisible();
    const photo = page.getByAltText('Photo from Carol');
    await expect(photo).toBeVisible();
    await photo.scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-members-posts-open-photo');
  });

  test('state /members posts-open-goal-110', async ({ page }) => {
    const memberId = '22222222-2222-4222-8222-222222222222';
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
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
          username: 'carol',
          lightningAddress: 'carol@walletofsatoshi.com',
          createdAt: '2026-01-15T12:00:00.000Z',
          aboutMe: null,
          profileMessage: {
            id: '33333333-3333-4333-8333-333333333333',
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
    await page.route(`**/forum/members/${memberId}/posts`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: '44444444-4444-4444-8444-444444444444',
              accountId: memberId,
              name: 'Carol',
              text: 'Goal note at one hundred ten percent',
              createdAt: '2026-08-02T10:00:00.000Z',
              sats: 23100,
              goalSats: 21000,
              payable: true,
              hasPhoto: false,
              hasVideo: false,
              videoContentType: null,
              role: 'verified',
              replyCount: 0,
            },
          ],
        }),
      });
    });
    await fulfillRateDay(page);
    await page.goto(`/members/${memberId}`);
    await page.getByRole('button', { name: '1 posts' }).click();
    await expect(page.getByText('Goal note at one hundred ten percent')).toBeVisible();
    await expect(page.getByText('110%')).toBeVisible();
    await expect(page.getByText("₿21'000")).toBeVisible();
    await expect(page.getByText('$21.00')).toBeVisible();
    await page.getByText('Goal note at one hundred ten percent').scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-members-posts-open-goal-110');
  });

  test('state /members posts-open-photos', async ({ page }) => {
    const memberId = '22222222-2222-4222-8222-222222222222';
    const postId = '44444444-4444-4444-8444-444444444444';
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
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
          username: 'carol',
          lightningAddress: 'carol@walletofsatoshi.com',
          createdAt: '2026-01-15T12:00:00.000Z',
          aboutMe: null,
          profileMessage: {
            id: '33333333-3333-4333-8333-333333333333',
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
    await page.route(`**/forum/members/${memberId}/posts`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: postId,
              accountId: memberId,
              name: 'Carol',
              text: 'Second post from Carol.',
              createdAt: '2026-08-02T10:00:00.000Z',
              sats: 0,
              payable: true,
              hasPhoto: true,
              photoCount: 2,
              hasVideo: false,
              videoContentType: null,
              role: 'verified',
              replyCount: 0,
            },
          ],
        }),
      });
    });
    await page.route(`**/messages/${postId}/photo`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/jpeg',
        body: Buffer.from(
          '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
          'base64',
        ),
      });
    });
    await page.route(`**/messages/${postId}/photo/1.jpg`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/jpeg',
        body: Buffer.from(
          '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
          'base64',
        ),
      });
    });
    await page.goto(`/members/${memberId}`);
    await page.getByRole('button', { name: '1 posts' }).click();
    await expect(page.getByText('Second post from Carol.')).toBeVisible();
    const photos = page.getByAltText('Photo from Carol');
    await expect(photos).toHaveCount(2);
    await photos.first().scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-members-posts-open-photos');
  });

  test('state /members replies-open', async ({ page }) => {
    const memberId = '22222222-2222-4222-8222-222222222222';
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
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
          username: 'carol',
          lightningAddress: 'carol@walletofsatoshi.com',
          createdAt: '2026-01-15T12:00:00.000Z',
          aboutMe: null,
          profileMessage: {
            id: '33333333-3333-4333-8333-333333333333',
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
          replyCount: 1,
        }),
      });
    });
    await page.route(`**/forum/members/${memberId}/replies`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: '66666666-6666-4666-8666-666666666666',
              accountId: memberId,
              name: 'Carol',
              text: 'A reply from Carol.',
              createdAt: '2026-08-03T10:00:00.000Z',
              sats: 0,
              payable: false,
              hasPhoto: false,
              hasVideo: false,
              videoContentType: null,
              role: 'verified',
              replyCount: 0,
              parentId: '55555555-5555-4555-8555-555555555555',
            },
          ],
        }),
      });
    });
    await page.goto(`/members/${memberId}`);
    await page.getByRole('button', { name: '1 reactions' }).click();
    await expect(page.getByText('A reply from Carol.')).toBeVisible();
    await expect(page.getByText('Hello from my profile note.')).toHaveCount(0);
    await page.getByText('A reply from Carol.').scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-members-replies-open');
  });

  test('state-members-posts-loading', async ({ page }) => {
    const memberId = '22222222-2222-4222-8222-222222222222';
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
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
          username: 'carol',
          lightningAddress: 'carol@walletofsatoshi.com',
          createdAt: '2026-01-15T12:00:00.000Z',
          aboutMe: null,
          profileMessage: {
            id: '33333333-3333-4333-8333-333333333333',
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
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`**/forum/members/${memberId}/posts`, async (route) => {
      await held;
      await route.abort();
    });
    await page.goto(`/members/${memberId}`);
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await page.getByRole('button', { name: '1 posts' }).click();
    const postsLoading = page.getByRole('paragraph').filter({ hasText: 'Loading…' });
    await expect(postsLoading).toBeVisible();
    await expect(page.getByText('Hello from my profile note.')).toHaveCount(0);
    await postsLoading.scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-members-posts-loading');
    release();
  });

  test('state-members-replies-loading', async ({ page }) => {
    const memberId = '22222222-2222-4222-8222-222222222222';
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
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
          username: 'carol',
          lightningAddress: 'carol@walletofsatoshi.com',
          createdAt: '2026-01-15T12:00:00.000Z',
          aboutMe: null,
          profileMessage: {
            id: '33333333-3333-4333-8333-333333333333',
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
          replyCount: 1,
        }),
      });
    });
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`**/forum/members/${memberId}/replies`, async (route) => {
      await held;
      await route.abort();
    });
    await page.goto(`/members/${memberId}`);
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await page.getByRole('button', { name: '1 reactions' }).click();
    const repliesLoading = page.getByRole('paragraph').filter({ hasText: 'Loading…' });
    await expect(repliesLoading).toBeVisible();
    await expect(page.getByText('Hello from my profile note.')).toHaveCount(0);
    await repliesLoading.scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-members-replies-loading');
    release();
  });

  test('state /members posts-error', async ({ page }) => {
    const memberId = '22222222-2222-4222-8222-222222222222';
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
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
          username: 'carol',
          lightningAddress: 'carol@walletofsatoshi.com',
          createdAt: '2026-01-15T12:00:00.000Z',
          aboutMe: null,
          profileMessage: {
            id: '33333333-3333-4333-8333-333333333333',
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
    await page.route(`**/forum/members/${memberId}/posts`, async (route) => {
      await route.abort();
    });
    await page.goto(`/members/${memberId}`);
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await page.getByRole('button', { name: '1 posts' }).click();
    await expect(page.getByText('Could not load messages. Please try again.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.getByText('Hello from my profile note.')).toHaveCount(0);
    await page.getByText('Could not load messages. Please try again.').scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-members-posts-error');
  });

  test('state-members-replies-error', async ({ page }) => {
    const memberId = '22222222-2222-4222-8222-222222222222';
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
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
          username: 'carol',
          lightningAddress: 'carol@walletofsatoshi.com',
          createdAt: '2026-01-15T12:00:00.000Z',
          aboutMe: null,
          profileMessage: {
            id: '33333333-3333-4333-8333-333333333333',
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
          replyCount: 1,
        }),
      });
    });
    await page.route(`**/forum/members/${memberId}/replies`, async (route) => {
      await route.abort();
    });
    await page.goto(`/members/${memberId}`);
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await page.getByRole('button', { name: '1 reactions' }).click();
    await expect(page.getByText('Could not load messages. Please try again.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.getByText('Hello from my profile note.')).toHaveCount(0);
    await page.getByText('Could not load messages. Please try again.').scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-members-replies-error');
  });

  test('state /members posts-truncated', async ({ page }) => {
    const memberId = '22222222-2222-4222-8222-222222222222';
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
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
          username: 'carol',
          lightningAddress: 'carol@walletofsatoshi.com',
          createdAt: '2026-01-15T12:00:00.000Z',
          aboutMe: null,
          profileMessage: {
            id: '33333333-3333-4333-8333-333333333333',
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
          postCount: 3,
          replyCount: 0,
        }),
      });
    });
    await page.route(`**/forum/members/${memberId}/posts`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: '44444444-4444-4444-8444-444444444444',
              accountId: memberId,
              name: 'Carol',
              text: 'Second post from Carol.',
              createdAt: '2026-08-02T10:00:00.000Z',
              sats: 0,
              payable: true,
              hasPhoto: false,
              hasVideo: false,
              videoContentType: null,
              role: 'verified',
              replyCount: 0,
            },
          ],
        }),
      });
    });
    await page.goto(`/members/${memberId}`);
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await page.getByRole('button', { name: '3 posts' }).click();
    await expect(page.getByText('Showing the latest 1 of 3.')).toBeVisible();
    await expect(page.getByText('Hello from my profile note.')).toHaveCount(0);
    await page.getByText('Showing the latest 1 of 3.').scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-members-posts-truncated');
  });

  test('state-members-replies-truncated', async ({ page }) => {
    const memberId = '22222222-2222-4222-8222-222222222222';
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
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
          username: 'carol',
          lightningAddress: 'carol@walletofsatoshi.com',
          createdAt: '2026-01-15T12:00:00.000Z',
          aboutMe: null,
          profileMessage: {
            id: '33333333-3333-4333-8333-333333333333',
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
          replyCount: 3,
        }),
      });
    });
    await page.route(`**/forum/members/${memberId}/replies`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: '66666666-6666-4666-8666-666666666666',
              accountId: memberId,
              name: 'Carol',
              text: 'A reply from Carol.',
              createdAt: '2026-08-03T10:00:00.000Z',
              sats: 0,
              payable: false,
              hasPhoto: false,
              hasVideo: false,
              videoContentType: null,
              role: 'verified',
              replyCount: 0,
              parentId: '55555555-5555-4555-8555-555555555555',
            },
          ],
        }),
      });
    });
    await page.goto(`/members/${memberId}`);
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await page.getByRole('button', { name: '3 reactions' }).click();
    await expect(page.getByText('Showing the latest 1 of 3.')).toBeVisible();
    await expect(page.getByText('Hello from my profile note.')).toHaveCount(0);
    await page.getByText('Showing the latest 1 of 3.').scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-members-replies-truncated');
  });

  test('state /members note-null', async ({ page }) => {
    const memberId = '22222222-2222-4222-8222-222222222222';
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
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
          username: 'carol',
          lightningAddress: 'carol@walletofsatoshi.com',
          createdAt: '2026-01-15T12:00:00.000Z',
          aboutMe: null,
          profileMessage: null,
          postCount: 0,
          replyCount: 0,
        }),
      });
    });
    await page.goto(`/members/${memberId}`);
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(page.getByText('carol@21.gifts')).toBeVisible();
    await expect(page.getByText('profileMessage: null')).toHaveCount(0);
    await shotScreen(page, 'state-members-note-null');
  });

  test('state /members missing', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          setup: null,
          missing: [],
        }),
      });
    });
    await page.goto('/members/not-a-uuid');
    await expect(page.getByText('This profile could not be found.')).toBeVisible();
    await shotScreen(page, 'state-members-missing');
  });

  test('state /members error', async ({ page }) => {
    const memberId = '22222222-2222-4222-8222-222222222222';
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          setup: null,
          missing: [],
        }),
      });
    });
    await page.route(`**/forum/members/${memberId}`, async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    });
    await page.goto(`/members/${memberId}`);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await shotScreen(page, 'state-members-error');
  });

  test('state /members own', async ({ page }) => {
    const ownId = '11111111-1111-4111-8111-111111111111';
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          id: ownId,
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          setup: null,
          missing: [],
        }),
      });
    });
    await page.route(`**/forum/members/${ownId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: ownId,
          name: 'Ada',
          location: null,
          role: 'basis',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          createdAt: '2026-01-15T12:00:00.000Z',
          aboutMe: null,
          profileMessage: null,
          postCount: 0,
          replyCount: 0,
        }),
      });
    });
    await page.goto(`/members/${ownId}`);
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(page.getByText('Ada')).toBeVisible();
    await shotScreen(page, 'state-members-own');
  });

  test('state /members overlay-address', async ({ page }) => {
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
          ...E2E_ACCOUNT,
          name: 'Ada',
          location: null,
          lightningAddress: null,
          rulesAgreedAt: 1_700_000_001,
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
          username: 'carol',
          lightningAddress: 'carol@walletofsatoshi.com',
          createdAt: '2026-01-15T12:00:00.000Z',
          aboutMe: null,
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
              hasVideo: false,
              videoContentType: null,
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
    await page.getByLabel('Amount').fill('1');
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(
      page.getByRole('dialog', { name: 'Add your Wallet of Satoshi address' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0);
    await shotScreen(page, 'state-members-overlay-address');
  });

  test('state /members overlay-username', async ({ page }) => {
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
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: null,
          location: null,
          lightningAddress: 'ada@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          setup: null,
          missing: ['username'],
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
          username: 'carol',
          lightningAddress: 'carol@walletofsatoshi.com',
          createdAt: '2026-01-15T12:00:00.000Z',
          aboutMe: null,
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
              hasVideo: false,
              videoContentType: null,
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
    await page.getByLabel('Amount').fill('1');
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Add your 21.gifts name' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0);
    await shotScreen(page, 'state-members-overlay-username');
  });

  test('state /members staff-verify', async ({ page }) => {
    const staffId = '11111111-1111-4111-8111-111111111111';
    const memberId = '22222222-2222-4222-8222-222222222222';
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          id: staffId,
          role: 'moderator',
          name: 'Severin',
          lightningAddress: 'sev@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
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
          name: 'Ada',
          location: null,
          role: 'basis',
          username: 'alice',
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
    await expect(page.getByTestId('state-members-staff-verify')).toBeVisible();
    await expect(page.getByText('Moderator functions')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Verify' })).toHaveCount(0);
    await shotScreen(page, 'state-members-staff-verify');
  });

  test('state /members staff-verify-open', async ({ page }) => {
    const staffId = '11111111-1111-4111-8111-111111111111';
    const memberId = '22222222-2222-4222-8222-222222222222';
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          id: staffId,
          role: 'moderator',
          name: 'Severin',
          lightningAddress: 'sev@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
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
          name: 'Ada',
          location: null,
          role: 'basis',
          username: 'alice',
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
    const disclosure = page.getByText('Moderator functions');
    await disclosure.click();
    const verify = page.getByRole('button', { name: 'Verify' });
    await expect(verify).toBeVisible();
    await expect(page.getByTestId('staff-functions')).toHaveJSProperty('open', true);
    await verify.scrollIntoViewIfNeeded();
    // The member card scrolls inside the page frame. A full-page stitch leaves
    // Verify below the viewport, so this shot is the viewport after that scroll.
    await shotScreen(page, 'state-members-staff-verify-open', false);
  });

  test('state /members funding-reviewed', async ({ page }) => {
    const memberId = '22222222-2222-4222-8222-222222222222';
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
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
          profileMessage: null,
          postCount: 0,
          replyCount: 0,
          fundingReviewedAt: Date.parse('2026-08-28T12:00:00.000Z'),
        }),
      });
    });
    await page.goto(`/members/${memberId}`);
    await expect(page.getByRole('button', { name: /Reviewed by a moderator on/ })).toBeVisible();
    await shotScreen(page, 'state-members-funding-reviewed');
  });

  test('state /members funding-reviewed-open', async ({ page }) => {
    const memberId = '22222222-2222-4222-8222-222222222222';
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
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
          profileMessage: null,
          postCount: 0,
          replyCount: 0,
          fundingReviewedAt: Date.parse('2026-08-28T12:00:00.000Z'),
        }),
      });
    });
    await page.goto(`/members/${memberId}`);
    await page.getByRole('button', { name: /Reviewed by a moderator on/ }).click();
    await expect(page.getByText('Reviewed by a moderator', { exact: true })).toBeVisible();
    await shotScreen(page, 'state-members-funding-reviewed-open');
  });

  test('state /members sticker-open', async ({ page }, testInfo) => {
    await seedShopStickerMember(page);
    if (isMobileProject(testInfo)) {
      // iPhone UA: no payment QR, so no Shop sticker button either
      await expect(page.getByRole('button', { name: 'Shop sticker' })).toHaveCount(0);
      await shotScreen(page, 'state-members-sticker-open');
      return;
    }
    const dialog = await openShopStickerOverlay(page);
    await expect(dialog.getByRole('button', { name: 'PDF' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await shotScreen(page, 'state-members-sticker-open', false);
  });

  test('state /members sticker-busy', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      // the PNG encode never finishes, so Download stays disabled
      HTMLCanvasElement.prototype.toBlob = function toBlob(): void {};
    });
    await seedShopStickerMember(page);
    if (isMobileProject(testInfo)) {
      await expect(page.getByRole('button', { name: 'Shop sticker' })).toHaveCount(0);
      await shotScreen(page, 'state-members-sticker-busy');
      return;
    }
    const dialog = await openShopStickerOverlay(page);
    await dialog.getByRole('button', { name: 'PNG' }).click();
    await dialog.getByRole('button', { name: 'Download' }).click();
    await expect(dialog.getByRole('button', { name: 'Download' })).toBeDisabled();
    await shotScreen(page, 'state-members-sticker-busy', false);
  });

  test('state /members sticker-failed', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.toBlob = function toBlob(callback: BlobCallback): void {
        callback(null);
      };
    });
    await seedShopStickerMember(page);
    if (isMobileProject(testInfo)) {
      await expect(page.getByRole('button', { name: 'Shop sticker' })).toHaveCount(0);
      await shotScreen(page, 'state-members-sticker-failed');
      return;
    }
    const dialog = await openShopStickerOverlay(page);
    await dialog.getByRole('button', { name: 'PNG' }).click();
    await dialog.getByRole('button', { name: 'Download' }).click();
    await expect(dialog.getByRole('alert')).toHaveText(
      'Could not create the file. Please try again.',
    );
    await shotScreen(page, 'state-members-sticker-failed', false);
  });

  test('state /members translate', async ({ page }) => {
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
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
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
          username: 'carol',
          lightningAddress: 'carol@walletofsatoshi.com',
          createdAt: '2026-01-15T12:00:00.000Z',
          aboutMe: null,
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
              text: GERMAN_NOTE_TEXT,
              createdAt: '2026-08-01T10:00:00.000Z',
              sats: 21,
              payable: true,
              hasPhoto: false,
              hasVideo: false,
              videoContentType: null,
              role: 'verified',
              replyCount: 0,
            },
          ],
        }),
      });
    });
    await page.goto(`/members/${memberId}`);
    await page.getByRole('button', { name: '1 posts' }).click();
    await expect(page.getByText(GERMAN_NOTE_TEXT)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Translate' })).toBeVisible();
    await page.getByRole('button', { name: 'Translate' }).scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-members-translate');
  });

  test('state /members translate-loading', async ({ page }) => {
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
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
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
          username: 'carol',
          lightningAddress: 'carol@walletofsatoshi.com',
          createdAt: '2026-01-15T12:00:00.000Z',
          aboutMe: null,
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
              text: GERMAN_NOTE_TEXT,
              createdAt: '2026-08-01T10:00:00.000Z',
              sats: 21,
              payable: true,
              hasPhoto: false,
              hasVideo: false,
              videoContentType: null,
              role: 'verified',
              replyCount: 0,
            },
          ],
        }),
      });
    });
    await fulfillTranslatePost(page, 'hang');
    await page.goto(`/members/${memberId}`);
    await page.getByRole('button', { name: '1 posts' }).click();
    await page.getByRole('button', { name: 'Translate' }).click();
    await expect(page.getByRole('button', { name: 'Translate' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await page.getByRole('button', { name: 'Translate' }).scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-members-translate-loading');
  });

  test('state /members translate-done', async ({ page }) => {
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
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
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
          username: 'carol',
          lightningAddress: 'carol@walletofsatoshi.com',
          createdAt: '2026-01-15T12:00:00.000Z',
          aboutMe: null,
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
              text: GERMAN_NOTE_TEXT,
              createdAt: '2026-08-01T10:00:00.000Z',
              sats: 21,
              payable: true,
              hasPhoto: false,
              hasVideo: false,
              videoContentType: null,
              role: 'verified',
              replyCount: 0,
            },
          ],
        }),
      });
    });
    await fulfillTranslatePost(page, 'ok');
    await page.goto(`/members/${memberId}`);
    await page.getByRole('button', { name: '1 posts' }).click();
    await page.getByRole('button', { name: 'Translate' }).click();
    await expect(page.getByRole('button', { name: 'Show original' })).toBeVisible();
    await page.getByRole('button', { name: 'Show original' }).scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-members-translate-done');
  });

  test('state /members translate-hidden', async ({ page }) => {
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
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
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
          username: 'carol',
          lightningAddress: 'carol@walletofsatoshi.com',
          createdAt: '2026-01-15T12:00:00.000Z',
          aboutMe: null,
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
              text: GERMAN_NOTE_TEXT,
              createdAt: '2026-08-01T10:00:00.000Z',
              sats: 21,
              payable: true,
              hasPhoto: false,
              hasVideo: false,
              videoContentType: null,
              role: 'verified',
              replyCount: 0,
            },
          ],
        }),
      });
    });
    await fulfillTranslatePost(page, 'ok');
    await page.goto(`/members/${memberId}`);
    await page.getByRole('button', { name: '1 posts' }).click();
    await page.getByRole('button', { name: 'Translate' }).click();
    await expect(page.getByRole('button', { name: 'Show original' })).toBeVisible();
    await page.getByRole('button', { name: 'Show original' }).click();
    await expect(page.getByRole('button', { name: 'Show translation' })).toBeVisible();
    await page.getByRole('button', { name: 'Show translation' }).scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-members-translate-hidden');
  });

  test('state /members translate-error', async ({ page }) => {
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
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
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
          username: 'carol',
          lightningAddress: 'carol@walletofsatoshi.com',
          createdAt: '2026-01-15T12:00:00.000Z',
          aboutMe: null,
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
              text: GERMAN_NOTE_TEXT,
              createdAt: '2026-08-01T10:00:00.000Z',
              sats: 21,
              payable: true,
              hasPhoto: false,
              hasVideo: false,
              videoContentType: null,
              role: 'verified',
              replyCount: 0,
            },
          ],
        }),
      });
    });
    await fulfillTranslatePost(page, 'fail');
    await page.goto(`/members/${memberId}`);
    await page.getByRole('button', { name: '1 posts' }).click();
    await page.getByRole('button', { name: 'Translate' }).click();
    await expect(page.getByText('Could not translate this note. Please try again.')).toBeVisible();
    await page
      .getByText('Could not translate this note. Please try again.')
      .scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-members-translate-error');
  });

  test('screen /messages/[id] default', async ({ page }) => {
    const id = '11111111-1111-4111-8111-111111111111';
    await fulfillPublicThreadReplies(page, id);
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
    await shotScreen(page, 'screen-messages-id');
  });

  test('state /messages/[id] goal-110', async ({ page }) => {
    const id = '11111111-1111-4111-8111-111111111111';
    await fulfillRateDay(page);
    await fulfillPublicThreadReplies(page, id);
    await page.route(`**/public-messages/${id}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id,
          name: 'Ada',
          text: 'Goal note at one hundred ten percent',
          createdAt: '2026-08-28T12:00:00.000Z',
          sats: 23100,
          goalSats: 21000,
          payable: true,
          hasPhoto: false,
          role: 'basis',
          replyCount: 0,
        }),
      });
    });
    await page.goto(`/messages/${id}`);
    await expect(page.getByText('110%')).toBeVisible();
    await expect(page.getByText("₿21'000")).toBeVisible();
    await expect(page.getByText('$21.00')).toBeVisible();
    await shotScreen(page, 'state-messages-id-goal-110');
  });

  test('state /messages/[id] photos', async ({ page }) => {
    const id = '11111111-1111-4111-8111-111111111112';
    const jpeg = Buffer.from(
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
      'base64',
    );
    await fulfillPublicThreadReplies(page, id);
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
          photoCount: 2,
          role: 'basis',
          replyCount: 0,
        }),
      });
    });
    await page.route(`**/messages/${id}/photo`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/jpeg', body: jpeg });
    });
    await page.route(`**/messages/${id}/photo/1.jpg`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/jpeg', body: jpeg });
    });
    await page.goto(`/messages/${id}`);
    await expect(page.getByAltText('Photo from Ada')).toHaveCount(2);
    await expect(page.getByText('1/2')).toBeVisible();
    await shotScreen(page, 'state-messages-id-photos');
  });

  test('state /messages/[id] signed-in', async ({ page }) => {
    const id = '11111111-1111-4111-8111-111111111111';
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
        }),
      });
    });
    await fulfillPublicThreadReplies(page, id);
    await page.route(`**/forum/messages/${id}/replies`, async (route) => {
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
    await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy link to this note' })).toBeVisible();
    await expect(page.getByPlaceholder('Write a reaction')).toBeVisible();
    await shotScreen(page, 'state-messages-id-signed-in');
  });

  test('state /messages/[id] hidden', async ({ page }) => {
    const id = '11111111-1111-4111-8111-111111111111';
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          location: null,
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
          role: 'moderator',
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
          name: 'Janet',
          text: 'Thank you, Father Severin.',
          createdAt: '2026-09-20T10:01:48.000Z',
          sats: 0,
          payable: false,
          hasPhoto: false,
          role: 'moderator',
          replyCount: 0,
          deletedAt: '2026-09-20T10:02:28.000Z',
          deletedBy: { id: 'acc_janet', name: 'Janet', role: 'moderator' },
        }),
      });
    });
    await page.goto(`/messages/${id}`);
    await expect(page.getByRole('status')).toContainText('This note was hidden by Janet');
    await expect(page.getByText('Thank you, Father Severin.')).toBeVisible();
    await shotScreen(page, 'state-messages-id-hidden');
  });

  test('state /messages/[id] missing', async ({ page }) => {
    await page.goto('/messages/not-a-uuid');
    await expect(page.getByText('This profile could not be found.')).toBeVisible();
    await shotScreen(page, 'state-messages-id-missing');
  });

  test('state /messages/[id] loading', async ({ page }) => {
    const id = '11111111-1111-4111-8111-111111111111';
    await fulfillPublicThreadReplies(page, id);
    await page.route(`**/public-messages/${id}`, async () => {
      /* hang */
    });
    await page.goto(`/messages/${id}`);
    await expect(page.getByText('Loading…')).toBeVisible();
    await shotScreen(page, 'state-messages-id-loading');
  });

  test('state /messages/[id] error', async ({ page }) => {
    const id = '11111111-1111-4111-8111-111111111111';
    await fulfillPublicThreadReplies(page, id);
    await page.route(`**/public-messages/${id}`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'boom' }),
      });
    });
    await page.goto(`/messages/${id}`);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await shotScreen(page, 'state-messages-id-error');
  });

  test('state /messages/[id] translate', async ({ page }) => {
    const id = '11111111-1111-4111-8111-111111111111';
    await fulfillPublicThreadReplies(page, id);
    await page.route(`**/public-messages/${id}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id,
          name: 'Ada',
          text: GERMAN_NOTE_TEXT,
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
    await expect(page.getByText(GERMAN_NOTE_TEXT)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Translate' })).toBeVisible();
    await shotScreen(page, 'state-messages-id-translate');
  });

  test('state /messages/[id] translate-loading', async ({ page }) => {
    const id = '11111111-1111-4111-8111-111111111111';
    await fulfillPublicThreadReplies(page, id);
    await page.route(`**/public-messages/${id}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id,
          name: 'Ada',
          text: GERMAN_NOTE_TEXT,
          createdAt: '2026-08-28T12:00:00.000Z',
          sats: 0,
          payable: false,
          hasPhoto: false,
          role: 'basis',
          replyCount: 0,
        }),
      });
    });
    await fulfillTranslatePost(page, 'hang');
    await page.goto(`/messages/${id}`);
    await page.getByRole('button', { name: 'Translate' }).click();
    await expect(page.getByRole('button', { name: 'Translate' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await shotScreen(page, 'state-messages-id-translate-loading');
  });

  test('state /messages/[id] translate-done', async ({ page }) => {
    const id = '11111111-1111-4111-8111-111111111111';
    await fulfillPublicThreadReplies(page, id);
    await page.route(`**/public-messages/${id}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id,
          name: 'Ada',
          text: GERMAN_NOTE_TEXT,
          createdAt: '2026-08-28T12:00:00.000Z',
          sats: 0,
          payable: false,
          hasPhoto: false,
          role: 'basis',
          replyCount: 0,
        }),
      });
    });
    await fulfillTranslatePost(page, 'ok');
    await page.goto(`/messages/${id}`);
    await page.getByRole('button', { name: 'Translate' }).click();
    await expect(page.getByRole('button', { name: 'Show original' })).toBeVisible();
    await shotScreen(page, 'state-messages-id-translate-done');
  });

  test('state /messages/[id] translate-hidden', async ({ page }) => {
    const id = '11111111-1111-4111-8111-111111111111';
    await fulfillPublicThreadReplies(page, id);
    await page.route(`**/public-messages/${id}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id,
          name: 'Ada',
          text: GERMAN_NOTE_TEXT,
          createdAt: '2026-08-28T12:00:00.000Z',
          sats: 0,
          payable: false,
          hasPhoto: false,
          role: 'basis',
          replyCount: 0,
        }),
      });
    });
    await fulfillTranslatePost(page, 'ok');
    await page.goto(`/messages/${id}`);
    await page.getByRole('button', { name: 'Translate' }).click();
    await expect(page.getByRole('button', { name: 'Show original' })).toBeVisible();
    await page.getByRole('button', { name: 'Show original' }).click();
    await expect(page.getByRole('button', { name: 'Show translation' })).toBeVisible();
    await shotScreen(page, 'state-messages-id-translate-hidden');
  });

  test('state /messages/[id] translate-error', async ({ page }) => {
    const id = '11111111-1111-4111-8111-111111111111';
    await fulfillPublicThreadReplies(page, id);
    await page.route(`**/public-messages/${id}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id,
          name: 'Ada',
          text: GERMAN_NOTE_TEXT,
          createdAt: '2026-08-28T12:00:00.000Z',
          sats: 0,
          payable: false,
          hasPhoto: false,
          role: 'basis',
          replyCount: 0,
        }),
      });
    });
    await fulfillTranslatePost(page, 'fail');
    await page.goto(`/messages/${id}`);
    await page.getByRole('button', { name: 'Translate' }).click();
    await expect(page.getByText('Could not translate this note. Please try again.')).toBeVisible();
    await shotScreen(page, 'state-messages-id-translate-error');
  });

  test('state /messages/[id] thread', async ({ page }) => {
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
    await fulfillPublicThreadReplies(page, parentId, [reply]);
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
    await expect(page.getByText("\u20BF3'000")).toBeVisible();
    await shotScreen(page, 'state-messages-id-thread');
  });

  test('state /messages/[id] external-reply', async ({ page }) => {
    const parentId = '11111111-1111-4111-8111-111111111111';
    const parent = {
      id: parentId,
      name: 'Ada',
      text: 'Hello from Ada',
      createdAt: '2026-08-28T12:00:00.000Z',
      sats: 0,
      payable: false,
      hasPhoto: false,
      role: 'basis',
      replyCount: 2,
    };
    await fulfillPublicThreadReplies(page, parentId, [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        parentId,
        name: 'Robin',
        via: 'nostr',
        text: '',
        createdAt: '2026-08-28T12:03:00.000Z',
        sats: 69,
        payable: false,
        hasPhoto: false,
      },
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
        parentId,
        name: 'Robin',
        via: 'nostr',
        text: 'Greetings! https://example.com/hello',
        createdAt: '2026-08-28T12:04:00.000Z',
        sats: 0,
        payable: false,
        hasPhoto: false,
      },
    ]);
    await page.route(`**/public-messages/${parentId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(parent),
      });
    });
    await page.goto(`/messages/${parentId}`);
    await expect(page.getByText('Hello from Ada')).toBeVisible();
    await expect(page.getByText('External', { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText('Greetings! https://example.com/hello', { exact: true }),
    ).toBeVisible();
    await shotScreen(page, 'state-messages-id-external-reply');
  });

  test('state /messages/[id] quoted-note', async ({ page }) => {
    await fulfillPublicThreadReplies(page, RIANA_ID, [cyrillReply]);
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
    await expect(page.getByAltText('Photo from Cyrill')).toBeVisible();
    await expect(page.getByText(QUOTED_NOTE_URL)).not.toBeVisible();
    await shotScreen(page, 'state-messages-id-quoted-note');
  });

  test('state /messages/[id] reply', async ({ page }) => {
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
    await fulfillPublicThreadReplies(page, parentId, [reply]);
    await page.route(`**/public-messages/${replyId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(reply),
      });
    });
    await page.route(`**/public-messages/${parentId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(parent),
      });
    });
    await page.goto(`/messages/${replyId}`);
    await expect(page.getByText('Hello from Ada')).toBeVisible();
    await expect(page.getByText('Pater Severin')).toBeVisible();
    await expect(page.getByText("\u20BF3'000")).toBeVisible();
    await shotScreen(page, 'state-messages-id-reply');
  });

  test('screen /view/[viewKey] default', async ({ page }) => {
    await page.route(new RegExp(`/view-key/${E2E_ACCOUNT.viewKey}$`), async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: 'Ada',
          location: null,
          username: 'alice',
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
        body: JSON.stringify(VIEW_RECEIVED_ACTIVITY),
      });
    });
    await page.goto(`/view/${E2E_ACCOUNT.viewKey}`);
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(page.getByText('Ada')).toBeVisible();
    await expect(page.getByText('Action required, the account must be activated')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Activate' })).toBeVisible();
    await shotScreen(page, 'screen-view-viewKey');
  });

  test('state /view about-filled', async ({ page }) => {
    await page.route(new RegExp(`/view-key/${E2E_ACCOUNT.viewKey}$`), async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          lightningAddressVerified: false,
          createdAt: 1,
          hasPasskey: false,
          aboutMe: 'I build on Bitcoin',
        }),
      });
    });
    await page.route('**/view-key/**/activity**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(VIEW_RECEIVED_ACTIVITY),
      });
    });
    await page.goto(`/view/${E2E_ACCOUNT.viewKey}`);
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(page.getByText('I build on Bitcoin')).toBeVisible();
    await expect(page.getByText('Tell others who you are.')).toHaveCount(0);
    await shotScreen(page, 'state-view-about-filled');
  });

  test('state /view about-photo', async ({ page }) => {
    await page.route(new RegExp(`/view-key/${E2E_ACCOUNT.viewKey}$`), async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          lightningAddressVerified: false,
          createdAt: 1,
          hasPasskey: false,
          aboutMe: 'I build on Bitcoin',
          aboutMeHasPhoto: true,
        }),
      });
    });
    await page.route('**/view-key/**/activity**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(VIEW_RECEIVED_ACTIVITY),
      });
    });
    await page.route(new RegExp(`/view-key/${E2E_ACCOUNT.viewKey}/about/photo$`), async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/jpeg',
        body: fs.readFileSync(path.join(process.cwd(), 'e2e/fixtures/tiny.jpg')),
      });
    });
    await page.goto(`/view/${E2E_ACCOUNT.viewKey}`);
    await expect(page.getByText('I build on Bitcoin')).toBeVisible();
    await expect(page.getByAltText('About me photo')).toBeVisible();
    await shotScreen(page, 'state-view-about-photo');
  });

  test('screen /view/[viewKey] missing', async ({ page }) => {
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
    await shotScreen(page, 'state-view-missing');
  });

  test('screen /view/[viewKey] loading', async ({ page }) => {
    await page.route(new RegExp(`/view-key/${E2E_ACCOUNT.viewKey}$`), async () => {
      // never fulfill
    });
    await page.goto(`/view/${E2E_ACCOUNT.viewKey}`);
    await expect(page.getByText('Loading…')).toBeVisible();
    await shotScreen(page, 'state-view-loading');
  });

  test('screen /view/[viewKey] error', async ({ page }) => {
    await page.route(new RegExp(`/view-key/${E2E_ACCOUNT.viewKey}$`), async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'boom' }),
      });
    });
    await page.goto(`/view/${E2E_ACCOUNT.viewKey}`);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await shotScreen(page, 'state-view-error');
  });

  test('screen /view/[viewKey] claimed', async ({ page }) => {
    await page.route(new RegExp(`/view-key/${E2E_ACCOUNT.viewKey}$`), async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          lightningAddressVerified: false,
          createdAt: 1,
          hasPasskey: true,
          aboutMe: null,
        }),
      });
    });
    await page.route('**/view-key/**/activity**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(VIEW_RECEIVED_ACTIVITY),
      });
    });
    await page.goto(`/view/${E2E_ACCOUNT.viewKey}`);
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(page.getByText('Ada')).toBeVisible();
    await expect(page.getByText('Action required, the account must be activated')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Activate' })).toHaveCount(0);
    await shotScreen(page, 'state-view-claimed');
  });

  test('screen /view/[viewKey] in-app', async ({ page }) => {
    await page.addInitScript(() => {
      Object.assign(window, { TelegramWebviewProxy: { postEvent() {} } });
    });
    await page.route(new RegExp(`/view-key/${E2E_ACCOUNT.viewKey}$`), async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: 'Ada',
          location: null,
          username: 'alice',
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
        body: JSON.stringify(VIEW_RECEIVED_ACTIVITY),
      });
    });
    await page.goto(`/view/${E2E_ACCOUNT.viewKey}`);
    await expect(
      page.getByRole('heading', { name: 'Open this page in your browser' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Activate' })).toHaveCount(0);
    await shotScreen(page, 'state-view-in-app');
  });
});

const PROFILE_RECEIVE_STATS = {
  donatedSats: 0,
  receivedSats: 1500,
  donatedOverTime: [] as const,
  receivedOverTime: [
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
      day: '2026-06-03',
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
  fx: FX_ALL,
};

const PROFILE_SINGLE_DAY_STATS = {
  donatedSats: 0,
  receivedSats: 21,
  donatedOverTime: [] as const,
  receivedOverTime: [
    {
      day: '2026-06-01',
      sats: 21,
      cumulativeSats: 21,
      btc: '0.00000021',
      cumulativeBtc: '0.00000021',
      usd: '0.02',
      cumulativeUsd: '0.02',
      chf: '0.02',
      eur: '0.02',
      php: '1.00',
      cumulativeChf: '0.02',
      cumulativeEur: '0.02',
      cumulativePhp: '1.00',
    },
  ],
  fx: FX_ALL,
};

const PROFILE_LARGE_USD_STATS = {
  donatedSats: 0,
  receivedSats: 1_500_000,
  donatedOverTime: [] as const,
  receivedOverTime: [
    {
      day: '2026-06-01',
      sats: 500_000,
      cumulativeSats: 500_000,
      btc: '0.00500000',
      cumulativeBtc: '0.00500000',
      usd: '475.00',
      cumulativeUsd: '475.00',
      chf: '400.00',
      eur: '430.00',
      php: '26600.00',
      cumulativeChf: '400.00',
      cumulativeEur: '430.00',
      cumulativePhp: '26600.00',
    },
    {
      day: '2026-06-02',
      sats: 1_000_000,
      cumulativeSats: 1_500_000,
      btc: '0.01000000',
      cumulativeBtc: '0.01500000',
      usd: '950.00',
      cumulativeUsd: '1425.00',
      chf: '800.00',
      eur: '860.00',
      php: '53200.00',
      cumulativeChf: '1200.00',
      cumulativeEur: '1300.00',
      cumulativePhp: '80000.00',
    },
  ],
  fx: FX_ALL,
};

const GIVEN_RECEIVED_ACTIVITY = {
  donatedSats: 2100,
  receivedSats: 1500,
  donatedOverTime: [
    {
      day: '2026-06-02',
      sats: 2100,
      cumulativeSats: 2100,
      btc: '0.00002100',
      cumulativeBtc: '0.00002100',
      usd: '2.00',
      cumulativeUsd: '2.00',
      chf: '2.00',
      eur: '2.00',
      php: '2.00',
      cumulativeChf: '2.00',
      cumulativeEur: '2.00',
      cumulativePhp: '2.00',
    },
  ],
  receivedOverTime: PROFILE_RECEIVE_STATS.receivedOverTime,
  fx: FX_ALL,
};

test.describe('profile activity chart variants', () => {
  async function seedAdaProfile(
    page: Page,
    extras?: { aboutMe?: string | null; aboutMeHasPhoto?: boolean },
  ): Promise<void> {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          aboutMe: extras?.aboutMe ?? null,
          aboutMeHasPhoto: extras?.aboutMeHasPhoto ?? false,
          setup: null,
          missing: [],
        }),
      });
    });
  }

  async function stubProfileStats(page: Page, body: unknown): Promise<void> {
    await page.route(/\/me\/activity(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });
  }

  test('profile receive', async ({ page }) => {
    await seedAdaProfile(page);
    await stubProfileStats(page, PROFILE_RECEIVE_STATS);
    await page.goto('/profile');
    await expect(page.getByText('2026-06-01')).toBeVisible();
    await shotScreen(page, 'state-profile-receive');
  });

  test('profile usd-scale', async ({ page }) => {
    await seedAdaProfile(page);
    await stubProfileStats(page, PROFILE_RECEIVE_STATS);
    await page.goto('/profile');
    await page
      .getByRole('group', { name: 'Chart scale' })
      .getByRole('button', { name: 'USD' })
      .click();
    await expect(page.getByLabel('Given and received in USD')).toBeVisible();
    await shotScreen(page, 'state-profile-usd-scale');
  });

  test('profile single-day', async ({ page }) => {
    await seedAdaProfile(page);
    await stubProfileStats(page, PROFILE_SINGLE_DAY_STATS);
    await page.goto('/profile');
    await expect(page.getByText('2026-06-01')).toBeVisible();
    await shotScreen(page, 'state-profile-single-day');
  });

  test('profile large-usd', async ({ page }) => {
    await seedAdaProfile(page);
    await stubProfileStats(page, PROFILE_LARGE_USD_STATS);
    await page.goto('/profile');
    await page
      .getByRole('group', { name: 'Chart scale' })
      .getByRole('button', { name: 'USD' })
      .click();
    await expect(page.getByLabel('Given and received in USD')).toBeVisible();
    await expect(page.getByText("$1'425")).toBeVisible();
    await shotScreen(page, 'state-profile-large-usd');
  });

  test('profile given-received', async ({ page }) => {
    // state-profile-given-received
    await seedAdaProfile(page);
    await stubProfileStats(page, GIVEN_RECEIVED_ACTIVITY);
    await page.goto('/profile');
    await expect(page.getByText('2026-06-01')).toBeVisible();
    await shotScreen(page, 'state-profile-given-received');
  });

  test('profile about-filled', async ({ page }) => {
    await seedAdaProfile(page, { aboutMe: 'I build on Bitcoin' });
    await stubProfileStats(page, EMPTY_ACTIVITY);
    await page.goto('/profile');
    await expect(page.getByText('I build on Bitcoin')).toBeVisible();
    await expect(page.getByText('Tell others who you are.')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Write your About me' })).toHaveCount(0);
    await shotScreen(page, 'state-profile-about-filled');
  });

  test('profile about-photo', async ({ page }) => {
    await seedAdaProfile(page, { aboutMe: 'I build on Bitcoin', aboutMeHasPhoto: true });
    await stubProfileStats(page, EMPTY_ACTIVITY);
    await page.route(/\/me\/about\/photo$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/jpeg',
        body: fs.readFileSync(path.join(process.cwd(), 'e2e/fixtures/tiny.jpg')),
      });
    });
    await page.goto('/profile');
    await expect(page.getByText('I build on Bitcoin')).toBeVisible();
    await expect(page.getByAltText('About me photo')).toBeVisible();
    await shotScreen(page, 'state-profile-about-photo');
  });

  test('profile about-editing', async ({ page }) => {
    await seedAdaProfile(page);
    await stubProfileStats(page, EMPTY_ACTIVITY);
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Write your About me' }).click();
    await expect(page.getByRole('textbox', { name: 'About me' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save About me' })).toBeVisible();
    await shotScreen(page, 'state-profile-about-editing');
  });

  test('profile about-save-error', async ({ page }) => {
    await seedAdaProfile(page);
    await stubProfileStats(page, EMPTY_ACTIVITY);
    await page.route('**/me/about', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unavailable' }),
      });
    });
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Write your About me' }).click();
    await page.getByRole('button', { name: 'Save About me' }).click();
    await expect(page.getByText('Could not save. Please try again.')).toBeVisible();
    await shotScreen(page, 'state-profile-about-save-error');
  });

  test('profile notification-level-error', async ({ page }) => {
    await seedAdaProfile(page);
    await stubProfileStats(page, EMPTY_ACTIVITY);
    await page.route('**/me/notification-level', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unavailable' }),
      });
    });
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Active' }).click();
    await expect(page.getByText('Could not save notification level.')).toBeVisible();
    await shotScreen(page, 'state-profile-notification-level-error');
  });

  test('profile push-enable-error', async ({ page }) => {
    await seedAdaProfile(page);
    await stubProfileStats(page, EMPTY_ACTIVITY);
    await page.goto('/profile');
    await page
      .getByRole('group', { name: 'This device' })
      .getByRole('button', { name: 'On' })
      .click();
    await expect(page.getByText('Notifications are not available in this browser.')).toBeVisible();
    await shotScreen(page, 'state-profile-push-enable-error');
  });
});

test.describe('profile funding states', () => {
  // Goldens are regenerated on the build host.
  async function seedFundingProfile(
    page: Page,
    extras: {
      role?: 'basis' | 'verified';
      funding?: unknown;
    } = {},
  ): Promise<void> {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          role: extras.role ?? 'verified',
          name: 'Ada',
          location: null,
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          aboutMe: null,
          setup: null,
          missing: [],
          funding:
            extras.funding === undefined && extras.role !== 'basis'
              ? {
                  status: 'none',
                  trialUtcDate: null,
                  admittedAt: null,
                  reviewedByName: null,
                }
              : extras.funding,
        }),
      });
    });
    await page.route(/\/me\/activity(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EMPTY_ACTIVITY),
      });
    });
  }

  test('profile funding not-verified', async ({ page }) => {
    await seedFundingProfile(page, { role: 'basis', funding: null });
    await page.goto('/profile');
    await expect(page.getByText('You are not verified yet.')).toBeVisible();
    await shotScreen(page, 'state-profile-funding-not-verified');
  });

  test('profile funding none', async ({ page }) => {
    await seedFundingProfile(page);
    await page.goto('/profile');
    await expect(page.getByRole('link', { name: 'Apply for the 21 gifts grant' })).toBeVisible();
    await shotScreen(page, 'state-profile-funding-none');
  });

  test('profile funding pending', async ({ page }) => {
    await seedFundingProfile(page, {
      funding: {
        status: 'pending',
        trialUtcDate: null,
        admittedAt: null,
        reviewedByName: null,
      },
    });
    await page.goto('/profile');
    await expect(
      page.getByText('Your application is open. A moderator will review your posts.'),
    ).toBeVisible();
    await shotScreen(page, 'state-profile-funding-pending');
  });

  test('profile funding trial', async ({ page }) => {
    await seedFundingProfile(page, {
      funding: {
        status: 'trial',
        trialUtcDate: '2026-09-20',
        admittedAt: null,
        reviewedByName: null,
      },
    });
    await page.goto('/profile');
    await expect(
      page.getByText('You are on a one-day trial. Review repeats tomorrow.'),
    ).toBeVisible();
    await shotScreen(page, 'state-profile-funding-trial');
  });

  test('profile funding admitted', async ({ page }) => {
    await seedFundingProfile(page, {
      funding: {
        status: 'admitted',
        trialUtcDate: null,
        admittedAt: Date.parse('2026-08-28T12:00:00.000Z'),
        reviewedByName: 'Ada',
      },
    });
    await page.goto('/profile');
    await expect(page.getByText('You are admitted to daily 21.gifts grant payouts.')).toBeVisible();
    await shotScreen(page, 'state-profile-funding-admitted');
  });
});

test.describe('profile apply screens', () => {
  const POST = {
    id: 'msg_1',
    name: 'Ada',
    text: 'Living-room note.',
    createdAt: '2026-08-28T12:00:00.000Z',
    sats: 0,
    payable: false,
    hasPhoto: false,
    role: 'verified',
    replyCount: 0,
  };

  async function seedApply(
    page: Page,
    extras: {
      role?: 'basis' | 'verified';
      aboutMe?: string | null;
      aboutMeHasPhoto?: boolean;
      location?: string | null;
      funding?: unknown;
    } = {},
  ): Promise<void> {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          role: extras.role ?? 'verified',
          name: 'Ada',
          location: extras.location ?? null,
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          aboutMe: extras.aboutMe ?? null,
          aboutMeHasPhoto: extras.aboutMeHasPhoto ?? false,
          setup: null,
          missing: [],
          funding:
            extras.funding === undefined && extras.role !== 'basis'
              ? {
                  status: 'none',
                  trialUtcDate: null,
                  admittedAt: null,
                  reviewedByName: null,
                }
              : extras.funding,
        }),
      });
    });
    await page.route(/\/me\/activity(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EMPTY_ACTIVITY),
      });
    });
  }

  async function stubPosts(
    page: Page,
    messages: (typeof POST)[] | 'hang' | 'error',
  ): Promise<void> {
    await page.route(/\/forum\/members\/[^/]+\/posts/, async (route) => {
      if (messages === 'hang') {
        return;
      }
      if (messages === 'error') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'unavailable' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages }),
      });
    });
  }

  test('screen /profile/apply', async ({ page }) => {
    await seedApply(page);
    await page.goto('/profile/apply');
    await expect(
      page.getByText('First, write a short About me so people can get to know you.'),
    ).toBeVisible();
    await shotScreen(page, 'screen-profile-apply');
  });

  test('profile apply photo', async ({ page }) => {
    await seedApply(page, { aboutMe: 'I build on Bitcoin' });
    await page.goto('/profile/apply');
    await expect(page.getByText('Next, add a photo to your About me.')).toBeVisible();
    await shotScreen(page, 'state-profile-apply-photo');
  });

  test('profile apply location', async ({ page }) => {
    await seedApply(page, { aboutMe: 'I build on Bitcoin', aboutMeHasPhoto: true });
    await page.goto('/profile/apply');
    await expect(page.getByText('Next, add the place you live.')).toBeVisible();
    await shotScreen(page, 'state-profile-apply-location');
  });

  test('profile apply principle-1', async ({ page }) => {
    await seedApply(page, {
      aboutMe: 'I build on Bitcoin',
      aboutMeHasPhoto: true,
      location: 'Zurich',
    });
    await stubPosts(page, [POST]);
    await page.goto('/profile/apply');
    await expect(page.getByText('Please check whether the posts match principle 1.')).toBeVisible();
    await shotScreen(page, 'state-profile-apply-principle-1');
  });

  test('profile apply principle-2', async ({ page }) => {
    await seedApply(page, {
      aboutMe: 'I build on Bitcoin',
      aboutMeHasPhoto: true,
      location: 'Zurich',
    });
    await stubPosts(page, [POST]);
    await page.goto('/profile/apply');
    await page.getByRole('button', { name: 'Requirement met' }).click();
    await expect(page.getByText('Please check whether the posts match principle 2.')).toBeVisible();
    await shotScreen(page, 'state-profile-apply-principle-2');
  });

  test('profile apply principle-3', async ({ page }) => {
    await seedApply(page, {
      aboutMe: 'I build on Bitcoin',
      aboutMeHasPhoto: true,
      location: 'Zurich',
    });
    await stubPosts(page, [POST]);
    await page.goto('/profile/apply');
    await page.getByRole('button', { name: 'Requirement met' }).click();
    await page.getByRole('button', { name: 'Requirement met' }).click();
    await expect(page.getByText('Please check whether the posts match principle 3.')).toBeVisible();
    await shotScreen(page, 'state-profile-apply-principle-3');
  });

  test('profile apply truth', async ({ page }) => {
    await seedApply(page, {
      aboutMe: 'I build on Bitcoin',
      aboutMeHasPhoto: true,
      location: 'Zurich',
    });
    await stubPosts(page, [POST]);
    await page.goto('/profile/apply');
    await page.getByRole('button', { name: 'Requirement met' }).click();
    await page.getByRole('button', { name: 'Requirement met' }).click();
    await page.getByRole('button', { name: 'Requirement met' }).click();
    await expect(
      page.getByText('Do these posts, to your knowledge, correspond to the truth?'),
    ).toBeVisible();
    await shotScreen(page, 'state-profile-apply-truth');
  });

  test('profile apply forbidden', async ({ page }) => {
    await seedApply(page, { role: 'basis', funding: null });
    await page.goto('/profile/apply');
    await expect(page.getByText('You are not verified yet.')).toBeVisible();
    await shotScreen(page, 'state-profile-apply-forbidden');
  });

  test('profile apply pending', async ({ page }) => {
    await seedApply(page, {
      funding: {
        status: 'pending',
        trialUtcDate: null,
        admittedAt: null,
        reviewedByName: null,
      },
    });
    await page.goto('/profile/apply');
    await expect(
      page.getByText('Your application is open. A moderator will review your posts.'),
    ).toBeVisible();
    await shotScreen(page, 'state-profile-apply-pending');
  });

  test('profile apply trial', async ({ page }) => {
    await seedApply(page, {
      funding: {
        status: 'trial',
        trialUtcDate: '2026-09-20',
        admittedAt: null,
        reviewedByName: null,
      },
    });
    await page.goto('/profile/apply');
    await expect(
      page.getByText('You are on a one-day trial. Review repeats tomorrow.'),
    ).toBeVisible();
    await shotScreen(page, 'state-profile-apply-trial');
  });

  test('profile apply admitted', async ({ page }) => {
    await seedApply(page, {
      funding: {
        status: 'admitted',
        trialUtcDate: null,
        admittedAt: 1,
        reviewedByName: 'Ada',
      },
    });
    await page.goto('/profile/apply');
    await expect(page.getByText('You are admitted to daily 21.gifts grant payouts.')).toBeVisible();
    await shotScreen(page, 'state-profile-apply-admitted');
  });

  test('profile apply empty-posts', async ({ page }) => {
    await seedApply(page, {
      aboutMe: 'I build on Bitcoin',
      aboutMeHasPhoto: true,
      location: 'Zurich',
    });
    await stubPosts(page, []);
    await page.goto('/profile/apply');
    await expect(page.getByText('No living-room posts.')).toBeVisible();
    await shotScreen(page, 'state-profile-apply-empty-posts');
  });

  test('profile apply loading', async ({ page }) => {
    await seedApply(page, {
      aboutMe: 'I build on Bitcoin',
      aboutMeHasPhoto: true,
      location: 'Zurich',
    });
    await stubPosts(page, 'hang');
    await page.goto('/profile/apply');
    await expect(page.getByText('Loading…').first()).toBeVisible();
    await shotScreen(page, 'state-profile-apply-loading');
  });

  test('profile apply error', async ({ page }) => {
    await seedApply(page, {
      aboutMe: 'I build on Bitcoin',
      aboutMeHasPhoto: true,
      location: 'Zurich',
    });
    await stubPosts(page, 'error');
    await page.goto('/profile/apply');
    await expect(
      page.getByText('Could not load this application. Please try again.'),
    ).toBeVisible();
    await shotScreen(page, 'state-profile-apply-error');
  });

  test('profile apply applying', async ({ page }) => {
    await seedApply(page, {
      aboutMe: 'I build on Bitcoin',
      aboutMeHasPhoto: true,
      location: 'Zurich',
    });
    await stubPosts(page, [POST]);
    await page.route(/\/funding\/apply$/, async () => {
      /* hang */
    });
    await page.goto('/profile/apply');
    await page.getByRole('button', { name: 'Requirement met' }).click();
    await page.getByRole('button', { name: 'Requirement met' }).click();
    await page.getByRole('button', { name: 'Requirement met' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('button', { name: 'Yes' })).toBeDisabled();
    await shotScreen(page, 'state-profile-apply-applying');
  });

  test('profile apply apply-failed', async ({ page }) => {
    await seedApply(page, {
      aboutMe: 'I build on Bitcoin',
      aboutMeHasPhoto: true,
      location: 'Zurich',
    });
    await stubPosts(page, [POST]);
    await page.route(/\/funding\/apply$/, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Funding is unavailable' }),
      });
    });
    await page.goto('/profile/apply');
    await page.getByRole('button', { name: 'Requirement met' }).click();
    await page.getByRole('button', { name: 'Requirement met' }).click();
    await page.getByRole('button', { name: 'Requirement met' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(
      page.getByText('Could not submit your application. Please try again.'),
    ).toBeVisible();
    await shotScreen(page, 'state-profile-apply-apply-failed');
  });

  test('profile apply unmet', async ({ page }) => {
    await seedApply(page, {
      aboutMe: 'I build on Bitcoin',
      aboutMeHasPhoto: true,
      location: 'Zurich',
    });
    await stubPosts(page, [POST]);
    await page.goto('/profile/apply');
    await page.getByRole('button', { name: 'Requirement not met' }).click();
    await expect(page.getByText('When your posts match, you can apply again.')).toBeVisible();
    await shotScreen(page, 'state-profile-apply-unmet');
  });
});

test.describe('welcome forum variants', () => {
  async function seedAda(
    page: Page,
    role: 'basis' | 'verified' | 'moderator' = 'basis',
    lawsDismissed = true,
  ): Promise<void> {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          role,
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          aboutMe: null,
          setup: null,
          missing: [],
          forumLawsDismissed: lawsDismissed,
        }),
      });
    });
  }

  async function stubPayInvoice(page: Page): Promise<void> {
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
        body: JSON.stringify({ pr: 'lnbc21n1exampleinvoice', amountSats: 21 }),
      });
    });
  }

  const walletAssignByPage = new WeakMap<Page, string>();

  async function stubWalletLocationAssign(page: Page): Promise<void> {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Page.enable');
    cdp.on('Page.frameRequestedNavigation', (event: { url?: string }) => {
      const href = event.url ?? '';
      if (href.startsWith('walletofsatoshi:') || href.startsWith('intent:')) {
        walletAssignByPage.set(page, href);
      }
    });
  }

  async function submitPayAmount(page: Page): Promise<void> {
    const payNow = page.getByRole('button', { name: 'Pay', exact: true });
    if ((await payNow.count()) > 0) {
      await payNow.click();
      return;
    }
    await page.getByRole('button', { name: 'Continue' }).click();
  }

  async function openPaySheet(page: Page): Promise<void> {
    await stubWalletLocationAssign(page);
    await page.goto('/welcome');
    await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
    await chooseForumView(page, 'All');
    await page.getByRole('button', { name: 'Show reactions' }).click();
    const replyCard = page.locator('[data-reply-id="r-pay"]');
    await replyCard.getByRole('button', { name: 'Send Bitcoin' }).click();
    await replyCard.getByLabel('Amount').fill('21');
    await submitPayAmount(page);
    await expect(page.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeVisible();
  }

  for (const state of ['moderation', 'delete-confirm', 'deleting', 'delete-error'] as const) {
    test('welcome ' + state, async ({ page }) => {
      await seedAda(page, 'moderator');
      await fulfillMixedSatsMessages(page);
      let release: () => void = () => undefined;
      await page.route('**/forum/messages/m1', async (route) => {
        if (state === 'deleting') {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: '{"error":"Unavailable"}',
        });
      });
      await page.goto('/welcome');
      await chooseForumView(page, 'No gifts yet');
      await expect(page.getByRole('button', { name: 'Delete post', exact: true })).toBeVisible();
      if (state !== 'moderation') {
        await page.getByRole('button', { name: 'Delete post', exact: true }).click();
        await expect(
          page.getByRole('group', { name: 'Delete this post and its reactions from 21.gifts?' }),
        ).toBeVisible();
      }
      if (state === 'deleting' || state === 'delete-error') {
        await page.getByRole('button', { name: 'Confirm deletion' }).click();
        if (state === 'deleting') {
          await expect(page.getByRole('button', { name: 'Confirm deletion' })).toBeDisabled();
        } else {
          await expect(
            page
              .getByRole('group', { name: 'Delete this post and its reactions from 21.gifts?' })
              .getByRole('alert'),
          ).toHaveText('Could not delete the post. Please try again.');
        }
      }
      if (state === 'moderation') await shotScreen(page, 'state-welcome-moderation');
      if (state === 'delete-confirm') await shotScreen(page, 'state-welcome-delete-confirm');
      if (state === 'deleting') await shotScreen(page, 'state-welcome-deleting');
      if (state === 'delete-error') await shotScreen(page, 'state-welcome-delete-error');
      release();
    });
  }

  const replyDeleteTitles = {
    'reply-moderation': 'welcome reply-moderation',
    'reply-delete-confirm': 'welcome reply-delete-confirm',
    'reply-deleting': 'welcome reply-deleting',
    'reply-delete-error': 'welcome reply-delete-error',
  } as const;
  for (const state of [
    'reply-moderation',
    'reply-delete-confirm',
    'reply-deleting',
    'reply-delete-error',
  ] as const) {
    test(replyDeleteTitles[state], async ({ page }) => {
      await seedAda(page, 'moderator');
      await fulfillMixedSatsMessages(page);
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
                role: 'moderator',
              },
              {
                id: 'm2',
                name: 'Carol',
                text: 'I can send a small gift tomorrow.',
                createdAt: '2026-08-28T11:00:00.000Z',
                sats: 21,
                payable: true,
                hasPhoto: false,
                role: 'verified',
              },
              {
                id: 'm1',
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
      await page.route('**/forum/messages/m1/replies', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            messages: [
              {
                id: 'r1',
                name: 'Pat',
                text: 'A reply',
                createdAt: '2026-08-28T10:30:00.000Z',
                sats: 0,
                payable: false,
                hasPhoto: false,
                role: 'basis',
              },
            ],
          }),
        });
      });
      let release: () => void = () => undefined;
      await page.route('**/forum/messages/r1', async (route) => {
        if (route.request().method() !== 'DELETE') {
          await route.fallback();
          return;
        }
        if (state === 'reply-deleting') {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: '{"error":"Unavailable"}',
        });
      });
      await page.goto('/welcome');
      await chooseForumView(page, 'No gifts yet');
      await page.getByRole('button', { name: 'Show reactions', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Delete reaction', exact: true }),
      ).toBeVisible();
      if (state !== 'reply-moderation') {
        await page.getByRole('button', { name: 'Delete reaction', exact: true }).click();
        await expect(
          page.getByRole('group', { name: 'Delete this reaction from 21.gifts?' }),
        ).toBeVisible();
      }
      if (state === 'reply-deleting' || state === 'reply-delete-error') {
        await page.getByRole('button', { name: 'Confirm deletion' }).click();
        if (state === 'reply-deleting') {
          await expect(page.getByRole('button', { name: 'Confirm deletion' })).toBeDisabled();
        } else {
          await expect(
            page
              .getByRole('group', { name: 'Delete this reaction from 21.gifts?' })
              .getByRole('alert'),
          ).toHaveText('Could not delete the reaction. Please try again.');
        }
      }
      if (state === 'reply-moderation') await shotScreen(page, 'state-welcome-reply-moderation');
      if (state === 'reply-delete-confirm') {
        await shotScreen(page, 'state-welcome-reply-delete-confirm');
      }
      if (state === 'reply-deleting') await shotScreen(page, 'state-welcome-reply-deleting');
      if (state === 'reply-delete-error') {
        await shotScreen(page, 'state-welcome-reply-delete-error');
      }
      release();
    });
  }

  test('welcome all', async ({ page }) => {
    await seedAda(page);
    await fulfillMixedSatsMessages(page);
    await page.goto('/welcome');
    await chooseForumView(page, 'All');
    await expect(page.getByText('Does anyone have spare sats this week?')).toBeVisible();
    await shotScreen(page, 'state-welcome-all');
  });

  test('welcome goal-50', async ({ page }) => {
    await seedAda(page);
    await fulfillRateDay(page);
    await page.route(/\/messages(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: 'm-goal-50',
              name: 'Ada',
              text: 'Goal note at fifty percent',
              createdAt: '2026-08-28T12:00:00.000Z',
              sats: 10500,
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
    await chooseForumView(page, 'All');
    await expect(page.getByText('50%')).toBeVisible();
    await shotScreen(page, 'state-welcome-goal-50');
  });

  test('welcome goal-100', async ({ page }) => {
    await seedAda(page);
    await fulfillRateDay(page);
    await page.route(/\/messages(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: 'm-goal-100',
              name: 'Ada',
              text: 'Goal note at one hundred percent',
              createdAt: '2026-08-28T12:00:00.000Z',
              sats: 21000,
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
    await chooseForumView(page, 'All');
    await expect(page.getByText('100%')).toBeVisible();
    await shotScreen(page, 'state-welcome-goal-100');
  });

  test('welcome goal-110', async ({ page }) => {
    await seedAda(page);
    await fulfillRateDay(page);
    await page.route(/\/messages(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: 'm-goal-110',
              name: 'Ada',
              text: 'Goal note at one hundred ten percent',
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
    await chooseForumView(page, 'All');
    await expect(page.getByText('110%')).toBeVisible();
    await expect(page.getByText("₿21'000")).toBeVisible();
    await expect(page.getByText('$21.00')).toBeVisible();
    await shotScreen(page, 'state-welcome-goal-110');
  });

  test('state /welcome ask-amount', async ({ page }) => {
    await seedAda(page);
    await fulfillRateDay(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await page.getByRole('button', { name: 'Ask for money' }).click();
    await expect(page.getByRole('button', { name: 'One-time' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: 'Daily' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(page.getByText('How much?')).toBeVisible();
    await page.getByLabel('Ask').fill('1000');
    await expect(page.getByText("₿1'000")).toBeVisible();
    await expect(page.getByText('$1.00')).toBeVisible();
    await shotScreen(page, 'state-welcome-ask-amount');
  });

  test('state /welcome ask-daily', async ({ page }) => {
    await seedAda(page);
    await fulfillRateDay(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await page.getByRole('button', { name: 'Ask for money' }).click();
    await page.getByRole('button', { name: 'Daily' }).click();
    await expect(page.getByRole('button', { name: 'Daily' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: 'One-time' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await page.getByLabel('Ask').fill('1000');
    await expect(page.getByText("₿1'000")).toBeVisible();
    await expect(page.getByText('$1.00')).toBeVisible();
    await shotScreen(page, 'state-welcome-ask-daily');
  });

  test('state /welcome ask-open', async ({ page }) => {
    await seedAda(page);
    await fulfillRateDay(page);
    await page.route(/\/messages(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: 'm-ask',
              name: 'Dana',
              text: 'Need help with a train ticket',
              createdAt: '2026-08-28T12:30:00.000Z',
              sats: 0,
              goalSats: 1000,
              payable: true,
              hasPhoto: true,
              photoCount: 1,
              role: 'basis',
            },
          ],
        }),
      });
    });
    await page.route(/\/messages\/m-ask\/photo/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/jpeg',
        body: fs.readFileSync('e2e/fixtures/ask-card.jpg'),
      });
    });
    await page.goto('/welcome');
    await expect(page.getByRole('combobox', { name: 'Forum view' })).toContainText('Active');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(page.getByText('Need help with a train ticket')).toBeVisible();
    await expect(page.getByText("₿1'000")).toBeVisible();
    await expect(page.getByText('$1.00')).toBeVisible();
    await page.getByText("₿1'000").scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-welcome-ask-open');
  });

  test('state /welcome ask-photos', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await page.getByRole('button', { name: 'Ask for money' }).click();
    await page.getByLabel('Ask').fill('21000');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Add photos')).toBeVisible();
    await shotScreen(page, 'state-welcome-ask-photos');
  });

  test('state /welcome ask-text', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await page.getByRole('button', { name: 'Ask for money' }).click();
    await page.getByLabel('Ask').fill('21000');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Write a message', { exact: true })).toBeVisible();
    await shotScreen(page, 'state-welcome-ask-text');
  });

  test('state /welcome ask-preview', async ({ page }) => {
    await seedAda(page);
    await fulfillRateDay(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await page.getByRole('button', { name: 'Ask for money' }).click();
    await page.getByLabel('Ask').fill('1000');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/ask-card.jpg');
    await expect(page.getByAltText('Selected photo')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Your message').fill('Need help with a train ticket');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Preview')).toBeVisible();
    await expect(page.getByRole('button', { name: 'One-time' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByText('Need help with a train ticket')).toBeVisible();
    await expect(page.getByAltText('Selected photo')).toBeVisible();
    await expect(page.getByText("₿1'000")).toBeVisible();
    await expect(page.getByText('$1.00')).toBeVisible();
    await page.getByRole('button', { name: /^Post$/ }).scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-welcome-ask-preview');
  });

  async function beginAsk(page: Page, daily = false): Promise<void> {
    await page.getByRole('button', { name: 'Ask for money' }).click();
    if (daily) {
      await page.getByRole('button', { name: 'Daily' }).click();
    }
    await expect(page.getByRole('button', { name: daily ? 'Daily' : 'One-time' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  }

  async function askAmount(page: Page, amount = '1000'): Promise<void> {
    await page.getByLabel('Ask').fill(amount);
    await page.getByRole('button', { name: 'Continue' }).click();
  }

  test('state /welcome ask-empty', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await beginAsk(page);
    await expect(page.getByLabel('Ask')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await shotScreen(page, 'state-welcome-ask-empty');
  });

  test('state /welcome ask-empty-daily', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await beginAsk(page, true);
    await expect(page.getByLabel('Ask')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await shotScreen(page, 'state-welcome-ask-empty-daily');
  });

  test('state /welcome ask-one-photo', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await beginAsk(page);
    await askAmount(page, '21000');
    await expect(page.getByText('Add photos')).toBeVisible();
    await attachTinyJpeg(page);
    await expect(page.getByRole('button', { name: 'Remove photo' })).toBeVisible();
    await shotScreen(page, 'state-welcome-ask-one-photo');
  });

  test('state /welcome ask-several-photos', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await beginAsk(page);
    await askAmount(page, '21000');
    await page
      .locator('input[type="file"]')
      .setInputFiles(['e2e/fixtures/tiny.jpg', 'e2e/fixtures/tiny.jpg']);
    await expect(page.getByAltText('Selected photo')).toHaveCount(2, { timeout: 10_000 });
    await shotScreen(page, 'state-welcome-ask-several-photos');
  });

  test('state /welcome ask-video', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await beginAsk(page);
    await askAmount(page, '21000');
    await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.mp4');
    await expect(page.locator('video')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Remove video' })).toBeVisible();
    await shotScreen(page, 'state-welcome-ask-video');
  });

  test('state /welcome ask-preparing', async ({ page }) => {
    await seedAda(page);
    await hangCreateImageBitmap(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await beginAsk(page);
    await askAmount(page, '21000');
    await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.jpg');
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await expect(page.getByAltText('Selected photo')).toHaveCount(0);
    await shotScreen(page, 'state-welcome-ask-preparing');
  });

  test('state /welcome ask-unsupported', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await beginAsk(page);
    await askAmount(page, '21000');
    await attachGif(page);
    await expect(
      page.getByText('Use a JPEG, PNG, or WebP photo, or an MP4, WebM, or MOV video'),
    ).toBeVisible();
    await expect(page.getByAltText('Selected photo')).toHaveCount(0);
    await shotScreen(page, 'state-welcome-ask-unsupported');
  });

  test('state /welcome ask-too-large', async ({ page }) => {
    await seedAda(page);
    await stubTooLargeJpeg(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await beginAsk(page);
    await askAmount(page, '21000');
    await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.jpg');
    await expect(page.getByText('Keep photos under 1 MB and videos under 32 MB')).toBeVisible();
    await expect(page.getByAltText('Selected photo')).toHaveCount(0);
    await shotScreen(page, 'state-welcome-ask-too-large');
  });

  test('state /welcome ask-too-many', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await beginAsk(page);
    await askAmount(page, '21000');
    await page
      .locator('input[type="file"]')
      .setInputFiles(Array.from({ length: 11 }, () => 'e2e/fixtures/tiny.jpg'));
    await expect(page.getByText('You can add up to 10 photos')).toBeVisible({ timeout: 15_000 });
    await shotScreen(page, 'state-welcome-ask-too-many');
  });

  test('state /welcome ask-text-filled', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await beginAsk(page);
    await askAmount(page, '21000');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Your message').fill('Need help with a train ticket');
    await expect(page.getByLabel('Your message')).toHaveValue('Need help with a train ticket');
    await shotScreen(page, 'state-welcome-ask-text-filled');
  });

  async function openAskPreview(
    page: Page,
    options: {
      daily?: boolean;
      text?: string;
      photo?: 'card' | 'one' | 'several' | 'none';
      video?: boolean;
    },
  ): Promise<void> {
    await beginAsk(page, options.daily === true);
    await askAmount(page);
    if (options.video === true) {
      await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.mp4');
      await expect(page.locator('video')).toBeVisible({ timeout: 10_000 });
    } else if (options.photo === 'card') {
      await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/ask-card.jpg');
      await expect(page.getByAltText('Selected photo')).toBeVisible({ timeout: 10_000 });
    } else if (options.photo === 'one') {
      await attachTinyJpeg(page);
    } else if (options.photo === 'several') {
      await page
        .locator('input[type="file"]')
        .setInputFiles(['e2e/fixtures/tiny.jpg', 'e2e/fixtures/tiny.jpg']);
      await expect(page.getByAltText('Selected photo')).toHaveCount(2, { timeout: 10_000 });
    }
    await page.getByRole('button', { name: 'Continue' }).click();
    if (options.text !== undefined) {
      await page.getByLabel('Your message').fill(options.text);
    }
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Preview')).toBeVisible();
    await expect(
      page.getByRole('button', { name: options.daily === true ? 'Daily' : 'One-time' }),
    ).toHaveAttribute('aria-pressed', 'true');
  }

  test('state /welcome ask-preview-daily', async ({ page }) => {
    await seedAda(page);
    await fulfillRateDay(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await openAskPreview(page, {
      daily: true,
      photo: 'card',
      text: 'Need help with a train ticket',
    });
    await expect(page.getByText("₿1'000")).toBeVisible();
    await expect(page.getByText('$1.00')).toBeVisible();
    await page.getByRole('button', { name: /^Post$/ }).scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-welcome-ask-preview-daily');
  });

  test('state /welcome ask-preview-text', async ({ page }) => {
    await seedAda(page);
    await fulfillRateDay(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await openAskPreview(page, { text: 'Need help with a train ticket' });
    await expect(page.getByAltText('Selected photo')).toHaveCount(0);
    await expect(page.getByText('Need help with a train ticket')).toBeVisible();
    await shotScreen(page, 'state-welcome-ask-preview-text');
  });

  test('state /welcome ask-preview-text-daily', async ({ page }) => {
    await seedAda(page);
    await fulfillRateDay(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await openAskPreview(page, { daily: true, text: 'Need help with a train ticket' });
    await expect(page.getByText('Need help with a train ticket')).toBeVisible();
    await shotScreen(page, 'state-welcome-ask-preview-text-daily');
  });

  test('state /welcome ask-preview-one-photo', async ({ page }) => {
    await seedAda(page);
    await fulfillRateDay(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await openAskPreview(page, { photo: 'one' });
    await expect(page.getByAltText('Selected photo')).toBeVisible();
    await expect(page.getByText('Need help with a train ticket')).toHaveCount(0);
    await shotScreen(page, 'state-welcome-ask-preview-one-photo');
  });

  test('state /welcome ask-preview-one-photo-daily', async ({ page }) => {
    await seedAda(page);
    await fulfillRateDay(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await openAskPreview(page, { daily: true, photo: 'one' });
    await expect(page.getByAltText('Selected photo')).toBeVisible();
    await shotScreen(page, 'state-welcome-ask-preview-one-photo-daily');
  });

  test('state /welcome ask-preview-several', async ({ page }) => {
    await seedAda(page);
    await fulfillRateDay(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await openAskPreview(page, { photo: 'several' });
    await expect(page.getByAltText('Selected photo')).toHaveCount(2);
    await shotScreen(page, 'state-welcome-ask-preview-several');
  });

  test('state /welcome ask-preview-several-daily', async ({ page }) => {
    await seedAda(page);
    await fulfillRateDay(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await openAskPreview(page, { daily: true, photo: 'several' });
    await expect(page.getByAltText('Selected photo')).toHaveCount(2);
    await shotScreen(page, 'state-welcome-ask-preview-several-daily');
  });

  test('state /welcome ask-preview-several-text', async ({ page }) => {
    await seedAda(page);
    await fulfillRateDay(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await openAskPreview(page, { photo: 'several', text: 'Need help with a train ticket' });
    await expect(page.getByText('Need help with a train ticket')).toBeVisible();
    await expect(page.getByAltText('Selected photo')).toHaveCount(2);
    await shotScreen(page, 'state-welcome-ask-preview-several-text');
  });

  test('state /welcome ask-preview-several-text-daily', async ({ page }) => {
    await seedAda(page);
    await fulfillRateDay(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await openAskPreview(page, {
      daily: true,
      photo: 'several',
      text: 'Need help with a train ticket',
    });
    await expect(page.getByAltText('Selected photo')).toHaveCount(2);
    await shotScreen(page, 'state-welcome-ask-preview-several-text-daily');
  });

  test('state /welcome ask-preview-video', async ({ page }) => {
    await seedAda(page);
    await fulfillRateDay(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await openAskPreview(page, { video: true });
    await expect(page.locator('video')).toBeVisible();
    await shotScreen(page, 'state-welcome-ask-preview-video');
  });

  test('state /welcome ask-preview-video-daily', async ({ page }) => {
    await seedAda(page);
    await fulfillRateDay(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await openAskPreview(page, { daily: true, video: true });
    await expect(page.locator('video')).toBeVisible();
    await shotScreen(page, 'state-welcome-ask-preview-video-daily');
  });

  test('state /welcome ask-preview-video-text', async ({ page }) => {
    await seedAda(page);
    await fulfillRateDay(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await openAskPreview(page, { video: true, text: 'Need help with a train ticket' });
    await expect(page.getByText('Need help with a train ticket')).toBeVisible();
    await expect(page.locator('video')).toBeVisible();
    await shotScreen(page, 'state-welcome-ask-preview-video-text');
  });

  test('state /welcome ask-preview-video-text-daily', async ({ page }) => {
    await seedAda(page);
    await fulfillRateDay(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await openAskPreview(page, {
      daily: true,
      video: true,
      text: 'Need help with a train ticket',
    });
    await expect(page.locator('video')).toBeVisible();
    await shotScreen(page, 'state-welcome-ask-preview-video-text-daily');
  });

  async function holdAskPost(page: Page, status: number): Promise<() => void> {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/messages(?:\?|$)/, async (route) => {
      if (route.request().method() === 'POST') {
        if (status === 200) {
          await held;
        }
        await route.fulfill({
          status,
          contentType: 'application/json',
          body:
            status === 200
              ? JSON.stringify({
                  id: 'm-ask-post',
                  name: 'Ada',
                  text: 'Need help with a train ticket',
                  createdAt: '2026-08-28T12:00:00.000Z',
                  sats: 0,
                  goalSats: 1000,
                  payable: false,
                  hasPhoto: true,
                  role: 'verified',
                })
              : JSON.stringify({ error: 'unavailable' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [] }),
      });
    });
    return release;
  }

  test('state /welcome ask-posting', async ({ page }) => {
    await seedAda(page, 'verified');
    const release = await holdAskPost(page, 200);
    await fulfillRateDay(page);
    await page.goto('/welcome');
    await openAskPreview(page, { photo: 'one', text: 'Need help with a train ticket' });
    await page.getByRole('button', { name: /^Post$/ }).click();
    await expect(page.getByRole('button', { name: /^Post$/ })).toBeDisabled();
    await shotScreen(page, 'state-welcome-ask-posting');
    release();
  });

  test('state /welcome ask-posting-daily', async ({ page }) => {
    await seedAda(page, 'verified');
    const release = await holdAskPost(page, 200);
    await fulfillRateDay(page);
    await page.goto('/welcome');
    await openAskPreview(page, {
      daily: true,
      photo: 'one',
      text: 'Need help with a train ticket',
    });
    await page.getByRole('button', { name: /^Post$/ }).click();
    await expect(page.getByRole('button', { name: /^Post$/ })).toBeDisabled();
    await shotScreen(page, 'state-welcome-ask-posting-daily');
    release();
  });

  test('state /welcome ask-error-request', async ({ page }) => {
    await seedAda(page, 'verified');
    await holdAskPost(page, 500);
    await fulfillRateDay(page);
    await page.goto('/welcome');
    await openAskPreview(page, { photo: 'one', text: 'Need help with a train ticket' });
    await page.getByRole('button', { name: /^Post$/ }).click();
    await expect(page.getByText('Could not post your message')).toBeVisible();
    await shotScreen(page, 'state-welcome-ask-error-request');
  });

  test('state /welcome ask-error-request-daily', async ({ page }) => {
    await seedAda(page, 'verified');
    await holdAskPost(page, 500);
    await fulfillRateDay(page);
    await page.goto('/welcome');
    await openAskPreview(page, {
      daily: true,
      photo: 'one',
      text: 'Need help with a train ticket',
    });
    await page.getByRole('button', { name: /^Post$/ }).click();
    await expect(page.getByText('Could not post your message')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Daily' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await shotScreen(page, 'state-welcome-ask-error-request-daily');
  });

  test('welcome filter-open', async ({ page }) => {
    await seedAda(page);
    await fulfillMixedSatsMessages(page);
    await page.goto('/welcome');
    await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Forum view' }).click();
    const list = page.getByRole('listbox', { name: 'Forum view' });
    await expect(list).toBeVisible();
    await expect(list.getByRole('option', { name: 'Active', exact: true })).toBeVisible();
    await expect(list.getByRole('option', { name: 'No gifts yet', exact: true })).toBeVisible();
    await expect(list.getByRole('option', { name: 'All', exact: true })).toBeVisible();
    await expect(list.getByRole('option', { name: 'Most popular', exact: true })).toBeVisible();
    await shotScreen(page, 'state-welcome-filter-open');
  });

  test('welcome unpaid', async ({ page }) => {
    await seedAda(page);
    await fulfillMixedSatsMessages(page);
    await page.goto('/welcome');
    await chooseForumView(page, 'No gifts yet');
    await expect(page.getByRole('combobox', { name: 'Forum view' })).toContainText('No gifts yet');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(page.getByText('Does anyone have spare sats this week?')).toBeVisible();
    await expect(page.getByText('Thank you both — that helps.')).not.toBeVisible();
    await expect(page.getByText('I can send a small gift tomorrow.')).not.toBeVisible();
    await shotScreen(page, 'state-welcome-unpaid');
  });

  test('welcome unpaid-new-count', async ({ page }) => {
    await seedAda(page);
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.forum-unpaid-seen', '2026-01-01T00:00:00.000Z');
    });
    await fulfillMixedSatsMessages(page);
    await page.goto('/welcome');
    const forumView = page.getByRole('combobox', { name: 'Forum view' });
    await expect(forumView).toContainText('Active');
    await expect(forumView).toContainText('1');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await shotScreen(page, 'state-welcome-unpaid-new-count');
  });

  test('welcome empty-unpaid', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/messages(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: 'm1',
              name: 'Bob',
              text: 'Thank you!',
              createdAt: '2026-08-28T10:00:00.000Z',
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
    await chooseForumView(page, 'No gifts yet');
    await expect(
      page.getByText('Every loaded message has already received Bitcoin.'),
    ).toBeVisible();
    await shotScreen(page, 'state-welcome-empty-unpaid');
  });

  test('welcome popular', async ({ page }) => {
    await seedAda(page);
    await fulfillMixedSatsMessages(page);
    await page.goto('/welcome');
    await chooseForumView(page, 'Most popular');
    const items = page.getByRole('listitem');
    await expect(items.nth(0)).toContainText('I can send a small gift tomorrow.');
    await expect(items.nth(0)).toContainText('₿21');
    await expect(items.nth(1)).toContainText('Thank you both — that helps.');
    await expect(items.nth(1)).toContainText('₿5');
    await expect(page.getByText('Does anyone have spare sats this week?')).not.toBeVisible();
    await shotScreen(page, 'state-welcome-popular');
  });

  test('welcome empty-paid', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/messages(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: 'm1',
              name: 'Bob',
              text: 'Does anyone have spare sats this week?',
              createdAt: '2026-08-28T10:00:00.000Z',
              sats: 0,
              payable: true,
              hasPhoto: false,
              role: 'basis',
            },
          ],
        }),
      });
    });
    await page.goto('/welcome');
    await expect(page.getByText('No message has received Bitcoin yet.')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Forum view' })).toContainText('Active');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(page.getByText('Does anyone have spare sats this week?')).not.toBeVisible();
    await shotScreen(page, 'state-welcome-empty-paid');
  });

  test('welcome empty', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/messages(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [] }),
      });
    });
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await shotScreen(page, 'state-welcome-empty');
  });

  test('welcome loading', async ({ page }) => {
    await seedAda(page);
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/messages(?:\?|$)/, async (route) => {
      await held;
      await route.abort();
    });
    await page.goto('/welcome');
    await expect(page.locator('p.text-center', { hasText: 'Loading…' })).toBeVisible();
    await shotScreen(page, 'state-welcome-loading');
    release();
  });

  test('welcome error', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/messages(?:\?|$)/, async (route) => {
      await route.abort();
    });
    await page.goto('/welcome');
    await expect(page.getByText('Could not load messages. Please try again.')).toBeVisible();
    await shotScreen(page, 'state-welcome-error');
  });

  test('welcome validation-error', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/messages(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [] }),
      });
    });
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.getByText('Enter a message or add a photo or video')).toBeVisible();
    await shotScreen(page, 'state-welcome-validation-error');
  });

  test('welcome error-ask', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/messages(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [] }),
      });
    });
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await page.getByRole('button', { name: 'Ask for money' }).click();
    await page.getByLabel('Ask').fill('0');
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await shotScreen(page, 'state-welcome-error-ask');
  });

  test('welcome error-ask-daily', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/messages(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [] }),
      });
    });
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await page.getByRole('button', { name: 'Ask for money' }).click();
    await page.getByRole('button', { name: 'Daily' }).click();
    await expect(page.getByRole('button', { name: 'Daily' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByLabel('Ask').fill('0');
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await shotScreen(page, 'state-welcome-error-ask-daily');
  });

  test('welcome photo', async ({ page }) => {
    await seedAda(page);
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
              role: 'basis',
            },
          ],
        }),
      });
    });
    await page.route(/\/messages\/m-photo\/photo$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/jpeg',
        // 1×1 JPEG
        body: Buffer.from(
          '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
          'base64',
        ),
      });
    });
    await page.goto('/welcome');
    await chooseForumView(page, 'All');
    await expect(page.getByAltText('Photo from Ada')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add a photo or video' })).toBeVisible();
    await shotScreen(page, 'state-welcome-photo');
  });

  test('welcome photos', async ({ page }) => {
    await seedAda(page);
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
              role: 'basis',
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
    await page.route(/\/messages\/m-photo\/photo\/1\.jpg/, async (route) => {
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
    await expect(page.getByAltText('Photo from Ada')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Add a photo or video' })).toBeVisible();
    await shotScreen(page, 'state-welcome-photos');
  });

  test('welcome photo-and-text', async ({ page }) => {
    await seedAda(page, 'verified');
    await page.route(/\/messages(?:\?|$)/, async (route) => {
      if (route.request().method() === 'POST') {
        const parsed = route.request().postDataJSON() as {
          text?: string;
          photo?: { data?: string };
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'm-both',
            name: 'Ada',
            text: typeof parsed.text === 'string' ? parsed.text.trim() : '',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: Boolean(parsed.photo?.data),
            role: 'basis',
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [] }),
      });
    });
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await page.getByLabel('Your message').fill('Hello with this photo.');
    await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.jpg');
    await expect(page.getByAltText('Selected photo')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    const row = page.locator('li[data-message-id="m-both"]');
    await expect(row).toContainText('Hello with this photo.');
    const photo = row.getByRole('img', { name: 'Photo from Ada' });
    await expect(photo).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(async () =>
        row.evaluate((el) => {
          const img = el.querySelector('img');
          const caption = el.querySelector('p');
          if (img === null || caption === null) {
            return false;
          }
          return Boolean(img.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING);
        }),
      )
      .toBe(true);
    await expect(page.getByLabel('Your message')).toHaveValue('');
    await expect(page.getByAltText('Selected photo')).toHaveCount(0);
    await shotScreen(page, 'state-welcome-photo-and-text');
  });

  test('welcome photos-and-text', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/messages(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: 'm-photos-text',
              name: 'Ada',
              text: 'Hello with these photos.',
              createdAt: '2026-08-28T12:00:00.000Z',
              sats: 0,
              payable: false,
              hasPhoto: true,
              photoCount: 2,
              role: 'basis',
            },
          ],
        }),
      });
    });
    await page.route(/\/messages\/m-photos-text\/photo$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/jpeg',
        body: Buffer.from(
          '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
          'base64',
        ),
      });
    });
    await page.route(/\/messages\/m-photos-text\/photo\/1\.jpg/, async (route) => {
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
    await expect(page.getByAltText('Photo from Ada')).toHaveCount(2);
    await expect(page.getByText('Hello with these photos.')).toBeVisible();
    await shotScreen(page, 'state-welcome-photos-and-text');
  });

  async function emptyForum(page: Page): Promise<void> {
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
  }

  async function stubComposeInvoice(page: Page): Promise<void> {
    await page.route('**/messages/compose-target', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messageId: 'compose-fee', sats: 0 }),
      });
    });
    await page.route(/\/messages\/compose-fee\/invoice$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ pr: 'lnbc1test', amountSats: 1 }),
      });
    });
  }

  const TINY_GIF = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64',
  );

  async function attachGif(page: Page): Promise<void> {
    await page.locator('input[type="file"]').setInputFiles({
      name: 'tiny.gif',
      mimeType: 'image/gif',
      buffer: TINY_GIF,
    });
  }

  async function attachTinyJpeg(page: Page): Promise<void> {
    await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.jpg');
    await expect(page.getByAltText('Selected photo')).toBeVisible({ timeout: 10_000 });
  }

  async function attachTinyMp4(page: Page): Promise<void> {
    await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.mp4');
    await expect(page.locator('form video')).toBeVisible({ timeout: 10_000 });
  }

  async function hangCreateImageBitmap(page: Page): Promise<void> {
    await page.addInitScript(() => {
      window.createImageBitmap = () => new Promise(() => undefined);
    });
  }

  async function stubTooLargeJpeg(page: Page): Promise<void> {
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.toDataURL = function toDataURL() {
        return `data:image/jpeg;base64,${'A'.repeat(1_500_000)}`;
      };
    });
  }

  test('welcome composer-text', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await page.getByLabel('Your message').fill('Caption before attaching a photo.');
    await expect(page.getByLabel('Your message')).toHaveValue('Caption before attaching a photo.');
    await expect(page.getByAltText('Selected photo')).toHaveCount(0);
    await shotScreen(page, 'state-welcome-composer-text');
  });

  test('welcome keyboard-viewport', async ({ page }) => {
    await page.addInitScript(() => {
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
    await seedAda(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await page.getByLabel('Your message').focus();
    await shotScreen(page, 'state-welcome-keyboard-viewport');
  });

  test('welcome composer-photo', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await attachTinyJpeg(page);
    await expect(page.getByLabel('Your message')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Remove photo' })).toBeVisible();
    await shotScreen(page, 'state-welcome-composer-photo');
  });

  test('welcome composer-photos', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await page
      .locator('input[type="file"]')
      .setInputFiles(['e2e/fixtures/tiny.jpg', 'e2e/fixtures/tiny.jpg']);
    await expect(page.getByAltText('Selected photo')).toHaveCount(2, { timeout: 10_000 });
    await shotScreen(page, 'state-welcome-composer-photos');
  });

  test('welcome composer-photo-and-text', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await page.getByLabel('Your message').fill('Caption with selected photo.');
    await attachTinyJpeg(page);
    await expect(page.getByAltText('Selected photo')).toBeVisible();
    await expect(page.getByLabel('Your message')).toHaveValue('Caption with selected photo.');
    await shotScreen(page, 'state-welcome-composer-photo-and-text');
  });

  test('welcome composer-photos-and-text', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await page.getByLabel('Your message').fill('Caption with selected photos.');
    await page
      .locator('input[type="file"]')
      .setInputFiles(['e2e/fixtures/tiny.jpg', 'e2e/fixtures/tiny.jpg']);
    await expect(page.getByAltText('Selected photo')).toHaveCount(2, { timeout: 10_000 });
    await expect(page.getByLabel('Your message')).toHaveValue('Caption with selected photos.');
    await shotScreen(page, 'state-welcome-composer-photos-and-text');
  });

  test('welcome composer-video', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await attachTinyMp4(page);
    await expect(page.getByLabel('Your message')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Remove video' })).toBeVisible();
    await shotScreen(page, 'state-welcome-composer-video');
  });

  test('welcome composer-video-and-text', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await page.getByLabel('Your message').fill('Caption with selected video.');
    await attachTinyMp4(page);
    await expect(page.locator('form video')).toBeVisible();
    await expect(page.getByLabel('Your message')).toHaveValue('Caption with selected video.');
    await shotScreen(page, 'state-welcome-composer-video-and-text');
  });

  test('welcome composer-text-after-remove', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await page.getByLabel('Your message').fill('Caption kept after removing photo.');
    await attachTinyJpeg(page);
    await page.getByRole('button', { name: 'Remove photo' }).click();
    await expect(page.getByAltText('Selected photo')).toHaveCount(0);
    await expect(page.getByLabel('Your message')).toHaveValue('Caption kept after removing photo.');
    await shotScreen(page, 'state-welcome-composer-text-after-remove');
  });

  test('welcome preparing-photo', async ({ page }) => {
    await seedAda(page);
    await hangCreateImageBitmap(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.jpg');
    await expect(page.getByRole('button', { name: 'Post', exact: true })).toBeDisabled();
    await expect(page.getByAltText('Selected photo')).toHaveCount(0);
    await shotScreen(page, 'state-welcome-preparing-photo');
  });

  test('welcome preparing-photo-and-text', async ({ page }) => {
    await seedAda(page);
    await hangCreateImageBitmap(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await page.getByLabel('Your message').fill('Caption while the photo is preparing.');
    await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.jpg');
    await expect(page.getByLabel('Your message')).toHaveValue(
      'Caption while the photo is preparing.',
    );
    await expect(page.getByRole('button', { name: 'Post', exact: true })).toBeDisabled();
    await expect(page.getByAltText('Selected photo')).toHaveCount(0);
    await shotScreen(page, 'state-welcome-preparing-photo-and-text');
  });

  test('welcome posting-photo-and-text', async ({ page }) => {
    await seedAda(page, 'verified');
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/messages(?:\?|$)/, async (route) => {
      if (route.request().method() === 'POST') {
        await held;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'm-posting',
            name: 'Ada',
            text: 'Caption while the post is in flight.',
            createdAt: '2026-08-28T12:00:00.000Z',
            sats: 0,
            payable: false,
            hasPhoto: true,
            role: 'basis',
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [] }),
      });
    });
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await page.getByLabel('Your message').fill('Caption while the post is in flight.');
    await attachTinyJpeg(page);
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Post', exact: true })).toBeDisabled();
    await expect(page.getByAltText('Selected photo')).toBeVisible();
    await expect(page.getByLabel('Your message')).toHaveValue(
      'Caption while the post is in flight.',
    );
    await shotScreen(page, 'state-welcome-posting-photo-and-text');
    release();
  });

  test('welcome photo-loading', async ({ page }) => {
    await seedAda(page);
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/messages(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: 'm-loading',
              name: 'Ada',
              text: 'Caption waiting for the photo to load.',
              createdAt: '2026-08-28T12:00:00.000Z',
              sats: 0,
              payable: false,
              hasPhoto: true,
              role: 'basis',
            },
          ],
        }),
      });
    });
    await page.route(/\/messages\/m-loading\/photo$/, async (route) => {
      await held;
      await route.abort();
    });
    await page.goto('/welcome');
    await chooseForumView(page, 'All');
    await expect(page.getByText('Caption waiting for the photo to load.')).toBeVisible();
    await expect(page.getByAltText('Photo from Ada')).toHaveCount(0);
    await shotScreen(page, 'state-welcome-photo-loading');
    release();
  });

  test('welcome error-unsupported', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await attachGif(page);
    await expect(
      page.getByText('Use a JPEG, PNG, or WebP photo, or an MP4, WebM, or MOV video'),
    ).toBeVisible();
    await expect(page.getByAltText('Selected photo')).toHaveCount(0);
    await shotScreen(page, 'state-welcome-error-unsupported');
  });

  test('welcome error-unsupported-with-text', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await page.getByLabel('Your message').fill('Caption with an unsupported photo.');
    await attachGif(page);
    await expect(
      page.getByText('Use a JPEG, PNG, or WebP photo, or an MP4, WebM, or MOV video'),
    ).toBeVisible();
    await expect(page.getByLabel('Your message')).toHaveValue('Caption with an unsupported photo.');
    await expect(page.getByAltText('Selected photo')).toHaveCount(0);
    await shotScreen(page, 'state-welcome-error-unsupported-with-text');
  });

  test('welcome pay-composer', async ({ page }, testInfo) => {
    await seedAda(page, 'basis', true);
    await emptyForum(page);
    await stubComposeInvoice(page);
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await page.getByLabel('Your message').fill('Hello gifts');
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeVisible();
    if (isMobileProject(testInfo)) {
      await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toHaveCount(0);
    } else {
      await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toBeVisible();
    }
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await shotScreen(page, 'state-welcome-pay-composer');
  });

  test('welcome error-too-large', async ({ page }) => {
    await seedAda(page);
    await stubTooLargeJpeg(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.jpg');
    await expect(page.getByText('Keep photos under 1 MB and videos under 32 MB')).toBeVisible();
    await expect(page.getByAltText('Selected photo')).toHaveCount(0);
    await shotScreen(page, 'state-welcome-error-too-large');
  });

  test('welcome error-too-many', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await page
      .locator('input[type="file"]')
      .setInputFiles(Array.from({ length: 11 }, () => 'e2e/fixtures/tiny.jpg'));
    await expect(page.getByText('You can add up to 10 photos')).toBeVisible({ timeout: 10_000 });
    await shotScreen(page, 'state-welcome-error-too-many');
  });

  test('welcome error-too-large-with-text', async ({ page }) => {
    await seedAda(page);
    await stubTooLargeJpeg(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await page.getByLabel('Your message').fill('Caption with a photo that is too large.');
    await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.jpg');
    await expect(page.getByText('Keep photos under 1 MB and videos under 32 MB')).toBeVisible();
    await expect(page.getByLabel('Your message')).toHaveValue(
      'Caption with a photo that is too large.',
    );
    await expect(page.getByAltText('Selected photo')).toHaveCount(0);
    await shotScreen(page, 'state-welcome-error-too-large-with-text');
  });

  test('welcome error-too-many-with-text', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await page.getByLabel('Your message').fill('Caption with too many photos.');
    await page
      .locator('input[type="file"]')
      .setInputFiles(Array.from({ length: 11 }, () => 'e2e/fixtures/tiny.jpg'));
    await expect(page.getByText('You can add up to 10 photos')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel('Your message')).toHaveValue('Caption with too many photos.');
    await shotScreen(page, 'state-welcome-error-too-many-with-text');
  });

  test('welcome error-request-photo-and-text', async ({ page }) => {
    await seedAda(page, 'verified');
    await page.route(/\/messages(?:\?|$)/, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'unavailable' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [] }),
      });
    });
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await page.getByLabel('Your message').fill('Caption when posting fails.');
    await attachTinyJpeg(page);
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.getByText('Could not post your message')).toBeVisible();
    await expect(page.getByAltText('Selected photo')).toBeVisible();
    await expect(page.getByLabel('Your message')).toHaveValue('Caption when posting fails.');
    await shotScreen(page, 'state-welcome-error-request-photo-and-text');
  });

  test('welcome menu-open', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.goto('/welcome');
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('link', { name: /Profile/ })).toBeVisible();
    await shotScreen(page, 'state-welcome-menu');
  });

  test('welcome menu-unread', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.route('**/forum/notifications', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ notifications: [], unreadCount: 3 }),
      });
    });
    await page.goto('/welcome');
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('link', { name: 'Notifications, 3 unread' })).toBeVisible();
    await shotScreen(page, 'state-welcome-menu-unread');
  });

  test('welcome menu-inbox-unread', async ({ page }) => {
    await seedAda(page);
    await emptyForum(page);
    await page.route(/\/conversations$/, async (route) => {
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
              name: 'Cara',
              lastText: 'Hey',
              lastAt: '2026-08-28T11:00:00.000Z',
              lastFromMe: false,
              lastSats: 0,
              unread: true,
            },
          ],
          unreadCount: 2,
        }),
      });
    });
    await page.goto('/welcome');
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('link', { name: 'Messages, 2 unread' })).toBeVisible();
    await shotScreen(page, 'state-welcome-menu-inbox-unread');
  });

  test('welcome menu-moderation-unread', async ({ page }) => {
    await seedAda(page, 'moderator');
    await emptyForum(page);
    await page.route('**/conversations/moderator-group', async (route) => {
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
    await page.goto('/welcome');
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('link', { name: 'Moderation, 1 unread' })).toBeVisible();
    await shotScreen(page, 'state-welcome-menu-moderation-unread');
  });

  test('welcome pay-amount', async ({ page }, testInfo) => {
    await seedAda(page);
    await stubPayInvoice(page);
    await page.route('**/gifts/stats**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalSats: 100_000_000,
          totalBtc: '1.00000000',
          totalUsd: '100000.00',
          totalChf: '80000.00',
          totalEur: '90000.00',
          totalPhp: '5600000.00',
          giftCount: 1,
          recipientCount: 1,
          firstPaidAt: '2026-07-01T00:00:00.000Z',
          lastPaidAt: '2026-07-01T00:00:00.000Z',
          spendOverTime: [
            {
              day: '2026-07-01',
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
          byRecipient: [],
          byMonth: [],
          fx: {
            quote: 'BTC-USD',
            dayBasis: 'utc',
            source: 'coinbase-exchange-daily-close',
            quotes: [{ code: 'USD', pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' }],
          },
        }),
      });
    });
    await page.goto('/welcome');
    await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
    await chooseForumView(page, 'All');
    await page.getByRole('button', { name: 'Show reactions' }).click();
    const replyCard = page.locator('[data-reply-id="r-pay"]');
    await replyCard.getByRole('button', { name: 'Send Bitcoin' }).click();
    await replyCard.getByLabel('Amount').fill('21');
    if (isMobileProject(testInfo)) {
      await expect(page.getByRole('button', { name: 'Pay', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0);
    } else {
      await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Pay', exact: true })).toHaveCount(0);
    }
    await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toHaveCount(0);
    await expect(
      page.getByText("The author's wallet cannot receive this Bitcoin payment"),
    ).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Fiat currency' })).toHaveCount(0);
    await expect(page.getByText('$0.02').first()).toBeVisible();
    await shotScreen(page, 'state-welcome-pay-amount');
  });

  test('welcome pay-qr', async ({ page }, testInfo) => {
    await seedAda(page);
    await stubPayInvoice(page);
    await openPaySheet(page);
    if (isMobileProject(testInfo)) {
      await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toHaveCount(0);
    } else {
      await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toBeVisible();
    }
    await shotScreen(page, 'state-welcome-pay-qr');
  });

  test('welcome pay-smartphone', async ({ page }, testInfo) => {
    await seedAda(page);
    await stubPayInvoice(page);
    await openPaySheet(page);
    if (isMobileProject(testInfo)) {
      await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeVisible();
    } else {
      await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toBeVisible();
    }
    await shotScreen(page, 'state-welcome-pay-smartphone');
  });

  test('welcome pay-author-wallet', async ({ page }) => {
    await stubWalletLocationAssign(page);
    await seedAda(page);
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
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: "The author's wallet cannot receive this Bitcoin payment",
        }),
      });
    });
    await page.goto('/welcome');
    await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
    await chooseForumView(page, 'All');
    await page.getByRole('button', { name: 'Show reactions' }).click();
    const replyCard = page.locator('[data-reply-id="r-pay"]');
    await replyCard.getByRole('button', { name: 'Send Bitcoin' }).click();
    await replyCard.getByLabel('Amount').fill('21');
    await submitPayAmount(page);
    await expect(
      page.getByText("The author's wallet cannot receive this Bitcoin payment"),
    ).toBeVisible();
    await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toHaveCount(0);
    await shotScreen(page, 'state-welcome-pay-author-wallet');
  });

  test('welcome role-hint', async ({ page }) => {
    await seedAda(page);
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
              sats: 0,
              payable: true,
              hasPhoto: false,
              role: 'moderator',
            },
            {
              id: 'm2',
              name: 'Carol',
              text: 'I can send a small gift tomorrow.',
              createdAt: '2026-08-28T11:00:00.000Z',
              sats: 21,
              payable: true,
              hasPhoto: false,
              role: 'verified',
            },
            {
              id: 'm1',
              name: 'Bob',
              text: 'Does anyone have spare sats this week?',
              createdAt: '2026-08-28T10:00:00.000Z',
              sats: 0,
              payable: true,
              hasPhoto: false,
              role: 'basis',
            },
          ],
        }),
      });
    });
    await page.goto('/welcome');
    await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
    await chooseForumView(page, 'All');
    await page.getByRole('button', { name: 'Verified' }).click();
    await expect(
      page.getByText('A moderator has met this person in real life and confirmed they are real.'),
    ).toBeVisible();
    await shotScreen(page, 'state-welcome-role-hint');
  });

  test('welcome overlay-address', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          location: null,
          lightningAddress: null,
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          aboutMe: null,
          setup: null,
          missing: ['lightning-address'],
        }),
      });
    });
    await emptyForum(page);
    await page.goto('/welcome');
    await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
    await page.getByLabel('Your message').fill('Hello');
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(
      page.getByRole('dialog', { name: 'Add your Wallet of Satoshi address' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0);
    await shotScreen(page, 'state-welcome-overlay-address');
  });

  test('welcome overlay-username', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: null,
          location: null,
          lightningAddress: 'ada@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          aboutMe: null,
          setup: null,
          missing: ['username'],
        }),
      });
    });
    await emptyForum(page);
    await page.goto('/welcome');
    await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
    await page.getByLabel('Your message').fill('Hello');
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Add your 21.gifts name' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Skip' })).toHaveCount(0);
    await shotScreen(page, 'state-welcome-overlay-username');
  });

  test('welcome overlay-introduce', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          aboutMe: null,
          setup: null,
          missing: [],
          hasPosted: false,
        }),
      });
    });
    await emptyForum(page);
    await page.goto('/welcome');
    await expect(page.getByRole('dialog', { name: 'Introduce yourself' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Write an introduction' })).toBeVisible();
    await shotScreen(page, 'state-welcome-overlay-introduce');
  });

  test('welcome overlay-external-link', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          aboutMe: null,
          setup: null,
          missing: [],
          forumLawsDismissed: true,
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
              text: 'New:\nhttps://example.com/phish',
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
    await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
    await page.getByRole('link', { name: 'https://example.com/phish' }).click();
    await expect(page.getByRole('dialog', { name: 'Open external link?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open link' })).toBeVisible();
    await shotScreen(page, 'state-welcome-overlay-external-link');
  });
});

test.describe('shops screens', () => {
  async function seedAda(page: Page, role: 'basis' | 'moderator' = 'basis'): Promise<void> {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          role,
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          aboutMe: null,
          setup: null,
          missing: [],
        }),
      });
    });
  }

  test('shops default', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/messages(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: 'm-shop',
              name: 'Ada',
              text: 'Cafe Luna\n\n#21GiftsShop',
              createdAt: '2026-08-28T12:00:00.000Z',
              sats: 5,
              payable: true,
              hasPhoto: false,
              role: 'basis',
            },
          ],
        }),
      });
    });
    await page.goto('/shops');
    await expect(page.getByRole('heading', { name: 'Shops' })).toBeVisible();
    await expect(page.getByText('Cafe Luna')).toBeVisible();
    await expect(page.getByRole('link', { name: '#Shop' })).toBeVisible();
    await expect(page.getByText('#21GiftsShop')).toHaveCount(0);
    await shotScreen(page, 'screen-shops');
  });

  test('shops empty', async ({ page }) => {
    await seedAda(page);
    await fulfillMixedSatsMessages(page);
    await page.goto('/shops');
    await expect(page.getByText('No shops yet — add the first one.')).toBeVisible();
    await shotScreen(page, 'state-shops-empty');
  });

  test('shops loading', async ({ page }) => {
    await seedAda(page);
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/messages(?:\?|$)/, async (route) => {
      await held;
      await route.abort();
    });
    await page.goto('/shops');
    await expect(page.locator('p.text-center', { hasText: 'Loading…' })).toBeVisible();
    await shotScreen(page, 'state-shops-loading');
    release();
  });

  test('shops error', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/messages(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: '{"error":"Unavailable"}',
      });
    });
    await page.goto('/shops');
    await expect(page.getByText('Could not load messages. Please try again.')).toBeVisible();
    await shotScreen(page, 'state-shops-error');
  });
});

test.describe('contact screens', () => {
  async function seedAda(page: Page, role: 'basis' | 'moderator' = 'basis'): Promise<void> {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          aboutMe: null,
          setup: null,
          missing: [],
        }),
      });
    });
  }

  test('screen /contact', async ({ page }) => {
    await seedAda(page);
    await page.goto('/contact');
    await expect(
      page.getByText(
        'Write to 21.gifts here — there is no email address. This is the only way to reach us.',
      ),
    ).toBeVisible();
    await shotScreen(page, 'screen-contact');
  });

  test('contact validation-error', async ({ page }) => {
    await seedAda(page);
    await page.goto('/contact');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('Enter a message')).toBeVisible();
    await shotScreen(page, 'state-contact-validation-error');
  });

  test('contact success', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/contact\/submit$/, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'c1',
          name: 'Ada',
          text: 'Hello',
          createdAt: '2026-08-28T12:00:00.000Z',
        }),
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
              id: 'c1',
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
    await page.goto('/contact');
    await page.getByLabel('Your message').fill('Hello team');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('Hello team')).toBeVisible();
    await shotScreen(page, 'state-contact-success');
  });
});

test.describe('inbox screens', () => {
  async function seedAda(page: Page, role: 'basis' | 'moderator' = 'basis'): Promise<void> {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          role,
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          aboutMe: null,
          setup: null,
          missing: [],
        }),
      });
    });
  }

  async function mockThreeConversations(page: Page): Promise<void> {
    await page.route(/\/conversations$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversations: [
            {
              id: 'conv-bob',
              kind: 'member_member',
              name: 'Bob',
              lastText: 'Can you help?',
              lastAt: '2026-08-28T14:00:00.000Z',
              lastFromMe: false,
              lastSats: 0,
            },
            {
              id: 'conv-21',
              kind: 'member_platform',
              name: '21.gifts',
              lastText: 'Hello team',
              lastAt: '2026-08-28T12:00:00.000Z',
              lastFromMe: false,
              lastSats: 0,
            },
            {
              id: 'conv-damus',
              kind: 'member_damus',
              name: 'npub1abc…xyz',
              lastText: 'Hi from Damus',
              lastAt: '2026-08-28T11:00:00.000Z',
              lastFromMe: false,
              lastSats: 0,
            },
          ],
        }),
      });
    });
  }

  test('screen /messages', async ({ page }) => {
    await seedAda(page);
    await mockThreeConversations(page);
    await page.goto('/messages');
    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Conversation type' })).toHaveCount(0);
    const list = page.getByRole('list', { name: 'Conversations' });
    await expect(list.getByText('Bob')).toBeVisible();
    await expect(list.getByText('21.gifts')).toBeVisible();
    await expect(list.getByText('npub1abc…xyz')).toBeVisible();
    await shotScreen(page, 'screen-messages');
  });

  test('messages unread', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/conversations$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversations: [
            {
              id: 'conv-bob',
              kind: 'member_member',
              name: 'Bob',
              lastText: 'Hi from Bob',
              lastAt: '2026-08-28T12:00:00.000Z',
              lastFromMe: false,
              lastSats: 0,
              unread: true,
              unreadMessageCount: 2,
            },
          ],
          unreadCount: 1,
        }),
      });
    });
    await page.goto('/messages');
    await expect(page.getByRole('button', { name: 'Bob, 2 unread' })).toBeVisible();
    await shotScreen(page, 'state-messages-unread');
  });

  test('messages contact', async ({ page }) => {
    await seedAda(page, 'moderator');
    await mockThreeConversations(page);
    await page.goto('/messages');
    const group = page.getByRole('group', { name: 'Conversation type' });
    await group.getByRole('button', { name: 'Contact' }).click();
    const list = page.getByRole('list', { name: 'Conversations' });
    await expect(list.getByText('21.gifts')).toBeVisible();
    await shotScreen(page, 'state-messages-contact');
  });

  test('messages damus', async ({ page }) => {
    await seedAda(page, 'moderator');
    await mockThreeConversations(page);
    await page.goto('/messages');
    const group = page.getByRole('group', { name: 'Conversation type' });
    await group.getByRole('button', { name: 'Damus' }).click();
    const list = page.getByRole('list', { name: 'Conversations' });
    await expect(list.getByText('npub1abc…xyz')).toBeVisible();
    await shotScreen(page, 'state-messages-damus');
  });

  test('messages sent-preview', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/conversations$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversations: [
            {
              id: 'conv-bob',
              kind: 'member_member',
              name: 'Bob',
              lastText: 'Hello team',
              lastAt: '2026-08-28T12:00:00.000Z',
              lastFromMe: true,
              lastSats: 0,
            },
          ],
        }),
      });
    });
    await page.goto('/messages');
    await expect(page.getByText('You: Hello team')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Conversation type' })).toHaveCount(0);
    await shotScreen(page, 'state-messages-sent-preview');
  });

  test('messages empty', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/conversations$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ conversations: [] }),
      });
    });
    await page.goto('/messages');
    await expect(page.getByText('No private messages yet.')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Conversation type' })).toHaveCount(0);
    await shotScreen(page, 'state-messages-empty');
  });

  test('messages loading', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/conversations$/, async () => {
      /* hang */
    });
    await page.goto('/messages');
    await expect(page.locator('p.text-center', { hasText: 'Loading…' })).toBeVisible();
    await shotScreen(page, 'state-messages-loading');
  });

  test('messages error', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/conversations$/, async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Platform account is not configured' }),
      });
    });
    await page.goto('/messages');
    await expect(page.getByText('Could not load messages. Please try again.')).toBeVisible();
    await shotScreen(page, 'state-messages-error');
  });

  test('messages thread', async ({ page }) => {
    await seedAda(page);
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
              name: '21.gifts',
              text: 'Hello team',
              createdAt: '2026-08-28T12:00:00.000Z',
              fromMe: false,
              sats: 0,
            },
            {
              id: 'm2',
              name: 'Ada',
              text: 'Thanks',
              createdAt: '2026-08-28T12:05:00.000Z',
              fromMe: true,
              sats: 0,
            },
          ],
        }),
      });
    });
    await page.goto('/messages?c=conv-21');
    await expect(page.getByText('Hello team')).toBeVisible();
    await expect(page.getByText('You')).toBeVisible();
    await shotScreen(page, 'state-messages-thread');
  });

  test('messages sent-sats', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/conversations$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversations: [
            {
              id: 'conv-bob',
              kind: 'member_member',
              name: 'Bob',
              lastText: '',
              lastAt: '2026-08-28T12:00:00.000Z',
              lastFromMe: true,
              lastSats: 21,
            },
          ],
        }),
      });
    });
    await page.goto('/messages');
    await expect(page.getByText('₿21')).toBeVisible();
    await shotScreen(page, 'state-messages-sent-sats');
  });

  test('messages thread-gift', async ({ page }) => {
    await seedAda(page);
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
              name: '21.gifts',
              text: 'Hello team',
              createdAt: '2026-08-28T12:00:00.000Z',
              fromMe: false,
              sats: 0,
            },
            {
              id: 'm-gift',
              name: 'Ada',
              text: '',
              createdAt: '2026-08-28T12:05:00.000Z',
              fromMe: true,
              sats: 21,
            },
          ],
        }),
      });
    });
    await page.goto('/messages?c=conv-21');
    await expect(page.getByText('send ₿21')).toBeVisible();
    await expect(page.getByLabel('Amount')).toBeVisible();
    await shotScreen(page, 'state-messages-thread-gift');
  });

  test('messages thread-text-sats', async ({ page }) => {
    await seedAda(page);
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
              lastText: 'Hi',
              lastAt: '2026-08-28T12:00:00.000Z',
              lastFromMe: false,
              lastSats: 21,
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
              name: '21.gifts',
              text: 'Hi',
              createdAt: '2026-08-28T12:00:00.000Z',
              fromMe: false,
              sats: 21,
            },
          ],
        }),
      });
    });
    await page.goto('/messages?c=conv-21');
    await expect(page.getByText('Hi')).toBeVisible();
    await expect(page.getByText('₿21')).toBeVisible();
    await shotScreen(page, 'state-messages-thread-text-sats');
  });

  test('messages thread-pay-qr', async ({ page }, testInfo) => {
    await seedAda(page);
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
              name: '21.gifts',
              text: 'Hello team',
              createdAt: '2026-08-28T12:00:00.000Z',
              fromMe: false,
              sats: 0,
            },
            {
              id: 'm2',
              name: 'Ada',
              text: 'Thanks',
              createdAt: '2026-08-28T12:05:00.000Z',
              fromMe: true,
              sats: 0,
            },
          ],
        }),
      });
    });
    await page.route(/\/conversations\/conv-21\/invoice$/, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ pr: 'lnbc21n1test', amountSats: 21, messageId: 'gift-1' }),
      });
    });
    await page.route(/sinceMessageId=/, async () => {
      /* hang — keep payWaiting while the sheet is open */
    });
    await page.goto('/messages?c=conv-21');
    await expect(page.getByText('Hello team')).toBeVisible();
    await page.getByLabel('Amount').fill('21');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeVisible();
    if (isMobileProject(testInfo)) {
      await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toHaveCount(0);
    } else {
      await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toBeVisible();
    }
    await shotScreen(page, 'state-messages-thread-pay-qr');
  });

  test('messages thread-quoted-note', async ({ page }) => {
    await seedAda(page);
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
              name: '21.gifts',
              text: `see ${QUOTED_NOTE_URL}`,
              createdAt: '2026-08-28T12:00:00.000Z',
              fromMe: false,
              sats: 0,
            },
          ],
        }),
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
    await page.goto('/messages?c=conv-21');
    await expect(page.getByText('A Quick Technical Note')).toBeVisible();
    await expect(page.getByText(QUOTED_NOTE_URL)).toHaveCount(0);
    await shotScreen(page, 'state-messages-thread-quoted-note');
  });

  test('messages thread-composer-photo', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/conversations$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversations: [
            {
              id: 'conv-bob',
              kind: 'member_member',
              name: 'Bob',
              lastText: 'Hello',
              lastAt: '2026-08-28T12:00:00.000Z',
              lastFromMe: false,
              lastSats: 0,
            },
          ],
        }),
      });
    });
    await page.route(/\/conversations\/conv-bob(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: 'm1',
              name: 'Bob',
              text: 'Hello',
              createdAt: '2026-08-28T12:00:00.000Z',
              fromMe: false,
              sats: 0,
            },
          ],
        }),
      });
    });
    await page.goto('/messages?c=conv-bob');
    await expect(page.getByLabel('Your message')).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.jpg');
    await expect(page.getByRole('button', { name: 'Remove photo' })).toBeVisible({
      timeout: 10_000,
    });
    await shotScreen(page, 'state-messages-thread-composer-photo');
  });

  test('messages thread-composer-photos', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/conversations$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversations: [
            {
              id: 'conv-bob',
              kind: 'member_member',
              name: 'Bob',
              lastText: 'Hello',
              lastAt: '2026-08-28T12:00:00.000Z',
              lastFromMe: false,
              lastSats: 0,
            },
          ],
        }),
      });
    });
    await page.route(/\/conversations\/conv-bob(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: 'm1',
              name: 'Bob',
              text: 'Hello',
              createdAt: '2026-08-28T12:00:00.000Z',
              fromMe: false,
              sats: 0,
            },
          ],
        }),
      });
    });
    await page.goto('/messages?c=conv-bob');
    await expect(page.getByLabel('Your message')).toBeVisible();
    await page
      .locator('input[type="file"]')
      .setInputFiles(['e2e/fixtures/tiny.jpg', 'e2e/fixtures/tiny.jpg']);
    await expect(page.getByAltText('Selected photo')).toHaveCount(2, { timeout: 10_000 });
    await shotScreen(page, 'state-messages-thread-composer-photos');
  });

  test('messages thread-photo', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/conversations$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversations: [
            {
              id: 'conv-bob',
              kind: 'member_member',
              name: 'Bob',
              lastText: '',
              lastAt: '2026-08-28T12:00:00.000Z',
              lastFromMe: false,
              lastSats: 0,
            },
          ],
        }),
      });
    });
    await page.route(/\/conversations\/conv-bob(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: 'm-photo',
              name: 'Bob',
              text: '',
              createdAt: '2026-08-28T12:00:00.000Z',
              fromMe: false,
              sats: 0,
              hasPhoto: true,
              photoCount: 1,
            },
          ],
        }),
      });
    });
    await page.route('**/conversations/conv-bob/messages/m-photo/photo', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/jpeg',
        body: fs.readFileSync(path.join(process.cwd(), 'e2e/fixtures/tiny.jpg')),
      });
    });
    await page.goto('/messages?c=conv-bob');
    await expect(page.getByAltText('Photo from Bob')).toBeVisible({ timeout: 10_000 });
    await shotScreen(page, 'state-messages-thread-photo');
  });

  const TINY_GIF = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64',
  );

  async function mockBobThread(page: Page): Promise<void> {
    await page.route(/\/conversations$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversations: [
            {
              id: 'conv-bob',
              kind: 'member_member',
              name: 'Bob',
              lastText: 'Hello',
              lastAt: '2026-08-28T12:00:00.000Z',
              lastFromMe: false,
              lastSats: 0,
            },
          ],
        }),
      });
    });
    await page.route(/\/conversations\/conv-bob(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: 'm1',
              name: 'Bob',
              text: 'Hello',
              createdAt: '2026-08-28T12:00:00.000Z',
              fromMe: false,
              sats: 0,
            },
          ],
        }),
      });
    });
  }

  async function hangCreateImageBitmap(page: Page): Promise<void> {
    await page.addInitScript(() => {
      window.createImageBitmap = () => new Promise(() => undefined);
    });
  }

  async function stubTooLargeJpeg(page: Page): Promise<void> {
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.toDataURL = function toDataURL() {
        return `data:image/jpeg;base64,${'A'.repeat(1_500_000)}`;
      };
    });
  }

  test('messages thread-preparing-photo', async ({ page }) => {
    await seedAda(page);
    await mockBobThread(page);
    await hangCreateImageBitmap(page);
    await page.goto('/messages?c=conv-bob');
    await expect(page.getByLabel('Your message')).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.jpg');
    await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled();
    await expect(page.getByAltText('Selected photo')).toHaveCount(0);
    await shotScreen(page, 'state-messages-thread-preparing-photo');
  });

  test('messages thread-error-unsupported', async ({ page }) => {
    await seedAda(page);
    await mockBobThread(page);
    await page.goto('/messages?c=conv-bob');
    await expect(page.getByLabel('Your message')).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'tiny.gif',
      mimeType: 'image/gif',
      buffer: TINY_GIF,
    });
    await expect(page.getByText('Use a JPEG, PNG, or WebP photo')).toBeVisible();
    await expect(page.getByAltText('Selected photo')).toHaveCount(0);
    await shotScreen(page, 'state-messages-thread-error-unsupported');
  });

  test('messages thread-error-too-large', async ({ page }) => {
    await seedAda(page);
    await mockBobThread(page);
    await stubTooLargeJpeg(page);
    await page.goto('/messages?c=conv-bob');
    await expect(page.getByLabel('Your message')).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.jpg');
    await expect(page.getByText('Keep photos under 1 MB')).toBeVisible();
    await shotScreen(page, 'state-messages-thread-error-too-large');
  });

  test('messages thread-error-too-many', async ({ page }) => {
    await seedAda(page);
    await mockBobThread(page);
    await page.goto('/messages?c=conv-bob');
    await expect(page.getByLabel('Your message')).toBeVisible();
    await page
      .locator('input[type="file"]')
      .setInputFiles(Array.from({ length: 11 }, () => 'e2e/fixtures/tiny.jpg'));
    await expect(page.getByText('You can add up to 10 photos')).toBeVisible({ timeout: 10_000 });
    await shotScreen(page, 'state-messages-thread-error-too-many');
  });
});

test.describe('notifications screens', () => {
  // Goldens are regenerated on the build host.
  async function seedAda(page: Page, role: 'basis' | 'moderator' = 'basis'): Promise<void> {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          name: 'Ada',
          location: null,
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          aboutMe: null,
          setup: null,
          missing: [],
        }),
      });
    });
  }

  test('screen /notifications', async ({ page }) => {
    await seedAda(page);
    await page.route('**/forum/notifications', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          notifications: [
            {
              id: 'n1',
              type: 'forum_reply',
              parentId: 'parent-1',
              replyId: 'reply-1',
              name: 'Bob',
              text: 'Nice post',
              createdAt: '2026-08-28T12:00:00.000Z',
              readAt: null,
            },
          ],
          unreadCount: 1,
        }),
      });
    });
    await page.goto('/notifications');
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
    await expect(page.getByText('Bob replied')).toBeVisible();
    await shotScreen(page, 'screen-notifications');
  });

  test('notifications empty', async ({ page }) => {
    await seedAda(page);
    await page.route('**/forum/notifications', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ notifications: [], unreadCount: 0 }),
      });
    });
    await page.goto('/notifications');
    await expect(page.getByText('No notifications yet.')).toBeVisible();
    await shotScreen(page, 'state-notifications-empty');
  });

  test('notifications loading', async ({ page }) => {
    await seedAda(page);
    await page.route('**/forum/notifications', async () => {
      /* hang */
    });
    await page.goto('/notifications');
    await expect(page.locator('p.text-center', { hasText: 'Loading…' })).toBeVisible();
    await shotScreen(page, 'state-notifications-loading');
  });

  test('notifications error', async ({ page }) => {
    await seedAda(page);
    await page.route('**/forum/notifications', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unavailable' }),
      });
    });
    await page.goto('/notifications');
    await expect(page.getByText('Could not load notifications. Please try again.')).toBeVisible();
    await shotScreen(page, 'state-notifications-error');
  });

  test('notifications moderator-proposal', async ({ page }) => {
    await seedAda(page);
    await page.route('**/forum/notifications', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          notifications: [
            {
              id: 'n-proposal',
              type: 'moderator_proposal',
              parentId: 'acc-rose',
              replyId: 'acc-rose',
              name: 'Bob',
              text: 'Rose',
              createdAt: '2026-08-28T12:00:00.000Z',
              readAt: null,
            },
          ],
          unreadCount: 1,
        }),
      });
    });
    await page.goto('/notifications');
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
    await expect(page.getByText('Bob proposed a moderator')).toBeVisible();
    await shotScreen(page, 'state-notifications-moderator-proposal');
  });
});

test.describe('moderate screens', () => {
  // Goldens are regenerated on the build host.
  const PAYOUT_GOAL_STATS = (() => {
    const counts: Record<string, number> = {
      '2026-08-24': 36,
      '2026-09-19': 12,
      '2026-09-20': 9,
    };
    const start = Date.parse('2026-08-22T00:00:00.000Z');
    const spendOverTime = Array.from({ length: 30 }, (_, i) => {
      const day = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      const giftCount = counts[day] ?? 0;
      return {
        day,
        giftCount,
        sats: 0,
        cumulativeSats: 0,
        btc: '0.00000000',
        cumulativeBtc: '0.00000000',
        usd: '0.00',
        cumulativeUsd: '0.00',
        chf: '0.00',
        eur: '0.00',
        php: '0.00',
        cumulativeChf: '0.00',
        cumulativeEur: '0.00',
        cumulativePhp: '0.00',
      };
    });
    return {
      totalSats: 0,
      totalBtc: '0.00000000',
      totalUsd: '0.00',
      totalChf: '0.00',
      totalEur: '0.00',
      totalPhp: '0.00',
      giftCount: 57,
      recipientCount: 0,
      firstPaidAt: '2026-08-22T00:00:00.000Z',
      lastPaidAt: '2026-09-20T00:00:00.000Z',
      spendOverTime,
      byRecipient: [],
      byMonth: [],
      fx: FX_USD,
    };
  })();

  async function stubPayoutGoal(page: Page): Promise<void> {
    await page.clock.install({ time: new Date('2026-09-20T12:00:00.000Z') });
    await page.route('**/gifts/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PAYOUT_GOAL_STATS),
      });
    });
  }

  async function seedAda(
    page: Page,
    role: 'basis' | 'moderator' | 'founder' = 'basis',
  ): Promise<void> {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          role,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
        }),
      });
    });
  }

  const HIDDEN = {
    id: 'h1',
    name: 'Bob',
    text: 'Hidden note',
    createdAt: '2026-08-28T12:00:00.000Z',
    sats: 0,
    hasPhoto: false,
    hasVideo: false,
    videoContentType: null,
    parentId: null,
    deletedAt: '2026-08-29T15:00:00.000Z',
    deletedBy: { id: 'acc_mod', name: 'Ada', role: 'moderator' },
  };

  test('screen /moderate', async ({ page }) => {
    await seedAda(page, 'founder');
    await stubPayoutGoal(page);
    await page.goto('/moderate');
    await expect(page.getByRole('heading', { name: 'Moderation' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Hidden notes' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open proposals' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open applications' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Moderators chat group' })).toBeVisible();
    await expect(page.getByText('12%')).toBeVisible();
    await shotScreen(page, 'screen-moderate');
  });

  test('moderate group-unread', async ({ page }) => {
    await seedAda(page, 'founder');
    await stubPayoutGoal(page);
    await page.route('**/conversations/moderator-group', async (route) => {
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
    await page.goto('/moderate');
    await expect(page.getByRole('link', { name: 'Moderators chat group, 1 unread' })).toBeVisible();
    await expect(page.getByText('12%')).toBeVisible();
    await shotScreen(page, 'state-moderate-group-unread');
  });

  test('moderate proposals-unread', async ({ page }) => {
    await seedAda(page, 'founder');
    await stubPayoutGoal(page);
    await page.route('**/trust/proposals', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          proposals: [
            {
              subject: { id: 'acc_rose', name: 'Rose', role: 'verified' },
              proposedBy: { id: 'acc_bob', name: 'Bob' },
              createdAt: '2026-08-28T12:00:00.000Z',
            },
          ],
        }),
      });
    });
    await page.goto('/moderate');
    await expect(page.getByRole('link', { name: 'Open proposals, 1 unread' })).toBeVisible();
    await shotScreen(page, 'state-moderate-proposals-unread');
  });

  test('moderate forbidden', async ({ page }) => {
    await seedAda(page, 'basis');
    await page.goto('/moderate');
    await expect(page.getByText('This page is for moderators.')).toBeVisible();
    await shotScreen(page, 'state-moderate-forbidden');
  });

  test('moderate goal-open', async ({ page }) => {
    await seedAda(page, 'founder');
    await stubPayoutGoal(page);
    await page.goto('/moderate');
    await expect(page.getByText('12%')).toBeVisible();
    await page.getByRole('button', { name: /Goal/ }).click();
    await expect(page.getByText('Official payouts by UTC day')).toBeVisible();
    await shotScreen(page, 'state-moderate-goal-open');
  });

  test('moderate loading', async ({ page }) => {
    await seedAda(page, 'founder');
    await page.route('**/gifts/stats', () => new Promise(() => undefined));
    await page.goto('/moderate');
    await expect(
      page.getByRole('group', { name: 'Daily payout goal' }).getByText('Loading…'),
    ).toBeVisible();
    await shotScreen(page, 'state-moderate-loading');
  });

  test('moderate error', async ({ page }) => {
    await seedAda(page, 'founder');
    await page.route('**/gifts/stats', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unavailable' }),
      });
    });
    await page.goto('/moderate');
    await expect(page.getByText('Could not load payouts. Please try again.')).toBeVisible();
    await shotScreen(page, 'state-moderate-error');
  });
});

test.describe('moderate hidden screens', () => {
  // Goldens are regenerated on the build host.
  async function seedAda(
    page: Page,
    role: 'basis' | 'moderator' | 'founder' = 'basis',
  ): Promise<void> {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          role,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
        }),
      });
    });
  }

  const HIDDEN = {
    id: 'h1',
    name: 'Bob',
    text: 'Hidden note',
    createdAt: '2026-08-28T12:00:00.000Z',
    sats: 0,
    hasPhoto: false,
    hasVideo: false,
    videoContentType: null,
    parentId: null,
    deletedAt: '2026-08-29T15:00:00.000Z',
    deletedBy: { id: 'acc_mod', name: 'Ada', role: 'moderator' },
  };

  test('screen /moderate/hidden', async ({ page }) => {
    await seedAda(page, 'founder');
    await page.route('**/forum/messages/hidden', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [HIDDEN] }),
      });
    });
    await page.goto('/moderate/hidden');
    await expect(page.getByText('Hidden note', { exact: true })).toBeVisible();
    await expect(page.getByText('Hidden by Ada')).toBeVisible();
    await shotScreen(page, 'screen-moderate-hidden');
  });

  test('state /moderate/hidden external', async ({ page }) => {
    await seedAda(page, 'founder');
    await page.route('**/forum/messages/hidden', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: 'h2',
              name: 'Robin',
              text: 'Hidden external note',
              via: 'nostr',
              createdAt: '2026-08-28T12:00:00.000Z',
              sats: 0,
              hasPhoto: false,
              hasVideo: false,
              videoContentType: null,
              parentId: null,
              deletedAt: '2026-08-29T15:00:00.000Z',
              deletedBy: { id: 'acc_mod', name: 'Ada', role: 'moderator' },
            },
          ],
        }),
      });
    });
    await page.goto('/moderate/hidden');
    await expect(page.getByText('Hidden external note', { exact: true })).toBeVisible();
    await expect(page.getByText('External', { exact: true }).first()).toBeVisible();
    await shotScreen(page, 'state-moderate-hidden-external');
  });

  test('moderate hidden forbidden', async ({ page }) => {
    await seedAda(page, 'basis');
    await page.goto('/moderate/hidden');
    await expect(page.getByText('This page is for moderators.')).toBeVisible();
    await shotScreen(page, 'state-moderate-hidden-forbidden');
  });

  test('moderate hidden empty', async ({ page }) => {
    await seedAda(page, 'founder');
    await page.route('**/forum/messages/hidden', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [] }),
      });
    });
    await page.goto('/moderate/hidden');
    await expect(page.getByText('No hidden notes.')).toBeVisible();
    await shotScreen(page, 'state-moderate-hidden-empty');
  });

  test('moderate hidden loading', async ({ page }) => {
    await seedAda(page, 'founder');
    await page.route('**/forum/messages/hidden', async () => {
      /* hang */
    });
    await page.goto('/moderate/hidden');
    await expect(page.locator('p.text-center', { hasText: 'Loading…' })).toBeVisible();
    await shotScreen(page, 'state-moderate-hidden-loading');
  });

  test('moderate hidden error', async ({ page }) => {
    await seedAda(page, 'founder');
    await page.route('**/forum/messages/hidden', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unavailable' }),
      });
    });
    await page.goto('/moderate/hidden');
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await shotScreen(page, 'state-moderate-hidden-error');
  });
});

test.describe('moderate proposals screens', () => {
  // Goldens are regenerated on the build host.
  async function seedAda(
    page: Page,
    role: 'basis' | 'moderator' | 'founder' = 'basis',
  ): Promise<void> {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          role,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
        }),
      });
    });
  }

  const PROPOSAL = {
    subject: { id: 'acc_rose', name: 'Rose', role: 'verified' as const },
    proposedBy: { id: 'acc_bob', name: 'Bob' },
    createdAt: '2026-08-28T12:00:00.000Z',
  };

  async function stubProposals(
    page: Page,
    proposals: Array<typeof PROPOSAL> | 'hang' = [],
  ): Promise<void> {
    if (proposals === 'hang') {
      await page.route('**/trust/proposals', async () => {
        /* hang */
      });
      return;
    }
    await page.route('**/trust/proposals', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ proposals }),
      });
    });
  }

  test('screen /moderate/proposals', async ({ page }) => {
    await seedAda(page, 'founder');
    await stubProposals(page, [PROPOSAL]);
    await page.goto('/moderate/proposals');
    await expect(page.getByRole('heading', { name: 'Open proposals' })).toBeVisible();
    await expect(page.getByText('Rose')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm as moderator' })).toBeVisible();
    await shotScreen(page, 'screen-moderate-proposals');
  });

  test('moderate proposals forbidden', async ({ page }) => {
    await seedAda(page, 'basis');
    await stubProposals(page);
    await page.goto('/moderate/proposals');
    await expect(page.getByRole('heading', { name: 'Open proposals' })).toBeVisible();
    await expect(page.getByText('This page is for moderators.')).toBeVisible();
    await shotScreen(page, 'state-moderate-proposals-forbidden');
  });

  test('moderate proposals empty', async ({ page }) => {
    await seedAda(page, 'founder');
    await stubProposals(page);
    await page.goto('/moderate/proposals');
    await expect(page.getByText('No open proposals.')).toBeVisible();
    await shotScreen(page, 'state-moderate-proposals-empty');
  });

  test('moderate proposals loading', async ({ page }) => {
    await seedAda(page, 'founder');
    await stubProposals(page, 'hang');
    await page.goto('/moderate/proposals');
    await expect(page.locator('p.text-center', { hasText: 'Loading…' }).first()).toBeVisible();
    await shotScreen(page, 'state-moderate-proposals-loading');
  });

  test('moderate proposals error', async ({ page }) => {
    await seedAda(page, 'founder');
    await page.route('**/trust/proposals', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unavailable' }),
      });
    });
    await page.goto('/moderate/proposals');
    await expect(page.getByText('Could not load open proposals. Please try again.')).toBeVisible();
    await shotScreen(page, 'state-moderate-proposals-error');
  });

  test('moderate proposals waiting-confirm', async ({ page }) => {
    await seedAda(page, 'founder');
    await stubProposals(page, [{ ...PROPOSAL, proposedBy: { id: E2E_ACCOUNT.id, name: 'Ada' } }]);
    await page.goto('/moderate/proposals');
    await expect(page.getByText('Waiting for another moderator to confirm.')).toBeVisible();
    await shotScreen(page, 'state-moderate-proposals-waiting-confirm');
  });

  test('moderate proposals confirm-error', async ({ page }) => {
    await seedAda(page, 'founder');
    await stubProposals(page, [PROPOSAL]);
    await page.route('**/trust/confirm-moderator', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unavailable' }),
      });
    });
    await page.goto('/moderate/proposals');
    await page.getByRole('button', { name: 'Confirm as moderator' }).click();
    await expect(page.getByText('Could not update this member. Please try again.')).toBeVisible();
    await shotScreen(page, 'state-moderate-proposals-confirm-error');
  });

  test('moderate proposals reject-error', async ({ page }) => {
    await seedAda(page, 'founder');
    await stubProposals(page, [PROPOSAL]);
    await page.route('**/trust/reject-moderator', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unavailable' }),
      });
    });
    await page.goto('/moderate/proposals');
    await page.getByRole('button', { name: 'Reject' }).click();
    await expect(page.getByText('Could not update this member. Please try again.')).toBeVisible();
    await shotScreen(page, 'state-moderate-proposals-reject-error');
  });

  test('moderate proposals reject-error-self', async ({ page }) => {
    await seedAda(page, 'founder');
    await stubProposals(page, [{ ...PROPOSAL, proposedBy: { id: E2E_ACCOUNT.id, name: 'Ada' } }]);
    await page.route('**/trust/reject-moderator', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unavailable' }),
      });
    });
    await page.goto('/moderate/proposals');
    await expect(page.getByRole('button', { name: 'Confirm as moderator' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Reject' }).click();
    await expect(page.getByText('Could not update this member. Please try again.')).toBeVisible();
    await shotScreen(page, 'state-moderate-proposals-reject-error-self');
  });

  test('moderate proposals confirming', async ({ page }) => {
    await seedAda(page, 'founder');
    await stubProposals(page, [PROPOSAL]);
    await page.route('**/trust/confirm-moderator', async () => {
      /* hang */
    });
    await page.goto('/moderate/proposals');
    await page.getByRole('button', { name: 'Confirm as moderator' }).click();
    await expect(page.getByRole('button', { name: 'Confirm as moderator' })).toBeDisabled();
    await shotScreen(page, 'state-moderate-proposals-confirming');
  });

  test('moderate proposals rejecting', async ({ page }) => {
    await seedAda(page, 'founder');
    await stubProposals(page, [PROPOSAL]);
    await page.route('**/trust/reject-moderator', async () => {
      /* hang */
    });
    await page.goto('/moderate/proposals');
    await page.getByRole('button', { name: 'Reject' }).click();
    await expect(page.getByRole('button', { name: 'Reject' })).toBeDisabled();
    await shotScreen(page, 'state-moderate-proposals-rejecting');
  });

  test('moderate proposals rejecting-self', async ({ page }) => {
    await seedAda(page, 'founder');
    await stubProposals(page, [{ ...PROPOSAL, proposedBy: { id: E2E_ACCOUNT.id, name: 'Ada' } }]);
    await page.route('**/trust/reject-moderator', async () => {
      /* hang */
    });
    await page.goto('/moderate/proposals');
    await expect(page.getByRole('button', { name: 'Confirm as moderator' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Reject' }).click();
    await expect(page.getByRole('button', { name: 'Reject' })).toBeDisabled();
    await shotScreen(page, 'state-moderate-proposals-rejecting-self');
  });
});

test.describe('moderate applications screens', () => {
  // Goldens are regenerated on the build host.
  async function seedAda(
    page: Page,
    role: 'basis' | 'moderator' | 'founder' = 'basis',
  ): Promise<void> {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          role,
          name: 'Ada',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
        }),
      });
    });
  }

  const APPLICATION = {
    accountId: 'acc_rose',
    name: 'Rose',
    role: 'verified' as const,
    appliedAt: Date.parse('2026-08-28T12:00:00.000Z'),
  };

  const DETAIL = {
    account: {
      id: 'acc_rose',
      name: 'Rose',
      role: 'verified' as const,
      lightningAddress: 'rose@walletofsatoshi.com',
    },
    grant: {
      status: 'pending' as const,
      appliedAt: APPLICATION.appliedAt,
      trialUtcDate: null,
      admittedAt: null,
      decidedAt: null,
    },
    messages: [
      {
        id: 'msg_1',
        name: 'Rose',
        text: 'Living-room note.',
        createdAt: '2026-08-28T12:00:00.000Z',
        sats: 0,
        payable: false,
        hasPhoto: false,
        role: 'verified',
        replyCount: 0,
      },
    ],
  };

  async function stubApplications(
    page: Page,
    applications: Array<typeof APPLICATION> | 'hang' = [],
  ): Promise<void> {
    if (applications === 'hang') {
      await page.route('**/funding/applications', async () => {
        /* hang */
      });
      return;
    }
    await page.route('**/funding/applications', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      const url = route.request().url();
      if (/\/funding\/applications\/[^/]+$/.test(new URL(url).pathname)) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ applications }),
      });
    });
  }

  test('screen /moderate/applications', async ({ page }) => {
    await seedAda(page, 'founder');
    await stubApplications(page, [APPLICATION]);
    await page.goto('/moderate/applications');
    await expect(page.getByRole('heading', { name: 'Open applications' })).toBeVisible();
    await expect(page.getByText('Rose')).toBeVisible();
    await shotScreen(page, 'screen-moderate-applications');
  });

  test('moderate applications forbidden', async ({ page }) => {
    await seedAda(page, 'basis');
    await stubApplications(page);
    await page.goto('/moderate/applications');
    await expect(page.getByRole('heading', { name: 'Open applications' })).toBeVisible();
    await expect(page.getByText('This page is for moderators.')).toBeVisible();
    await shotScreen(page, 'state-moderate-applications-forbidden');
  });

  test('moderate applications empty', async ({ page }) => {
    await seedAda(page, 'founder');
    await stubApplications(page);
    await page.goto('/moderate/applications');
    await expect(page.getByText('No open applications.')).toBeVisible();
    await shotScreen(page, 'state-moderate-applications-empty');
  });

  test('moderate applications loading', async ({ page }) => {
    await seedAda(page, 'founder');
    await stubApplications(page, 'hang');
    await page.goto('/moderate/applications');
    await expect(page.locator('p.text-center', { hasText: 'Loading…' }).first()).toBeVisible();
    await shotScreen(page, 'state-moderate-applications-loading');
  });

  test('moderate applications error', async ({ page }) => {
    await seedAda(page, 'founder');
    await page.route('**/funding/applications', async (route) => {
      if (/\/funding\/applications\/[^/]+$/.test(new URL(route.request().url()).pathname)) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unavailable' }),
      });
    });
    await page.goto('/moderate/applications');
    await expect(
      page.getByText('Could not load open applications. Please try again.'),
    ).toBeVisible();
    await shotScreen(page, 'state-moderate-applications-error');
  });

  test('screen /moderate/applications/[accountId]', async ({ page }) => {
    await seedAda(page, 'founder');
    await page.route('**/funding/applications/acc_rose', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(DETAIL),
      });
    });
    await page.goto('/moderate/applications/acc_rose');
    await expect(page.getByRole('heading', { name: 'Grant application' })).toBeVisible();
    await expect(page.getByText('Living-room note.')).toBeVisible();
    await expect(page.getByText('Please check whether the posts match principle 1.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Requirement met' })).toBeVisible();
    await shotScreen(page, 'screen-moderate-applications-accountId');
  });

  test('moderate applications accountId principle-2', async ({ page }) => {
    await seedAda(page, 'founder');
    await page.route('**/funding/applications/acc_rose', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(DETAIL),
      });
    });
    await page.goto('/moderate/applications/acc_rose');
    await page.getByRole('button', { name: 'Requirement met' }).click();
    await expect(page.getByText('Please check whether the posts match principle 2.')).toBeVisible();
    await shotScreen(page, 'state-moderate-applications-accountId-principle-2');
  });

  test('moderate applications accountId principle-3', async ({ page }) => {
    await seedAda(page, 'founder');
    await page.route('**/funding/applications/acc_rose', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(DETAIL),
      });
    });
    await page.goto('/moderate/applications/acc_rose');
    await page.getByRole('button', { name: 'Requirement met' }).click();
    await page.getByRole('button', { name: 'Requirement met' }).click();
    await expect(page.getByText('Please check whether the posts match principle 3.')).toBeVisible();
    await shotScreen(page, 'state-moderate-applications-accountId-principle-3');
  });

  test('moderate applications accountId truth', async ({ page }) => {
    await seedAda(page, 'founder');
    await page.route('**/funding/applications/acc_rose', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(DETAIL),
      });
    });
    await page.goto('/moderate/applications/acc_rose');
    await page.getByRole('button', { name: 'Requirement met' }).click();
    await page.getByRole('button', { name: 'Requirement met' }).click();
    await page.getByRole('button', { name: 'Requirement met' }).click();
    await expect(
      page.getByText('Do these posts, to your knowledge, correspond to the truth?'),
    ).toBeVisible();
    await shotScreen(page, 'state-moderate-applications-accountId-truth');
  });

  test('moderate applications accountId forbidden', async ({ page }) => {
    await seedAda(page, 'basis');
    await page.goto('/moderate/applications/acc_rose');
    await expect(page.getByRole('heading', { name: 'Grant application' })).toBeVisible();
    await expect(page.getByText('This page is for moderators.')).toBeVisible();
    await shotScreen(page, 'state-moderate-applications-accountId-forbidden');
  });

  test('moderate applications accountId empty', async ({ page }) => {
    await seedAda(page, 'founder');
    await page.route('**/funding/applications/acc_rose', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...DETAIL, messages: [] }),
      });
    });
    await page.goto('/moderate/applications/acc_rose');
    await expect(page.getByText('No living-room posts.')).toBeVisible();
    await shotScreen(page, 'state-moderate-applications-accountId-empty');
  });

  test('moderate applications accountId loading', async ({ page }) => {
    await seedAda(page, 'founder');
    await page.route('**/funding/applications/acc_rose', async () => {
      /* hang */
    });
    await page.goto('/moderate/applications/acc_rose');
    await expect(page.locator('p.text-center', { hasText: 'Loading…' }).first()).toBeVisible();
    await shotScreen(page, 'state-moderate-applications-accountId-loading');
  });

  test('moderate applications accountId error', async ({ page }) => {
    await seedAda(page, 'founder');
    await page.route('**/funding/applications/acc_rose', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unavailable' }),
      });
    });
    await page.goto('/moderate/applications/acc_rose');
    await expect(
      page.getByText('Could not load this application. Please try again.'),
    ).toBeVisible();
    await shotScreen(page, 'state-moderate-applications-accountId-error');
  });

  test('moderate applications accountId decide-failed', async ({ page }) => {
    await seedAda(page, 'founder');
    await page.route('**/funding/applications/acc_rose', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(DETAIL),
      });
    });
    await page.route('**/funding/reject', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unavailable' }),
      });
    });
    await page.goto('/moderate/applications/acc_rose');
    await page.getByRole('button', { name: 'Requirement not met' }).click();
    await expect(page.getByText('Could not update this member. Please try again.')).toBeVisible();
    await shotScreen(page, 'state-moderate-applications-accountId-decide-failed');
  });

  test('moderate applications accountId deciding', async ({ page }) => {
    await seedAda(page, 'founder');
    await page.route('**/funding/applications/acc_rose', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(DETAIL),
      });
    });
    await page.route('**/funding/reject', async () => {
      /* hang */
    });
    await page.goto('/moderate/applications/acc_rose');
    await page.getByRole('button', { name: 'Requirement not met' }).click();
    await expect(page.getByRole('button', { name: 'Requirement not met' })).toBeDisabled();
    await shotScreen(page, 'state-moderate-applications-accountId-deciding');
  });
});

test.describe('moderate group screens', () => {
  // Goldens are regenerated on the build host.
  async function seedAda(
    page: Page,
    role: 'basis' | 'moderator' | 'founder' = 'basis',
  ): Promise<void> {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          role,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
        }),
      });
    });
  }

  const GROUP = {
    id: 'conv-mod',
    kind: 'moderator_group',
    name: 'Moderators',
    lastText: 'Hello mods',
    lastAt: '2026-08-28T15:00:00.000Z',
    lastFromMe: false,
    lastSats: 0,
  };

  async function mockGroup(page: Page): Promise<void> {
    await page.route('**/conversations/moderator-group', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ conversation: GROUP }),
      });
    });
  }

  async function mockThread(
    page: Page,
    messages: Array<{
      id: string;
      name: string;
      text: string;
      createdAt: string;
      fromMe: boolean;
      sats: number;
      giftFor?: string;
      hasPhoto?: boolean;
      photoCount?: number;
    }>,
  ): Promise<void> {
    await page.route(/\/conversations\/conv-mod(?:\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages }),
      });
    });
  }

  const TINY_GIF = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64',
  );

  async function attachGif(page: Page): Promise<void> {
    await page.locator('input[type="file"]').setInputFiles({
      name: 'tiny.gif',
      mimeType: 'image/gif',
      buffer: TINY_GIF,
    });
  }

  async function hangCreateImageBitmap(page: Page): Promise<void> {
    await page.addInitScript(() => {
      window.createImageBitmap = () => new Promise(() => undefined);
    });
  }

  async function stubTooLargeJpeg(page: Page): Promise<void> {
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.toDataURL = function toDataURL() {
        return `data:image/jpeg;base64,${'A'.repeat(1_500_000)}`;
      };
    });
  }

  test('screen /moderate/group', async ({ page }) => {
    await seedAda(page, 'moderator');
    await mockGroup(page);
    await mockThread(page, [
      {
        id: 'm1',
        name: 'Ada',
        text: 'Hello mods',
        createdAt: '2026-08-28T15:00:00.000Z',
        fromMe: false,
        sats: 0,
      },
    ]);
    await page.goto('/moderate/group');
    await expect(page.getByText('Hello mods')).toBeVisible();
    await shotScreen(page, 'screen-moderate-group');
  });

  test('moderate group stipend', async ({ page }) => {
    await seedAda(page, 'moderator');
    await mockGroup(page);
    await mockThread(page, [
      {
        id: 'm1',
        name: 'Rose Otero',
        text: 'Great work today, moderators!',
        createdAt: '2026-08-28T15:00:00.000Z',
        fromMe: false,
        sats: 0,
      },
      {
        id: 'g1',
        name: '21.gifts',
        text: '21gifts moderator · Rose Otero',
        createdAt: '2026-08-28T15:01:00.000Z',
        fromMe: false,
        sats: 6158,
        giftFor: 'm1',
      },
    ]);
    await page.route('**/gifts/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalSats: 6158,
          totalBtc: '0.00006158',
          totalUsd: '5.00',
          totalChf: '4.00',
          totalEur: '4.50',
          totalPhp: '280.00',
          giftCount: 1,
          recipientCount: 1,
          firstPaidAt: '2026-08-28T15:01:00.000Z',
          lastPaidAt: '2026-08-28T15:01:00.000Z',
          spendOverTime: [
            {
              day: '2026-08-28',
              sats: 6158,
              cumulativeSats: 6158,
              btc: '0.00006158',
              cumulativeBtc: '0.00006158',
              usd: '5.00',
              cumulativeUsd: '5.00',
              chf: '4.00',
              eur: '4.50',
              php: '280.00',
              cumulativeChf: '4.00',
              cumulativeEur: '4.50',
              cumulativePhp: '280.00',
            },
          ],
          byRecipient: [],
          byMonth: [],
          fx: {
            quote: 'BTC-USD',
            dayBasis: 'utc',
            source: 'coinbase-exchange-daily-close',
            quotes: [{ code: 'USD', pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' }],
          },
        }),
      });
    });
    await page.goto('/moderate/group');
    await expect(page.getByText('Great work today, moderators!')).toBeVisible();
    await expect(page.getByRole('note', { name: /21\.gifts/ })).toContainText('$5.00');
    await shotScreen(page, 'state-moderate-group-stipend');
  });

  test('moderate group forbidden', async ({ page }) => {
    await seedAda(page, 'basis');
    await page.goto('/moderate/group');
    await expect(page.getByText('This room is for moderators.')).toBeVisible();
    await shotScreen(page, 'state-moderate-group-forbidden');
  });

  test('moderate group empty', async ({ page }) => {
    await seedAda(page, 'moderator');
    await mockGroup(page);
    await mockThread(page, []);
    await page.goto('/moderate/group');
    await expect(page.getByLabel('Your message')).toBeVisible();
    await shotScreen(page, 'state-moderate-group-empty');
  });

  test('moderate group loading', async ({ page }) => {
    await seedAda(page, 'moderator');
    await page.route('**/conversations/moderator-group', async () => {
      /* hang */
    });
    await page.goto('/moderate/group');
    await expect(page.locator('p.text-center', { hasText: 'Loading…' })).toBeVisible();
    await shotScreen(page, 'state-moderate-group-loading');
  });

  test('moderate group error', async ({ page }) => {
    await seedAda(page, 'moderator');
    await page.route('**/conversations/moderator-group', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unavailable' }),
      });
    });
    await page.goto('/moderate/group');
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await shotScreen(page, 'state-moderate-group-error');
  });

  test('moderate group composer-photo', async ({ page }) => {
    await seedAda(page, 'moderator');
    await mockGroup(page);
    await mockThread(page, []);
    await page.goto('/moderate/group');
    await expect(page.getByLabel('Your message')).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.jpg');
    await expect(page.getByRole('button', { name: 'Remove photo' })).toBeVisible({
      timeout: 10_000,
    });
    await shotScreen(page, 'state-moderate-group-composer-photo');
  });

  test('moderate group composer-photos', async ({ page }) => {
    await seedAda(page, 'moderator');
    await mockGroup(page);
    await mockThread(page, []);
    await page.goto('/moderate/group');
    await expect(page.getByLabel('Your message')).toBeVisible();
    await page
      .locator('input[type="file"]')
      .setInputFiles(['e2e/fixtures/tiny.jpg', 'e2e/fixtures/tiny.jpg']);
    await expect(page.getByAltText('Selected photo')).toHaveCount(2, { timeout: 10_000 });
    await shotScreen(page, 'state-moderate-group-composer-photos');
  });

  test('moderate group quoted-note', async ({ page }) => {
    await seedAda(page, 'moderator');
    await mockGroup(page);
    await mockThread(page, [
      {
        id: 'm1',
        name: 'Ada',
        text: `see ${QUOTED_NOTE_URL}`,
        createdAt: '2026-08-28T15:00:00.000Z',
        fromMe: false,
        sats: 0,
      },
    ]);
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
    await page.goto('/moderate/group');
    await expect(page.getByText('A Quick Technical Note')).toBeVisible();
    await expect(page.getByText(QUOTED_NOTE_URL)).toHaveCount(0);
    await shotScreen(page, 'state-moderate-group-quoted-note');
  });

  test('moderate group photo', async ({ page }) => {
    await seedAda(page, 'moderator');
    await mockGroup(page);
    await mockThread(page, [
      {
        id: 'm-photo',
        name: 'Ada',
        text: '',
        createdAt: '2026-08-28T15:00:00.000Z',
        fromMe: false,
        sats: 0,
        hasPhoto: true,
        photoCount: 1,
      },
    ]);
    await page.route('**/conversations/conv-mod/messages/m-photo/photo', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/jpeg',
        body: fs.readFileSync(path.join(process.cwd(), 'e2e/fixtures/tiny.jpg')),
      });
    });
    await page.goto('/moderate/group');
    await expect(page.getByAltText('Photo from Ada')).toBeVisible();
    await shotScreen(page, 'state-moderate-group-photo');
  });

  test('moderate group preparing-photo', async ({ page }) => {
    await seedAda(page, 'moderator');
    await mockGroup(page);
    await mockThread(page, []);
    await hangCreateImageBitmap(page);
    await page.goto('/moderate/group');
    await expect(page.getByLabel('Your message')).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.jpg');
    await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled();
    await expect(page.getByAltText('Selected photo')).toHaveCount(0);
    await shotScreen(page, 'state-moderate-group-preparing-photo');
  });

  test('moderate group error-unsupported', async ({ page }) => {
    await seedAda(page, 'moderator');
    await mockGroup(page);
    await mockThread(page, []);
    await page.goto('/moderate/group');
    await expect(page.getByLabel('Your message')).toBeVisible();
    await attachGif(page);
    await expect(page.getByText('Use a JPEG, PNG, or WebP photo')).toBeVisible();
    await expect(page.getByAltText('Selected photo')).toHaveCount(0);
    await shotScreen(page, 'state-moderate-group-error-unsupported');
  });

  test('moderate group error-too-large', async ({ page }) => {
    await seedAda(page, 'moderator');
    await mockGroup(page);
    await mockThread(page, []);
    await stubTooLargeJpeg(page);
    await page.goto('/moderate/group');
    await expect(page.getByLabel('Your message')).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/tiny.jpg');
    await expect(page.getByText('Keep photos under 1 MB')).toBeVisible();
    await shotScreen(page, 'state-moderate-group-error-too-large');
  });

  test('moderate group error-too-many', async ({ page }) => {
    await seedAda(page, 'moderator');
    await mockGroup(page);
    await mockThread(page, []);
    await page.goto('/moderate/group');
    await expect(page.getByLabel('Your message')).toBeVisible();
    await page
      .locator('input[type="file"]')
      .setInputFiles(Array.from({ length: 11 }, () => 'e2e/fixtures/tiny.jpg'));
    await expect(page.getByText('You can add up to 10 photos')).toBeVisible({ timeout: 10_000 });
    await shotScreen(page, 'state-moderate-group-error-too-many');
  });
});

test.describe('moderate handbook screens', () => {
  // Goldens are regenerated on the build host.
  async function seedAda(
    page: Page,
    role: 'basis' | 'moderator' | 'founder' = 'basis',
  ): Promise<void> {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          role,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
        }),
      });
    });
  }

  test('screen /moderate/handbook', async ({ page }) => {
    await seedAda(page, 'founder');
    await page.goto('/moderate/handbook');
    await expect(page.getByRole('heading', { name: 'Handbook' })).toBeVisible();
    await shotScreen(page, 'screen-moderate-handbook');
  });

  test('moderate handbook forbidden', async ({ page }) => {
    await seedAda(page, 'basis');
    await page.goto('/moderate/handbook');
    await expect(page.getByText('This page is for moderators.')).toBeVisible();
    await shotScreen(page, 'state-moderate-handbook-forbidden');
  });
});

test.describe('trust-chain screens', () => {
  // Goldens are regenerated on the build host.
  async function seedAda(
    page: Page,
    role: 'basis' | 'moderator' | 'founder' = 'basis',
  ): Promise<void> {
    await page.addInitScript(() => {
      localStorage.setItem('21gifts.session', 'sess-e2e');
    });
    await page.route(/\/me$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          role,
          name: 'Ada',
          username: 'alice',
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
        }),
      });
    });
  }

  test('screen /trust-chain', async ({ page }) => {
    await seedAda(page);
    await page.route('**/trust/graph**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(TRUST_CHAIN_SEED),
      });
    });
    await page.goto('/trust-chain');
    await expect(page.getByRole('heading', { name: 'Trust Chain' })).toBeVisible();
    await expect(page.getByTestId('trust-node-f1')).toBeVisible();
    await shotScreen(page, 'screen-trust-chain');
  });

  test('state /trust-chain expanded', async ({ page }) => {
    await seedAda(page);
    await page.route('**/trust/graph**', async (route) => {
      const url = new URL(route.request().url());
      const around = url.searchParams.get('around');
      const body =
        around === 'm1'
          ? TRUST_CHAIN_AROUND_MODERATOR
          : around === 'f1'
            ? TRUST_CHAIN_AROUND_FOUNDER
            : TRUST_CHAIN_SEED;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });
    await page.goto('/trust-chain');
    await page.getByTestId('trust-node-f1').click();
    await expect(page.getByTestId('trust-node-m1')).toBeVisible();
    await page.getByTestId('trust-node-m1').click();
    await expect(page.getByTestId('trust-node-v1')).toBeVisible();
    await shotScreen(page, 'state-trust-chain-expanded');
  });

  test('trust-chain empty', async ({ page }) => {
    await seedAda(page);
    await page.route('**/trust/graph', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ nodes: [], edges: [] }),
      });
    });
    await page.goto('/trust-chain');
    await expect(page.getByText('No one is on the Trust Chain yet.')).toBeVisible();
    await shotScreen(page, 'state-trust-chain-empty');
  });

  test('trust-chain loading', async ({ page }) => {
    await seedAda(page);
    await page.route('**/trust/graph', () => new Promise(() => undefined));
    await page.goto('/trust-chain');
    await expect(page.getByRole('paragraph').filter({ hasText: 'Loading…' })).toBeVisible();
    await shotScreen(page, 'state-trust-chain-loading');
  });

  test('trust-chain error', async ({ page }) => {
    await seedAda(page);
    await page.route('**/trust/graph', async (route) => {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/trust-chain');
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await shotScreen(page, 'state-trust-chain-error');
  });

  test('trust-chain hop-error', async ({ page }) => {
    await seedAda(page);
    await page.route('**/trust/graph**', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('around')) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(TRUST_CHAIN_SEED),
      });
    });
    await page.goto('/trust-chain');
    await page.getByTestId('trust-node-f1').click();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.getByTestId('trust-node-f1')).toBeVisible();
    await shotScreen(page, 'state-trust-chain-hop-error');
  });
});

test.describe('stats variant baselines', () => {
  test('stats usd-scale', async ({ page }) => {
    await stubPostStats(page);
    await page.route('**/gifts/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(STATS_USD_SCALE),
      });
    });
    await page.goto('/stats');
    await page
      .getByRole('group', { name: 'Over time scale' })
      .getByRole('button', { name: 'USD' })
      .click();
    await page
      .getByRole('group', { name: 'By person bar scale' })
      .getByRole('button', { name: 'USD' })
      .click();
    await page
      .getByRole('group', { name: 'By month bar scale' })
      .getByRole('button', { name: 'USD' })
      .click();
    await expect(page.getByLabel('Spend over time in USD')).toBeVisible();
    await expect(page.getByLabel('Spend by person in USD')).toBeVisible();
    await expect(page.getByLabel('Spend by month in USD')).toBeVisible();
    await shotScreen(page, 'state-stats-usd-scale');
  });

  test('stats empty', async ({ page }) => {
    await stubPostStats(page, { postCount: 0, postsOverTime: [] });
    await page.route('**/gifts/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(STATS_EMPTY),
      });
    });
    await page.goto('/stats');
    await expect(page.getByText('No gifts recorded yet.')).toBeVisible();
    await shotScreen(page, 'state-stats-empty');
  });

  test('stats loading', async ({ page }) => {
    await page.route('**/gifts/stats', () => new Promise(() => undefined));
    await page.goto('/stats');
    await expect(page.getByText('Loading…')).toBeVisible();
    await shotScreen(page, 'state-stats-loading');
  });

  test('stats error', async ({ page }) => {
    await page.route('**/gifts/stats', async (route) => {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/stats');
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await shotScreen(page, 'state-stats-error');
  });

  test('stats day empty', async ({ page }) => {
    await page.goto('/stats/2026-06-02');
    await expect(page.getByText('No gifts recorded on this day.')).toBeVisible();
    await shotScreen(page, 'state-stats-day-empty');
  });

  test('stats day loading', async ({ page }) => {
    await page.route('**/gifts?day=*', () => new Promise(() => undefined));
    await page.goto('/stats/2026-06-01');
    await expect(page.getByText('Loading…')).toBeVisible();
    await shotScreen(page, 'state-stats-day-loading');
  });

  test('stats day error', async ({ page }) => {
    await page.route('**/gifts?day=*', async (route) => {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/stats/2026-06-01');
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await shotScreen(page, 'state-stats-day-error');
  });
});
