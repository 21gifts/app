import { expect, test, type Page } from '@playwright/test';
import { fulfillSpot } from './fx-spot';

/** Ada's account: signed in with a wallet-eligible account; `extra` overrides fields. */
async function signIn(page: Page, extra: Record<string, unknown> = {}): Promise<void> {
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
        hasPosted: true,
        createdAt: 1_700_000_000,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
        walletRequired: true,
        walletBackupSeenAt: 1,
        passkeyCredentialId: 'cred-seed',
        ...extra,
      }),
    });
  });
  await fulfillSpot(page);
}

/** Counts `POST /me/wallet-intro-seen` calls (answered with the seen account). */
async function countIntroSeen(page: Page): Promise<() => number> {
  let calls = 0;
  await page.route(/\/me\/wallet-intro-seen$/, async (route) => {
    calls += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  return () => calls;
}

test('Function: HeaderBalance — the ready balance sits left of Menu with its fiat and opens /wallet client-side', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/welcome?visual=balance-ready');
  const balance = page.getByRole('link', { name: "Balance ₿21'000 $21.00" });
  await expect(balance).toBeVisible();
  const box = await balance.boundingBox();
  const menu = await page.getByRole('button', { name: 'Menu' }).boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(menu!.x + 1);
  expect(box!.height).toBeGreaterThanOrEqual(36);
  await page.evaluate(() => {
    (window as unknown as { __sameDocument: boolean }).__sameDocument = true;
  });
  await balance.click();
  await expect(page).toHaveURL(/\/wallet$/);
  expect(
    await page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument),
  ).toBe(true);
});

test('Function: HeaderBalance — nothing in the header while the wallet opens or is not available', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/welcome?visual=balance-connecting');
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  await expect(page.locator('[data-wallet-tour="balance"]')).toHaveCount(0);
  await page.goto('/welcome');
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  await expect(page.locator('[data-wallet-tour="balance"]')).toHaveCount(0);
});

test('Function: ReceivedNotice — a payment that arrived shows the banner and the green header amount; X closes it', async ({
  page,
}) => {
  await signIn(page);
  // The pinned payment is held like a real one: keep time still while it is checked.
  const now = Date.now();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now + 1_000);
  await page.goto('/wallet?visual=wallet-received');
  const banner = page.getByRole('status').filter({ hasText: 'You received ₿500' });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('$0.50');
  await expect(banner).not.toContainText('from');
  await expect(page.locator('[data-wallet-tour="balance"]')).toContainText('+₿500 · $0.50');
  await banner.getByRole('button', { name: 'Close' }).click();
  await expect(banner).toHaveCount(0);
});

test('Function: useIncomingPayment — the pinned payment is held for its time, and its text opens /wallet', async ({
  page,
}) => {
  await signIn(page);
  const now = Date.now();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now + 1_000);
  await page.goto('/welcome?visual=wallet-received');
  const banner = page.getByRole('status').filter({ hasText: 'You received ₿500' });
  const bump = page.locator('[data-wallet-tour="balance"]');
  await expect(banner).toBeVisible();
  await expect(bump).toContainText('+₿500');
  await page.clock.runFor(2_500);
  await expect(bump).not.toContainText('+₿500');
  await expect(banner).toBeVisible();
  await page.clock.runFor(3_600);
  await expect(banner).toHaveCount(0);
  await page.goto('/welcome?visual=wallet-received');
  await banner.getByRole('link').click();
  await expect(page).toHaveURL(/\/wallet$/);
  await expect(page.getByText('You received ₿500')).toHaveCount(0);
});

test('Function: onIncomingPayment — without a wallet key nothing is announced', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/wallet');
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByText(/You received/)).toHaveCount(0);
});

test('Function: WalletTour — four steps in place, Got it ends it and saves it once', async ({
  page,
}) => {
  await signIn(page, { walletIntroSeen: false });
  const calls = await countIntroSeen(page);
  await page.goto('/welcome?visual=balance-ready');
  const card = page.getByRole('dialog', { name: '21.gifts is now your wallet' });
  await expect(card).toContainText('1 of 4');
  await expect(card).toContainText('Your balance is always up here');
  await card.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('dialog', { name: 'Receive' })).toContainText('2 of 4');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('dialog', { name: 'Send' })).toContainText(
    'Sending to other members is free.',
  );
  await page.getByRole('button', { name: 'Next' }).click();
  const last = page.getByRole('dialog', { name: 'Everything else' });
  await expect(last).toContainText('4 of 4');
  await expect(last).not.toContainText(/recovery|phrase/i);
  await last.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(calls).toBe(1);
  await expect(page).toHaveURL(/\/welcome\?visual=balance-ready$/);
});

test('Function: markWalletIntroSeen — Skip saves it, and the tour stays gone even when the save fails', async ({
  page,
}) => {
  await signIn(page, { walletIntroSeen: false });
  let calls = 0;
  await page.route(/\/me\/wallet-intro-seen$/, async (route) => {
    calls += 1;
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/welcome?visual=balance-ready');
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => calls).toBe(1);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Function: WalletTour — no tour without the field, when seen, or without a balance step on a disabled wallet', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/welcome?visual=balance-ready');
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await expect(page.getByText('21.gifts is now your wallet')).toHaveCount(0);
  await page.unroute(/\/me$/);
  await signIn(page, { walletIntroSeen: false });
  await page.goto('/welcome');
  // No wallet here: only the Menu step is left.
  await expect(page.getByRole('dialog', { name: 'Everything else' })).toContainText('1 of 1');
});

test('Function: MoveFundsLink — /wallet?move=1 opens the move flow and drops the parameter', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/wallet?move=1&visual=balance-ready');
  const sheet = page.getByRole('dialog', { name: 'Bring your Bitcoin here' });
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(/\/wallet\?visual=balance-ready$/);
  await expect(sheet).toContainText('Step 1 of 4');
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toHaveCount(0);
});

test('Function: requestMoveFunds — a move link opened signed out opens the flow after signing in', async ({
  page,
}) => {
  await page.goto('/welcome?move=1');
  // The request waits in this tab until a member is signed in.
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('21gifts.moveFunds')))
    .toBe('link');
  await expect(page.getByRole('dialog', { name: 'Bring your Bitcoin here' })).toHaveCount(0);
  await signIn(page);
  await page.goto('/welcome');
  await expect(page.getByRole('dialog', { name: 'Bring your Bitcoin here' })).toBeVisible();
});

test('Function: MoveFundsSheet — steps, the top-left arrow steps back, copy, and no other wallet app', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signIn(page);
  await page.goto('/wallet?move=1&visual=balance-ready');
  await page.getByRole('button', { name: 'Start' }).click();
  const sheet = page.getByRole('dialog', { name: 'Send to your 21.gifts address' });
  await expect(sheet).toContainText('ada@');
  await expect(sheet).toContainText('Step 2 of 4');
  await expect(sheet.locator('a[href^="lightning:"]')).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Copy my address' }).click();
  await expect(sheet.getByRole('button', { name: 'Copied' })).toBeVisible();
  await sheet.getByRole('button', { name: 'I sent it' }).click();
  const waiting = page.getByRole('dialog', { name: 'Waiting for your Bitcoin…' });
  await expect(waiting).toContainText('This screen updates by itself.');
  await expect(waiting.getByRole('button', { name: /back/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('dialog', { name: 'Send to your 21.gifts address' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('dialog', { name: 'Bring your Bitcoin here' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/wallet\?visual=balance-ready$/);
});

test('Function: MoveFundsBack — the top-left arrow steps the open flow back and closes it on the first step', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/wallet?move=1&visual=balance-ready');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('dialog', { name: 'Send to your 21.gifts address' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('dialog', { name: 'Bring your Bitcoin here' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/wallet\?visual=balance-ready$/);
});

test('Function: SignedInChrome — the Menu is out of reach, also by keyboard, behind the open move-funds sheet', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/wallet?move=1&visual=balance-ready');
  await expect(page.getByRole('dialog', { name: 'Bring your Bitcoin here' })).toBeVisible();
  const menu = page.locator('#signed-in-menu-button');
  const reachable = (): Promise<boolean> =>
    menu.evaluate((element) => {
      (element as HTMLElement).focus();
      return document.activeElement === element;
    });
  expect(await reachable()).toBe(false);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await reachable()).toBe(true);
});

test('Function: MoveFundsSheet — the arrived step shows the amount and the balance with fiat; Done closes', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/wallet?visual=move-arrived');
  const done = page.getByRole('dialog', { name: '₿500 arrived' });
  await expect(done).toContainText('$0.50');
  await expect(done).toContainText("Your wallet now holds ₿21'000 · $21.00.");
  await done.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Function: useCopied — Receive shows the move offer only with hadExternalWallet, and its Copy says Copied', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signIn(page, { hadExternalWallet: true, sparkWalletVerified: true });
  await page.goto('/wallet?visual=balance-ready');
  await page.getByRole('button', { name: 'Receive' }).click();
  await page.getByRole('button', { name: 'Copy' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
  await page.getByRole('button', { name: 'Move Bitcoin from another wallet' }).click();
  await expect(page.getByRole('dialog', { name: 'Bring your Bitcoin here' })).toBeVisible();
});

test('Function: WalletReceive — Receive hides the move offer without hadExternalWallet', async ({
  page,
}) => {
  await signIn(page, { sparkWalletVerified: true });
  await page.goto('/wallet?visual=balance-ready');
  await page.getByRole('button', { name: 'Receive' }).click();
  await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Move Bitcoin from another wallet' })).toHaveCount(
    0,
  );
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

/** Captures the events the page sends to `POST /me/events`. */
async function captureEvents(
  page: Page,
): Promise<() => Promise<{ name: string; props: Record<string, unknown> }[]>> {
  const sent: { name: string; props: Record<string, unknown> }[] = [];
  await page.route(/\/me\/events$/, async (route) => {
    const body = route.request().postDataJSON() as {
      events: { name: string; props: Record<string, unknown> }[];
    };
    sent.push(...body.events);
    await route.fulfill({ status: 204, body: '' });
  });
  return async () => {
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    return sent.filter((event) => event.name.startsWith('wallet_'));
  };
}

test('Function: logInteraction — the wallet tour reports start, each step, and how it ended', async ({
  page,
}) => {
  await signIn(page, { walletIntroSeen: false });
  await countIntroSeen(page);
  const events = await captureEvents(page);
  await page.goto('/welcome?visual=balance-ready');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect
    .poll(async () => (await events()).map((event) => [event.name, event.props]))
    .toEqual([
      ['wallet_tour_shown', { steps: 4 }],
      ['wallet_tour_step', { step: 1, target: 'balance' }],
      ['wallet_tour_step', { step: 2, target: 'receive' }],
      ['wallet_tour_done', { outcome: 'skipped', step: 2 }],
    ]);
});

test('Function: logInteraction — the move flow reports how it opened, its steps, and where it was closed', async ({
  page,
}) => {
  await signIn(page);
  const events = await captureEvents(page);
  await page.goto('/wallet?move=1&visual=balance-ready');
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByRole('button', { name: 'I sent it' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect
    .poll(async () => (await events()).map((event) => [event.name, event.props]))
    .toEqual([
      ['wallet_move_opened', { source: 'link' }],
      ['wallet_move_step', { step: 'go' }],
      ['wallet_move_step', { step: 'waiting' }],
      ['wallet_move_closed', { step: 'waiting' }],
    ]);
});

test('Function: takeMoveFundsRequest — a move request opens the flow once; a reload does not open it again', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/wallet?move=1&visual=balance-ready');
  await expect(page.getByRole('dialog', { name: 'Bring your Bitcoin here' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('21gifts.moveFunds')))
    .toBeNull();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Bring your Bitcoin here' })).toHaveCount(0);
});
