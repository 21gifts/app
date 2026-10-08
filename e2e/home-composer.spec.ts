import { expect, test, type Page } from '@playwright/test';
import { stubCamera } from './camera';

/** First living-room law, shown in the laws hint above the composer. */
const LAWS_1 = '21.gifts is a donation platform: gifts are free, and nobody pays for a promise.';

/** Signs in Ada (laws hint not dismissed) with an account that can hold the wallet. */
async function signInAda(page: Page): Promise<void> {
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
        username: 'ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
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
      }),
    });
  });
}

/** A short paid feed with no replies yet. */
async function feed(page: Page): Promise<void> {
  const messages = Array.from({ length: 3 }, (_, index) => ({
    id: `m${index + 1}`,
    name: 'Carol',
    text: `Note number ${index + 1} on the forum home.`,
    createdAt: `2026-08-28T1${index}:00:00.000Z`,
    sats: 21,
    payable: true,
    hasPhoto: false,
    role: 'verified',
    replyCount: 0,
  }));
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    // The inbox page itself (`/messages?c=…`) is a document, not the feed.
    if (route.request().resourceType() === 'document') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages }),
    });
  });
  await page.route(/\/replies(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
}

/**
 * A visual viewport the test drives: `__vvHeight` stands for the keyboard,
 * `__vvFire(type)` delivers a viewport event as the browser would.
 */
async function drivenViewport(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const listeners: Record<string, Array<() => void>> = { resize: [], scroll: [] };
    const state = window as unknown as {
      __vvHeight?: number;
      __vvFire?: (type: string) => void;
    };
    const viewport = {
      get height(): number {
        return state.__vvHeight ?? window.innerHeight;
      },
      offsetTop: 0,
      scale: 1,
      addEventListener(type: string, listener: () => void): void {
        listeners[type]?.push(listener);
      },
      removeEventListener(type: string, listener: () => void): void {
        listeners[type] = (listeners[type] ?? []).filter((entry) => entry !== listener);
      },
    };
    state.__vvFire = (type: string): void => {
      for (const listener of listeners[type] ?? []) listener();
    };
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      get() {
        return viewport;
      },
    });
  });
}

async function keyboard(page: Page, height: number | null): Promise<void> {
  await page.evaluate((next) => {
    const state = window as unknown as { __vvHeight?: number; __vvFire: (type: string) => void };
    if (next === null) delete state.__vvHeight;
    else state.__vvHeight = next;
    state.__vvFire('resize');
  }, height);
}

async function appHeight(page: Page): Promise<string> {
  return page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--app-height').trim(),
  );
}

/** What the forum home shows around the composer, for before/after comparisons. */
async function frame(page: Page): Promise<{ radius: string; pad: string; writing: string | null }> {
  return page.evaluate(() => {
    const main = document.querySelector('main')!;
    const shell = document.querySelector('[data-app-frame]')!;
    return {
      radius: getComputedStyle(shell).borderTopLeftRadius,
      pad: getComputedStyle(main).paddingTop,
      writing: main.getAttribute('data-writing'),
    };
  });
}

/** Waits until the settle scroll after the fold has put the composer just under the header row. */
async function settled(page: Page): Promise<void> {
  let last = Number.NaN;
  await expect
    .poll(async () => {
      const top = await page.evaluate(() => {
        const port = document.querySelector('[data-scrollport][data-scroll-active]')!;
        const form = document.querySelector('[data-writing-composer]')!;
        return form.getBoundingClientRect().top - port.getBoundingClientRect().top;
      });
      const still = top === last;
      last = top;
      return still && top <= 8;
    })
    .toBe(true);
}

async function openHome(page: Page): Promise<void> {
  await signInAda(page);
  await feed(page);
  await page.goto('/welcome?visual=balance-ready');
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await expect(page.getByText('Note number 1 on the forum home.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Receive' })).toBeVisible();
}

test.describe('forum home composer on a touch device', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } });

  test('Function: useComposerWriting — the text field sits on top, photo and place left and send right below it, at rest and while writing', async ({
    page,
  }) => {
    await openHome(page);
    const field = page.getByLabel('Your message');
    const boxes = async () => ({
      field: (await field.boundingBox())!,
      photo: (await page.getByRole('button', { name: 'Add a photo or video' }).boundingBox())!,
      place: (await page.getByRole('button', { name: 'Add a place' }).boundingBox())!,
      post: (await page.getByRole('button', { name: 'Post', exact: true }).boundingBox())!,
    });
    for (const writing of [false, true]) {
      if (writing) {
        await field.tap();
        await expect(page.locator('main')).toHaveAttribute('data-writing', 'on');
        await settled(page);
      }
      const box = await boxes();
      expect(box.photo.y).toBeGreaterThanOrEqual(box.field.y + box.field.height);
      expect(Math.abs(box.photo.y - box.post.y)).toBeLessThan(1);
      expect(Math.abs(box.place.y - box.post.y)).toBeLessThan(1);
      expect(box.photo.x).toBeLessThan(box.place.x);
      expect(box.place.x + box.place.width).toBeLessThan(box.post.x);
      // Send ends where the full-width field ends.
      expect(Math.abs(box.post.x + box.post.width - (box.field.x + box.field.width))).toBeLessThan(
        1,
      );
      expect(Math.abs(box.photo.x - box.field.x)).toBeLessThan(1);
    }
  });

  test('Function: useComposerWriting — focus folds the parts above, hides the feed and the footer; send keeps the focus; blur brings everything back', async ({
    page,
  }) => {
    await openHome(page);
    const atRest = await frame(page);
    expect(atRest).toEqual({ radius: '24px', pad: '8px', writing: 'ready' });
    const field = page.getByLabel('Your message');
    const restHeight = (await field.boundingBox())!.height;

    await field.tap();
    await expect(field).toBeFocused();
    await expect(page.locator('main')).toHaveAttribute('data-writing', 'on');
    await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeHidden();
    await expect(page.getByText(LAWS_1)).toBeHidden();
    await expect(page.getByRole('combobox', { name: 'Forum view' })).toBeHidden();
    await expect(page.getByRole('group', { name: 'Compose' })).toBeHidden();
    await expect(page.getByText('Note number 1 on the forum home.')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Receive' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeHidden();
    await expect(page.locator('[data-app-frame]')).toHaveCSS('border-top-left-radius', '0px');
    await expect(page.locator('main')).toHaveCSS('padding-top', '0px');
    await expect.poll(async () => (await field.boundingBox())!.height).toBeGreaterThan(100);
    expect(restHeight).toBeLessThan(100);
    // After the fold the composer sits just under the header row.
    await settled(page);

    // A tap on send (empty text) keeps the field focused: nothing moves under the finger.
    const post = page.getByRole('button', { name: 'Post', exact: true });
    const before = (await post.boundingBox())!;
    await post.tap();
    await expect(page.getByText('Enter a message or add a photo or video')).toBeVisible();
    await expect(field).toBeFocused();
    await expect(page.locator('main')).toHaveAttribute('data-writing', 'on');
    expect((await post.boundingBox())!.y).toBeCloseTo(before.y, 0);

    await field.blur();
    await expect(page.locator('main')).toHaveAttribute('data-writing', 'ready');
    await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
    await expect(page.getByText(LAWS_1)).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Forum view' })).toBeVisible();
    await expect(page.getByText('Note number 1 on the forum home.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Receive' })).toBeVisible();
    await expect(page.locator('[data-app-frame]')).toHaveCSS('border-top-left-radius', '24px');
    await expect.poll(() => frame(page)).toEqual(atRest);
  });

  test('Function: useComposerWriting — a reply field and the inbox composer change nothing', async ({
    page,
  }) => {
    await openHome(page);
    const atRest = await frame(page);
    await page.getByRole('button', { name: 'React' }).first().tap();
    const reply = page.getByPlaceholder('Write a reaction');
    await reply.tap();
    await expect(reply).toBeFocused();
    await page.waitForTimeout(400);
    expect(await frame(page)).toEqual(atRest);
    await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
    await expect(page.getByText(LAWS_1)).toBeVisible();
    await expect(page.getByText('Note number 2 on the forum home.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Receive' })).toBeVisible();

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
              id: 'i1',
              name: '21.gifts',
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
    await expect(page.getByText('Hello team').last()).toBeVisible();
    const inboxRest = await frame(page);
    expect(inboxRest).toEqual({ radius: '24px', pad: '8px', writing: null });
    const inboxField = page.locator('form textarea').last();
    await inboxField.tap();
    await expect(inboxField).toBeFocused();
    await page.waitForTimeout(400);
    expect(await frame(page)).toEqual(inboxRest);
    await expect(page.locator('[data-writing-composer]')).toHaveCount(0);
  });

  test('Function: useComposerWriting — the Ask-for-money wizard, wallet Send manual entry and the shop wizard change nothing', async ({
    page,
  }) => {
    await stubCamera(page, { kind: 'blank' });
    await openHome(page);
    const atRest = await frame(page);

    // Ask for money: its amount field is not the Post composer.
    await page.getByRole('button', { name: 'Ask for money' }).tap();
    const ask = page.getByLabel('Ask', { exact: true });
    await ask.tap();
    await expect(ask).toBeFocused();
    await page.waitForTimeout(400);
    // Without the Post composer on the page the shell has no writing mode at all.
    expect(await frame(page)).toEqual({ ...atRest, writing: null });
    await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
    await expect(page.getByText(LAWS_1)).toBeVisible();

    // Wallet Send, manual entry, over the same forum home.
    await page.goto('/welcome?visual=send-input');
    const region = page.getByRole('region', { name: 'Send Bitcoin' });
    await expect(region.locator('video')).toBeVisible();
    const sendRest = await frame(page);
    await region.getByRole('button', { name: 'Enter manually' }).tap();
    const manual = region.getByLabel('Payment request or address');
    await expect(manual).toBeFocused();
    await page.waitForTimeout(400);
    expect(await frame(page)).toEqual(sendRest);
    expect(sendRest.writing).not.toBe('on');

    // The shop wizard on /shops.
    await page.goto('/shops');
    await page.getByRole('button', { name: 'Add a shop' }).tap();
    await page.getByRole('button', { name: 'Next' }).tap();
    await page.getByRole('button', { name: 'Next' }).tap();
    const shopText = page.getByLabel('Shop text');
    await shopText.tap();
    await expect(shopText).toBeFocused();
    await page.waitForTimeout(400);
    expect(await frame(page)).toEqual({ radius: '24px', pad: '8px', writing: null });
    await expect(page.locator('[data-writing-composer]')).toHaveCount(0);
  });

  test('Function: useAppHeight — leaving the composer takes the full height at once; leaving a reply waits for the viewport', async ({
    page,
  }) => {
    await drivenViewport(page);
    await openHome(page);
    expect(await appHeight(page)).toBe('812px');

    const field = page.getByLabel('Your message');
    await field.tap();
    await keyboard(page, 480);
    expect(await appHeight(page)).toBe('480px');
    await field.blur();
    // The keyboard is still sliding away (the viewport still says 480): the frame is already full.
    expect(await appHeight(page)).toBe('812px');
    await page.evaluate(() => {
      (window as unknown as { __vvFire: (type: string) => void }).__vvFire('scroll');
    });
    expect(await appHeight(page)).toBe('812px');
    await keyboard(page, null);
    expect(await appHeight(page)).toBe('812px');

    // A reply field keeps the plain behaviour: the short viewport stays until it reports more.
    await page.getByRole('button', { name: 'React' }).first().tap();
    const reply = page.getByPlaceholder('Write a reaction');
    await reply.tap();
    await keyboard(page, 480);
    await reply.blur();
    expect(await appHeight(page)).toBe('480px');
    await keyboard(page, null);
    expect(await appHeight(page)).toBe('812px');
  });

  test('Function: useComposerWriting — with reduced motion the same end states come without animation', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openHome(page);
    await page.getByLabel('Your message').tap();
    await expect(page.locator('main')).toHaveAttribute('data-writing', 'on');
    await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Receive' })).toBeHidden();
    const timing = await page.evaluate(() => {
      const part = document.querySelector('h1')!.parentElement!;
      const style = getComputedStyle(part);
      return { duration: style.transitionDuration, delay: style.transitionDelay };
    });
    expect(timing.duration.split(', ').every((value) => parseFloat(value) < 0.001)).toBe(true);
    expect(timing.delay.split(', ').every((value) => value === '0s')).toBe(true);
  });
});

test('Function: useComposerWriting — a desktop pointer keeps the forum home as it was', async ({
  page,
}) => {
  await openHome(page);
  const atRest = await frame(page);
  expect(atRest).toEqual({ radius: '24px', pad: '8px', writing: null });
  const field = page.getByLabel('Your message');
  const fieldBox = (await field.boundingBox())!;
  const post = (await page.getByRole('button', { name: 'Post', exact: true }).boundingBox())!;
  // One row: photo, place, text field, send.
  expect(Math.abs(fieldBox.y + fieldBox.height / 2 - (post.y + post.height / 2))).toBeLessThan(2);
  await field.focus();
  await page.waitForTimeout(400);
  expect(await frame(page)).toEqual(atRest);
  await expect(page.getByRole('heading', { name: 'Welcome, Ada' })).toBeVisible();
  await expect(page.getByText('Note number 1 on the forum home.')).toBeVisible();
  await expect(page.locator('[data-writing-composer]')).toHaveCount(0);
});
