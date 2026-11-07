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

test('Function: HeaderBalance — a skeleton while the wallet opens, nothing after a failure that is not retried or without a wallet', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/welcome?visual=balance-connecting');
  const menu = page.getByRole('button', { name: 'Menu' });
  await expect(menu).toBeVisible();
  const skeleton = page.locator('[data-balance-skeleton]');
  await expect(skeleton).toBeVisible();
  await expect(skeleton).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('[data-wallet-tour="balance"]')).toHaveCount(0);
  const box = await skeleton.boundingBox();
  const menuBox = await menu.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(menuBox!.x + 1);
  expect(box!.height).toBeGreaterThanOrEqual(36);
  await page.goto('/welcome?visual=balance-error');
  await expect(menu).toBeVisible();
  await expect(skeleton).toHaveCount(0);
  await expect(page.locator('[data-wallet-tour="balance"]')).toHaveCount(0);
  await page.goto('/welcome');
  await expect(menu).toBeVisible();
  await expect(skeleton).toHaveCount(0);
  await expect(page.locator('[data-wallet-tour="balance"]')).toHaveCount(0);
});

test('Function: HeaderBalance — the amount replaces the skeleton without moving the header', async ({
  page,
}) => {
  await signIn(page);
  const now = Date.now();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now + 1_000);
  await page.goto('/welcome?visual=balance-reopening');
  const menu = page.getByRole('button', { name: 'Menu' });
  const skeleton = page.locator('[data-balance-skeleton]');
  await expect(skeleton).toBeVisible();
  const before = await skeleton.boundingBox();
  const menuBefore = await menu.boundingBox();
  const chromeBefore = await page.locator('[data-app-chrome]').boundingBox();
  await page.clock.runFor(4_000);
  const balance = page.getByRole('link', { name: "Balance ₿21'000 $21.00" });
  await expect(balance).toBeVisible();
  await expect(skeleton).toHaveCount(0);
  const after = await balance.boundingBox();
  // Same row, same height, same right edge: only the width follows the amount.
  expect(after!.y).toBe(before!.y);
  expect(after!.height).toBe(before!.height);
  expect(after!.x + after!.width).toBe(before!.x + before!.width);
  expect(await menu.boundingBox()).toEqual(menuBefore);
  expect(await page.locator('[data-app-chrome]').boundingBox()).toEqual(chromeBefore);
});

// Playwright builds have no wallet key, so no real wallet opens here. The
// `balance-reopening` pin stands in for a first open that failed and a
// background retry that succeeds; the retry cycle itself is unit-tested.
test('Function: useWallet — a wallet that failed to open becomes ready by itself, without a press', async ({
  page,
}) => {
  await signIn(page);
  const now = Date.now();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now + 1_000);
  await page.goto('/wallet?visual=balance-reopening');
  const region = page.getByRole('region', { name: 'Balance' });
  await expect(region.getByRole('alert')).toHaveText(
    'Your wallet could not be opened. Please try again.',
  );
  await expect(region.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.locator('[data-balance-skeleton]')).toBeVisible();
  await expect(page.locator('[data-wallet-tour="balance"]')).toHaveCount(0);
  await page.clock.runFor(3_900);
  await expect(region.getByRole('alert')).toBeVisible();
  await page.clock.runFor(200);
  await expect(region.getByRole('alert')).toHaveCount(0);
  await expect(region.getByRole('button', { name: 'Try again' })).toHaveCount(0);
  await expect(region).toContainText("₿21'000");
  await expect(region).toContainText('$21.00');
  await expect(page.getByRole('link', { name: "Balance ₿21'000 $21.00" })).toBeVisible();
  await expect(page.locator('[data-balance-skeleton]')).toHaveCount(0);
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
  await expect(banner).toContainText('₿500');
  await expect(banner).not.toContainText('from');
  await expect(page.locator('[data-wallet-tour="balance"]')).toContainText('+₿500');
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

test('Function: MoveFundsSheet — steps, the top-left arrow steps back, copy, and on a desktop no other wallet app', async ({
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
  // A desktop gets the QR and copy only.
  await expect(sheet.getByRole('button', { name: 'Open my other wallet' })).toHaveCount(0);
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

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/**
 * Makes the page a smartphone and keeps every `lightning:` href it sets in
 * `window.__walletHrefs` instead of leaving the page.
 */
async function phoneRecordingWalletHrefs(page: Page): Promise<void> {
  await page.addInitScript((userAgent) => {
    Object.defineProperty(Navigator.prototype, 'userAgent', {
      configurable: true,
      get: () => userAgent,
    });
    const hrefs: string[] = [];
    (window as unknown as { __walletHrefs: string[] }).__walletHrefs = hrefs;
    const loc = window.location;
    const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(loc), 'href')!;
    Object.defineProperty(loc, 'href', {
      configurable: true,
      enumerable: true,
      get() {
        return desc.get!.call(loc);
      },
      set(value: string) {
        if (String(value).startsWith('lightning:')) {
          hrefs.push(String(value));
          return;
        }
        desc.set!.call(loc, value);
      },
    });
  }, IPHONE_UA);
}

function walletHrefs(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __walletHrefs: string[] }).__walletHrefs);
}

test('Function: MoveFundsSheet — on a phone, Open my other wallet hands a lightning: invoice to the wallet app and waits', async ({
  page,
}) => {
  await phoneRecordingWalletHrefs(page);
  await signIn(page);
  await page.goto('/wallet?move=1&visual=move-invoice');
  await page.getByRole('button', { name: 'Start' }).click();
  const sheet = page.getByRole('dialog', { name: 'Send to your 21.gifts address' });
  await expect(sheet.getByRole('button', { name: 'Copy my address' })).toBeVisible();
  await expect(sheet.getByRole('img', { name: /QR/i })).toHaveCount(0);
  expect(await walletHrefs(page)).toEqual([]);
  await sheet.getByRole('button', { name: 'Open my other wallet' }).click();
  await expect(page.getByRole('dialog', { name: 'Waiting for your Bitcoin…' })).toBeVisible();
  expect(await walletHrefs(page)).toEqual(['lightning:lnbc1pmovefundsvisual']);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Send to your 21.gifts address' }).getByRole('button', {
      name: 'Open my other wallet',
    }),
  ).toBeEnabled();
});

test('Function: receiveWalletInvoice — a phone without an open wallet says the request failed, keeps Copy, and Try again asks again', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await phoneRecordingWalletHrefs(page);
  await signIn(page);
  const urls: string[] = [];
  page.on('request', (request) => {
    urls.push(request.url());
  });
  await page.goto('/wallet?move=1&visual=balance-ready');
  await page.getByRole('button', { name: 'Start' }).click();
  const sheet = page.getByRole('dialog', { name: 'Send to your 21.gifts address' });
  await sheet.getByRole('button', { name: 'Open my other wallet' }).click();
  await expect(sheet.getByRole('alert')).toHaveText(
    'Your 21.gifts wallet could not create a payment request. Try again, or copy your address.',
  );
  await expect(sheet.getByRole('button', { name: 'Open my other wallet' })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Copy my address' }).click();
  await expect(sheet.getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('ada@');
  await sheet.getByRole('button', { name: 'Try again' }).click();
  await expect(sheet.getByRole('alert')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'I sent it' })).toBeVisible();
  expect(await walletHrefs(page)).toEqual([]);
  expect(urls.some((url) => url.endsWith('.wasm'))).toBe(false);
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
  await menu.focus();
  await expect(menu).not.toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await menu.focus();
  await expect(menu).toBeFocused();
});

test('Function: SignedInChrome — the Menu trigger is a 44 px icon in the text colour with no visible word and the hover background on hover and while open', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/welcome?visual=balance-ready');
  const menu = page.getByRole('button', { name: 'Menu' });
  await expect(menu).toHaveText('');
  const box = (await menu.boundingBox())!;
  expect(box.width).toBe(44);
  expect(box.height).toBe(44);
  const icon = (await menu.locator('svg').boundingBox())!;
  expect(icon.width).toBe(24);
  expect(icon.height).toBe(24);
  const colours = await menu.evaluate((el) => {
    const probe = document.createElement('span');
    probe.className = 'text-app-fg';
    document.body.append(probe);
    const fg = getComputedStyle(probe).color;
    probe.remove();
    return { fg, trigger: getComputedStyle(el).color };
  });
  expect(colours.trigger).toBe(colours.fg);
  const background = (): Promise<string> =>
    menu.evaluate((el) => getComputedStyle(el).backgroundColor);
  const hover = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.className = 'bg-app-hover';
    document.body.append(probe);
    const colour = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return colour;
  });
  const closed = await background();
  expect(closed).not.toBe(hover);
  await menu.hover();
  await expect.poll(background).toBe(hover);
  await page.mouse.move(0, 0);
  await expect.poll(background).toBe(closed);
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await page.mouse.move(0, 0);
  await expect.poll(background).toBe(hover);
});

test('Function: MoveFundsSheet — the arrived step shows the amount and the balance with fiat; Done closes', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/wallet?visual=move-arrived');
  const done = page.getByRole('dialog', { name: '₿500 arrived' });
  await expect(done).toContainText('₿500');
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
