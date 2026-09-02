import { expect, test, type Page } from '@playwright/test';

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
  lightningAddress: null as string | null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: null as number | null,
  viewKey: 'a'.repeat(64),
  setup: 'name' as 'name' | 'lightning-address' | 'rules' | null,
  missing: ['name', 'lightning-address', 'rules'] as Array<'name' | 'lightning-address' | 'rules'>,
};

const SHOT = { animations: 'disabled' as const, caret: 'hide' as const };

const STATS_DEFAULT = {
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

const STATS_USD_SCALE = {
  totalSats: 1_100_000,
  totalBtc: '0.01100000',
  totalUsd: '950.00',
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
    },
    {
      day: '2026-07-01',
      sats: 100_000,
      cumulativeSats: 1_100_000,
      btc: '0.00100000',
      cumulativeBtc: '0.01100000',
      usd: '900.00',
      cumulativeUsd: '950.00',
    },
  ],
  byRecipient: [
    { recipient: 'alice', giftCount: 1, sats: 1_000_000, btc: '0.01000000', usd: '50.00' },
    { recipient: 'bob', giftCount: 1, sats: 100_000, btc: '0.00100000', usd: '900.00' },
  ],
  byMonth: [
    { month: '2026-06', giftCount: 1, sats: 1_000_000, btc: '0.01000000', usd: '50.00' },
    { month: '2026-07', giftCount: 1, sats: 100_000, btc: '0.00100000', usd: '900.00' },
  ],
  fx: {
    quote: 'BTC-USD',
    dayBasis: 'utc',
    source: 'coinbase-exchange-daily-close',
  },
};

const STATS_EMPTY = {
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
    // The handbook viewport embeds other screen PNGs; variant shots shift a few percent.
    maxDiffPixelRatio: arg === 'screen-handbook' ? 0.05 : 0,
    ...SHOT,
  });
}

const RULES_SETUP_ACCOUNT = {
  ...E2E_ACCOUNT,
  name: 'Ada',
  lightningAddress: 'alice@walletofsatoshi.com',
  rulesAgreedAt: null,
  viewKey: 'a'.repeat(64),
  setup: 'rules' as const,
  missing: ['rules'] as Array<'name' | 'lightning-address' | 'rules'>,
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
  await page.route(/\/messages$/, async (route) => {
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

test.describe('screen baselines', () => {
  test('screen /', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Direct human-to-human gifts/i })).toBeVisible();
    await shotScreen(page, 'screen-root');
  });

  test('state / mobile-nav', async ({ page }, testInfo) => {
    test.skip(!isMobileProject(testInfo), 'hamburger nav is md:hidden on desktop');
    await page.goto('/');
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByLabel('Primary').getByRole('link', { name: 'Handbook' })).toBeVisible();
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

  test('screen /stats', async ({ page }) => {
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

  test('screen /404', async ({ page }) => {
    await page.goto('/404');
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await shotScreen(page, 'screen-404');
  });

  test('screen /handbook', async ({ page }) => {
    await page.goto('/handbook');
    await expect(page.getByRole('heading', { name: 'Handbook' }).first()).toBeVisible();
    // Viewport only: a full-page shot would nest the other screen PNGs inside this one.
    await shotScreen(page, 'screen-handbook', false);
  });

  test('state /handbook copied', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/handbook');
    const button = page.getByRole('button', { name: 'Copy link to Handbook' });
    await button.click();
    await expect(button).toHaveAttribute('data-copied', 'true');
    await button.scrollIntoViewIfNeeded();
    await shotScreen(page, 'state-handbook-copied', false);
  });

  test('screen /handbook/screens', async ({ page }) => {
    await page.goto('/handbook/screens');
    await expect(page.getByRole('heading', { name: 'Screens' }).first()).toBeVisible();
    await shotScreen(page, 'screen-handbook-screens', false);
  });

  test('state /handbook/screens mobile', async ({ page }) => {
    await page.goto('/handbook/screens');
    await page.getByRole('button', { name: 'Mobile' }).click();
    await shotScreen(page, 'state-handbook-screens-mobile', false);
  });

  test('state /handbook/screens dark', async ({ page }) => {
    await page.goto('/handbook/screens');
    await page.getByRole('button', { name: 'Dark' }).click();
    await shotScreen(page, 'state-handbook-screens-dark', false);
  });

  test('screen /handbook/functions', async ({ page }) => {
    await page.goto('/handbook/functions');
    await expect(page.getByRole('heading', { name: 'Functions' }).first()).toBeVisible();
    await shotScreen(page, 'screen-handbook-functions', false);
  });

  test('state /handbook/functions mobile', async ({ page }) => {
    await page.goto('/handbook/functions');
    await page.getByRole('button', { name: 'Mobile' }).click();
    await shotScreen(page, 'state-handbook-functions-mobile', false);
  });

  test('state /handbook/functions dark', async ({ page }) => {
    await page.goto('/handbook/functions');
    await page.getByRole('button', { name: 'Dark' }).click();
    await shotScreen(page, 'state-handbook-functions-dark', false);
  });

  test('screen /handbook/endpoints', async ({ page }) => {
    await page.goto('/handbook/endpoints');
    await expect(page.getByRole('heading', { name: 'Endpoints' }).first()).toBeVisible();
    await shotScreen(page, 'screen-handbook-endpoints', false);
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

  test('login theme-open', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Theme').click();
    await expect(page.getByRole('option', { name: 'Dark' })).toBeVisible();
    await shotScreen(page, 'state-login-theme');
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
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
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
    await expect(page.getByRole('button', { name: 'Active' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: 'Send Bitcoin' }).first()).toBeVisible();
    await shotScreen(page, 'screen-welcome');
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
        body: JSON.stringify({ messages: [] }),
      });
    });
    await page.goto('/welcome');
    await page.getByText('Thank you both — that helps.').click();
    await expect(page.getByPlaceholder('Write a reply')).toBeVisible();
    await shotScreen(page, 'state-welcome-expanded');
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
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
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

  test('state /welcome pm', async ({ page }) => {
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
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
        }),
      });
    });
    await fulfillMixedSatsMessages(page);
    await page.goto('/welcome');
    await expect(
      page.getByRole('button', { name: 'Send a private message' }).first(),
    ).toBeVisible();
    await shotScreen(page, 'state-welcome-pm');
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
          lightningAddress: 'alice@walletofsatoshi.com',
          rulesAgreedAt: 1_700_000_001,
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
        }),
      });
    });
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await shotScreen(page, 'screen-profile');
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
          role: 'verified',
          lightningAddress: 'carol@walletofsatoshi.com',
          createdAt: '2026-01-15T12:00:00.000Z',
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
        }),
      });
    });
    await page.goto(`/members/${memberId}`);
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(page.getByText('Hello from my profile note.')).toBeVisible();
    await shotScreen(page, 'screen-members');
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
          role: 'verified',
          lightningAddress: 'carol@walletofsatoshi.com',
          createdAt: '2026-01-15T12:00:00.000Z',
          profileMessage: null,
        }),
      });
    });
    await page.goto(`/members/${memberId}`);
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(page.getByText('carol@walletofsatoshi.com')).toBeVisible();
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
          role: 'basis',
          lightningAddress: 'alice@walletofsatoshi.com',
          createdAt: '2026-01-15T12:00:00.000Z',
          profileMessage: null,
        }),
      });
    });
    await page.goto(`/members/${ownId}`);
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(page.getByText('Ada')).toBeVisible();
    await shotScreen(page, 'state-members-own');
  });

  test('screen /messages/[id] default', async ({ page }) => {
    const id = '11111111-1111-4111-8111-111111111111';
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

  test('state /messages/[id] missing', async ({ page }) => {
    await page.goto('/messages/not-a-uuid');
    await expect(page.getByText('This profile could not be found.')).toBeVisible();
    await shotScreen(page, 'state-messages-id-missing');
  });

  test('state /messages/[id] loading', async ({ page }) => {
    const id = '11111111-1111-4111-8111-111111111111';
    await page.route(`**/public-messages/${id}`, async () => {
      /* hang */
    });
    await page.goto(`/messages/${id}`);
    await expect(page.getByText('Loading…')).toBeVisible();
    await shotScreen(page, 'state-messages-id-loading');
  });

  test('state /messages/[id] error', async ({ page }) => {
    const id = '11111111-1111-4111-8111-111111111111';
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

  test('screen /view/[viewKey] default', async ({ page }) => {
    await page.route(new RegExp(`/view-key/${E2E_ACCOUNT.viewKey}$`), async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: 'Ada',
          lightningAddress: 'alice@walletofsatoshi.com',
          lightningAddressVerified: false,
          createdAt: 1,
          hasPasskey: false,
        }),
      });
    });
    await page.route('**/gifts/stats**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(STATS_DEFAULT),
      });
    });
    await page.goto(`/view/${E2E_ACCOUNT.viewKey}`);
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(page.getByText('Ada')).toBeVisible();
    await expect(page.getByText('Action required, the account must be activated')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Activate' })).toBeVisible();
    await shotScreen(page, 'screen-view-viewKey');
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
          lightningAddress: 'alice@walletofsatoshi.com',
          lightningAddressVerified: false,
          createdAt: 1,
          hasPasskey: true,
        }),
      });
    });
    await page.route('**/gifts/stats**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(STATS_DEFAULT),
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
          lightningAddress: 'alice@walletofsatoshi.com',
          lightningAddressVerified: false,
          createdAt: 1,
          hasPasskey: false,
        }),
      });
    });
    await page.route('**/gifts/stats**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(STATS_DEFAULT),
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
  totalSats: 1500,
  totalBtc: '0.00001500',
  totalUsd: '1.43',
  giftCount: 2,
  recipientCount: 1,
  firstPaidAt: '2026-06-01T00:00:00.000Z',
  lastPaidAt: '2026-06-03T00:00:00.000Z',
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
      day: '2026-06-03',
      sats: 1000,
      cumulativeSats: 1500,
      btc: '0.00001000',
      cumulativeBtc: '0.00001500',
      usd: '0.95',
      cumulativeUsd: '1.43',
    },
  ],
  byRecipient: [{ recipient: 'alice', giftCount: 2, sats: 1500, btc: '0.00001500', usd: '1.43' }],
  byMonth: [],
  fx: {
    quote: 'BTC-USD',
    dayBasis: 'utc',
    source: 'coinbase-exchange-daily-close',
  },
};

const PROFILE_SINGLE_DAY_STATS = {
  totalSats: 21,
  totalBtc: '0.00000021',
  totalUsd: '0.02',
  giftCount: 1,
  recipientCount: 1,
  firstPaidAt: '2026-06-01T00:00:00.000Z',
  lastPaidAt: '2026-06-01T00:00:00.000Z',
  spendOverTime: [
    {
      day: '2026-06-01',
      sats: 21,
      cumulativeSats: 21,
      btc: '0.00000021',
      cumulativeBtc: '0.00000021',
      usd: '0.02',
      cumulativeUsd: '0.02',
    },
  ],
  byRecipient: [{ recipient: 'alice', giftCount: 1, sats: 21, btc: '0.00000021', usd: '0.02' }],
  byMonth: [],
  fx: {
    quote: 'BTC-USD',
    dayBasis: 'utc',
    source: 'coinbase-exchange-daily-close',
  },
};

const PROFILE_LARGE_USD_STATS = {
  totalSats: 1_500_000,
  totalBtc: '0.01500000',
  totalUsd: '1425.00',
  giftCount: 2,
  recipientCount: 1,
  firstPaidAt: '2026-06-01T00:00:00.000Z',
  lastPaidAt: '2026-06-02T00:00:00.000Z',
  spendOverTime: [
    {
      day: '2026-06-01',
      sats: 500_000,
      cumulativeSats: 500_000,
      btc: '0.00500000',
      cumulativeBtc: '0.00500000',
      usd: '475.00',
      cumulativeUsd: '475.00',
    },
    {
      day: '2026-06-02',
      sats: 1_000_000,
      cumulativeSats: 1_500_000,
      btc: '0.01000000',
      cumulativeBtc: '0.01500000',
      usd: '950.00',
      cumulativeUsd: '1425.00',
    },
  ],
  byRecipient: [
    { recipient: 'alice', giftCount: 2, sats: 1_500_000, btc: '0.01500000', usd: '1425.00' },
  ],
  byMonth: [],
  fx: {
    quote: 'BTC-USD',
    dayBasis: 'utc',
    source: 'coinbase-exchange-daily-close',
  },
};

test.describe('profile activity chart variants', () => {
  async function seedAdaProfile(page: Page): Promise<void> {
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
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
        }),
      });
    });
  }

  async function stubProfileStats(page: Page, body: unknown): Promise<void> {
    await page.route(/\/gifts\/stats(?:\?|$)/, async (route) => {
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
    await expect(page.getByText('$1,425')).toBeVisible();
    await shotScreen(page, 'state-profile-large-usd');
  });
});

test.describe('welcome forum variants', () => {
  async function seedAda(page: Page): Promise<void> {
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
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
        }),
      });
    });
  }

  async function stubPayInvoice(page: Page): Promise<void> {
    await page.route(/\/messages$/, async (route) => {
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
    await page.route('**/messages/m-pay/invoice', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ pr: 'lnbc21n1exampleinvoice', amountSats: 21 }),
      });
    });
  }

  async function openPaySheet(page: Page): Promise<void> {
    await page.goto('/welcome');
    await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
    await page.getByRole('button', { name: 'All' }).click();
    await page.getByRole('button', { name: 'Send Bitcoin' }).click();
    await page.getByLabel('Amount').fill('21');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('link', { name: 'Pay with Wallet of Satoshi' })).toBeVisible();
  }

  test('welcome all', async ({ page }) => {
    await seedAda(page);
    await fulfillMixedSatsMessages(page);
    await page.goto('/welcome');
    await page.getByRole('button', { name: 'All' }).click();
    await expect(page.getByText('Does anyone have spare sats this week?')).toBeVisible();
    await shotScreen(page, 'state-welcome-all');
  });

  test('welcome popular', async ({ page }) => {
    await seedAda(page);
    await fulfillMixedSatsMessages(page);
    await page.goto('/welcome');
    await page.getByRole('button', { name: 'Most popular' }).click();
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
    await page.route(/\/messages$/, async (route) => {
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
    await expect(page.getByRole('button', { name: 'Active' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByText('Does anyone have spare sats this week?')).not.toBeVisible();
    await shotScreen(page, 'state-welcome-empty-paid');
  });

  test('welcome empty', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/messages$/, async (route) => {
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
    await page.route(/\/messages$/, async (route) => {
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
    await page.route(/\/messages$/, async (route) => {
      await route.abort();
    });
    await page.goto('/welcome');
    await expect(page.getByText('Could not load messages. Please try again.')).toBeVisible();
    await shotScreen(page, 'state-welcome-error');
  });

  test('welcome validation-error', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/messages$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [] }),
      });
    });
    await page.goto('/welcome');
    await expect(page.getByText('No messages yet — be the first to write one.')).toBeVisible();
    await page.getByRole('button', { name: 'Post' }).click();
    await expect(page.getByText('Enter a message or add a photo or video')).toBeVisible();
    await shotScreen(page, 'state-welcome-validation-error');
  });

  test('welcome photo', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/messages$/, async (route) => {
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
    await page.getByRole('button', { name: 'All' }).click();
    await expect(page.getByAltText('Photo from Ada')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add a photo or video' })).toBeVisible();
    await shotScreen(page, 'state-welcome-photo');
  });

  test('welcome photo-and-text', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/messages$/, async (route) => {
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
    await page.getByRole('button', { name: 'Post' }).click();
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

  async function emptyForum(page: Page): Promise<void> {
    await page.route(/\/messages$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [] }),
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
    await expect(page.getByRole('button', { name: 'Post' })).toBeDisabled();
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
    await expect(page.getByRole('button', { name: 'Post' })).toBeDisabled();
    await expect(page.getByAltText('Selected photo')).toHaveCount(0);
    await shotScreen(page, 'state-welcome-preparing-photo-and-text');
  });

  test('welcome posting-photo-and-text', async ({ page }) => {
    await seedAda(page);
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/messages$/, async (route) => {
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
    await page.getByRole('button', { name: 'Post' }).click();
    await expect(page.getByRole('button', { name: 'Post' })).toBeDisabled();
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
    await page.route(/\/messages$/, async (route) => {
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
    await page.getByRole('button', { name: 'All' }).click();
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

  test('welcome error-request-photo-and-text', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/messages$/, async (route) => {
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
    await page.getByRole('button', { name: 'Post' }).click();
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

  test('welcome menu-language-open', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/messages$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [] }),
      });
    });
    await page.goto('/welcome');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByLabel('Language').click();
    await expect(page.getByRole('option', { name: 'Deutsch' })).toBeVisible();
    await shotScreen(page, 'state-welcome-menu-language');
  });

  test('welcome menu-theme-open', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/messages$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [] }),
      });
    });
    await page.goto('/welcome');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByLabel('Theme').click();
    await expect(page.getByRole('option', { name: 'Dark' })).toBeVisible();
    await shotScreen(page, 'state-welcome-menu-theme');
  });

  test('welcome pay-qr', async ({ page }, testInfo) => {
    test.skip(isMobileProject(testInfo), 'payment QR is desktop-only');
    await seedAda(page);
    await stubPayInvoice(page);
    await openPaySheet(page);
    await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toBeVisible();
    await shotScreen(page, 'state-welcome-pay-qr');
  });

  test('welcome pay-smartphone', async ({ page }, testInfo) => {
    test.skip(!isMobileProject(testInfo), 'smartphone pay sheet is mobile-only');
    await seedAda(page);
    await stubPayInvoice(page);
    await openPaySheet(page);
    await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Pay with Wallet of Satoshi' })).toBeVisible();
    await shotScreen(page, 'state-welcome-pay-smartphone');
  });

  test('welcome pay-author-wallet', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/messages$/, async (route) => {
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
    await page.route('**/messages/m-pay/invoice', async (route) => {
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
    await page.getByRole('button', { name: 'All' }).click();
    await page.getByRole('button', { name: 'Send Bitcoin' }).click();
    await page.getByLabel('Amount').fill('21');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(
      page.getByText("The author's wallet cannot receive this Bitcoin payment"),
    ).toBeVisible();
    await expect(page.getByRole('img', { name: 'Bitcoin payment QR code' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Pay with Wallet of Satoshi' })).toHaveCount(0);
    await shotScreen(page, 'state-welcome-pay-author-wallet');
  });

  test('welcome role-hint', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/messages$/, async (route) => {
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
    await page.getByRole('button', { name: 'All' }).click();
    await page.getByRole('button', { name: 'Verified' }).click();
    await expect(
      page.getByText('A moderator has met this person in real life and confirmed they are real.'),
    ).toBeVisible();
    await shotScreen(page, 'state-welcome-role-hint');
  });
});

test.describe('contact screens', () => {
  async function seedAda(page: Page): Promise<void> {
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
          viewKey: 'a'.repeat(64),
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
              name: '21.gifts',
              lastText: 'Hello team',
              lastAt: '2026-08-28T12:00:00.000Z',
            },
          ],
        }),
      });
    });
    await page.route(/\/conversations\/conv-21$/, async (route) => {
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
  async function seedAda(page: Page): Promise<void> {
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
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
        }),
      });
    });
  }

  test('screen /messages', async ({ page }) => {
    await seedAda(page);
    await page.route(/\/conversations$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversations: [
            {
              id: 'conv-21',
              name: '21.gifts',
              lastText: 'Hello team',
              lastAt: '2026-08-28T12:00:00.000Z',
            },
          ],
        }),
      });
    });
    await page.goto('/messages');
    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
    await shotScreen(page, 'screen-messages');
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
              name: '21.gifts',
              lastText: 'Hello team',
              lastAt: '2026-08-28T12:00:00.000Z',
            },
          ],
        }),
      });
    });
    await page.route(/\/conversations\/conv-21$/, async (route) => {
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
            },
          ],
        }),
      });
    });
    await page.goto('/messages?c=conv-21');
    await expect(page.getByText('Hello team')).toBeVisible();
    await shotScreen(page, 'state-messages-thread');
  });
});

test.describe('stats variant baselines', () => {
  test('stats usd-scale', async ({ page }) => {
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

test.describe('function baselines', () => {
  // ~140 Function: clips × 4 combo projects; 30s timed out, 120s is tight on mobile workers.
  test.describe.configure({ timeout: 180_000 });

  test('every handbook function section', async ({ page }) => {
    await page.goto('/handbook/functions');
    await expect(page.getByRole('heading', { name: 'Functions' }).first()).toBeVisible();
    await unstickStickyChrome(page);

    const headings = page.locator('#functions h2[id^="functions-function-"]');
    const count = await headings.count();
    expect(count).toBeGreaterThan(0);

    // One test walks every handbook function clip; count × comparison exceeds Playwright’s 30s default.
    // Desktop workers need more than count*500 (that floor hit 100s and closed the page).
    test.setTimeout(Math.max(180_000, count * 800));

    const sections = await headings.evaluateAll((nodes) =>
      nodes.map((node) => {
        const el = node as HTMLElement;
        const label = (el.textContent ?? '').trim();
        const match = /^Function: (.+)$/.exec(label);
        return { id: el.id, name: match?.[1] ?? '' };
      }),
    );
    expect(sections.every((s) => s.id !== '' && s.name !== '')).toBe(true);
    expect(new Set(sections.map((s) => s.name)).size).toBe(sections.length);

    for (const section of sections) {
      const heading = page.locator(`#${section.id}`);
      await heading.scrollIntoViewIfNeeded();
      const clip = await page.evaluate((id: string) => {
        const el = document.getElementById(id);
        if (el === null) {
          return null;
        }
        const wrap = el.parentElement;
        if (wrap === null) {
          return null;
        }
        const nodes: Element[] = [wrap];
        let next = wrap.nextElementSibling;
        while (next !== null) {
          if (next.querySelector('h2[id^="functions-function-"]') !== null) {
            break;
          }
          nodes.push(next);
          next = next.nextElementSibling;
        }
        const rects = nodes.map((node) => node.getBoundingClientRect());
        const left = Math.min(...rects.map((r) => r.left));
        const top = Math.min(...rects.map((r) => r.top));
        const right = Math.max(...rects.map((r) => r.right));
        const bottom = Math.max(...rects.map((r) => r.bottom));
        return {
          x: left + window.scrollX,
          y: top + window.scrollY,
          width: right - left,
          height: bottom - top,
        };
      }, section.id);
      expect(clip).not.toBeNull();
      await expect.soft(page).toHaveScreenshot(`function-${section.name}.png`, {
        clip: clip as { x: number; y: number; width: number; height: number },
        fullPage: true,
        // Function clips sit below handbook screen PNGs; those images changing
        // size reflows wrap in later sections by a couple of percent.
        maxDiffPixelRatio: 0.05,
        ...SHOT,
      });
    }
  });

  test('LightningAddressForm welcome after linked address', async ({ page }) => {
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
          viewKey: 'a'.repeat(64),
          setup: null,
          missing: [],
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
    await expect(page.getByRole('button', { name: 'Unlink' })).toHaveCount(0);
  });

  test('NotFound', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await expect(page).toHaveScreenshot('state-not-found.png', { fullPage: true, ...SHOT });
  });
});
