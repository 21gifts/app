import type { Page } from '@playwright/test';

/** Signed-in viewer roles the team-access specs use. */
export type TeamViewerRole = 'basis' | 'moderator' | 'initiator' | 'founder';

/**
 * Seeds a signed-in session and answers `GET /me` with Ada in `role`.
 *
 * @param page - Playwright page.
 * @param role - Viewer role.
 */
export async function seedTeamViewer(page: Page, role: TeamViewerRole): Promise<void> {
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
        name: 'Fia',
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
        funding:
          role === 'basis'
            ? null
            : {
                status: 'none',
                trialUtcDate: null,
                admittedAt: null,
                reviewedByName: null,
              },
      }),
    });
  });
}

/** Two matches for "ada". */
export const TEAM_MEMBERS = {
  members: [
    { id: 'acc_ada', name: 'Ada Lovelace', username: 'adalove' },
    { id: 'acc_adab', name: 'Ada Byron', username: 'adab' },
  ],
};

/** `GET /forum/members/acc_ada` for the member-data heading. */
export const TEAM_MEMBER_PROFILE = {
  id: 'acc_ada',
  name: 'Ada Lovelace',
  username: 'adalove',
  location: null,
  role: 'verified',
  lightningAddress: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  profileMessage: null,
  postCount: 0,
  replyCount: 0,
  aboutMe: null,
};

/** Wallet page of Ada for 30 days. */
export const TEAM_WALLET = {
  balance: { balanceSats: 21_000, syncedAt: '2026-09-30T09:15:00.000Z' },
  summary: {
    inSats: 30_000,
    outSats: 10_000,
    feeSats: 12,
    categories: [
      { category: 'member', inSats: 30_000, outSats: 4_000 },
      { category: 'shop', inSats: 0, outSats: 2_000 },
      { category: 'outside_lightning', inSats: 0, outSats: 3_000 },
      { category: 'unknown', inSats: 0, outSats: 1_000 },
    ],
  },
  payments: [
    {
      id: 'pay_1',
      direction: 'in',
      status: 'completed',
      amountSats: 30_000,
      feeSats: 0,
      timestamp: '2026-09-30T08:00:00.000Z',
      method: 'spark',
      category: 'member',
      counterpartyAccountId: 'acc_bob',
      counterpartyName: 'Bob',
      description: 'Thanks for the bread',
    },
    {
      id: 'pay_2',
      direction: 'out',
      status: 'pending',
      amountSats: 2_000,
      feeSats: 3,
      timestamp: '2026-09-29T16:30:00.000Z',
      method: 'lightning',
      category: 'shop',
      counterpartyAccountId: 'acc_shop',
      counterpartyName: 'Corner Café',
      lnurlComment: 'Table 4',
    },
    {
      id: 'pay_3',
      direction: 'out',
      status: 'failed',
      amountSats: 3_000,
      feeSats: null,
      timestamp: '2026-09-28T11:00:00.000Z',
      method: 'lightning',
      category: 'outside_lightning',
      destination: 'carol@example.com',
    },
    {
      id: 'pay_4',
      direction: 'out',
      status: 'completed',
      amountSats: 1_000,
      timestamp: '2026-09-27T10:00:00.000Z',
      method: 'spark',
      category: 'unknown',
    },
  ],
  nextCursor: null,
};

/** Wallet page after a period, direction, or category is chosen. */
export function teamWalletFor(url: URL): typeof TEAM_WALLET {
  const category = url.searchParams.get('category');
  const direction = url.searchParams.get('direction');
  const payments = TEAM_WALLET.payments.filter(
    (payment) =>
      (category === null || payment.category === category) &&
      (direction === null || payment.direction === direction),
  );
  if (url.searchParams.get('period') === '7') {
    return {
      ...TEAM_WALLET,
      summary: {
        inSats: 0,
        outSats: 2_000,
        feeSats: 3,
        categories: [{ category: 'shop', inSats: 0, outSats: 2_000 }],
      },
      payments: payments.filter((payment) => payment.category === 'shop'),
    };
  }
  return { ...TEAM_WALLET, payments };
}

/** Wallet page of a member whose wallet has not reported. */
export const TEAM_WALLET_EMPTY = {
  balance: null,
  summary: { inSats: 0, outSats: 0, feeSats: 0, categories: [] },
  payments: [],
  nextCursor: null,
};

/** Activity page of Ada. */
export const TEAM_EVENTS = {
  events: [
    {
      name: 'payment_sent',
      at: '2026-09-30T08:05:00.000Z',
      path: '/wallet',
      props: { amountSats: 2_000, paymentId: 'pay_2' },
    },
    { name: 'screen_view', at: '2026-09-30T08:00:00.000Z', path: '/shops', props: {} },
    { name: 'search', at: '2026-09-30T07:59:00.000Z', path: '/shops', props: { query: 'bread' } },
    { name: 'wallet_unlocked', at: '2026-09-30T07:58:00.000Z', path: '/wallet', props: {} },
  ],
  nextCursor: null,
};

/** Access log with three rows. */
export const TEAM_AUDIT = {
  entries: [
    {
      viewerAccountId: 'acc_mod',
      viewerName: 'Mo',
      memberAccountId: 'acc_ada',
      memberName: 'Ada Lovelace',
      what: 'wallet',
      at: '2026-09-30T10:00:00.000Z',
    },
    {
      viewerAccountId: 'acc_mod',
      viewerName: 'Mo',
      memberAccountId: 'acc_ada',
      memberName: 'Ada Lovelace',
      what: 'events',
      at: '2026-09-30T10:01:00.000Z',
    },
    {
      viewerAccountId: 'acc_fia',
      viewerName: 'Fia',
      memberAccountId: 'acc_bob',
      memberName: 'Bob',
      what: 'wallet',
      at: '2026-09-29T18:20:00.000Z',
    },
  ],
  nextCursor: null,
};

/**
 * Answers the member-data JSON paths for Ada with the fixtures above.
 *
 * @param page - Playwright page.
 * @param overrides - Optional status or body per path kind.
 */
export async function routeTeamMemberData(
  page: Page,
  overrides: { wallet?: 'hang' | number | object; events?: 'hang' | number | object } = {},
): Promise<void> {
  await page.route('**/forum/members/acc_ada', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TEAM_MEMBER_PROFILE),
    });
  });
  for (const kind of ['wallet', 'events'] as const) {
    await page.route(`**/team/members/acc_ada/${kind}*`, async (route) => {
      const override = overrides[kind];
      if (override === 'hang') {
        return new Promise(() => undefined);
      }
      if (typeof override === 'number') {
        await route.fulfill({ status: override, contentType: 'application/json', body: '{}' });
        return;
      }
      const body =
        override ??
        (kind === 'wallet' ? teamWalletFor(new URL(route.request().url())) : TEAM_EVENTS);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });
  }
}
